package org.snapetech.seerrng

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.Dialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.URLUtil
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

private data class UriHostPort(val host: String, val port: Int?)

class MainActivity : Activity() {
    private lateinit var serverStore: ServerStore
    private lateinit var serverPicker: View
    private lateinit var serverEditor: View
    private lateinit var browserScreen: View
    private lateinit var serverRows: LinearLayout
    private lateinit var nameInput: EditText
    private lateinit var urlInput: EditText
    private lateinit var editorTitle: TextView
    private lateinit var editorError: TextView
    private lateinit var webContainer: FrameLayout
    private lateinit var pageProgress: ProgressBar
    private lateinit var errorPanel: View
    private lateinit var errorMessage: TextView
    private lateinit var activeServerName: TextView
    private lateinit var httpBadge: TextView
    private lateinit var lifetimeUnlockButton: Button
    private lateinit var restorePurchasesButton: Button
    private lateinit var lifetimeUnlockDescription: TextView
    private lateinit var lifetimeUnlockMessage: TextView
    private lateinit var trialUsageStatus: TextView
    private lateinit var adPrivacyOptionsButton: Button
    private lateinit var monetization: MonetizationManager
    private lateinit var trialUsageStore: TrialUsageStore
    private var trialSessionStartedThisLaunch = false
    private var activeMainFrameLoadFailed = false

