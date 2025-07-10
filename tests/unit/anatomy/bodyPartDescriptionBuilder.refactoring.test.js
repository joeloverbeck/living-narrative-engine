import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Tests for the refactored BodyPartDescriptionBuilder to ensure
 * the extracted code maintains the same functionality
 */
describe('BodyPartDescriptionBuilder refactoring tests', () => {
  let descriptorFormatter;
  let anatomyFormattingService;
  let builder;

  beforeEach(() => {
    descriptorFormatter = {
      extractDescriptors: jest.fn((comps) => comps),
      formatDescriptors: jest.fn(() => 'formatted descriptors'),
    };

    anatomyFormattingService = {
      getPairedParts: jest.fn(() => new Set(['eye', 'arm'])),
      getIrregularPlurals: jest.fn(() => ({ foot: 'feet' })),
    };

    builder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService,
    });
  });

  describe('COMPONENT_TYPES constant', () => {
    it('should have all expected component types', () => {
      const expectedTypes = [
        'anatomy:part',
        'descriptors:build',
        'descriptors:color_basic',
        'descriptors:color_extended',
        'descriptors:firmness',
        'descriptors:hair_style',
        'descriptors:length_category',
        'descriptors:length_hair',
        'descriptors:shape_eye',
        'descriptors:shape_general',
        'descriptors:size_category',
        'descriptors:size_specific',
        'descriptors:texture',
        'descriptors:weight_feel',
      ];

      expect(BodyPartDescriptionBuilder.COMPONENT_TYPES).toEqual(expectedTypes);
    });
  });

  describe('buildDescription with extracted component logic', () => {
    it('should extract components using the new helper method', () => {
      const entity = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'arm' };
          if (id === 'descriptors:color_basic') return { value: 'red' };
          if (id === 'descriptors:size_category') return { value: 'large' };
          // Other components return null
          return null;
        }),
      };

      const result = builder.buildDescription(entity);

      // Verify all component types were queried
      expect(entity.getComponentData).toHaveBeenCalledTimes(
        BodyPartDescriptionBuilder.COMPONENT_TYPES.length
      );

      // Verify specific components were extracted
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledWith(
        expect.objectContaining({
          'anatomy:part': { subType: 'arm' },
          'descriptors:color_basic': { value: 'red' },
          'descriptors:size_category': { value: 'large' },
        })
      );

      expect(result).toBe('formatted descriptors');
    });

    it('should handle component extraction errors gracefully', () => {
      const entity = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'leg' };
          if (id === 'descriptors:firmness') {
            throw new Error('Component not found');
          }
          return null;
        }),
      };

      // Should not throw when extracting components
      expect(() => builder.buildDescription(entity)).not.toThrow();

      const result = builder.buildDescription(entity);
      expect(result).toBe('formatted descriptors');
    });
  });

  describe('buildMultipleDescription with extracted component logic', () => {
    it('should extract components for each entity using the helper', () => {
      const entity1 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'blue' };
          return null;
        }),
      };

      const entity2 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'green' };
          return null;
        }),
      };

      builder.buildMultipleDescription([entity1, entity2], 'eye');

      // Verify both entities had their components extracted
      expect(entity1.getComponentData).toHaveBeenCalledTimes(
        BodyPartDescriptionBuilder.COMPONENT_TYPES.length
      );
      expect(entity2.getComponentData).toHaveBeenCalledTimes(
        BodyPartDescriptionBuilder.COMPONENT_TYPES.length
      );
    });

    it('should return different descriptors when entities have different components', () => {
      descriptorFormatter.formatDescriptors
        .mockReturnValueOnce('blue eye')
        .mockReturnValueOnce('green eye');

      const entity1 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'blue' };
          return null;
        }),
      };

      const entity2 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'green' };
          return null;
        }),
      };

      const result = builder.buildMultipleDescription([entity1, entity2], 'eye');
      
      // Should return array of different descriptors
      expect(result).toEqual(['blue eye', 'green eye']);
    });

    it('should return single descriptor when all paired parts have same descriptors', () => {
      // Reset mock to return same descriptor for both
      descriptorFormatter.formatDescriptors.mockReturnValue('blue eye');

      const entity1 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'blue' };
          return null;
        }),
      };

      const entity2 = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'blue' };
          return null;
        }),
      };

      const result = builder.buildMultipleDescription([entity1, entity2], 'eye');
      
      // Should return single descriptor for paired parts with same description
      expect(result).toBe('blue eye');
    });
  });

  describe('backward compatibility', () => {
    it('should work with entities that have direct components property', () => {
      const entity = {
        components: {
          'anatomy:part': { subType: 'hand' },
          'descriptors:size_category': { value: 'small' },
        },
      };

      const result = builder.buildDescription(entity);

      // Should not call getComponentData when components property exists
      expect(entity.getComponentData).toBeUndefined();
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledWith(
        entity.components
      );
      expect(result).toBe('formatted descriptors');
    });

    it('should handle mix of entities with and without getComponentData', () => {
      const entityWithComponents = {
        components: {
          'anatomy:part': { subType: 'arm' },
        },
      };

      const entityWithMethod = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'arm' };
          return null;
        }),
      };

      builder.buildMultipleDescription(
        [entityWithComponents, entityWithMethod],
        'arm'
      );

      // Only the entity with method should have been called
      expect(entityWithMethod.getComponentData).toHaveBeenCalled();
    });
  });
});