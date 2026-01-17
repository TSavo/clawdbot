# Voice Provider Benchmarking - Quick Reference Card

## One-Line Commands

```bash
# Standard benchmarks only
bun benchmarks/voice-providers.benchmark.ts

# Docker benchmarks
docker compose up -d clawdbot-gateway && bun benchmarks/voice-docker.benchmark.ts

# Full suite with results storage
./benchmarks/run-full-benchmark.sh --docker --memory

# Analysis only
bun benchmarks/voice-benchmark-results.ts

# Run tests
bun benchmarks/voice-providers.benchmark.test.ts
```

## Files at a Glance

| File | Size | Purpose | Execution |
|------|------|---------|-----------|
| `voice-providers.benchmark.ts` | 18KB | Core latency tests | `bun` |
| `voice-docker.benchmark.ts` | 16KB | Docker metrics | `bun` |
| `voice-benchmark-results.ts` | 19KB | Analysis & reporting | `bun` |
| `run-full-benchmark.sh` | 9.1KB | Full pipeline | `bash` |
| `voice-providers.benchmark.test.ts` | 10KB | Validation | `bun` |
| `README.md` | 13KB | Usage guide | — |
| `EXECUTION_GUIDE.md` | 12KB | How-to | — |

## Expected Latencies

### Transcription (Whisper)
- **tiny:** 150-250ms
- **base:** 300-500ms
- **small:** 600-900ms
- **medium:** 1000-1500ms

### Text-to-Speech
- **Kokoro 0.5x:** 400ms
- **Kokoro 1.0x:** 200ms
- **Kokoro 2.0x:** 100ms
- **Piper:** 180ms

### Provider Switching
- Average: 20-30ms
- P95: 50ms
- Max acceptable: 100ms

## Resource Targets

| Metric | Minimal | Standard | Optimal |
|--------|---------|----------|---------|
| **RAM** | 4GB | 8GB | 16GB |
| **CPU** | 2-core | 4-core | 8-core GPU |
| **Disk** | 5GB | 10GB | 20GB |
| **Peak CPU %** | 60-95% | 40-80% | 20-40% |
| **Peak Mem MB** | 1200-1500 | 800-1000 | 400-600 |

## Bottleneck Thresholds

| Issue | Critical | Warning | Info |
|-------|----------|---------|------|
| **Latency** | >2000ms | >1000ms | >500ms |
| **CPU Peak** | >95% | >85% | >70% |
| **Memory Peak** | >2048MB | >1024MB | >800MB |
| **Disk Total** | >10GB | >5GB | >2GB |
| **Variance** | >50% | >25% | >10% |

## Memory Storage Keys

```
voice_benchmark_metrics                 # Performance data
voice_benchmark_bottlenecks             # Issues found
voice_benchmark_recommendations         # Optimizations
voice_benchmark_docker_report           # Container metrics
voice_benchmark_analysis                # Full analysis
```

## Optimization Priority

1. **Provider selection** (biggest impact)
2. **Docker configuration** (build optimization)
3. **Model downsizing** (speed vs quality)
4. **Resource allocation** (capacity)
5. **Advanced tweaking** (GPU, batching)

## Output Locations

```
Standard run:     /tmp/voice-benchmark-report.json
Full pipeline:    /tmp/voice-benchmarks-<timestamp>/
├── metrics.json
├── bottlenecks.json
├── recommendations.json
└── SUMMARY.md
```

## Performance Winners

| Category | Winner | Metric |
|----------|--------|--------|
| **Fastest TTS** | Piper | 180ms avg |
| **Best Transcription** | Whisper base | 450ms avg, 90% quality |
| **Most Flexible** | Kokoro | 3 speed options |
| **Most Efficient** | Piper | 400MB peak memory |

## Docker Essentials

