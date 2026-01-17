import { StrykerOptions } from '@stryker-mutator/api/core';

const config: StrykerOptions = {
  testRunner: 'vitest',
  testRunnerNodeArgs: ['--no-warnings'],

  // Target files for mutation testing (voice provider tests)
  mutate: [
    'src/media/voice-providers/**/*.ts',
    'src/media/codecs/**/*.ts',
    'extensions/voice-call/src/**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
  ],

  // Test files to run mutations against
  files: [
    'src/media/voice-providers/**/*.test.ts',
    'src/media/codecs/**/*.test.ts',
    'extensions/voice-call/src/**/__tests__/**/*.test.ts',
  ],

  // Vitest configuration
  vitest: {
    configFile: 'vitest.config.ts',
  },

  // Mutation thresholds
  thresholds: {
    high: 80,   // Target: 80%+ mutations killed
    low: 70,    // Minimum: 70%+ mutations killed (FAIL below this)
    break: 60,  // CRITICAL: 60%+ (breaking point)
  },

  // Report settings
  reporters: ['html', 'json', 'progress'],

  // HTML report output
  htmlReporter: {
    baseDir: 'coverage/mutation',
  },

  // Performance
  timeoutMS: 5000,
  concurrency: 4,

  // Mutation operators to test
  mutator: {
    name: 'typescript',
    excludedMutations: [
      // Exclude mutations that don't make sense
      'BlockStatement',
      'DebuggerStatement',
    ],
  },

  // Ignore coverage analysis for these patterns
  ignoreStatic: true,

  // Log level
  logLevel: 'info',

  // Environment variables for tests
  enviromentVariables: {
    NODE_ENV: 'test',
    CLAWDBOT_TESTING: 'true',
  },
};

export default config;
