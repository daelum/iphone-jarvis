import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Orchestrator") {
                    TextField("Base URL", text: $model.baseURLString)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    SecureField("Jarvis token", text: $model.token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("iOS never holds the Cursor API key — only this Jarvis session token.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section("Auth") {
                    Text("Slice 1 uses a device/session stub. Sign in with Apple will replace Bearer \(model.token.isEmpty ? "…" : "dev token") — see orchestrator src/auth/README.md.")
                        .font(.caption)
                }
                Section {
                    Button("Save") {
                        model.persistSettings()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
