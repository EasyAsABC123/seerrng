package org.snapetech.seerrng

import android.content.Context
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
import org.hamcrest.CoreMatchers.containsString
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MonetizationScreenTest {
    private lateinit var scenario: ActivityScenario<MainActivity>

    @Before
    fun startActivity() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("saved_servers", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("seerrng_monetization", Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("seerrng_trial_usage", Context.MODE_PRIVATE).edit().clear().commit()
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun closeActivity() {
        scenario.close()
    }

    @Test
    fun serverListShowsLifetimeUnlockAndRestoreAndHandlesMissingPlayStore() {
        onView(withId(R.id.serverUrlInput)).check(matches(isDisplayed()))
        onView(withId(R.id.lifetimeUnlockButton)).check(matches(withEffectiveVisibility(Visibility.GONE)))

        onView(withId(R.id.serverNameInput)).perform(replaceText("Home"), closeSoftKeyboard())
        onView(withId(R.id.serverUrlInput)).perform(replaceText("home.example"), closeSoftKeyboard())
        onView(withId(R.id.saveServerButton)).perform(click())

        onView(withId(R.id.lifetimeUnlockButton)).check(matches(isDisplayed()))
        onView(withId(R.id.lifetimeUnlockButton)).check(
            matches(
                withText(
                    containsString(
                        "Unlock Lifetime Access",
                    ),
                ),
            ),
        )
        onView(withId(R.id.trialUsageStatus)).check(matches(withText(containsString("free server sessions"))))
        onView(withId(R.id.restorePurchasesButton)).check(matches(isDisplayed()))

        onView(withId(R.id.restorePurchasesButton)).perform(click())
        onView(withId(R.id.restorePurchasesButton)).check(matches(isDisplayed()))
    }
}
