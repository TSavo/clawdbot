# CLI Test Coverage Recommendations - Specific Test Cases

## Recommended Test Cases by Priority

### TIER 1: Critical Path (Must Have E2E)

#### Test Suite: Real CLI Binary Invocation
**File:** `extensions/voice-call/src/__tests__/e2e.cli.real-binary.test.ts`

```typescript
import { execSync } from "node:child_process";
import { describe, it, expect, beforeEach } from "vitest";

describe("Voice CLI - Real Binary E2E", () => {
  describe("clawdbot voicecall call", () => {
    it("should initiate call with valid config and message", () => {
      // CRITICAL: Tests actual CLI binary, not mock
      const cmd = 'clawdbot voicecall call --message "hello" --to "+15550000000"';
      const result = execSync(cmd, { encoding: "utf8" });
      const output = JSON.parse(result);

      expect(output).toHaveProperty("callId");
      expect(output.callId).toMatch(/^[a-f0-9-]{32,}$/);
    });

    it("should exit with error if --message is missing", () => {
      const cmd = 'clawdbot voicecall call --to "+15550000000"';
      expect(() => execSync(cmd)).toThrow();
      // Verify error message contains helpful text
    });

    it("should show usage hint on missing required option", () => {
      try {
        execSync('clawdbot voicecall call --to "+15550000000"', {
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (e: any) {
        expect(e.stderr || e.message).toContain("--message");
        expect(e.stderr || e.message).toContain("required");
      }
    });

    it("should validate phone number format in CLI", () => {
      // Invalid format: missing +
      expect(() =>
        execSync('clawdbot voicecall call --message "hi" --to "15550000000"')
      ).toThrow();
    });

    it("should output valid JSON with call result", () => {
      const result = execSync(
        'clawdbot voicecall call --message "test" --to "+15550000000"',
        { encoding: "utf8" }
      );
      // Should not throw when parsing JSON
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("callId");
    });
  });

  describe("clawdbot voicecall --help", () => {
    it("should display help text with all commands", () => {
      const result = execSync("clawdbot voicecall --help", {
        encoding: "utf8",
      });
      expect(result).toContain("call");
      expect(result).toContain("continue");
      expect(result).toContain("speak");
      expect(result).toContain("end");
    });

    it("should show help for subcommand", () => {
      const result = execSync("clawdbot voicecall call --help", {
        encoding: "utf8",
      });
      expect(result).toContain("--message");
      expect(result).toContain("--to");
      expect(result).toContain("--mode");
    });

    it("should include docs link in help", () => {
      const result = execSync("clawdbot voicecall --help", {
        encoding: "utf8",
      });
      expect(result).toContain("docs.clawd.bot");
    });
  });
});
```

**Why Critical:**
- CLI could have import errors → tests wouldn't catch with mocks
- Commander.js wiring could be broken → mocks hide this
- Help text could be missing or outdated → never checked

---

### TIER 2: Config Precedence (User Confusion Point)

**File:** `extensions/voice-call/src/__tests__/config-precedence.test.ts`

