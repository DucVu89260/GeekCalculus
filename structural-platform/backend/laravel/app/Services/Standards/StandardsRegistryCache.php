<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\Cache;

class StandardsRegistryCache
{
    public function version(int $editionId): int
    {
        return (int) Cache::get($this->key($editionId), 1);
    }

    public function invalidate(int $editionId): void
    {
        Cache::forever($this->key($editionId), $this->version($editionId) + 1);
    }

    private function key(int $editionId): string
    {
        return 'standards:registry:version:'.$editionId;
    }
}
