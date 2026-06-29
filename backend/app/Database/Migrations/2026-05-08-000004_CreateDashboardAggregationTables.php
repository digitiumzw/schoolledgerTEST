<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDashboardAggregationTables extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'metric_key' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => false],
            'metric_value' => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => false, 'default' => 0],
            'metric_label' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'period_start' => ['type' => 'DATE', 'null' => false],
            'period_end' => ['type' => 'DATE', 'null' => false],
            'computed_at' => ['type' => 'DATETIME', 'null' => false],
            'expires_at' => ['type' => 'DATETIME', 'null' => false],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['tenant_id', 'metric_key', 'period_start', 'period_end'], 'unique_dashboard_tenant_metric_period');
        $this->forge->addKey(['tenant_id', 'metric_key'], false, false, 'idx_dashboard_metrics_tenant_key');
        $this->forge->addKey('expires_at', false, false, 'idx_dashboard_metrics_expires_at');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_dashboard_metrics_tenant');
        $this->forge->createTable('dashboard_kpi_metrics');

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'widget_key' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => false],
            'widget_type' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'title' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'description' => ['type' => 'TEXT', 'null' => true],
            'icon' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'required_roles' => ['type' => 'JSON', 'null' => false],
            'display_order' => ['type' => 'INT', 'null' => false, 'default' => 0],
            'is_active' => ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1],
            'drill_down_config' => ['type' => 'JSON', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('widget_key', 'unique_dashboard_widget_key');
        $this->forge->addKey(['is_active', 'display_order'], false, false, 'idx_dashboard_widgets_active_order');
        $this->forge->createTable('dashboard_widgets');

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'widget_key' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => false],
            'is_visible' => ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 1],
            'position_x' => ['type' => 'INT', 'null' => false, 'default' => 0],
            'position_y' => ['type' => 'INT', 'null' => false, 'default' => 0],
            'width' => ['type' => 'INT', 'null' => false, 'default' => 1],
            'height' => ['type' => 'INT', 'null' => false, 'default' => 1],
            'custom_config' => ['type' => 'JSON', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['user_id', 'widget_key'], 'unique_dashboard_user_widget');
        $this->forge->addKey(['tenant_id', 'user_id'], false, false, 'idx_dashboard_preferences_tenant_user');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_dashboard_preferences_tenant');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_dashboard_preferences_user');
        $this->forge->createTable('user_dashboard_preferences');
    }

    public function down(): void
    {
        $this->forge->dropTable('user_dashboard_preferences', true);
        $this->forge->dropTable('dashboard_widgets', true);
        $this->forge->dropTable('dashboard_kpi_metrics', true);
    }
}
