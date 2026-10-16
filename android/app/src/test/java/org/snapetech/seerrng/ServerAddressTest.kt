package org.snapetech.seerrng

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerAddressTest {
    @Test
    fun addsHttpsWhenSchemeIsOmittedAndKeepsReverseProxyPath() {
        val result = ServerAddress.parse("  requests.example.com:5055/seerrng/  ")

        assertEquals(
            ServerAddressResult.Valid(
                ParsedServerAddress(
                    url = "https://requests.example.com:5055/seerrng",
                    host = "requests.example.com",
                    port = 5055,
                    isHttps = true,
                ),
            ),
            result,
        )
    }

    @Test
    fun normalizesSchemeHostAndDefaultPorts() {
        val secure = ServerAddress.parse("HTTPS://EXAMPLE.COM:443/")
        val local = ServerAddress.parse("http://192.168.1.20:80")

        assertEquals("https://example.com", (secure as ServerAddressResult.Valid).address.url)
        assertEquals("http://192.168.1.20", (local as ServerAddressResult.Valid).address.url)
        assertFalse(local.address.isHttps)
    }

    @Test
    fun acceptsIpv6AndIdnHosts() {
        val ipv6 = ServerAddress.parse("http://[2001:db8::1]:5055")
        val idn = ServerAddress.parse("bücher.example")

        assertEquals("http://[2001:db8::1]:5055", (ipv6 as ServerAddressResult.Valid).address.url)
        assertEquals("2001:db8::1", ipv6.address.host)
        assertEquals("https://xn--bcher-kva.example", (idn as ServerAddressResult.Valid).address.url)
    }

    @Test
    fun rejectsUnsupportedSchemesAndUrlInjectionComponents() {
        listOf(
            "",
            "javascript:alert(1)",
            "ftp://example.com",
            "https://user:password@example.com",
            "https://example.com/path?token=secret",
            "https://example.com/#fragment",
            "https://example.com:65536",
            "https://example.com:0",
            "https:///missing-host",
        ).forEach { input ->
            assertTrue("Expected rejection for $input", ServerAddress.parse(input) is ServerAddressResult.Invalid)
        }
    }
}
