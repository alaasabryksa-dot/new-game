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
import android.webkit.RenderProcessGoneDetail
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
        hideSystemBars()

        try {
            val assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

            val gameView = WebView(this)
            webView = gameView
            gameView.setBackgroundColor(Color.rgb(20, 24, 30))
            gameView.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
            }
            gameView.webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                    assetLoader.shouldInterceptRequest(request.url)

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
