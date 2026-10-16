package org.snapetech.seerrng

import java.util.UUID

data class SavedServer(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val url: String,
    val httpWarningAccepted: Boolean = false,
) {
    val profileName: String
        get() = "seerrng-${id.replace("-", "")}"
}
