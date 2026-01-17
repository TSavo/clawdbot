import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration for Voice Provider Tests
 *
 * Configures test runner for unit, integration, and E2E tests
 * across STT and TTS providers in all deployment modes.
 */

export default defineConfig({
  test: {
    // Test discovery
    globals: true,
    environment: 'node',
    include: [
      'src/tests/**/*.test.ts',
      'src/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/index.ts',
        'src/test-utils/**'
      ]
    },

    // Timeout configuration
    testTimeout: 10000, // 10s for most tests
    hookTimeout: 10000,

    // Setup files
    setupFiles: [],

    // Reporter configuration
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json'
    },

    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // Parallel execution
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Bail configuration
    bail: 0, // Don't bail on first failure

    // Watch mode configuration
    watch: false,

    // Isolate test environment
    isolate: true,
  },
});

/**
 * Test Suites
 *
 * Unit Tests:
 * - STT Provider unit tests
 * - TTS Provider unit tests
 * - Configuration validation
 * - Error handling
 *
 * Integration Tests:
 * - System mode integration
 * - Docker mode integration
 * - Cloud mode integration
 * - Mode compatibility
 *
 * E2E Tests:
 * - Provider workflows
 * - Fallback chain behavior
 * - Performance benchmarks
 * - Multi-provider operations
 */

/**
 * Coverage Thresholds
 *
 * - Lines: >85%      (critical paths covered)
 * - Functions: >85%  (all methods tested)
 * - Branches: >80%   (conditional paths tested)
 * - Statements: >85% (code execution coverage)
 */

/**
 * Running Tests
 *
 * All tests:
 *   vitest run
 *
 * Unit tests only:
 *   vitest run src/tests/unit
 *
 * Integration tests only:
 *   vitest run src/tests/integration
 *
 * E2E tests only:
 *   vitest run src/tests/e2e
 *
 * Watch mode:
 *   vitest watch
 *
 * With coverage:
 *   vitest run --coverage
 *
 * Specific test:
 *   vitest run --grep "test name"
 */

/**
 * Test Environment
 *
 * All tests run in Node environment
 * Supports:
 * - Async/await
 * - Promises
 * - Streams
 * - Buffer operations
 * - File system (mocked)
 * - Network (mocked)
 */
