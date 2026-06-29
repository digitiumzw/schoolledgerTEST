<?php

namespace App\Controllers\Api;

use App\Models\PlatformSetting;

class MaintenanceController extends BaseApiController
{
    private const DEFAULT_HEADLINE = 'Platform Under Maintenance';
    private const DEFAULT_MESSAGE = 'The platform is currently under maintenance. Service will be restored shortly.';

    public function status()
    {
        $settingModel = new PlatformSetting();

        $maintenanceMode = (bool) $settingModel->get('maintenance_mode');
        $headline = (string) $settingModel->get('maintenance_headline');
        $message = (string) $settingModel->get('maintenance_message');

        if ($headline === '') {
            $headline = self::DEFAULT_HEADLINE;
        }
        if ($message === '') {
            $message = self::DEFAULT_MESSAGE;
        }

        return $this->success([
            'maintenance_mode' => $maintenanceMode,
            'headline'         => $headline,
            'message'          => $message,
        ]);
    }
}
