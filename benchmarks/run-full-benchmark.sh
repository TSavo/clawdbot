#!/usr/bin/env bash
################################################################################
# Voice Provider Benchmarking Pipeline
#
# Executes comprehensive benchmark suite and stores results in memory
# Usage: ./benchmarks/run-full-benchmark.sh [--docker] [--memory]
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$SCRIPT_DIR")" && pwd)"
REPORT_DIR="/tmp/voice-benchmarks-$(date +%Y%m%d_%H%M%S)"
BENCHMARK_LOG="${REPORT_DIR}/benchmark.log"

# Options
USE_DOCKER=false
STORE_MEMORY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --docker)
      USE_DOCKER=true
      shift
      ;;
    --memory)
      STORE_MEMORY=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Create output directory
mkdir -p "$REPORT_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  local level=$1
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  case $level in
    INFO)
      echo -e "${BLUE}[${timestamp}]${NC} ${message}" | tee -a "$BENCHMARK_LOG"
      ;;
    SUCCESS)
      echo -e "${GREEN}[${timestamp}] ✓${NC} ${message}" | tee -a "$BENCHMARK_LOG"
      ;;
    WARN)
      echo -e "${YELLOW}[${timestamp}] ⚠${NC} ${message}" | tee -a "$BENCHMARK_LOG"
      ;;
    ERROR)
      echo -e "${RED}[${timestamp}] ✗${NC} ${message}" | tee -a "$BENCHMARK_LOG"
      ;;
  esac
}

log INFO "=== Voice Provider Benchmark Suite ==="
log INFO "Report directory: $REPORT_DIR"
log INFO "Docker mode: $USE_DOCKER"
log INFO "Memory storage: $STORE_MEMORY"
log INFO ""

# Prerequisites
log INFO "Checking prerequisites..."

if ! command -v bun &> /dev/null; then
  log ERROR "bun is not installed"
  exit 1
fi
log SUCCESS "bun found: $(bun --version)"

if ! command -v node &> /dev/null; then
  log ERROR "node is not installed"
  exit 1
fi
log SUCCESS "node found: $(node --version)"

if [[ "$STORE_MEMORY" == true ]]; then
  if ! command -v npx &> /dev/null; then
    log ERROR "npx is not installed (required for memory storage)"
    exit 1
  fi
  log SUCCESS "npx found"
fi

log INFO ""

# Step 1: Run standard benchmarks
log INFO "Step 1: Running standard benchmarks..."
log INFO "Executing: bun benchmarks/voice-providers.benchmark.ts"

if bun "$SCRIPT_DIR/voice-providers.benchmark.ts" \
  > "${REPORT_DIR}/benchmark-standard.log" 2>&1; then
  log SUCCESS "Standard benchmarks completed"
else
  log WARN "Standard benchmarks had warnings or errors (see log)"
fi

# Step 2: Run Docker benchmarks if requested
if [[ "$USE_DOCKER" == true ]]; then
  log INFO ""
  log INFO "Step 2: Running Docker-specific benchmarks..."

  # Check if container is running
  if docker ps 2>/dev/null | grep -q clawdbot-gateway; then
    log INFO "Found running container: clawdbot-gateway"

    log INFO "Executing: bun benchmarks/voice-docker.benchmark.ts"
    if bun "$SCRIPT_DIR/voice-docker.benchmark.ts" \
      > "${REPORT_DIR}/benchmark-docker.log" 2>&1; then
      log SUCCESS "Docker benchmarks completed"

      # Move generated Docker report
      if [[ -f /tmp/voice-benchmark-report.json ]]; then
        cp /tmp/voice-benchmark-report.json "${REPORT_DIR}/docker-report.json"
        log SUCCESS "Docker report saved"
      fi
    else
      log WARN "Docker benchmarks had errors (see log)"
    fi
  else
    log WARN "Container clawdbot-gateway is not running"
    log INFO "Start it with: docker compose up -d clawdbot-gateway"
  fi
fi

# Step 3: Analyze results
log INFO ""
log INFO "Step 3: Analyzing benchmark results..."
log INFO "Executing: bun benchmarks/voice-benchmark-results.ts"

ANALYSIS_OUTPUT=$(mktemp)
if bun "$SCRIPT_DIR/voice-benchmark-results.ts" > "$ANALYSIS_OUTPUT" 2>&1; then
  log SUCCESS "Analysis completed"

  # Save full analysis output
  cp "$ANALYSIS_OUTPUT" "${REPORT_DIR}/analysis-output.txt"

  # Extract JSON data for memory storage
  if grep -q "KEY: performance_metrics" "$ANALYSIS_OUTPUT"; then
    sed -n '/KEY: performance_metrics/,/^---$/p' "$ANALYSIS_OUTPUT" \
      | sed '1d;$d' > "${REPORT_DIR}/metrics.json" 2>/dev/null || true
    log SUCCESS "Performance metrics extracted"
  fi

  if grep -q "KEY: bottlenecks" "$ANALYSIS_OUTPUT"; then
    sed -n '/KEY: bottlenecks/,/^---$/p' "$ANALYSIS_OUTPUT" \
      | sed '1d;$d' > "${REPORT_DIR}/bottlenecks.json" 2>/dev/null || true
    log SUCCESS "Bottleneck analysis extracted"
  fi

  if grep -q "KEY: optimization_recommendations" "$ANALYSIS_OUTPUT"; then
    sed -n '/KEY: optimization_recommendations/,/^$/p' "$ANALYSIS_OUTPUT" \
      | sed '1d;$d' > "${REPORT_DIR}/recommendations.json" 2>/dev/null || true
    log SUCCESS "Recommendations extracted"
  fi
