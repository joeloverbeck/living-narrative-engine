/**
 * @file Configuration and validation tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateCategorizationConfig,
  validateConfigurationSemantics,
  createTestConfig,
  mergeConfigurations,
} from '../../../../src/entities/utils/actionCategorizationConfigValidator.js';

import {
  DEFAULT_CATEGORIZATION_CONFIG,
  UI_CATEGORIZATION_CONFIG,
  LLM_CATEGORIZATION_CONFIG,
  CONFIG_VALIDATION_ERRORS,
} from '../../../../src/entities/utils/actionCategorizationConfig.js';

import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('Action Categorization Configuration', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  describe('validateCategorizationConfig', () => {
    it('should validate and return default config for empty input', () => {
      const result = validateCategorizationConfig({}, mockLogger);
      expect(result).toEqual(DEFAULT_CATEGORIZATION_CONFIG);
    });

    it('should merge user config with defaults', () => {
      const userConfig = {
        minActionsForGrouping: 10,
        namespaceOrder: ['custom', 'core'],
      };

      const result = validateCategorizationConfig(userConfig, mockLogger);

      expect(result.minActionsForGrouping).toBe(10);
      expect(result.namespaceOrder).toEqual(['custom', 'core']);
      expect(result.enabled).toBe(DEFAULT_CATEGORIZATION_CONFIG.enabled);
    });

    it('should throw for invalid boolean fields', () => {
      expect(() => {
        validateCategorizationConfig({ enabled: 'true' }, mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig({ showCounts: 1 }, mockLogger);
      }).toThrow(InvalidArgumentError);
    });

    it('should throw for invalid integer ranges', () => {
      expect(() => {
        validateCategorizationConfig({ minActionsForGrouping: 0 }, mockLogger);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig(
          { minActionsForGrouping: 101 },
          mockLogger
        );
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig(
          { minNamespacesForGrouping: 21 },
          mockLogger
        );
      }).toThrow(InvalidArgumentError);
    });

    it('should validate namespace order format', () => {
      // Valid namespace
      expect(() => {
        validateCategorizationConfig(
          {
            namespaceOrder: ['core', 'test_ns', 'a'],
          },
          mockLogger
        );
      }).not.toThrow();

      // Invalid namespace format
      expect(() => {
        validateCategorizationConfig({ namespaceOrder: ['Core'] }, mockLogger); // Uppercase
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig(
          { namespaceOrder: ['core-invalid'] },
          mockLogger
        ); // Dash
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig({ namespaceOrder: ['_core'] }, mockLogger); // Leading underscore
      }).toThrow(InvalidArgumentError);

      // Duplicate namespaces
      expect(() => {
        validateCategorizationConfig(
          { namespaceOrder: ['core', 'core'] },
          mockLogger
        );
      }).toThrow(InvalidArgumentError);
    });

    it('should validate performance configuration', () => {
      const config = {
        performance: {
          enableCaching: true,
          cacheMaxSize: 500,
          performanceLogging: false,
          slowOperationThresholdMs: 5,
        },
      };

      const result = validateCategorizationConfig(config, mockLogger);
      expect(result.performance.cacheMaxSize).toBe(500);
    });

    it('should validate error handling configuration', () => {
      const config = {
        errorHandling: {
          logLevel: 'debug',
          fallbackBehavior: 'unknown_namespace',
          maxRetries: 3,
        },
      };

      const result = validateCategorizationConfig(config, mockLogger);
      expect(result.errorHandling.logLevel).toBe('debug');

      // Invalid enum values
      expect(() => {
        validateCategorizationConfig(
          {
            errorHandling: { logLevel: 'invalid' },
          },
          mockLogger
        );
      }).toThrow(InvalidArgumentError);

      expect(() => {
        validateCategorizationConfig(
          {
            errorHandling: { fallbackBehavior: 'invalid' },
          },
          mockLogger
        );
      }).toThrow(InvalidArgumentError);
    });
  });

  describe('validateConfigurationSemantics', () => {
    it('should return warnings for problematic configurations', () => {
      const problematicConfig = {
        minActionsForGrouping: 1,
        minNamespacesForGrouping: 1,
        namespaceOrder: Array.from({ length: 25 }, (_, i) => `ns${i}`),
        performance: {
          cacheMaxSize: 6000,
          slowOperationThresholdMs: 1,
        },
      };

      const warnings = validateConfigurationSemantics(
        problematicConfig,
        mockLogger
      );

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('minActionsForGrouping=1'))).toBe(
        true
      );
      expect(warnings.some((w) => w.includes('Large namespaceOrder'))).toBe(
        true
      );
    });

    it('should return no warnings for good configuration', () => {
      const warnings = validateConfigurationSemantics(
        DEFAULT_CATEGORIZATION_CONFIG,
        mockLogger
      );
      expect(warnings).toHaveLength(0);
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge multiple configurations correctly', () => {
      const config1 = { enabled: false, minActionsForGrouping: 5 };
      const config2 = { minActionsForGrouping: 8, namespaceOrder: ['test'] };
      const config3 = { showCounts: true };

      const result = mergeConfigurations(config1, config2, config3);

      expect(result.enabled).toBe(false); // From config1
      expect(result.minActionsForGrouping).toBe(8); // From config2 (overrides config1)
      expect(result.namespaceOrder).toEqual(['test']); // From config2
      expect(result.showCounts).toBe(true); // From config3
    });

    it('should merge nested configurations', () => {
      const config1 = {
        performance: { enableCaching: false, cacheMaxSize: 100 },
      };
      const config2 = {
        performance: { enableCaching: true, performanceLogging: true },
      };

      const result = mergeConfigurations(config1, config2);

      expect(result.performance.enableCaching).toBe(true); // Overridden
      expect(result.performance.cacheMaxSize).toBe(100); // Preserved
      expect(result.performance.performanceLogging).toBe(true); // Added
    });
  });

  describe('createTestConfig', () => {
    it('should create valid test configuration', () => {
      const testConfig = createTestConfig();

      expect(testConfig.minActionsForGrouping).toBe(3);
      expect(testConfig.performance.enableCaching).toBe(false);
      expect(testConfig.errorHandling.logLevel).toBe('debug');
    });

    it('should apply overrides to test configuration', () => {
      const testConfig = createTestConfig({
        minActionsForGrouping: 5,
        namespaceOrder: ['custom'],
      });

      expect(testConfig.minActionsForGrouping).toBe(5);
      expect(testConfig.namespaceOrder).toEqual(['custom']);
    });
  });

  describe('Configuration Constants', () => {
    it('should have valid default configurations', () => {
      expect(() =>
        validateCategorizationConfig(DEFAULT_CATEGORIZATION_CONFIG, mockLogger)
      ).not.toThrow();
      expect(() =>
        validateCategorizationConfig(UI_CATEGORIZATION_CONFIG, mockLogger)
      ).not.toThrow();
      expect(() =>
        validateCategorizationConfig(LLM_CATEGORIZATION_CONFIG, mockLogger)
      ).not.toThrow();
    });

    it('should have UI and LLM configs differ appropriately', () => {
      expect(UI_CATEGORIZATION_CONFIG.showCounts).toBe(true);
      expect(LLM_CATEGORIZATION_CONFIG.showCounts).toBe(false);
      expect(LLM_CATEGORIZATION_CONFIG.performance.performanceLogging).toBe(
        true
      );
    });
  });
});
