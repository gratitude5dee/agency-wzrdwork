#!/bin/bash
set -euo pipefail

cd /Users/gratitud3/Downloads/Agency-Synthesis/agency-wzrdwork-main

if [ ! -d node_modules ]; then
  npm install --package-lock=false
fi

mkdir -p .factory/library .factory/skills .factory/validation

echo "Agency Synthesis mission init complete"
