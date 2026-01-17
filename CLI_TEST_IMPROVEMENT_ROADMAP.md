# CLI Test Improvement Roadmap

## Phase 1: Foundation (Week 1) - Add Real CLI Tests

### Objectives
- Add e2e tests that invoke actual CLI binary
- Establish that CLI can be executed without errors
- Create infrastructure for other test types

### Deliverables
1. **E2E CLI Binary Tests** (`e2e.cli.real-binary.test.ts`)
   - Basic command execution (call, continue, speak, end)
   - Help text validation
   - JSON output format verification

2. **Test Infrastructure**
   - Helper functions for running CLI and capturing output
   - Mock provider setup for e2e tests
   - Temporary directory management

3. **Coverage Baseline**
   - Run `pnpm test:coverage` to establish metrics
   - Document baseline (likely 60-70%)
   - Set target: 80%+

### Success Criteria
- ✅ All basic CLI commands execute without error
- ✅ Help text is complete and contains docs link
- ✅ JSON output is valid and well-formed
- ✅ Exit codes correct (0 for success, 1 for error)

### Estimated Effort: 3-4 hours

---

## Phase 2: User Experience (Week 1-2) - Error Messages & Guidance

### Objectives
- Verify error messages guide users to solutions
- Ensure help text is complete
- Validate user receives actionable feedback

### Deliverables
1. **Error Message Tests** (`error-messages.test.ts`)
   - Missing OPENAI_API_KEY → shows "export OPENAI_API_KEY=..."
   - Invalid phone format → shows example
   - Missing provider → lists available providers
   - Network timeout → suggests retry

2. **Help Text Validation**
   - Every option documented with description
   - Examples in help text
   - Links to docs

3. **Error Recovery Paths**
   - No dead ends (every error shows a fix)
   - Consistent error format
   - Clear next steps

### Success Criteria
- ✅ No cryptic error codes (all errors are human-readable)
- ✅ Every error suggests a fix
- ✅ Help text complete for all commands
- ✅ Users can self-serve 90% of issues

### Estimated Effort: 4-5 hours

---

## Phase 3: Config & Options (Week 2) - Precedence & Parsing

### Objectives
- Verify CLI options are parsed correctly
- Ensure config precedence works (CLI > env > file)
- Validate all flag combinations

### Deliverables
1. **Config Precedence Tests** (`config-precedence.test.ts`)
   - CLI flag overrides env var
   - Env var overrides config file
   - Correct priority order
   - Multiple providers supported simultaneously

2. **CLI Option Parsing**
   - All flags parsed correctly
   - Invalid flag values rejected
   - Required options enforced
   - Optional options work

3. **Provider-Specific Validation**
   - Telnyx: API key format, connection ID required
   - Twilio: Account SID format, auth token length
   - Plivo: Auth ID and token validation

### Success Criteria
- ✅ CLI args override env vars (test verifies)
- ✅ Env vars override config file (test verifies)
- ✅ Config file used as fallback (test verifies)
- ✅ All flag combinations work
- ✅ Invalid options rejected with clear message

### Estimated Effort: 3-4 hours

---

## Phase 4: Interactive Flows (Week 2-3) - Onboarding UX

### Objectives
- Test interactive CLI prompts (not mocks)
- Ensure onboarding flow is intuitive
- Verify error recovery in interactive mode

### Deliverables
1. **Interactive Onboarding Tests** (`interactive.test.ts`)
   - Provider selection prompt
   - Credential entry and testing
   - Phone number entry with validation
   - Policy selection and allowlist entry
   - Configuration saving

2. **Error Recovery in Prompts**
   - Invalid input → re-prompt with example
   - Failed credential test → retry option
   - Network error → retry with backoff

3. **Progress Tracking**
   - Show "Step X of Y" during setup
   - Allow resuming from saved state
   - Skip optional steps

### Success Criteria
- ✅ All prompts are clear and unambiguous
- ✅ Invalid input shows helpful correction
- ✅ Failed credentials allow retry
- ✅ Onboarding can be resumed after exit
- ✅ Completion shows confirmation

