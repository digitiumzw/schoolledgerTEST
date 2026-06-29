<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionGraceUsageTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'hour_bucket' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => false,
                'comment'    => 'Format: YYYYMMDDHH — identifies the UTC clock hour window',
            ],
            'used_seconds' => [
                'type'     => 'INT',
                'unsigned' => true,
                'default'  => 0,
                'null'     => false,
            ],
            'last_heartbeat' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['tenant_id', 'hour_bucket'], 'unique_tenant_hour');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('subscription_grace_usage');
    }

    public function down()
    {
        $this->forge->dropTable('subscription_grace_usage', true);
    }
}
