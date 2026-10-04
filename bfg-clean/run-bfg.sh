#!/usr/bin/env bash
set -euo pipefail

# bfg-clean/run-bfg.sh
# Safe wrapper to run BFG on this repository to remove specified files/strings from history.
# PLEASE REVIEW this script and the two data files in bfg-clean/ before running.

REPO_URL="$(git remote get-url origin)"
MIRROR_DIR="repo-bfg-mirror.git"
BFG_JAR_PATH="./bfg.jar" # place the bfg jar here or change to installed path

echo "This script will:
  1) create a mirror clone of the current repo
  2) run BFG to delete files listed in bfg-clean/paths-to-delete.txt
  3) optionally run BFG replace-text using bfg-clean/replacements.txt
  4) garbage-collect and force-push the cleaned history back to origin

IMPORTANT: You MUST rotate any exposed credentials before running this."

read -p "Have you rotated/revoked the compromised keys? Type YES to continue: " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Aborted. Rotate credentials first." && exit 1
fi

read -p "Proceed to create a mirror clone and run BFG? Type PROCEED to continue: " PROCEED
if [[ "$PROCEED" != "PROCEED" ]]; then
  echo "Aborted." && exit 1
fi

# Create mirror clone
rm -rf "$MIRROR_DIR"
git clone --mirror "$REPO_URL" "$MIRROR_DIR"
cd "$MIRROR_DIR"

# Ensure BFG jar exists in parent dir or prompt to download
if [[ ! -f "$BFG_JAR_PATH" ]]; then
  echo "BFG jar not found at $BFG_JAR_PATH. Download it from https://rtyley.github.io/bfg-repo-cleaner/ and place it at that path, or edit the script." 
  exit 1
fi

# Run delete-files
if [[ -s "../bfg-clean/paths-to-delete.txt" ]]; then
  echo "Running BFG --delete-files ..."
  java -jar "$BFG_JAR_PATH" --delete-files ../bfg-clean/paths-to-delete.txt .
else
  echo "No paths specified to delete. Skipping delete-files step."
fi

# Run replacements (optional)
if [[ -s "../bfg-clean/replacements.txt" ]]; then
  echo "Running BFG --replace-text ..."
  java -jar "$BFG_JAR_PATH" --replace-text ../bfg-clean/replacements.txt .
else
  echo "No replacements specified. Skipping replace-text step."
fi

# Cleanup the repo and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "About to force-push cleaned history to origin. THIS WILL REWRITE REMOTE HISTORY."
read -p "Type FORCE_PUSH to continue and push cleaned history: " FORCE_PUSH
if [[ "$FORCE_PUSH" != "FORCE_PUSH" ]]; then
  echo "Aborted before force-push. Cleaned mirror is left in $MIRROR_DIR for inspection." && exit 0
fi

# Push cleaned history
git push --force --all origin
git push --force --tags origin

echo "Done. The remote history has been rewritten. Inform collaborators to re-clone the repo." 