```typescript
import { execSync } from "node:child_process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

describe("Config Precedence: CLI args > env vars > file", () => {
  let tmpDir: string;
  let configFile: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `voice-config-test-${Date.now()}`);
    configFile = path.join(tmpDir, "config.json");
    fs.mkdirSync(tmpDir, { recursive: true });

    process.env.HOME = tmpDir;
    process.env.CLAWDBOT_CONFIG_DIR = tmpDir;
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("should use CLI --provider flag over config file", () => {
    // Write config file with provider: telnyx
    fs.writeFileSync(
      configFile,
      JSON.stringify({ provider: "telnyx", fromNumber: "+15550000000" })
    );

    // Run CLI with --provider twilio
    const result = execSync(
      'clawdbot voicecall status --provider twilio --json',
      { encoding: "utf8", env: { ...process.env, HOME: tmpDir } }
    );
    const status = JSON.parse(result);

    // Should show twilio, not telnyx from config
    expect(status.provider).toBe("twilio");
  });

  it("should use env var VOICE_PROVIDER if CLI flag not set", () => {
    // Write config file with provider: telnyx
    fs.writeFileSync(
      configFile,
      JSON.stringify({ provider: "telnyx", fromNumber: "+15550000000" })
    );

    // Set env var
    const result = execSync(
      'clawdbot voicecall status --json',
      {
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: tmpDir,
          VOICE_PROVIDER: "plivo",
        },
      }
    );
    const status = JSON.parse(result);

    // Should show plivo from env var, not telnyx from file
    expect(status.provider).toBe("plivo");
  });

  it("should use config file if neither CLI flag nor env var set", () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ provider: "telnyx", fromNumber: "+15550000000" })
    );

    const result = execSync('clawdbot voicecall status --json', {
      encoding: "utf8",
      env: { ...process.env, HOME: tmpDir },
    });
    const status = JSON.parse(result);

    expect(status.provider).toBe("telnyx");
  });

  it("should prioritize: CLI flag > env var > config file", () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ provider: "telnyx" })
    );

    // All three set to different values
    const result = execSync(
      'clawdbot voicecall status --provider twilio --json',
      {
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: tmpDir,
          VOICE_PROVIDER: "plivo",
        },
      }
    );
    const status = JSON.parse(result);

    // Should use CLI flag (twilio), not env (plivo) or config (telnyx)
    expect(status.provider).toBe("twilio");
  });
});
```

**Why Important:**
- Users often set env vars and expect them to work
- CLI flags should always win (principal of least surprise)
- Common source of "why isn't my setting working?" issues

---

### TIER 3: Error Messages & User Guidance

**File:** `extensions/voice-call/src/__tests__/error-messages.test.ts`

```typescript
import { execSync } from "node:child_process";
import { describe, it, expect } from "vitest";

describe("Error Messages - User Guidance", () => {
  describe("Missing credentials errors", () => {
    it("should show actionable error when OPENAI_API_KEY missing", () => {
      delete process.env.OPENAI_API_KEY;

      try {
        execSync('clawdbot voicecall call --message "hi" --to "+15550000000"', {
          stdio: "pipe",
        });
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        // STRONG: Provide actionable guidance
        expect(stderr).toContain("OPENAI_API_KEY");
        expect(stderr).toContain("export OPENAI_API_KEY=");
        expect(stderr).not.toMatch(/Error:\s+Error:/); // No double errors
      }
    });

    it("should show which provider credential is missing", () => {
      try {
        execSync(
          'clawdbot voicecall configure --provider telnyx --no-api-key',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        expect(stderr).toContain("telnyx");
        expect(stderr).toContain("API Key");
        expect(stderr).toContain("connectionId");
      }
    });
  });

  describe("Invalid input errors", () => {
    it("should reject invalid phone format with helpful message", () => {
      try {
        execSync(
          'clawdbot voicecall call --message "hi" --to "not-a-number"',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        expect(stderr).toContain("Invalid phone format");
        expect(stderr).toContain("E.164"); // Specify the format required
        expect(stderr).toContain("+1"); // Show example
      }
    });

    it("should reject invalid mode with suggestions", () => {
      try {
        execSync(
          'clawdbot voicecall call --message "hi" --to "+15550000000" --mode invalid',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        expect(stderr).toContain("--mode");
        expect(stderr).toContain("notify");
        expect(stderr).toContain("conversation");
      }
    });
  });

  describe("Network/timeout errors", () => {
    it("should show helpful message on connection timeout", () => {
      // This test would need a way to simulate timeout
      // Assuming there's a --timeout flag or test mode

      try {
        execSync(
          'clawdbot voicecall call --message "hi" --to "+15550000000" --timeout 100',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        expect(stderr).toContain("timeout");
        expect(stderr).toContain("internet");
        expect(stderr).toContain("retry");
      }
    });

    it("should suggest retry on rate limiting (429)", () => {
      // Assuming provider mock can simulate 429
      try {
        execSync(
          'clawdbot voicecall call --message "hi" --to "+15550000000" --simulate-rate-limit',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        expect(stderr).toContain("Rate limit");
        expect(stderr).toContain("wait");
        expect(stderr).toContain("retry");
      }
    });
  });

  describe("Helpful suggestions", () => {
    it("should suggest fix for common issues", () => {
      try {
        execSync(
          'clawdbot voicecall call --message "hi" --to "+15550000000"',
          { stdio: "pipe" }
        );
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;

        // Should guide user on next steps
        if (stderr.includes("API key")) {
          expect(stderr).toContain("Set it with:");
        }
        if (stderr.includes("credentials")) {
          expect(stderr).toContain("Run: clawdbot voicecall configure");
        }
      }
    });
  });
});
```

