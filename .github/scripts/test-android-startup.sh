#!/usr/bin/env bash
set -euo pipefail

APK="${APK_PATH:-game-project/android/app/build/outputs/apk/debug/app-debug.apk}"
PACKAGE="com.tuktok.darelsalam"

test -s "$APK"
adb wait-for-device

booted=0
for attempt in $(seq 1 120); do
  state="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  package_service=0
  if [[ "$state" == "1" ]] && adb shell pm path android >/dev/null 2>&1; then
    package_service=1
  fi
  if [[ "$state" == "1" && "$package_service" == "1" ]]; then
    booted=1
    break
  fi
  echo "Waiting for Android boot/package service ($attempt/120); boot=$state package_service=$package_service"
  sleep 2
done

if [[ "$booted" -ne 1 ]]; then
  adb devices -l || true
  adb logcat -d -t 1000 || true
  echo "Android emulator or Package Manager did not become ready"
  exit 1
fi

installed=0
for attempt in 1 2 3; do
  echo "Installing APK (attempt $attempt/3)"
  if adb install -r "$APK"; then
    installed=1
    break
  fi
  adb logcat -d -t 500 || true
  sleep 8
done
if [[ "$installed" -ne 1 ]]; then
  echo "APK installation failed after Package Manager readiness checks"
  adb shell dumpsys activity processes || true
  adb logcat -d -v time || true
  exit 1
fi

adb logcat -c
adb shell am force-stop "$PACKAGE" || true
adb shell am start -n "$PACKAGE/.MainActivity"

ready=0
for attempt in $(seq 1 60); do
  if adb logcat -d -s TuktokDarElsalam:I TuktokDarElsalam:E | grep -q "GAME_READY"; then
    ready=1
    break
  fi
  pid="$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
  if [[ -z "$pid" ]]; then
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
