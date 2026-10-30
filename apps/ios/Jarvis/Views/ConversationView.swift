import SwiftUI

struct ConversationView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(model.messages.reversed()) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 120)
            }
            .onChange(of: model.messages.count) { _, _ in
                if let last = model.messages.reversed().last {
                    withAnimation {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

struct MessageBubble: View {
    let message: ConversationMessage

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.role.uppercased())
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(message.text)
                    .font(.body)
                    .padding(10)
                    .background(
                        message.isUser
                            ? Color.accentColor.opacity(0.18)
                            : Color.secondary.opacity(0.12),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                    )
            }
            if !message.isUser { Spacer(minLength: 40) }
        }
    }
}
