# Android release readiness — Fayoum Street Tuk-tuk

## Current state

- The game is a React + Three.js web application.
- The project has a web-app manifest/install flow supplied by the workspace PWA plugin.
- The repository does **not** currently contain a native Android Gradle project, Capacitor Android project, APK, or AAB.
- A successful web production build is not an Android package and is not proof of device installation.

## Required release inputs

1. A stable public HTTPS deployment URL for the finished game.
2. The final Android application ID (package name), chosen once and kept stable for updates.
3. Final launcher icon and splash artwork.
4. A protected Android signing key and its recovery backup; never commit the key or passwords.
5. A chosen wrapper path:
   - Trusted Web Activity (TWA) after the public domain is stable and Digital Asset Links are configured, or
   - Capacitor/native WebView if offline assets and native integrations are required.
6. A real-device test on at least one lower-memory Android phone and one newer phone.

## Release gates

- [ ] Confirm the deployed URL and domain ownership.
- [ ] Choose and freeze the application ID.
- [ ] Configure the wrapper and Android SDK / Gradle workflow.
- [ ] Configure signing through GitHub Actions secrets (never repository files).
- [ ] Build both APK (install test) and AAB (store delivery).
- [ ] Install the signed APK on a physical Android device.
- [ ] Verify audio, touch controls, screen rotation, pause/resume, save persistence, and background/foreground behavior.
- [ ] Verify the AAB with bundle validation and retain the signing lineage for future updates.

## Important accuracy note

Do not label this project Android-ready or announce an APK/AAB as available until the native wrapper, signing, artifact build, and physical-device installation checks have all passed.
