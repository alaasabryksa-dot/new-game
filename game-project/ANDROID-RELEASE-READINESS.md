# Android release readiness — توكتوك دار السلام

## Confirmed product requirements

- Android phone game; gameplay is landscape-only.
- The player drives a tuk-tuk only. Cars, taxis, microbuses and trucks are traffic NPCs, not selectable player vehicles.
- Official player-facing title: **توكتوك دار السلام**.
- Confirmed Android application ID: `com.tuktok.darelsalam`. Keep it unchanged.
- The complete game must launch and remain playable without an internet connection.
- AdMob ads may load only when connectivity is available. Gameplay must not depend on an ad response or network access.

## Current repository state

- The game is currently a React + Three.js application using TanStack Start/Nitro.
- The repository does **not** contain a native Android Gradle project, Capacitor Android project, APK, or AAB.
- The current production web build is server-oriented; it is not yet a verified self-contained offline Android web bundle.
- A successful web CI run is not an Android build and does not prove offline gameplay.

## Android implementation plan

1. Separate the game client and its required assets from server-only application infrastructure. Preserve the existing Three.js gameplay and local save data.
2. Produce and test a fully local web bundle that runs without a remote URL, API, authentication service, or server runtime.
3. Add a native Android wrapper (Capacitor or an equivalent maintained Android WebView shell) that loads only the bundled local game assets.
4. Add the official Google Mobile Ads SDK through a maintained Capacitor/native integration. Use Google's test ad unit IDs during development; never serve test IDs as production monetization.
5. Request ads only while online, handle no-fill/offline states silently, and never block gameplay or require watching an ad to launch.
6. Build a debug APK for installation tests and a signed Android App Bundle (AAB) for Google Play.
7. Test on real Android phones: airplane-mode launch and gameplay, landscape orientation, touch controls, audio, pause/resume, save persistence, ad-offline behavior, and ad consent/privacy flows.
8. Configure signing with protected GitHub Actions secrets. Never commit keystores, passwords, or production ad credentials.

## Inputs still required before production release

- The user's AdMob **App ID** and production ad-unit IDs (banner/interstitial/rewarded, only the formats actually approved for the game). Until supplied, use Google's official test IDs only.
- A protected signing key and a secure backup. These must not be committed to the repository.
- Google Play Console account and store listing/privacy declarations, completed by the account owner.

## Release gates

- [ ] Self-contained offline client bundle is implemented and verified.
- [ ] Native Android project and Gradle build are implemented.
- [ ] AdMob test integration is implemented; production IDs are configured securely.
- [ ] APK and AAB build successfully in CI.
- [ ] Signed APK installs and launches on physical Android devices.
- [ ] Gameplay works with airplane mode enabled.
- [ ] Ad loading failures do not interrupt gameplay.
- [ ] Landscape, touch controls, audio, lifecycle and save behavior pass device tests.
- [ ] Google Play policy, privacy disclosures, consent and data-safety declarations are reviewed.
- [ ] Signed AAB is validated and signing lineage is safely backed up.

## Accuracy rule

Do not call the project Android-ready or announce an APK/AAB as available until the native wrapper, offline bundle, signing, artifact build, and physical-device tests have all passed.
