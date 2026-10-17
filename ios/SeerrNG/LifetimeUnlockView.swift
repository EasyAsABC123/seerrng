import SwiftUI

struct LifetimeUnlockView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var usageStore: CappedUsageStore
    @ObservedObject var storeKit: StoreKitManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Image(systemName: storeKit.isUnlocked ? "checkmark.seal.fill" : "hourglass")
                    .font(.system(size: 42))
                    .foregroundStyle(.tint)
                Text(storeKit.isUnlocked ? "Lifetime access is active" : "Free preview complete")
                    .font(.title2.bold())
                Text(storeKit.isUnlocked
                     ? "You have unlimited sessions on this Apple Account."
                     : "The free preview includes 20 successful server sessions per installation. Unlock once for unlimited sessions on this Apple Account.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                if !storeKit.isUnlocked {
                    Text("\(usageStore.remainingSessions) free sessions remain")
                        .font(.subheadline.weight(.medium))
                }
                if !storeKit.isUnlocked {
                    Button {
                        Task { await storeKit.purchaseLifetimeAccess() }
                    } label: {
                        if storeKit.isPurchasing {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(storeKit.product.map { "Unlock for \($0.displayPrice) once" } ?? "Lifetime access unavailable")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(storeKit.product == nil || storeKit.isPurchasing)
                    Button("Restore purchases") {
                        Task { await storeKit.restorePurchases() }
                    }
                    .disabled(storeKit.isPurchasing)
                }
                Button("Not now", role: .cancel) { dismiss() }
                    .padding(.top, 2)
                Text("Purchases are managed by Apple. The price and terms are shown before purchase.")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding(24)
            .navigationTitle("SeerrNG")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
