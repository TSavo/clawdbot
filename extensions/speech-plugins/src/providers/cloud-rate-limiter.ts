/**
 * Cloud Rate Limiter
 *
 * Manages API rate limits and quota for cloud providers.
 *
 * Features:
 * - Token bucket algorithm for rate limiting
 * - Per-provider quota tracking
 * - Automatic quota reset
 * - Backoff strategy
 * - Cost-aware rate limiting
 */

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  maxConcurrent?: number;
  costWeighting?: Record<string, number>; // Cost per operation type
}

export interface RateLimitStatus {
  provider: string;
  remainingRequests: number;
  remainingQuota: number;
  resetAt: Date;
  isLimited: boolean;
}

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private lastRefillTime: number;

  constructor(capacity: number, refillRate: number) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefillTime) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Check if tokens are available
   */
  available(count: number = 1): boolean {
    this.refill();
    return this.tokens >= count;
  }

  /**
   * Consume tokens
   */
  consume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Get time until tokens available
   */
  getWaitTime(count: number = 1): number {
    this.refill();

    if (this.tokens >= count) {
      return 0;
    }

    const needed = count - this.tokens;
    return (needed / this.refillRate) * 1000; // milliseconds
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Quota tracker for hourly/daily limits
 */
class QuotaTracker {
  private requestCount: number = 0;
  private requestCost: number = 0;
  private resetTime: number;
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxCost: number;

  constructor(maxRequests: number, maxCost: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.maxCost = maxCost;
    this.windowMs = windowMs;
    this.resetTime = Date.now() + windowMs;
  }

  /**
   * Check if quota window has expired
   */
  private checkReset(): void {
    if (Date.now() >= this.resetTime) {
      this.requestCount = 0;
      this.requestCost = 0;
      this.resetTime = Date.now() + this.windowMs;
    }
  }

  /**
   * Check if quota allows request
   */
  canMakeRequest(cost: number = 1): boolean {
    this.checkReset();
    return (
      this.requestCount < this.maxRequests &&
      this.requestCost + cost <= this.maxCost
    );
  }

  /**
   * Record a request
   */
  recordRequest(cost: number = 1): void {
    this.checkReset();
    this.requestCount += 1;
    this.requestCost += cost;
  }

  /**
   * Get time until quota reset
   */
  getTimeToReset(): number {
    this.checkReset();
    return Math.max(0, this.resetTime - Date.now());
  }

  /**
   * Get quota status
   */
  getStatus(): { requests: number; cost: number; resetAt: Date } {
    this.checkReset();
    return {
      requests: this.maxRequests - this.requestCount,
      cost: this.maxCost - this.requestCost,
      resetAt: new Date(this.resetTime),
    };
  }
}

/**
 * Cloud Rate Limiter
 *
 * Manages rate limiting and quota tracking for cloud providers.
 */
export class CloudRateLimiter {
  private tokenBuckets: Map<string, TokenBucket> = new Map();
  private quotaTrackers: Map<string, QuotaTracker[]> = new Map();
  private concurrentRequests: Map<string, number> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private costWeights: Map<string, Record<string, number>> = new Map();

  /**
   * Register a provider with rate limit config
   */
  registerProvider(provider: string, config: RateLimitConfig): void {
    this.configs.set(provider, config);

    // Create token bucket for requests per second
    const refillRate = config.requestsPerSecond;
    const capacity = Math.max(refillRate, 10); // At least 10 requests capacity
    const bucket = new TokenBucket(capacity, refillRate);
    this.tokenBuckets.set(provider, bucket);

    // Create quota trackers
    const trackers: QuotaTracker[] = [];

    // Minute quota (60 seconds)
    if (config.requestsPerMinute > 0) {
      trackers.push(new QuotaTracker(config.requestsPerMinute, config.requestsPerMinute, 60000));
    }

    // Hour quota (3600 seconds)
    if (config.requestsPerHour > 0) {
      trackers.push(new QuotaTracker(config.requestsPerHour, config.requestsPerHour, 3600000));
    }

    this.quotaTrackers.set(provider, trackers);
    this.concurrentRequests.set(provider, 0);
    this.costWeights.set(provider, config.costWeighting || {});
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(provider: string, operationType?: string): {
    allowed: boolean;
    reason?: string;
    waitMs?: number;
  } {
    const config = this.configs.get(provider);
    if (!config) {
      return { allowed: false, reason: `Provider ${provider} not registered` };
    }

    const cost = this.getCost(provider, operationType);

    // Check token bucket (per-second)
    const bucket = this.tokenBuckets.get(provider);
    if (bucket && !bucket.available(cost)) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per-second)',
        waitMs: bucket.getWaitTime(cost),
      };
    }

    // Check quota trackers (per-minute, per-hour)
    const trackers = this.quotaTrackers.get(provider) || [];
    for (const tracker of trackers) {
      if (!tracker.canMakeRequest(cost)) {
        return {
          allowed: false,
          reason: 'Quota limit exceeded',
          waitMs: tracker.getTimeToReset(),
        };
      }
    }

    // Check concurrent request limit
    if (config.maxConcurrent) {
      const current = this.concurrentRequests.get(provider) || 0;
      if (current >= config.maxConcurrent) {
        return {
          allowed: false,
          reason: 'Max concurrent requests exceeded',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a request (call after making the request)
   */
  recordRequest(provider: string, operationType?: string): void {
    const cost = this.getCost(provider, operationType);

    // Record to token bucket
    const bucket = this.tokenBuckets.get(provider);
    if (bucket) {
      bucket.consume(cost);
    }

    // Record to quota trackers
    const trackers = this.quotaTrackers.get(provider) || [];
    for (const tracker of trackers) {
      tracker.recordRequest(cost);
    }
  }

  /**
   * Mark concurrent request started
   */
  startRequest(provider: string): void {
    const current = this.concurrentRequests.get(provider) || 0;
    this.concurrentRequests.set(provider, current + 1);
  }

  /**
   * Mark concurrent request finished
   */
  endRequest(provider: string): void {
    const current = this.concurrentRequests.get(provider) || 0;
    this.concurrentRequests.set(provider, Math.max(0, current - 1));
  }

  /**
   * Get cost of operation (with weighting)
   */
  private getCost(provider: string, operationType?: string): number {
    if (!operationType) {
      return 1;
    }

    const weights = this.costWeights.get(provider);
    return weights?.[operationType] || 1;
  }

  /**
   * Wait until request is allowed
   */
  async waitForAvailability(provider: string, operationType?: string): Promise<void> {
    let waitAttempts = 0;
    const maxAttempts = 60; // Max 60 seconds

    while (waitAttempts < maxAttempts) {
      const result = this.canMakeRequest(provider, operationType);

      if (result.allowed) {
        return;
      }

      const waitMs = result.waitMs || 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 1000)));
      waitAttempts += 1;
    }

    throw new Error(
      `Rate limit exceeded for ${provider}. Max wait time exceeded.`,
    );
  }

  /**
   * Get rate limit status
   */
  getStatus(provider: string): RateLimitStatus {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not registered`);
    }

    const bucket = this.tokenBuckets.get(provider);
    const trackers = this.quotaTrackers.get(provider) || [];
    const status = trackers[0]?.getStatus() || {
      requests: config.requestsPerMinute,
      cost: config.requestsPerMinute,
      resetAt: new Date(Date.now() + 60000),
    };

    return {
      provider,
      remainingRequests: Math.floor(bucket?.getTokens() || 0),
      remainingQuota: status.requests,
      resetAt: status.resetAt,
      isLimited: !this.canMakeRequest(provider).allowed,
    };
  }

  /**
   * Reset all limits for a provider
   */
  resetProvider(provider: string): void {
    // Token buckets auto-reset, but we can recreate for immediate reset
    const config = this.configs.get(provider);
    if (config) {
      const refillRate = config.requestsPerSecond;
      const capacity = Math.max(refillRate, 10);
      this.tokenBuckets.set(provider, new TokenBucket(capacity, refillRate));
    }

    // Clear quota trackers
    this.quotaTrackers.delete(provider);

    // Re-register to reset
    if (config) {
      this.registerProvider(provider, config);
    }
  }
}

/**
 * Predefined rate limit configs for common providers
 */
export const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  deepgram: {
    requestsPerSecond: 100,
    requestsPerMinute: 6000,
    requestsPerHour: 360000,
    maxConcurrent: 50,
  },
  elevenlabs: {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerHour: 36000,
    maxConcurrent: 10,
    costWeighting: {
      'synthesize': 1,
      'synthesize-long': 2,
    },
  },
  cartesia: {
    requestsPerSecond: 50,
    requestsPerMinute: 3000,
    requestsPerHour: 180000,
    maxConcurrent: 30,
  },
};
