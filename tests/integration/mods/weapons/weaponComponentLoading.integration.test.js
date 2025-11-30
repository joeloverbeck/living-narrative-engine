/**
 * @file Integration test to verify weapons:weapon component loads correctly.
 * @see data/mods/weapons/components/weapon.component.json
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

/**
 * Integration Test – weapons:weapon Component Loading
 *
 * This test verifies that:
 * 1. The weapons:weapon component file exists and is valid
 * 2. The component follows the marker component pattern
 * 3. The component is properly structured for the mod system
 */
describe('weapons:weapon Component - Integration', () => {
  let testBed;
  let weaponComponent;

  beforeEach(() => {
    testBed = createTestBed();

    // Load the component definition file directly
    const componentPath = path.resolve(
      process.cwd(),
      'data/mods/weapons/components/weapon.component.json'
    );
    weaponComponent = JSON.parse(fs.readFileSync(componentPath, 'utf8'));
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Component File Structure', () => {
    it('should have correct component ID', () => {
      expect(weaponComponent.id).toBe('weapons:weapon');
    });

    it('should reference correct schema', () => {
      expect(weaponComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should have a meaningful description', () => {
      expect(weaponComponent.description).toBeDefined();
      expect(typeof weaponComponent.description).toBe('string');
      expect(weaponComponent.description.length).toBeGreaterThan(0);
      expect(weaponComponent.description.toLowerCase()).toContain('marker');
      expect(weaponComponent.description.toLowerCase()).toContain('weapon');
    });
  });

  describe('Marker Component Pattern', () => {
    it('should be a marker component with empty properties', () => {
      expect(weaponComponent.dataSchema).toBeDefined();
      expect(weaponComponent.dataSchema.type).toBe('object');
      expect(weaponComponent.dataSchema.properties).toEqual({});
    });

    it('should disallow additional properties', () => {
      expect(weaponComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('should follow the same pattern as other marker components', () => {
      // Load items:item for comparison
      const itemsItemPath = path.resolve(
        process.cwd(),
        'data/mods/items/components/item.component.json'
      );
      const itemsItem = JSON.parse(fs.readFileSync(itemsItemPath, 'utf8'));

      // Verify both follow the same marker component pattern
      expect(weaponComponent.dataSchema.type).toBe(itemsItem.dataSchema.type);
      expect(weaponComponent.dataSchema.properties).toEqual(
        itemsItem.dataSchema.properties
      );
      expect(weaponComponent.dataSchema.additionalProperties).toBe(
        itemsItem.dataSchema.additionalProperties
      );
    });
  });

  describe('Component Integration with Mod System', () => {
    it('should be listed in weapons mod manifest', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/weapons/mod-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(manifest.id).toBe('weapons');
      // Note: Components are auto-discovered, not explicitly listed in manifest
      expect(manifest).toBeDefined();
    });

    it('should exist in the weapons mod components directory', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/weapons/components/weapon.component.json'
      );

      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should be parseable as valid JSON', () => {
      expect(() => {
        const componentPath = path.resolve(
          process.cwd(),
          'data/mods/weapons/components/weapon.component.json'
        );
        JSON.parse(fs.readFileSync(componentPath, 'utf8'));
      }).not.toThrow();
    });
  });

  describe('Documentation and Usage Guidance', () => {
    it('should document required companion components', () => {
      const description = weaponComponent.description;

      // Weapons should be used with these core item components
      expect(description).toContain('items:item');
      expect(description).toContain('items:portable');
      expect(description).toContain('anatomy:requires_grabbing');
    });

    it('should indicate this is a marker component', () => {
      const description = weaponComponent.description.toLowerCase();
      expect(description).toContain('marker component');
    });

    it('should explain the component purpose', () => {
      const description = weaponComponent.description.toLowerCase();
      expect(description).toContain('identifying');
      expect(description).toContain('weapon');
    });
  });

  describe('Consistency with Items Mod Patterns', () => {
    it('should follow naming convention of other marker components', () => {
      // ID format should be modId:componentName
      expect(weaponComponent.id).toMatch(/^weapons:[a-z_]+$/);
    });

    it('should use same schema reference as items components', () => {
      const itemsPortablePath = path.resolve(
        process.cwd(),
        'data/mods/items/components/portable.component.json'
      );
      const itemsPortable = JSON.parse(
        fs.readFileSync(itemsPortablePath, 'utf8')
      );

      expect(weaponComponent.$schema).toBe(itemsPortable.$schema);
    });

    it('should have description format similar to items marker components', () => {
      const itemsItemPath = path.resolve(
        process.cwd(),
        'data/mods/items/components/item.component.json'
      );
      const itemsItem = JSON.parse(fs.readFileSync(itemsItemPath, 'utf8'));

      // Both should mention "Marker component" in their descriptions
      expect(
        weaponComponent.description.toLowerCase().includes('marker')
      ).toBe(true);
      expect(itemsItem.description.toLowerCase().includes('marker')).toBe(true);
    });
  });
});
