package org.snapetech.seerrng

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

internal class MonetizationManager(
    private val activity: Activity,
    private val adContainer: FrameLayout,
    private val onLifetimeUnlockChanged: (Boolean) -> Unit,
    private val onPriceChanged: (String?) -> Unit,
    private val onPrivacyOptionsChanged: (Boolean) -> Unit,
    private val onMessage: (Int) -> Unit,
) {
    private val preferences = activity.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val playStoreInstalled: Boolean by lazy {
        @Suppress("DEPRECATION")
        runCatching { activity.packageManager.getPackageInfo(PLAY_STORE_PACKAGE, 0) }.isSuccess
    }
    private var lifetimeUnlocked = preferences.getBoolean(LIFETIME_UNLOCKED_KEY, false) ||
        preferences.getBoolean(LEGACY_NO_ADS_UNLOCKED_KEY, false)
    private var billingClient: BillingClient? = null
    private var billingConnecting = false
    private var browsingServer = false
    private var released = false
    private var consentRequestInProgress = false
    private var mobileAdsInitializing = false
    private var mobileAdsInitialized = false
    private var bannerRequestPending = false
    private var consentInformation: ConsentInformation? = null
    private var adView: AdView? = null

    val isLifetimeUnlocked: Boolean
        get() = lifetimeUnlocked

    fun start() {
        onLifetimeUnlockChanged(lifetimeUnlocked)
        onPrivacyOptionsChanged(false)
        if (BuildConfig.BILLING_ENABLED && playStoreInstalled) {
            billingClient = BillingClient.newBuilder(activity)
                .setListener(PurchasesUpdatedListener(::onPurchasesUpdated))
                .enablePendingPurchases(
                    PendingPurchasesParams.newBuilder()
                        .enableOneTimeProducts()
                        .build(),
                )
                .enableAutoServiceReconnection()
                .build()
            connectBilling()
        }
    }

    fun setBrowsingServer(visible: Boolean) {
        browsingServer = visible
        if (visible && BuildConfig.ADS_ENABLED) requestConsentUpdate()
        updateBanner()
    }

    fun onResume() {
        if (released) return
        adView?.resume()
        connectBilling()
        if (BuildConfig.BILLING_ENABLED && billingClient?.isReady == true) {
            queryOwnedPurchases(manualRestore = false)
            queryProductDetails()
        }
        if (browsingServer && BuildConfig.ADS_ENABLED) requestConsentUpdate()
        updateBanner()
    }

    fun onPause() {
        adView?.pause()
    }

    fun onConfigurationChanged() {
        if (adView != null) {
            destroyBanner()
            updateBanner()
        }
    }

    fun purchaseLifetimeUnlock() {
        if (released) return
        if (!BuildConfig.BILLING_ENABLED) {
            onMessage(R.string.lifetime_product_unavailable)
            return
        }
        if (lifetimeUnlocked) return
        val client = billingClient
        if (client?.isReady != true) {
            connectBilling()
            onMessage(R.string.lifetime_purchase_unavailable)
            return
        }

        queryProductDetails { details ->
            val offer = details?.oneTimePurchaseOfferDetailsList?.firstOrNull()
            val offerToken = offer?.offerToken?.takeIf(String::isNotBlank)
            if (details == null || offerToken == null) {
                onMessage(R.string.lifetime_product_unavailable)
                return@queryProductDetails
            }

            val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .setOfferToken(offerToken)
                .build()
            val result = client.launchBillingFlow(
                activity,
                BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(productParams))
                    .build(),
            )
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                onMessage(R.string.lifetime_purchase_error)
            }
        }
    }

    fun restoreLifetimeUnlock() {
        if (released) return
        if (!BuildConfig.BILLING_ENABLED) {
            onMessage(R.string.lifetime_purchase_unavailable)
            return
        }
        if (billingClient?.isReady != true) {
            connectBilling()
            onMessage(R.string.lifetime_purchase_unavailable)
            return
        }
        queryOwnedPurchases(manualRestore = true)
    }

    fun showPrivacyOptions() {
        val information = consentInformation
        if (!BuildConfig.ADS_ENABLED || information == null ||
            information.privacyOptionsRequirementStatus != ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        ) {
            onMessage(R.string.ad_privacy_unavailable)
            return
        }

        UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
            if (released) return@showPrivacyOptionsForm
            if (error != null) onMessage(R.string.ad_privacy_unavailable)
            updatePrivacyOptionsVisibility()
            updateBanner()
        }
    }

    fun close() {
        released = true
        destroyBanner()
        billingClient?.endConnection()
        billingClient = null
    }

    private fun connectBilling() {
        val client = billingClient ?: return
        if (!BuildConfig.BILLING_ENABLED || released || client.isReady || billingConnecting) return
        billingConnecting = true
        client.startConnection(object : com.android.billingclient.api.BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                billingConnecting = false
                if (!released && billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryOwnedPurchases(manualRestore = false)
                    queryProductDetails()
                }
            }

            override fun onBillingServiceDisconnected() {
                billingConnecting = false
            }
        })
    }

    private fun queryProductDetails(onComplete: ((ProductDetails?) -> Unit)? = null) {
        val client = billingClient
        if (client?.isReady != true) {
            onComplete?.invoke(null)
            return
        }

        val product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.INAPP)
            .build()
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(product))
            .build()

        client.queryProductDetailsAsync(params) { result, detailsResult ->
            if (released) return@queryProductDetailsAsync
            val details = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                detailsResult.productDetailsList.firstOrNull()
            } else {
                null
            }
            onPriceChanged(details?.oneTimePurchaseOfferDetailsList?.firstOrNull()?.formattedPrice)
            onComplete?.invoke(details)
        }
    }

    private fun queryOwnedPurchases(manualRestore: Boolean) {
        val client = billingClient ?: return
        if (!client.isReady) return
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()
        client.queryPurchasesAsync(params) { result, purchases ->
            if (released) return@queryPurchasesAsync
            if (result.responseCode != BillingClient.BillingResponseCode.OK) return@queryPurchasesAsync

            val wasUnlocked = lifetimeUnlocked
            applyPurchaseState(purchases)
            if (manualRestore) {
                onMessage(
                    if (lifetimeUnlocked) R.string.lifetime_purchase_restored
                    else R.string.lifetime_purchase_not_found,
                )
            } else if (!wasUnlocked && lifetimeUnlocked) {
                onMessage(R.string.lifetime_purchase_success)
            }
        }
    }

    private fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (released) return
        when {
            result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null -> {
                val wasUnlocked = lifetimeUnlocked
                applyPurchaseState(purchases)
                if (!wasUnlocked && lifetimeUnlocked) {
                    onMessage(R.string.lifetime_purchase_success)
                } else if (purchases.any { purchase ->
                        MonetizationPolicy.LIFETIME_UNLOCK_PRODUCT_ID in purchase.products &&
                            purchase.purchaseState == Purchase.PurchaseState.PENDING
                    }
                ) {
                    onMessage(R.string.lifetime_purchase_pending)
                }
            }

            result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> onMessage(R.string.lifetime_purchase_error)
        }
    }

    private fun applyPurchaseState(purchases: List<Purchase>) {
        val records = purchases.map { it.toStorePurchase() }
        purchases.filter { purchase ->
            MonetizationPolicy.shouldAcknowledge(purchase.toStorePurchase())
        }.forEach(::acknowledgePurchase)
        setLifetimeUnlocked(MonetizationPolicy.ownsLifetimeUnlock(records))
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        val client = billingClient ?: return
        if (!client.isReady) return
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        client.acknowledgePurchase(params) { result ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                // A later purchase query retries acknowledgement if Play is temporarily unavailable.
            }
        }
    }

    private fun setLifetimeUnlocked(unlocked: Boolean) {
        if (lifetimeUnlocked != unlocked) {
            lifetimeUnlocked = unlocked
            preferences.edit().putBoolean(LIFETIME_UNLOCKED_KEY, unlocked).apply()
            onLifetimeUnlockChanged(unlocked)
        }
        updateBanner()
    }

    private fun requestConsentUpdate() {
        if (!BuildConfig.ADS_ENABLED || released || consentRequestInProgress) return
        val information = consentInformation
            ?: UserMessagingPlatform.getConsentInformation(activity).also { consentInformation = it }
        consentRequestInProgress = true
        val parameters = ConsentRequestParameters.Builder().build()
        information.requestConsentInfoUpdate(
            activity,
            parameters,
            {
                if (released || !browsingServer || activity.isFinishing || activity.isDestroyed) {
                    consentRequestInProgress = false
                    updatePrivacyOptionsVisibility()
                    return@requestConsentInfoUpdate
                }
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { _ ->
                    consentRequestInProgress = false
                    if (released) return@loadAndShowConsentFormIfRequired
                    updatePrivacyOptionsVisibility()
                    initializeMobileAdsIfAllowed()
                }
            },
            {
                consentRequestInProgress = false
                if (released) return@requestConsentInfoUpdate
                updatePrivacyOptionsVisibility()
                initializeMobileAdsIfAllowed()
            },
        )
        initializeMobileAdsIfAllowed()
    }

    private fun initializeMobileAdsIfAllowed() {
        val information = consentInformation ?: return
        if (!BuildConfig.ADS_ENABLED || !information.canRequestAds() || mobileAdsInitializing || mobileAdsInitialized) {
            updateBanner()
            return
        }

        mobileAdsInitializing = true
        MobileAds.initialize(activity) {
            activity.runOnUiThread {
                mobileAdsInitializing = false
                mobileAdsInitialized = true
                updateBanner()
            }
        }
    }

    private fun updatePrivacyOptionsVisibility() {
        val required = BuildConfig.ADS_ENABLED &&
            consentInformation?.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        onPrivacyOptionsChanged(required)
    }

    private fun updateBanner() {
        if (released) return
        val allowedByApp = MonetizationPolicy.shouldShowBanner(
            adsEnabled = BuildConfig.ADS_ENABLED,
            browsingServer = browsingServer,
            lifetimeUnlocked = lifetimeUnlocked,
        )
        val allowedByConsent = consentInformation?.canRequestAds() == true
        if (!allowedByApp || !allowedByConsent) {
            destroyBanner()
            return
        }
        if (!mobileAdsInitialized || adView != null || bannerRequestPending) return

        bannerRequestPending = true
        adContainer.visibility = View.GONE
        adContainer.post {
            if (released ||
                !BuildConfig.ADS_ENABLED ||
                consentInformation?.canRequestAds() != true ||
                adView != null ||
                adContainer.width <= 0 ||
                !browsingServer ||
                lifetimeUnlocked ||
                !mobileAdsInitialized
            ) {
                bannerRequestPending = false
                return@post
            }

            val density = activity.resources.displayMetrics.density
            val widthDp = (adContainer.width / density).toInt().coerceAtLeast(1)
            @Suppress("DEPRECATION")
            val bannerSize = AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp)
            val view = AdView(activity).apply {
                adUnitId = BuildConfig.ADMOB_BANNER_AD_UNIT_ID
                setAdSize(bannerSize)
                adListener = object : AdListener() {
                    override fun onAdLoaded() {
                        bannerRequestPending = false
                        if (adView === this@apply && browsingServer && !lifetimeUnlocked) {
                            adContainer.visibility = View.VISIBLE
                        }
                    }

                    override fun onAdFailedToLoad(error: LoadAdError) {
                        bannerRequestPending = false
                        if (adView === this@apply) {
                            adContainer.visibility = View.GONE
                            adContainer.removeView(this@apply)
                            destroy()
                            adView = null
                        }
                    }
                }
            }
            adView = view
            adContainer.removeAllViews()
            adContainer.addView(
                view,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                ),
            )
            val nonPersonalizedExtras = Bundle().apply { putString("npa", "1") }
            view.loadAd(
                AdRequest.Builder()
                    .addNetworkExtrasBundle(AdMobAdapter::class.java, nonPersonalizedExtras)
                    .build(),
            )
        }
    }

    private fun destroyBanner() {
        bannerRequestPending = false
        adContainer.visibility = View.GONE
        adView?.let { view ->
            adContainer.removeView(view)
            view.destroy()
        }
        adView = null
    }

    private fun Purchase.toStorePurchase(): StorePurchase = StorePurchase(
        productIds = products.toSet(),
        state = when (purchaseState) {
            Purchase.PurchaseState.PURCHASED -> StorePurchaseState.PURCHASED
            Purchase.PurchaseState.PENDING -> StorePurchaseState.PENDING
            else -> StorePurchaseState.UNSPECIFIED
        },
        acknowledged = isAcknowledged,
    )

    private companion object {
        const val PLAY_STORE_PACKAGE = "com.android.vending"
        const val PREFERENCES_NAME = "seerrng_monetization"
        const val LIFETIME_UNLOCKED_KEY = "lifetime_unlocked"
        const val LEGACY_NO_ADS_UNLOCKED_KEY = "no_ads_lifetime_unlocked"
    }
}
