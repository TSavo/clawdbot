# Voice Provider Benchmarking - Execution Guide

Complete step-by-step guide for running voice provider performance benchmarks in Docker containers.

## Quick Start

```bash
# Run all benchmarks with Docker support
./benchmarks/run-full-benchmark.sh --docker --memory

# Or run standard benchmarks only
./benchmarks/run-full-benchmark.sh
```

## Detailed Execution

### Phase 1: Standard Benchmarks

**What it measures:**
- Transcription latency (Whisper)
- TTS synthesis latency (Kokoro, Piper)
- Resource usage (CPU, memory, disk)
- Provider switching overhead
- Configuration impact

**Execution:**
```bash
bun benchmarks/voice-providers.benchmark.ts
```

**Output:**
- Console display of metrics
- Real-time performance statistics
- Bottleneck detection
- Optimization recommendations
- Data formatted for memory storage

**Expected Duration:** 2-5 minutes

**Sample Output:**
```
=== TRANSCRIPTION LATENCY BENCHMARKS

Benchmarking Whisper transcription latency (5 samples)...
  Sample 1: 450.23ms
  Sample 2: 425.67ms
  Sample 3: 480.15ms
  Sample 4: 455.89ms
  Sample 5: 440.34ms
Results: min=425.67ms, avg=450.46ms, max=480.15ms

=== TEXT-TO-SPEECH LATENCY BENCHMARKS

Benchmarking kokoro TTS latency (5 samples)...
  Sample 1: 210.45ms
  Sample 2: 195.23ms
  ...

=== RESOURCE USAGE MONITORING

Monitoring resource usage for 10s...
CPU: peak=85.23%, avg=67.45%
Memory: peak=850.12MB, avg=650.34MB
Disk: models=1400MB, total=1600MB
```

### Phase 2: Docker-Specific Benchmarks (Optional)

**Prerequisites:**
```bash
# Start Docker container
docker compose up -d clawdbot-gateway

# Verify container is running
docker ps | grep clawdbot-gateway
```

**What it measures:**
- Container-specific resource metrics
- Provider availability in Docker
- Model loading from container volumes
- Network latency for cloud providers
- Container memory constraints

**Execution:**
```bash
bun benchmarks/voice-docker.benchmark.ts
```

**Output:**
- Docker stats and metrics
- Container-specific latency measurements
- Volume mount performance impact
- Provider accessibility verification
- JSON report: `/tmp/voice-benchmark-report.json`

**Expected Duration:** 3-8 minutes

**Verifying Container Setup:**
```bash
# Check container resource allocation
docker inspect clawdbot-gateway | jq '.[] | {Memory, CpuPeriod, CpuQuota}'

# Check mounted volumes
docker inspect clawdbot-gateway | jq '.[] | .Mounts'

# Check installed providers
docker exec clawdbot-gateway python -m faster_whisper --help
docker exec clawdbot-gateway which kokoro
docker exec clawdbot-gateway which piper
```

### Phase 3: Analysis & Reporting

**Execution:**
```bash
bun benchmarks/voice-benchmark-results.ts
```

**Output:**
```
=== Voice Provider Benchmark Analysis ===

--- PERFORMANCE COMPARISON ---
Fastest Transcription: whisper (450.46ms avg)
Fastest Synthesis: piper (180.45ms avg)
Most Resource Efficient: piper (45% CPU, 400MB memory)
Fastest Switching: piper (20ms avg)

--- BOTTLENECKS ---
[WARNING] whisper: Transcription latency elevated (450.46ms > 1000ms threshold)
[INFO] kokoro: Large disk footprint (800MB > recommended 500MB)

--- OPTIMIZATION RECOMMENDATIONS ---

Priority 1: Provider Selection
  Recommendation: Prioritize piper as primary TTS provider
  Expected Improvement: Reduce average latency to 180ms

Priority 2: Docker Build
  Recommendation: Enable Docker layer caching for faster builds
  Expected Improvement: Reduce build time by 50-70%

--- CONFIGURATION INSIGHTS ---

Whisper Model Comparison:
  tiny:   150ms latency, 200MB memory, 65% quality
  base:   300ms latency, 400MB memory, 80% quality
  small:  600ms latency, 800MB memory, 90% quality
  medium: 1200ms latency, 1600MB memory, 95% quality

Kokoro Speed Impact:
  0.5x: 400ms latency, 85% naturalness
  1.0x: 200ms latency, 100% naturalness (baseline)
  2.0x: 100ms latency, 80% naturalness
```

