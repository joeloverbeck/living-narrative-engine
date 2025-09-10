/**
 * @file Unit tests for ActionTracingConfigMigration
 * @see src/configuration/actionTracingMigration.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTracingConfigMigration from '../../../src/configuration/actionTracingMigration.js';

describe('ActionTracingConfigMigration', () => {
  describe('migrateConfig', () => {
    it('should return config unchanged if actionTracing already exists', () => {
      // Arrange - Tests line 40-41 (early return path)
      const existingConfig = {
        someOtherConfig: true,
        actionTracing: {
          enabled: true,
          tracedActions: ['custom:action'],
          outputDirectory: './custom-traces',
        },
      };

      // Act
      const result = ActionTracingConfigMigration.migrateConfig(existingConfig);

      // Assert
      expect(result).toBe(existingConfig); // Should be same reference
      expect(result.actionTracing).toBe(existingConfig.actionTracing);
    });

    it('should add default actionTracing to config without it', () => {
      // Arrange - Tests line 44-47
      const configWithoutTracing = {
        someOtherConfig: true,
        anotherConfig: 'value',
      };

      // Act
      const result =
        ActionTracingConfigMigration.migrateConfig(configWithoutTracing);

      // Assert
      expect(result).not.toBe(configWithoutTracing); // Should be new object
      expect(result.someOtherConfig).toBe(true);
      expect(result.anotherConfig).toBe('value');
      expect(result.actionTracing).toBeDefined();
      expect(result.actionTracing.enabled).toBe(false);
      expect(result.actionTracing.tracedActions).toEqual([]);
      expect(result.actionTracing.outputDirectory).toBe('./traces/actions');
    });

    it('should handle empty config object', () => {
      // Arrange
      const emptyConfig = {};

      // Act
      const result = ActionTracingConfigMigration.migrateConfig(emptyConfig);

      // Assert
      expect(result.actionTracing).toBeDefined();
      expect(result.actionTracing.enabled).toBe(false);
    });

    it('should preserve existing properties when adding actionTracing', () => {
      // Arrange
      const config = {
        prop1: 'value1',
        prop2: { nested: true },
        prop3: [1, 2, 3],
      };

      // Act
      const result = ActionTracingConfigMigration.migrateConfig(config);

      // Assert
      expect(result.prop1).toBe('value1');
      expect(result.prop2).toEqual({ nested: true });
      expect(result.prop3).toEqual([1, 2, 3]);
      expect(result.actionTracing).toBeDefined();
    });
  });

  describe('getDefaultActionTracingConfig', () => {
    it('should return complete default configuration', () => {
      // Act
      const defaults =
        ActionTracingConfigMigration.getDefaultActionTracingConfig();

      // Assert - Verify structure
      expect(defaults).toBeDefined();
      expect(typeof defaults).toBe('object');

      // Assert - Verify required fields
      expect(defaults.enabled).toBe(false);
      expect(defaults.tracedActions).toEqual([]);
      expect(defaults.outputDirectory).toBe('./traces/actions');
      expect(defaults.verbosity).toBe('standard');
      expect(defaults.includeComponentData).toBe(true);
      expect(defaults.includePrerequisites).toBe(true);
      expect(defaults.includeTargets).toBe(true);
      expect(defaults.maxTraceFiles).toBe(100);
      expect(defaults.rotationPolicy).toBe('age');
      expect(defaults.maxFileAge).toBe(86400);
      expect(defaults.outputFormats).toEqual(['json']);

      // Assert - Verify textFormatOptions
      expect(defaults.textFormatOptions).toBeDefined();
      expect(defaults.textFormatOptions.enableColors).toBe(false);
      expect(defaults.textFormatOptions.lineWidth).toBe(120);
      expect(defaults.textFormatOptions.indentSize).toBe(2);
      expect(defaults.textFormatOptions.sectionSeparator).toBe('=');
      expect(defaults.textFormatOptions.includeTimestamps).toBe(true);
      expect(defaults.textFormatOptions.performanceSummary).toBe(true);
    });

    it('should return new object instance each time', () => {
      // Act
      const defaults1 =
        ActionTracingConfigMigration.getDefaultActionTracingConfig();
      const defaults2 =
        ActionTracingConfigMigration.getDefaultActionTracingConfig();

      // Assert
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('isValidMigration', () => {
    let validConfig;

    beforeEach(() => {
      validConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:action'],
          outputDirectory: './traces',
          verbosity: 'standard',
          rotationPolicy: 'age',
          maxTraceFiles: 50,
          maxFileAge: 7200,
        },
      };
    });

    it('should return true for valid configuration', () => {
      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        true
      );
    });

    it('should return false if actionTracing is missing', () => {
      // Arrange - Tests line 87-88
      const config = { someOtherConfig: true };

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(config)).toBe(false);
    });

    it('should return false if enabled is not boolean', () => {
      // Arrange - Tests line 93-94
      validConfig.actionTracing.enabled = 'true'; // string instead of boolean

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false if tracedActions is not array', () => {
      // Arrange - Tests line 97-98
      validConfig.actionTracing.tracedActions = 'core:action'; // string instead of array

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false if outputDirectory is not string', () => {
      // Arrange - Tests line 101-102
      validConfig.actionTracing.outputDirectory = 123; // number instead of string

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false for invalid verbosity value', () => {
      // Arrange - Tests line 106-110
      validConfig.actionTracing.verbosity = 'invalid';

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should accept valid verbosity values', () => {
      // Arrange & Act & Assert
      const validVerbosities = ['minimal', 'standard', 'detailed', 'verbose'];
      validVerbosities.forEach((verbosity) => {
        validConfig.actionTracing.verbosity = verbosity;
        expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
          true
        );
      });
    });

    it('should return false for invalid rotationPolicy', () => {
      // Arrange - Tests line 114-116
      validConfig.actionTracing.rotationPolicy = 'invalid';

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should accept valid rotationPolicy values', () => {
      // Arrange & Act & Assert
      const validPolicies = ['age', 'count'];
      validPolicies.forEach((policy) => {
        validConfig.actionTracing.rotationPolicy = policy;
        expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
          true
        );
      });
    });

    it('should return false if maxTraceFiles is not a number', () => {
      // Arrange - Tests line 120-121
      validConfig.actionTracing.maxTraceFiles = '50';

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false if maxTraceFiles is less than 1', () => {
      // Arrange - Tests line 122
      validConfig.actionTracing.maxTraceFiles = 0;

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false if maxTraceFiles is greater than 1000', () => {
      // Arrange - Tests line 123
      validConfig.actionTracing.maxTraceFiles = 1001;

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should accept valid maxTraceFiles values', () => {
      // Arrange & Act & Assert
      const validValues = [1, 50, 100, 500, 1000];
      validValues.forEach((value) => {
        validConfig.actionTracing.maxTraceFiles = value;
        expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
          true
        );
      });
    });

    it('should return false if maxFileAge is not a number', () => {
      // Arrange - Tests line 129-130
      validConfig.actionTracing.maxFileAge = '3600';

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should return false if maxFileAge is less than 3600', () => {
      // Arrange - Tests line 131
      validConfig.actionTracing.maxFileAge = 3599;

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        false
      );
    });

    it('should accept valid maxFileAge values', () => {
      // Arrange & Act & Assert
      const validValues = [3600, 7200, 86400];
      validValues.forEach((value) => {
        validConfig.actionTracing.maxFileAge = value;
        expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
          true
        );
      });
    });

    it('should handle optional fields being undefined', () => {
      // Arrange - Minimal valid config
      const minimalConfig = {
        actionTracing: {
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces',
        },
      };

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(minimalConfig)).toBe(
        true
      );
    });

    it('should validate all optional fields when present', () => {
      // Arrange
      const fullConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['action1', 'action2'],
          outputDirectory: './custom-traces',
          verbosity: 'verbose',
          rotationPolicy: 'count',
          maxTraceFiles: 200,
          maxFileAge: 10000,
        },
      };

      // Act & Assert
      expect(ActionTracingConfigMigration.isValidMigration(fullConfig)).toBe(
        true
      );
    });
  });

  describe('mergeWithDefaults', () => {
    let defaults;

    beforeEach(() => {
      defaults = ActionTracingConfigMigration.getDefaultActionTracingConfig();
    });

    it('should return defaults when userConfig is null', () => {
      // Act
      const result = ActionTracingConfigMigration.mergeWithDefaults(null);

      // Assert
      expect(result).toEqual(defaults);
    });

    it('should return defaults when userConfig is undefined', () => {
      // Act
      const result = ActionTracingConfigMigration.mergeWithDefaults(undefined);

      // Assert
      expect(result).toEqual(defaults);
    });

    it('should merge valid userConfig with defaults', () => {
      // Arrange
      const userConfig = {
        enabled: true,
        tracedActions: ['core:go', 'core:attack'],
        outputDirectory: './my-traces',
        verbosity: 'detailed',
      };

      // Act
      const result = ActionTracingConfigMigration.mergeWithDefaults(userConfig);

      // Assert
      expect(result.enabled).toBe(true);
      expect(result.tracedActions).toEqual(['core:go', 'core:attack']);
      expect(result.outputDirectory).toBe('./my-traces');
      expect(result.verbosity).toBe('detailed');
      // Check defaults are applied for missing fields
      expect(result.includeComponentData).toBe(true);
      expect(result.maxTraceFiles).toBe(100);
      expect(result.rotationPolicy).toBe('age');
    });

    describe('sanitizeValue for enabled field', () => {
      it('should accept boolean true', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          enabled: true,
        });
        expect(result.enabled).toBe(true);
      });

      it('should accept boolean false', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          enabled: false,
        });
        expect(result.enabled).toBe(false);
      });

      it('should fallback to default for non-boolean', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          enabled: 'true', // string instead of boolean
        });
        expect(result.enabled).toBe(false); // default value
      });
    });

    describe('sanitizeValue for tracedActions field', () => {
      it('should accept valid array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          tracedActions: ['action1', 'action2'],
        });
        expect(result.tracedActions).toEqual(['action1', 'action2']);
      });

      it('should accept empty array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          tracedActions: [],
        });
        expect(result.tracedActions).toEqual([]);
      });

      it('should fallback to default for non-array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          tracedActions: 'action1', // string instead of array
        });
        expect(result.tracedActions).toEqual([]); // default value
      });
    });

    describe('sanitizeValue for outputDirectory field', () => {
      it('should accept valid string', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputDirectory: './custom/path',
        });
        expect(result.outputDirectory).toBe('./custom/path');
      });

      it('should fallback to default for non-string', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputDirectory: 123, // number instead of string
        });
        expect(result.outputDirectory).toBe('./traces/actions'); // default
      });

      it('should fallback to default for empty string', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputDirectory: '   ', // whitespace only
        });
        expect(result.outputDirectory).toBe('./traces/actions'); // default
      });
    });

    describe('sanitizeValue for verbosity field', () => {
      it('should accept valid verbosity values', () => {
        const validValues = ['minimal', 'standard', 'detailed', 'verbose'];
        validValues.forEach((value) => {
          const result = ActionTracingConfigMigration.mergeWithDefaults({
            verbosity: value,
          });
          expect(result.verbosity).toBe(value);
        });
      });

      it('should fallback to default for invalid verbosity', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          verbosity: 'invalid',
        });
        expect(result.verbosity).toBe('standard'); // default
      });
    });

    describe('sanitizeValue for rotationPolicy field', () => {
      it('should accept valid rotation policies', () => {
        const validValues = ['age', 'count'];
        validValues.forEach((value) => {
          const result = ActionTracingConfigMigration.mergeWithDefaults({
            rotationPolicy: value,
          });
          expect(result.rotationPolicy).toBe(value);
        });
      });

      it('should fallback to default for invalid policy', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          rotationPolicy: 'invalid',
        });
        expect(result.rotationPolicy).toBe('age'); // default
      });
    });

    describe('sanitizeValue for maxTraceFiles field', () => {
      it('should accept valid number within range', () => {
        const validValues = [1, 50, 100, 500, 1000];
        validValues.forEach((value) => {
          const result = ActionTracingConfigMigration.mergeWithDefaults({
            maxTraceFiles: value,
          });
          expect(result.maxTraceFiles).toBe(value);
        });
      });

      it('should fallback to default for number below range', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          maxTraceFiles: 0,
        });
        expect(result.maxTraceFiles).toBe(100); // default
      });

      it('should fallback to default for number above range', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          maxTraceFiles: 1001,
        });
        expect(result.maxTraceFiles).toBe(100); // default
      });

      it('should fallback to default for non-number', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          maxTraceFiles: '50',
        });
        expect(result.maxTraceFiles).toBe(100); // default
      });
    });

    describe('sanitizeValue for maxFileAge field', () => {
      it('should accept valid number >= 3600', () => {
        const validValues = [3600, 7200, 86400];
        validValues.forEach((value) => {
          const result = ActionTracingConfigMigration.mergeWithDefaults({
            maxFileAge: value,
          });
          expect(result.maxFileAge).toBe(value);
        });
      });

      it('should fallback to default for number below minimum', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          maxFileAge: 3599,
        });
        expect(result.maxFileAge).toBe(86400); // default
      });

      it('should fallback to default for non-number', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          maxFileAge: '3600',
        });
        expect(result.maxFileAge).toBe(86400); // default
      });
    });

    describe('sanitizeValue for boolean fields', () => {
      const booleanFields = [
        'includeComponentData',
        'includePrerequisites',
        'includeTargets',
      ];

      booleanFields.forEach((field) => {
        it(`should accept boolean values for ${field}`, () => {
          const resultTrue = ActionTracingConfigMigration.mergeWithDefaults({
            [field]: true,
          });
          expect(resultTrue[field]).toBe(true);

          const resultFalse = ActionTracingConfigMigration.mergeWithDefaults({
            [field]: false,
          });
          expect(resultFalse[field]).toBe(false);
        });

        it(`should fallback to default for non-boolean ${field}`, () => {
          const result = ActionTracingConfigMigration.mergeWithDefaults({
            [field]: 'true', // string instead of boolean
          });
          expect(result[field]).toBe(defaults[field]);
        });
      });
    });

    describe('sanitizeValue for outputFormats field', () => {
      it('should accept valid format array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputFormats: ['json', 'text', 'html'],
        });
        expect(result.outputFormats).toEqual(['json', 'text', 'html']);
      });

      it('should accept single valid format', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputFormats: ['markdown'],
        });
        expect(result.outputFormats).toEqual(['markdown']);
      });

      it('should fallback to default for invalid format in array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputFormats: ['json', 'invalid', 'text'],
        });
        expect(result.outputFormats).toEqual(['json']); // default
      });

      it('should fallback to default for non-array', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputFormats: 'json', // string instead of array
        });
        expect(result.outputFormats).toEqual(['json']); // default
      });

      it('should accept all valid formats', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          outputFormats: ['json', 'text', 'html', 'markdown'],
        });
        expect(result.outputFormats).toEqual([
          'json',
          'text',
          'html',
          'markdown',
        ]);
      });
    });

    describe('sanitizeValue for textFormatOptions field', () => {
      it('should accept valid textFormatOptions object', () => {
        const options = {
          enableColors: true,
          lineWidth: 100,
          indentSize: 4,
          sectionSeparator: '-',
          includeTimestamps: false,
          performanceSummary: false,
        };
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: options,
        });
        expect(result.textFormatOptions).toEqual(options);
      });

      it('should sanitize individual fields in textFormatOptions', () => {
        const options = {
          enableColors: 'true', // invalid - should use default
          lineWidth: 150, // valid
          indentSize: 10, // invalid - out of range
          sectionSeparator: '---', // invalid - too long
          includeTimestamps: true, // valid
          performanceSummary: null, // invalid - should use default
        };
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: options,
        });
        expect(result.textFormatOptions).toEqual({
          enableColors: false, // default
          lineWidth: 150, // kept valid value
          indentSize: 2, // default
          sectionSeparator: '=', // default
          includeTimestamps: true, // kept valid value
          performanceSummary: true, // default
        });
      });

      it('should validate lineWidth range (80-200)', () => {
        const result1 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { lineWidth: 79 },
        });
        expect(result1.textFormatOptions.lineWidth).toBe(120); // default

        const result2 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { lineWidth: 201 },
        });
        expect(result2.textFormatOptions.lineWidth).toBe(120); // default

        const result3 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { lineWidth: 80 },
        });
        expect(result3.textFormatOptions.lineWidth).toBe(80); // valid

        const result4 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { lineWidth: 200 },
        });
        expect(result4.textFormatOptions.lineWidth).toBe(200); // valid
      });

      it('should validate indentSize range (0-8)', () => {
        const result1 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { indentSize: -1 },
        });
        expect(result1.textFormatOptions.indentSize).toBe(2); // default

        const result2 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { indentSize: 9 },
        });
        expect(result2.textFormatOptions.indentSize).toBe(2); // default

        const result3 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { indentSize: 0 },
        });
        expect(result3.textFormatOptions.indentSize).toBe(0); // valid

        const result4 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { indentSize: 8 },
        });
        expect(result4.textFormatOptions.indentSize).toBe(8); // valid
      });

      it('should validate sectionSeparator is single character', () => {
        const result1 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { sectionSeparator: '' },
        });
        expect(result1.textFormatOptions.sectionSeparator).toBe('='); // default

        const result2 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { sectionSeparator: '==' },
        });
        expect(result2.textFormatOptions.sectionSeparator).toBe('='); // default

        const result3 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: { sectionSeparator: '*' },
        });
        expect(result3.textFormatOptions.sectionSeparator).toBe('*'); // valid
      });

      it('should fallback to default for non-object textFormatOptions', () => {
        const result1 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: null,
        });
        expect(result1.textFormatOptions).toEqual(defaults.textFormatOptions);

        const result2 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: 'invalid',
        });
        expect(result2.textFormatOptions).toEqual(defaults.textFormatOptions);

        const result3 = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: [],
        });
        expect(result3.textFormatOptions).toEqual(defaults.textFormatOptions);
      });

      it('should handle partial textFormatOptions object', () => {
        const result = ActionTracingConfigMigration.mergeWithDefaults({
          textFormatOptions: {
            enableColors: true,
            // Missing other fields
          },
        });
        expect(result.textFormatOptions).toEqual({
          enableColors: true,
          lineWidth: 120, // default
          indentSize: 2, // default
          sectionSeparator: '=', // default
          includeTimestamps: true, // default
          performanceSummary: true, // default
        });
      });
    });

    it('should handle complete valid configuration', () => {
      // Arrange
      const completeConfig = {
        enabled: true,
        tracedActions: ['core:go', 'core:attack', 'mod:custom'],
        outputDirectory: './custom-traces',
        verbosity: 'verbose',
        includeComponentData: false,
        includePrerequisites: false,
        includeTargets: false,
        maxTraceFiles: 500,
        rotationPolicy: 'count',
        maxFileAge: 7200,
        outputFormats: ['json', 'text', 'markdown'],
        textFormatOptions: {
          enableColors: true,
          lineWidth: 150,
          indentSize: 4,
          sectionSeparator: '-',
          includeTimestamps: false,
          performanceSummary: false,
        },
      };

      // Act
      const result =
        ActionTracingConfigMigration.mergeWithDefaults(completeConfig);

      // Assert - All values should be preserved
      expect(result).toEqual(completeConfig);
    });

    it('should handle mixed valid and invalid configuration', () => {
      // Arrange
      const mixedConfig = {
        enabled: true, // valid
        tracedActions: 'not-an-array', // invalid
        outputDirectory: './valid-path', // valid
        verbosity: 'ultra', // invalid
        includeComponentData: 'yes', // invalid
        maxTraceFiles: 2000, // invalid (too high)
        rotationPolicy: 'count', // valid
        outputFormats: ['json', 'invalid-format'], // partially invalid
        textFormatOptions: {
          enableColors: true, // valid
          lineWidth: 50, // invalid (too low)
          indentSize: 3, // valid
        },
      };

      // Act
      const result =
        ActionTracingConfigMigration.mergeWithDefaults(mixedConfig);

      // Assert
      expect(result.enabled).toBe(true); // kept valid
      expect(result.tracedActions).toEqual([]); // default for invalid
      expect(result.outputDirectory).toBe('./valid-path'); // kept valid
      expect(result.verbosity).toBe('standard'); // default for invalid
      expect(result.includeComponentData).toBe(true); // default for invalid
      expect(result.maxTraceFiles).toBe(100); // default for invalid
      expect(result.rotationPolicy).toBe('count'); // kept valid
      expect(result.outputFormats).toEqual(['json']); // default for invalid array
      expect(result.textFormatOptions.enableColors).toBe(true); // kept valid
      expect(result.textFormatOptions.lineWidth).toBe(120); // default for invalid
      expect(result.textFormatOptions.indentSize).toBe(3); // kept valid
    });

    it('should handle undefined values in userConfig', () => {
      // Arrange
      const configWithUndefined = {
        enabled: undefined,
        tracedActions: undefined,
        outputDirectory: undefined,
      };

      // Act
      const result =
        ActionTracingConfigMigration.mergeWithDefaults(configWithUndefined);

      // Assert - Should use defaults for undefined values
      expect(result.enabled).toBe(defaults.enabled);
      expect(result.tracedActions).toEqual(defaults.tracedActions);
      expect(result.outputDirectory).toBe(defaults.outputDirectory);
    });

    it('should handle null values in userConfig', () => {
      // Arrange
      const configWithNull = {
        enabled: null,
        tracedActions: null,
        outputDirectory: null,
      };

      // Act
      const result =
        ActionTracingConfigMigration.mergeWithDefaults(configWithNull);

      // Assert - Should use defaults for null values
      expect(result.enabled).toBe(defaults.enabled);
      expect(result.tracedActions).toEqual(defaults.tracedActions);
      expect(result.outputDirectory).toBe(defaults.outputDirectory);
    });
  });
});
