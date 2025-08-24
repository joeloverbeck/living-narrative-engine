/**
 * @file Unit tests for ActionTraceConfigValidator enhancements (DUALFORMACT-002)
 * @see src/configuration/actionTraceConfigValidator.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createMockSchemaValidator } from '../../common/mockFactories/traceConfigMocks.js';

describe('ActionTraceConfigValidator Enhancements', () => {
  let validator;
  let mockLogger;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockSchemaValidator = createMockSchemaValidator();

    validator = new ActionTraceConfigValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });
  });

  describe('Cross-Field Validation', () => {
    it('should warn when text format options are configured without text output', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['json'], // No 'text'
          textFormatOptions: {
            enableColors: true,
            lineWidth: 120,
            indentSize: 2,
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Text format options are configured but 'text' is not in outputFormats"
        )
      );
    });

    it('should warn about ANSI colors with HTML output', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['html'],
          textFormatOptions: {
            enableColors: true,
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          'ANSI colors are enabled but HTML output is selected'
        )
      );
    });

    it('should validate text format option ranges', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['text'],
          textFormatOptions: {
            lineWidth: 350, // Out of range (40-300)
            indentSize: 10, // Out of range (0-8)
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.errors).toContainEqual(
        expect.stringContaining(
          'Text format lineWidth 350 is out of recommended range'
        )
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining(
          'Text format indentSize 10 is out of valid range'
        )
      );
    });

    it('should warn about verbosity conflicts with inclusion settings', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          verbosity: 'minimal',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Verbosity is set to 'minimal' but detailed inclusions are enabled"
        )
      );
    });

    it('should warn about conflicting rotation policies', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          rotationPolicy: 'count',
          maxTraceFiles: 100,
          maxFileAge: 3600, // Conflicting with count policy
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Both 'count' rotation policy and maxFileAge are specified"
        )
      );
    });
  });

  describe('Configuration Recommendations', () => {
    it('should recommend wildcards for multiple actions from same mod', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: [
            'core:move',
            'core:attack',
            'core:interact',
            'core:talk',
            'inventory:add',
            'inventory:remove',
          ],
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Consider using 'core:*' wildcard instead of 4 individual actions"
        )
      );
    });

    it('should recommend appropriate verbosity for output formats', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['json'],
          verbosity: 'verbose',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "'verbose' verbosity with JSON output may create large files"
        )
      );
    });

    it('should recommend performance settings for wildcard tracing', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'detailed',
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Tracing all actions with 'detailed' verbosity will impact performance"
        )
      );
    });

    it('should recommend enabling performance summary', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['text'],
          textFormatOptions: {
            performanceSummary: false,
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Enable 'performanceSummary' in textFormatOptions for better performance insights"
        )
      );
    });

    it('should recommend rotation optimization for high file counts', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          rotationPolicy: 'count',
          maxTraceFiles: 300,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          'High maxTraceFiles (300) may impact directory performance'
        )
      );
    });

    it('should recommend enabling timestamps', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          textFormatOptions: {
            includeTimestamps: false,
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          "Enable 'includeTimestamps' in textFormatOptions for better trace correlation"
        )
      );
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle missing textFormatOptions gracefully', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['text'],
          // textFormatOptions missing
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      // Should not crash, defaults should be applied
    });

    it('should handle invalid section separator for markdown', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['markdown'],
          textFormatOptions: {
            sectionSeparator: '==', // Should be single character
          },
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Invalid section separator for Markdown output')
      );
    });

    it('should handle empty configuration sections', async () => {
      const config = {
        actionTracing: {},
      };

      const result = await validator.validateConfiguration(config);

      // Should handle gracefully with defaults
      expect(result.normalizedConfig).toBeDefined();
    });

    it('should handle very large traced actions arrays', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: Array(100)
            .fill(null)
            .map((_, i) => `mod${i}:action`),
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Tracing 100 actions may impact performance')
      );
    });
  });

  describe('Normalization', () => {
    it('should remove duplicate traced actions', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move', 'core:attack', 'core:move'], // Duplicate
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.tracedActions).toEqual([
        'core:move',
        'core:attack',
      ]);
    });

    it('should set default rotation values based on policy', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          rotationPolicy: 'count',
          // maxTraceFiles not specified
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.maxTraceFiles).toBe(100);
    });

    it('should handle age-based rotation defaults', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          rotationPolicy: 'age',
          // maxFileAge not specified
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.normalizedConfig.actionTracing.maxFileAge).toBe(86400);
    });
  });

  describe('Performance Impact Assessment', () => {
    it('should detect high performance impact configurations', async () => {
      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
        },
      };

      const result = await validator.validateConfiguration(config);

      expect(result.warnings).toContainEqual(
        expect.stringContaining(
          'High performance impact configuration detected'
        )
      );
    });
  });
});
