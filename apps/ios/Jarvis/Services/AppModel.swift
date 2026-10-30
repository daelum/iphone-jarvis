import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

@MainActor
final class AppModel: ObservableObject {
    @Published var messages: [ConversationMessage] = []
    @Published var draft: String = ""
    @Published var liveStatus: LiveStatus?
    @Published var pendingTickets: [ApprovalTicket] = []
    @Published var isBusy = false
    @Published var banner: String?
    @Published var overlayExpanded = true
    @Published var baseURLString: String
    @Published var token: String

    let client: OrchestratorClient
    private var statusTask: Task<Void, Never>?

    init() {
        let defaults = UserDefaults.standard
        let base = defaults.string(forKey: "jarvis.baseURL") ?? "http://127.0.0.1:8787"
        let tok = defaults.string(forKey: "jarvis.token") ?? "dev-token"
        self.baseURLString = base
        self.token = tok
        self.client = OrchestratorClient(
            baseURL: URL(string: base) ?? URL(string: "http://127.0.0.1:8787")!,
            token: tok
        )
    }

    func persistSettings() {
        UserDefaults.standard.set(baseURLString, forKey: "jarvis.baseURL")
        UserDefaults.standard.set(token, forKey: "jarvis.token")
        if let url = URL(string: baseURLString) {
            client.baseURL = url
        }
        client.token = token
    }

    func startPolling() {
        statusTask?.cancel()
        statusTask = Task {
            while !Task.isCancelled {
                await refreshStatus()
                await refreshMessages()
                await refreshApprovals()
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    func stopPolling() {
        statusTask?.cancel()
        statusTask = nil
    }

    func refreshMessages() async {
        do {
            messages = try await client.messages()
        } catch {
            // Keep last good transcript while offline
        }
    }

    func refreshStatus() async {
        do {
            liveStatus = try await client.status(agentId: liveStatus?.agentId)
        } catch {
            // ignore transient
        }
    }

    func refreshApprovals() async {
        do {
            pendingTickets = try await client.pendingApprovals()
        } catch {
            // ignore
        }
    }

    /// Typed or voice text → create (no agent yet) or follow-up.
    func sendPrompt(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isBusy = true
        banner = nil
        defer { isBusy = false }
        do {
            if let agentId = liveStatus?.agentId, !agentId.isEmpty {
                let res = try await client.followUp(agentId: agentId, text: trimmed)
                banner = "Follow-up \(res.status)"
            } else {
                let res = try await client.createAgent(text: trimmed)
                liveStatus = LiveStatus(
                    agentId: res.agentId,
                    runId: res.runId,
                    status: res.status,
                    name: res.name,
                    url: res.url,
                    summary: res.mock == true ? "Mock mode" : nil,
                    pendingApprovals: res.pendingTicket == nil ? 0 : 1
                )
                banner = res.mock == true ? "Mock agent created" : "Agent started"
            }
            draft = ""
            await refreshMessages()
            await refreshStatus()
            await refreshApprovals()
        } catch {
            banner = error.localizedDescription
        }
    }

    func steer(_ text: String) async {
        guard let agentId = liveStatus?.agentId, !agentId.isEmpty else {
            banner = "No active agent to steer"
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await client.steer(agentId: agentId, text: text)
            banner = "Steer: \(res.delivery ?? res.status)"
            await refreshStatus()
            await refreshMessages()
        } catch {
            banner = error.localizedDescription
        }
    }

    func cancelActive() async {
        guard let agentId = liveStatus?.agentId,
              let runId = liveStatus?.runId,
              !agentId.isEmpty,
              !runId.isEmpty
        else {
            banner = "Nothing to cancel"
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            _ = try await client.cancel(agentId: agentId, runId: runId)
            banner = "Cancelled \(runId)"
            await refreshStatus()
        } catch {
            banner = error.localizedDescription
        }
    }

    func openInCursor() {
        guard let agentId = liveStatus?.agentId, !agentId.isEmpty,
              let url = OrchestratorClient.cursorAgentURL(agentId: agentId)
                ?? (liveStatus?.url.flatMap(URL.init(string:)))
        else {
            banner = "No agent URL yet"
            return
        }
        #if canImport(UIKit)
        UIApplication.shared.open(url)
        #endif
    }

    func approve(_ ticket: ApprovalTicket) async {
        do {
            try await client.approve(ticketId: ticket.id)
            await refreshApprovals()
            banner = "Approved \(ticket.id)"
        } catch {
            banner = error.localizedDescription
        }
    }

    func deny(_ ticket: ApprovalTicket) async {
        do {
            try await client.deny(ticketId: ticket.id)
            await refreshApprovals()
            banner = "Denied \(ticket.id)"
        } catch {
            banner = error.localizedDescription
        }
    }
}
