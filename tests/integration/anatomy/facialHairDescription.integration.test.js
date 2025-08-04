/**
 * @file Integration test for facial hair description generation in anatomy system
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

// Import components
import facialHairComponent from '../../../data/mods/descriptors/components/facial_hair.component.json';
import anatomyFormattingConfig from '../../../data/mods/anatomy/anatomy-formatting/default.json';

describe('Facial Hair Description Integration', () => {
  let testBed;
  let bodyPartDescriptionBuilder;
  let descriptorFormatter;
  let anatomyFormattingService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    // Load components
    testBed.loadComponents({
      'descriptors:facial_hair': facialHairComponent,
    });

    // Load the formatting config first
    testBed.registry.store(
      'anatomy-formatting',
      'default',
      anatomyFormattingConfig
    );

    // Use the testBed's anatomyFormattingService that's already set up properly
    anatomyFormattingService = testBed.anatomyFormattingService;

    // Set up services
    descriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService,
    });

    bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService,
    });
  });

  describe('BodyPartDescriptionBuilder with facial hair', () => {
    it('should extract and format facial hair descriptors', () => {
      // Create a mock entity with facial hair
      const headEntity = {
        id: 'test:bearded_head',
        getComponentData: (componentId) => {
          const components = {
            'anatomy:part': { subType: 'head' },
            'descriptors:facial_hair': { style: 'bearded' },
            'descriptors:size_category': { size: 'medium' },
            'descriptors:shape_general': { shape: 'rounded' },
          };
          return components[componentId];
        },
      };

      // Generate description
      const description =
        bodyPartDescriptionBuilder.buildDescription(headEntity);

      // Should include all descriptors including facial hair
      expect(description).toBeTruthy();
      expect(description).toContain('bearded');
      expect(description).toContain('medium');
      expect(description).toContain('rounded');
    });

    it('should handle different facial hair styles', () => {
      const styles = ['mustache', 'goatee', 'full-beard', 'van-dyke'];

      styles.forEach((style) => {
        const entity = {
          id: `test:head_${style}`,
          getComponentData: (componentId) => {
            const components = {
              'anatomy:part': { subType: 'head' },
              'descriptors:facial_hair': { style },
              'descriptors:color_basic': { color: 'brown' },
            };
            return components[componentId];
          },
        };

        const description = bodyPartDescriptionBuilder.buildDescription(entity);

        // Should include the facial hair style
        expect(description).toContain(style);
        // Should also include the color
        expect(description).toContain('brown');
      });
    });

    it('should work with entity that has components property instead of getComponentData', () => {
      const entity = {
        id: 'test:mustache_head',
        components: {
          'anatomy:part': { subType: 'head' },
          'descriptors:facial_hair': { style: 'mustache' },
          'descriptors:shape_general': { shape: 'oval' },
        },
      };

      const description = bodyPartDescriptionBuilder.buildDescription(entity);

      expect(description).toContain('mustache');
      expect(description).toContain('oval');
    });

    it('should verify facial_hair is properly extracted', () => {
      // Verify that the COMPONENT_TYPES includes facial_hair
      expect(BodyPartDescriptionBuilder.COMPONENT_TYPES).toContain(
        'descriptors:facial_hair'
      );

      // Create an entity with multiple descriptors including facial hair
      const entity = {
        id: 'test:full_head',
        getComponentData: (componentId) => {
          const components = {
            'anatomy:part': { subType: 'head' },
            'descriptors:facial_hair': { style: 'full-beard' },
            'descriptors:size_category': { size: 'large' },
            'descriptors:shape_general': { shape: 'square' },
            'descriptors:color_basic': { color: 'gray' },
          };
          return components[componentId];
        },
      };

      const description = bodyPartDescriptionBuilder.buildDescription(entity);

      // All descriptors should be included
      expect(description).toContain('full-beard');
      expect(description).toContain('large');
      expect(description).toContain('square');
      expect(description).toContain('gray');
    });
  });
});