**Why Important:**
- First impression users get when something goes wrong
- Directly impacts user satisfaction and time-to-resolution
- Often reveals UX issues only apparent in error scenarios

---

### TIER 4: Interactive Flow Testing

**File:** `extensions/voice-call/src/__tests__/interactive.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { spawn } from "node:child_process";

async function runInteractive(inputs: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn("clawdbot", ["voicecall", "configure", "--interactive"]);
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });

    // Send inputs
    for (const input of inputs) {
      proc.stdin?.write(input + "\n");
    }
    proc.stdin?.end();
  });
}

describe("Interactive Onboarding Flow", () => {
  it("should prompt for provider selection", async () => {
    const result = await runInteractive(["telnyx"]); // Select Telnyx

    expect(result.stdout).toContain("Select provider:");
    expect(result.stdout).toContain("telnyx");
    expect(result.stdout).toContain("twilio");
    expect(result.stdout).toContain("plivo");
  });

  it("should prompt for API credentials after provider selection", async () => {
    const result = await runInteractive(["telnyx", "sk-test-key", "conn-123"]);

    expect(result.stdout).toContain("API Key:");
    expect(result.stdout).toContain("Connection ID:");
  });

  it("should test credentials before accepting", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
    ]);

    expect(result.stdout).toContain("Testing credentials");
    expect(result.stdout).toMatch(/✓|✗|Success|Failed/);
  });

  it("should allow user to retry with different credentials on failure", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-invalid-key", // First attempt fails
      "y", // Retry
      "sk-valid-key", // Second attempt succeeds
      "conn-123",
    ]);

    expect(result.stdout).toContain("Testing credentials");
    expect(result.stdout).toContain("Try again");
  });

  it("should prompt for phone numbers", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
      "+15550000000", // from number
      "+15550000001", // to number
    ]);

    expect(result.stdout).toContain("From number");
    expect(result.stdout).toContain("To number");
  });

  it("should validate phone number format during prompt", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
      "15550000000", // Missing + (invalid)
    ]);

    expect(result.stdout).toContain("Invalid format");
    expect(result.stdout).toContain("E.164");
  });

  it("should save configuration after completing all steps", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
      "+15550000000",
      "+15550000001",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Configuration saved");
  });

  it("should show progress during onboarding", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
      "+15550000000",
      "+15550000001",
    ]);

    // Should indicate progress (e.g., "Step 1 of 5")
    expect(result.stdout).toMatch(/step|progress|Step/i);
  });

  it("should allow user to skip optional steps", async () => {
    const result = await runInteractive([
      "telnyx",
      "sk-test-key",
      "conn-123",
      "+15550000000",
      "+15550000001",
      "n", // Skip advanced settings
    ]);

    expect(result.exitCode).toBe(0);
  });
});
```

**Why Important:**
- Interactive flows are where UX is most visible
- Users spend most time during onboarding
- Confusing prompts lead to setup failures

---

### TIER 5: Provider-Specific Testing

