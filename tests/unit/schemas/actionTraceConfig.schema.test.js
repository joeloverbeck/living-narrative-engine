/**
 * @file Test suite for validating action trace configuration against actionTraceConfig.schema.json
 * @see data/schemas/actionTraceConfig.schema.json
 */

import { describe, it, expect, beforeAll, test } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema to be tested
import actionTraceConfigSchema from '../../../data/schemas/actionTraceConfig.schema.json';

describe('Action Trace Config Schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Compile the schema
    validate = ajv.compile(actionTraceConfigSchema);
  });

  test('should accept valid minimal configuration', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:go'],
        outputDirectory: './traces/actions',
      },
    };

    const ok = validate(config);
    if (!ok) {
      console.error('Validation errors:', validate.errors);
    }
    expect(ok).toBe(true);
  });

  test('should accept wildcard patterns', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: ['*', 'core:*', 'custom:specific_action'],
        outputDirectory: './traces/actions',
      },
    };

    const ok = validate(config);
    expect(ok).toBe(true);
  });

  test('should reject invalid action ID patterns', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: ['invalid-format', 'Core:Go'], // Wrong format
        outputDirectory: './traces/actions',
      },
    };

    const ok = validate(config);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaPath: expect.stringContaining('pattern'),
        }),
      ])
    );
  });

  test('should enforce required fields', () => {
    const config = {
      actionTracing: {
        enabled: true,
        // Missing tracedActions and outputDirectory
      },
    };

    const ok = validate(config);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('required'),
        }),
      ])
    );
  });

  test('should validate verbosity levels', () => {
    const validLevels = ['minimal', 'standard', 'detailed', 'verbose'];

    validLevels.forEach((level) => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          verbosity: level,
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });

    const invalidConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        verbosity: 'invalid-level',
      },
    };

    const ok = validate(invalidConfig);
    expect(ok).toBe(false);
  });

  test('should validate numeric constraints', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        maxTraceFiles: 500,
        maxFileAge: 7200,
      },
    };

    let ok = validate(config);
    expect(ok).toBe(true);

    // Test boundary violations
    config.actionTracing.maxTraceFiles = 0; // Below minimum
    ok = validate(config);
    expect(ok).toBe(false);

    config.actionTracing.maxTraceFiles = 1001; // Above maximum
    ok = validate(config);
    expect(ok).toBe(false);

    config.actionTracing.maxTraceFiles = 100; // Valid again
    config.actionTracing.maxFileAge = 3599; // Below minimum
    ok = validate(config);
    expect(ok).toBe(false);
  });

  test('should validate rotation policy', () => {
    const validPolicies = ['age', 'count'];

    validPolicies.forEach((policy) => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          rotationPolicy: policy,
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });

    const invalidConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        rotationPolicy: 'invalid-policy',
      },
    };

    const ok = validate(invalidConfig);
    expect(ok).toBe(false);
  });

  test('should accept full configuration with all optional fields', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:*', 'custom:debug_action'],
        outputDirectory: './traces/actions',
        verbosity: 'detailed',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 50,
        rotationPolicy: 'count',
        maxFileAge: 86400,
      },
    };

    const ok = validate(config);
    if (!ok) {
      console.error('Validation errors:', validate.errors);
    }
    expect(ok).toBe(true);
  });

  test('should reject additional properties', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        unknownProperty: 'should not be allowed',
      },
    };

    const ok = validate(config);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('additional properties'),
        }),
      ])
    );
  });

  test('should validate boolean fields', () => {
    const booleanFields = [
      'enabled',
      'includeComponentData',
      'includePrerequisites',
      'includeTargets',
    ];

    booleanFields.forEach((field) => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          [field]: 'not-a-boolean', // Invalid type
        },
      };

      const ok = validate(config);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('boolean'),
          }),
        ])
      );
    });
  });

  test('should require actionTracing as top-level property', () => {
    const config = {
      enabled: true,
      tracedActions: [],
      outputDirectory: './traces',
    };

    const ok = validate(config);
    expect(ok).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("required property 'actionTracing'"),
        }),
      ])
    );
  });

  test('should accept empty tracedActions array', () => {
    const config = {
      actionTracing: {
        enabled: false,
        tracedActions: [],
        outputDirectory: './traces/actions',
      },
    };

    const ok = validate(config);
    expect(ok).toBe(true);
  });

  test('should validate maxTraceFiles boundaries', () => {
    // Test minimum boundary
    let config = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        maxTraceFiles: 1,
      },
    };

    let ok = validate(config);
    expect(ok).toBe(true);

    // Test maximum boundary
    config.actionTracing.maxTraceFiles = 1000;
    ok = validate(config);
    expect(ok).toBe(true);
  });

  test('should validate maxFileAge boundary', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        outputDirectory: './traces',
        maxFileAge: 3600, // Minimum allowed
      },
    };

    const ok = validate(config);
    expect(ok).toBe(true);
  });

  describe('outputFormats validation', () => {
    test('should accept valid output formats', () => {
      const validFormats = [
        ['json'],
        ['text'],
        ['json', 'text'],
      ];

      validFormats.forEach((formats) => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: [],
            outputDirectory: './traces',
            outputFormats: formats,
          },
        };

        const ok = validate(config);
        if (!ok) {
          console.error(
            `Failed for formats: ${JSON.stringify(formats)}`,
            validate.errors
          );
        }
        expect(ok).toBe(true);
      });
    });

    test('should reject invalid output formats', () => {
      const invalidFormats = [
        ['html'],
        ['markdown'],
        ['xml'],
        ['pdf'],
        ['csv'],
        ['json', 'invalid'],
        ['text', 'html'],
        ['json', 'markdown'],
      ];

      invalidFormats.forEach((formats) => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: [],
            outputDirectory: './traces',
            outputFormats: formats,
          },
        };

        const ok = validate(config);
        expect(ok).toBe(false);
        expect(validate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining(
                'equal to one of the allowed values'
              ),
            }),
          ])
        );
      });
    });

    test('should accept empty outputFormats array', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          outputFormats: [],
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });

    test('should default to json format', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          // outputFormats not specified - should use default
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });
  });

  describe('textFormatOptions validation', () => {
    test('should accept valid textFormatOptions', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            enableColors: true,
            lineWidth: 120,
            indentSize: 4,
            sectionSeparator: '-',
            includeTimestamps: false,
            performanceSummary: true,
          },
        },
      };

      const ok = validate(config);
      if (!ok) {
        console.error('textFormatOptions validation failed:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate lineWidth boundaries', () => {
      // Test minimum boundary
      let config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            lineWidth: 80, // Minimum allowed
          },
        },
      };

      let ok = validate(config);
      expect(ok).toBe(true);

      // Test maximum boundary
      config.actionTracing.textFormatOptions.lineWidth = 200; // Maximum allowed
      ok = validate(config);
      expect(ok).toBe(true);

      // Test below minimum
      config.actionTracing.textFormatOptions.lineWidth = 79;
      ok = validate(config);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('must be >= 80'),
          }),
        ])
      );

      // Test above maximum
      config.actionTracing.textFormatOptions.lineWidth = 201;
      ok = validate(config);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('must be <= 200'),
          }),
        ])
      );
    });

    test('should validate indentSize boundaries', () => {
      // Test minimum boundary
      let config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            indentSize: 0, // Minimum allowed
          },
        },
      };

      let ok = validate(config);
      expect(ok).toBe(true);

      // Test maximum boundary
      config.actionTracing.textFormatOptions.indentSize = 8; // Maximum allowed
      ok = validate(config);
      expect(ok).toBe(true);

      // Test below minimum (negative)
      config.actionTracing.textFormatOptions.indentSize = -1;
      ok = validate(config);
      expect(ok).toBe(false);

      // Test above maximum
      config.actionTracing.textFormatOptions.indentSize = 9;
      ok = validate(config);
      expect(ok).toBe(false);
    });

    test('should validate boolean fields in textFormatOptions', () => {
      const booleanFields = [
        'enableColors',
        'includeTimestamps',
        'performanceSummary',
      ];

      booleanFields.forEach((field) => {
        const config = {
          actionTracing: {
            enabled: true,
            tracedActions: [],
            outputDirectory: './traces',
            textFormatOptions: {
              [field]: 'not-a-boolean', // Invalid type
            },
          },
        };

        const ok = validate(config);
        expect(ok).toBe(false);
        expect(validate.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('boolean'),
            }),
          ])
        );
      });
    });

    test('should validate sectionSeparator maxLength constraint', () => {
      // Valid single character
      let config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            sectionSeparator: '=',
          },
        },
      };

      let ok = validate(config);
      expect(ok).toBe(true);

      // Invalid - too long
      config.actionTracing.textFormatOptions.sectionSeparator = '==';
      ok = validate(config);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining(
              'must NOT have more than 1 characters'
            ),
          }),
        ])
      );
    });

    test('should reject additional properties in textFormatOptions', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            unknownProperty: 'should not be allowed',
          },
        },
      };

      const ok = validate(config);
      expect(ok).toBe(false);
      expect(validate.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('additional properties'),
          }),
        ])
      );
    });

    test('should accept partial textFormatOptions', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {
            enableColors: true,
            // Only specify some options - others should use defaults
          },
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });

    test('should accept empty textFormatOptions object', () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
          textFormatOptions: {},
        },
      };

      const ok = validate(config);
      expect(ok).toBe(true);
    });
  });

  test('should accept configuration with both new fields', () => {
    const config = {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:*'],
        outputDirectory: './traces/actions',
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: true,
          lineWidth: 100,
          indentSize: 2,
          sectionSeparator: '-',
          includeTimestamps: true,
          performanceSummary: false,
        },
      },
    };

    const ok = validate(config);
    if (!ok) {
      console.error('Combined new fields validation failed:', validate.errors);
    }
    expect(ok).toBe(true);
  });
});