**Output Files:**
```
/tmp/voice-benchmark-analysis.json  # Full analysis data
/tmp/voice-benchmark-report.md      # Markdown report
```

### Phase 4: Integrated Pipeline

**Run everything with one command:**
```bash
./benchmarks/run-full-benchmark.sh --docker --memory
```

**Options:**
- `--docker`: Include Docker-specific benchmarks
- `--memory`: Store results in Claude Flow memory
- Both: Full comprehensive benchmark with memory storage

**Output Structure:**
```
/tmp/voice-benchmarks-<timestamp>/
├── benchmark-standard.log          # Standard benchmark log
├── benchmark-docker.log            # Docker benchmark log
├── docker-report.json              # Docker performance report
├── analysis-output.txt             # Analysis results
├── metrics.json                    # Performance metrics
├── bottlenecks.json                # Bottleneck analysis
├── recommendations.json            # Optimization recommendations
└── SUMMARY.md                      # Executive summary
```

## Memory Storage

### Storing Results in Claude Flow

After benchmarks complete, store results for future reference:

```bash
# Store performance metrics
npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_metrics" \
  --value "$(cat /tmp/voice-benchmarks-*/metrics.json)" \
  --namespace voice_benchmarks

# Store bottleneck analysis
npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_bottlenecks" \
  --value "$(cat /tmp/voice-benchmarks-*/bottlenecks.json)" \
  --namespace voice_benchmarks

# Store optimization recommendations
npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_recommendations" \
  --value "$(cat /tmp/voice-benchmarks-*/recommendations.json)" \
  --namespace voice_benchmarks

# Store Docker report (if available)
npx @claude-flow/cli@latest memory store \
  --key "voice_benchmark_docker_report" \
  --value "$(cat /tmp/voice-benchmarks-*/docker-report.json)" \
  --namespace voice_benchmarks
```

### Retrieving Stored Results

```bash
# Get most recent metrics
npx @claude-flow/cli@latest memory search \
  --query "voice benchmark metrics" \
  --namespace voice_benchmarks

# Retrieve specific benchmark
npx @claude-flow/cli@latest memory retrieve \
  --key "voice_benchmark_metrics" \
  --namespace voice_benchmarks
```

## Performance Baselines

### Typical Results by Configuration

#### Minimal Setup (4GB RAM, 2-core CPU)
```
Whisper transcription:    600-800ms
Kokoro synthesis (1.0x):  300-400ms
Piper synthesis:          250-350ms
Provider switching:       30-50ms
Peak memory:              1200-1500MB
Peak CPU:                 80-95%
```

#### Standard Setup (8GB RAM, 4-core CPU)
```
Whisper transcription:    350-500ms
Kokoro synthesis (1.0x):  200-300ms
Piper synthesis:          150-250ms
Provider switching:       20-30ms
Peak memory:              800-1000MB
Peak CPU:                 60-80%
```

#### Optimal Setup (16GB RAM, 8-core GPU)
```
Whisper transcription:    100-200ms
Kokoro synthesis (1.0x):  50-100ms
Piper synthesis:          50-150ms
Provider switching:       10-15ms
Peak memory:              600-800MB
Peak CPU:                 40-60%
```

## Interpreting Results

### Latency Reports

**Good Performance:**
- Avg latency < 500ms
- p95 latency < 1000ms
- p99 latency < 2000ms
- StdDev < 10% of mean

**Acceptable Performance:**
- Avg latency < 1000ms
- p95 latency < 2000ms
- p99 latency < 5000ms
- StdDev < 25% of mean

**Poor Performance:**
- Avg latency > 1000ms
- p95 latency > 2000ms
- p99 latency > 5000ms
- StdDev > 50% of mean

### Resource Usage

**CPU Usage:**
- Peak < 70%: Excellent
- Peak 70-85%: Good
- Peak 85-95%: Acceptable
- Peak > 95%: Concerning (throttling possible)

**Memory Usage:**
- Peak < 512MB: Excellent
- Peak 512-1024MB: Good
- Peak 1024-2048MB: Acceptable
- Peak > 2048MB: Concerning (limits scaling)

