#!/usr/bin/env bash
# Builds a site extending the layer against the packed layer, instead of the version it pins.
# Usage: scripts/test-consumer.sh <site-checkout> [app-dir]
# - `app-dir` is the Nuxt app inside the site's repository, `docs` by default.
set -euo pipefail

site="$(cd "${1:?Usage: scripts/test-consumer.sh <site-checkout> [app-dir]}" && pwd)"
app="${2:-docs}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "› Packing the layer"
pnpm --dir "$root" pack --pack-destination "$work" > /dev/null
tarball="$(ls "$work"/comark-docs-*.tgz)"

# A copy, so the checkout keeps its own layer version and lockfile.
# `.git` stays: the layer reads the content commit from it.
echo "› Copying the site to $work/site"
rsync -a --exclude node_modules --exclude .nuxt --exclude .output --exclude .vercel --exclude .data "$site/" "$work/site/"
cd "$work/site"

echo "› Pointing $app at the packed layer"
(cd "$app" && npm pkg set "dependencies.comark-docs=file:$tarball")
# The site's lockfile pins the layer it ships, so it has to move.
pnpm install --no-frozen-lockfile

echo "› Building $app"
pnpm --dir "$app" run build
