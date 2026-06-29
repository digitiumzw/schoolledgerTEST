<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddExpirationNotificationToSubscriptions extends Migration
{
    public function up()
    {
        $this->forge->addColumn('school_subscriptions', [
            'expiration_notification_sent_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'cancelled_at',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('school_subscriptions', 'expiration_notification_sent_at');
    }
}
