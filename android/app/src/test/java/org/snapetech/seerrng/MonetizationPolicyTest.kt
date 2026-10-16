package org.snapetech.seerrng

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MonetizationPolicyTest {
    @Test
    fun onlyPurchasedNoAdsProductGrantsEntitlement() {
        assertTrue(
            MonetizationPolicy.ownsNoAds(
                listOf(purchase(MonetizationPolicy.NO_ADS_PRODUCT_ID, StorePurchaseState.PURCHASED)),
            ),
        )
        assertFalse(
            MonetizationPolicy.ownsNoAds(
                listOf(purchase(MonetizationPolicy.NO_ADS_PRODUCT_ID, StorePurchaseState.PENDING)),
            ),
        )
    }

    @Test
    fun unrelatedProductsDoNotGrantNoAds() {
        assertFalse(
            MonetizationPolicy.ownsNoAds(
                listOf(purchase("other_product", StorePurchaseState.PURCHASED)),
            ),
        )
    }

    @Test
    fun purchasedNoAdsProductNeedsAcknowledgementOnlyOnce() {
        assertTrue(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.NO_ADS_PRODUCT_ID, StorePurchaseState.PURCHASED, acknowledged = false),
            ),
        )
        assertFalse(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.NO_ADS_PRODUCT_ID, StorePurchaseState.PURCHASED, acknowledged = true),
            ),
        )
        assertFalse(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.NO_ADS_PRODUCT_ID, StorePurchaseState.PENDING, acknowledged = false),
            ),
        )
    }

    @Test
    fun bannerAppearsOnlyWhenConfiguredWhileBrowsingWithoutUnlock() {
        assertTrue(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = true, noAdsUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = false, browsingServer = true, noAdsUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = false, noAdsUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = true, noAdsUnlocked = true))
    }

    private fun purchase(
        productId: String,
        state: StorePurchaseState,
        acknowledged: Boolean = false,
    ) = StorePurchase(setOf(productId), state, acknowledged)
}
