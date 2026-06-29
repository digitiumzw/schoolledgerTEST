<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Jwt extends BaseConfig
{
    /**
     * JWT Secret Key
     */
    public string $secretKey = '';

    /**
     * JWT Algorithm
     */
    public string $algorithm = 'HS256';

    /**
     * JWT Time to Live (in seconds)
     */
    public int $timeToLive = 7200;

    /**
     * JWT Issuer
     */
    public string $issuer = 'schoolledger-api';

    /**
     * Platform JWT Secret Key (separate from tenant JWT)
     */
    public string $platformSecretKey = '';

    /**
     * Platform JWT Time to Live (in seconds) — 1 hour
     */
    public int $platformTokenLifetime = 3600;

    /**
     * Impersonation JWT Time to Live (in seconds) — 30 minutes
     */
    public int $impersonationTokenLifetime = 1800;

    public function __construct()
    {
        parent::__construct();

        $this->secretKey               = env('JWT_SECRET_KEY', 'default_secret_key_change_in_production');
        $this->algorithm               = env('JWT_ALGORITHM', 'HS256');
        // Default to 2 hours if the env variable is not set. This reduces unexpected
        // log-outs for tenant users while still keeping tokens reasonably short-lived.
        $this->timeToLive              = (int) env('JWT_TIME_TO_LIVE', 7200);
        $this->platformSecretKey       = env('JWT_PLATFORM_SECRET_KEY', 'default_platform_secret_key_change_in_production');
        $this->platformTokenLifetime   = (int) env('JWT_PLATFORM_TOKEN_LIFETIME', 3600);
        $this->impersonationTokenLifetime = (int) env('JWT_IMPERSONATION_TOKEN_LIFETIME', 1800);
    }
}
