<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class MigratePaymentCategoriesToTenants extends Migration
{
    public function up()
    {
        // Add payment_categories column to tenants table as JSON
        $fields = [
            'payment_categories' => [
                'type' => 'JSON',
                'null' => true,
                'after' => 'academic_calendar'
            ]
        ];
        $this->forge->addColumn('tenants', $fields);

        // Migrate existing payment_categories to tenants table
        $tenants = $this->db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $categories = $this->db->table('payment_categories')
                ->where('tenant_id', $tenant['id'])
                ->get()->getResultArray();
            
            if (!empty($categories)) {
                $formattedCategories = [];
                foreach ($categories as $category) {
                    $formattedCategories[] = [
                        'id' => $category['id'],
                        'name' => $category['name'],
                        'defaultAmount' => $category['default_amount'] ? (float) $category['default_amount'] : null,
                        'active' => (bool) $category['active'],
                        'createdAt' => $category['created_at'],
                        'updatedAt' => $category['updated_at']
                    ];
                }
                
                $this->db->table('tenants')
                    ->where('id', $tenant['id'])
                    ->update(['payment_categories' => json_encode($formattedCategories)]);
            }
        }

        // Drop the old payment_categories table
        $this->forge->dropTable('payment_categories');
    }

    public function down()
    {
        // Recreate payment_categories table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'name' => ['type' => 'VARCHAR', 'constraint' => 100],
            'default_amount' => ['type' => 'DECIMAL', 'constraint' => '10,2', 'null' => true],
            'active' => ['type' => 'BOOLEAN', 'default' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('payment_categories');

        // Migrate data back from tenants to payment_categories table
        $tenants = $this->db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            if (isset($tenant['payment_categories']) && !empty($tenant['payment_categories'])) {
                $categories = json_decode($tenant['payment_categories'], true);
                $insertData = [];
                
                foreach ($categories as $category) {
                    $insertData[] = [
                        'id' => $category['id'],
                        'tenant_id' => $tenant['id'],
                        'name' => $category['name'],
                        'default_amount' => $category['defaultAmount'],
                        'active' => $category['active'],
                        'created_at' => $category['createdAt'],
                        'updated_at' => $category['updatedAt']
                    ];
                }
                
                if (!empty($insertData)) {
                    $this->db->table('payment_categories')->insertBatch($insertData);
                }
            }
        }

        // Drop payment_categories column from tenants table
        $this->forge->dropColumn('tenants', 'payment_categories');
    }
}
