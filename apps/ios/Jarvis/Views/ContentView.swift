import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: AppModel
    @StateObject private var speech = SpeechRecognizer()
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                ConversationView()

                ControlOverlay()
                    .padding(.horizontal)
                    .padding(.top, 8)
            }
            .safeAreaInset(edge: .bottom) {
                ComposerBar(speech: speech)
            }
            .navigationTitle("Jarvis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .onAppear {
                model.startPolling()
            }
            .onDisappear {
                model.stopPolling()
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppModel())
}
