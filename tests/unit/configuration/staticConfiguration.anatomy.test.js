// tests/unit/configuration/staticConfiguration.anatomy.test.js

import { describe, it, expect } from '@jest/globals';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('StaticConfiguration - Anatomy System', () => {
  let config;

  beforeEach(() => {
    config = new StaticConfiguration();
  });

  describe('getSchemaFiles()', () => {
    it('should include all anatomy schema files', () => {
      const schemaFiles = config.getSchemaFiles();
      
      // Check that anatomy schemas are included
      expect(schemaFiles).toContain('anatomy.recipe.schema.json');
      expect(schemaFiles).toContain('anatomy.blueprint.schema.json');
      expect(schemaFiles).toContain('anatomy.part.schema.json');
      
      // Verify they're not duplicated
      const anatomySchemas = schemaFiles.filter(file => file.startsWith('anatomy.'));
      expect(anatomySchemas).toHaveLength(3);
    });

    it('should maintain proper order with anatomy schemas before operations', () => {
      const schemaFiles = config.getSchemaFiles();
      
      const anatomyIndex = schemaFiles.findIndex(f => f.startsWith('anatomy.'));
      const operationsIndex = schemaFiles.findIndex(f => f.startsWith('operations/'));
      
      // Anatomy schemas should come before operations schemas
      expect(anatomyIndex).toBeLessThan(operationsIndex);
    });
  });

  describe('getContentTypeSchemaId()', () => {
    it('should return correct schema IDs for anatomy content types', () => {
      // Test recipe schema ID
      expect(config.getContentTypeSchemaId('anatomyRecipes'))
        .toBe('http://example.com/schemas/anatomy.recipe.schema.json');
      
      // Test blueprint schema ID
      expect(config.getContentTypeSchemaId('anatomyBlueprints'))
        .toBe('http://example.com/schemas/anatomy.blueprint.schema.json');
      
      // Test part schema ID
      expect(config.getContentTypeSchemaId('anatomyParts'))
        .toBe('http://example.com/schemas/anatomy.part.schema.json');
    });

    it('should not affect existing content type schema IDs', () => {
      // Verify existing mappings still work
      expect(config.getContentTypeSchemaId('components'))
        .toBe('http://example.com/schemas/component.schema.json');
      
      expect(config.getContentTypeSchemaId('entityDefinitions'))
        .toBe('http://example.com/schemas/entity-definition.schema.json');
      
      expect(config.getContentTypeSchemaId('scopes')).toBeNull();
    });

    it('should return undefined for unknown content types', () => {
      expect(config.getContentTypeSchemaId('unknownType')).toBeUndefined();
    });
  });

  describe('Complete anatomy configuration', () => {
    it('should have matching schema files and content type IDs', () => {
      const schemaFiles = config.getSchemaFiles();
      
      // For each anatomy content type, verify both schema file and ID exist
      const anatomyTypes = [
        { key: 'anatomyRecipes', file: 'anatomy.recipe.schema.json' },
        { key: 'anatomyBlueprints', file: 'anatomy.blueprint.schema.json' },
        { key: 'anatomyParts', file: 'anatomy.part.schema.json' }
      ];

      anatomyTypes.forEach(({ key, file }) => {
        // Schema file should be in the list
        expect(schemaFiles).toContain(file);
        
        // Content type should have a schema ID
        const schemaId = config.getContentTypeSchemaId(key);
        expect(schemaId).toBeDefined();
        expect(schemaId).toContain(file);
      });
    });
  });
});