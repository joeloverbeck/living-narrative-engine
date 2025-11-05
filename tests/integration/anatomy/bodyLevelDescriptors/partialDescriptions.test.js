import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createPartialHumanoidEntity,
  createMinimalHumanoidEntity,
  createBodyHairVariantsEntity,
  createBodyCompositionVariantsEntity,
} from './fixtures/testEntities.js';
import {
  expectedPartialDescription,
  expectedMinimalDescription,
  expectedDescriptorValues,
} from './fixtures/expectedOutputs.js';
import {
  createFullComposer,
  normalizeDescription,
  extractDescriptorValues,
  extractDescriptorLines,
  countDescriptors,
} from './helpers/anatomyTestHelpers.js';

describe('Partial Anatomy Descriptions Integration', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Partial Descriptors', () => {
    it('should handle missing body composition gracefully', async () => {
      const entity = createPartialHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const normalized = normalizeDescription(result);
      const expected = normalizeDescription(expectedPartialDescription);

      expect(normalized).toBe(expected);
      expect(result).not.toContain('Body composition:');
    });

    it('should handle entity with no descriptors', async () => {
      const entity = createMinimalHumanoidEntity();

      const result = await composer.composeDescription(entity);

      expect(result).toBe(expectedMinimalDescription);
    });

    it('should handle mixed present and missing descriptors', async () => {
      const entity = createPartialHumanoidEntity();

      const result = await composer.composeDescription(entity);

      // Should have some descriptors
      expect(result).toContain('Build: average');
      expect(result).toContain('Body hair: light');

      // Should not have missing descriptor
      expect(result).not.toContain('Body composition:');
    });

    it('should maintain proper ordering with partial descriptors', async () => {
      const entity = createPartialHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const descriptorLines = extractDescriptorLines(result);

      // Build should come before body hair
      const buildIndex = descriptorLines.findIndex((line) =>
        line.includes('Build:')
      );
      const hairIndex = descriptorLines.findIndex((line) =>
        line.includes('Body hair:')
      );

      expect(buildIndex).toBeLessThan(hairIndex);
    });
  });

  describe('Single Descriptor Scenarios', () => {
    it('should handle only build descriptor', async () => {
      const entity = createMinimalHumanoidEntity();

      // Add only build descriptor using new format
      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'torso',
              descriptors: {
                build: 'slim',
              },
            },
          };
        }
        return null;
      });

      const result = await composer.composeDescription(entity);
      const descriptorCount = countDescriptors(result);

      expect(descriptorCount).toBe(4); // 1 body descriptor + 3 part descriptors
      expect(result).toContain('Build: slim');
    });

    it('should handle only body composition descriptor', async () => {
      const entity = createBodyCompositionVariantsEntity('chubby');

      const result = await composer.composeDescription(entity);
      const descriptorCount = countDescriptors(result);

      expect(descriptorCount).toBe(4); // 1 body descriptor + 3 part descriptors
      expect(result).toContain('Body composition: chubby');
    });

    it('should handle only body hair descriptor', async () => {
      const entity = createBodyHairVariantsEntity('hairy');

      const result = await composer.composeDescription(entity);
      const descriptorCount = countDescriptors(result);

      expect(descriptorCount).toBe(4); // 1 body descriptor + 3 part descriptors
      expect(result).toContain('Body hair: hairy');
    });
  });

  describe('Missing Component Data', () => {
    it('should handle component with null data', async () => {
      const entity = createPartialHumanoidEntity();

      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'torso',
              descriptors: {
                hairDensity: 'light',
                // build is intentionally missing (null)
              },
            },
          };
        }
        return null;
      });

      const result = await composer.composeDescription(entity);

      expect(result).not.toContain('Build:');
      expect(result).toContain('Body hair: light');
    });

    it('should handle component with empty object', async () => {
      const entity = createPartialHumanoidEntity();

      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'torso',
              descriptors: {
                hairDensity: 'light',
                // build would be undefined (not set)
              },
            },
          };
        }
        return null;
      });

      const result = await composer.composeDescription(entity);

      expect(result).not.toContain('Build:');
      expect(result).toContain('Body hair: light');
    });

    it('should handle component with wrong property names', async () => {
      const entity = createPartialHumanoidEntity();

      entity.getComponentData.mockImplementation((componentId) => {
        if (componentId === 'anatomy:body') {
          return {
            body: {
              root: 'torso',
              descriptors: {
                wrongProperty: 'athletic', // Wrong property name (not 'build')
                hairDensity: 'light',
              },
            },
          };
        }
        return null;
      });

      const result = await composer.composeDescription(entity);

      expect(result).not.toContain('Build:');
      expect(result).toContain('Body hair: light');
    });
  });

  describe('Valid Descriptor Value Variations', () => {
    it('should handle all valid body hair density values', async () => {
      const validValues = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      for (const densityValue of validValues) {
        const entity = createBodyHairVariantsEntity(densityValue);
        const result = await composer.composeDescription(entity);

        expect(result).toContain(`Body hair: ${densityValue}`);
        expect(result).toBe(expectedDescriptorValues.bodyHair[densityValue]);
      }
    });

    it('should handle all valid body composition values', async () => {
      const validValues = ['lean', 'average', 'chubby', 'fat'];

      for (const compositionValue of validValues) {
        const entity = createBodyCompositionVariantsEntity(compositionValue);
        const result = await composer.composeDescription(entity);

        expect(result).toContain(`Body composition: ${compositionValue}`);
        expect(result).toBe(
          expectedDescriptorValues.bodyComposition[compositionValue]
        );
      }
    });

    it('should handle all valid build values', async () => {
      const validBuilds = ['athletic', 'average', 'stocky', 'slim'];

      for (const buildValue of validBuilds) {
        const entity = createMinimalHumanoidEntity();

        entity.getComponentData.mockImplementation((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'torso',
                descriptors: {
                  build: buildValue,
                },
              },
            };
          }
          return null;
        });

        const result = await composer.composeDescription(entity);

        expect(result).toContain(`Build: ${buildValue}`);
        expect(result).toBe(expectedDescriptorValues.build[buildValue]);
      }
    });
  });

  describe('Partial Data with Parts', () => {
    it('should include part descriptions even with minimal descriptors', async () => {
      const entity = createMinimalHumanoidEntity();

      const result = await composer.composeDescription(entity);

      // Even with no body descriptors, should still have part descriptions
      expect(result).toContain('Head: Generated description for head-part-id');
      expect(result).toContain('Hair: Generated description for hair-part-id');
      expect(result).toContain('Eyes: Generated description for eyes-part-id');
    });

    it('should properly combine partial descriptors with part descriptions', async () => {
      const entity = createPartialHumanoidEntity();

      const result = await composer.composeDescription(entity);

      // Should have partial descriptors
      expect(result).toContain('Build: average');
      expect(result).toContain('Body hair: light');

      // Should also have part descriptions
      expect(result).toContain('Head: Generated description for head-part-id');
    });

    it('should maintain proper ordering with partial descriptors and parts', async () => {
      const entity = createPartialHumanoidEntity();

      const result = await composer.composeDescription(entity);
      const lines = result.split('\n').filter((line) => line.trim());

      // Descriptors should come before part descriptions
      const descriptorLines = lines.filter(
        (line) =>
          line.includes(':') &&
          (line.includes('Build:') || line.includes('Body hair:'))
      );
      const partLines = lines.filter((line) => !line.includes(':'));

      if (descriptorLines.length > 0 && partLines.length > 0) {
        const lastDescriptorIndex = lines.lastIndexOf(
          descriptorLines[descriptorLines.length - 1]
        );
        const firstPartIndex = lines.indexOf(partLines[0]);
        expect(lastDescriptorIndex).toBeLessThan(firstPartIndex);
      }
    });
  });

  describe('Edge Cases in Partial Data', () => {
    it('should handle entity that reports having component but returns null data', async () => {
      const entity = {
        id: 'inconsistent-entity',
        hasComponent: jest.fn().mockReturnValue(true), // Claims to have component
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: { root: 'torso' } };
          }
          return null; // But returns null for all other components
        }),
      };

      const result = await composer.composeDescription(entity);

      // Should handle gracefully
      expect(result).toBeTruthy();
      expect(result).not.toContain('Build:');
      expect(result).not.toContain('Body composition:');
      expect(result).not.toContain('Body hair:');
    });

    it('should handle rapidly changing component availability', async () => {
      const entity = createPartialHumanoidEntity();
      let callCount = 0;

      entity.getComponentData.mockImplementation((componentId) => {
        callCount++;
        if (componentId === 'anatomy:body') {
          // Simulate descriptors appearing/disappearing
          const descriptors = {};
          if (callCount % 2 === 0) {
            descriptors.build = 'average';
          }
          descriptors.hairDensity = 'light';

          return {
            body: {
              root: 'torso',
              descriptors: descriptors,
            },
          };
        }
        return null;
      });

      // Should handle inconsistent state gracefully
      await expect(composer.composeDescription(entity)).resolves.toBeTruthy();
    });
  });

  describe('Performance with Partial Data', () => {
    it('should perform efficiently with minimal descriptors', async () => {
      const entity = createMinimalHumanoidEntity();

      const start = performance.now();
      const result = await composer.composeDescription(entity);
      const duration = performance.now() - start;

      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(20); // Should be even faster with less data
    });

    it('should handle many entities with varying partial data efficiently', async () => {
      const entities = [
        createMinimalHumanoidEntity(),
        createPartialHumanoidEntity(),
        createBodyHairVariantsEntity('sparse'),
        createBodyCompositionVariantsEntity('lean'),
      ];

      const start = performance.now();
      for (const entity of entities) {
        await composer.composeDescription(entity);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
