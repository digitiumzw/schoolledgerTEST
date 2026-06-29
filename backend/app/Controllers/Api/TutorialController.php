<?php

namespace App\Controllers\Api;

use App\Services\TutorialService;
use InvalidArgumentException;

class TutorialController extends BaseApiController
{
    private TutorialService $service;

    public function __construct()
    {
        $this->service = new TutorialService();
    }

    public function index()
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->error('Authentication required.', 401);
        }

        return $this->success($this->service->getTutorial($this->getTenantId(), (string) $user->id, (string) $user->role));
    }

    public function updateProgress()
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->error('Authentication required.', 401);
        }

        try {
            return $this->success(
                $this->service->updateProgress($this->getTenantId(), (string) $user->id, (string) $user->role, $this->getRequestBody()),
                'Tutorial progress updated.'
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function restart()
    {
        $user = $this->getCurrentUser();
        if ($user === null) {
            return $this->error('Authentication required.', 401);
        }

        return $this->success(
            $this->service->restart($this->getTenantId(), (string) $user->id, (string) $user->role),
            'Tutorial restarted.'
        );
    }
}
