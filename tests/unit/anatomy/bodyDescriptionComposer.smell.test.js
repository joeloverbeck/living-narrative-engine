/**
 * @file Unit tests for BodyDescriptionComposer smell descriptor extraction
 * @description Tests that smell is properly extracted and displayed in body descriptions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Smell Descriptor', () => {
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
          'smell',
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

  describe('extractSmellDescription', () => {
    it('should extract smell from body.descriptors', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'test-root-id',
                descriptors: {
                  smell: 'musky',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const smell = composer.extractSmellDescription(mockBodyEntity);

      expect(smell).toBe('musky');
    });

    it('should return empty string when smell is not defined', () => {
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

      const smell = composer.extractSmellDescription(mockBodyEntity);

      expect(smell).toBe('');
    });

    it('should handle various smell values', () => {
      const testCases = [
        'musky',
        'sweaty and musky',
        'pungent manly perfume',
        'rotten meat and feces',
        'fresh and clean',
        'earthy and natural',
      ];

      for (const smellValue of testCases) {
        const mockBodyEntity = {
          hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'test-root-id',
                  descriptors: {
                    smell: smellValue,
                  },
                },
              };
            }
            return null;
          }),
          id: 'test-entity-id',
        };

        const smell = composer.extractSmellDescription(mockBodyEntity);

        expect(smell).toBe(smellValue);
      }
    });
  });

  describe('extractBodyLevelDescriptors with smell', () => {
    it('should include smell in body-level descriptors', () => {
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
                  smell: 'musky',
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

      expect(descriptors.smell).toBe('Smell: musky');
      expect(descriptors.skin_color).toBe('Skin color: olive');
      expect(descriptors.build).toBe('Build: athletic');
      expect(descriptors.body_composition).toBe('Body composition: lean');
      expect(descriptors.body_hair).toBe('Body hair: moderate');
      expect(descriptors.height).toBe('Height: tall');
    });

    it('should format smell with proper label', () => {
      const mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'test-root-id',
                descriptors: {
                  smell: 'sweaty and musky',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors.smell).toBe('Smell: sweaty and musky');
    });
  });

  describe('composeDescription with smell', () => {
    it('should include smell in composed description', async () => {
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
                  smell: 'pungent manly perfume',
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

      // Should contain the smell descriptor
      expect(description).toContain('Smell: pungent manly perfume');
      // Should also contain other descriptors
      expect(description).toContain('Height: average');
      expect(description).toContain('Skin color: tanned');
      expect(description).toContain('Build: muscular');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: hairy');
    });

    it('should work without smell when not provided', async () => {
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

      mockServices.bodyGraphService.getAllParts.mockReturnValue(['torso-id']);
      mockServices.entityFinder.getEntityInstance.mockReturnValue({
        hasComponent: () => true,
        getComponentData: () => ({ subType: 'torso' }),
      });

      const description = await composer.composeDescription(mockBodyEntity);

      // Should NOT contain smell
      expect(description).not.toContain('Smell:');
      // Should still contain other descriptors
      expect(description).toContain('Build: slim');
      expect(description).toContain('Body composition: average');
    });
  });
});
