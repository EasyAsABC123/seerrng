package org.snapetech.seerrng

import android.content.Context

/** Stores the capped preview count on this app installation only. */
internal class TrialUsageStore(context: Context, private val sessionLimit: Int) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    val usedSessions: Int
        get() = preferences.getInt(USED_SESSIONS_KEY, 0).coerceAtLeast(0)

    val remainingSessions: Int
        get() = (sessionLimit - usedSessions).coerceAtLeast(0)

    @Synchronized
    fun consumeSession(): Boolean {
        val used = usedSessions
        if (used >= sessionLimit) return false
        preferences.edit().putInt(USED_SESSIONS_KEY, used + 1).apply()
        return true
    }

    private companion object {
        const val PREFERENCES_NAME = "seerrng_trial_usage"
        const val USED_SESSIONS_KEY = "used_sessions"
    }
}