**Disk Footprint:**
- < 2GB: Excellent
- 2-5GB: Good
- 5-10GB: Acceptable
- > 10GB: Consider optimization

## Troubleshooting

### Docker Container Not Running
```bash
# Start container
docker compose up -d clawdbot-gateway

# Check status
docker ps -a | grep clawdbot-gateway

# View logs
docker logs clawdbot-gateway
```

### High Latency Results
```bash
# Check container resource limits
docker stats clawdbot-gateway

# Check CPU throttling
docker exec clawdbot-gateway cat /sys/fs/cgroup/cpu/cpu.stat

# Monitor during benchmark
docker stats clawdbot-gateway --no-stream

# Check system load on host
top -n 1 | head -5
```

### Memory Issues
```bash
# Check container memory usage
docker inspect clawdbot-gateway | jq '.[] | .HostConfig | {Memory, MemorySwap}'

# Increase container memory if needed
docker-compose.yml: # Edit and change memory limit
  services:
    clawdbot-gateway:
      mem_limit: 4g  # Increase from current value
```

### Missing Provider Models
```bash
# Check for Whisper model
docker exec clawdbot-gateway python -c "import faster_whisper; m = faster_whisper.WhisperModel('base')"

# Check for Kokoro
docker exec clawdbot-gateway python -c "from kokoro import generate"

# Check for Piper
docker exec clawdbot-gateway piper --help

# Install if missing
docker exec clawdbot-gateway pip install faster-whisper kokoro piper-tts
```

## Advanced Scenarios

### Continuous Monitoring

Run benchmarks on a schedule:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/clawdbot && ./benchmarks/run-full-benchmark.sh --docker --memory >> /var/log/voice-benchmark.log 2>&1

# View recent results
tail -100 /var/log/voice-benchmark.log
```

### Comparative Benchmarking

Compare performance across different configurations:

```bash
# Benchmark with Whisper tiny
CONFIG=tiny bun benchmarks/voice-providers.benchmark.ts > results-tiny.json

# Benchmark with Whisper base
CONFIG=base bun benchmarks/voice-providers.benchmark.ts > results-base.json

# Compare
diff <(jq '.benchmarks.whisper.mean' results-tiny.json) \
     <(jq '.benchmarks.whisper.mean' results-base.json)
```

### Load Testing

Test providers under concurrent load:

```bash
# Run 10 concurrent transcription jobs
for i in {1..10}; do
  bun -e "
    const start = Date.now();
    // Simulate transcription
    await new Promise(r => setTimeout(r, Math.random() * 500 + 200));
    console.log('Job $i completed in ' + (Date.now() - start) + 'ms');
  " &
done
wait
```

## Performance Optimization Workflow

1. **Baseline Measurement**
   ```bash
   ./benchmarks/run-full-benchmark.sh --docker --memory
   ```
   Review initial performance and identified bottlenecks.

2. **Apply Optimizations**
   - Follow recommendations from analysis
   - Adjust Docker configuration
   - Optimize model selection
   - Enable GPU if available

3. **Re-measure**
   ```bash
   ./benchmarks/run-full-benchmark.sh --docker --memory
   ```
   Compare metrics against baseline.

4. **Iterate**
   - Identify remaining bottlenecks
   - Apply next priority optimizations
   - Continue until performance targets met

## Success Criteria

Benchmark execution successful when:

- ✓ All latency measurements complete
- ✓ Resource metrics collected
- ✓ No critical errors in logs
- ✓ Performance metrics within expected ranges
- ✓ Bottlenecks identified and documented
- ✓ Recommendations generated
- ✓ Results stored in memory (if --memory used)

## Next Steps After Benchmarking

1. **Review Results**
   - Check SUMMARY.md in report directory
   - Review identified bottlenecks
   - Read optimization recommendations

2. **Apply Optimizations**
   - Implement Priority 1 recommendations first
   - Test and measure impact
   - Document configuration changes

3. **Document Configuration**
   - Record optimal settings for your environment
   - Store in memory for future reference
   - Share findings with team

4. **Monitor Performance**
   - Schedule periodic re-benchmarking
   - Track performance over time
   - Alert on performance degradation

---

**Report Location:** `/tmp/voice-benchmarks-<timestamp>/`
**Memory Key Prefix:** `voice_benchmark_`
**Documentation:** `/home/tsavo/clawd/clawdbot/benchmarks/README.md`
