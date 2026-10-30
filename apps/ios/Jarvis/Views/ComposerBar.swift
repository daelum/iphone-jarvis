import SwiftUI

struct ComposerBar: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var speech: SpeechRecognizer

    var body: some View {
        VStack(spacing: 8) {
            if let banner = model.banner {
                Text(banner)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let auth = speech.authMessage {
                Text(auth)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Prompt Cursor…", text: $model.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...5)

                Button {
                    Task { await speech.toggle() }
                } label: {
                    Image(systemName: speech.isRecording ? "stop.circle.fill" : "mic.circle.fill")
                        .font(.title2)
                        .foregroundStyle(speech.isRecording ? Color.red : Color.accentColor)
                }
                .accessibilityLabel(speech.isRecording ? "Stop recording" : "Start voice")

                Button {
                    let text = model.draft
                    Task { await model.sendPrompt(text) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(
                    model.isBusy
                        || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.bar)
        .onChange(of: speech.transcript) { _, newValue in
            if !newValue.isEmpty {
                model.draft = newValue
            }
        }
        .onChange(of: speech.isRecording) { wasRecording, isRecording in
            // When recording stops with a transcript, send via the same path as typed input.
            if wasRecording && !isRecording {
                let text = speech.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty {
                    model.draft = text
                    Task { await model.sendPrompt(text) }
                    speech.transcript = ""
                }
            }
        }
    }
}
