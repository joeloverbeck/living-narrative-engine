import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Tests for body hair descriptor extraction in BodyPartDescriptionBuilder
 */
describe('BodyPartDescriptionBuilder - Body Hair Support', () => {
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
        'descriptors:body_hair',
        'descriptors:build',
        'descriptors:color_basic',
        'descriptors:shape_general',
      ]),
      getDescriptorValueKeys: jest.fn(() => [
        'value',
        'density',
        'build',
        'color',
      ]),
      getPairedParts: jest.fn(() => new Set(['eye', 'ear', 'arm'])),
    };

    builder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService,
    });
  });

  describe('buildDescription with body hair', () => {
    it('should extract body hair descriptor from arm entity', () => {
      // Arrange
      const armEntity = {
        getComponentData: jest.fn((componentId) => {
          const components = {
            'anatomy:part': { subType: 'arm' },
            'descriptors:body_hair': { density: 'hairy' },
            'descriptors:build': { build: 'muscular' },
            'descriptors:color_basic': { color: 'tan' },
          };
          return components[componentId];
        }),
      };

      // Mock the formatter to return descriptors including body hair
      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:body_hair', value: 'hairy' },
        { componentId: 'descriptors:build', value: 'muscular' },
        { componentId: 'descriptors:color_basic', value: 'tan' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue(
        'hairy, muscular, tan'
      );

      // Act
      const description = builder.buildDescription(armEntity);

      // Assert
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalled();
      const extractCall =
        descriptorFormatter.extractDescriptors.mock.calls[0][0];
      expect(extractCall).toHaveProperty('descriptors:body_hair');
      expect(extractCall['descriptors:body_hair']).toEqual({
        density: 'hairy',
      });
      expect(description).toBe('hairy, muscular, tan');
    });

    it('should handle arm entity with components property instead of getComponentData', () => {
      // Arrange
      const armEntity = {
        components: {
          'anatomy:part': { subType: 'arm' },
          'descriptors:body_hair': { density: 'very-hairy' },
          'descriptors:build': { build: 'muscular' },
        },
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:body_hair', value: 'very-hairy' },
        { componentId: 'descriptors:build', value: 'muscular' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue(
        'very-hairy, muscular'
      );

      // Act
      const description = builder.buildDescription(armEntity);

      // Assert
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledWith(
        armEntity.components
      );
      expect(description).toBe('very-hairy, muscular');
    });

    it('should extract all descriptor types including body hair', () => {
      // This test verifies that COMPONENT_TYPES includes body_hair
      const armEntity = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') {
            return { subType: 'arm' };
          }
          if (componentId === 'descriptors:body_hair') {
            return { density: 'sparse' };
          }
          if (componentId === 'descriptors:build') {
            return { build: 'muscular' };
          }
          return null;
        }),
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:body_hair', value: 'sparse' },
        { componentId: 'descriptors:build', value: 'muscular' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('sparse, muscular');

      // Act
      const description = builder.buildDescription(armEntity);

      // Assert
      // Verify that getComponentData was called for body_hair
      const componentCalls = armEntity.getComponentData.mock.calls
        .map((call) => call[0])
        .filter((id) => id.startsWith('descriptors:'));

      // This will fail until we add 'descriptors:body_hair' to COMPONENT_TYPES
      expect(componentCalls).toContain('descriptors:body_hair');
      expect(description).toBe('sparse, muscular');
    });

    it('should handle all valid body hair density values', () => {
      const validDensities = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      validDensities.forEach((density) => {
        const armEntity = {
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType: 'arm' };
            }
            if (componentId === 'descriptors:body_hair') {
              return { density };
            }
            return null;
          }),
        };

        descriptorFormatter.extractDescriptors.mockReturnValue([
          { componentId: 'descriptors:body_hair', value: density },
        ]);
        descriptorFormatter.formatDescriptors.mockReturnValue(density);

        const description = builder.buildDescription(armEntity);
        expect(description).toBe(density);
      });
    });
  });

  describe('Integration with real hairy arm entity structure', () => {
    it('should generate correct description for muscular hairy arm entity', () => {
      // Simulate the actual entity structure from humanoid_arm_muscular_hairy.entity.json
      const hairyArmEntity = {
        id: 'anatomy:humanoid_arm_muscular_hairy',
        getComponentData: jest.fn((componentId) => {
          const components = {
            'anatomy:part': { subType: 'arm' },
            'descriptors:build': { build: 'muscular' },
            'descriptors:body_hair': { density: 'hairy' },
            'core:name': { text: 'muscular, hairy arm' },
          };
          return components[componentId];
        }),
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:body_hair', value: 'hairy' },
        { componentId: 'descriptors:build', value: 'muscular' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('hairy, muscular');

      // Act
      const description = builder.buildDescription(hairyArmEntity);

      // Assert
      expect(description).toBe('hairy, muscular');
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalled();
      const extractedComponents =
        descriptorFormatter.extractDescriptors.mock.calls[0][0];
      expect(extractedComponents).toHaveProperty('descriptors:body_hair');
      expect(extractedComponents).toHaveProperty('descriptors:build');
    });
  });

  describe('buildMultipleDescription with body hair', () => {
    it('should handle multiple hairy arms with same descriptors', () => {
      const hairyArm1 = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'arm' };
          if (componentId === 'descriptors:body_hair')
            return { density: 'hairy' };
          if (componentId === 'descriptors:build') return { build: 'muscular' };
          return null;
        }),
      };

      const hairyArm2 = {
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'arm' };
          if (componentId === 'descriptors:body_hair')
            return { density: 'hairy' };
          if (componentId === 'descriptors:build') return { build: 'muscular' };
          return null;
        }),
      };

      descriptorFormatter.extractDescriptors.mockReturnValue([
        { componentId: 'descriptors:body_hair', value: 'hairy' },
        { componentId: 'descriptors:build', value: 'muscular' },
      ]);
      descriptorFormatter.formatDescriptors.mockReturnValue('hairy, muscular');

      // Act
      const description = builder.buildMultipleDescription(
        [hairyArm1, hairyArm2],
        'arm'
      );

      // Assert
      expect(description).toBe('hairy, muscular');
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledTimes(2);
    });
  });
});
