plugins {
    id("com.android.application")
}

val releaseStorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
val releaseStorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD")
val admobAppId = providers.gradleProperty("admobAppId")
    .orElse(providers.environmentVariable("ADMOB_APP_ID"))
    .getOrElse("")
val admobBannerAdUnitId = providers.gradleProperty("admobBannerAdUnitId")
    .orElse(providers.environmentVariable("ADMOB_BANNER_AD_UNIT_ID"))
    .getOrElse("")
val playBillingEnabled = providers.gradleProperty("enablePlayBilling")
    .orElse(providers.environmentVariable("ENABLE_PLAY_BILLING"))
    .getOrElse("false")
    .toBoolean()
val androidMonetizationMode = providers.gradleProperty("androidMonetizationMode")
    .orElse(providers.environmentVariable("ANDROID_MONETIZATION_MODE"))
    .getOrElse("ads")
    .lowercase()
val freeSessionLimit = providers.gradleProperty("freeSessionLimit")
    .orElse(providers.environmentVariable("FREE_SESSION_LIMIT"))
    .getOrElse("20")
    .toInt()
val googleTestAdmobAppId = "ca-app-pub-3940256099942544~3347511713"
val googleTestBannerAdUnitId = "ca-app-pub-3940256099942544/9214589741"

if (androidMonetizationMode !in setOf("ads", "capped")) {
    throw GradleException("ANDROID_MONETIZATION_MODE must be 'ads' or 'capped'.")
}
if (freeSessionLimit < 1) {
    throw GradleException("FREE_SESSION_LIMIT must be greater than zero.")
}

fun asBuildConfigString(value: String) =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "org.snapetech.seerrng"
    compileSdk = 36

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "org.snapetech.seerrng"
        minSdk = 24
        targetSdk = 36
        versionCode = providers.gradleProperty("androidVersionCode").getOrElse("1").toInt()
        versionName = providers.gradleProperty("androidVersionName").getOrElse("0.0.0-dev")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["admobAppId"] = googleTestAdmobAppId
        buildConfigField("String", "MONETIZATION_MODE", asBuildConfigString(androidMonetizationMode))
        buildConfigField("Int", "FREE_SESSION_LIMIT", freeSessionLimit.toString())
    }

    signingConfigs {
        create("release") {
            storeFile = releaseStorePath.orNull?.let(::file)
            storeType = "PKCS12"
            storePassword = releaseStorePassword.orNull
            keyAlias = releaseKeyAlias.orNull
            keyPassword = releaseKeyPassword.orNull
        }
    }

    buildTypes {
        debug {
            manifestPlaceholders["admobAppId"] = googleTestAdmobAppId
            buildConfigField("Boolean", "BILLING_ENABLED", "true")
            buildConfigField("Boolean", "ADS_ENABLED", (androidMonetizationMode == "ads").toString())
            buildConfigField("String", "ADMOB_BANNER_AD_UNIT_ID", asBuildConfigString(googleTestBannerAdUnitId))
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            manifestPlaceholders["admobAppId"] = admobAppId.ifBlank { googleTestAdmobAppId }
            buildConfigField("Boolean", "BILLING_ENABLED", playBillingEnabled.toString())
            buildConfigField(
                "Boolean",
                "ADS_ENABLED",
                (androidMonetizationMode == "ads" && admobAppId.isNotBlank() && admobBannerAdUnitId.isNotBlank()).toString(),
            )
            buildConfigField("String", "ADMOB_BANNER_AD_UNIT_ID", asBuildConfigString(admobBannerAdUnitId))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("com.android.billingclient:billing:9.1.0")
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:rules:1.7.0")
    androidTestImplementation("androidx.test:core:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}
