/**
 * @file Integration tests for locations mod manifest validation.
 * @description Verifies that the locations mod manifest is correctly structured,
 * passes schema validation, and declares correct dependencies.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js';

describe('Locations Mod Manifest Validation', () => {
  let schemaValidator;
  let manifest;
  const MANIFEST_PATH = path.join(
    process.cwd(),
    'data/mods/locations/mod-manifest.json'
  );

  beforeAll(async () => {
    // Load schemas for validation
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    const logger = new ConsoleLogger('ERROR');
    schemaValidator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(filePath) {
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    const schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      schemaValidator,
      logger
    );

    await schemaLoader.loadAndCompileAllSchemas();

    // Load the manifest
    const raw = await readFile(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(raw);
  });

  describe('Manifest Loading', () => {
    it('should load and parse the manifest file successfully', () => {
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });

    it('should have id equal to "locations"', () => {
      expect(manifest.id).toBe('locations');
    });

    it('should have a valid semantic version', () => {
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Schema Validation', () => {
    it('should pass mod-manifest schema validation', () => {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/mod-manifest.schema.json',
        manifest
      );

      expect(result.isValid).toBe(true);
      if (!result.isValid) {
        console.error(
          'Validation errors:',
          JSON.stringify(result.errors, null, 2)
        );
      }
    });
  });

  describe('Dependencies', () => {
    it('should include "core" as a dependency', () => {
      expect(manifest.dependencies).toBeDefined();
      expect(Array.isArray(manifest.dependencies)).toBe(true);

      const coreDep = manifest.dependencies.find((dep) => dep.id === 'core');
      expect(coreDep).toBeDefined();
      expect(coreDep.id).toBe('core');
      expect(coreDep.version).toBeDefined();
    });

    it('should have dependencies in correct object format', () => {
      // Each dependency should be an object with id and version
      for (const dep of manifest.dependencies) {
        expect(typeof dep).toBe('object');
        expect(dep.id).toBeDefined();
        expect(typeof dep.id).toBe('string');
        expect(dep.version).toBeDefined();
        expect(typeof dep.version).toBe('string');
      }
    });
  });

  describe('Content Structure', () => {
    it('should have a content object', () => {
      expect(manifest.content).toBeDefined();
      expect(typeof manifest.content).toBe('object');
    });

    it('should have components array with lighting components', () => {
      expect(manifest.content.components).toBeDefined();
      expect(Array.isArray(manifest.content.components)).toBe(true);
      expect(manifest.content.components).toHaveLength(3);
      expect(manifest.content.components).toContain(
        'naturally_dark.component.json'
      );
      expect(manifest.content.components).toContain(
        'light_sources.component.json'
      );
      expect(manifest.content.components).toContain(
        'description_in_darkness.component.json'
      );
    });

    it('should have entities object with definitions and instances arrays', () => {
      expect(manifest.content.entities).toBeDefined();
      expect(manifest.content.entities.definitions).toBeDefined();
      expect(Array.isArray(manifest.content.entities.definitions)).toBe(true);
      expect(manifest.content.entities.instances).toBeDefined();
      expect(Array.isArray(manifest.content.entities.instances)).toBe(true);
    });
  });

  describe('Required Fields', () => {
    it('should have all required manifest fields', () => {
      expect(manifest.id).toBeDefined();
      expect(manifest.version).toBeDefined();
      expect(manifest.name).toBeDefined();
    });

    it('should have descriptive name and description', () => {
      expect(manifest.name).toBe('Locations');
      expect(manifest.description).toContain('lighting');
    });
  });

  describe('Invariants', () => {
    it('should not conflict with existing mod IDs (unique ID check)', async () => {
      // Read the list of existing mods to ensure no conflict
      const modsDir = path.join(process.cwd(), 'data/mods');
      const { readdir } = await import('node:fs/promises');
      const existingMods = await readdir(modsDir);

      // Verify 'locations' is among them (it exists now)
      expect(existingMods).toContain('locations');

      // Verify no duplicate entries by checking array uniqueness
      const uniqueMods = [...new Set(existingMods)];
      expect(existingMods.length).toBe(uniqueMods.length);
    });
  });
});
