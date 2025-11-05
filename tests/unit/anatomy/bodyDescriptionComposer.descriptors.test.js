import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Body-Level Descriptors', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;
  let mockLogger;
  let consoleWarnSpy;

  beforeEach(() => {
    // Create mocks
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Spy on console.warn for deprecation warnings
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Create composer instance
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Body-Level Descriptor Extraction', () => {
    describe('extractBuildDescription', () => {
      it('should extract build from body.descriptors.build', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  descriptors: {
                    build: 'athletic',
                  },
                },
              };
            }
            return null;
          }),
        };

        const result = composer.extractBuildDescription(mockEntity);
        expect(result).toBe('athletic');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should warn and fallback to entity-level descriptor when body.descriptors not present', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return { body: {} }; // No descriptors
            }
            if (componentId === 'descriptors:build') {
              return { build: 'muscular' };
            }
            return null;
          }),
        };

        const result = composer.extractBuildDescription(mockEntity);
        expect(result).toBe('muscular');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            '[DEPRECATION] Entity entity_123 uses entity-level descriptor'
          )
        );
      });

      it('should return empty string when no descriptors exist', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn(() => null),
        };

        const result = composer.extractBuildDescription(mockEntity);
        expect(result).toBe('');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('extractBodyHairDescription', () => {
      it('should extract density from body.descriptors.hairDensity', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  descriptors: {
                    hairDensity: 'moderate',
                  },
                },
              };
            }
            return null;
          }),
        };

        const result = composer.extractBodyHairDescription(mockEntity);
        expect(result).toBe('moderate');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should warn and fallback to entity-level descriptor', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return { body: {} };
            }
            if (componentId === 'descriptors:body_hair') {
              return { density: 'hairy' };
            }
            return null;
          }),
        };

        const result = composer.extractBodyHairDescription(mockEntity);
        expect(result).toBe('hairy');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[DEPRECATION] Entity entity_123 uses entity-level descriptor 'descriptors:body_hair'"
          )
        );
      });
    });

    describe('extractBodyCompositionDescription', () => {
      it('should extract composition from body.descriptors.composition', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  descriptors: {
                    composition: 'lean',
                  },
                },
              };
            }
            return null;
          }),
        };

        const result = composer.extractBodyCompositionDescription(mockEntity);
        expect(result).toBe('lean');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should warn and fallback to entity-level descriptor', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return { body: {} };
            }
            if (componentId === 'descriptors:body_composition') {
              return { composition: 'stocky' };
            }
            return null;
          }),
        };

        const result = composer.extractBodyCompositionDescription(mockEntity);
        expect(result).toBe('stocky');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[DEPRECATION] Entity entity_123 uses entity-level descriptor 'descriptors:body_composition'"
          )
        );
      });
    });

    describe('extractSkinColorDescription', () => {
      it('should extract skinColor from body.descriptors.skinColor', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  descriptors: {
                    skinColor: 'olive',
                  },
                },
              };
            }
            return null;
          }),
        };

        const result = composer.extractSkinColorDescription(mockEntity);
        expect(result).toBe('olive');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should warn and fallback to entity-level descriptor', () => {
        const mockEntity = {
          id: 'entity_123',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return { body: {} };
            }
            if (componentId === 'descriptors:skin_color') {
              return { skinColor: 'pale' };
            }
            return null;
          }),
        };

        const result = composer.extractSkinColorDescription(mockEntity);
        expect(result).toBe('pale');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[DEPRECATION] Entity entity_123 uses entity-level descriptor 'descriptors:skin_color'"
          )
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entity gracefully', () => {
      expect(composer.extractBuildDescription(null)).toBe('');
      expect(composer.extractBodyHairDescription(null)).toBe('');
      expect(composer.extractBodyCompositionDescription(null)).toBe('');
      expect(composer.extractSkinColorDescription(null)).toBe('');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle entity without getComponentData method', () => {
      const invalidEntity = { id: 'invalid' };
      expect(composer.extractBuildDescription(invalidEntity)).toBe('');
      expect(composer.extractBodyHairDescription(invalidEntity)).toBe('');
      expect(composer.extractBodyCompositionDescription(invalidEntity)).toBe(
        ''
      );
      expect(composer.extractSkinColorDescription(invalidEntity)).toBe('');
    });

    it('should handle getComponentData throwing error', () => {
      const mockEntity = {
        id: 'entity_123',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            throw new Error('Component access error');
          }
          return null;
        }),
      };

      expect(composer.extractBuildDescription(mockEntity)).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get anatomy:body component',
        expect.any(Error)
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should prioritize body.descriptors over entity-level descriptors', () => {
      const mockEntity = {
        id: 'entity_123',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  build: 'athletic',
                },
              },
            };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'muscular' }; // Should be ignored
          }
          return null;
        }),
      };

      const result = composer.extractBuildDescription(mockEntity);
      expect(result).toBe('athletic'); // Body-level takes precedence
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle partial body descriptors', () => {
      const mockEntity = {
        id: 'entity_123',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return {
              body: {
                descriptors: {
                  build: 'athletic',
                  // No density, composition, or skinColor
                },
              },
            };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'moderate' };
          }
          return null;
        }),
      };

      expect(composer.extractBuildDescription(mockEntity)).toBe('athletic');
      expect(composer.extractBodyHairDescription(mockEntity)).toBe('moderate');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('descriptors:body_hair')
      );
    });
  });

  describe('Deprecation Warning Messages', () => {
    it('should include migration instructions in deprecation warning', () => {
      const mockEntity = {
        id: 'test_entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: {} };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'slim' };
          }
          return null;
        }),
      };

      composer.extractBuildDescription(mockEntity);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please migrate to body.descriptors.build')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Entity-level descriptors will be removed in a future version'
        )
      );
    });

    it('should handle entity without id in deprecation warning', () => {
      const mockEntity = {
        // No id property
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return { body: {} };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'average' };
          }
          return null;
        }),
      };

      composer.extractBuildDescription(mockEntity);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATION] Entity unknown')
      );
    });
  });
});
