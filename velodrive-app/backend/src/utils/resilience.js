/**
 * Resilience helpers for external calls (email/PayPal/3rd-party APIs).
 * No secrets; behavior controlled by env.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const withTimeout = async (promise, ms, label = 'operation') => {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      const e = new Error(`${label} timed out after ${ms}ms`);
      e.code = 'ETIMEDOUT';
      reject(e);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
};

const retry = async (fn, { retries = 2, baseDelayMs = 300, maxDelayMs = 3000, factor = 2, onRetry, shouldRetry } = {}) => {
  let attempt = 0;
  let last;
  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (err) {
      last = err;
      const ok = shouldRetry ? shouldRetry(err, attempt) : true;
      if (!ok || attempt === retries) throw err;
      const delay = Math.min(maxDelayMs, Math.round(baseDelayMs * Math.pow(factor, attempt)));
      if (onRetry) onRetry(err, attempt + 1, delay);
      await sleep(delay);
      attempt += 1;
    }
  }
  throw last;
};

class CircuitBreaker {
  constructor({ name = 'circuit', failureThreshold = 5, resetMs = 30000 } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetMs = resetMs;
    this.failures = 0;
    this.state = 'closed'; // closed | open | half-open
    this.openedAt = 0;
  }
  async exec(fn) {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt > this.resetMs) this.state = 'half-open';
      else {
        const e = new Error(`${this.name} circuit open`);
        e.code = 'CIRCUIT_OPEN';
        throw e;
      }
    }
    try {
      const out = await fn();
      this.failures = 0;
      this.state = 'closed';
      return out;
    } catch (err) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw err;
    }
  }
  snapshot() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

module.exports = { withTimeout, retry, CircuitBreaker, sleep };
