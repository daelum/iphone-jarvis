import Foundation

enum OrchestratorError: LocalizedError {
    case invalidURL
    case http(Int, String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid orchestrator URL"
        case .http(let code, let body): return "HTTP \(code): \(body)"
        case .decoding(let err): return "Decode error: \(err.localizedDescription)"
        }
    }
}

/// HTTP client for the Jarvis orchestrator. Base URL is configurable in Settings.
final class OrchestratorClient {
    var baseURL: URL
    var token: String
    var deviceId: String

    init(
        baseURL: URL = URL(string: "http://127.0.0.1:8787")!,
        token: String = "dev-token",
        deviceId: String = UUID().uuidString
    ) {
        self.baseURL = baseURL
        self.token = token
        self.deviceId = deviceId
    }

    private func request(
        _ method: String,
        path: String,
        body: Encodable? = nil
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw OrchestratorError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(deviceId, forHTTPHeaderField: "X-Jarvis-Device-Id")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw OrchestratorError.http(-1, "No HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw OrchestratorError.http(http.statusCode, text)
        }
        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw OrchestratorError.decoding(error)
        }
    }

    func health() async throws -> HealthResponse {
        let data = try await request("GET", path: "/health")
        return try decode(HealthResponse.self, from: data)
    }

    func messages() async throws -> [ConversationMessage] {
        let data = try await request("GET", path: "/v1/messages")
        return try decode(MessagesResponse.self, from: data).messages
    }

    func createAgent(text: String, name: String? = nil) async throws -> CreateAgentResponse {
        struct Body: Encodable {
            let text: String
            let name: String?
        }
        let data = try await request("POST", path: "/v1/agents", body: Body(text: text, name: name))
        return try decode(CreateAgentResponse.self, from: data)
    }

    func followUp(agentId: String, text: String) async throws -> FollowUpResponse {
        struct Body: Encodable { let text: String }
        let data = try await request(
            "POST",
            path: "/v1/agents/\(agentId)/follow-up",
            body: Body(text: text)
        )
        return try decode(FollowUpResponse.self, from: data)
    }

    func steer(agentId: String, text: String) async throws -> FollowUpResponse {
        struct Body: Encodable { let text: String }
        let data = try await request(
            "POST",
            path: "/v1/agents/\(agentId)/steer",
            body: Body(text: text)
        )
        return try decode(FollowUpResponse.self, from: data)
    }

    func cancel(agentId: String, runId: String) async throws -> CancelResponse {
        let data = try await request(
            "POST",
            path: "/v1/agents/\(agentId)/runs/\(runId)/cancel"
        )
        return try decode(CancelResponse.self, from: data)
    }

    func status(agentId: String? = nil) async throws -> LiveStatus {
        var path = "/v1/status"
        if let agentId, !agentId.isEmpty {
            path += "?agentId=\(agentId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? agentId)"
        }
        let data = try await request("GET", path: path)
        return try decode(LiveStatus.self, from: data)
    }

    func pendingApprovals() async throws -> [ApprovalTicket] {
        let data = try await request("GET", path: "/v1/approvals/pending")
        return try decode(ApprovalsResponse.self, from: data).tickets
    }

    func approve(ticketId: String) async throws {
        _ = try await request("POST", path: "/v1/approvals/\(ticketId)/approve")
    }

    func deny(ticketId: String) async throws {
        _ = try await request("POST", path: "/v1/approvals/\(ticketId)/deny")
    }

    /// Deep-link URL for opening the agent in Safari / Cursor web.
    static func cursorAgentURL(agentId: String) -> URL? {
        URL(string: "https://cursor.com/agents/\(agentId)")
    }
}

/// Type-erased Encodable wrapper for request bodies.
private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        self.encodeFunc = wrapped.encode
    }
    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}
