<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class CorsFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $origin = $request->getHeaderLine('Origin');
        
        // In development, allow all origins
        $allowedOrigin = $origin ?: '*';

        // Handle preflight OPTIONS request FIRST
        if (strtolower($request->getMethod()) === 'options') {
            $response = service('response');
            $response->setHeader('Access-Control-Allow-Origin', $allowedOrigin);
            $response->setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization');
            $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            $response->setHeader('Access-Control-Allow-Credentials', 'true');
            $response->setHeader('Access-Control-Max-Age', '86400');
            $response->setStatusCode(200);
            $response->setBody('');
            return $response;
        }

        return $request;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $origin = $request->getHeaderLine('Origin');
        $allowedOrigin = $origin ?: '*';

        // Add CORS headers to all responses
        $response->setHeader('Access-Control-Allow-Origin', $allowedOrigin);
        $response->setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization');
        $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        $response->setHeader('Access-Control-Allow-Credentials', 'true');

        return $response;
    }
}