**File:** `extensions/voice-call/src/__tests__/provider-validation.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";

describe("Provider-Specific Validation", () => {
  describe("Telnyx Configuration", () => {
    it("should validate Telnyx API key format", () => {
      expect(() =>
        execSync(
          'clawdbot voicecall configure --provider telnyx --telnyx-api-key "short"'
        )
      ).toThrow();
      // Telnyx keys are typically 20+ characters
    });

    it("should require connection ID for Telnyx", () => {
      expect(() =>
        execSync(
          'clawdbot voicecall configure --provider telnyx --telnyx-api-key "valid-key" --no-connection-id'
        )
      ).toThrow();
    });

    it("should test Telnyx credentials before saving", () => {
      // Should reach out to Telnyx API to verify
      const result = execSync(
        'clawdbot voicecall configure --provider telnyx --test',
        { encoding: "utf8" }
      );
      expect(result).toContain("Testing");
    });
  });

  describe("Twilio Configuration", () => {
    it("should validate Twilio Account SID format", () => {
      expect(() =>
        execSync(
          'clawdbot voicecall configure --provider twilio --twilio-account-sid "invalid"'
        )
      ).toThrow();
      // Twilio SIDs start with AC and are 34 chars
    });

    it("should validate Twilio Auth Token length", () => {
      expect(() =>
        execSync(
          'clawdbot voicecall configure --provider twilio --twilio-account-sid "ACvalid" --twilio-auth-token "short"'
        )
      ).toThrow();
    });
  });

  describe("Provider Fallback", () => {
    it("should allow multiple provider credentials simultaneously", () => {
      const config = execSync(
        'clawdbot voicecall configure --provider telnyx --add-provider twilio --json',
        { encoding: "utf8" }
      );
      const parsed = JSON.parse(config);

      expect(parsed.telnyx).toBeDefined();
      expect(parsed.twilio).toBeDefined();
    });

    it("should allow switching active provider", () => {
      execSync('clawdbot voicecall configure --provider telnyx');
      const result = execSync('clawdbot voicecall status --json', {
        encoding: "utf8",
      });
      const status = JSON.parse(result);

      expect(status.activeProvider).toBe("telnyx");

      execSync('clawdbot voicecall configure --provider twilio');
      const result2 = execSync('clawdbot voicecall status --json', {
        encoding: "utf8",
      });
      const status2 = JSON.parse(result2);

      expect(status2.activeProvider).toBe("twilio");
    });
  });
});
```

---

## Test Execution & Validation

### Run New Test Suites
```bash
# E2E binary tests (catches CLI breakage)
pnpm test e2e.cli.real-binary.test.ts

# Config precedence (catches env var/flag override issues)
pnpm test config-precedence.test.ts

# Error message quality (catches unhelpful errors)
pnpm test error-messages.test.ts

# Interactive flow (catches UX issues)
pnpm test interactive.test.ts

# Provider validation (catches config issues)
pnpm test provider-validation.test.ts

# Run all voice tests with coverage
pnpm test:coverage extensions/voice-call
```

### Coverage Goals
- **Statements:** 90%+ (current: likely 70%)
- **Branches:** 85%+ (current: likely 60%)
- **Functions:** 90%+ (current: likely 75%)
- **Lines:** 90%+ (current: likely 70%)

### Mutation Testing (Verify Tests Are Real)
```bash
# Install stryker for mutation testing
pnpm add -D @stryker-mutator/core @stryker-mutator/typescript-checker

# Run mutation tests
stryker run extensions/voice-call/src/cli.ts
```

If mutation score is below 80%, tests are not properly validating behavior.

---

## Integration with CI/CD

### GitHub Actions Workflow Enhancement
```yaml
- name: Run CLI E2E Tests
  run: pnpm test e2e.cli.real-binary.test.ts

- name: Run Config Precedence Tests
  run: pnpm test config-precedence.test.ts

- name: Verify Error Messages
  run: pnpm test error-messages.test.ts

- name: Check Coverage
  run: pnpm test:coverage extensions/voice-call

- name: Coverage Report
  if: failure()
  uses: codecov/codecov-action@v3
```

---

## Success Criteria

Test quality is adequate when:

1. ✅ All CLI commands can be invoked and produce expected output
2. ✅ Help text is complete and accurate
3. ✅ Error messages guide users to solutions
4. ✅ Config precedence works as expected
5. ✅ Interactive flows are intuitive and safe to use
6. ✅ Coverage >85% on all metrics
7. ✅ Mutation score >80% (tests catch bugs)
8. ✅ No test passes when implementation is broken

