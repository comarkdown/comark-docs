#!/usr/bin/env bash
# Packs the layer as a consumer installs it, then builds a fresh copy of test/fixtures/consumer with it.
# - Catches what the workspace hides: a file missing from `files`, a dependency only the workspace provides.
# - `WORKDIR` keeps the app there instead of in a temporary folder.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "${WORKDIR:-}" ]; then
  work="$WORKDIR"
  if [ -e "$work/app" ]; then
    echo "$work/app already exists, remove it or pick another WORKDIR" >&2
    exit 1
  fi
  mkdir -p "$work"
else
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
fi

echo "› Packing the layer"
pnpm --dir "$root" pack --pack-destination "$work" > /dev/null
tarball="$(ls "$work"/comark-docs-*.tgz)"

# Outside the repo: pnpm would otherwise pick up its workspace and overrides.
echo "› Copying the consumer fixture to $work/app"
cp -R "$root/test/fixtures/consumer" "$work/app"
cd "$work/app"

# A git checkout like a real site, so the build-time content snapshot runs too.
# The empty root commit gives the content commit a parent, as in any non-shallow clone.
git init -q
git -c user.name=ci -c user.email=ci@localhost commit -q --allow-empty -m root
git add -A
git -c user.name=ci -c user.email=ci@localhost commit -qm fixture

echo "› Installing the packed layer"
npm pkg set "dependencies.comark-docs=file:$tarball" "packageManager=$(npm pkg get packageManager --prefix "$root" | tr -d '"')"
pnpm install

echo "› Building"
pnpm exec nuxt build
