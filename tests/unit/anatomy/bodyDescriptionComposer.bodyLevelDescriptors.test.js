/**
 * @file Unit tests for BodyDescriptionComposer body-level descriptor extraction
 * @description Isolates the body-level descriptor extraction logic to identify
 * where the issue occurs in the descriptor processing pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Body Level Descriptors', () => {
  let composer;
  let mockBodyEntity;
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
          'build',
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

  describe('extractBodyLevelDescriptors', () => {
    it('should extract body-level descriptors from anatomy:body component with body.descriptors', () => {
      // Mock entity with body.descriptors containing the recipe bodyDescriptors
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'test:recipe',
              body: {
                root: 'test-root-id',
                descriptors: {
                  build: 'stocky', // From recipe bodyDescriptors
                  hairDensity: 'hairy', // From recipe bodyDescriptors
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      console.log('Extracted Descriptors:', descriptors);

      // Should extract the descriptors with proper formatting
      expect(descriptors).toBeDefined();
      expect(descriptors.build).toBe('Build: stocky');
      expect(descriptors.body_hair).toBe('Body hair: hairy');
    });

    it('should handle missing anatomy:body component gracefully', () => {
      mockBodyEntity = {
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(() => null),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors).toEqual({});
    });

    it('should handle entity with anatomy:body but no body.descriptors', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'test:recipe',
              body: {
                root: 'test-root-id',
                // No descriptors property
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors).toEqual({});
    });

    it('should extract multiple descriptor types correctly', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              recipeId: 'test:recipe',
              body: {
                root: 'test-root-id',
                descriptors: {
                  build: 'stocky',
                  hairDensity: 'hairy',
                  skinColor: 'tan',
                  composition: 'muscular',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const descriptors = composer.extractBodyLevelDescriptors(mockBodyEntity);

      expect(descriptors.build).toBe('Build: stocky');
      expect(descriptors.body_hair).toBe('Body hair: hairy');
      expect(descriptors.skin_color).toBe('Skin color: tan');
      expect(descriptors.body_composition).toBe('Body composition: muscular');
    });
  });

  describe('extractBuildDescription', () => {
    it('should extract build descriptor from body.descriptors', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  build: 'stocky',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const buildDescription = composer.extractBuildDescription(mockBodyEntity);

      expect(buildDescription).toBe('stocky');
    });

    it('should return empty string when no build descriptor exists', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {},
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const buildDescription = composer.extractBuildDescription(mockBodyEntity);

      expect(buildDescription).toBe('');
    });
  });

  describe('extractBodyHairDescription', () => {
    it('should extract body hair descriptor from body.descriptors.hairDensity', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  hairDensity: 'hairy',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const bodyHairDescription =
        composer.extractBodyHairDescription(mockBodyEntity);

      expect(bodyHairDescription).toBe('hairy');
    });

    it('should return empty string when no density descriptor exists', () => {
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {},
              },
            };
          }
          return null;
        }),
        id: 'test-entity-id',
      };

      const bodyHairDescription =
        composer.extractBodyHairDescription(mockBodyEntity);

      expect(bodyHairDescription).toBe('');
    });
  });

  describe('composeDescription integration', () => {
    it('should include body-level descriptors in composed description', async () => {
      // Mock entity with body descriptors and some parts
      mockBodyEntity = {
        hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                root: 'root-part-id',
                descriptors: {
                  build: 'stocky',
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

      console.log('Composed Description:', description);

      // Should contain the body-level descriptors
      expect(description).toContain('Build: stocky');
      expect(description).toContain('Body hair: hairy');
    });
  });
});
