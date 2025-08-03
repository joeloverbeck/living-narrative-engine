import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - extractBodyCompositionDescription', () => {
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
    it('should extract body composition when component exists', () => {
      const mockEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'descriptors:body_composition') {
            return { composition: 'average' };
          }
          return null;
        }),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('average');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_composition'
      );
    });

    it('should handle all valid composition values', () => {
      const validValues = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];

      validValues.forEach((value) => {
        const mockEntity = {
          getComponentData: jest.fn(() => ({ composition: value })),
        };

        const result = composer.extractBodyCompositionDescription(mockEntity);
        expect(result).toBe(value);
      });
    });
  });

  describe('Invalid Input Cases', () => {
    it('should return empty string when bodyEntity is null', () => {
      const result = composer.extractBodyCompositionDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity is undefined', () => {
      const result = composer.extractBodyCompositionDescription(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when bodyEntity lacks getComponentData', () => {
      const mockEntity = { someOtherMethod: jest.fn() };
      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when getComponentData is not a function', () => {
      const mockEntity = { getComponentData: 'not a function' };
      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component does not exist', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:body_composition'
      );
    });

    it('should return empty string when component is undefined', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => undefined),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when component lacks composition property', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ someOtherProperty: 'value' })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when composition is null', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: null })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when composition is undefined', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: undefined })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should return empty string when composition is empty string', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: '' })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
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
        composer.extractBodyCompositionDescription(mockEntity);
      }).toThrow('Component system error');
    });

    it('should handle composition with unexpected type - number', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: 123 })),
      };

      // Should return the value as-is (coerced to string by the template)
      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe(123);
    });

    it('should handle composition with unexpected type - boolean', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: true })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe(true);
    });

    it('should handle composition with unexpected type - object', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: { nested: 'value' } })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toEqual({ nested: 'value' });
    });
  });

  describe('Type Validation', () => {
    it('should validate bodyEntity parameter type', () => {
      // Test with various non-object types
      const invalidInputs = [
        123,
        'string',
        true,
        false,
        [],
        Symbol('test'),
      ];

      invalidInputs.forEach((input) => {
        const result = composer.extractBodyCompositionDescription(input);
        expect(result).toBe('');
      });
    });

    it('should handle object without getComponentData method', () => {
      const objectWithoutMethod = {
        hasComponent: jest.fn(),
        someOtherProp: 'value',
      };

      const result = composer.extractBodyCompositionDescription(objectWithoutMethod);
      expect(result).toBe('');
    });
  });

  describe('Component Data Structure Validation', () => {
    it('should handle component with different property names', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          build: 'muscular', // Wrong property name
          value: 'average', // Wrong property name
          type: 'lean', // Wrong property name
        })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should handle component with composition property set to false', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: false })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });

    it('should handle component with composition property set to 0', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: 0 })),
      };

      const result = composer.extractBodyCompositionDescription(mockEntity);
      expect(result).toBe('');
    });
  });

  describe('Method Integration', () => {
    it('should work consistently with multiple calls', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({ composition: 'lean' })),
      };

      const result1 = composer.extractBodyCompositionDescription(mockEntity);
      const result2 = composer.extractBodyCompositionDescription(mockEntity);
      const result3 = composer.extractBodyCompositionDescription(mockEntity);

      expect(result1).toBe('lean');
      expect(result2).toBe('lean');
      expect(result3).toBe('lean');
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
    });

    it('should not modify the input entity', () => {
      const originalEntity = {
        getComponentData: jest.fn(() => ({ composition: 'soft' })),
        otherProperty: 'should not change',
      };

      const result = composer.extractBodyCompositionDescription(originalEntity);

      expect(result).toBe('soft');
      expect(originalEntity.otherProperty).toBe('should not change');
      expect(typeof originalEntity.getComponentData).toBe('function');
    });
  });
});