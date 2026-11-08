package com.tuktok.darelsalam

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import androidx.webkit.WebResourceErrorCompat
import android.webkit.WebResourceRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.widget.TextView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "Activity created")
        hideSystemBars()

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(20, 24, 30))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                    assetLoader.shouldInterceptRequest(request.url)

                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    Log.i(TAG, "Page started: " + url)
                }

                override fun onPageFinished(view: WebView, url: String) {
                    Log.i(TAG, "Page finished: " + url)
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceErrorCompat
                ) {
                    val message = "WEB_RESOURCE_ERROR mainFrame=" + request.isForMainFrame +
                        " code=" + error.errorCode + " description=" + error.description +
                        " url=" + request.url
                    if (request.isForMainFrame) Log.e(TAG, message) else Log.w(TAG, message)
                }

                override fun onReceivedHttpError(
                    view: WebView,
                    request: WebResourceRequest,
                    response: android.webkit.WebResourceResponse
                ) {
                    Log.e(TAG, "WEB_HTTP_ERROR status=" + response.statusCode +
                        " reason=" + response.reasonPhrase + " url=" + request.url)
                }

                override fun onRenderProcessGone(
                    view: WebView,
                    detail: RenderProcessGoneDetail
                ): Boolean {
                    Log.e(TAG, "WebView renderer process gone; didCrash=" + detail.didCrash())
                    (view.parent as? android.view.ViewGroup)?.removeView(view)
                    view.destroy()
                    setContentView(TextView(this@MainActivity).apply {
                        text = "محرك عرض اللعبة توقف على هذا الجهاز. تم تسجيل العطل؛ لن نغلق التطبيق فجأة."
                        textSize = 18f
                        setPadding(32, 32, 32, 32)
                        setTextColor(android.graphics.Color.WHITE)
                        setBackgroundColor(android.graphics.Color.rgb(20, 24, 30))
                        gravity = android.view.Gravity.CENTER
                    })
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    Log.d(TAG, "JS " + message.message() + " at " + message.sourceId() + ":" + message.lineNumber())
                    return true
                }
            }
            addJavascriptInterface(AndroidDiagnosticsBridge(), "AndroidDiagnostics")
        }
        setContentView(webView)

        try {
            webView.loadUrl("https://appassets.androidplatform.net/assets/public/android.html")
        } catch (error: Exception) {
            Log.e(TAG, "Could not load local game page", error)
            throw error
        }
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
            Log.e(TAG, "GAME_STARTUP_ERROR: " + message)
        }
    }


    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("AndroidDiagnostics")
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "TuktokDarElsalam"
    }
}
