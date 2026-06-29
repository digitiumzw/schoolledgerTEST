<?php

namespace App\Models;

use CodeIgniter\Model;

class PlatformSetting extends Model
{
    protected $table      = 'platform_settings';
    protected $primaryKey = 'id';

    protected $allowedFields = ['key', 'value', 'type', 'description'];

    protected $useTimestamps = true;

    private static array $cache = [];

    public function get(string $key): mixed
    {
        if (isset(self::$cache[$key])) {
            return self::$cache[$key];
        }

        $row = $this->where('key', $key)->first();
        if (!$row) {
            return null;
        }

        $value = $this->castValue($row['value'], $row['type']);
        self::$cache[$key] = $value;
        return $value;
    }

    public function setSetting(string $key, mixed $value, string $type = 'string', string $description = ''): void
    {
        $encoded = is_array($value) || is_object($value) ? json_encode($value) : json_encode($value);
        $existing = $this->where('key', $key)->first();

        if ($existing) {
            $this->where('key', $key)->set(['value' => $encoded, 'type' => $type])->update();
        } else {
            $this->insert(['key' => $key, 'value' => $encoded, 'type' => $type, 'description' => $description]);
        }

        unset(self::$cache[$key]);
    }

    public function getAll(): array
    {
        $rows = $this->findAll();
        $result = [];
        foreach ($rows as $row) {
            $result[$row['key']] = [
                'value'       => $this->castValue($row['value'], $row['type']),
                'type'        => $row['type'],
                'description' => $row['description'],
            ];
        }
        return $result;
    }

    public function getByType(string $type): array
    {
        return $this->where('type', $type)->findAll();
    }

    private function castValue(string $raw, string $type): mixed
    {
        $decoded = json_decode($raw, true);
        return match ($type) {
            'boolean' => (bool) $decoded,
            'number'  => is_float($decoded + 0) ? (float) $decoded : (int) $decoded,
            'json'    => $decoded,
            default   => (string) $decoded,
        };
    }
}
