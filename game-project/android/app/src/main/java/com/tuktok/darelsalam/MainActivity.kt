package com.tuktok.darelsalam

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.RenderProcessGoneDetail
import java.io.ByteArrayInputStream
import android.webkit.WebView
import android.widget.TextView
import androidx.webkit.WebResourceErrorCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : Activity() {
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "Activity created")

        try {
            val assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

            val gameView = WebView(this)
            webView = gameView
            // Renderer priority is an instance API added in Android 8.0 (API 26).
            // Keep this foreground game's renderer at normal priority without breaking API 24–25.
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                gameView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, false)
            }
            gameView.setBackgroundColor(Color.rgb(20, 24, 30))
            gameView.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
            }
            gameView.webViewClient = object : WebViewClientCompat() {
                private fun isPackagedGameUrl(url: android.net.Uri): Boolean =
                    url.scheme == "https" &&
                        url.host == "appassets.androidplatform.net" &&
                        url.path.orEmpty().startsWith("/assets/")

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    val url = request.url
                    if (isPackagedGameUrl(url)) return assetLoader.shouldInterceptRequest(url)
                    // The Android game is self-contained: fail closed for remote HTTP(S)
                    // resources so an accidental CDN/API dependency cannot break offline play.
                    if (url.scheme == "http" || url.scheme == "https") {
                        Log.w(TAG, "Blocked non-packaged game resource: $url")
                        return WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            403,
                            "Blocked by offline game policy",
                            mapOf("Cache-Control" to "no-store"),
                            ByteArrayInputStream("Network resources are disabled".toByteArray())
                        )
                    }
                    return null
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (isPackagedGameUrl(url)) return false
                    Log.w(TAG, "Blocked navigation outside packaged game: $url")
                    return true
                }

                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    Log.i(TAG, "Page started: $url")
                }

                override fun onPageFinished(view: WebView, url: String) {
                    Log.i(TAG, "Page finished: $url")
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceErrorCompat
                ) {
                    val message = "WEB_RESOURCE_ERROR mainFrame=${request.isForMainFrame} code=${error.errorCode} description=${error.description} url=${request.url}"
                    if (request.isForMainFrame) {
                        Log.e(TAG, message)
                        showFailure("تعذر تحميل ملفات اللعبة", message)
                    } else {
                        Log.w(TAG, message)
                    }
                }

                override fun onReceivedHttpError(
                    view: WebView,
                    request: WebResourceRequest,
                    response: android.webkit.WebResourceResponse
                ) {
                    val message = "WEB_HTTP_ERROR status=${response.statusCode} reason=${response.reasonPhrase} url=${request.url}"
                    if (request.isForMainFrame) showFailure("خطأ في صفحة اللعبة", message)
                    Log.e(TAG, message)
                }

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    val message = "WebView renderer process gone; didCrash=${detail.didCrash()}"
                    Log.e(TAG, message)
                    // Android requires a WebView whose renderer has exited to be removed
                    // and destroyed before the Activity continues with another view.
                    (view.parent as? ViewGroup)?.removeView(view)
                    view.stopLoading()
                    view.destroy()
                    if (webView === view) webView = null
                    showFailure("محرك عرض اللعبة توقف", message)
                    return true
                }
            }
            gameView.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    Log.d(TAG, "JS ${message.message()} at ${message.sourceId()}:${message.lineNumber()}")
                    return true
                }
            }
            gameView.addJavascriptInterface(AndroidDiagnosticsBridge(), "AndroidDiagnostics")
            setContentView(gameView)
            // Apply immersive mode only after the decor view has been attached.
            window.decorView.post { hideSystemBars() }
            gameView.loadUrl("https://appassets.androidplatform.net/assets/public/android.html")
        } catch (error: Exception) {
            Log.e(TAG, "Native startup failed", error)
            showFailure("تعذر بدء التطبيق", error.stackTraceToString())
        }
    }

    private fun showFailure(title: String, details: String) {
        runOnUiThread {
            val message = TextView(this).apply {
                text = "$title\n\n$details"
                textSize = 14f
                setPadding(28, 28, 28, 28)
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.rgb(20, 24, 30))
                gravity = Gravity.CENTER
            }
            (webView?.parent as? ViewGroup)?.removeView(webView)
            setContentView(message)
        }
    }

    override fun onPause() {
        // Release any held driving input before Android backgrounds the Activity.
        webView?.evaluateJavascript("window.dispatchEvent(new Event('blur'))", null)
        webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        window.decorView.post { hideSystemBars() }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) window.decorView.post { hideSystemBars() }
    }

    private fun hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
    }

    inner class AndroidDiagnosticsBridge {
        @JavascriptInterface
        fun onGameReady() {
            Log.i(TAG, "GAME_READY")
        }

        @JavascriptInterface
        fun onGameError(message: String) {
            Log.e(TAG, "GAME_STARTUP_ERROR: $message")
            // Surface JavaScript/Three.js startup failures on the device instead of
            // leaving the player with a blank screen and an error hidden in logcat.
            showFailure("تعذر تشغيل محرك اللعبة", message)
        }
    }

    override fun onDestroy() {
        webView?.let { view ->
            view.removeJavascriptInterface("AndroidDiagnostics")
            view.stopLoading()
            view.loadUrl("about:blank")
            view.destroy()
        }
        webView = null
        super.onDestroy()
    }

    companion object {
        private const val TAG = "TuktokDarElsalam"
    }
}
