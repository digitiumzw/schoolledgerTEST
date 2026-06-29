<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Feature 059-fee-campaign
 *
 * Adds a nullable fee_campaign_id FK column to the payments table so that
 * campaign payments are traceable back to their originating campaign.
 * See: specs/059-fee-campaign/data-model.md
 */
class Add_fee_campaign_id_to_payments extends Migration
{
    public function up()
    {
        $this->forge->addColumn('payments', [
            'fee_campaign_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'default'    => null,
                'after'      => 'route_id',
            ],
        ]);

        // Add index for lookups by campaign
        $this->db->query('CREATE INDEX idx_pay_fee_campaign_id ON payments (fee_campaign_id)');
    }

    public function down()
    {
        $this->forge->dropColumn('payments', 'fee_campaign_id');
    }
}
