import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

describe('Body Hair Arm Description Integration', () => {
  let bodyPartDescriptionBuilder;

  beforeEach(() => {
    // Create real descriptor formatter and body part description builder
    const descriptorFormatter = new DescriptorFormatter();
    bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
    });
  });

  it('should include body hair descriptor in muscular hairy arm description', () => {
    // Arrange
    // Create a mock entity with the same structure as humanoid_arm_muscular_hairy.entity.json
    const armEntity = {
      components: {
        'anatomy:part': {
          subType: 'arm',
        },
        'descriptors:build': {
          build: 'muscular',
        },
        'descriptors:body_hair': {
          hairDensity: 'hairy',
        },
        'core:name': {
          text: 'muscular, hairy arm',
        },
      },
    };

    // Act
    const description = bodyPartDescriptionBuilder.buildDescription(armEntity);

    // Assert
    // The description should include both "muscular" and "hairy" descriptors
    expect(description).toContain('muscular');
    expect(description).toContain('hairy');

    // Verify that both descriptors are present in the description
    const descriptors = description.split(',').map((d) => d.trim());
    expect(descriptors).toContain('muscular');
    expect(descriptors).toContain('hairy');

    console.log(`Generated description: "${description}"`);
  });

  it('should handle different body hair densities in arm descriptions', () => {
    const bodyHairDensities = [
      'hairless',
      'sparse',
      'light',
      'moderate',
      'hairy',
      'very-hairy',
    ];

    for (const density of bodyHairDensities) {
      // Arrange
      const armEntity = {
        components: {
          'anatomy:part': {
            subType: 'arm',
          },
          'descriptors:build': {
            build: 'muscular',
          },
          'descriptors:body_hair': {
            density: density,
          },
        },
      };

      // Act
      const description =
        bodyPartDescriptionBuilder.buildDescription(armEntity);

      // Assert
      expect(description).toContain('muscular');
      expect(description).toContain(density);

      console.log(`${density} arm description: "${description}"`);
    }
  });
});