else
  log WARN "Analysis had errors (see log)"
  cat "$ANALYSIS_OUTPUT" | tee -a "$BENCHMARK_LOG"
fi

rm -f "$ANALYSIS_OUTPUT"

# Step 4: Generate summary report
log INFO ""
log INFO "Step 4: Generating summary report..."

SUMMARY_REPORT="${REPORT_DIR}/SUMMARY.md"
cat > "$SUMMARY_REPORT" << 'EOF'
# Voice Provider Benchmark Summary

Generated: $(date)

## Benchmark Suite Results

### Files Generated
- `benchmark-standard.log` - Standard benchmark execution log
- `benchmark-docker.log` - Docker benchmark log (if --docker)
- `docker-report.json` - Docker performance report (if --docker)
- `analysis-output.txt` - Full analysis output
- `metrics.json` - Extracted performance metrics
- `bottlenecks.json` - Identified bottlenecks
- `recommendations.json` - Optimization recommendations

### Key Metrics

Run the following to view detailed metrics:

```bash
# View performance metrics
cat metrics.json | jq .

# View identified bottlenecks
cat bottlenecks.json | jq .

# View recommendations
cat recommendations.json | jq '.[] | {priority, category, recommendation}'
```

### Next Steps

1. Review identified bottlenecks
2. Apply optimization recommendations
3. Re-run benchmark to measure improvements
4. Store results in Claude Flow memory:

```bash
npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_perf_metrics" \
  --value "$(cat metrics.json)" \
  --namespace voice_benchmarks

npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_bottlenecks" \
  --value "$(cat bottlenecks.json)" \
  --namespace voice_benchmarks

npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_recommendations" \
  --value "$(cat recommendations.json)" \
  --namespace voice_benchmarks
```

### Report Location

All reports saved to: `${REPORT_DIR}`

EOF

log SUCCESS "Summary report generated: $SUMMARY_REPORT"

# Step 5: Store in memory if requested
if [[ "$STORE_MEMORY" == true ]]; then
  log INFO ""
  log INFO "Step 5: Storing results in Claude Flow memory..."

  # Store metrics
  if [[ -f "${REPORT_DIR}/metrics.json" ]]; then
    log INFO "Storing performance metrics..."
    METRICS_JSON=$(cat "${REPORT_DIR}/metrics.json" 2>/dev/null || echo "{}")
    if npx @claude-flow/cli@latest memory store \
      --key "voice_benchmark_metrics_$(date +%s)" \
      --value "$METRICS_JSON" \
      --namespace "voice_benchmarks" 2>/dev/null; then
      log SUCCESS "Performance metrics stored"
    else
      log WARN "Failed to store metrics (is claude-flow CLI installed?)"
    fi
  fi

  # Store bottlenecks
  if [[ -f "${REPORT_DIR}/bottlenecks.json" ]]; then
    log INFO "Storing bottleneck analysis..."
    BOTTLENECKS_JSON=$(cat "${REPORT_DIR}/bottlenecks.json" 2>/dev/null || echo "[]")
    if npx @claude-flow/cli@latest memory store \
      --key "voice_benchmark_bottlenecks_$(date +%s)" \
      --value "$BOTTLENECKS_JSON" \
      --namespace "voice_benchmarks" 2>/dev/null; then
      log SUCCESS "Bottleneck analysis stored"
    else
      log WARN "Failed to store bottlenecks"
    fi
  fi

  # Store recommendations
  if [[ -f "${REPORT_DIR}/recommendations.json" ]]; then
    log INFO "Storing optimization recommendations..."
    RECOMMENDATIONS_JSON=$(cat "${REPORT_DIR}/recommendations.json" 2>/dev/null || echo "[]")
    if npx @claude-flow/cli@latest memory store \
      --key "voice_benchmark_recommendations_$(date +%s)" \
      --value "$RECOMMENDATIONS_JSON" \
      --namespace "voice_benchmarks" 2>/dev/null; then
      log SUCCESS "Recommendations stored"
    else
      log WARN "Failed to store recommendations"
    fi
  fi
fi

# Step 6: Final summary
log INFO ""
log INFO "=== Benchmark Complete ==="
log SUCCESS "All reports saved to: $REPORT_DIR"
log INFO ""
log INFO "Generated files:"
ls -lh "$REPORT_DIR" | awk 'NR>1 {printf "  %s (%s)\n", $9, $5}'
log INFO ""
log SUCCESS "Next: Review SUMMARY.md for results and next steps"

# Display usage hints
cat << 'EOF'

Quick reference for reviewing results:

  View standard benchmark log:
    less <REPORT_DIR>/benchmark-standard.log

  View Docker benchmark results:
    less <REPORT_DIR>/docker-report.json

  View analysis output:
    less <REPORT_DIR>/analysis-output.txt

  View metrics summary:
    jq . <REPORT_DIR>/metrics.json

  View identified bottlenecks:
    jq . <REPORT_DIR>/bottlenecks.json | less

  View optimization recommendations:
    jq . <REPORT_DIR>/recommendations.json | less

EOF

exit 0
