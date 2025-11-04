import { describe, it, expect, beforeEach } from '@jest/globals';
import { createCompleteHumanoidEntity } from './fixtures/testEntities.js';
import {
  expectedCompleteDescription,
  expectedDescriptorOrder,
  testDataCombinations,
} from './fixtures/expectedOutputs.js';
import {
  createFullComposer,
  createRealisticComposer,
  normalizeDescription,
  extractDescriptorValues,
  validateDescriptorOrder,
  countDescriptors,
  extractDescriptorLines,
  validateAcceptanceCriteria,
} from './helpers/anatomyTestHelpers.js';

describe('Complete Anatomy Descriptions Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Full Entity Descriptions', () => {
    it('should generate complete description with all descriptors', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedCompleteDescription);

      expect(normalized).toBe(expected);
    });

    it('should include body-level descriptors in correct order', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);

      expect(result).toContain('Height: average');
      expect(result).toContain('Skin color: olive');
      expect(result).toContain('Build: athletic');
      expect(result).toContain('Body composition: lean');
      expect(result).toContain('Body hair: moderate');

      // Validate ordering
      const orderCheck = validateDescriptorOrder(
        result,
        expectedDescriptorOrder
      );
      expect(orderCheck.matches).toBe(true);
    });

    it('should handle body-level descriptors with generated part descriptions', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);

      // Entity-level body descriptors
      expect(result).toContain('Body hair: moderate');

      // Generated part descriptions
      expect(result).toContain('Head: Generated description for head-part-id');
      expect(result).toContain('Hair: Generated description for hair-part-id');
    });

    it('should generate consistent results across multiple calls', async () => {
      const entity = createCompleteHumanoidEntity();

      const result1 = await composer.composeDescription(entity);
      const result2 = await composer.composeDescription(entity);
      const result3 = await composer.composeDescription(entity);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('Descriptor Value Extraction', () => {
    it('should extract all descriptor values correctly', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const values = extractDescriptorValues(result);

      expect(values).toMatchObject({
        Height: 'average',
        'Skin color': 'olive',
        Build: 'athletic',
        'Body composition': 'lean',
        'Body hair': 'moderate',
      });
    });

    it('should handle all valid descriptor combinations', async () => {
      // Test with predefined combinations
      for (const combination of testDataCombinations) {
        const entity = createCompleteHumanoidEntity();

        // Mock the entity to return specific values
        entity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'torso' } };
          }
          if (componentId === 'descriptors:build' && combination.config.build) {
            return { build: combination.config.build };
          }
          if (
            componentId === 'descriptors:body_composition' &&
            combination.config.bodyComposition
          ) {
            return { composition: combination.config.bodyComposition };
          }
          if (
            componentId === 'descriptors:body_hair' &&
            combination.config.bodyHair
          ) {
            return { density: combination.config.bodyHair };
          }
          return null;
        });

        const result = await composer.composeDescription(entity);
        const descriptorLines = extractDescriptorLines(result);
        const expectedLines = combination.expected
          .split('\n')
          .filter((line) => line.includes(':'));

        expect(descriptorLines).toEqual(expect.arrayContaining(expectedLines));
      }
    });
  });

  describe('Complex Entity Scenarios', () => {
    it('should handle performance with large entities', async () => {
      const entity = createCompleteHumanoidEntity();

      // Mock bodyGraphService to return many parts
      const manyPartIds = Array.from({ length: 20 }, (_, i) => `part-${i}`);
      composer.bodyGraphService.getAllParts.mockReturnValue(manyPartIds);

      // Should not throw or have performance issues
      const start = performance.now();
      const result = await composer.composeDescription(entity);
      const duration = performance.now() - start;

      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(100); // Should complete quickly
    });

    it('should handle circular references gracefully', async () => {
      const entity = createCompleteHumanoidEntity();
      entity.circularRef = entity; // Create circular reference

      // Should not cause infinite loop
      await expect(composer.composeDescription(entity)).resolves.toBeTruthy();
    });

    it('should handle entities with no anatomy:body component', async () => {
      const entity = {
        id: 'no-body-entity',
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn().mockReturnValue(null),
      };

      const result = await composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should handle null or undefined entities', async () => {
      const nullResult = await composer.composeDescription(null);
      expect(nullResult).toBe('');

      const undefinedResult = await composer.composeDescription(undefined);
      expect(undefinedResult).toBe('');
    });
  });

  describe('Service Integration', () => {
    it('should properly integrate with all required services', async () => {
      const entity = createCompleteHumanoidEntity();

      await composer.composeDescription(entity);

      // Verify all services were called appropriately
      expect(composer.bodyGraphService.getAllParts).toHaveBeenCalled();
      expect(
        composer.anatomyFormattingService.getDescriptionOrder
      ).toHaveBeenCalled();
      expect(composer.entityFinder.getEntityInstance).toHaveBeenCalled();
    });

    it('should handle service dependencies correctly', async () => {
      const realisticComposer = createRealisticComposer();
      const entity = createCompleteHumanoidEntity();

      const result = await realisticComposer.composeDescription(entity);

      expect(result).toBeTruthy();
      expect(result).toContain('Build: athletic');
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('should meet all NEWDESC-06 acceptance criteria', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const criteria = validateAcceptanceCriteria(result, entity, composer);

      // Validate key acceptance criteria
      expect(criteria.hasBodyLevelDescriptors).toBe(true);
      expect(criteria.hasCorrectOrdering).toBe(true);
      expect(criteria.includesPartDescriptions).toBe(true);
    });

    it('should validate descriptor count matches expectations', async () => {
      const entity = createCompleteHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const descriptorCount = countDescriptors(result);

      // Should have build, body_composition, and body_hair descriptors
      expect(descriptorCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle real-world entity configurations', async () => {
      const entity = createCompleteHumanoidEntity();

      // Simulate more realistic component structure
      entity.hasComponent.mockImplementation((componentId) => {
        const validComponents = [
          'anatomy:body',
          'descriptors:build',
          'descriptors:body_composition',
          'descriptors:body_hair',
          'core:transform',
          'core:metadata',
        ];
        return validComponents.includes(componentId);
      });

      const result = await composer.composeDescription(entity);

      expect(result).toBeTruthy();
      expect(result).toMatch(/Build: athletic/);
      expect(result).toMatch(/Body composition: lean/);
      expect(result).toMatch(/Body hair: moderate/);
    });
  });

  describe('Error Recovery', () => {
    it('should gracefully handle missing part entities', async () => {
      const entity = createCompleteHumanoidEntity();

      // Mock entityFinder to return null for some parts
      composer.entityFinder.getEntityInstance.mockImplementation((partId) => {
        if (partId === 'head-part-id') {
          return null; // Simulate missing entity
        }
        return {
          id: partId,
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType: 'hair' };
            }
            return null;
          }),
        };
      });

      const result = await composer.composeDescription(entity);

      // Should still work with remaining parts
      expect(result).toContain('Build: athletic');
      expect(result).not.toContain(
        'Head: Generated description for head-part-id'
      );
    });

    it('should handle malformed anatomy formatting service responses', async () => {
      const entity = createCompleteHumanoidEntity();

      // Mock service to return unexpected data
      composer.anatomyFormattingService.getDescriptionOrder.mockReturnValue(
        null
      );

      // Should not throw
      await expect(composer.composeDescription(entity)).resolves.toBeTruthy();
    });
  });
});