### Estimated Effort: 4-5 hours

---

## Phase 5: Advanced Scenarios (Week 3) - Edge Cases

### Objectives
- Cover error scenarios and edge cases
- Test provider fallback and switching
- Verify concurrent call limits

### Deliverables
1. **Provider Fallback Tests**
   - Primary provider fails → try backup
   - Mid-call provider switch
   - Multiple provider credentials

2. **Rate Limiting & Throttling**
   - 429 responses → backoff + retry
   - Rate limit suggestions shown to user
   - Exponential backoff implemented

3. **Call Limits & Concurrency**
   - Concurrent call limit enforced
   - Clear message when limit reached
   - Queue mechanism (if available)

4. **Timeout & Recovery**
   - Connection timeout → "Check internet"
   - Webhook timeout → retry with backoff
   - Partial failures → clear state

### Success Criteria
- ✅ Provider fallback works seamlessly
- ✅ Rate limits handled gracefully
- ✅ Call limits enforced and communicated
- ✅ All timeouts have recovery paths

### Estimated Effort: 3-4 hours

---

## Phase 6: Integration & Coverage (Week 3-4)

### Objectives
- Reach 85%+ coverage on all metrics
- Set up mutation testing
- Integrate into CI/CD

### Deliverables
1. **Coverage Improvements**
   - Identify uncovered code paths
   - Add tests for branches
   - Reach 85%+ on lines, branches, functions, statements

2. **Mutation Testing Setup**
   - Install Stryker
   - Run mutation tests
   - Improve weak tests to reach 80%+ mutation score

3. **CI/CD Integration**
   - Add new tests to GitHub Actions
   - Fail pipeline if coverage drops
   - Generate coverage reports

4. **Documentation**
   - Document testing approach
   - Create test troubleshooting guide
   - Link from docs.clawd.bot

### Success Criteria
- ✅ 85%+ coverage on all metrics
- ✅ 80%+ mutation score
- ✅ Tests run in CI/CD
- ✅ Developers know how to run tests

### Estimated Effort: 3-4 hours

---

## Testing Metrics Timeline

```
WEEK 1                WEEK 2                WEEK 3
│                     │                     │
├─ Phase 1 Complete   ├─ Phase 2 Complete   ├─ Phase 4 Complete
│ (E2E CLI tests)     │ (Error messages)    │ (Interactive flows)
│ Baseline: 65%       │ Progress: 70%       │ Progress: 80%
│                     │                     │
├─ Phase 3 Start ─────┼─ Phase 3 Complete   ├─ Phase 5 Complete
│ (Config tests)      │ (Config precedence) │ (Advanced scenarios)
│                     │ Progress: 75%       │ Progress: 82%
│                     │                     │
│                     │                     ├─ Phase 6 Complete
│                     │                     │ (Coverage & mutation)
│                     │                     │ FINAL: 88%+
```

---

## Weekly Milestones

### Week 1
**Monday-Wednesday: E2E CLI Foundation**
- [ ] Add e2e.cli.real-binary.test.ts
- [ ] Implement basic command tests
- [ ] Verify --help output
- [ ] Coverage baseline (est. 65%)

**Wednesday-Friday: Error Messages**
- [ ] Add error-messages.test.ts
- [ ] Test all error paths
- [ ] Validate guidance is actionable
- [ ] Coverage: 70%

**Deliverable:** Basic e2e tests + error message validation

---

### Week 2
**Monday-Wednesday: Config Precedence**
- [ ] Add config-precedence.test.ts
- [ ] Test CLI > env > file ordering
- [ ] Test multiple providers
- [ ] Coverage: 75%

**Wednesday-Friday: Interactive Prompts**
- [ ] Add interactive.test.ts
- [ ] Test provider selection flow
- [ ] Test credential entry + validation
- [ ] Coverage: 78%

**Deliverable:** Config + interactive flow tests

---

