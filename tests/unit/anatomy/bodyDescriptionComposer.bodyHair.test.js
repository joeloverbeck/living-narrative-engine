import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - extractBodyHairDescription', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockPartDescriptionGenerator;

  beforeEach(() => {
    // Create mocks following existing pattern
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

    // Create composer instance with actual constructor signature
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  describe('Valid Input Cases', () => {
    it('should extract body hair density when component exists', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null; // Primary lookup fails, triggers fallback
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 'moderate' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('moderate');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_hair'
      );
    });

    it('should handle all valid density values', () => {
      const validValues = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      validValues.forEach((value) => {
        const mockEntity = {
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:body') {
              return null; // Primary lookup fails, triggers fallback
            }
            if (componentId === 'descriptors:body_hair') {
              return { hairDensity: value };
            }
            return null;
          }),
        };

        const result = composer.extractBodyHairDescription(mockEntity);
        expect(result).toBe(value);
      });
    });

    it('should handle hyphenated value "very-hairy"', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 'very-hairy' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('very-hairy');
    });
  });

  describe('Invalid Input Cases', () => {
    it('should return empty string when bodyEntity is null', () => {
      const result = composer.extractBodyHairDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity is undefined', () => {
      const result = composer.extractBodyHairDescription(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity lacks getComponentData', () => {
      const mockEntity = { someOtherMethod: jest.fn() };
      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when getComponentData is not a function', () => {
      const mockEntity = { getComponentData: 'not a function' };
      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component does not exist', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_hair'
      );
    });

    it('should return empty string when component is undefined', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => undefined),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_hair'
      );
    });

    it('should return empty string when component lacks density property', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null; // Primary lookup fails
          }
          if (componentId === 'descriptors:body_hair') {
            return {
              value: 'moderate', // Wrong property name
              hair: 'moderate', // Wrong property name
            };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when density is null', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: null };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when density is undefined', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: undefined };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when density is empty string', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: '' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity with getComponentData that throws error', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => {
          throw new Error('Component system error');
        }),
      };

      expect(() => {
        composer.extractBodyHairDescription(mockEntity);
      }).toThrow('Component system error');
    });

    it('should handle density with unexpected type - number', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 123 };
          }
          return null;
        }),
      };

      // Should return the value as-is
      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe(123);
    });

    it('should handle density with unexpected type - boolean', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: true };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe(true);
    });

    it('should handle density with unexpected type - object', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: { nested: 'value' } };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toEqual({ nested: 'value' });
    });
  });

  describe('Type Validation', () => {
    it('should validate bodyEntity parameter type', () => {
      // Test with various non-object types
      const invalidInputs = [123, 'string', true, false, [], Symbol('test')];

      invalidInputs.forEach((input) => {
        const result = composer.extractBodyHairDescription(input);
        expect(result).toBe('');
      });
    });

    it('should handle object without getComponentData method', () => {
      const objectWithoutMethod = {
        hasComponent: jest.fn(),
        someOtherProp: 'value',
      };

      const result = composer.extractBodyHairDescription(objectWithoutMethod);
      expect(result).toBe('');
    });
  });

  describe('Component Data Structure Validation', () => {
    it('should handle component with different property names', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return {
              build: 'muscular', // Wrong property name
              value: 'moderate', // Wrong property name
              type: 'hairy', // Wrong property name
            };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should handle component with density property set to false', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: false };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should handle component with density property set to 0', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 0 };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should handle component with additional properties', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return {
              hairDensity: 'moderate',
              color: 'brown', // Additional property
              texture: 'coarse', // Additional property
            };
          }
          return null;
        }),
      };

      const result = composer.extractBodyHairDescription(mockEntity);
      expect(result).toBe('moderate');
    });
  });

  describe('Method Integration', () => {
    it('should work consistently with multiple calls', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 'hairy' };
          }
          return null;
        }),
      };

      const result1 = composer.extractBodyHairDescription(mockEntity);
      const result2 = composer.extractBodyHairDescription(mockEntity);
      const result3 = composer.extractBodyHairDescription(mockEntity);

      expect(result1).toBe('hairy');
      expect(result2).toBe('hairy');
      expect(result3).toBe('hairy');
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(6);
    });

    it('should not modify the input entity', () => {
      const originalEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:body') {
            return null;
          }
          if (componentId === 'descriptors:body_hair') {
            return { hairDensity: 'sparse' };
          }
          return null;
        }),
        otherProperty: 'should not change',
      };

      const result = composer.extractBodyHairDescription(originalEntity);

      expect(result).toBe('sparse');
      expect(originalEntity.otherProperty).toBe('should not change');
      expect(typeof originalEntity.getComponentData).toBe('function');
    });
  });
});
