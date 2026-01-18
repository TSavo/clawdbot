#!/bin/bash
set -e

echo "Running mutation tests..."
pnpm test:mutation --reporters=json

# Check if report file exists
if [ ! -f "coverage/mutation/stryker-report.json" ]; then
  echo "ERROR: Stryker report not found at coverage/mutation/stryker-report.json"
  exit 1
fi

# Extract score from stryker-report.json
SCORE=$(jq '.metrics.score' coverage/mutation/stryker-report.json)

echo "Mutation Score: ${SCORE}%"

if (( $(echo "$SCORE < 70" | bc -l) )); then
  echo "FAIL: Mutation score below 70% threshold"
  exit 1
fi

echo "PASS: Mutation score meets threshold"
exit 0