### Week 3
**Monday-Wednesday: Advanced Scenarios**
- [ ] Add provider-fallback tests
- [ ] Test rate limiting behavior
- [ ] Test concurrent call limits
- [ ] Coverage: 82%

**Wednesday-Friday: Mutation & CI/CD**
- [ ] Set up Stryker for mutation testing
- [ ] Improve weak test assertions
- [ ] Integrate into GitHub Actions
- [ ] Final coverage: 85%+

**Deliverable:** Complete test suite + CI/CD integration

---

## Code Quality Checkpoints

### After Phase 1
```
✓ CLI can be invoked without errors
✓ Basic commands work
✓ Help text exists
× Comprehensive error coverage
× Config precedence verified
× Interactive flows tested
```

### After Phase 2
```
✓ CLI can be invoked without errors
✓ Basic commands work
✓ Help text exists
✓ Error messages are helpful
× Config precedence verified
× Interactive flows tested
```

### After Phase 3
```
✓ CLI can be invoked without errors
✓ Basic commands work
✓ Help text exists
✓ Error messages are helpful
✓ Config precedence verified
✓ Interactive flows tested (partially)
```

### After Phase 4
```
✓ CLI can be invoked without errors
✓ Basic commands work
✓ Help text exists
✓ Error messages are helpful
✓ Config precedence verified
✓ Interactive flows tested
× Advanced error scenarios
```

### After Phase 5-6 (COMPLETE)
```
✓ CLI can be invoked without errors
✓ Basic commands work
✓ Help text exists
✓ Error messages are helpful
✓ Config precedence verified
✓ Interactive flows tested
✓ Advanced error scenarios covered
✓ 85%+ coverage on all metrics
✓ 80%+ mutation score
✓ CI/CD integrated
```

---

## Resource Allocation

| Phase | Task | Hours | Person |
|-------|------|-------|--------|
| 1 | E2E CLI tests | 3-4 | Senior Dev |
| 2 | Error messages | 4-5 | Mid Dev |
| 3 | Config/Options | 3-4 | Mid Dev |
| 4 | Interactive flows | 4-5 | Senior Dev |
| 5 | Advanced scenarios | 3-4 | Mid Dev |
| 6 | Coverage/CI/CD | 3-4 | DevOps/Senior |
| **TOTAL** | | **20-26 hours** | |

---

## Success Criteria (Final)

When this roadmap is complete:

- ✅ CLI quality score: **8+/10** (up from 4.2/10)
- ✅ All CLI commands testable via e2e tests
- ✅ All error scenarios covered
- ✅ Error messages guide users to solutions
- ✅ Config precedence verified
- ✅ Interactive flows tested
- ✅ Coverage: **85%+** (all metrics)
- ✅ Mutation score: **80%+**
- ✅ CI/CD checks prevent regressions
- ✅ Zero false positives from tests

---

## Monitoring & Maintenance

After completion, maintain quality with:

1. **Quarterly Reviews**
   - Check coverage hasn't dropped
   - Review any new mutations
   - Update tests for new features

2. **New Feature Testing**
   - Add e2e tests for new commands
   - Add error message tests
   - Update config tests if precedence changes

3. **Regression Testing**
   - Run full suite before releases
   - Keep mutation score >80%
   - Monitor CI/CD health

---

## FAQ

**Q: Can we do all phases in parallel?**
A: Phases 1-3 can overlap (start Phase 2 while finishing Phase 1). Phases 4-6 depend on earlier phases, but Phase 5 can start during Phase 4.

**Q: What if coverage doesn't reach 85%?**
A: Analyze gap. Usually missing:
- Edge cases in error handling
- Rare code paths
- Provider-specific logic

**Q: Should we use real API keys in tests?**
A: No. Use test/mock credentials. LIVE=1 flag for integration tests only.

**Q: How to handle flaky interactive tests?**
A: Use deterministic inputs. Mock network delays. Add retry logic.

**Q: Can this work with CI/CD?**
A: Yes. All phases are CI/CD compatible. Start Phase 6 to integrate.

