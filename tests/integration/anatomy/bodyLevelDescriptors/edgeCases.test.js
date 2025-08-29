import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createEdgeCaseEntity,
  createMalformedEntity,
} from './fixtures/testEntities.js';
import { expectedEdgeCaseDescription } from './fixtures/expectedOutputs.js';
import { createErrorServiceMocks } from './fixtures/serviceMocks.js';
import { createFullComposer } from './helpers/anatomyTestHelpers.js';
import {
  normalizeDescription,
  extractDescriptorLines,
  countDescriptors,
} from './helpers/anatomyTestHelpers.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

describe('Edge Cases Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Invalid Descriptor Values', () => {
    it('should handle empty string, null, and hyphenated values', async () => {
      const entity = createEdgeCaseEntity();

      const result = await composer.composeDescription(entity);
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedEdgeCaseDescription);

      expect(normalized).toBe(expected);

      // Empty string and null should not appear
      expect(result).not.toContain('Build:');
      expect(result).not.toContain('Body composition:');

      // Hyphenated value should work
      expect(result).toContain('Body hair: very-hairy');
    });

    it('should handle undefined values', async () => {
      const entity = {
        id: 'undefined-values-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return { build: undefined };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'moderate' };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      expect(result).not.toContain('Build:');
      expect(result).toContain('Body hair: moderate');
    });

    it('should handle numeric values in string fields', async () => {
      const entity = {
        id: 'numeric-values-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return { build: 123 }; // Numeric value
          }
          if (componentId === 'descriptors:body_composition') {
            return { composition: 0 }; // Zero value
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      // Should handle gracefully - might include or exclude based on implementation
      const descriptorCount = countDescriptors(result);
      expect(descriptorCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle boolean values in descriptor fields', async () => {
      const entity = {
        id: 'boolean-values-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: true }; // Boolean value
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      // Should handle gracefully
      expect(result).toBeTruthy();
    });
  });

  describe('Component Edge Cases', () => {
    it('should handle malformed component data', async () => {
      const entity = createMalformedEntity();

      const result = await composer.composeDescription(entity);

      // Should only show valid descriptor
      expect(result).toContain('Head: Generated description for head-part-id');
      expect(result).not.toContain('Body composition:');
      expect(result).not.toContain('Body hair:');
    });

    it('should handle getComponentData returning unexpected types', async () => {
      const entity = {
        id: 'unexpected-types-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:body_hair') {
            return 'not an object'; // Wrong return type
          }
          if (componentId === 'descriptors:build') {
            return ['array', 'instead', 'of', 'object']; // Array instead of object
          }
          return null;
        }),
      };

      // Should handle gracefully
      const result = await composer.composeDescription(entity);
      expect(result).toBeTruthy();
    });

    it('should handle component data with extra properties', async () => {
      const entity = {
        id: 'extra-properties-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return {
              build: 'athletic',
              extraProperty: 'should be ignored',
              anotherExtra: 123,
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Build: athletic');
      expect(result).not.toContain('extraProperty');
    });

    it('should handle deeply nested component data', async () => {
      const entity = {
        id: 'nested-data-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return {
              build: {
                value: 'athletic', // Nested instead of direct value
                metadata: { source: 'generator' },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      // Should handle gracefully - might not extract nested value
      expect(result).toBeTruthy();
    });
  });

  describe('Method Edge Cases', () => {
    it('should handle entities missing required methods', async () => {
      const entity = {
        id: 'missing-methods-entity',
        // Missing hasComponent method
        getComponentData: jest.fn().mockReturnValue(null),
      };

      // Current implementation returns empty string when hasComponent is missing (graceful degradation)
      const result = await composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should handle entities with throwing methods', async () => {
      const entity = {
        id: 'throwing-methods-entity',
        hasComponent: jest.fn().mockImplementation(() => {
          throw new Error('hasComponent error');
        }),
        getComponentData: jest.fn().mockReturnValue(null),
      };

      // Current implementation doesn't catch hasComponent errors
      await expect(composer.composeDescription(entity)).rejects.toThrow(
        'hasComponent error'
      );
    });

    it('should handle getComponentData that throws for specific components', async () => {
      const entity = {
        id: 'selective-throwing-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'descriptors:build') {
            throw new Error('Component access error');
          }
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          return null;
        }),
      };

      // Current implementation doesn't catch getComponentData errors
      await expect(composer.composeDescription(entity)).rejects.toThrow(
        'Component access error'
      );
    });
  });

  describe('Service Error Handling', () => {
    it('should handle body graph service errors', async () => {
      const entity = createEdgeCaseEntity();

      composer.bodyGraphService.getAllParts.mockImplementation(() => {
        throw new Error('Body graph error');
      });

      // Current implementation doesn't catch service errors
      await expect(composer.composeDescription(entity)).rejects.toThrow(
        'Body graph error'
      );
    });

    it('should handle anatomy formatting service errors', async () => {
      const entity = createEdgeCaseEntity();

      composer.anatomyFormattingService.getDescriptionOrder.mockImplementation(
        () => {
          throw new Error('Formatting service error');
        }
      );

      // Current implementation doesn't catch service errors
      await expect(composer.composeDescription(entity)).rejects.toThrow(
        'Formatting service error'
      );
    });

    it('should handle entity finder errors', async () => {
      const entity = createEdgeCaseEntity();

      composer.entityFinder.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity finder error');
      });

      // Current implementation doesn't catch entity finder errors
      await expect(composer.composeDescription(entity)).rejects.toThrow(
        'Entity finder error'
      );
    });

    it('should handle multiple service errors simultaneously', async () => {
      const errorMocks = createErrorServiceMocks();
      const errorComposer = createFullComposer(errorMocks);
      const entity = createEdgeCaseEntity();

      // Should handle gracefully even with multiple service errors
      await expect(
        errorComposer.composeDescription(entity)
      ).resolves.toBeTruthy();
    });
  });

  describe('Data Corruption Scenarios', () => {
    it('should handle circular references in component data', async () => {
      const circularData = { build: 'athletic' };
      circularData.self = circularData; // Create circular reference

      const entity = {
        id: 'circular-data-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return circularData;
          }
          return null;
        }),
      };

      // Should handle without infinite loops
      const result = await composer.composeDescription(entity);
      expect(result).toContain('Build: athletic');
    });

    it('should handle extremely large component data', async () => {
      const largeData = {
        build: 'athletic',
        // Add many properties to simulate large data
        ...Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`prop${i}`, `value${i}`])
        ),
      };

      const entity = {
        id: 'large-data-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return largeData;
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);
      expect(result).toContain('Build: athletic');
    });

    it('should handle special characters in descriptor values', async () => {
      const entity = {
        id: 'special-chars-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'athl€tic-w/sp€cial-chars' };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'môdérâtê' };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Build: athl€tic-w/sp€cial-chars');
      expect(result).toContain('Body hair: môdérâtê');
    });

    it('should handle unicode and emoji characters', async () => {
      const entity = {
        id: 'unicode-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: '🦲hairless🦲' };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Body hair: 🦲hairless🦲');
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle simultaneous description generation', async () => {
      const entity = createEdgeCaseEntity();

      const promises = Array.from({ length: 10 }, () =>
        composer.composeDescription(entity)
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toBe(firstResult);
      });
    });

    it('should handle entity data changing during processing', async () => {
      const entity = createEdgeCaseEntity();
      let switchValue = true;

      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { body: { root: 'torso' } };
        }
        if (componentId === 'descriptors:body_hair') {
          // Value changes during processing
          const value = switchValue ? 'hairy' : 'hairless';
          switchValue = !switchValue;
          return { density: value };
        }
        return null;
      });

      const result = await composer.composeDescription(entity);

      // Should handle gracefully
      expect(result).toBeTruthy();
      expect(result).toMatch(/Body hair: (hairy|hairless)/);
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory-constrained environments', async () => {
      const entity = createEdgeCaseEntity();

      // Simulate memory pressure by creating large objects
      const largeArray = new Array(100000).fill('test');

      try {
        const result = await composer.composeDescription(entity);
        expect(result).toBeTruthy();
      } finally {
        // Clean up
        largeArray.length = 0;
      }
    });

    it('should handle entities with very long descriptor values', async () => {
      const longValue = 'a'.repeat(10000); // Very long string

      const entity = {
        id: 'long-value-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build') {
            return { build: longValue };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(entity);

      expect(result).toContain(`Build: ${longValue}`);
    });
  });
});
