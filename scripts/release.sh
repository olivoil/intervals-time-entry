#!/bin/bash
# Release a new version of the om-skills plugin
# Usage: ./scripts/release.sh [major|minor|patch]
#
# Bumps the version in marketplace.json, commits, pushes, and prints
# the command to update the installed plugin.

set -e

cd "$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

MANIFEST=".claude-plugin/marketplace.json"
BUMP_TYPE="${1:-patch}"

# Read current version
CURRENT=$(jq -r '.plugins[0].version' "$MANIFEST")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch) PATCH=$((PATCH + 1)) ;;
    *) echo "Usage: $0 [major|minor|patch]" >&2; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# Update manifest
jq --arg v "$NEW_VERSION" '.plugins[0].version = $v' "$MANIFEST" > "${MANIFEST}.tmp" && mv "${MANIFEST}.tmp" "$MANIFEST"

echo "Version: $CURRENT → $NEW_VERSION"

# Commit and push
git add "$MANIFEST"
git commit -m "release: v${NEW_VERSION}"
git push

echo ""
echo "Published v${NEW_VERSION}. To update your local install, run:"
echo ""
echo "  claude plugin marketplace update om"
echo ""
