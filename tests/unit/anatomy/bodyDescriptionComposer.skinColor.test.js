/**
 * @file Unit tests for BodyDescriptionComposer skinColor descriptor extraction
 * @description Tests that skinColor is properly extracted and displayed in body descriptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - SkinColor Descriptor', () => {
  let composer;
  let mockServices;

  beforeEach(() => {
    // Create minimal mock services
    mockServices = {
      bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
      bodyGraphService: { getAllParts: jest.fn(() => []) },
      entityFinder: { getEntityInstance: jest.fn() },
      anatomyFormattingService: {
        formatDescriptorValue: jest.fn((value) => value),
        formatPartName: jest.fn((name) => name),
        getDescriptionOrder: jest.fn(() => [
          'height',
          'skin_color',
          'build',
          'body_composition',
          'body_hair',
          'head',
          'torso',
        ]),
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

  describe('extractSkinColorDescription', () => {
    it('should extract skinColor from body.descriptors', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'test-root-id',
                descriptors: {
                  skinColor: 'tanned',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const skinColor = composer.extractSkinColorDescription(mockBodyEntity);

      expect(skinColor).toBe('tanned');
    });

    it('should return empty string when skinColor is not defined', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'test-root-id',
                descriptors: {
                  build: 'athletic',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const skinColor = composer.extractSkinColorDescription(mockBodyEntity);

      expect(skinColor).toBe('');
    });

    it('should handle various skinColor values', () => {
      const testCases = [
        'fair',
        'tanned',
        'olive',
        'dark',
        'ebony',
        'pale',
        'bronze',
      ];

      for (const skinColorValue of testCases) {
        const mockBodyEntity = {
          hasComponent: jest.fn(
            (componentId) => componentId === 'anatomy:body'
          ),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'test-root-id',
                  descriptors: {
                    skinColor: skinColorValue,
                  },
                },
              };
            }
            return null;
          }),
          id: 'test-entity-id',
        };

        const skinColor = composer.extractSkinColorDescription(mockBodyEntity);

        expect(skinColor).toBe(skinColorValue);
      }
    });
  });

  describe('extractBodyLevelDescriptors with skinColor', () => {
    it('should include skinColor in body-level descriptors', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'test:recipe',
              body: {
                root: 'test-root-id',
                descriptors: {
                  build: 'athletic',
                  composition: 'lean',
                  hairDensity: 'moderate',
                  skinColor: 'olive',
                  height: 'tall',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors.skin_color).toBe('Skin color: olive');
      expect(descriptors.build).toBe('Build: athletic');
      expect(descriptors.body_composition).toBe('Body composition: lean');
      expect(descriptors.body_hair).toBe('Body hair: moderate');
      expect(descriptors.height).toBe('Height: tall');
    });

    it('should format skinColor with proper label', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'test-root-id',
                descriptors: {
                  skinColor: 'fair',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors.skin_color).toBe('Skin color: fair');
    });
  });

  describe('composeDescription with skinColor', () => {
    it('should include skinColor in composed description', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  height: 'average',
                  skinColor: 'tanned',
                  build: 'muscular',
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

      // Mock the services to return minimal data
      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // Should contain the skinColor descriptor
      expect(description).toContain('Skin color: tanned');
      // Should also contain other descriptors
      expect(description).toContain('Height: average');
      expect(description).toContain('Build: muscular');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: hairy');
    });

    it('should place skinColor in correct order in description', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  height: 'tall',
                  skinColor: 'olive',
                  build: 'athletic',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      // Mock at least one body part so the composer continues processing
      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // Check that descriptors appear in the configured order
      const heightIndex = description.indexOf('Height: tall');
      const skinColorIndex = description.indexOf('Skin color: olive');
      const buildIndex = description.indexOf('Build: athletic');

      expect(heightIndex).toBeGreaterThan(-1);
      expect(skinColorIndex).toBeGreaterThan(-1);
      expect(buildIndex).toBeGreaterThan(-1);

      // Height should come before skin color (based on our mock descriptionOrder)
      expect(heightIndex).toBeLessThan(skinColorIndex);
      // Skin color should come before build (based on our mock descriptionOrder)
      expect(skinColorIndex).toBeLessThan(buildIndex);
    });

    it('should work without skinColor when not provided', async () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  build: 'slim',
                  composition: 'average',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      // Mock at least one body part so the composer continues processing
      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // Should NOT contain skin color
      expect(description).not.toContain('Skin color:');
      // Should still contain other descriptors
      expect(description).toContain('Build: slim');
      expect(description).toContain('Body composition: average');
    });
  });
});
