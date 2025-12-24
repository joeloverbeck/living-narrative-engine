/**
 * @file Integration tests for furniture mod dependency declarations
 *
 * Tests that furniture mod properly declares all required dependencies
 * to ensure component schemas are loaded in correct order.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

describe('Furniture Mod Dependencies - Integration', () => {
  const MODS_PATH = path.join(process.cwd(), 'data', 'mods');
  let furnitureManifest;
  let furnitureEntities;

  beforeAll(async () => {
    // Load furniture mod manifest
    const manifestPath = path.join(MODS_PATH, 'furniture', 'mod-manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    furnitureManifest = JSON.parse(manifestContent);

    // Load all furniture entity definitions
    const entitiesDir = path.join(
      MODS_PATH,
      'furniture',
      'entities',
      'definitions'
    );
    const entityFiles = await fs.readdir(entitiesDir);
    furnitureEntities = await Promise.all(
      entityFiles
        .filter((f) => f.endsWith('.entity.json'))
        .map(async (f) => {
          const content = await fs.readFile(path.join(entitiesDir, f), 'utf-8');
          return { filename: f, data: JSON.parse(content) };
        })
    );
  });

  describe('Dependency Declaration Completeness', () => {
    it('should have mod-manifest.json with dependencies array', () => {
      expect(furnitureManifest).toBeDefined();
      expect(furnitureManifest.dependencies).toBeDefined();
      expect(Array.isArray(furnitureManifest.dependencies)).toBe(true);
    });

    it('should declare items-core mod as dependency when entities use items-core:item component', () => {
      // Find all entities that use items-core:item component
      const entitiesUsingItemsCoreComponent = furnitureEntities.filter(
        (entity) => {
          const components = entity.data.components || {};
          return Object.keys(components).some((key) =>
            key.startsWith('items-core:')
          );
        }
      );

      // Verify entities using items-core: components exist (documents the requirement)
      expect(entitiesUsingItemsCoreComponent.length).toBeGreaterThan(0);

      // items-core must be a dependency
      const dependencyIds = furnitureManifest.dependencies.map((d) => d.id);
      expect(dependencyIds).toContain('items-core');
    });

    it('should list all required mod dependencies for components used', () => {
      // Extract all component prefixes used by furniture entities
      const usedModPrefixes = new Set();

      for (const entity of furnitureEntities) {
        const components = entity.data.components || {};
        for (const componentId of Object.keys(components)) {
          const colonIndex = componentId.indexOf(':');
          if (colonIndex > 0) {
            const modPrefix = componentId.substring(0, colonIndex);
            // Skip 'core' as it's always available
            if (modPrefix !== 'core' && modPrefix !== 'furniture') {
              usedModPrefixes.add(modPrefix);
            }
          }
        }
      }

      // Get declared dependencies
      const declaredDeps = new Set(
        furnitureManifest.dependencies.map((d) => d.id)
      );

      // Every used mod prefix should be a declared dependency
      for (const prefix of usedModPrefixes) {
        expect(declaredDeps).toContain(prefix);
      }
    });
  });

  describe('Items Component Usage', () => {
    it('should identify entities using items-core:item component and have items-core dependency', () => {
      const entitiesWithItemsCoreComponent = furnitureEntities
        .filter((entity) => {
          const components = entity.data.components || {};
          return 'items-core:item' in components;
        })
        .map((e) => e.filename);

      // This test documents which entities need items-core:item
      // The list should be non-empty (requirement for items-core dependency)
      expect(entitiesWithItemsCoreComponent.length).toBeGreaterThan(0);

      // Verify items-core dependency is declared
      const hasItemsCoreDependency = furnitureManifest.dependencies.some(
        (d) => d.id === 'items-core'
      );
      expect(hasItemsCoreDependency).toBe(true);
    });
  });
});
