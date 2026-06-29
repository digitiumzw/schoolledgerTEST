<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCreditApplicationsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
            ],
            'credit_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'transaction_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'amount_applied_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'applied_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('credit_id');
        $this->forge->addKey('transaction_id');
        $this->forge->createTable('credit_applications');
    }

    public function down()
    {
        $this->forge->dropTable('credit_applications', true);
    }
}
