# Android release readiness — توكتوك دار السلام

## Confirmed product requirements

- Android phone game; gameplay is landscape-only.
- The player drives a tuk-tuk only. Cars, taxis, microbuses and trucks are traffic NPCs, not selectable player vehicles.
- Official player-facing title: **توكتوك دار السلام**.
- Confirmed Android application ID: `com.tuktok.darelsalam`. Keep it unchanged.
- The complete game must launch and remain playable without an internet connection.
- AdMob ads may load only when connectivity is available. Gameplay must not depend on an ad response or network access.

## Current repository state (reviewed 8 Nov 2026)

- The game client is React + Three.js; the Android build uses a native Kotlin Activity with AndroidX WebKit `WebViewAssetLoader`.
- The Gradle project is present under `android/`, with application ID `com.tuktok.darelsalam`, minimum Android API 24, and landscape orientation.
- The Android-specific Vite build packages the game entry and assets under `android/app/src/main/assets/public` and loads them from the local Android asset origin. Gameplay does not require a remote web server.
- The native WebView now serves only the packaged `https://appassets.androidplatform.net/assets/` origin. Other HTTP(S) subresources and navigations are denied, preventing accidental runtime CDN/API dependencies from silently breaking offline play.
- Native teardown now explicitly pauses WebView execution, removes the JavaScript diagnostics bridge, stops loading, and destroys the WebView. Game teardown also releases sprite-owned materials and textures (including pedestrian artwork), not just mesh resources.
- The renderer requires WebGL 2 / OpenGL ES 3.0. The manifest declares this hardware feature as required; devices without it are not compatible.
- Android scene generation has a reduced-detail path and lower render resolution. The mobile path now uses instanced procedural building facades with textured upper-floor windows, generic Arabic shop signs, shutters/glazing, and awnings. These are original generic game assets, not verified reconstructions of individual storefronts.
- APK build and browser-based offline bundle checks are automated. They do not prove successful operation on every physical Android phone.
- A signed production AAB, signing lineage, ads, and physical-device verification are not yet release-approved.

## Remaining Android release work

1. Preserve the packaged-local-assets-only WebView policy. If optional online services (such as ads) are later approved, isolate them behind a separately reviewed allowlist and ensure they cannot block gameplay; do not introduce remote game dependencies or server/auth requirements into the Android entry.
2. Preserve the WebGL 2 capability check and only report `GAME_READY` after a real render frame has been submitted.
3. Build a debug APK and validate installation/startup on a compatible physical Android phone. Check landscape, touch controls, sound, pause/resume, local save persistence, and airplane-mode play.
4. Add ads only after gameplay is stable. Ads must never block launch or require connectivity; use official test IDs during development and secure production IDs.
5. Configure release signing with protected secrets. Never commit keystores or passwords.
6. Build and validate a signed AAB only after the physical-device gate passes.

## Inputs still required before production release

- The user's AdMob **App ID** and production ad-unit IDs (banner/interstitial/rewarded, only the formats actually approved for the game). Until supplied, use Google's official test IDs only.
- A protected signing key and a secure backup. These must not be committed to the repository.
- Google Play Console account and store listing/privacy declarations, completed by the account owner.

## Release gates

- [ ] Self-contained offline client bundle is implemented and verified.
- [ ] Native Android project and Gradle build are implemented.
- [ ] Mobile street environment has a low-draw-call storefront pass; remaining work is to compare its appearance and frame pacing on a physical device.
- [ ] APK and AAB build successfully in CI after the user approves the final packaging stage.
- [ ] Signed APK installs and launches on physical Android devices.
- [ ] Gameplay works with airplane mode enabled.
- [ ] Ad loading failures do not interrupt gameplay.
- [ ] Landscape, touch controls, audio, lifecycle and save behavior pass device tests.
- [ ] Google Play policy, privacy disclosures, consent and data-safety declarations are reviewed.
- [ ] Signed AAB is validated and signing lineage is safely backed up.

## Accuracy rule

Do not call the project Android-ready or announce an APK/AAB as available until the native wrapper, offline bundle, signing, artifact build, and physical-device tests have all passed.
