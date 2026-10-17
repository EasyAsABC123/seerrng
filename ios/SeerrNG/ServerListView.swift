import SwiftUI

struct ServerListView: View {
    @ObservedObject var serverStore: ServerStore
    @ObservedObject var usageStore: CappedUsageStore
    @ObservedObject var storeKit: StoreKitManager
    let onConnect: (ServerEndpoint) -> Void
    let onUnlock: () -> Void

    @State private var showingEditor = false
    @State private var editingServer: ServerEndpoint?
    @State private var serverPendingDeletion: ServerEndpoint?

    var body: some View {
        List {
            if serverStore.servers.isEmpty {
                ContentUnavailableView {
                    Label("Connect to SeerrNG", systemImage: "play.rectangle.on.rectangle")
                } description: {
                    Text("Add the address of your SeerrNG server to get started.")
                } actions: {
                    Button("Add server") { addServer() }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("addServerButton")
                }
            } else {
                Section("Your servers") {
                    ForEach(serverStore.servers) { server in
                        serverRow(server)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    serverPendingDeletion = server
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .accessibilityLabel("Delete \(server.name)")
                                Button {
                                    editingServer = server
                                    showingEditor = true
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .tint(.blue)
                            }
                    }
                }
            }

            if !storeKit.isUnlocked {
                Section("Free preview") {
                    Label("\(usageStore.remainingSessions) successful sessions left", systemImage: "hourglass")
                    Button("Lifetime access and restore purchases", action: onUnlock)
                }
            }

            Section {
                Link("Privacy policy", destination: URL(string: "https://snapetech-org.github.io/seerrng-android-privacy/")!)
            } footer: {
                Text("Server addresses stay on this device. HTTPS is recommended; HTTP connections are not encrypted.")
            }
        }
        .navigationTitle("SeerrNG")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: addServer) {
                    Label("Add server", systemImage: "plus")
                }
                .accessibilityIdentifier("addServerToolbarButton")
            }
        }
        .sheet(isPresented: $showingEditor, onDismiss: { editingServer = nil }) {
            ServerEditorView(server: editingServer) { serverStore.save($0) }
        }
        .alert(
            "Delete server?",
            isPresented: Binding(
                get: { serverPendingDeletion != nil },
                set: { if !$0 { serverPendingDeletion = nil } }
            ),
            presenting: serverPendingDeletion
        ) { server in
            Button("Cancel", role: .cancel) {
                serverPendingDeletion = nil
            }
            Button("Delete", role: .destructive) {
                serverStore.remove(id: server.id)
                serverPendingDeletion = nil
            }
        } message: { server in
            Text("Remove \(server.name) from this device?")
        }
    }

    @ViewBuilder
    private func serverRow(_ server: ServerEndpoint) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(server.name).font(.headline)
                Text(server.urlString)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if !server.usesHTTPS {
                    Label("HTTP is not encrypted", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            Spacer(minLength: 4)
            Button {
                onConnect(server)
            } label: {
                Text("Connect")
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("connectServer_\(server.id.uuidString)")

            Menu {
                Button {
                    editingServer = server
                    showingEditor = true
                } label: {
                    Label("Edit", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    serverPendingDeletion = server
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                .accessibilityLabel("Delete \(server.name)")
            } label: {
                Image(systemName: "ellipsis")
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Actions for \(server.name)")
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
    }

    private func addServer() {
        editingServer = nil
        showingEditor = true
    }
}
