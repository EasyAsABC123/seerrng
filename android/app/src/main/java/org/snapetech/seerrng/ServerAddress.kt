package org.snapetech.seerrng

import java.net.IDN
import java.net.URI

data class ParsedServerAddress(
    val url: String,
    val host: String,
    val port: Int?,
    val isHttps: Boolean,
)

sealed interface ServerAddressResult {
    data class Valid(val address: ParsedServerAddress) : ServerAddressResult
    data object Invalid : ServerAddressResult
}

object ServerAddress {
    fun parse(input: String): ServerAddressResult {
        val trimmed = input.trim()
        if (trimmed.isEmpty() || trimmed.any(Char::isWhitespace)) {
            return ServerAddressResult.Invalid
        }

        val candidate = if (trimmed.contains("://")) trimmed else "https://$trimmed"
        val uri = try {
            URI(candidate).normalize()
        } catch (_: Exception) {
            return ServerAddressResult.Invalid
        }

        val scheme = uri.scheme?.lowercase() ?: return ServerAddressResult.Invalid
        if (scheme != "http" && scheme != "https") return ServerAddressResult.Invalid
        if (uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null) {
            return ServerAddressResult.Invalid
        }

        val rawAuthority = uri.rawAuthority ?: return ServerAddressResult.Invalid
        if ('@' in rawAuthority) return ServerAddressResult.Invalid

        val authorityParts = splitAuthority(rawAuthority) ?: return ServerAddressResult.Invalid
        val rawHost = uri.host ?: authorityParts.first
        val host = if (rawHost.contains(':')) {
            rawHost.removePrefix("[").removeSuffix("]").lowercase()
        } else {
            try {
                IDN.toASCII(rawHost).lowercase()
            } catch (_: Exception) {
                return ServerAddressResult.Invalid
            }
        }

        val uriPort = if (uri.port != -1) uri.port else (authorityParts.second ?: -1)
        if (uriPort == 0 || uriPort > 65535) return ServerAddressResult.Invalid
        val port = when {
            uriPort == -1 -> null
            scheme == "https" && uriPort == 443 -> null
            scheme == "http" && uriPort == 80 -> null
            else -> uriPort
        }

        val path = uri.rawPath.orEmpty().trimEnd('/')
        val authority = buildString {
            if (':' in host) append("[$host]") else append(host)
            if (port != null) append(":$port")
        }

        return ServerAddressResult.Valid(
            ParsedServerAddress(
                url = "$scheme://$authority$path",
                host = host,
                port = port,
                isHttps = scheme == "https",
            ),
        )
    }

    private fun splitAuthority(authority: String): Pair<String, Int?>? {
        if (authority.startsWith("[")) {
            val end = authority.indexOf(']')
            if (end <= 1) return null
            val host = authority.substring(0, end + 1)
            val suffix = authority.substring(end + 1)
            if (suffix.isEmpty()) return host to null
            if (!suffix.startsWith(":") || suffix.length == 1) return null
            val port = suffix.substring(1).toIntOrNull() ?: return null
            return host to port
        }

        val colon = authority.lastIndexOf(':')
        if (colon == -1) return authority.takeIf(String::isNotBlank)?.let { it to null }
        if (authority.indexOf(':') != colon) return null
        val host = authority.substring(0, colon)
        val portText = authority.substring(colon + 1)
        if (host.isBlank() || portText.isEmpty() || portText.any { !it.isDigit() }) return null
        return host to (portText.toIntOrNull() ?: return null)
    }
}
