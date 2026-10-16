package org.snapetech.seerrng

import android.content.Context
import android.os.SystemClock
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdView
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.closeSoftKeyboard
import androidx.test.espresso.action.ViewActions.replaceText
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.Visibility
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withEffectiveVisibility
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.espresso.matcher.RootMatchers.isDialog
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.hamcrest.CoreMatchers.containsString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.net.InetAddress
import java.net.ServerSocket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class MonetizationScreenTest {
    private lateinit var scenario: ActivityScenario<MainActivity>

    @Before
    fun startActivity() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("saved_servers", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("seerrng_monetization", Context.MODE_PRIVATE).edit().clear().commit()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun closeActivity() {
        scenario.close()
    }

    @Test
    fun serverListShowsLifetimeUnlockAndRestoreWithoutCoveringSetupScreens() {
        onView(withId(R.id.serverUrlInput)).check(matches(isDisplayed()))
        onView(withId(R.id.removeAdsButton)).check(matches(withEffectiveVisibility(Visibility.GONE)))

        onView(withId(R.id.serverNameInput)).perform(replaceText("Home"), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(replaceText("home.example"), closeSoftKeyboard())
        onView(withId(R.id.saveServerButton)).perform(click())

        onView(withId(R.id.removeAdsButton)).check(matches(isDisplayed()))
        onView(withId(R.id.removeAdsButton)).check(matches(withText(containsString("Remove Ads"))))
        onView(withId(R.id.restorePurchasesButton)).check(matches(isDisplayed()))
        onView(withId(R.id.adViewContainer)).check(matches(withEffectiveVisibility(Visibility.GONE)))
    }

    @Test
    fun browsingLoadsTheGoogleTestBannerBelowTheServerPage() {
        LocalHttpServer().use { server ->
            onView(withId(R.id.serverNameInput)).perform(replaceText("Local"), closeSoftKeyboard())
            onView(withId(R.id.serverUrlInput))
                .perform(replaceText("http://127.0.0.1:${server.port}"), closeSoftKeyboard())
            onView(withId(R.id.saveServerButton)).perform(click())
            onView(withId(R.id.rowConnect)).perform(click())
            onView(withText(R.string.use_http)).inRoot(isDialog()).perform(click())

            val bannerLoaded = CountDownLatch(1)
            scenario.onActivity { activity ->
                val container = activity.findViewById<FrameLayout>(R.id.adViewContainer)
                val deadline = SystemClock.uptimeMillis() + TimeUnit.SECONDS.toMillis(25)
                fun waitForBanner() {
                    if (container.visibility == View.VISIBLE && container.getChildAt(0) is AdView) {
                        bannerLoaded.countDown()
                    } else if (SystemClock.uptimeMillis() < deadline) {
                        container.postDelayed(::waitForBanner, 100)
                    } else {
                        bannerLoaded.countDown()
                    }
                }
                container.post(::waitForBanner)
            }

            assertTrue("The Google test banner did not load", bannerLoaded.await(30, TimeUnit.SECONDS))
            scenario.onActivity { activity ->
                val container = activity.findViewById<FrameLayout>(R.id.adViewContainer)
                assertEquals(View.VISIBLE, container.visibility)
                assertTrue(container.getChildAt(0) is AdView)
                assertEquals("ca-app-pub-3940256099942544/9214589741", (container.getChildAt(0) as AdView).adUnitId)
            }
        }
    }

    private class LocalHttpServer : AutoCloseable {
        private val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        val port: Int = server.localPort

        init {
            Thread {
                try {
                    server.accept().use { socket ->
                        socket.soTimeout = 5_000
                        val reader = socket.getInputStream().bufferedReader(Charsets.US_ASCII)
                        reader.readLine()
                        while (reader.readLine()?.isNotEmpty() == true) Unit
                        val body = "<!doctype html><html><body>SeerrNG Android monetization test</body></html>"
                        val response = listOf(
                            "HTTP/1.1 200 OK",
                            "Content-Type: text/html; charset=utf-8",
                            "Content-Length: ${body.toByteArray(Charsets.UTF_8).size}",
                            "Connection: close",
                            "",
                            body,
                        ).joinToString("\r\n") + "\r\n"
                        socket.getOutputStream().write(response.toByteArray(Charsets.UTF_8))
                        socket.getOutputStream().flush()
                    }
                } catch (_: Exception) { }
            }.apply {
                name = "seerrng-android-monetization-http"
                isDaemon = true
                start()
            }
        }

        override fun close() {
            server.close()
        }
    }
}
