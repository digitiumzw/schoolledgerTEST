<?php

namespace App\Libraries;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Config\Jwt as JwtConfig;
use Exception;

class PlatformJWTHandler
{
    protected JwtConfig $config;

    public function __construct()
    {
        $this->config = config('Jwt');
    }

    public function generateToken(array $userData, string $scope = 'platform', ?int $ttl = null): string
    {
        $issuedAt  = time();
        $lifetime  = $ttl ?? $this->config->platformTokenLifetime;
        $expiration = $issuedAt + $lifetime;

        $payload = [
            'iss'  => $this->config->issuer,
            'iat'  => $issuedAt,
            'exp'  => $expiration,
            'scope' => $scope,
            'data' => $userData,
        ];

        return JWT::encode($payload, $this->config->platformSecretKey, $this->config->algorithm);
    }

    public function validateToken(string $token): object
    {
        try {
            $decoded = JWT::decode(
                $token,
                new Key($this->config->platformSecretKey, $this->config->algorithm)
            );

            $data = $decoded->data ?? (object) [];
            $data->scope = $decoded->scope ?? null;

            return $data;
        } catch (Exception $e) {
            throw new Exception('Invalid or expired token: ' . $e->getMessage());
        }
    }

    /**
     * Generate an impersonation token that the *tenant* API will accept.
     *
     * IMPORTANT: This token is consumed by the tenant `JWTAuthFilter`, which
     * validates against `secretKey` (not `platformSecretKey`). It must therefore
     * be signed with the tenant secret and use the tenant payload shape:
     *     { iss, iat, exp, data: { ...userData } }
     * Using `platformSecretKey` here causes every tenant API call to fail with
     * 401 → tenant frontend redirects to /login.
     */
    public function generateImpersonationToken(array $tenantUserData, int $impersonatorId): string
    {
        $tenantUserData['impersonator_id'] = $impersonatorId;
        $tenantUserData['scope']           = 'impersonation';

        $issuedAt   = time();
        $lifetime   = $this->config->impersonationTokenLifetime ?? $this->config->timeToLive;
        $expiration = $issuedAt + $lifetime;

        $payload = [
            'iss'  => $this->config->issuer,
            'iat'  => $issuedAt,
            'exp'  => $expiration,
            'data' => $tenantUserData,
        ];

        return JWT::encode($payload, $this->config->secretKey, $this->config->algorithm);
    }
}
