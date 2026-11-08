package com.tuktok.darelsalam

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.AdRequest
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.loading.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.loading.LoadAdError

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var interstitialAd: InterstitialAd? = null
    private var adsInitialized = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemBars()

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ) = assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = WebChromeClient()
            addJavascriptInterface(AndroidAdsBridge(), "AndroidAds")
        }
        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/public/android.html")
        initializeAds()
    }

    private fun hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
    }

    private fun initializeAds() {
        Thread {
            try {
                MobileAds.initialize(
                    this,
                    InitializationConfig.Builder(BuildConfig.ADMOB_APP_ID).build()
                ) {
                    runOnUiThread {
                        adsInitialized = true
                        loadInterstitial()
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "AdMob initialization skipped", error)
            }
        }.start()
    }

    private fun loadInterstitial() {
        if (!adsInitialized || interstitialAd != null) return
        try {
            InterstitialAd.load(
                AdRequest.Builder(BuildConfig.ADMOB_INTERSTITIAL_ID).build(),
                object : AdLoadCallback<InterstitialAd> {
                    override fun onAdLoaded(ad: InterstitialAd) {
                        interstitialAd = ad
                    }

                    override fun onAdFailedToLoad(adError: LoadAdError) {
                        interstitialAd = null
                        Log.d(TAG, "Interstitial unavailable: ${adError.message}")
                    }
                }
            )
        } catch (error: Exception) {
            Log.w(TAG, "Interstitial request skipped", error)
        }
    }

    private fun showInterstitialIfReady() {
        val ad = interstitialAd ?: return
        interstitialAd = null
        ad.adEventCallback = object : InterstitialAdEventCallback {
            override fun onAdDismissedFullScreenContent() {
                loadInterstitial()
            }

            override fun onAdFailedToShowFullScreenContent(error: com.google.android.libraries.ads.mobile.sdk.FullScreenContentError) {
                loadInterstitial()
            }
        }
        ad.show(this)
    }

    inner class AndroidAdsBridge {
        @JavascriptInterface
        fun showInterstitial() {
            runOnUiThread { showInterstitialIfReady() }
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("AndroidAds")
            webView.destroy()
        }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "TuktokDarElsalam"
    }
}
