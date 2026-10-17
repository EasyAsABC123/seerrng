plugins {
    id("com.android.application")
}

val releaseStorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
val releaseStorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD")
val playBillingEnabled = providers.gradleProperty("enablePlayBilling")
    .orElse(providers.environmentVariable("ENABLE_PLAY_BILLING"))
    .getOrElse("false")
    .toBoolean()
val freeSessionLimit = providers.gradleProperty("freeSessionLimit")
    .orElse(providers.environmentVariable("FREE_SESSION_LIMIT"))
    .getOrElse("20")
    .toInt()
if (freeSessionLimit < 1) {
    throw GradleException("FREE_SESSION_LIMIT must be greater than zero.")
}

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
        buildConfigField("int", "FREE_SESSION_LIMIT", freeSessionLimit.toString())
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
            buildConfigField("Boolean", "BILLING_ENABLED", "true")
        }
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            buildConfigField("Boolean", "BILLING_ENABLED", playBillingEnabled.toString())
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

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:rules:1.7.0")
    androidTestImplementation("androidx.test:core:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}
