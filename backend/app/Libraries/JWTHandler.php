<?php

namespace App\Libraries;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Config\Jwt as JwtConfig;
use Exception;

class JWTHandler
{
    protected JwtConfig $config;

    public function __construct()
    {
        $this->config = config('Jwt');
    }

    /**
     * Generate JWT token for a user
     */
    public function generateToken(array $userData): string
    {
        $issuedAt = time();
        $expiration = $issuedAt + $this->config->timeToLive;

        $payload = [
            'iss' => $this->config->issuer,
            'iat' => $issuedAt,
            'exp' => $expiration,
            'data' => $userData
        ];

        return JWT::encode($payload, $this->config->secretKey, $this->config->algorithm);
    }

    /**
     * Validate and decode JWT token
     */
    public function validateToken(string $token): object
    {
        try {
            $decoded = JWT::decode(
                $token,
                new Key($this->config->secretKey, $this->config->algorithm)
            );

            return $decoded->data;
        } catch (Exception $e) {
            throw new Exception('Invalid or expired token: ' . $e->getMessage());
        }
    }

    /**
     * Get user data from token without full validation
     */
    public function decodeToken(string $token): ?object
    {
        try {
            $decoded = JWT::decode(
                $token,
                new Key($this->config->secretKey, $this->config->algorithm)
            );

            return $decoded->data ?? null;
        } catch (Exception $e) {
            return null;
        }
    }
}
