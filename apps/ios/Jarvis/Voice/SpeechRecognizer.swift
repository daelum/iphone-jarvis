import AVFoundation
import Foundation
import Speech

/// Voice v0: on-device Speech → text, then the same create/follow-up path as typing.
@MainActor
final class SpeechRecognizer: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording = false
    @Published var authMessage: String?

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    func requestAuthorization() async -> Bool {
        await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                Task { @MainActor in
                    switch status {
                    case .authorized:
                        self.authMessage = nil
                        cont.resume(returning: true)
                    case .denied:
                        self.authMessage = "Speech recognition denied"
                        cont.resume(returning: false)
                    case .restricted:
                        self.authMessage = "Speech recognition restricted"
                        cont.resume(returning: false)
                    case .notDetermined:
                        self.authMessage = "Speech recognition not determined"
                        cont.resume(returning: false)
                    @unknown default:
                        cont.resume(returning: false)
                    }
                }
            }
        }
    }

    func toggle() async {
        if isRecording {
            stop()
            return
        }
        let ok = await requestAuthorization()
        guard ok else { return }
        do {
            try start()
        } catch {
            authMessage = error.localizedDescription
            isRecording = false
        }
    }

    private func start() throws {
        guard let recognizer, recognizer.isAvailable else {
            throw NSError(
                domain: "JarvisSpeech",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Speech recognizer unavailable"]
            )
        }

        transcript = ""
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let request else { return }
        request.shouldReportPartialResults = true

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isRecording = true

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.stop()
                }
            }
        }
    }

    func stop() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isRecording = false
    }
}