    private var editingServerId: String? = null
    private var activeServer: SavedServer? = null
    private var activeAddress: ParsedServerAddress? = null
    private var webView: WebView? = null
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private var pendingDownload: PendingDownload? = null
    private var clearingDefaultWebViewData = false
    private val defaultWebViewDataClearCallbacks = mutableListOf<() -> Unit>()
    private val popupDialogs = mutableMapOf<WebView, Dialog>()
    private val supportsProfiles: Boolean by lazy {
        WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        serverStore = ServerStore(this)
        trialUsageStore = TrialUsageStore(this, BuildConfig.FREE_SESSION_LIMIT)
        trialSessionStartedThisLaunch = savedInstanceState?.getBoolean(TRIAL_SESSION_STARTED_KEY) ?: false

        serverPicker = findViewById(R.id.serverPicker)
        serverEditor = findViewById(R.id.serverEditor)
        browserScreen = findViewById(R.id.browserScreen)
        serverRows = findViewById(R.id.serverRows)
        nameInput = findViewById(R.id.serverNameInput)
        urlInput = findViewById(R.id.serverUrlInput)
        editorTitle = findViewById(R.id.editorTitle)
        editorError = findViewById(R.id.editorError)
        webContainer = findViewById(R.id.webViewContainer)
        pageProgress = findViewById(R.id.pageProgress)
        errorPanel = findViewById(R.id.webErrorPanel)
        errorMessage = findViewById(R.id.webErrorMessage)
        activeServerName = findViewById(R.id.activeServerName)
        httpBadge = findViewById(R.id.httpBadge)
        lifetimeUnlockButton = findViewById(R.id.lifetimeUnlockButton)
        restorePurchasesButton = findViewById(R.id.restorePurchasesButton)
        lifetimeUnlockDescription = findViewById(R.id.lifetimeUnlockDescription)
        lifetimeUnlockMessage = findViewById(R.id.lifetimeUnlockMessage)
        trialUsageStatus = findViewById(R.id.trialUsageStatus)
        adPrivacyOptionsButton = findViewById(R.id.adPrivacyOptionsButton)

        monetization = MonetizationManager(
            activity = this,
            adContainer = findViewById(R.id.adViewContainer),
            onLifetimeUnlockChanged = ::renderLifetimeUnlock,
            onPriceChanged = ::renderLifetimeUnlockPrice,
            onPrivacyOptionsChanged = { required ->
                adPrivacyOptionsButton.visibility = if (required) View.VISIBLE else View.GONE
            },
            onMessage = { message -> Toast.makeText(this, message, Toast.LENGTH_LONG).show() },
        )

        findViewById<Button>(R.id.addServerButton).setOnClickListener { showEditor(null) }
        findViewById<Button>(R.id.saveServerButton).setOnClickListener { saveEditedServer() }
        findViewById<Button>(R.id.cancelEditorButton).setOnClickListener { showServerPicker() }
        findViewById<Button>(R.id.backToServersButton).setOnClickListener { showServerPicker() }
        findViewById<Button>(R.id.errorServersButton).setOnClickListener { showServerPicker() }
        findViewById<Button>(R.id.reloadButton).setOnClickListener { reloadActivePage() }
        findViewById<Button>(R.id.retryButton).setOnClickListener { reloadActivePage() }
        lifetimeUnlockButton.setOnClickListener { monetization.purchaseLifetimeUnlock() }
        restorePurchasesButton.setOnClickListener { monetization.restoreLifetimeUnlock() }
        adPrivacyOptionsButton.setOnClickListener { monetization.showPrivacyOptions() }
        findViewById<TextView>(R.id.pickerPrivacyPolicyLink).setOnClickListener { openPrivacyPolicy() }
        findViewById<TextView>(R.id.editorPrivacyPolicyLink).setOnClickListener { openPrivacyPolicy() }

        renderServers()
        monetization.start()
        if (serverStore.all().isEmpty()) {
            showEditor(null)
        } else {
            showServerPicker()
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }

    private fun openPrivacyPolicy() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.privacy_policy_url))))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.privacy_policy_open_error, Toast.LENGTH_LONG).show()
        }
    }

    override fun onResume() {
        super.onResume()
        monetization.onResume()
        webView?.onResume()
    }

    override fun onPause() {
        webView?.onPause()
        monetization.onPause()
        flushActiveCookies()
        super.onPause()
    }

    override fun onDestroy() {
        if (::monetization.isInitialized) monetization.close()
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        monetization.onConfigurationChanged()
    }

    @Deprecated("Use system back navigation")
    override fun onBackPressed() {
        val currentWebView = webView
        if (browserScreen.visibility == View.VISIBLE && currentWebView?.canGoBack() == true) {
            currentWebView.goBack()
            return
        }
        if (browserScreen.visibility == View.VISIBLE) {
            showServerPicker()
            return
        }
        if (serverEditor.visibility == View.VISIBLE) {
            showServerPicker()
            return
        }
        super.onBackPressed()
    }

    private fun renderServers() {
        serverRows.removeAllViews()
        val servers = serverStore.all()
        findViewById<TextView>(R.id.emptyServersMessage).visibility =
            if (servers.isEmpty()) View.VISIBLE else View.GONE

        servers.forEach { server ->
            val row = layoutInflater.inflate(R.layout.item_server, serverRows, false)
            row.findViewById<TextView>(R.id.rowServerName).text = server.name
            row.findViewById<TextView>(R.id.rowServerUrl).text = server.url
            row.findViewById<Button>(R.id.rowConnect).setOnClickListener { connect(server) }
            row.findViewById<Button>(R.id.rowEdit).setOnClickListener { showEditor(server) }
            row.findViewById<Button>(R.id.rowRemove).setOnClickListener { confirmRemove(server) }
            serverRows.addView(row)
        }
    }

    private fun showServerPicker() {
        destroyActiveWebView()
        monetization.setBrowsingServer(false)
        activeServer = null
        activeAddress = null
        browserScreen.visibility = View.GONE
        serverEditor.visibility = View.GONE
        serverPicker.visibility = View.VISIBLE
        renderServers()
        renderTrialUsageStatus()
    }

    private fun showEditor(server: SavedServer?) {
        destroyActiveWebView()
        monetization.setBrowsingServer(false)
        activeServer = null
        activeAddress = null
        editingServerId = server?.id
        editorTitle.text = if (server == null) getString(R.string.add_server) else getString(R.string.edit_server)
        nameInput.setText(server?.name.orEmpty())
        urlInput.setText(server?.url.orEmpty())
        editorError.visibility = View.GONE
        serverPicker.visibility = View.GONE
        browserScreen.visibility = View.GONE
        serverEditor.visibility = View.VISIBLE
        urlInput.requestFocus()
    }

    private fun saveEditedServer() {
        val parsed = (ServerAddress.parse(urlInput.text.toString()) as? ServerAddressResult.Valid)?.address
        if (parsed == null) {
            editorError.text = getString(R.string.invalid_server_url)
            editorError.visibility = View.VISIBLE
            return
        }

        val previous = editingServerId?.let(serverStore::get)
        val name = nameInput.text.toString().trim().ifEmpty { parsed.host }
        val changedAddress = previous != null && previous.url != parsed.url
        val saved = if (previous != null) {
            previous.copy(
                name = name,
                url = parsed.url,
                httpWarningAccepted = previous.httpWarningAccepted && !changedAddress,
            )
        } else {
            SavedServer(name = name, url = parsed.url)
        }

        if (changedAddress) previous?.let(::deleteProfile)
        serverStore.save(saved)
        Toast.makeText(this, R.string.server_saved, Toast.LENGTH_SHORT).show()
        showServerPicker()
    }

    private fun confirmRemove(server: SavedServer) {
        AlertDialog.Builder(this)
            .setTitle(R.string.remove_server_title)
            .setMessage(getString(R.string.remove_server_message, server.name))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.remove) { _, _ ->
                if (activeServer?.id == server.id) showServerPicker()
                val removed = serverStore.remove(server.id)
                if (removed != null) deleteProfile(removed)
                renderServers()
                Toast.makeText(this, R.string.server_removed, Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    private fun connect(server: SavedServer) {
        val address = (ServerAddress.parse(server.url) as? ServerAddressResult.Valid)?.address
        if (address == null) {
            Toast.makeText(this, R.string.invalid_server_url, Toast.LENGTH_LONG).show()
            return
        }

        if (!address.isHttps && !server.httpWarningAccepted) {
            AlertDialog.Builder(this)
                .setTitle(R.string.http_warning_title)
                .setMessage(R.string.http_warning_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.use_http) { _, _ ->
                    serverStore.updateHttpWarningAccepted(server.id)
                    confirmSessionIsolationIfNeeded(server, address)
                }
                .show()
            return
        }

        confirmSessionIsolationIfNeeded(server, address)
    }

    private fun confirmSessionIsolationIfNeeded(server: SavedServer, address: ParsedServerAddress) {
        if (!supportsProfiles && serverStore.all().size > 1) {
            AlertDialog.Builder(this)
                .setTitle(R.string.session_isolation_title)
                .setMessage(R.string.session_isolation_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.connect_anyway) { _, _ -> startBrowser(server, address) }
                .show()
            return
        }

        startBrowser(server, address)
    }

    private fun startBrowser(server: SavedServer, address: ParsedServerAddress) {
        val cappedMode = BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE
        if (!CappedUsePolicy.canStartServerSession(
                cappedMode = cappedMode,
                lifetimeUnlocked = monetization.isLifetimeUnlocked,
                sessionAlreadyStartedThisLaunch = trialSessionStartedThisLaunch,
                usedSessions = trialUsageStore.usedSessions,
                sessionLimit = BuildConfig.FREE_SESSION_LIMIT,
            )
        ) {
            renderTrialUsageStatus()
            showTrialCompleteDialog()
            return
        }
        destroyActiveWebView()
        activeServer = server
        activeAddress = address
        serverPicker.visibility = View.GONE
        serverEditor.visibility = View.GONE
        browserScreen.visibility = View.VISIBLE
        monetization.setBrowsingServer(true)
        errorPanel.visibility = View.GONE
        activeServerName.text = server.name
        httpBadge.visibility = if (address.isHttps) View.GONE else View.VISIBLE

        if (!supportsProfiles) {
            val lastServerId = getPreferences(MODE_PRIVATE).getString(FALLBACK_SERVER_ID, null)
            getPreferences(MODE_PRIVATE).edit().putString(FALLBACK_SERVER_ID, server.id).apply()
            if (lastServerId != null && lastServerId != server.id) {
                clearDefaultWebViewData { loadServer(server, address) }
                return
            }
        }

        loadServer(server, address)
    }

    private fun loadServer(server: SavedServer, address: ParsedServerAddress) {
        if (activeServer?.id != server.id || browserScreen.visibility != View.VISIBLE) return
        activeMainFrameLoadFailed = false
        val view = createWebView(server.profileName, allowPopups = true)
        webView = view
        webContainer.addView(
            view,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        view.loadUrl(address.url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(profileName: String, allowPopups: Boolean): WebView {
        val view = WebView(this)
        if (supportsProfiles) WebViewCompat.setProfile(view, profileName)

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = allowPopups
            setSupportMultipleWindows(allowPopups)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) safeBrowsingEnabled = true
            mediaPlaybackRequiresUserGesture = true
        }
        val cookieManager = if (supportsProfiles) {
            WebViewCompat.getProfile(view).cookieManager
        } else {
            CookieManager.getInstance()
        }
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(view, false)
        view.webViewClient = createWebViewClient()
        view.webChromeClient = createWebChromeClient(allowPopups)
        view.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            requestDownload(view, cookieManager, url, userAgent, contentDisposition, mimeType)
        }
        return view
    }

    private fun requestDownload(
        view: WebView,
        cookies: CookieManager,
        url: String,
        userAgent: String,
        contentDisposition: String?,
        mimeType: String?,
    ) {
        val uri = runCatching { Uri.parse(url) }.getOrNull()
        val address = activeAddress
        if (uri == null || address == null || !isSameServerDownload(uri, address)) {
            Toast.makeText(this, R.string.download_external_server, Toast.LENGTH_LONG).show()
            return
        }

        val download = PendingDownload(
            url = url,
            userAgent = userAgent,
            contentDisposition = contentDisposition,
            mimeType = mimeType,
            cookies = cookies.getCookie(url),
            referer = view.url,
        )
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            if (pendingDownload != null) {
                Toast.makeText(this, R.string.download_already_waiting, Toast.LENGTH_LONG).show()
                return
            }
            pendingDownload = download
            requestPermissions(
                arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE),
                DOWNLOAD_PERMISSION_REQUEST,
            )
            return
        }

        enqueueDownload(download)
    }

    internal fun isSameServerDownload(uri: Uri, address: ParsedServerAddress): Boolean {
        val expectedScheme = if (address.isHttps) "https" else "http"
        if (uri.scheme?.lowercase() != expectedScheme) return false
        val endpoint = uriHostPort(uri) ?: return false
        if (!endpoint.host.equals(address.host, ignoreCase = true)) return false

        val expectedPort = address.port ?: if (address.isHttps) 443 else 80
        val actualPort = endpoint.port ?: if (address.isHttps) 443 else 80
        if (actualPort != expectedPort) return false

        val basePath = Uri.parse(address.url).encodedPath.orEmpty().trimEnd('/')
        val downloadPath = uri.encodedPath.orEmpty()
        return basePath.isEmpty() || downloadPath == basePath || downloadPath.startsWith("$basePath/")
    }

    private fun enqueueDownload(download: PendingDownload) {
        runCatching {
            val suggestedName = URLUtil.guessFileName(
                download.url,
                download.contentDisposition,
                download.mimeType,
            ).substringAfterLast('/').substringAfterLast('\\')
            val fileName = suggestedName.takeUnless { it.isBlank() || it == "." || it == ".." }
                ?: "seerrng-download"
            val request = DownloadManager.Request(Uri.parse(download.url))
                .setTitle(fileName)
                .setDescription(getString(R.string.app_name))
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverRoaming(false)
            download.mimeType?.takeIf(String::isNotBlank)?.let(request::setMimeType)
            download.userAgent.takeIf(String::isNotBlank)?.let { request.addRequestHeader("User-Agent", it) }
            download.cookies?.takeIf(String::isNotBlank)?.let { request.addRequestHeader("Cookie", it) }
            download.referer?.takeIf(String::isNotBlank)?.let { request.addRequestHeader("Referer", it) }
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            getSystemService(DownloadManager::class.java).enqueue(request)
        }.onSuccess {
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_LONG).show()
        }.onFailure {
            Toast.makeText(this, R.string.download_start_error, Toast.LENGTH_LONG).show()
        }
    }

    private fun reloadActivePage() {
        activeMainFrameLoadFailed = false
        errorPanel.visibility = View.GONE
        webView?.reload()
    }

    private fun createWebViewClient() = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            handleNavigation(request.url, request.hasGesture())

        @Deprecated("Deprecated in Java")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
            handleNavigation(Uri.parse(url), userGesture = false)

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            if (view == webView) {
                errorPanel.visibility = View.GONE
                pageProgress.visibility = View.VISIBLE
            }
        }

        override fun onPageFinished(view: WebView, url: String?) {
            if (view != webView) return
            pageProgress.visibility = View.GONE
            if (!activeMainFrameLoadFailed &&
                BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE &&
                !monetization.isLifetimeUnlocked &&
                !trialSessionStartedThisLaunch &&
                trialUsageStore.consumeSession()
            ) {
                trialSessionStartedThisLaunch = true
                renderTrialUsageStatus()
            }
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            super.onReceivedError(view, request, error)
            if (view == webView && request.isForMainFrame) {
                activeMainFrameLoadFailed = true
                showError(getString(R.string.connection_error))
            }
        }

        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            errorResponse: android.webkit.WebResourceResponse,
        ) {
            super.onReceivedHttpError(view, request, errorResponse)
            if (view == webView && request.isForMainFrame && errorResponse.statusCode >= 400) {
                activeMainFrameLoadFailed = true
                showError(getString(R.string.connection_error))
            }
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
            handler.cancel()
            if (view == webView) {
                activeMainFrameLoadFailed = true
                showError(getString(R.string.secure_connection_error))
            }
        }
    }

    private fun createWebChromeClient(allowPopups: Boolean) = object : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            if (view == webView) {
                pageProgress.progress = newProgress
                pageProgress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }
        }

        override fun onCreateWindow(
            view: WebView,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: android.os.Message,
        ): Boolean {
            if (!allowPopups || !isUserGesture) return false
            val server = activeServer ?: return false
            val parent = view
            val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
            val popup = createWebView(server.profileName, allowPopups = false)
            val dialog = createPopupDialog(popup)
            popupDialogs[popup] = dialog
            transport.webView = popup
            dialog.show()
            dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            resultMsg.sendToTarget()
            parent.requestFocus()
            return true
        }

        override fun onCloseWindow(window: WebView) {
            popupDialogs[window]?.dismiss()
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            pendingFileChooser?.onReceiveValue(null)
            pendingFileChooser = filePathCallback
            return try {
                startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST)
                true
            } catch (_: Exception) {
                pendingFileChooser = null
                filePathCallback.onReceiveValue(null)
                false
            }
        }

        override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
            request.deny()
        }
    }

    private fun createPopupDialog(popup: WebView): Dialog {
        val dialog = Dialog(this)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.WHITE)
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }
        val title = TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 16f
            setTextColor(getColor(R.color.ink))
            setPadding(dp(12), 0, 0, 0)
        }
        val close = Button(this).apply {
            text = getString(R.string.cancel)
            setOnClickListener { dialog.dismiss() }
        }
        toolbar.addView(title, LinearLayout.LayoutParams(0, dp(48), 1f))
        toolbar.addView(close)
        content.addView(toolbar)
        content.addView(popup, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        dialog.setContentView(content)
        dialog.setOnDismissListener {
            popup.stopLoading()
            (popup.parent as? ViewGroup)?.removeView(popup)
            popup.destroy()
            popupDialogs.remove(popup)
        }
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        return dialog
    }

    private fun handleNavigation(uri: Uri, userGesture: Boolean): Boolean {
        when (uri.scheme?.lowercase()) {
            "https" -> return false
            "http" -> {
                val active = activeAddress ?: return true
                val endpoint = uriHostPort(uri)
                val sameHost = endpoint?.host.equals(active.host, ignoreCase = true)
                val expectedPort = active.port ?: if (active.isHttps) 443 else 80
                val samePort = (endpoint?.port ?: 80) == expectedPort
                if (!active.isHttps && sameHost && samePort) return false
                if (userGesture) openExternal(uri)
                return true
            }
            "mailto", "tel", "sms", "geo" -> {
                openExternal(uri)
                return true
            }
            "about" -> return uri.toString() != "about:blank"
            else -> return true
        }
    }

    private fun uriHostPort(uri: Uri): UriHostPort? {
        val authority = uri.encodedAuthority ?: return null
        if ('@' in authority) return null

        val host: String
        val port: Int?
        if (authority.startsWith("[")) {
            val closingBracket = authority.indexOf(']')
            if (closingBracket <= 1) return null
            host = Uri.decode(authority.substring(1, closingBracket))
            val suffix = authority.substring(closingBracket + 1)
            port = when {
                suffix.isEmpty() -> null
                !suffix.startsWith(":") || suffix.length == 1 -> return null
                else -> suffix.substring(1).toIntOrNull() ?: return null
            }
        } else {
            val colon = authority.lastIndexOf(':')
            if (colon == -1) {
                host = Uri.decode(authority)
                port = null
            } else {
                if (authority.indexOf(':') != colon) return null
                host = Uri.decode(authority.substring(0, colon))
                val portText = authority.substring(colon + 1)
                if (portText.isEmpty()) return null
                port = portText.toIntOrNull() ?: return null
            }
        }

        if (host.isBlank() || port != null && port !in 1..65535) return null
        return UriHostPort(host, port)
    }

    private fun openExternal(uri: Uri) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            .onFailure { Toast.makeText(this, R.string.connection_error, Toast.LENGTH_SHORT).show() }
    }

    private fun showError(message: String) {
        errorMessage.text = message
        errorPanel.visibility = View.VISIBLE
        pageProgress.visibility = View.GONE
    }

    private fun renderLifetimeUnlock(unlocked: Boolean) {
        val purchasesVisible = BuildConfig.BILLING_ENABLED
        val cappedMode = BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE
        lifetimeUnlockDescription.visibility = if (purchasesVisible) View.VISIBLE else View.GONE
        lifetimeUnlockDescription.setText(
            if (cappedMode) R.string.lifetime_unlock_description_capped
            else R.string.lifetime_unlock_description_ads,
        )
        lifetimeUnlockButton.visibility = if (purchasesVisible && !unlocked) View.VISIBLE else View.GONE
        lifetimeUnlockMessage.visibility = if (purchasesVisible && unlocked) View.VISIBLE else View.GONE
        lifetimeUnlockMessage.setText(
            if (cappedMode) R.string.lifetime_unlock_active_capped
            else R.string.lifetime_unlock_active_ads,
        )
        restorePurchasesButton.visibility = if (purchasesVisible) View.VISIBLE else View.GONE
        lifetimeUnlockButton.text = getString(
            if (cappedMode) R.string.lifetime_unlock_button_capped
            else R.string.lifetime_unlock_button_ads,
        )
        renderTrialUsageStatus()
    }

    private fun renderLifetimeUnlockPrice(localizedPrice: String?) {
        val priceString = if (BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE) {
            R.string.lifetime_unlock_button_capped_with_price
        } else {
            R.string.lifetime_unlock_button_ads_with_price
        }
        val defaultString = if (BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE) {
            R.string.lifetime_unlock_button_capped
        } else {
            R.string.lifetime_unlock_button_ads
        }
        lifetimeUnlockButton.text = localizedPrice?.let { getString(priceString, it) } ?: getString(defaultString)
    }

    private fun renderTrialUsageStatus() {
        val cappedMode = BuildConfig.MONETIZATION_MODE == CAPPED_MONETIZATION_MODE
        trialUsageStatus.visibility = if (cappedMode) View.VISIBLE else View.GONE
        if (!cappedMode) return

        val remaining = trialUsageStore.remainingSessions
        when {
            remaining > 0 -> trialUsageStatus.text =
                resources.getQuantityString(R.plurals.trial_sessions_remaining, remaining, remaining)
            trialSessionStartedThisLaunch -> trialUsageStatus.setText(R.string.trial_current_session_active)
            else -> trialUsageStatus.setText(R.string.trial_sessions_exhausted)
        }
    }

    private fun showTrialCompleteDialog() {
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.trial_complete_title)
            .setMessage(R.string.trial_complete_message)
            .setNegativeButton(R.string.later, null)
        if (BuildConfig.BILLING_ENABLED) {
            dialog.setPositiveButton(R.string.lifetime_unlock_button_capped) { _, _ ->
                monetization.purchaseLifetimeUnlock()
            }
        }
        dialog.show()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean(TRIAL_SESSION_STARTED_KEY, trialSessionStartedThisLaunch)
        super.onSaveInstanceState(outState)
    }

    private fun deleteProfile(server: SavedServer) {
        if (!supportsProfiles) {
            if (getPreferences(MODE_PRIVATE).getString(FALLBACK_SERVER_ID, null) == server.id) {
                clearDefaultWebViewData {
                    if (getPreferences(MODE_PRIVATE).getString(FALLBACK_SERVER_ID, null) == server.id) {
                        getPreferences(MODE_PRIVATE).edit().remove(FALLBACK_SERVER_ID).apply()
                    }
                }
            }
            return
        }
        runCatching { ProfileStore.getInstance().deleteProfile(server.profileName) }
    }

    private fun clearDefaultWebViewData(afterCleared: () -> Unit = {}) {
        defaultWebViewDataClearCallbacks.add(afterCleared)
        if (clearingDefaultWebViewData) return

        clearingDefaultWebViewData = true
        val cookies = CookieManager.getInstance()
        cookies.removeAllCookies {
            android.webkit.WebStorage.getInstance().deleteAllData()
            cookies.flush()
            clearingDefaultWebViewData = false
            val callbacks = defaultWebViewDataClearCallbacks.toList()
            defaultWebViewDataClearCallbacks.clear()
            callbacks.forEach { it() }
        }
    }

    private fun flushActiveCookies() {
        val current = webView ?: return
        if (supportsProfiles) {
            runCatching { WebViewCompat.getProfile(current).cookieManager.flush() }
        } else {
            CookieManager.getInstance().flush()
        }
    }

    private fun destroyActiveWebView() {
        popupDialogs.values.toList().forEach(Dialog::dismiss)
        popupDialogs.clear()
        val current = webView
        if (current != null) {
            current.stopLoading()
            current.loadUrl("about:blank")
            current.clearHistory()
            (current.parent as? ViewGroup)?.removeView(current)
            current.destroy()
        }
        webView = null
        errorPanel.visibility = View.GONE
        pageProgress.visibility = View.GONE
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER_REQUEST) return
        val callback = pendingFileChooser ?: return
        pendingFileChooser = null
        val results = when {
            resultCode != RESULT_OK -> null
            data?.clipData != null -> Array(data.clipData!!.itemCount) { index -> data.clipData!!.getItemAt(index).uri }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback.onReceiveValue(results)
    }

    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != DOWNLOAD_PERMISSION_REQUEST) return

        val download = pendingDownload.also { pendingDownload = null } ?: return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            enqueueDownload(download)
        } else {
            Toast.makeText(this, R.string.download_permission_denied, Toast.LENGTH_LONG).show()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class PendingDownload(
        val url: String,
        val userAgent: String,
        val contentDisposition: String?,
        val mimeType: String?,
        val cookies: String?,
        val referer: String?,
    )

    private companion object {
        const val FILE_CHOOSER_REQUEST = 45217
        const val DOWNLOAD_PERMISSION_REQUEST = 45218
        const val FALLBACK_SERVER_ID = "fallback_server_id"
        const val CAPPED_MONETIZATION_MODE = "capped"
        const val TRIAL_SESSION_STARTED_KEY = "trial_session_started_this_launch"
    }
}
