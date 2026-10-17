import Combine
import Foundation
import StoreKit

@MainActor
final class StoreKitManager: ObservableObject {
    static let lifetimeProductID = "lifetime_unlock"

    @Published private(set) var product: Product?
    @Published private(set) var isUnlocked = false
    @Published private(set) var isPurchasing = false
    @Published var message: String?

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                await self?.apply(update)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    func load() async {
        do {
            product = try await Product.products(for: [Self.lifetimeProductID]).first
        } catch {
            product = nil
        }
        await refreshEntitlements()
    }

    func purchaseLifetimeAccess() async {
        guard let product else {
            message = "Lifetime access is not available in this build yet."
            return
        }

        isPurchasing = true
        defer { isPurchasing = false }
        do {
            switch try await product.purchase() {
            case let .success(result):
                await apply(result)
                if isUnlocked { message = "Lifetime access is active." }
            case .pending:
                message = "The purchase is waiting for approval."
            case .userCancelled:
                break
            @unknown default:
                message = "The purchase could not be completed."
            }
        } catch {
            message = "The purchase could not be completed. Please try again."
        }
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshEntitlements()
            message = isUnlocked ? "Lifetime access was restored." : "No lifetime purchase was found for this Apple Account."
        } catch {
            message = "Purchases could not be restored. Please try again."
        }
    }

    private func refreshEntitlements() async {
        isUnlocked = false
        for await result in Transaction.currentEntitlements {
            guard case let .verified(transaction) = result,
                  transaction.productID == Self.lifetimeProductID,
                  transaction.revocationDate == nil else { continue }
            isUnlocked = true
        }
    }

    private func apply(_ result: VerificationResult<Transaction>) async {
        switch result {
        case let .verified(transaction):
            if transaction.productID == Self.lifetimeProductID {
                if transaction.revocationDate == nil {
                    isUnlocked = true
                } else {
                    await refreshEntitlements()
                }
            }
            await transaction.finish()
        case .unverified:
            message = "The App Store could not verify this purchase."
        }
    }
}
