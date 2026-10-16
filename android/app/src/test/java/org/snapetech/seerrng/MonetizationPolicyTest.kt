package org.snapetech.seerrng

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MonetizationPolicyTest {
    @Test
    fun onlyPurchasedLifetimeProductGrantsEntitlement() {
        assertTrue(
            MonetizationPolicy.ownsLifetimeUnlock(
                listOf(purchase(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID, StorePurchaseState.PURCHASED)),
            ),
        )
        assertFalse(
            MonetizationPolicy.ownsLifetimeUnlock(
                listOf(purchase(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID, StorePurchaseState.PENDING)),
            ),
        )
    }

    @Test
    fun unrelatedProductsDoNotGrantLifetimeUnlock() {
        assertFalse(
            MonetizationPolicy.ownsLifetimeUnlock(
                listOf(purchase("other_product", StorePurchaseState.PURCHASED)),
            ),
        )
    }

    @Test
    fun purchasedLifetimeProductNeedsAcknowledgementOnlyOnce() {
        assertTrue(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID, StorePurchaseState.PURCHASED, acknowledged = false),
            ),
        )
        assertFalse(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID, StorePurchaseState.PURCHASED, acknowledged = true),
            ),
        )
        assertFalse(
            MonetizationPolicy.shouldAcknowledge(
                purchase(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID, StorePurchaseState.PENDING, acknowledged = false),
            ),
        )
    }

    @Test
    fun bannerAppearsOnlyWhenConfiguredWhileBrowsingWithoutLifetimeUnlock() {
        assertTrue(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = true, lifetimeUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = false, browsingServer = true, lifetimeUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = false, lifetimeUnlocked = false))
        assertFalse(MonetizationPolicy.shouldShowBanner(adsEnabled = true, browsingServer = true, lifetimeUnlocked = true))
    }

    @Test
    fun cappedUseAllowsOneSessionPerLaunchUntilLifetimeUnlock() {
        assertTrue(
            CappedUsePolicy.canStartServerSession(
                cappedMode = true,
                lifetimeUnlocked = false,
                sessionAlreadyStartedThisLaunch = false,
                usedSessions = 19,
                sessionLimit = 20,
            ),
        )
        assertTrue(
            CappedUsePolicy.canStartServerSession(
                cappedMode = true,
                lifetimeUnlocked = false,
                sessionAlreadyStartedThisLaunch = true,
                usedSessions = 20,
                sessionLimit = 20,
            ),
        )
        assertFalse(
            CappedUsePolicy.canStartServerSession(
                cappedMode = true,
                lifetimeUnlocked = false,
                sessionAlreadyStartedThisLaunch = false,
                usedSessions = 20,
                sessionLimit = 20,
            ),
        )
        assertTrue(
            CappedUsePolicy.canStartServerSession(
                cappedMode = true,
                lifetimeUnlocked = true,
                sessionAlreadyStartedThisLaunch = false,
                usedSessions = 20,
                sessionLimit = 20,
            ),
        )
        assertTrue(
            CappedUsePolicy.canStartServerSession(
                cappedMode = false,
                lifetimeUnlocked = false,
                sessionAlreadyStartedThisLaunch = false,
                usedSessions = 20,
                sessionLimit = 20,
            ),
        )
    }

    @Test
    fun legacyNoAdsPurchaseIdRemainsRestorable() {
        assertTrue(
            MonetizationPolicy.ownsLifetimeUnlock(
                listOf(purchase("no_ads_lifetime", StorePurchaseState.PURCHASED)),
            ),
        )
    }

    private fun purchase(
        productId: String,
        state: StorePurchaseState,
        acknowledged: Boolean = false,
    ) = StorePurchase(setOf(productId), state, acknowledged)
}
