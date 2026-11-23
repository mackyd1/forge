/** Sliding-window rate limiter keyed by client id. */
export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(clientId: string, now = Date.now()): boolean {
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(clientId) ?? []).filter((t) => t > windowStart);
    if (prior.length >= this.limit) {
      this.hits.set(clientId, prior);
      return false;
    }
    prior.push(now);
    this.hits.set(clientId, prior);
    return true;
  }

  remaining(clientId: string, now = Date.now()): number {
    const windowStart = now - this.windowMs;
    const prior = (this.hits.get(clientId) ?? []).filter((t) => t > windowStart);
    return Math.max(0, this.limit - prior.length);
  }
}

export function retryAfterSeconds(
  clientId: string,
  limiter: SlidingWindowRateLimiter,
): number {
  return limiter.remaining(clientId) === 0 ? 1 : 0;
}
