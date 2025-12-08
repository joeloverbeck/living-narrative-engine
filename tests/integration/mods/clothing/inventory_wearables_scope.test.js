import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';

describe('clothing:inventory_wearables scope', () => {
  it('uses items:inventory with clothing:wearable filter and no core inventory fallback', async () => {
    const scopeContent = await fs.readFile(
      'data/mods/clothing/scopes/inventory_wearables.scope',
      'utf-8'
    );

    expect(scopeContent).toContain('clothing:inventory_wearables');
    expect(scopeContent).toContain('actor.components.items:inventory.items');
    expect(scopeContent).toContain('entity.components.clothing:wearable');
    expect(scopeContent).not.toContain('core:inventory');
  });

  it('is registered in the clothing mod manifest', async () => {
    const manifestRaw = await fs.readFile(
      'data/mods/clothing/mod-manifest.json',
      'utf-8'
    );

    const manifest = JSON.parse(manifestRaw);
    expect(manifest.content?.scopes).toContain('inventory_wearables.scope');
  });
});
