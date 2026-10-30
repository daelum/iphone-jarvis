import Foundation

struct ConversationMessage: Identifiable, Codable, Hashable {
    let id: String
    let role: String
    let text: String
    let createdAt: String
    let agentId: String?
    let runId: String?

    var isUser: Bool { role == "user" }
}

struct CreateAgentResponse: Codable {
    let agentId: String
    let runId: String?
    let url: String?
    let name: String?
    let status: String
    let mock: Bool?
    let pendingTicket: PendingTicket?
}

struct PendingTicket: Codable {
    let id: String
    let reason: String
}

struct FollowUpResponse: Codable {
    let runId: String?
    let status: String
    let delivery: String?
    let mock: Bool?
}

struct CancelResponse: Codable {
    let id: String
    let mock: Bool?
}

struct LiveStatus: Codable {
    let agentId: String
    let runId: String?
    let status: String
    let name: String?
    let url: String?
    let summary: String?
    let pendingApprovals: Int
}

struct ApprovalTicket: Identifiable, Codable {
    let id: String
    let kind: String
    let status: String
    let reason: String
    let secretName: String?
    let agentId: String?
    let createdAt: String
    let expiresAt: String
}

struct MessagesResponse: Codable {
    let messages: [ConversationMessage]
}

struct ApprovalsResponse: Codable {
    let tickets: [ApprovalTicket]
}

struct HealthResponse: Codable {
    let ok: Bool
    let service: String?
    let cursorApiConfigured: Bool?
}
