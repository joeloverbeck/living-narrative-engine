/**
 * @file Test suite for anatomy:body component schema validation
 * Tests the new optional descriptors field and backward compatibility
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import schemas
import componentSchema from '../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../data/schemas/common.schema.json';
import bodyComponent from '../../../../data/mods/anatomy/components/body.component.json';

describe('BodyComponent Schema Validation', () => {
  let ajv;
  let validate;

  beforeEach(() => {
    ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);
    validate = ajv.compile(componentSchema);
  });

  describe('Component Definition Validation', () => {
    it('should validate the body component definition itself', () => {
      const isValid = validate(bodyComponent);
      if (!isValid) {
        console.log('Body component validation errors:', validate.errors);
      }
      expect(isValid).toBe(true);
    });
  });

  describe('Body Component Data Schema Validation', () => {
    let dataValidate;

    beforeEach(() => {
      dataValidate = ajv.compile(bodyComponent.dataSchema);
    });

    describe('Valid Body Components', () => {
      it('should validate body component without descriptors (backward compatibility)', () => {
        const validData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: {
              torso: 'part_123_torso',
              head: 'part_456_head',
            },
          },
        };

        const isValid = dataValidate(validData);
        if (!isValid) {
          console.log('Validation errors:', dataValidate.errors);
        }
        expect(isValid).toBe(true);
      });

      it('should validate body component with all descriptors', () => {
        const validData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: {
              torso: 'part_123_torso',
              head: 'part_456_head',
            },
            descriptors: {
              build: 'athletic',
              density: 'moderate',
              composition: 'average',
              skinColor: 'olive',
            },
          },
        };

        const isValid = dataValidate(validData);
        if (!isValid) {
          console.log('Validation errors:', dataValidate.errors);
        }
        expect(isValid).toBe(true);
      });

      it('should validate body component with partial descriptors', () => {
        const validData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: {
              torso: 'part_123_torso',
            },
            descriptors: {
              build: 'slim',
              skinColor: 'pale',
            },
          },
        };

        const isValid = dataValidate(validData);
        if (!isValid) {
          console.log('Validation errors:', dataValidate.errors);
        }
        expect(isValid).toBe(true);
      });

      it('should validate body component with null body (allowed)', () => {
        const validData = {
          recipeId: 'anatomy:human',
          body: null,
        };

        const isValid = dataValidate(validData);
        if (!isValid) {
          console.log('Validation errors:', dataValidate.errors);
        }
        expect(isValid).toBe(true);
      });

      it('should validate all build enum values', () => {
        const buildValues = [
          'skinny',
          'slim',
          'toned',
          'athletic',
          'shapely',
          'hourglass',
          'thick',
          'muscular',
          'stocky',
        ];

        buildValues.forEach((build) => {
          const validData = {
            recipeId: 'anatomy:human',
            body: {
              root: 'part_123_torso',
              parts: { torso: 'part_123_torso' },
              descriptors: { build },
            },
          };

          const isValid = dataValidate(validData);
          if (!isValid) {
            console.log(
              `Build '${build}' validation errors:`,
              dataValidate.errors
            );
          }
          expect(isValid).toBe(true);
        });
      });

      it('should validate all density enum values', () => {
        const densityValues = [
          'hairless',
          'sparse',
          'light',
          'moderate',
          'hairy',
          'very-hairy',
        ];

        densityValues.forEach((density) => {
          const validData = {
            recipeId: 'anatomy:human',
            body: {
              root: 'part_123_torso',
              parts: { torso: 'part_123_torso' },
              descriptors: { density },
            },
          };

          const isValid = dataValidate(validData);
          if (!isValid) {
            console.log(
              `Density '${density}' validation errors:`,
              dataValidate.errors
            );
          }
          expect(isValid).toBe(true);
        });
      });

      it('should validate all composition enum values', () => {
        const compositionValues = [
          'underweight',
          'lean',
          'average',
          'soft',
          'chubby',
          'overweight',
          'obese',
        ];

        compositionValues.forEach((composition) => {
          const validData = {
            recipeId: 'anatomy:human',
            body: {
              root: 'part_123_torso',
              parts: { torso: 'part_123_torso' },
              descriptors: { composition },
            },
          };

          const isValid = dataValidate(validData);
          if (!isValid) {
            console.log(
              `Composition '${composition}' validation errors:`,
              dataValidate.errors
            );
          }
          expect(isValid).toBe(true);
        });
      });

      it('should validate skinColor as any string', () => {
        const skinColorValues = [
          'pale',
          'olive',
          'dark',
          'tanned',
          'alabaster',
          'bronze',
        ];

        skinColorValues.forEach((skinColor) => {
          const validData = {
            recipeId: 'anatomy:human',
            body: {
              root: 'part_123_torso',
              parts: { torso: 'part_123_torso' },
              descriptors: { skinColor },
            },
          };

          const isValid = dataValidate(validData);
          if (!isValid) {
            console.log(
              `Skin color '${skinColor}' validation errors:`,
              dataValidate.errors
            );
          }
          expect(isValid).toBe(true);
        });
      });
    });

    describe('Invalid Body Components', () => {
      it('should reject invalid build enum value', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
            descriptors: {
              build: 'invalid-build-type',
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body/descriptors/build',
              keyword: 'enum',
            }),
          ])
        );
      });

      it('should reject invalid density enum value', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
            descriptors: {
              density: 'invalid-density',
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body/descriptors/density',
              keyword: 'enum',
            }),
          ])
        );
      });

      it('should reject invalid composition enum value', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
            descriptors: {
              composition: 'invalid-composition',
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body/descriptors/composition',
              keyword: 'enum',
            }),
          ])
        );
      });

      it('should reject additional properties in descriptors', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
            descriptors: {
              build: 'athletic',
              unknownProperty: 'value',
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body/descriptors',
              keyword: 'additionalProperties',
            }),
          ])
        );
      });

      it('should reject missing required fields (root, parts)', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            descriptors: {
              build: 'athletic',
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body',
              keyword: 'required',
            }),
          ])
        );
      });

      it('should reject missing recipeId', () => {
        const invalidData = {
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '',
              keyword: 'required',
            }),
          ])
        );
      });

      it('should reject non-string descriptor values (except skinColor)', () => {
        const invalidData = {
          recipeId: 'anatomy:human',
          body: {
            root: 'part_123_torso',
            parts: { torso: 'part_123_torso' },
            descriptors: {
              build: 123, // should be string
            },
          },
        };

        const isValid = dataValidate(invalidData);
        expect(isValid).toBe(false);
        expect(dataValidate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              instancePath: '/body/descriptors/build',
              keyword: 'type',
            }),
          ])
        );
      });
    });
  });
});
