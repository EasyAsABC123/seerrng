package org.snapetech.seerrng

import android.content.Context
import android.net.Uri
import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.closeSoftKeyboard
import androidx.test.espresso.action.ViewActions.replaceText
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.RootMatchers.isDialog
import androidx.test.espresso.matcher.ViewMatchers.isDescendantOfA
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.hamcrest.CoreMatchers.allOf
import org.hamcrest.CoreMatchers.containsString
import org.hamcrest.Matcher
import androidx.test.espresso.matcher.ViewMatchers.hasDescendant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ServerManagementTest {
    private lateinit var scenario: ActivityScenario<MainActivity>

    @Before
    fun startActivity() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("saved_servers", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun closeActivity() {
        scenario.close()
    }

    @Test
    fun launchShowsServerChooserAndSupportsMultipleManualAddresses() {
        onView(withId(R.id.serverUrlInput)).check(matches(isDisplayed()))
        addServer("Home", "requests.home:5055")
        addServer("Remote", "https://requests.example.com/seerrng/")

        onView(rowText(R.id.rowServerName, "Home")).check(matches(isDisplayed()))
        onView(rowText(R.id.rowServerUrl, "Home")).check(matches(withText("https://requests.home:5055")))
        onView(rowText(R.id.rowServerName, "Remote")).check(matches(isDisplayed()))
        onView(rowText(R.id.rowServerUrl, "Remote")).check(matches(withText("https://requests.example.com/seerrng")))
    }

    @Test
    fun laterLaunchesShowTheSavedServerList() {
        addServer("Home", "home.example")
        scenario.close()
        scenario = ActivityScenario.launch(MainActivity::class.java)

        onView(withId(R.id.pickerTitle)).check(matches(isDisplayed()))
        onView(rowText(R.id.rowServerName, "Home")).check(matches(isDisplayed()))
    }

    @Test
    fun editingASavedServerUpdatesItsNameAndAddress() {
        addServer("Home", "home.example")
        onView(
            allOf(
                withId(R.id.rowEdit),
                isDescendantOfA(allOf(withId(R.id.serverRow), hasDescendant(withText("Home")))),
            ),
        ).perform(click())
        onView(withId(R.id.serverNameInput)).perform(replaceText("Office"))
        onView(withId(R.id.serverUrlInput)).perform(replaceText("office.example"), closeSoftKeyboard())
        onView(withId(R.id.saveServerButton)).perform(click())

        val saved = ServerStore(ApplicationProvider.getApplicationContext()).all().single()
        assertEquals("Office", saved.name)
        assertEquals("https://office.example", saved.url)
        onView(rowText(R.id.rowServerName, "Office")).check(matches(isDisplayed()))
    }

    @Test
    fun downloadTargetsStayOnTheSelectedServerAndReverseProxyPath() {
        val address = ParsedServerAddress(
            url = "https://home.example/seerrng",
            host = "home.example",
            port = null,
            isHttps = true,
        )

        scenario.onActivity { activity ->
            assertTrue(
                activity.isSameServerDownload(
                    Uri.parse("https://home.example/seerrng/api/download/42"),
                    address,
                ),
            )
            assertFalse(
                activity.isSameServerDownload(
                    Uri.parse("https://home.example/other/download/42"),
                    address,
                ),
            )
            assertFalse(
                activity.isSameServerDownload(
                    Uri.parse("https://elsewhere.example/seerrng/api/download/42"),
                    address,
                ),
            )
            assertFalse(
                activity.isSameServerDownload(
                    Uri.parse("http://home.example/seerrng/api/download/42"),
                    address,
                ),
            )

            val ipv6Address = address.copy(
                url = "http://[2001:db8::1]:5055/seerrng",
                host = "2001:db8::1",
                port = 5055,
                isHttps = false,
            )
            assertTrue(
                activity.isSameServerDownload(
                    Uri.parse("http://[2001:db8::1]:5055/seerrng/api/download/42"),
                    ipv6Address,
                ),
            )
        }
    }

    @Test
    fun invalidServerAddressIsRejectedBeforeItIsSaved() {
        openAddServerForm()
        onView(withId(R.id.serverUrlInput)).perform(replaceText("javascript:alert(1)"), closeSoftKeyboard())
        onView(withId(R.id.saveServerButton)).perform(click())

        onView(withId(R.id.editorError)).check(matches(isDisplayed()))
        onView(withText(containsString("valid HTTP or HTTPS"))).check(matches(isDisplayed()))
    }

    @Test
    fun httpServerRequiresAnExplicitWarningAcknowledgement() {
        addServer("Home", "http://192.168.1.50:5055")
        onView(
            allOf(
                withId(R.id.rowConnect),
                isDescendantOfA(allOf(withId(R.id.serverRow), androidx.test.espresso.matcher.ViewMatchers.hasDescendant(withText("Home")))),
            ),
        ).perform(click())

        onView(withText(R.string.http_warning_title)).inRoot(isDialog()).check(matches(isDisplayed()))
        onView(withText(R.string.http_warning_message)).inRoot(isDialog()).check(matches(isDisplayed()))
        onView(withText(R.string.cancel)).inRoot(isDialog()).perform(click())
    }

    @Test
    fun removingOneServerLeavesTheOtherSaved() {
        addServer("Home", "home.example")
        addServer("Remote", "remote.example")
        onView(
            allOf(
                withId(R.id.rowRemove),
                isDescendantOfA(allOf(withId(R.id.serverRow), androidx.test.espresso.matcher.ViewMatchers.hasDescendant(withText("Home")))),
            ),
        ).perform(click())
        onView(withText(R.string.remove_server_title)).inRoot(isDialog()).check(matches(isDisplayed()))
        onView(withText(R.string.remove)).inRoot(isDialog()).perform(click())

        onView(rowText(R.id.rowServerName, "Remote")).check(matches(isDisplayed()))
        assertEquals(listOf("Remote"), ServerStore(ApplicationProvider.getApplicationContext()).all().map { it.name })
    }

    private fun addServer(name: String, url: String) {
        openAddServerForm()
        onView(withId(R.id.serverNameInput)).perform(replaceText(name), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(replaceText(url), closeSoftKeyboard())
        onView(withId(R.id.saveServerButton)).perform(click())
    }

    private fun openAddServerForm() {
        if (ServerStore(ApplicationProvider.getApplicationContext()).all().isNotEmpty()) {
            onView(withId(R.id.addServerButton)).perform(click())
        }
    }

    private fun rowText(viewId: Int, serverName: String): Matcher<View> =
        allOf(
            withId(viewId),
            isDescendantOfA(
                allOf(
                    withId(R.id.serverRow),
                    hasDescendant(allOf(withId(R.id.rowServerName), withText(serverName))),
                ),
            ),
        )
}
