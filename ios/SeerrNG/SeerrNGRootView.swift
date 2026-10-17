import SwiftUI

struct SeerrNGRootView: View {
    @StateObject private var serverStore = ServerStore()
    @StateObject private var usageStore = CappedUsageStore()
    @StateObject private var storeKit = StoreKitManager()
    @State private var activeServer: ServerEndpoint?
    @State private var showingUnlock = false

    var body: some View {
        NavigationStack {
            Group {
                if let activeServer {
                    ServerBrowserView(
                        initialServer: activeServer,
                        serverStore: serverStore,
                        usageStore: usageStore,
                        storeKit: storeKit,
                        onClose: closeBrowser,
                        onUnlock: { showingUnlock = true }
                    )
                } else {
                    ServerListView(
                        serverStore: serverStore,
                        usageStore: usageStore,
                        storeKit: storeKit,
                        onConnect: connect,
                        onUnlock: { showingUnlock = true }
                    )
                }
            }
        }
        .task { await storeKit.load() }
        .sheet(isPresented: $showingUnlock) {
            LifetimeUnlockView(usageStore: usageStore, storeKit: storeKit)
                .presentationDetents([.medium, .large])
        }
        .alert("Purchase status", isPresented: Binding(
            get: { storeKit.message != nil },
            set: { if !$0 { storeKit.message = nil } }
        )) {
            Button("OK", role: .cancel) { storeKit.message = nil }
        } message: {
            Text(storeKit.message ?? "")
        }
    }

    private func connect(_ server: ServerEndpoint) {
        guard usageStore.canStartSession(isUnlocked: storeKit.isUnlocked) else {
            showingUnlock = true
            return
        }
        usageStore.beginSession()
        activeServer = server
    }

    private func closeBrowser() {
        usageStore.endSession()
        activeServer = nil
    }
}
