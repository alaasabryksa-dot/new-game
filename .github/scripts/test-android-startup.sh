#!/usr/bin/env bash
set -euo pipefail

APK="game-project/android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.tuktok.darelsalam"

adb wait-for-device
booted=0
for attempt in $(seq 1 90); do
  state="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$state" == "1" ]] && adb shell pm list packages >/dev/null 2>&1; then
    booted=1
    break
  fi
  echo "Waiting for Android emulator boot ($attempt/90); state=$state"
  sleep 2
done

if [[ "$booted" -ne 1 ]]; then
  adb devices -l || true
  adb logcat -d -t 500 || true
  echo "Android emulator did not finish booting"
  exit 1
fi

adb install -r "$APK"
adb logcat -c
adb shell am force-stop "$PACKAGE" || true
adb shell am start -n "$PACKAGE/.MainActivity"

ready=0
for attempt in $(seq 1 45); do
  if adb logcat -d -s TuktokDarElsalam:I TuktokDarElsalam:E | grep -q "GAME_READY"; then
    ready=1
    break
  fi
  if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "Game process exited before GAME_READY"
    adb logcat -d -v time || true
    exit 1
  fi
  sleep 2
done

adb logcat -d -v time -s TuktokDarElsalam:I TuktokDarElsalam:E chromium:E AndroidRuntime:E | tee android-startup.log
if [[ "$ready" -ne 1 ]]; then
  echo "Android game did not report GAME_READY"
  adb logcat -d -v time || true
  exit 1
fi

adb shell pidof "$PACKAGE"
