import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Tests for facial hair descriptor extraction in BodyPartDescriptionBuilder
 */
describe('BodyPartDescriptionBuilder - Facial Hair Support', () => {
  let descriptorFormatter;
  let anatomyFormattingService;
  let builder;

  beforeEach(() => {
    descriptorFormatter = {
      extractDescriptors: jest.fn(),
      formatDescriptors: jest.fn(),
    };

    anatomyFormattingService = {
      getDescriptorOrder: jest.fn(() => [
        'descriptors:length_category',
        'descriptors:facial_hair',
        'descriptors:color_basic',
        'descriptors:shape_general',
      ]),
      getDescriptorValueKeys: jest.fn(() => ['value', 'style', 'color']),
      getPairedParts: jest.fn(() => new Set(['eye', 'ear', 'arm'])),
    };

    builder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService,
    });
  });

  describe('buildDescription with facial hair', () => {
    it('should extract facial hair descriptor from head entity', () => {
      // Arrange
      const headEntity = {
        getComponentData: jest.fn((componentId) => {
          const components = {
            'anatomy:part': { subType: 'head' },
            'descriptors:facial_hair': { style: 'bearded' },
            'descriptors:size_category': { size: 'medium' },
            'descriptors:shape_general': { shape: 'rounded' },
          };
          return components[componentId];
        }),
      };

      // Mock the formatter to return descriptors including facial hair
      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:facial_hair', value: 'bearded' },
        { componentId: 'descriptors:size_category', value: 'medium' },
        { componentId: 'descriptors:shape_general', value: 'rounded' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue(
        'bearded, medium, rounded'
      );

      // Act
      const description = builder.buildDescription(headEntity);

      // Assert
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalled();
      const extractCall =
        descriptorFormatter.extractDescriptors.mock.calls[0][0];
      expect(extractCall).toHaveProperty('descriptors:facial_hair');
      expect(extractCall['descriptors:facial_hair']).toEqual({
        style: 'bearded',
      });
      expect(description).toBe('bearded, medium, rounded');
    });

    it('should handle head entity with components property instead of getComponentData', () => {
      // Arrange
      const headEntity = {
        components: {
          'anatomy:part': { subType: 'head' },
          'descriptors:facial_hair': { style: 'mustache' },
          'descriptors:color_basic': { color: 'black' },
        },
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:facial_hair', value: 'mustache' },
        { componentId: 'descriptors:color_basic', value: 'black' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('mustache, black');

      // Act
      const description = builder.buildDescription(headEntity);

      // Assert
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledWith(
        headEntity.components
      );
      expect(description).toBe('mustache, black');
    });

    it('should extract all descriptor types including facial hair', () => {
      // This test verifies that COMPONENT_TYPES includes facial_hair
      const headEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'head' };
          }
          if (componentId === 'descriptors:facial_hair') {
            return { style: 'goatee' };
          }
          return null;
        }),
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:facial_hair', value: 'goatee' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('goatee');

      // Act
      const description = builder.buildDescription(headEntity);

      // Assert
      // Verify that getComponentData was called for facial_hair
      const componentCalls = headEntity.getComponentData.mock.calls
        .map((call) => call[0])
        .filter((id) => id.startsWith('descriptors:'));

      // This will fail until we add 'descriptors:facial_hair' to COMPONENT_TYPES
      expect(componentCalls).toContain('descriptors:facial_hair');
      expect(description).toBe('goatee');
    });
  });

  describe('Integration with real bearded head entity structure', () => {
    it('should generate correct description for bearded head entity', () => {
      // Simulate the actual entity structure from humanoid_head_bearded.entity.json
      const beardedHeadEntity = {
        id: 'anatomy:humanoid_head_bearded',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'anatomy:part': { subType: 'head' },
            'descriptors:facial_hair': { style: 'bearded' },
            'core:name': { text: 'head' },
          };
          return components[componentId];
        }),
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:facial_hair', value: 'bearded' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('bearded');

      // Act
      const description = builder.buildDescription(beardedHeadEntity);

      // Assert
      expect(description).toBe('bearded');
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalled();
      const extractedComponents =
        descriptorFormatter.extractDescriptors.mock.calls[0][0];
      expect(extractedComponents).toHaveProperty('descriptors:facial_hair');
    });
  });
});
