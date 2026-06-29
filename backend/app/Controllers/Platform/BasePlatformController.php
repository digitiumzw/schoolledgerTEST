<?php

namespace App\Controllers\Platform;

use App\Controllers\Api\BaseApiController;
use App\Libraries\PlatformPolicy;

abstract class BasePlatformController extends BaseApiController
{
    use PlatformPolicy;

    protected function getCurrentUser(): ?object
    {
        return $this->request->platformUser ?? null;
    }
}
