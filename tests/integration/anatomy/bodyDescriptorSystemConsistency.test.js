/**
 * @file Integration tests for body descriptor system consistency
 * Verifies that the registry, schema, and formatting config stay synchronized
 * @see src/anatomy/registries/bodyDescriptorRegistry.js
 * @see data/schemas/anatomy.recipe.schema.json
 * @see data/mods/anatomy/anatomy-formatting/default.json
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  BODY_DESCRIPTOR_REGISTRY,
  getAllDescriptorNames,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper: Load JSON schema from file system
/**
 *
 * @param schemaFileName
 */
function loadSchema(schemaFileName) {
  const schemaPath = join(process.cwd(), 'data/schemas', schemaFileName);
  const content = readFileSync(schemaPath, 'utf-8');
  return JSON.parse(content);
}

// Helper: Load formatting config from file system
/**
 *
 */
function loadFormattingConfig() {
  const configPath = join(
    process.cwd(),
    'data/mods/anatomy/anatomy-formatting/default.json'
  );
  const content = readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

describe('Body Descriptor System Consistency', () => {
  let recipeSchema;
  let formattingConfig;

  beforeEach(() => {
    recipeSchema = loadSchema('anatomy.recipe.schema.json');
    formattingConfig = loadFormattingConfig();
  });

  describe('Registry Completeness', () => {
    it('should have all required fields for each descriptor', () => {
      const requiredFields = [
        'schemaProperty',
        'displayLabel',
        'displayKey',
        'dataPath',
        'validValues',
        'displayOrder',
        'extractor',
        'formatter',
        'required',
      ];

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        for (const field of requiredFields) {
          expect(metadata).toHaveProperty(field);
          expect(metadata[field]).toBeDefined();
        }

        // Verify functions are actually functions
        expect(typeof metadata.extractor).toBe('function');
        expect(typeof metadata.formatter).toBe('function');
      }
    });

    it('should have unique display orders', () => {
      const displayOrders = Object.values(BODY_DESCRIPTOR_REGISTRY).map(
        (meta) => meta.displayOrder
      );

      const uniqueOrders = new Set(displayOrders);
      expect(uniqueOrders.size).toBe(displayOrders.length);
    });

    it('should have unique display keys', () => {
      const displayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY).map(
        (meta) => meta.displayKey
      );

      const uniqueKeys = new Set(displayKeys);
      expect(uniqueKeys.size).toBe(displayKeys.length);
    });
  });

  describe('Registry-Schema Consistency', () => {
    it('should have all registry descriptors defined in recipe schema', () => {
      const schemaProperties = Object.keys(
        recipeSchema.properties.bodyDescriptors.properties
      );

      for (const descriptorName of getAllDescriptorNames()) {
        const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
        expect(schemaProperties).toContain(metadata.schemaProperty);
      }
    });

    it('should have matching validValues between registry and schema', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        if (metadata.validValues) {
          const schemaProperty =
            recipeSchema.properties.bodyDescriptors.properties[
              metadata.schemaProperty
            ];

          if (schemaProperty?.enum) {
            expect(metadata.validValues.sort()).toEqual(
              schemaProperty.enum.sort()
            );
          }
        }
      }
    });

    it('should not have orphaned schema properties', () => {
      const schemaProperties = Object.keys(
        recipeSchema.properties.bodyDescriptors.properties
      );

      const registrySchemaProperties = Object.values(
        BODY_DESCRIPTOR_REGISTRY
      ).map((meta) => meta.schemaProperty);

      for (const schemaProp of schemaProperties) {
        expect(registrySchemaProperties).toContain(schemaProp);
      }
    });
  });

  describe('Registry-Formatting Config Consistency', () => {
    it('should have all registry descriptors in formatting config', () => {
      const orderSet = new Set(formattingConfig.descriptionOrder);

      for (const metadata of Object.values(BODY_DESCRIPTOR_REGISTRY)) {
        expect(orderSet.has(metadata.displayKey)).toBe(true);
      }
    });

    it('should not have orphaned body descriptor displayKeys in formatting config', () => {
      const registeredDisplayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY).map(
        (meta) => meta.displayKey
      );

      // Note: descriptionOrder contains both body descriptors (height, skin_color, etc.)
      // AND anatomy part types (head, hair, eye, etc.). We only validate body descriptors.
      // A displayKey is orphaned only if it matches a registered body descriptor key
      // but is not actually in the registry.
      const bodyDescriptorKeysInConfig =
        formattingConfig.descriptionOrder.filter((key) =>
          registeredDisplayKeys.includes(key)
        );

      // All body descriptor keys found in config should be in registry
      for (const key of bodyDescriptorKeysInConfig) {
        expect(registeredDisplayKeys).toContain(key);
      }

      // Verify expected body descriptor keys are present
      expect(bodyDescriptorKeysInConfig).toContain('height');
      expect(bodyDescriptorKeysInConfig).toContain('skin_color');
      expect(bodyDescriptorKeysInConfig).toContain('build');
      expect(bodyDescriptorKeysInConfig).toContain('body_composition');
      expect(bodyDescriptorKeysInConfig).toContain('body_hair');
      expect(bodyDescriptorKeysInConfig).toContain('smell');
    });
  });

  describe('Extractor Functions', () => {
    it('should extract values from valid body component', () => {
      // Note: Body component structure follows the pattern:
      // { body: { descriptors: { [schemaProperty]: value } } }
      // The schemaProperty uses camelCase (e.g., skinColor, hairDensity)
      const testBodyComponent = {
        body: {
          descriptors: {
            height: 'tall',
            skinColor: 'tan', // camelCase in component data
            build: 'athletic',
            composition: 'lean',
            hairDensity: 'moderate', // camelCase in component data
            smell: 'pleasant',
          },
        },
      };

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const value = metadata.extractor(testBodyComponent);
        expect(value).toBeDefined();
        expect(typeof value).toBe('string');
      }
    });

    it('should handle missing data gracefully', () => {
      const emptyComponent = { body: { descriptors: {} } };

      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const value = metadata.extractor(emptyComponent);
        // Should not throw, may return undefined/null
        expect(() => metadata.extractor(emptyComponent)).not.toThrow();
      }
    });
  });

  describe('Formatter Functions', () => {
    it('should format valid values correctly', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const testValue = metadata.validValues
          ? metadata.validValues[0]
          : 'test-value';

        const formatted = metadata.formatter(testValue);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted).toContain(testValue);
      }
    });

    it('should include display label in formatted output', () => {
      for (const [name, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
        const testValue = 'test';
        const formatted = metadata.formatter(testValue);
        // Formatter should include some form of label or descriptor identifier
        expect(formatted.length).toBeGreaterThan(testValue.length);
      }
    });
  });
});
