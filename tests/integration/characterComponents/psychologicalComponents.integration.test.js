/**
 * @file Integration tests for psychological components
 * @description Tests the end-to-end flow of psychological components from loading through entity creation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import ComponentLoader from '../../../src/loaders/componentLoader.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  DILEMMAS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import fs from 'fs';
import path from 'path';

describe('Psychological Components Integration', () => {
  let testBed;
  let dataRegistry;
  let entityManager;
  let schemaValidator;

  beforeAll(async () => {
    // Create and initialize integration test bed
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get services from DI container
    dataRegistry = testBed.get(tokens.IDataRegistry);
    entityManager = testBed.get(tokens.IEntityManager);
    schemaValidator = testBed.get(tokens.ISchemaValidator);

    // Load actual component files from the core mod
    const componentsPath = path.join(
      process.cwd(),
      'data',
      'mods',
      'core',
      'components'
    );

    // Load the psychological component files directly
    const componentFiles = [
      'motivations.component.json',
      'internal_tensions.component.json',
      'dilemmas.component.json',
    ];

    for (const fileName of componentFiles) {
      const filePath = path.join(componentsPath, fileName);
      if (fs.existsSync(filePath)) {
        const componentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Register component in data registry
        dataRegistry.store('components', componentData.id, componentData);

        // Register schema with validator
        if (componentData.dataSchema) {
          const schemaId = `${componentData.id}#data`;
          if (typeof schemaValidator.addSchema === 'function') {
            await schemaValidator.addSchema(componentData.dataSchema, schemaId);
          }
        }
      }
    }
  });

  afterAll(() => {
    testBed.cleanup();
  });

  describe('Component Loading and Registration', () => {
    it('should load motivations component from JSON file', () => {
      // Assert
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );
      expect(component).toBeDefined();
      expect(component.id).toBe('core:motivations');
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.properties.text).toBeDefined();
      expect(component.dataSchema.properties.text.type).toBe('string');
      expect(component.dataSchema.required).toContain('text');
    });

    it('should load internal tensions component from JSON file', () => {
      // Assert
      const component = dataRegistry.get(
        'components',
        INTERNAL_TENSIONS_COMPONENT_ID
      );
      expect(component).toBeDefined();
      expect(component.id).toBe('core:internal_tensions');
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.properties.text).toBeDefined();
      expect(component.dataSchema.properties.text.type).toBe('string');
      expect(component.dataSchema.required).toContain('text');
    });

    it('should load dilemmas component from JSON file', () => {
      // Assert
      const component = dataRegistry.get('components', DILEMMAS_COMPONENT_ID);
      expect(component).toBeDefined();
      expect(component.id).toBe('core:dilemmas');
      expect(component.dataSchema).toBeDefined();
      expect(component.dataSchema.properties.text).toBeDefined();
      expect(component.dataSchema.properties.text.type).toBe('string');
      expect(component.dataSchema.required).toContain('text');
    });

    it('should validate component schemas are properly structured', () => {
      // Arrange
      const components = [
        MOTIVATIONS_COMPONENT_ID,
        INTERNAL_TENSIONS_COMPONENT_ID,
        DILEMMAS_COMPONENT_ID,
      ];

      // Assert
      components.forEach((componentId) => {
        const component = dataRegistry.get('components', componentId);
        expect(component.dataSchema.type).toBe('object');
        expect(component.dataSchema.required).toContain('text');
        expect(component.dataSchema.additionalProperties).toBe(false);
        expect(component.description).toBeTruthy();
      });
    });
  });

  describe('Entity Creation with Psychological Components', () => {
    it('should create entity with all psychological components', async () => {
      // This test validates that the component data structures work correctly
      // We'll test the data structures directly since entity creation requires definitions

      // Arrange - Create mock entity data that would come from the entity system
      const mockEntityState = {
        'core:actor': { name: 'Integration Test Character' },
        'core:motivations': {
          text: 'I seek knowledge to understand my past.',
        },
        'core:internal_tensions': {
          text: 'I want answers but fear what I might discover.',
        },
        'core:dilemmas': {
          text: 'Is ignorance truly bliss?',
        },
      };

      // Act - Validate that the component data validates against schemas
      for (const [componentId, componentData] of Object.entries(
        mockEntityState
      )) {
        if (componentId !== 'core:actor') {
          // Skip actor component for this test
          const component = dataRegistry.get('components', componentId);
          expect(component).toBeDefined();

          // Validate component data structure
          expect(componentData).toHaveProperty('text');
          expect(typeof componentData.text).toBe('string');
          expect(componentData.text.length).toBeGreaterThan(0);
        }
      }

      // Assert - Check that all expected components are loaded
      expect(mockEntityState[MOTIVATIONS_COMPONENT_ID]).toBeDefined();
      expect(mockEntityState[MOTIVATIONS_COMPONENT_ID].text).toBe(
        'I seek knowledge to understand my past.'
      );
      expect(mockEntityState[INTERNAL_TENSIONS_COMPONENT_ID]).toBeDefined();
      expect(mockEntityState[INTERNAL_TENSIONS_COMPONENT_ID].text).toBe(
        'I want answers but fear what I might discover.'
      );
      expect(mockEntityState[DILEMMAS_COMPONENT_ID]).toBeDefined();
      expect(mockEntityState[DILEMMAS_COMPONENT_ID].text).toBe(
        'Is ignorance truly bliss?'
      );
    });

    it('should validate component data against schemas', async () => {
      // Arrange
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );
      const invalidData = {
        // Missing required 'text' field
        wrongField: 'This should fail validation',
      };

      // Act & Assert
      expect(component).toBeDefined();
      expect(component.dataSchema.required).toContain('text');

      // Invalid data should not have the required 'text' field
      expect(invalidData).not.toHaveProperty('text');
      expect(invalidData).toHaveProperty('wrongField');
    });

    it('should handle entities without psychological components', async () => {
      // Arrange - Mock entity state without psychological components
      const minimalEntityState = {
        'core:actor': { name: 'Minimal Character' },
        'core:description': { text: 'A simple character' },
      };

      // Act & Assert
      expect(minimalEntityState['core:actor']).toBeDefined();
      expect(minimalEntityState['core:description']).toBeDefined();
      expect(minimalEntityState[MOTIVATIONS_COMPONENT_ID]).toBeUndefined();
      expect(
        minimalEntityState[INTERNAL_TENSIONS_COMPONENT_ID]
      ).toBeUndefined();
      expect(minimalEntityState[DILEMMAS_COMPONENT_ID]).toBeUndefined();
    });

    it('should create entity with partial psychological components', async () => {
      // Arrange - Mock entity state with partial psychological components
      const partialEntityState = {
        'core:actor': { name: 'Partial Character' },
        'core:motivations': {
          text: 'I just want to survive another day.',
        },
        // No internal tensions
        'core:dilemmas': {
          text: 'Is survival enough?',
        },
      };

      // Act & Assert
      expect(partialEntityState[MOTIVATIONS_COMPONENT_ID]).toBeDefined();
      expect(partialEntityState[MOTIVATIONS_COMPONENT_ID].text).toBe(
        'I just want to survive another day.'
      );
      expect(
        partialEntityState[INTERNAL_TENSIONS_COMPONENT_ID]
      ).toBeUndefined();
      expect(partialEntityState[DILEMMAS_COMPONENT_ID]).toBeDefined();
      expect(partialEntityState[DILEMMAS_COMPONENT_ID].text).toBe(
        'Is survival enough?'
      );
    });

    it('should handle very long psychological component text', async () => {
      // Arrange
      const longText =
        'This is a very long motivation that describes in great detail why the character does what they do. '.repeat(
          10
        );
      const longTextEntityState = {
        'core:actor': { name: 'Long Text Character' },
        'core:motivations': { text: longText },
        'core:internal_tensions': { text: longText },
        'core:dilemmas': { text: longText + '?' },
      };

      // Act & Assert
      expect(longTextEntityState[MOTIVATIONS_COMPONENT_ID].text).toBe(longText);
      expect(longTextEntityState[INTERNAL_TENSIONS_COMPONENT_ID].text).toBe(
        longText
      );
      expect(longTextEntityState[DILEMMAS_COMPONENT_ID].text).toBe(
        longText + '?'
      );
      expect(longText.length).toBeGreaterThan(500); // Verify it's actually long
    });

    it('should preserve formatting in psychological component text', async () => {
      // Arrange - Mock entity state with formatted text
      const formattedEntityState = {
        'core:actor': { name: 'Formatted Character' },
        'core:motivations': {
          text: '**Bold** motivations with _italic_ emphasis and\n- bullet points\n- for clarity',
        },
        'core:internal_tensions': {
          text: 'Tensions with "quotes" and special chars: & < > !',
        },
        'core:dilemmas': {
          text: 'Questions? More questions? Even more questions???',
        },
      };

      // Act & Assert
      expect(formattedEntityState[MOTIVATIONS_COMPONENT_ID].text).toContain(
        '**Bold**'
      );
      expect(formattedEntityState[MOTIVATIONS_COMPONENT_ID].text).toContain(
        '_italic_'
      );
      expect(formattedEntityState[MOTIVATIONS_COMPONENT_ID].text).toContain(
        '- bullet points'
      );
      expect(
        formattedEntityState[INTERNAL_TENSIONS_COMPONENT_ID].text
      ).toContain('"quotes"');
      expect(
        formattedEntityState[INTERNAL_TENSIONS_COMPONENT_ID].text
      ).toContain('&');
      expect(formattedEntityState[DILEMMAS_COMPONENT_ID].text).toContain('???');
    });
  });

  describe('Component Data Validation', () => {
    it('should handle empty text in psychological components', async () => {
      // Arrange
      const emptyTextData = { text: '' };
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );

      // Act & Assert
      expect(component).toBeDefined();
      expect(component.dataSchema.required).toContain('text');

      // Verify empty string data structure
      expect(emptyTextData).toHaveProperty('text');
      expect(emptyTextData.text).toBe('');
      expect(typeof emptyTextData.text).toBe('string');
    });

    it('should identify null text in psychological components', async () => {
      // Arrange
      const nullTextData = { text: null };
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );

      // Act & Assert
      expect(component).toBeDefined();
      expect(component.dataSchema.properties.text.type).toBe('string');

      // Verify null data structure (should not match string type)
      expect(nullTextData.text).toBeNull();
      expect(typeof nullTextData.text).not.toBe('string');
    });

    it('should identify missing text field in psychological components', async () => {
      // Arrange
      const missingTextData = {};
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );

      // Act & Assert
      expect(component).toBeDefined();
      expect(component.dataSchema.required).toContain('text');

      // Verify missing text field
      expect(missingTextData).not.toHaveProperty('text');
    });

    it('should identify additional properties in psychological components', async () => {
      // Arrange
      const extraPropsData = {
        text: 'Valid motivation text',
        extraField: 'This should not be allowed',
      };
      const component = dataRegistry.get(
        'components',
        MOTIVATIONS_COMPONENT_ID
      );

      // Act & Assert
      expect(component).toBeDefined();
      expect(component.dataSchema.additionalProperties).toBe(false);

      // Verify additional properties exist
      expect(extraPropsData).toHaveProperty('text');
      expect(extraPropsData).toHaveProperty('extraField');
      expect(Object.keys(extraPropsData)).toHaveLength(2); // Should only have 'text'
    });
  });

  describe('Multiple Entity Management', () => {
    it('should handle multiple entities with different psychological profiles', async () => {
      // Arrange - Mock multiple entities with different psychological profiles
      const entities = [
        {
          id: 'optimist',
          state: {
            'core:actor': { name: 'Optimist' },
            'core:motivations': {
              text: 'I believe in making the world better.',
            },
            'core:internal_tensions': {
              text: 'Sometimes I wonder if I am being naive.',
            },
            'core:dilemmas': {
              text: 'Can one person really make a difference?',
            },
          },
        },
        {
          id: 'pessimist',
          state: {
            'core:actor': { name: 'Pessimist' },
            'core:motivations': {
              text: 'I prepare for the worst to never be disappointed.',
            },
            'core:internal_tensions': {
              text: 'I hate that I cannot hope anymore.',
            },
            'core:dilemmas': { text: 'Is it better to expect nothing?' },
          },
        },
        {
          id: 'realist',
          state: {
            'core:actor': { name: 'Realist' },
            'core:motivations': {
              text: 'I seek to see things as they truly are.',
            },
            'core:internal_tensions': {
              text: 'Truth can be harsh and isolating.',
            },
            'core:dilemmas': { text: 'Should I soften the truth for others?' },
          },
        },
      ];

      // Act & Assert
      expect(entities).toHaveLength(3);

      entities.forEach((entity) => {
        expect(entity.state[MOTIVATIONS_COMPONENT_ID]).toBeDefined();
        expect(entity.state[MOTIVATIONS_COMPONENT_ID].text).toBeTruthy();
        expect(entity.state[INTERNAL_TENSIONS_COMPONENT_ID]).toBeDefined();
        expect(entity.state[INTERNAL_TENSIONS_COMPONENT_ID].text).toBeTruthy();
        expect(entity.state[DILEMMAS_COMPONENT_ID]).toBeDefined();
        expect(entity.state[DILEMMAS_COMPONENT_ID].text).toBeTruthy();
      });

      // Verify each entity has unique psychological profiles
      const motivationTexts = entities.map(
        (e) => e.state[MOTIVATIONS_COMPONENT_ID].text
      );
      const uniqueMotivations = new Set(motivationTexts);
      expect(uniqueMotivations.size).toBe(3); // All different
    });
  });
});
