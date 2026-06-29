<?php

namespace App\Libraries;

use App\Models\PlatformAudit;

class AuditService
{
    public static function log(
        string  $action,
        ?string $targetType  = null,
        mixed   $targetId    = null,
        mixed   $details     = null,
        ?int    $actorUserId = null,
        ?string $actorName   = null,
        ?string $actorEmail  = null,
        ?string $targetName  = null
    ): void {
        PlatformAudit::log($action, $targetType, $targetId, $details, $actorUserId, $actorName, $actorEmail, $targetName);
    }

    public static function logFromRequest(
        string $action,
        ?string $targetType = null,
        mixed $targetId = null,
        mixed $details = null,
        ?string $targetName = null
    ): void {
        $request    = service('request');
        $actorId    = null;
        $actorName  = null;
        $actorEmail = null;

        if (isset($request->platformUser)) {
            $u = $request->platformUser;
            $actorId    = (int) ($u->id ?? 0) ?: null;
            $actorName  = $u->name  ?? null;
            $actorEmail = $u->email ?? null;
        }

        self::log($action, $targetType, $targetId, $details, $actorId, $actorName, $actorEmail, $targetName);
    }
}
