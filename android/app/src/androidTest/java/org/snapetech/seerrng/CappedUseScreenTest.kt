package org.snapetech.seerrng

import android.content.Context
import android.os.SystemClock
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
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
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.webkit.WebViewFeature
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.ServerSocket
import java.net.SocketException
import java.util.concurrent.atomic.AtomicInteger
import org.hamcrest.CoreMatchers.containsString
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CappedUseScreenTest {
    private lateinit var scenario: ActivityScenario<MainActivity>
    private lateinit var localServer: ServerSocket
    private lateinit var serverThread: Thread
    private val rootRequests = AtomicInteger()

    @Before
    fun startActivity() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("saved_servers", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("seerrng_monetization", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("seerrng_trial_usage", Context.MODE_PRIVATE).edit().clear().commit()
        localServer = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        serverThread = Thread {
            while (!localServer.isClosed) {
                try {
                    localServer.accept().use { socket -> respondToRequest(socket) }
                } catch (_: SocketException) {
                    break
                } catch (_: IOException) {
                    continue
                }
            }
        }.apply {
            isDaemon = true
            start()
        }
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun closeActivity() {
        scenario.close()
        localServer.close()
        serverThread.join(1_000)
    }

    @Test
    fun countsOneSessionPerLaunchAndBlocksFurtherConnectionsWhenEmpty() {
        if (BuildConfig.MONETIZATION_MODE != "capped") return

        onView(withId(R.id.serverNameInput)).perform(replaceText("Local test"), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(
            replaceText("http://127.0.0.1:${localServer.localPort}"),
            closeSoftKeyboard(),
        )
        onView(withId(R.id.saveServerButton)).perform(click())
        onView(withId(R.id.addServerButton)).perform(click())
        onView(withId(R.id.serverNameInput)).perform(replaceText("Second local test"), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(
            replaceText("http://127.0.0.1:${localServer.localPort}"),
            closeSoftKeyboard(),
        )
        onView(withId(R.id.saveServerButton)).perform(click())
        onView(withId(R.id.trialUsageStatus)).check(
            matches(withText(containsString("${BuildConfig.FREE_SESSION_LIMIT} free server session"))),
        )

        repeat(BuildConfig.FREE_SESSION_LIMIT) { sessionIndex ->
            onView(withId(R.id.rowConnect)).perform(click())
            if (sessionIndex == 0) onView(withText("Connect over HTTP")).perform(click())
            onView(withId(R.id.browserScreen)).check(matches(isDisplayed()))
            waitForUsedSessions(sessionIndex + 1)
            onView(withId(R.id.backToServersButton)).perform(click())
            if (sessionIndex == 0) {
                rootRequests.set(0)
                connectServerAt(1)
                onView(withText("Connect over HTTP")).perform(click())
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                    onView(withText("Connect anyway")).perform(click())
                }
                waitForRootRequests(1)
                SystemClock.sleep(300)
                assertEquals(1, currentUsedSessions())
                onView(withId(R.id.backToServersButton)).perform(click())
            }
            if (sessionIndex < BuildConfig.FREE_SESSION_LIMIT - 1) {
                scenario.close()
                scenario = ActivityScenario.launch(MainActivity::class.java)
            }
        }

        onView(withId(R.id.trialUsageStatus)).check(matches(withText(containsString("current app session"))))
        scenario.close()
        scenario = ActivityScenario.launch(MainActivity::class.java)
        onView(withId(R.id.trialUsageStatus)).check(matches(withText(containsString("free sessions are used"))))
        onView(withId(R.id.rowConnect)).perform(click())
        onView(withId(R.id.serverPicker)).check(matches(isDisplayed()))
        onView(withId(R.id.browserScreen)).check(matches(withEffectiveVisibility(Visibility.GONE)))
        onView(withText("Later")).perform(click())
    }

    @Test
    fun failedServerLoadDoesNotConsumeASession() {
        if (BuildConfig.MONETIZATION_MODE != "capped") return

        val closedPort = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { it.localPort }
        onView(withId(R.id.serverNameInput)).perform(replaceText("Offline test"), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(
            replaceText("http://127.0.0.1:$closedPort"),
            closeSoftKeyboard(),
        )
        onView(withId(R.id.saveServerButton)).perform(click())
        onView(withId(R.id.rowConnect)).perform(click())
        onView(withText("Connect over HTTP")).perform(click())
        waitForVisibility(R.id.webErrorPanel, View.VISIBLE)
        assertEquals(0, currentUsedSessions())
    }

    private fun waitForUsedSessions(expected: Int) {
        val deadline = SystemClock.uptimeMillis() + 5_000
        while (currentUsedSessions() < expected && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(50)
        }
        assertEquals(expected, currentUsedSessions())
    }

    private fun currentUsedSessions(): Int {
        val context = ApplicationProvider.getApplicationContext<Context>()
        return context.getSharedPreferences("seerrng_trial_usage", Context.MODE_PRIVATE)
            .getInt("used_sessions", 0)
    }

    private fun waitForRootRequests(expected: Int) {
        val deadline = SystemClock.uptimeMillis() + 5_000
        while (rootRequests.get() < expected && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(50)
        }
        assertEquals(expected, rootRequests.get())
    }

    private fun waitForVisibility(viewId: Int, expectedVisibility: Int) {
        val deadline = SystemClock.uptimeMillis() + 5_000
        var visibility = View.GONE
        while (visibility != expectedVisibility && SystemClock.uptimeMillis() < deadline) {
            scenario.onActivity { activity -> visibility = activity.findViewById<View>(viewId).visibility }
            if (visibility != expectedVisibility) SystemClock.sleep(50)
        }
        assertEquals(expectedVisibility, visibility)
    }

    private fun connectServerAt(index: Int) {
        scenario.onActivity { activity ->
            val rows = activity.findViewById<LinearLayout>(R.id.serverRows)
            rows.getChildAt(index).findViewById<Button>(R.id.rowConnect).performClick()
        }
    }

    private fun respondToRequest(socket: java.net.Socket) {
        val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
        val requestLine = reader.readLine().orEmpty()
        while (reader.readLine()?.isNotEmpty() == true) Unit
        val body = "<html><body>SeerrNG test server</body></html>"
        val bodyBytes = body.toByteArray(Charsets.UTF_8)
        val header = "HTTP/1.1 200 OK\r\n" +
            "Content-Type: text/html; charset=utf-8\r\n" +
            "Content-Length: ${bodyBytes.size}\r\n" +
            "Connection: close\r\n\r\n"
        socket.getOutputStream().apply {
            write(header.toByteArray(Charsets.UTF_8))
            write(bodyBytes)
            flush()
        }
        if (requestLine.startsWith("GET / ")) rootRequests.incrementAndGet()
    }
}
