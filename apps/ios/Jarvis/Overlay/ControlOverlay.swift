import SwiftUI

/// On-screen control surface: start / steer / cancel / status / pending-approval badge.
struct ControlOverlay: View {
    @EnvironmentObject private var model: AppModel
    @State private var steerText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Cursor control")
                    .font(.headline)
                Spacer()
                if model.pendingTickets.count > 0 {
                    Text("\(model.pendingTickets.count)")
                        .font(.caption.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.9))
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                        .accessibilityLabel("Pending approvals")
                }
                Button {
                    model.overlayExpanded.toggle()
                } label: {
                    Image(systemName: model.overlayExpanded ? "chevron.down" : "chevron.up")
                }
            }

            statusRow

            if model.overlayExpanded {
                controls
                if !model.pendingTickets.isEmpty {
                    pendingList
                }
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
        )
    }

    private var statusRow: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.liveStatus?.name ?? "No agent")
                .font(.subheadline.weight(.semibold))
            Text(statusLine)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
    }

    private var statusLine: String {
        guard let s = model.liveStatus else { return "Idle — send a prompt to start" }
        var parts = [s.status]
        if let runId = s.runId { parts.append(runId) }
        if let summary = s.summary { parts.append(summary) }
        return parts.joined(separator: " · ")
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Button("Status") {
                    Task { await model.refreshStatus() }
                }
                .buttonStyle(.bordered)

                Button("Open Cursor") {
                    model.openInCursor()
                }
                .buttonStyle(.bordered)

                Button("Cancel", role: .destructive) {
                    Task { await model.cancelActive() }
                }
                .buttonStyle(.bordered)
                .disabled(model.liveStatus?.runId == nil)
            }

            HStack {
                TextField("Steer…", text: $steerText)
                    .textFieldStyle(.roundedBorder)
                Button("Steer") {
                    let text = steerText
                    steerText = ""
                    Task { await model.steer(text) }
                }
                .buttonStyle(.borderedProminent)
                .disabled(steerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var pendingList: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Pending approval (stub channel)")
                .font(.caption.weight(.semibold))
            ForEach(model.pendingTickets) { ticket in
                VStack(alignment: .leading, spacing: 4) {
                    Text(ticket.reason)
                        .font(.caption)
                    HStack {
                        Button("Approve") {
                            Task { await model.approve(ticket) }
                        }
                        .buttonStyle(.borderedProminent)
                        Button("Deny", role: .destructive) {
                            Task { await model.deny(ticket) }
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
