class RateLimiter {
  constructor({ windowMs, limit }) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.entries = new Map();
  }

  check(ip, userAgent) {
    const key = `${ip || 'unknown'}::${userAgent || 'unknown'}`;
    return this.checkKey(key);
  }

  checkKey(key) {
    const now = Date.now();
    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }
    const timestamps = this.entries.get(key).filter((ts) => now - ts < this.windowMs);
    timestamps.push(now);
    this.entries.set(key, timestamps);
    const allowed = timestamps.length <= this.limit;
    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : Math.ceil(this.windowMs / 1000)
    };
  }
}

module.exports = RateLimiter;
