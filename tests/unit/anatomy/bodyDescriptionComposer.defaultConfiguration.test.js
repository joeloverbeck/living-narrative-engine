/**
 * @file Unit tests for BodyDescriptionComposer using default configuration
 * @description Tests that verify body descriptors work correctly with default description order
 * This test reproduces the issue where smell descriptor is missing from descriptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Default Configuration', () => {
  let composer;
  let mockServices;

  beforeEach(() => {
    // Create mock services WITHOUT overriding getDescriptionOrder
    // This will use the default description order from DescriptionConfiguration
    mockServices = {
      bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
      bodyGraphService: { getAllParts: jest.fn(() => []) },
      entityFinder: { getEntityInstance: jest.fn() },
      anatomyFormattingService: {
        // Do NOT mock getDescriptionOrder - let it use defaults
        formatDescriptorValue: jest.fn((value) => value),
        formatPartName: jest.fn((name) => name),
      },
      partDescriptionGenerator: { generatePartDescription: jest.fn() },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    composer = new BodyDescriptionComposer(mockServices);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('composeDescription with default configuration', () => {
    it('should include ALL body descriptors including skinColor and smell', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  height: 'gigantic',
                  build: 'hulking',
                  composition: 'lean',
                  skinColor: 'fair',
                  smell: 'musky',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      // Mock minimal body parts
      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // These should ALL appear in the description
      expect(description).toContain('Height: gigantic');
      expect(description).toContain('Build: hulking');
      expect(description).toContain('Body composition: lean');

      // BUG REPRODUCTION: These are missing from the description
      // even though they are specified in bodyDescriptors
      expect(description).toContain('Skin color: fair');
      expect(description).toContain('Smell: musky');
    });

    it('should include smell when only smell is specified', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  smell: 'pungent manly perfume',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // BUG REPRODUCTION: smell is missing even though it's the only descriptor
      expect(description).toContain('Smell: pungent manly perfume');
    });

    it('should include skinColor when only skinColor is specified', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  skinColor: 'olive',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      expect(description).toContain('Skin color: olive');
    });

    it('should respect descriptor order from default configuration', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  smell: 'musky',
                  skinColor: 'tanned',
                  height: 'tall',
                  build: 'athletic',
                  composition: 'lean',
                  hairDensity: 'hairy',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // All descriptors should be present
      expect(description).toContain('Height: tall');
      expect(description).toContain('Skin color: tanned');
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: hairy');
      expect(description).toContain('Smell: musky');

      // Verify ordering based on default configuration
      // Default order: height, build, body_composition, body_hair, skin_color, ...
      // (Note: smell should also be in this order after the fix)
      const heightIndex = description.indexOf('Height: tall');
      const skinColorIndex = description.indexOf('Skin color: tanned');
      const buildIndex = description.indexOf('Build: athletic');
      const compositionIndex = description.indexOf('Body composition: lean');
      const bodyHairIndex = description.indexOf('Body hair: hairy');
      const smellIndex = description.indexOf('Smell: musky');

      expect(heightIndex).toBeGreaterThan(-1);
      expect(buildIndex).toBeGreaterThan(-1);
      expect(compositionIndex).toBeGreaterThan(-1);
      expect(bodyHairIndex).toBeGreaterThan(-1);
      expect(skinColorIndex).toBeGreaterThan(-1);
      expect(smellIndex).toBeGreaterThan(-1);

      // Height should come first
      expect(heightIndex).toBeLessThan(buildIndex);
      expect(heightIndex).toBeLessThan(compositionIndex);
      expect(heightIndex).toBeLessThan(bodyHairIndex);
      expect(heightIndex).toBeLessThan(skinColorIndex);
    });
  });
});
