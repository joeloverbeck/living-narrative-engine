/**
 * @file Unit tests for bodyDescriptorRegistry
 */

import { describe, it, expect } from '@jest/globals';
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from '../../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('bodyDescriptorRegistry', () => {
  describe('BODY_DESCRIPTOR_REGISTRY', () => {
    describe('Registry completeness', () => {
      it('should contain all 6 body descriptors', () => {
        const descriptorNames = Object.keys(BODY_DESCRIPTOR_REGISTRY);
        expect(descriptorNames).toHaveLength(6);
        expect(descriptorNames).toContain('height');
        expect(descriptorNames).toContain('skinColor');
        expect(descriptorNames).toContain('build');
        expect(descriptorNames).toContain('composition');
        expect(descriptorNames).toContain('hairDensity');
        expect(descriptorNames).toContain('smell');
      });

      it('should have complete metadata for each descriptor', () => {
        for (const [, metadata] of Object.entries(BODY_DESCRIPTOR_REGISTRY)) {
          expect(metadata).toHaveProperty('schemaProperty');
          expect(metadata).toHaveProperty('displayLabel');
          expect(metadata).toHaveProperty('displayKey');
          expect(metadata).toHaveProperty('dataPath');
          expect(metadata).toHaveProperty('validValues');
          expect(metadata).toHaveProperty('displayOrder');
          expect(metadata).toHaveProperty('extractor');
          expect(metadata).toHaveProperty('formatter');
          expect(metadata).toHaveProperty('required');

          expect(typeof metadata.extractor).toBe('function');
          expect(typeof metadata.formatter).toBe('function');
          expect(typeof metadata.schemaProperty).toBe('string');
          expect(typeof metadata.displayLabel).toBe('string');
          expect(typeof metadata.displayKey).toBe('string');
          expect(typeof metadata.dataPath).toBe('string');
          expect(typeof metadata.displayOrder).toBe('number');
          expect(typeof metadata.required).toBe('boolean');
        }
      });

      it('should have unique display orders', () => {
        const displayOrders = Object.values(BODY_DESCRIPTOR_REGISTRY).map(
          (m) => m.displayOrder
        );
        const uniqueOrders = new Set(displayOrders);
        expect(uniqueOrders.size).toBe(displayOrders.length);
      });

      it('should have sequential display orders', () => {
        const displayOrders = Object.values(BODY_DESCRIPTOR_REGISTRY)
          .map((m) => m.displayOrder)
          .sort((a, b) => a - b);

        expect(displayOrders).toEqual([10, 20, 30, 40, 50, 60]);
      });
    });

    describe('Height descriptor', () => {
      it('should have correct metadata', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        expect(height.schemaProperty).toBe('height');
        expect(height.displayLabel).toBe('Height');
        expect(height.displayKey).toBe('height');
        expect(height.dataPath).toBe('body.descriptors.height');
        expect(height.displayOrder).toBe(10);
        expect(height.required).toBe(false);
      });

      it('should have all valid values', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        expect(height.validValues).toEqual([
          'microscopic',
          'minuscule',
          'tiny',
          'petite',
          'short',
          'average',
          'tall',
          'very-tall',
          'gigantic',
          'colossal',
          'titanic',
        ]);
      });

      it('should have working extractor function', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        const bodyComponent = {
          body: { descriptors: { height: 'tall' } },
        };
        expect(height.extractor(bodyComponent)).toBe('tall');
      });

      it('should have working formatter function', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        expect(height.formatter('tall')).toBe('Height: tall');
      });
    });

    describe('SkinColor descriptor', () => {
      it('should have correct metadata', () => {
        const skinColor = BODY_DESCRIPTOR_REGISTRY.skinColor;
        expect(skinColor.schemaProperty).toBe('skinColor');
        expect(skinColor.displayLabel).toBe('Skin color');
        expect(skinColor.displayKey).toBe('skin_color');
        expect(skinColor.dataPath).toBe('body.descriptors.skinColor');
        expect(skinColor.displayOrder).toBe(20);
        expect(skinColor.required).toBe(false);
      });

      it('should have null validValues for free-form input', () => {
        const skinColor = BODY_DESCRIPTOR_REGISTRY.skinColor;
        expect(skinColor.validValues).toBeNull();
      });

      it('should have working extractor function', () => {
        const skinColor = BODY_DESCRIPTOR_REGISTRY.skinColor;
        const bodyComponent = {
          body: { descriptors: { skinColor: 'olive' } },
        };
        expect(skinColor.extractor(bodyComponent)).toBe('olive');
      });

      it('should have working formatter function', () => {
        const skinColor = BODY_DESCRIPTOR_REGISTRY.skinColor;
        expect(skinColor.formatter('olive')).toBe('Skin color: olive');
      });
    });

    describe('Build descriptor', () => {
      it('should have correct metadata', () => {
        const build = BODY_DESCRIPTOR_REGISTRY.build;
        expect(build.schemaProperty).toBe('build');
        expect(build.displayLabel).toBe('Build');
        expect(build.displayKey).toBe('build');
        expect(build.dataPath).toBe('body.descriptors.build');
        expect(build.displayOrder).toBe(30);
        expect(build.required).toBe(false);
      });

      it('should have all valid values', () => {
        const build = BODY_DESCRIPTOR_REGISTRY.build;
        expect(build.validValues).toEqual([
          'skinny',
          'slim',
          'lissom',
          'toned',
          'athletic',
          'shapely',
          'hourglass',
          'thick',
          'muscular',
          'hulking',
          'stocky',
          'frail',
          'gaunt',
          'skeletal',
          'atrophied',
          'cadaverous',
          'massive',
          'willowy',
          'barrel-chested',
          'lanky',
        ]);
      });

      it('should have working extractor function', () => {
        const build = BODY_DESCRIPTOR_REGISTRY.build;
        const bodyComponent = {
          body: { descriptors: { build: 'athletic' } },
        };
        expect(build.extractor(bodyComponent)).toBe('athletic');
      });

      it('should have working formatter function', () => {
        const build = BODY_DESCRIPTOR_REGISTRY.build;
        expect(build.formatter('athletic')).toBe('Build: athletic');
      });
    });

    describe('Composition descriptor', () => {
      it('should have correct metadata', () => {
        const composition = BODY_DESCRIPTOR_REGISTRY.composition;
        expect(composition.schemaProperty).toBe('composition');
        expect(composition.displayLabel).toBe('Body composition');
        expect(composition.displayKey).toBe('body_composition');
        expect(composition.dataPath).toBe('body.descriptors.composition');
        expect(composition.displayOrder).toBe(40);
        expect(composition.required).toBe(false);
      });

      it('should have all valid values', () => {
        const composition = BODY_DESCRIPTOR_REGISTRY.composition;
        expect(composition.validValues).toEqual([
          'underweight',
          'lean',
          'average',
          'soft',
          'chubby',
          'overweight',
          'obese',
          'atrophied',
          'emaciated',
          'skeletal',
          'malnourished',
          'dehydrated',
          'wasted',
          'desiccated',
          'bloated',
          'rotting',
        ]);
      });

      it('should have working extractor function', () => {
        const composition = BODY_DESCRIPTOR_REGISTRY.composition;
        const bodyComponent = {
          body: { descriptors: { composition: 'average' } },
        };
        expect(composition.extractor(bodyComponent)).toBe('average');
      });

      it('should have working formatter function', () => {
        const composition = BODY_DESCRIPTOR_REGISTRY.composition;
        expect(composition.formatter('average')).toBe('Body composition: average');
      });
    });

    describe('HairDensity descriptor', () => {
      it('should have correct metadata', () => {
        const hairDensity = BODY_DESCRIPTOR_REGISTRY.hairDensity;
        expect(hairDensity.schemaProperty).toBe('hairDensity');
        expect(hairDensity.displayLabel).toBe('Body hair density');
        expect(hairDensity.displayKey).toBe('body_hair');
        expect(hairDensity.dataPath).toBe('body.descriptors.hairDensity');
        expect(hairDensity.displayOrder).toBe(50);
        expect(hairDensity.required).toBe(false);
      });

      it('should have all valid values', () => {
        const hairDensity = BODY_DESCRIPTOR_REGISTRY.hairDensity;
        expect(hairDensity.validValues).toEqual([
          'hairless',
          'sparse',
          'light',
          'moderate',
          'hairy',
          'very-hairy',
          'furred',
        ]);
      });

      it('should have working extractor function', () => {
        const hairDensity = BODY_DESCRIPTOR_REGISTRY.hairDensity;
        const bodyComponent = {
          body: { descriptors: { hairDensity: 'moderate' } },
        };
        expect(hairDensity.extractor(bodyComponent)).toBe('moderate');
      });

      it('should have working formatter function', () => {
        const hairDensity = BODY_DESCRIPTOR_REGISTRY.hairDensity;
        expect(hairDensity.formatter('moderate')).toBe('Body hair: moderate');
      });
    });

    describe('Smell descriptor', () => {
      it('should have correct metadata', () => {
        const smell = BODY_DESCRIPTOR_REGISTRY.smell;
        expect(smell.schemaProperty).toBe('smell');
        expect(smell.displayLabel).toBe('Smell');
        expect(smell.displayKey).toBe('smell');
        expect(smell.dataPath).toBe('body.descriptors.smell');
        expect(smell.displayOrder).toBe(60);
        expect(smell.required).toBe(false);
      });

      it('should have null validValues for free-form input', () => {
        const smell = BODY_DESCRIPTOR_REGISTRY.smell;
        expect(smell.validValues).toBeNull();
      });

      it('should have working extractor function', () => {
        const smell = BODY_DESCRIPTOR_REGISTRY.smell;
        const bodyComponent = {
          body: { descriptors: { smell: 'pleasant' } },
        };
        expect(smell.extractor(bodyComponent)).toBe('pleasant');
      });

      it('should have working formatter function', () => {
        const smell = BODY_DESCRIPTOR_REGISTRY.smell;
        expect(smell.formatter('pleasant')).toBe('Smell: pleasant');
      });
    });
  });

  describe('Extractor functions edge cases', () => {
    it('should handle undefined body component', () => {
      const height = BODY_DESCRIPTOR_REGISTRY.height;
      expect(height.extractor(undefined)).toBeUndefined();
    });

    it('should handle null body component', () => {
      const height = BODY_DESCRIPTOR_REGISTRY.height;
      expect(height.extractor(null)).toBeUndefined();
    });

    it('should handle missing body property', () => {
      const height = BODY_DESCRIPTOR_REGISTRY.height;
      expect(height.extractor({})).toBeUndefined();
    });

    it('should handle missing descriptors property', () => {
      const height = BODY_DESCRIPTOR_REGISTRY.height;
      expect(height.extractor({ body: {} })).toBeUndefined();
    });

    it('should handle missing specific descriptor', () => {
      const height = BODY_DESCRIPTOR_REGISTRY.height;
      expect(height.extractor({ body: { descriptors: {} } })).toBeUndefined();
    });

    it('should extract all descriptors from a complete body component', () => {
      const bodyComponent = {
        body: {
          descriptors: {
            height: 'tall',
            skinColor: 'olive',
            build: 'athletic',
            composition: 'lean',
            hairDensity: 'moderate',
            smell: 'pleasant',
          },
        },
      };

      expect(BODY_DESCRIPTOR_REGISTRY.height.extractor(bodyComponent)).toBe('tall');
      expect(BODY_DESCRIPTOR_REGISTRY.skinColor.extractor(bodyComponent)).toBe('olive');
      expect(BODY_DESCRIPTOR_REGISTRY.build.extractor(bodyComponent)).toBe('athletic');
      expect(BODY_DESCRIPTOR_REGISTRY.composition.extractor(bodyComponent)).toBe('lean');
      expect(BODY_DESCRIPTOR_REGISTRY.hairDensity.extractor(bodyComponent)).toBe('moderate');
      expect(BODY_DESCRIPTOR_REGISTRY.smell.extractor(bodyComponent)).toBe('pleasant');
    });
  });

  describe('Formatter functions edge cases', () => {
    it('should format values correctly for all descriptors', () => {
      expect(BODY_DESCRIPTOR_REGISTRY.height.formatter('tall')).toBe('Height: tall');
      expect(BODY_DESCRIPTOR_REGISTRY.skinColor.formatter('olive')).toBe('Skin color: olive');
      expect(BODY_DESCRIPTOR_REGISTRY.build.formatter('athletic')).toBe('Build: athletic');
      expect(BODY_DESCRIPTOR_REGISTRY.composition.formatter('lean')).toBe('Body composition: lean');
      expect(BODY_DESCRIPTOR_REGISTRY.hairDensity.formatter('moderate')).toBe('Body hair: moderate');
      expect(BODY_DESCRIPTOR_REGISTRY.smell.formatter('pleasant')).toBe('Smell: pleasant');
    });

    it('should handle null values in formatter', () => {
      expect(BODY_DESCRIPTOR_REGISTRY.height.formatter(null)).toBe('Height: null');
    });

    it('should handle undefined values in formatter', () => {
      expect(BODY_DESCRIPTOR_REGISTRY.height.formatter(undefined)).toBe('Height: undefined');
    });

    it('should handle empty string values in formatter', () => {
      expect(BODY_DESCRIPTOR_REGISTRY.height.formatter('')).toBe('Height: ');
    });
  });

  describe('getDescriptorMetadata', () => {
    it('should return correct metadata for valid descriptor', () => {
      const metadata = getDescriptorMetadata('height');
      expect(metadata).toBeDefined();
      expect(metadata.schemaProperty).toBe('height');
      expect(metadata.displayLabel).toBe('Height');
    });

    it('should return complete object structure', () => {
      const metadata = getDescriptorMetadata('skinColor');
      expect(metadata).toHaveProperty('schemaProperty');
      expect(metadata).toHaveProperty('displayLabel');
      expect(metadata).toHaveProperty('displayKey');
      expect(metadata).toHaveProperty('dataPath');
      expect(metadata).toHaveProperty('validValues');
      expect(metadata).toHaveProperty('displayOrder');
      expect(metadata).toHaveProperty('extractor');
      expect(metadata).toHaveProperty('formatter');
      expect(metadata).toHaveProperty('required');
    });

    it('should return undefined for unknown descriptor', () => {
      const metadata = getDescriptorMetadata('nonexistent');
      expect(metadata).toBeUndefined();
    });

    it('should return metadata for all 6 descriptors', () => {
      expect(getDescriptorMetadata('height')).toBeDefined();
      expect(getDescriptorMetadata('skinColor')).toBeDefined();
      expect(getDescriptorMetadata('build')).toBeDefined();
      expect(getDescriptorMetadata('composition')).toBeDefined();
      expect(getDescriptorMetadata('hairDensity')).toBeDefined();
      expect(getDescriptorMetadata('smell')).toBeDefined();
    });
  });

  describe('getAllDescriptorNames', () => {
    it('should return all 6 descriptor names', () => {
      const names = getAllDescriptorNames();
      expect(names).toHaveLength(6);
    });

    it('should return as array', () => {
      const names = getAllDescriptorNames();
      expect(Array.isArray(names)).toBe(true);
    });

    it('should contain all expected descriptor names', () => {
      const names = getAllDescriptorNames();
      expect(names).toContain('height');
      expect(names).toContain('skinColor');
      expect(names).toContain('build');
      expect(names).toContain('composition');
      expect(names).toContain('hairDensity');
      expect(names).toContain('smell');
    });
  });

  describe('getDescriptorsByDisplayOrder', () => {
    it('should return descriptors in correct display order', () => {
      const ordered = getDescriptorsByDisplayOrder();
      expect(ordered).toEqual([
        'height',
        'skinColor',
        'build',
        'composition',
        'hairDensity',
        'smell',
      ]);
    });

    it('should respect displayOrder property', () => {
      const ordered = getDescriptorsByDisplayOrder();
      const orders = ordered.map((name) => BODY_DESCRIPTOR_REGISTRY[name].displayOrder);
      expect(orders).toEqual([10, 20, 30, 40, 50, 60]);
    });

    it('should return all descriptors', () => {
      const ordered = getDescriptorsByDisplayOrder();
      expect(ordered).toHaveLength(6);
    });

    it('should return as array', () => {
      const ordered = getDescriptorsByDisplayOrder();
      expect(Array.isArray(ordered)).toBe(true);
    });
  });

  describe('validateDescriptorValue', () => {
    describe('Valid enumerated values', () => {
      it('should pass validation for valid height value', () => {
        const result = validateDescriptorValue('height', 'tall');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should pass validation for all valid height values', () => {
        const validHeights = ['microscopic', 'minuscule', 'tiny', 'petite', 'short', 'average', 'tall', 'very-tall', 'gigantic', 'colossal', 'titanic'];
        for (const value of validHeights) {
          const result = validateDescriptorValue('height', value);
          expect(result.valid).toBe(true);
        }
      });

      it('should pass validation for valid build value', () => {
        const result = validateDescriptorValue('build', 'athletic');
        expect(result.valid).toBe(true);
      });

      it('should pass validation for all valid build values', () => {
        const validBuilds = ['skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky', 'frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous', 'massive', 'willowy', 'barrel-chested', 'lanky'];
        for (const value of validBuilds) {
          const result = validateDescriptorValue('build', value);
          expect(result.valid).toBe(true);
        }
      });

      it('should pass validation for valid composition value', () => {
        const result = validateDescriptorValue('composition', 'lean');
        expect(result.valid).toBe(true);
      });

      it('should pass validation for all valid composition values', () => {
        const validCompositions = ['underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese', 'atrophied', 'emaciated', 'skeletal', 'malnourished', 'dehydrated', 'wasted', 'desiccated', 'bloated', 'rotting'];
        for (const value of validCompositions) {
          const result = validateDescriptorValue('composition', value);
          expect(result.valid).toBe(true);
        }
      });

      it('should pass validation for valid hairDensity value', () => {
        const result = validateDescriptorValue('hairDensity', 'moderate');
        expect(result.valid).toBe(true);
      });

      it('should pass validation for all valid hairDensity values', () => {
        const validDensities = [
          'hairless',
          'sparse',
          'light',
          'moderate',
          'hairy',
          'very-hairy',
          'furred',
        ];
        for (const value of validDensities) {
          const result = validateDescriptorValue('hairDensity', value);
          expect(result.valid).toBe(true);
        }
      });
    });

    describe('Invalid enumerated values', () => {
      it('should fail validation for invalid height value', () => {
        const result = validateDescriptorValue('height', 'super-tall');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Invalid value');
        expect(result.error).toContain('super-tall');
        expect(result.error).toContain('height');
      });

      it('should fail validation for invalid build value', () => {
        const result = validateDescriptorValue('build', 'gigantic');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should fail validation for invalid composition value', () => {
        const result = validateDescriptorValue('composition', 'super-lean');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should fail validation for invalid hairDensity value', () => {
        const result = validateDescriptorValue('hairDensity', 'extremely-hairy');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should provide clear error message with expected values', () => {
        const result = validateDescriptorValue('height', 'invalid');
        expect(result.error).toContain('Expected one of:');
        expect(result.error).toContain('gigantic');
        expect(result.error).toContain('tall');
      });
    });

    describe('Free-form descriptors', () => {
      it('should accept any value for skinColor (free-form)', () => {
        expect(validateDescriptorValue('skinColor', 'olive').valid).toBe(true);
        expect(validateDescriptorValue('skinColor', 'pale').valid).toBe(true);
        expect(validateDescriptorValue('skinColor', 'dark brown').valid).toBe(true);
        expect(validateDescriptorValue('skinColor', 'any-random-value').valid).toBe(true);
      });

      it('should accept any value for smell (free-form)', () => {
        expect(validateDescriptorValue('smell', 'pleasant').valid).toBe(true);
        expect(validateDescriptorValue('smell', 'musky').valid).toBe(true);
        expect(validateDescriptorValue('smell', 'like roses').valid).toBe(true);
        expect(validateDescriptorValue('smell', 'any-random-value').valid).toBe(true);
      });
    });

    describe('Unknown descriptors', () => {
      it('should fail validation for unknown descriptor', () => {
        const result = validateDescriptorValue('nonexistent', 'value');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unknown descriptor: nonexistent');
      });

      it('should fail validation for typo in descriptor name', () => {
        const result = validateDescriptorValue('heigth', 'tall');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown descriptor');
      });
    });

    describe('Error message quality', () => {
      it('should provide actionable error messages', () => {
        const result = validateDescriptorValue('build', 'invalid-build');
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Invalid value');
        expect(result.error).toContain('invalid-build');
        expect(result.error).toContain('build');
        expect(result.error).toContain('Expected one of:');
      });
    });
  });

  describe('Enhanced Body Descriptors (v1.2.0)', () => {
    describe('composition descriptor - Horror/Medical values', () => {
      it('should include new horror/medical values', () => {
        const metadata = getDescriptorMetadata('composition');
        expect(metadata.validValues).toContain('atrophied');
        expect(metadata.validValues).toContain('emaciated');
        expect(metadata.validValues).toContain('skeletal');
        expect(metadata.validValues).toContain('malnourished');
        expect(metadata.validValues).toContain('dehydrated');
        expect(metadata.validValues).toContain('wasted');
        expect(metadata.validValues).toContain('desiccated');
        expect(metadata.validValues).toContain('bloated');
        expect(metadata.validValues).toContain('rotting');
      });

      it('should validate atrophied as valid value', () => {
        const result = validateDescriptorValue('composition', 'atrophied');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate all new composition values', () => {
        const newValues = ['atrophied', 'emaciated', 'skeletal', 'malnourished', 'dehydrated', 'wasted', 'desiccated', 'bloated', 'rotting'];
        for (const value of newValues) {
          const result = validateDescriptorValue('composition', value);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      });

      it('should format new composition values correctly', () => {
        const composition = BODY_DESCRIPTOR_REGISTRY.composition;
        expect(composition.formatter('atrophied')).toBe('Body composition: atrophied');
        expect(composition.formatter('skeletal')).toBe('Body composition: skeletal');
        expect(composition.formatter('rotting')).toBe('Body composition: rotting');
      });
    });

    describe('build descriptor - Extreme physique values', () => {
      it('should include new extreme physique values', () => {
        const metadata = getDescriptorMetadata('build');
        expect(metadata.validValues).toContain('frail');
        expect(metadata.validValues).toContain('gaunt');
        expect(metadata.validValues).toContain('skeletal');
        expect(metadata.validValues).toContain('atrophied');
        expect(metadata.validValues).toContain('cadaverous');
        expect(metadata.validValues).toContain('massive');
        expect(metadata.validValues).toContain('willowy');
        expect(metadata.validValues).toContain('barrel-chested');
        expect(metadata.validValues).toContain('lanky');
      });

      it('should validate atrophied build for vestigial limbs', () => {
        const result = validateDescriptorValue('build', 'atrophied');
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate all new build values', () => {
        const newValues = ['frail', 'gaunt', 'skeletal', 'atrophied', 'cadaverous', 'massive', 'willowy', 'barrel-chested', 'lanky'];
        for (const value of newValues) {
          const result = validateDescriptorValue('build', value);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      });

      it('should format new build values correctly', () => {
        const build = BODY_DESCRIPTOR_REGISTRY.build;
        expect(build.formatter('atrophied')).toBe('Build: atrophied');
        expect(build.formatter('skeletal')).toBe('Build: skeletal');
        expect(build.formatter('massive')).toBe('Build: massive');
      });
    });

    describe('height descriptor - Extreme size values', () => {
      it('should include synchronized component values (colossal, titanic)', () => {
        const metadata = getDescriptorMetadata('height');
        expect(metadata.validValues).toContain('colossal');
        expect(metadata.validValues).toContain('titanic');
      });

      it('should include new very small values', () => {
        const metadata = getDescriptorMetadata('height');
        expect(metadata.validValues).toContain('minuscule');
        expect(metadata.validValues).toContain('microscopic');
      });

      it('should validate all new height values', () => {
        const newValues = ['colossal', 'titanic', 'minuscule', 'microscopic'];
        for (const value of newValues) {
          const result = validateDescriptorValue('height', value);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      });

      it('should format new height values correctly', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        expect(height.formatter('colossal')).toBe('Height: colossal');
        expect(height.formatter('titanic')).toBe('Height: titanic');
        expect(height.formatter('minuscule')).toBe('Height: minuscule');
        expect(height.formatter('microscopic')).toBe('Height: microscopic');
      });

      it('should maintain proper size ordering', () => {
        const height = BODY_DESCRIPTOR_REGISTRY.height;
        const sizes = height.validValues;

        // Verify smallest to largest ordering
        expect(sizes.indexOf('microscopic')).toBeLessThan(sizes.indexOf('minuscule'));
        expect(sizes.indexOf('minuscule')).toBeLessThan(sizes.indexOf('tiny'));
        expect(sizes.indexOf('tiny')).toBeLessThan(sizes.indexOf('petite'));
        expect(sizes.indexOf('petite')).toBeLessThan(sizes.indexOf('short'));
        expect(sizes.indexOf('short')).toBeLessThan(sizes.indexOf('average'));
        expect(sizes.indexOf('average')).toBeLessThan(sizes.indexOf('tall'));
        expect(sizes.indexOf('tall')).toBeLessThan(sizes.indexOf('very-tall'));
        expect(sizes.indexOf('very-tall')).toBeLessThan(sizes.indexOf('gigantic'));
        expect(sizes.indexOf('gigantic')).toBeLessThan(sizes.indexOf('colossal'));
        expect(sizes.indexOf('colossal')).toBeLessThan(sizes.indexOf('titanic'));
      });
    });

    describe('Horror entity use case - Writhing Observer', () => {
      it('should support atrophied composition for horror entities', () => {
        const result = validateDescriptorValue('composition', 'atrophied');
        expect(result.valid).toBe(true);
      });

      it('should support skeletal build for undead', () => {
        const result = validateDescriptorValue('build', 'skeletal');
        expect(result.valid).toBe(true);
      });

      it('should support rotting composition for undead', () => {
        const result = validateDescriptorValue('composition', 'rotting');
        expect(result.valid).toBe(true);
      });

      it('should support colossal height for kaiju', () => {
        const result = validateDescriptorValue('height', 'colossal');
        expect(result.valid).toBe(true);
      });
    });

    describe('Fantasy entity use cases', () => {
      it('should support willowy build for elves', () => {
        const result = validateDescriptorValue('build', 'willowy');
        expect(result.valid).toBe(true);
      });

      it('should support minuscule height for fairies', () => {
        const result = validateDescriptorValue('height', 'minuscule');
        expect(result.valid).toBe(true);
      });

      it('should support barrel-chested build for dwarves', () => {
        const result = validateDescriptorValue('build', 'barrel-chested');
        expect(result.valid).toBe(true);
      });

      it('should support titanic height for titans', () => {
        const result = validateDescriptorValue('height', 'titanic');
        expect(result.valid).toBe(true);
      });
    });

    describe('Medical/Realistic use cases', () => {
      it('should support malnourished composition', () => {
        const result = validateDescriptorValue('composition', 'malnourished');
        expect(result.valid).toBe(true);
      });

      it('should support dehydrated composition', () => {
        const result = validateDescriptorValue('composition', 'dehydrated');
        expect(result.valid).toBe(true);
      });

      it('should support frail build for elderly', () => {
        const result = validateDescriptorValue('build', 'frail');
        expect(result.valid).toBe(true);
      });

      it('should support gaunt build for starvation', () => {
        const result = validateDescriptorValue('build', 'gaunt');
        expect(result.valid).toBe(true);
      });
    });

    describe('Backward compatibility', () => {
      it('should still support all original composition values', () => {
        const originalValues = ['underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese'];
        for (const value of originalValues) {
          const result = validateDescriptorValue('composition', value);
          expect(result.valid).toBe(true);
        }
      });

      it('should still support all original build values', () => {
        const originalValues = ['skinny', 'slim', 'lissom', 'toned', 'athletic', 'shapely', 'hourglass', 'thick', 'muscular', 'hulking', 'stocky'];
        for (const value of originalValues) {
          const result = validateDescriptorValue('build', value);
          expect(result.valid).toBe(true);
        }
      });

      it('should still support all original height values', () => {
        const originalValues = ['gigantic', 'very-tall', 'tall', 'average', 'short', 'petite', 'tiny'];
        for (const value of originalValues) {
          const result = validateDescriptorValue('height', value);
          expect(result.valid).toBe(true);
        }
      });
    });
  });
});
