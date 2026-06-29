<?php

namespace App\Libraries;

use CodeIgniter\Cache\CacheInterface;

/**
 * RateLimiter — token-bucket rate limiter backed by CI4's cache service.
 *
 * Algorithm:
 *   Each bucket stores { tokens: float, last_updated: int } in the cache.
 *   On each request:
 *     1. Compute elapsed seconds since last_updated.
 *     2. Refill: tokens = min(capacity, tokens + elapsed * refillRate).
 *     3. If tokens >= 1: subtract 1, persist, return allowed=true.
 *     4. Else: return allowed=false with retryAfter = ceil((1 - tokens) / refillRate).
 *
 * Bucket key formats (from data-model.md §2):
 *   Unauthenticated: rl:ip:{ip}:{routeHash}
 *   Authenticated:   rl:user:{userId}:{routeHash}
 */
class RateLimiter
{
    private CacheInterface $cache;
    private int $ttl;

    public function __construct(?CacheInterface $cache = null, int $ttl = 120)
    {
        $this->cache = $cache ?? \Config\Services::cache();
        $this->ttl   = $ttl;
    }

    /**
     * Attempt to consume one token from the named bucket.
     *
     * @param string $bucketKey  Unique bucket identifier.
     * @param int    $capacity   Maximum tokens (= max burst, equals req/min limit).
     * @param int    $refillRate Tokens added per second (capacity / 60 = per-second rate).
     *
     * @return array{allowed: bool, remaining: int, retryAfter: int}
     */
    public function consume(string $bucketKey, int $capacity, int $refillRate): array
    {
        $bucketKey = $this->sanitizeKey($bucketKey);
        $now       = time();
        $stored    = $this->cache->get($bucketKey);

        if ($stored === null || !is_array($stored)) {
            $tokens      = (float) $capacity;
            $lastUpdated = $now;
        } else {
            $tokens      = (float) ($stored['tokens'] ?? $capacity);
            $lastUpdated = (int)   ($stored['last_updated'] ?? $now);
        }

        $elapsed = max(0, $now - $lastUpdated);
        $tokens  = min((float) $capacity, $tokens + $elapsed * $refillRate);

        if ($tokens >= 1.0) {
            $tokens -= 1.0;
            $this->cache->save($bucketKey, [
                'tokens'       => $tokens,
                'last_updated' => $now,
            ], $this->ttl);

            return [
                'allowed'    => true,
                'remaining'  => (int) floor($tokens),
                'retryAfter' => 0,
            ];
        }

        $retryAfter = (int) ceil((1.0 - $tokens) / max(1, $refillRate));

        return [
            'allowed'    => false,
            'remaining'  => 0,
            'retryAfter' => $retryAfter,
        ];
    }

    /**
     * Flush a specific bucket (e.g., after successful login).
     */
    public function reset(string $bucketKey): void
    {
        $this->cache->delete($this->sanitizeKey($bucketKey));
    }

    /**
     * Replace PSR-6 reserved characters ({}()/\@:) with underscores so CI4's
     * FileHandler (and other cache drivers) accept the key without throwing.
     */
    private function sanitizeKey(string $key): string
    {
        return preg_replace('/[{}()\/\\\\@:]/', '_', $key);
    }
}
