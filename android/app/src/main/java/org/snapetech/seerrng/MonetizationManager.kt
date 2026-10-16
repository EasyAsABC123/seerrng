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
    private val onNoAdsChanged: (Boolean) -> Unit,
    private val onPriceChanged: (String?) -> Unit,
    private val onPrivacyOptionsChanged: (Boolean) -> Unit,
    private val onMessage: (Int) -> Unit,
) {
    private val preferences = activity.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val playStoreInstalled: Boolean by lazy {
        @Suppress("DEPRECATION")
        runCatching { activity.packageManager.getPackageInfo(PLAY_STORE_PACKAGE, 0) }.isSuccess
    }
    private var noAdsUnlocked = preferences.getBoolean(NO_ADS_UNLOCKED_KEY, false)
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

    val isNoAdsUnlocked: Boolean
        get() = noAdsUnlocked

    fun start() {
        onNoAdsChanged(noAdsUnlocked)
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
        if (visible && BuildConfig.MONETIZATION_ENABLED) requestConsentUpdate()
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
        if (browsingServer && BuildConfig.MONETIZATION_ENABLED) requestConsentUpdate()
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

    fun purchaseNoAds() {
        if (released) return
        if (!BuildConfig.BILLING_ENABLED) {
            onMessage(R.string.no_ads_product_unavailable)
            return
        }
        if (noAdsUnlocked) return
        val client = billingClient
        if (client?.isReady != true) {
            connectBilling()
            onMessage(R.string.no_ads_purchase_unavailable)
            return
        }

        queryProductDetails { details ->
            val offer = details?.oneTimePurchaseOfferDetailsList?.firstOrNull()
            val offerToken = offer?.offerToken?.takeIf(String::isNotBlank)
            if (details == null || offerToken == null) {
                onMessage(R.string.no_ads_product_unavailable)
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
                onMessage(R.string.no_ads_purchase_error)
            }
        }
    }

    fun restoreNoAds() {
        if (released) return
        if (!BuildConfig.BILLING_ENABLED) {
            onMessage(R.string.no_ads_purchase_unavailable)
            return
        }
        if (billingClient?.isReady != true) {
            connectBilling()
            onMessage(R.string.no_ads_purchase_unavailable)
            return
        }
        queryOwnedPurchases(manualRestore = true)
    }

    fun showPrivacyOptions() {
        val information = consentInformation
        if (!BuildConfig.MONETIZATION_ENABLED || information == null ||
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
            .setProductId(MonetizationPolicy.NO_ADS_PRODUCT_ID)
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

            val wasUnlocked = noAdsUnlocked
            applyPurchaseState(purchases)
            if (manualRestore) {
                onMessage(
                    if (noAdsUnlocked) R.string.no_ads_purchase_restored
                    else R.string.no_ads_purchase_not_found,
                )
            } else if (!wasUnlocked && noAdsUnlocked) {
                onMessage(R.string.no_ads_purchase_success)
            }
        }
    }

    private fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        if (released) return
        when {
            result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null -> {
                val wasUnlocked = noAdsUnlocked
                applyPurchaseState(purchases)
                if (!wasUnlocked && noAdsUnlocked) {
                    onMessage(R.string.no_ads_purchase_success)
                } else if (purchases.any { purchase ->
                        MonetizationPolicy.NO_ADS_PRODUCT_ID in purchase.products &&
                            purchase.purchaseState == Purchase.PurchaseState.PENDING
                    }
                ) {
                    onMessage(R.string.no_ads_purchase_pending)
                }
            }

            result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> onMessage(R.string.no_ads_purchase_error)
        }
    }

    private fun applyPurchaseState(purchases: List<Purchase>) {
        val records = purchases.map { it.toStorePurchase() }
        purchases.filter { purchase ->
            MonetizationPolicy.shouldAcknowledge(purchase.toStorePurchase())
        }.forEach(::acknowledgePurchase)
        setNoAdsUnlocked(MonetizationPolicy.ownsNoAds(records))
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

    private fun setNoAdsUnlocked(unlocked: Boolean) {
        if (noAdsUnlocked != unlocked) {
            noAdsUnlocked = unlocked
            preferences.edit().putBoolean(NO_ADS_UNLOCKED_KEY, unlocked).apply()
            onNoAdsChanged(unlocked)
        }
        updateBanner()
    }

    private fun requestConsentUpdate() {
        if (!BuildConfig.MONETIZATION_ENABLED || released || consentRequestInProgress) return
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
        if (!BuildConfig.MONETIZATION_ENABLED || !information.canRequestAds() || mobileAdsInitializing || mobileAdsInitialized) {
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
        val required = BuildConfig.MONETIZATION_ENABLED &&
            consentInformation?.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        onPrivacyOptionsChanged(required)
    }

    private fun updateBanner() {
        if (released) return
        val allowedByApp = MonetizationPolicy.shouldShowBanner(
            adsEnabled = BuildConfig.MONETIZATION_ENABLED,
            browsingServer = browsingServer,
            noAdsUnlocked = noAdsUnlocked,
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
                !BuildConfig.MONETIZATION_ENABLED ||
                consentInformation?.canRequestAds() != true ||
                adView != null ||
                adContainer.width <= 0 ||
                !browsingServer ||
                noAdsUnlocked ||
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
                        if (adView === this@apply && browsingServer && !noAdsUnlocked) {
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
        const val NO_ADS_UNLOCKED_KEY = "no_ads_lifetime_unlocked"
    }
}
