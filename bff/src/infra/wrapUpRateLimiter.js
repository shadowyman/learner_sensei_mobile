class WrapUpRateLimiter {
  constructor({ minIntervalMs, burstWindowMs, burstLimit, blockMs } = {}) {
    this.minIntervalMs = typeof minIntervalMs === 'number' ? minIntervalMs : 20_000;
    this.burstWindowMs = typeof burstWindowMs === 'number' ? burstWindowMs : 120_000;
    this.burstLimit = typeof burstLimit === 'number' ? burstLimit : 3;
    this.blockMs = typeof blockMs === 'number' ? blockMs : 300_000;
    this.entries = new Map();
  }

  check(key) {
    const now = Date.now();
    const entry = this.entries.get(key) || { attemptTimestamps: [], lastAllowedAt: 0, blockedUntil: 0 };

    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000)
      };
    }

    entry.attemptTimestamps = entry.attemptTimestamps.filter((ts) => now - ts < this.burstWindowMs);
    entry.attemptTimestamps.push(now);

    if (entry.attemptTimestamps.length > this.burstLimit) {
      entry.blockedUntil = now + this.blockMs;
      entry.attemptTimestamps = [];
      this.entries.set(key, entry);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(this.blockMs / 1000)
      };
    }

    if (entry.lastAllowedAt && now - entry.lastAllowedAt < this.minIntervalMs) {
      const waitMs = this.minIntervalMs - (now - entry.lastAllowedAt);
      this.entries.set(key, entry);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(waitMs / 1000)
      };
    }

    entry.lastAllowedAt = now;
    this.entries.set(key, entry);
    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }
}

module.exports = WrapUpRateLimiter;
