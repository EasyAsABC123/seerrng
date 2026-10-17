package org.snapetech.seerrng

internal enum class StorePurchaseState {
    PURCHASED,
    PENDING,
    UNSPECIFIED,
}

internal data class StorePurchase(
    val productIds: Set<String>,
    val state: StorePurchaseState,
    val acknowledged: Boolean,
)

internal object MonetizationPolicy {
    const val LIFETIME_UNLOCK_PRODUCT_ID = "lifetime_unlock"
    private const val LEGACY_NO_ADS_PRODUCT_ID = "no_ads_lifetime"

    private fun StorePurchase.isLifetimeUnlock(): Boolean =
        LIFETIME_UNLOCK_PRODUCT_ID in productIds || LEGACY_NO_ADS_PRODUCT_ID in productIds

    fun ownsLifetimeUnlock(purchases: Iterable<StorePurchase>): Boolean =
        purchases.any { purchase -> purchase.isLifetimeUnlock() && purchase.state == StorePurchaseState.PURCHASED }

    fun shouldAcknowledge(purchase: StorePurchase): Boolean =
        purchase.isLifetimeUnlock() && purchase.state == StorePurchaseState.PURCHASED && !purchase.acknowledged
}

internal object CappedUsePolicy {
    fun canStartServerSession(
        previewEnabled: Boolean,
        lifetimeUnlocked: Boolean,
        sessionAlreadyStartedThisLaunch: Boolean,
        usedSessions: Int,
        sessionLimit: Int,
    ): Boolean = !previewEnabled || lifetimeUnlocked || sessionAlreadyStartedThisLaunch || usedSessions < sessionLimit
}
