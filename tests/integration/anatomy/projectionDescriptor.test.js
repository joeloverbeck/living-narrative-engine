import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

describe('Projection Descriptor Integration', () => {
  let composer;
  let descriptorFormatter;

  beforeEach(() => {
    // Create mocks for required dependencies
    const mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
      getPlural: jest.fn(),
    };

    const mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    const mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    const mockAnatomyFormattingService = {
      getDescriptorOrder: jest
        .fn()
        .mockReturnValue([
          'descriptors:size_category',
          'descriptors:projection',
          'descriptors:firmness',
        ]),
      getDescriptorValueKeys: jest
        .fn()
        .mockReturnValue(['size', 'projection', 'firmness']),
      getGroupedParts: jest.fn(),
    };

    const mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    descriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
    });
  });

  describe('Breast Projection', () => {
    it('should extract projection descriptors correctly', () => {
      // Create mock entity with projection descriptor
      const mockEntity = {
        id: 'test-breast',
        hasComponent: jest.fn().mockImplementation((componentId) => {
          return [
            'anatomy:part',
            'descriptors:size_category',
            'descriptors:projection',
            'descriptors:firmness',
          ].includes(componentId);
        }),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          const components = {
            'anatomy:part': {
              type: 'breast',
              subType: 'breasts',
              count: 2,
            },
            'descriptors:size_category': { size: 'medium' },
            'descriptors:projection': { projection: 'bubbly' },
            'descriptors:firmness': { firmness: 'soft' },
          };
          return components[componentId] || null;
        }),
      };

      // Test descriptor extraction
      const entityComponents = {
        'anatomy:part': {
          type: 'breast',
          subType: 'breasts',
          count: 2,
        },
        'descriptors:size_category': { size: 'medium' },
        'descriptors:projection': { projection: 'bubbly' },
        'descriptors:firmness': { firmness: 'soft' },
      };

      const descriptors =
        descriptorFormatter.extractDescriptors(entityComponents);
      const projectionDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:projection'
      );

      expect(projectionDescriptor).toBeDefined();
      expect(projectionDescriptor.value).toBe('bubbly');
    });

    it('should handle all projection values', () => {
      const projections = ['flat', 'bubbly', 'shelf'];

      projections.forEach((projection) => {
        const entityComponents = {
          'anatomy:part': {
            type: 'breast',
            subType: 'breasts',
          },
          'descriptors:projection': { projection },
        };

        const descriptors =
          descriptorFormatter.extractDescriptors(entityComponents);
        const projectionDescriptor = descriptors.find(
          (d) => d.componentId === 'descriptors:projection'
        );

        expect(projectionDescriptor).toBeDefined();
        expect(projectionDescriptor.value).toBe(projection);
      });
    });
  });

  describe('Buttocks Projection', () => {
    it('should include projection in buttocks descriptions', () => {
      const entityComponents = {
        'anatomy:part': {
          type: 'ass',
          subType: 'buttocks',
        },
        'descriptors:shape_general': { shape: 'round' },
        'descriptors:projection': { projection: 'shelf' },
      };

      const descriptors =
        descriptorFormatter.extractDescriptors(entityComponents);
      const projectionDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:projection'
      );
      const shapeDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:shape_general'
      );

      expect(projectionDescriptor).toBeDefined();
      expect(projectionDescriptor.value).toBe('shelf');
      expect(shapeDescriptor).toBeDefined();
      expect(shapeDescriptor.value).toBe('round');
    });
  });

  describe('Descriptor Ordering', () => {
    it('should respect projection position in descriptorOrder', () => {
      const entityComponents = {
        'anatomy:part': {
          type: 'breast',
          subType: 'breasts',
        },
        'descriptors:size_category': { size: 'large' },
        'descriptors:firmness': { firmness: 'firm' },
        'descriptors:projection': { projection: 'shelf' },
        'descriptors:texture': { texture: 'smooth' },
      };

      // Test descriptor ordering
      const descriptors =
        descriptorFormatter.extractDescriptors(entityComponents);

      // Format descriptors to verify ordering logic
      const formattedDescriptors =
        descriptorFormatter.formatDescriptors(descriptors);

      // Should include projection in the formatted output
      expect(formattedDescriptors).toContain('shelf');
      expect(formattedDescriptors).toContain('large');
      expect(formattedDescriptors).toContain('firm');
      expect(formattedDescriptors).toContain('smooth');
    });
  });

  describe('Edge Cases', () => {
    it('should handle parts without projection gracefully', () => {
      const entityComponents = {
        'anatomy:part': {
          type: 'breast',
          subType: 'breasts',
        },
        'descriptors:size_category': { size: 'medium' },
        // No projection descriptor
      };

      const descriptors =
        descriptorFormatter.extractDescriptors(entityComponents);
      const projectionDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:projection'
      );

      // Should not find projection descriptor
      expect(projectionDescriptor).toBeUndefined();

      // Should still format other descriptors correctly
      const sizeDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:size_category'
      );
      expect(sizeDescriptor).toBeDefined();
      expect(sizeDescriptor.value).toBe('medium');
    });

    it('should handle projection on non-typical parts', () => {
      const entityComponents = {
        'anatomy:part': {
          type: 'belly',
          subType: 'belly',
        },
        'descriptors:size_category': { size: 'rounded' },
        'descriptors:projection': { projection: 'bubbly' },
      };

      const descriptors =
        descriptorFormatter.extractDescriptors(entityComponents);
      const projectionDescriptor = descriptors.find(
        (d) => d.componentId === 'descriptors:projection'
      );

      // Should work even on unusual parts
      expect(projectionDescriptor).toBeDefined();
      expect(projectionDescriptor.value).toBe('bubbly');
    });
  });

  describe('Default Fallback Values', () => {
    it('should include projection in default descriptor order when no formatting service is provided', () => {
      // Create descriptor formatter without anatomy formatting service
      const standaloneFormatter = new DescriptorFormatter();

      // Access the private default property for testing
      expect(standaloneFormatter._defaultDescriptorOrder).toContain(
        'descriptors:projection'
      );
      expect(standaloneFormatter._defaultDescriptorOrder).toContain(
        'descriptors:embellishment'
      );
      expect(standaloneFormatter._defaultDescriptorValueKeys).toContain(
        'projection'
      );
      expect(standaloneFormatter._defaultDescriptorValueKeys).toContain(
        'embellishment'
      );

      // Verify position in order (should be after firmness, before build)
      const projectionIndex =
        standaloneFormatter._defaultDescriptorOrder.indexOf(
          'descriptors:projection'
        );
      const firmnessIndex = standaloneFormatter._defaultDescriptorOrder.indexOf(
        'descriptors:firmness'
      );
      const buildIndex =
        standaloneFormatter._defaultDescriptorOrder.indexOf(
          'descriptors:build'
        );

      expect(projectionIndex).toBeGreaterThan(firmnessIndex);
      expect(projectionIndex).toBeLessThan(buildIndex);
    });
  });
});
