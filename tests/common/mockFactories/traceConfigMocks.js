/**
 * @file Mock factories for trace configuration testing
 */

import { jest } from '@jest/globals';

/**
 * Create a mock trace config loader
 *
 * @returns {object} Mock trace config loader
 */
export function createMockTraceConfigLoader() {
  return {
    loadConfig: jest.fn().mockResolvedValue({
      actionTracing: {
        enabled: false,
        tracedActions: [],
        outputDirectory: './traces/actions',
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 100,
        rotationPolicy: 'age',
        maxFileAge: 86400,
        outputFormats: ['json'],
        textFormatOptions: {
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
          sectionSeparator: '=',
          includeTimestamps: true,
          performanceSummary: true,
        },
      },
    }),
    reloadConfig: jest.fn(),
  };
}

/**
 * Create a mock schema validator
 *
 * @returns {object} Mock schema validator
 */
export function createMockSchemaValidator() {
  return {
    validate: jest.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
    addSchema: jest.fn(),
    removeSchema: jest.fn(),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    loadSchema: jest.fn().mockResolvedValue(true),
    getSchema: jest.fn(),
  };
}

/**
 * Create sample valid configuration
 *
 * @param {object} overrides - Configuration overrides
 * @returns {object} Sample configuration
 */
export function createSampleConfig(overrides = {}) {
  const defaultConfig = {
    actionTracing: {
      enabled: true,
      tracedActions: ['core:move', 'core:attack'],
      outputDirectory: './traces/actions',
      verbosity: 'standard',
      includeComponentData: true,
      includePrerequisites: true,
      includeTargets: true,
      maxTraceFiles: 100,
      rotationPolicy: 'age',
      maxFileAge: 86400,
      outputFormats: ['json'],
      textFormatOptions: {
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      },
    },
  };

  return {
    ...defaultConfig,
    actionTracing: {
      ...defaultConfig.actionTracing,
      ...overrides,
    },
  };
}

/**
 * Create sample invalid configuration
 *
 * @param {string} errorType - Type of error to simulate
 * @returns {object} Invalid configuration
 */
export function createInvalidConfig(errorType = 'missing-required') {
  const configs = {
    'missing-required': {
      actionTracing: {
        // Missing required 'enabled' field
        tracedActions: ['core:move'],
      },
    },
    'invalid-type': {
      actionTracing: {
        enabled: 'yes', // Should be boolean
        tracedActions: ['core:move'],
      },
    },
    'invalid-pattern': {
      actionTracing: {
        enabled: true,
        tracedActions: ['invalid pattern with spaces'],
      },
    },
    'out-of-range': {
      actionTracing: {
        enabled: true,
        tracedActions: [],
        textFormatOptions: {
          lineWidth: 500, // Out of range (40-300)
          indentSize: 10, // Out of range (0-8)
        },
      },
    },
  };

  return configs[errorType] || configs['missing-required'];
}