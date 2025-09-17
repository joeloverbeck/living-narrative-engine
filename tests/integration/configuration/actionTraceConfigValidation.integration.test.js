/**
 * @file Integration tests for action tracing configuration validation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Action Trace Configuration Validation Integration', () => {
  let configLoader;
  let mockTraceConfigLoader;
  let mockLogger;
  let schemaValidator;

  beforeEach(async () => {
    // Create mock trace config loader
    mockTraceConfigLoader = {
      loadConfig: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create a real schema validator for integration testing
    schemaValidator = new AjvSchemaValidator({
      logger: mockLogger,
    });

    // Register the action trace config schema with the correct ID
    await schemaValidator.addSchema(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {
          actionTracing: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              tracedActions: { type: 'array', items: { type: 'string' } },
              outputDirectory: { type: 'string' },
              verbosity: {
                type: 'string',
                enum: ['minimal', 'standard', 'detailed', 'verbose'],
              },
              includeComponentData: { type: 'boolean' },
              includePrerequisites: { type: 'boolean' },
              includeTargets: { type: 'boolean' },
              maxTraceFiles: { type: 'integer', minimum: 1, maximum: 1000 },
              rotationPolicy: { type: 'string', enum: ['age', 'count'] },
              maxFileAge: { type: 'integer', minimum: 3600 },
            },
            required: ['enabled', 'tracedActions', 'outputDirectory'],
          },
        },
        required: ['actionTracing'],
      },
      'schema://living-narrative-engine/trace-config.schema.json'
    );

    // Create the config loader with dependencies
    configLoader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      validator: schemaValidator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should validate configuration through the full pipeline', async () => {
    // Mock valid configuration file
    const mockConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go', 'core:look'],
        outputDirectory: './traces/actions',
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 100,
        rotationPolicy: 'age',
        maxFileAge: 86400,
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

    const config = await configLoader.loadConfig();

    expect(config.enabled).toBe(true);
    expect(config.tracedActions).toEqual(['movement:go', 'core:look']);
    expect(config.outputDirectory).toBe('./traces/actions');
    expect(config.verbosity).toBe('standard');
  });

  it('should handle validation failures gracefully', async () => {
    // Mock invalid configuration
    const invalidConfig = {
      actionTracing: {
        enabled: 'not-a-boolean', // Invalid type
        tracedActions: 'not-an-array', // Invalid type
        verbosity: 'invalid-level', // Invalid enum value
        // Missing required outputDirectory
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(invalidConfig);

    const config = await configLoader.loadConfig();

    // Should fall back to safe defaults
    expect(config.enabled).toBe(false);
    expect(Array.isArray(config.tracedActions)).toBe(true);
    expect(config.tracedActions).toEqual([]);
    expect(config.outputDirectory).toBe('./traces/actions');
    expect(config.verbosity).toBe('standard');
  });

  it('should handle missing configuration section', async () => {
    // Mock config without actionTracing section
    const configWithoutSection = {
      otherConfig: {
        someValue: 'test',
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(configWithoutSection);

    const config = await configLoader.loadConfig();

    // Should use defaults when section is missing
    expect(config.enabled).toBe(false);
    expect(config.tracedActions).toEqual([]);
    expect(config.outputDirectory).toBe('./traces/actions');
  });

  it('should handle configuration loading errors', async () => {
    // Mock error result from TraceConfigLoader
    mockTraceConfigLoader.loadConfig.mockResolvedValue({
      error: 'Failed to read configuration file',
      message: 'File not found',
    });

    const config = await configLoader.loadConfig();

    // Should use defaults on error
    expect(config.enabled).toBe(false);
    expect(config.tracedActions).toEqual([]);
    expect(config.outputDirectory).toBe('./traces/actions');
  });

  it('should normalize configuration with warnings', async () => {
    // Mock configuration with issues that produce warnings
    const configWithWarnings = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go', 'movement:go', 'core:look'], // Duplicate
        outputDirectory: '/absolute/path/to/traces', // Absolute path warning
        verbosity: 'verbose',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true, // High performance impact
        rotationPolicy: 'count',
        // Missing maxTraceFiles for count policy
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(configWithWarnings);

    const config = await configLoader.loadConfig();

    // Configuration should be valid but normalized
    expect(config.enabled).toBe(true);
    // Duplicates should be removed
    expect(config.tracedActions).toEqual(['movement:go', 'core:look']);
    // Default maxTraceFiles should be set
    expect(config.maxTraceFiles).toBe(100);
  });

  it('should validate action ID patterns', async () => {
    const configWithPatterns = {
      actionTracing: {
        enabled: true,
        tracedActions: [
          'movement:go',
          'mod:*',
          '*',
          'invalid-pattern', // Should be rejected
        ],
        outputDirectory: './traces',
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(configWithPatterns);

    const config = await configLoader.loadConfig();

    // Invalid patterns should cause fallback to defaults
    expect(config.enabled).toBe(false);
    expect(config.tracedActions).toEqual([]);
  });

  it('should accept any output directory in browser environment', async () => {
    // In browser environment, path traversal is not a security concern
    // The validator has been updated to skip path validation
    const configWithUnusualPath = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: '../../../etc/passwd',
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(configWithUnusualPath);

    const config = await configLoader.loadConfig();

    // In browser environment, path validation is skipped
    // The configuration should be accepted as-is
    expect(config.enabled).toBe(true);
    expect(config.outputDirectory).toBe('../../../etc/passwd');
  });

  it('should handle exception during loading', async () => {
    // Mock exception from trace config loader
    mockTraceConfigLoader.loadConfig.mockRejectedValue(
      new Error('Unexpected error')
    );

    const config = await configLoader.loadConfig();

    // Should use defaults on exception
    expect(config.enabled).toBe(false);
    expect(config.tracedActions).toEqual([]);
    expect(config.outputDirectory).toBe('./traces/actions');
  });

  it('should cache validated configuration', async () => {
    const mockConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: './traces',
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

    // First load
    const config1 = await configLoader.loadConfig();
    expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

    // Second load should use cache
    const config2 = await configLoader.loadConfig();
    expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

    // Configs should be the same
    expect(config1).toEqual(config2);
  });

  it('should reload configuration when requested', async () => {
    const mockConfig1 = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: './traces',
      },
    };

    const mockConfig2 = {
      actionTracing: {
        enabled: false,
        tracedActions: ['core:look'],
        outputDirectory: './new-traces',
      },
    };

    mockTraceConfigLoader.loadConfig
      .mockResolvedValueOnce(mockConfig1)
      .mockResolvedValueOnce(mockConfig2);

    // First load
    const config1 = await configLoader.loadConfig();
    expect(config1.enabled).toBe(true);

    // Reload configuration
    const config2 = await configLoader.reloadConfig();
    expect(config2.enabled).toBe(false);
    expect(config2.outputDirectory).toBe('./new-traces');
  });

  it('should check if specific action should be traced', async () => {
    const mockConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go', 'core:look', 'mod:*'],
        outputDirectory: './traces',
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

    // Test exact matches
    expect(await configLoader.shouldTraceAction('movement:go')).toBe(true);
    expect(await configLoader.shouldTraceAction('core:look')).toBe(true);

    // Test wildcard matches
    expect(await configLoader.shouldTraceAction('mod:action')).toBe(true);
    expect(await configLoader.shouldTraceAction('mod:another')).toBe(true);

    // Test non-matches
    expect(await configLoader.shouldTraceAction('other:action')).toBe(false);
    expect(await configLoader.shouldTraceAction('core:examine')).toBe(false);
  });

  it('should filter data by verbosity level', async () => {
    const mockConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: './traces',
        verbosity: 'minimal',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
      },
    };

    mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

    const testData = {
      timestamp: Date.now(),
      actionId: 'movement:go',
      result: 'success',
      executionTime: 100,
      componentData: { test: 'data' },
      prerequisites: ['prereq1'],
      targets: ['target1'],
      debugInfo: 'debug',
    };

    const filtered = await configLoader.filterDataByVerbosity(testData);

    // Minimal verbosity should only include basic info
    expect(filtered.timestamp).toBeDefined();
    expect(filtered.actionId).toBeDefined();
    expect(filtered.result).toBeDefined();
    expect(filtered.executionTime).toBeUndefined(); // Not included in minimal
    expect(filtered.componentData).toBeUndefined(); // Not included in minimal
  });
});
