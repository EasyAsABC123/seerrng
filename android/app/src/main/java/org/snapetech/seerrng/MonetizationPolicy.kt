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
    const val NO_ADS_PRODUCT_ID = "no_ads_lifetime"

    fun ownsNoAds(purchases: Iterable<StorePurchase>): Boolean =
        purchases.any { purchase ->
            NO_ADS_PRODUCT_ID in purchase.productIds && purchase.state == StorePurchaseState.PURCHASED
        }

    fun shouldAcknowledge(purchase: StorePurchase): Boolean =
        NO_ADS_PRODUCT_ID in purchase.productIds &&
            purchase.state == StorePurchaseState.PURCHASED &&
            !purchase.acknowledged

    fun shouldShowBanner(adsEnabled: Boolean, browsingServer: Boolean, noAdsUnlocked: Boolean): Boolean =
        adsEnabled && browsingServer && !noAdsUnlocked
}
