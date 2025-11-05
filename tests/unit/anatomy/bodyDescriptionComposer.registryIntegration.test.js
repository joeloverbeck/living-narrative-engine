/**
 * @file Unit tests for BodyDescriptionComposer registry integration
 * @description Tests the integration between BodyDescriptionComposer and bodyDescriptorRegistry
 * to verify that the refactored implementation uses the registry correctly
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { BODY_DESCRIPTOR_REGISTRY } from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('BodyDescriptionComposer - Registry Integration', () => {
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

  describe('extractBodyLevelDescriptors - Registry Usage', () => {
    it('should extract descriptors using registry extractors', () => {
      // Create entity with body descriptors in anatomy:body component
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  height: 'tall',
                  skinColor: 'tan',
                  build: 'athletic',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Verify registry descriptors processed with correct display keys
      expect(descriptors).toHaveProperty('height');
      expect(descriptors).toHaveProperty('skin_color'); // Note: snake_case display key
      expect(descriptors).toHaveProperty('build');
    });

    it('should use registry formatters for descriptor values', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { height: 'tall' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Verify formatter applied (includes label)
      expect(descriptors.height).toBe('Height: tall');
    });

    it('should handle missing descriptors gracefully', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return { body: { descriptors: {} } }; // No descriptors
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Should return empty object, not throw
      expect(descriptors).toEqual({});
    });

    it('should process all registry descriptors in display order', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  height: 'tall',
                  skinColor: 'tan',
                  build: 'athletic',
                  composition: 'lean',
                  hairDensity: 'moderate',
                  smell: 'clean',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Verify all descriptors are extracted with correct display keys
      expect(descriptors).toHaveProperty('height');
      expect(descriptors).toHaveProperty('skin_color');
      expect(descriptors).toHaveProperty('build');
      expect(descriptors).toHaveProperty('body_composition');
      expect(descriptors).toHaveProperty('body_hair');
      expect(descriptors).toHaveProperty('smell');

      // Verify formatting is applied
      expect(descriptors.height).toBe('Height: tall');
      expect(descriptors.skin_color).toBe('Skin color: tan');
      expect(descriptors.build).toBe('Build: athletic');
      expect(descriptors.body_composition).toBe('Body composition: lean');
      expect(descriptors.body_hair).toBe('Body hair: moderate');
      expect(descriptors.smell).toBe('Smell: clean');
    });
  });

  describe('getBodyDescriptorOrder - Registry Derivation', () => {
    it('should filter config order to registry display keys', () => {
      // Mock config with various types including non-descriptor types
      const mockConfig = ['height', 'head', 'skin_color', 'torso', 'build'];
      const order = composer.getBodyDescriptorOrder(mockConfig);

      // Should only include descriptor types from registry
      expect(order).toEqual(['height', 'skin_color', 'build']);
      expect(order).not.toContain('head');
      expect(order).not.toContain('torso');
    });

    it('should maintain config-specified order for descriptors', () => {
      // Config with descriptors in non-default order
      const mockConfig = ['smell', 'build', 'height', 'skin_color'];
      const order = composer.getBodyDescriptorOrder(mockConfig);

      // Should maintain the config order for registry descriptors
      expect(order).toEqual(['smell', 'build', 'height', 'skin_color']);
    });

    it('should ensure height is first if missing from config', () => {
      // Config without height
      const mockConfig = ['skin_color', 'build', 'body_composition'];
      const order = composer.getBodyDescriptorOrder(mockConfig);

      // Height should be prepended
      expect(order[0]).toBe('height');
      expect(order).toContain('skin_color');
      expect(order).toContain('build');
      expect(order).toContain('body_composition');
    });

    it('should handle empty config array', () => {
      const mockConfig = [];
      const order = composer.getBodyDescriptorOrder(mockConfig);

      // Should return only height as defensive measure
      expect(order).toEqual(['height']);
    });

    it('should derive all display keys from registry', () => {
      // Use all registry display keys
      const allDisplayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY).map(
        (meta) => meta.displayKey
      );
      const order = composer.getBodyDescriptorOrder(allDisplayKeys);

      // Should return all of them in the provided order
      expect(order).toEqual(allDisplayKeys);
    });
  });

  describe('Individual Extraction Methods - Backward Compatibility', () => {
    it('should maintain backward compatibility with extractHeightDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { height: 'tall' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      // Individual method should return raw value (not formatted)
      const height = composer.extractHeightDescription(bodyEntity);
      expect(height).toBe('tall'); // Not "Height: tall"
    });

    it('should maintain backward compatibility with extractSkinColorDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { skinColor: 'olive' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const skinColor = composer.extractSkinColorDescription(bodyEntity);
      expect(skinColor).toBe('olive'); // Not "Skin color: olive"
    });

    it('should maintain backward compatibility with extractBuildDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { build: 'athletic' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const build = composer.extractBuildDescription(bodyEntity);
      expect(build).toBe('athletic'); // Not "Build: athletic"
    });

    it('should maintain backward compatibility with extractBodyCompositionDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { composition: 'lean' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const composition =
        composer.extractBodyCompositionDescription(bodyEntity);
      expect(composition).toBe('lean'); // Not "Body composition: lean"
    });

    it('should maintain backward compatibility with extractBodyHairDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { hairDensity: 'moderate' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const hairDensity = composer.extractBodyHairDescription(bodyEntity);
      expect(hairDensity).toBe('moderate'); // Not "Body hair: moderate"
    });

    it('should maintain backward compatibility with extractSmellDescription', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: { smell: 'fresh' } },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const smell = composer.extractSmellDescription(bodyEntity);
      expect(smell).toBe('fresh'); // Not "Smell: fresh"
    });

    it('should return empty string when descriptor is missing', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: { descriptors: {} },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      expect(composer.extractHeightDescription(bodyEntity)).toBe('');
      expect(composer.extractSkinColorDescription(bodyEntity)).toBe('');
      expect(composer.extractBuildDescription(bodyEntity)).toBe('');
      expect(composer.extractBodyCompositionDescription(bodyEntity)).toBe('');
      expect(composer.extractBodyHairDescription(bodyEntity)).toBe('');
      expect(composer.extractSmellDescription(bodyEntity)).toBe('');
    });
  });

  describe('Registry-Based Formatting Consistency', () => {
    it('should apply consistent formatting across all descriptors', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  height: 'tall',
                  skinColor: 'tan',
                  build: 'athletic',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Verify all use consistent "Label: value" format
      expect(descriptors.height).toMatch(/^Height: /);
      expect(descriptors.skin_color).toMatch(/^Skin color: /);
      expect(descriptors.build).toMatch(/^Build: /);
    });

    it('should use registry formatter exactly as defined', () => {
      const bodyEntity = {
        hasComponent: jest.fn((id) => id === 'anatomy:body'),
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  height: 'tall',
                },
              },
            };
          }
          return null;
        }),
        id: 'test-entity',
      };

      const descriptors = composer.extractBodyLevelDescriptors(bodyEntity);

      // Should match the exact formatter output from registry
      const expectedFormatted =
        BODY_DESCRIPTOR_REGISTRY.height.formatter('tall');
      expect(descriptors.height).toBe(expectedFormatted);
    });
  });
});
