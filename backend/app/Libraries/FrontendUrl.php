<?php

namespace App\Libraries;

/**
 * Centralised builder for links that point at the public-facing frontend
 * application. Every URL embedded in an outgoing email (password resets,
 * invitations, billing notices, etc.) must be generated from SITE_URL so that
 * links resolve to the user-facing app rather than the API host.
 */
class FrontendUrl
{
    /**
     * The configured frontend base URL (no trailing slash).
     */
    public static function base(): string
    {
        $url = (string) env('SITE_URL', '');

        // Fall back to the legacy app.baseURL only if SITE_URL is not set, so
        // existing deployments keep working until they configure SITE_URL.
        if ($url === '') {
            $url = (string) env('app.baseURL', 'http://localhost:8081');
        }

        return rtrim($url, '/');
    }

    /**
     * Build an absolute frontend URL for the given path.
     */
    public static function to(string $path = ''): string
    {
        if ($path === '') {
            return self::base();
        }

        return self::base() . '/' . ltrim($path, '/');
    }
}
