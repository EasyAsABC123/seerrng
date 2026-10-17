#!/usr/bin/env bash
set -euo pipefail

tag="${1:?Usage: build-android-release.sh vX.Y.Z [output-directory]}"
output_dir="${2:-dist-release}"

if [[ ! "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Android release tag must be a semantic version: $tag" >&2
  exit 2
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
patch="${BASH_REMATCH[3]}"
version="${tag#v}"
if (( ${#major} > 4 )); then
  echo "Android versionCode does not support this major version: $tag" >&2
  exit 2
fi
if (( minor > 999 || patch > 999 )); then
  echo "Android versionCode supports minor and patch values below 1000: $tag" >&2
  exit 2
fi
version_code=$((10#$major * 1000000 + 10#$minor * 1000 + 10#$patch))
if (( version_code < 1 || version_code > 2100000000 )); then
  echo "Android versionCode is outside the supported range: $version_code" >&2
  exit 2
fi

for name in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required release signing secret: $name" >&2
    exit 2
  fi
done

sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk_root" ]]; then
  echo 'ANDROID_HOME or ANDROID_SDK_ROOT must point to the Android SDK.' >&2
  exit 2
fi
apksigner="$sdk_root/build-tools/36.0.0/apksigner"
if [[ ! -x "$apksigner" ]]; then
  echo "Android build-tools 36.0.0 are required: $apksigner" >&2
  exit 2
fi

temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
keystore="$(mktemp "$temporary_root/seerrng-release-keystore.XXXXXX")"
trap 'rm -f -- "$keystore"' EXIT
chmod 600 "$keystore"
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore"
test -s "$keystore"

export ANDROID_KEYSTORE_PATH="$keystore"
mkdir -p "$output_dir"
./android/gradlew --no-daemon -p android \
  :app:assembleRelease \
  :app:bundleRelease \
  "-PandroidVersionName=$version" \
  "-PandroidVersionCode=$version_code"

apk="android/app/build/outputs/apk/release/app-release.apk"
aab="android/app/build/outputs/bundle/release/app-release.aab"
test -s "$apk"
test -s "$aab"
"$apksigner" verify --verbose --print-certs "$apk"
if ! jar tf "$aab" | grep -Eq '^META-INF/[^/]+\.(RSA|DSA|EC)$'; then
  echo 'Android App Bundle is missing its signing certificate.' >&2
  exit 1
fi
jarsigner -verify -verbose:summary "$aab" >/dev/null

archive="seerrng-${tag}-android.apk"
bundle="seerrng-${tag}-android.aab"
checksum="seerrng-${tag}-android.sha256"
bundle_checksum="seerrng-${tag}-android-aab.sha256"
cp -- "$apk" "$output_dir/$archive"
cp -- "$aab" "$output_dir/$bundle"
(
  cd "$output_dir"
  sha256sum "$archive" > "$checksum"
  sha256sum "$bundle" > "$bundle_checksum"
)
echo "Built signed Android APK: $output_dir/$archive"
echo "Built signed Android App Bundle: $output_dir/$bundle"