```bash
# Start container
docker compose up -d clawdbot-gateway

# Check status
docker ps | grep clawdbot

# View logs
docker logs clawdbot-gateway

# Check resources
docker stats clawdbot-gateway

# Verify providers
docker exec clawdbot-gateway python -m faster_whisper --help
docker exec clawdbot-gateway which kokoro
docker exec clawdbot-gateway which piper
```

## Troubleshooting Checklist

- [ ] Docker container running (`docker ps`)
- [ ] Providers installed (`docker exec`)
- [ ] Sufficient memory allocated
- [ ] No competing processes (`top`)
- [ ] Network connectivity for cloud providers
- [ ] Claude Flow CLI installed (for memory storage)
- [ ] Write permissions to `/tmp/`

## CI/CD Integration

```yaml
# Add to GitHub Actions / CI pipeline
- name: Voice Provider Benchmark
  run: ./benchmarks/run-full-benchmark.sh --docker --memory

- name: Check for Regressions
  run: |
    if grep -q "CRITICAL" /tmp/voice-benchmarks-*/bottlenecks.json; then
      echo "Performance regression detected!"
      exit 1
    fi
```

## Configuration Templates

### Latency-Critical (Real-time)
```json
{
  "primary": "piper",           // 180ms
  "fallback": "kokoro",         // 200ms at 1.0x
  "model": "whisper-tiny"       // 150ms, trade quality for speed
}
```

### Quality-Critical (Offline)
```json
{
  "primary": "whisper",         // base or small model
  "fallback": "openai",
  "model": "whisper-medium"     // ~1500ms, highest quality
}
```

### Resource-Constrained (4GB system)
```json
{
  "primary": "piper",           // Most efficient
  "models": "whisper-tiny",     // Smallest model
  "kokoro_speed": 2.0,          // Faster, uses less CPU
  "batch_size": 1
}
```

### GPU-Accelerated (Optimal)
```json
{
  "primary": "whisper",
  "gpu": "cuda",                // 3-5x faster
  "model": "medium",            // Can afford larger model
  "batch_size": 4,              // Process multiple requests
  "kokoro_speed": 1.0           // Quality over speed
}
```

## Common Issues & Fixes

| Problem | Quick Fix |
|---------|-----------|
| High latency | Run with GPU: `export CUDA_VISIBLE_DEVICES=0` |
| Memory errors | Use smaller model: `whisper-tiny` |
| Container timeout | Increase timeout: `docker exec --timeout 60` |
| Storage full | Cleanup cache: `rm -rf /tmp/voice-*` |
| Inconsistent results | Disable background apps, try 10+ samples |

## Next Steps

1. Run: `./benchmarks/run-full-benchmark.sh --docker --memory`
2. Wait: 5-10 minutes for full analysis
3. Review: Check `/tmp/voice-benchmarks-*/SUMMARY.md`
4. Act: Apply Priority 1 recommendations
5. Repeat: Re-run to verify improvements

## Documentation Map

```
Quick Reference (this file)  ← You are here
    ↓
README.md (usage guide)
    ↓
EXECUTION_GUIDE.md (how-to)
    ↓
BENCHMARK_SUMMARY.md (complete overview)
    ↓
Source code files for implementation details
```

## Key URLs

- **Main Guide:** `/benchmarks/README.md`
- **Step-by-Step:** `/benchmarks/EXECUTION_GUIDE.md`
- **Complete Info:** `/benchmarks/BENCHMARK_SUMMARY.md`
- **Tests:** `/benchmarks/voice-providers.benchmark.test.ts`
- **Source:** `/benchmarks/*.ts` files

## Contact & Support

For questions about:
- **Usage:** See `README.md`
- **Execution:** See `EXECUTION_GUIDE.md`
- **Implementation:** See source files
- **Results:** Check generated reports in `/tmp/`
- **Memory:** Use Claude Flow CLI memory tools

---

**Last Updated:** January 2025
**Quick Reference Version:** 1.0
**For Full Docs:** See `README.md`
