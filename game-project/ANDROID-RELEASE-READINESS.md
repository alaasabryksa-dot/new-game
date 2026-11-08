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
- The game UI now handles WebGL context loss as recoverable: it allows Three.js to restore its context and clears the blocking error state after a valid context returns.
- Continuous engine audio is suspended on manual pause, quit, manual finish, and automatic shift/rush completion, then explicitly unlocked on resume/start. This avoids a running engine tone after gameplay stops.
- Stop-crowd instancing now respects the device-wide mesh capacity (8 on Android) across all stops, avoiding attempts to write beyond the mobile crowd buffer.
- NPC instance rendering now reuses its hidden transform matrix, per-vehicle cursors, and painter function across frames; it also passes the shared transform directly to `InstancedMesh.setMatrixAt` instead of cloning a matrix for every traffic vehicle.
- The minimap now distinguishes passenger drop-off destinations from ordinary pickup points, while retaining the active rush-delivery marker.
- The passenger HUD now identifies the nearest upcoming onboard drop-off and its forward route distance, so the driver can prepare for the next stop without guessing from the passenger list.
- When fuel falls to 35% or below, the driving HUD displays the forward route distance to the next gas-station pass, rather than the shortest geometric distance that could point backward after passing it.
- The low-fuel HUD now also shows a conservative estimated remaining range in kilometres, calculated from the same fuel-efficiency upgrade, passenger-load, and speed multipliers used by the live fuel model; the estimate is labelled as approximate.
- Stop approach prompts now distinguish drop-off-only stops, pickup-only stops, and stops that serve both actions; the prompt no longer incorrectly describes every passenger stop as a pickup.
- Pedestrian avoidance now uses elapsed-time exponential smoothing with a clamped frame delta, so sidewalk retreat remains consistent across different frame rates and cannot jump after a long suspended frame.
- Resuming with the Escape key now follows the same lifecycle as the on-screen resume control: it resets the frame clock and unlocks audio from the user gesture, preventing a silent resume or stale-frame catch-up. Escape is handled globally even when a menu button retains focus.
- Scene teardown now commits the current run before stopping audio and releasing WebGL resources, covering React unmounts that occur without a preceding browser focus-loss event.
- Mobile touch controls now track active pointer IDs and listen for global pointer-up events, so a finger released outside a button cannot leave steering, throttle, or braking stuck when Android WebView pointer capture is unavailable.
- The renderer requires WebGL 2 / OpenGL ES 3.0. The manifest declares this hardware feature as required; devices without it are not compatible.
- Android scene generation has a reduced-detail path and lower render resolution. Constrained devices now reduce pixel density only after sustained slow frames and recover it gradually after sustained smooth frames; simulation physics remain fixed at 60 Hz.
- Android high-density traffic now has enough instanced render capacity for all 44 weighted NPCs, including the maximum 20 tuk-tuks, preventing invisible simulated vehicles. The mobile path now uses instanced procedural building facades with textured upper-floor windows, generic Arabic shop signs, shutters/glazing, and awnings. These are original generic game assets, not verified reconstructions of individual storefronts.
- APK build and browser-based offline bundle checks are automated. They do not prove successful operation on every physical Android phone.
- Latest verified CI run passed TypeScript checking, the full automated test suite, landscape mobile gameplay smoke tests, the self-contained offline Android web-bundle smoke test, and the production web build.
- A signed production AAB, signing lineage, ads, and physical-device verification are not yet release-approved.

## Gameplay economy and progression hardening (8 Nov 2026)

- Shift earnings are no longer lost when a run ends below the rent target. The earned amount is carried into the persistent wallet, and the remaining rent is reported accurately so progress can accumulate across shifts.
- Fuel-station purchases are proportional to the missing tank percentage (rounded up to whole pounds, with a one-pound minimum). A nearly full tank no longer costs the same as a nearly empty tank; the displayed 22 EGP remains the full-tank reference price.
- Rush-delivery rewards now scale with the number of route stops covered: 35 EGP base plus 4 EGP per stop. The earned amount is shown in the arrival message. The route scheduler still avoids repeating destinations within a run.
- Automated release-quality checks cover the shift carryover, proportional refueling, and distance-based rush reward rules.
- These are code-level economy changes; the resulting economy still needs hands-on play balancing on a physical Android device during the later device-validation stage.

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
