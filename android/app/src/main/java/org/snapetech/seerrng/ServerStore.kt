package org.snapetech.seerrng

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class ServerStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun all(): List<SavedServer> {
        val json = preferences.getString(SERVERS_KEY, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(json)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val id = item.optString("id").takeIf(String::isNotBlank) ?: continue
                    val name = item.optString("name").takeIf(String::isNotBlank) ?: continue
                    val url = item.optString("url").takeIf(String::isNotBlank) ?: continue
                    add(
                        SavedServer(
                            id = id,
                            name = name,
                            url = url,
                            httpWarningAccepted = item.optBoolean("httpWarningAccepted"),
                        ),
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    fun save(server: SavedServer) {
        val servers = all()
        val existingIndex = servers.indexOfFirst { it.id == server.id }
        val updatedServers = if (existingIndex < 0) {
            servers + server
        } else {
            servers.toMutableList().apply { set(existingIndex, server) }
        }
        persist(updatedServers)
    }

    private fun persist(servers: List<SavedServer>) {
        val array = JSONArray()
        servers.forEach { saved ->
            array.put(
                JSONObject()
                    .put("id", saved.id)
                    .put("name", saved.name)
                    .put("url", saved.url)
                    .put("httpWarningAccepted", saved.httpWarningAccepted),
            )
        }
        preferences.edit().putString(SERVERS_KEY, array.toString()).apply()
    }

    fun remove(id: String): SavedServer? {
        val servers = all()
        val removed = servers.firstOrNull { it.id == id } ?: return null
        persist(servers.filterNot { it.id == id })
        return removed
    }

    fun get(id: String): SavedServer? = all().firstOrNull { it.id == id }

    fun updateHttpWarningAccepted(id: String) {
        val server = get(id) ?: return
        save(server.copy(httpWarningAccepted = true))
    }

    private companion object {
        const val PREFERENCES = "saved_servers"
        const val SERVERS_KEY = "servers"
    }
}
