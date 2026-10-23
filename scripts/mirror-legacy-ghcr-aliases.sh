#!/usr/bin/env bash
set -euo pipefail

# Existing Unraid and Compose installs may still pull the retired
# ghcr.io/snapetech/seerrng path. Unraid keeps an installed container's
# Repository field, so that path must keep following the latest stable image.
version="${1:?usage: mirror-legacy-ghcr-aliases.sh <stable-version> <ghcr-image> <legacy-ghcr-image>}"
ghcr_image="${2:?usage: mirror-legacy-ghcr-aliases.sh <stable-version> <ghcr-image> <legacy-ghcr-image>}"
legacy_image="${3:?usage: mirror-legacy-ghcr-aliases.sh <stable-version> <ghcr-image> <legacy-ghcr-image>}"

if [[ ! "$version" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Expected a stable semantic version such as v3.71.1; received: $version" >&2
  exit 2
fi

major_tag="v${BASH_REMATCH[1]}"
minor_tag="v${BASH_REMATCH[1]}.${BASH_REMATCH[2]}"
tag_args=()
for tag in "$version" "$minor_tag" "$major_tag" stable latest main master; do
  tag_args+=(--tag "${legacy_image}:${tag}")
done

docker buildx imagetools create "${tag_args[@]}" "${ghcr_image}:${version}"

expected="$(docker buildx imagetools inspect "${ghcr_image}:${version}" --format '{{json .Manifest.Digest}}')"
for tag in "$version" "$minor_tag" "$major_tag" stable latest main master; do
  actual="$(docker buildx imagetools inspect "${legacy_image}:${tag}" --format '{{json .Manifest.Digest}}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "${legacy_image}:${tag} points to ${actual}; expected ${expected}." >&2
    exit 1
  fi
done

printf 'Legacy path %s follows %s at %s.\n' "$legacy_image" "$version" "$expected"
