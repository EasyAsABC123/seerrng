import SwiftUI

struct ServerEditorView: View {
    @Environment(\.dismiss) private var dismiss

    let server: ServerEndpoint?
    let onSave: (ServerEndpoint) -> Void

    @State private var name: String
    @State private var address: String
    @State private var errorMessage: String?
    @State private var pendingServer: ServerEndpoint?
    @State private var confirmingHTTP = false

    init(server: ServerEndpoint?, onSave: @escaping (ServerEndpoint) -> Void) {
        self.server = server
        self.onSave = onSave
        _name = State(initialValue: server?.name ?? "")
        _address = State(initialValue: server?.urlString ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Name", text: $name)
                        .textContentType(.organizationName)
                        .accessibilityIdentifier("serverNameField")
                    TextField("https://server.example.com", text: $address)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("serverURLField")
                    if !address.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("https://") {
                        Label("HTTPS protects your sign-in. HTTP sends it without encryption.", systemImage: "lock.open.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(server == nil ? "Add server" : "Edit server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save)
                        .accessibilityIdentifier("saveServerButton")
                }
            }
            .alert("Use an unencrypted HTTP connection?", isPresented: $confirmingHTTP) {
                Button("Cancel", role: .cancel) { pendingServer = nil }
                Button("Use HTTP", role: .destructive) {
                    guard let pendingServer else { return }
                    var accepted = pendingServer
                    accepted.httpWarningAccepted = true
                    onSave(accepted)
                    dismiss()
                }
            } message: {
                Text("Your server may be on a private network, but HTTP does not encrypt passwords or session cookies. HTTPS is safer.")
            }
        }
    }

    private func save() {
        do {
            let endpoint = try ServerEndpoint.create(
                id: server?.id ?? UUID(),
                name: name,
                address: address,
                httpWarningAccepted: server?.httpWarningAccepted ?? false
            )
            errorMessage = nil
            if endpoint.usesHTTPS || server?.urlString == endpoint.urlString && server?.httpWarningAccepted == true {
                onSave(endpoint)
                dismiss()
            } else {
                pendingServer = endpoint
                confirmingHTTP = true
            }
        } catch let error as LocalizedError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = "The server address could not be saved."
        }
    }
}
