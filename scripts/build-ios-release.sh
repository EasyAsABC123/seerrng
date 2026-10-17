#!/usr/bin/env bash
set -euo pipefail

tag="${1:?Usage: build-ios-release.sh vX.Y.Z [output-directory]}"
output_dir="${2:-dist-release}"
if [[ ! "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "iOS release tag must be a semantic version: $tag" >&2
  exit 2
fi

short_version="${tag#v}"
short_version="${short_version%%-*}"
build_number="${IOS_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"
if [[ ! "$build_number" =~ ^[1-9][0-9]*$ ]]; then
  echo "IOS_BUILD_NUMBER must be a positive integer: $build_number" >&2
  exit 2
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo 'Xcode and xcodebuild are required. Run this script on a macOS host.' >&2
  exit 2
fi
xcode_version="$(xcodebuild -version | awk '/^Xcode / { print $2; exit }')"
xcode_major="${xcode_version%%.*}"
if [[ ! "$xcode_major" =~ ^[0-9]+$ ]] || (( xcode_major < 26 )); then
  echo "Xcode 26 or newer is required for current App Store upload requirements; found ${xcode_version:-unknown}." >&2
  exit 2
fi

temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
build_dir="$(mktemp -d "$temporary_root/seerrng-ios-build.XXXXXX")"
trap 'rm -rf -- "$build_dir"' EXIT
mkdir -p "$output_dir"
result_bundle="$output_dir/seerrng-${tag}-ios-tests.xcresult"
if [[ -e "$result_bundle" ]]; then
  rm -rf -- "$result_bundle"
fi

project='ios/SeerrNG.xcodeproj'
scheme='SeerrNG'
version_settings=("MARKETING_VERSION=$short_version" "CURRENT_PROJECT_VERSION=$build_number")

xcodebuild \
  -project "$project" \
  -scheme "$scheme" \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=${IOS_SIMULATOR_NAME:-iPhone 17}" \
  -derivedDataPath "$build_dir" \
  -resultBundlePath "$result_bundle" \
  "${version_settings[@]}" \
  CODE_SIGNING_ALLOWED=NO \
  test

xcodebuild \
  -project "$project" \
  -scheme "$scheme" \
  -configuration Release \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$build_dir" \
  "${version_settings[@]}" \
  CODE_SIGNING_ALLOWED=NO \
  build

app="$build_dir/Build/Products/Release-iphonesimulator/SeerrNG.app"
test -d "$app"
plutil -lint -- "$app/Info.plist"
archive="$output_dir/seerrng-${tag}-ios-simulator.zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$archive"
checksum="${archive%.zip}.sha256"
(cd "$output_dir" && shasum -a 256 "${archive##*/}" > "${checksum##*/}")
echo "Built iOS Simulator app package: $archive"
echo 'This .app package runs in the iOS Simulator; it is not an iPhone/iPad installable IPA.'
