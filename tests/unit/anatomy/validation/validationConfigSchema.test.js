/**
 * @file Tests for validation-config.schema.json
 * @see data/schemas/validation-config.schema.json
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Validation Config Schema', () => {
  let ajv;
  let schema;
  let validate;

  beforeAll(() => {
    const schemaPath = join(
      process.cwd(),
      'data/schemas/validation-config.schema.json'
    );
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    ajv = new Ajv({ strict: true, allErrors: true });
    validate = ajv.compile(schema);
  });

  describe('Valid Configurations', () => {
    it('should accept valid minimal configuration', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      if (!result) {
        console.error('Validation errors:', validate.errors);
      }
      expect(result).toBe(true);
    });

    it('should accept valid full configuration with all options', () => {
      const config = {
        mods: {
          essential: ['core', 'descriptors', 'anatomy'],
          optional: ['custom-mod'],
          autoDetect: true,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
            failFast: false,
            config: {
              customOption: 'value',
            },
          },
          {
            name: 'property_schemas',
            enabled: false,
            priority: 200,
            failFast: true,
            config: {},
          },
        ],
        errorHandling: {
          defaultSeverity: 'warning',
          severityOverrides: {
            component_existence: 'error',
            property_schemas: 'info',
          },
          continueOnError: true,
        },
        output: {
          format: 'json',
          verbose: true,
          colorize: false,
        },
      };

      const result = validate(config);
      if (!result) {
        console.error('Validation errors:', validate.errors);
      }
      expect(result).toBe(true);
    });
  });

  describe('Required Field Validation', () => {
    it('should reject config without mods section', () => {
      const config = {
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.params.missingProperty === 'mods')).toBe(
        true
      );
    });

    it('should reject config without validators section', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.params.missingProperty === 'validators')
      ).toBe(true);
    });

    it('should reject mods without essential array', () => {
      const config = {
        mods: {
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.params.missingProperty === 'essential')
      ).toBe(true);
    });

    it('should reject mods without autoDetect boolean', () => {
      const config = {
        mods: {
          essential: ['core'],
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.params.missingProperty === 'autoDetect')
      ).toBe(true);
    });
  });

  describe('Validator Validation', () => {
    it('should reject validator without name', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.params.missingProperty === 'name')).toBe(
        true
      );
    });

    it('should reject validator without priority', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(
        validate.errors.some((e) => e.params.missingProperty === 'priority')
      ).toBe(true);
    });

    it('should reject invalid validator name (not in enum)', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'invalid_validator_name',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });

    it('should accept all 11 valid validator names', () => {
      const validatorNames = [
        'component_existence',
        'property_schemas',
        'body_descriptors',
        'blueprint_existence',
        'socket_slot_compatibility',
        'pattern_matching',
        'descriptor_coverage',
        'part_availability',
        'generated_slot_parts',
        'load_failures',
        'recipe_usage',
      ];

      validatorNames.forEach((name) => {
        const config = {
          mods: {
            essential: ['core'],
            autoDetect: false,
          },
          validators: [
            {
              name,
              enabled: true,
              priority: 100,
            },
          ],
        };

        const result = validate(config);
        if (!result) {
          console.error(`Failed for validator: ${name}`, validate.errors);
        }
        expect(result).toBe(true);
      });
    });
  });

  describe('Enum Validation', () => {
    it('should reject invalid severity level', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
        errorHandling: {
          defaultSeverity: 'critical', // Invalid
        },
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });

    it('should reject invalid output format', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
        output: {
          format: 'xml', // Invalid
        },
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'enum')).toBe(true);
    });
  });

  describe('Additional Edge Cases', () => {
    it('should accept configuration with optional fields omitted', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: true,
          // optional field omitted
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
            // failFast and config omitted
          },
        ],
        // errorHandling and output omitted
      };

      const result = validate(config);
      if (!result) {
        console.error('Validation errors:', validate.errors);
      }
      expect(result).toBe(true);
    });

    it('should reject configuration with extra properties', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
        extraProperty: 'not allowed', // Extra property
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'additionalProperties')).toBe(
        true
      );
    });

    it('should reject empty essential array', () => {
      const config = {
        mods: {
          essential: [], // Empty array
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: 100,
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'minItems')).toBe(true);
    });

    it('should reject empty validators array', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [], // Empty array
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'minItems')).toBe(true);
    });

    it('should reject negative priority', () => {
      const config = {
        mods: {
          essential: ['core'],
          autoDetect: false,
        },
        validators: [
          {
            name: 'component_existence',
            enabled: true,
            priority: -1, // Negative priority
          },
        ],
      };

      const result = validate(config);
      expect(result).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors.some((e) => e.keyword === 'minimum')).toBe(true);
    });

    it('should accept all valid severity levels', () => {
      const severityLevels = ['error', 'warning', 'info'];

      severityLevels.forEach((severity) => {
        const config = {
          mods: {
            essential: ['core'],
            autoDetect: false,
          },
          validators: [
            {
              name: 'component_existence',
              enabled: true,
              priority: 100,
            },
          ],
          errorHandling: {
            defaultSeverity: severity,
          },
        };

        const result = validate(config);
        if (!result) {
          console.error(`Failed for severity: ${severity}`, validate.errors);
        }
        expect(result).toBe(true);
      });
    });

    it('should accept all valid output formats', () => {
      const outputFormats = ['text', 'json', 'junit'];

      outputFormats.forEach((format) => {
        const config = {
          mods: {
            essential: ['core'],
            autoDetect: false,
          },
          validators: [
            {
              name: 'component_existence',
              enabled: true,
              priority: 100,
            },
          ],
          output: {
            format,
          },
        };

        const result = validate(config);
        if (!result) {
          console.error(`Failed for format: ${format}`, validate.errors);
        }
        expect(result).toBe(true);
      });
    });
  });
});
