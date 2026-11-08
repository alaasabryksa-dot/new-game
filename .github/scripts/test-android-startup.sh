#!/usr/bin/env bash
set -Eeuo pipefail

APK="${APK_PATH:-game-project/android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="com.tuktok.darelsalam"
ACTIVITY="$PACKAGE/.MainActivity"

fail_with_diagnostics() {
  local reason="$1"
  echo "ANDROID_STARTUP_FAILURE: $reason"
  echo "--- adb devices ---"
  adb devices -l || true
  echo "--- package state ---"
  adb shell dumpsys package "$PACKAGE" 2>&1 | tail -120 || true
  echo "--- recent Android logcat ---"
  adb logcat -d -v threadtime -t 2500 2>&1 | tail -700 || true
  exit 1
}

test -s "$APK" || { echo "APK missing or empty: $APK"; exit 1; }
echo "APK candidate: $APK ($(stat -c%s "$APK") bytes)"

adb start-server
adb wait-for-device

booted=0
for attempt in $(seq 1 150); do
  state="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  bootanim="$(adb shell getprop init.svc.bootanim 2>/dev/null | tr -d '\r' || true)"
  if [[ "$state" == "1" ]]; then
    # Wait for Package Manager to answer before attempting installation.
    if adb shell pm list packages >/dev/null 2>&1; then
      booted=1
      break
    fi
  fi
  echo "Waiting for Android services ($attempt/150); boot=$state bootanim=$bootanim"
  sleep 2
done

[[ "$booted" -eq 1 ]] || fail_with_diagnostics "Android did not finish booting or Package Manager is unavailable"

# Do not run settings/animation commands against the emulator here. The emulator
# runner manages boot; this test only checks the device and installs the APK.
adb get-state
installed=0
for attempt in 1 2 3; do
  echo "Installing APK (attempt $attempt/3)"
  if adb install --no-streaming -r "$APK"; then
    installed=1
    break
  fi
  echo "Install attempt failed; collecting short diagnostics before retry."
  adb logcat -d -v time -t 500 | tail -200 || true
  sleep 8
done
[[ "$installed" -eq 1 ]] || fail_with_diagnostics "APK installation failed"

echo "APK installed. Launching $ACTIVITY"
adb logcat -c
launch_output="$(adb shell am start -W -n "$ACTIVITY" 2>&1)" || {
  echo "$launch_output"
  fail_with_diagnostics "Activity launch command failed"
}
echo "$launch_output"
echo "$launch_output" | grep -q "Status: ok" || fail_with_diagnostics "Android ActivityManager did not report Status: ok"

ready=0
for attempt in $(seq 1 90); do
  if adb logcat -d -s TuktokDarElsalam:I TuktokDarElsalam:E chromium:E AndroidRuntime:E | grep -q "GAME_READY"; then
    ready=1
    break
  fi
  pid="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
  if [[ -z "$pid" ]]; then
    fail_with_diagnostics "Game process exited before GAME_READY"
  fi
  sleep 2
done

adb logcat -d -v threadtime -s TuktokDarElsalam:I TuktokDarElsalam:E chromium:E AndroidRuntime:E
[[ "$ready" -eq 1 ]] || fail_with_diagnostics "WebView did not report GAME_READY within 180 seconds"

pid="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
[[ -n "$pid" ]] || fail_with_diagnostics "Game process exited after GAME_READY"
echo "ANDROID_GAME_READY package=$PACKAGE pid=$pid"
