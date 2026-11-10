#!/bin/sh
# Zet de inhoud van _build als enige commit op de gh-pages branch van de
# opgegeven repository (net als de Travis "pages" provider deed).
# Gebruik: publish_pages.sh <repository-url-met-token>
set -e
REMOTE="$1"
cd _build
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "Deploy ${GITHUB_SHA} (${GITHUB_REF_NAME})"
git push -q --force "$REMOTE" gh-pages
echo "Gepubliceerd naar gh-pages."
