/**
 * @file Integration tests for action trace configuration
 * @see src/configuration/actionTraceConfigLoader.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import { TraceConfigLoader } from '../../../src/configuration/traceConfigLoader.js';
import ActionTracingConfigMigration from '../../../src/configuration/actionTracingMigration.js';
import { fetchWithRetry } from '../../../src/utils';

// Mock fetchWithRetry to read from actual filesystem during tests
jest.mock('../../../src/utils', () => ({
  fetchWithRetry: jest.fn(),
}));

describe('Action Trace Config Integration', () => {
  const testConfigPath = path.join(
    process.cwd(),
    'config',
    'trace-config.test.json'
  );
  let originalConfig;
  let validator;

  beforeEach(async () => {
    // Backup original config
    const configPath = path.join(process.cwd(), 'config', 'trace-config.json');
    try {
      originalConfig = await fs.readFile(configPath, 'utf-8');
    } catch {
      // Config might not exist in test environment
      originalConfig = null;
    }

    // Create a simple mock validator for integration tests
    validator = {
      validate: jest.fn().mockResolvedValue({ isValid: true }),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
    };

    // Set up fetchWithRetry mock to read from filesystem
    fetchWithRetry.mockImplementation(async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Simulate HTTP 404 for missing files
        const httpError = new Error(`failed to fetch ${filePath}`);
        httpError.status = 404;
        throw httpError;
      }
    });
  });

  afterEach(async () => {
    // Clear mocks
    jest.clearAllMocks();

    // Clean up test config if it exists
    try {
      await fs.unlink(testConfigPath);
    } catch {
      // File might not exist
    }

    // Restore original config if it existed
    if (originalConfig) {
      const configPath = path.join(
        process.cwd(),
        'config',
        'trace-config.json'
      );
      await fs.writeFile(configPath, originalConfig);
    }
  });

  describe('Configuration Loading', () => {
    it('should load configuration from actual file system', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack'],
          outputDirectory: './test-traces',
          verbosity: 'detailed',
          includeComponentData: true,
          includePrerequisites: false,
          includeTargets: true,
          maxTraceFiles: 50,
          rotationPolicy: 'count',
          maxFileAge: 7200,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      // Update loader to use test config
      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      expect(config.enabled).toBe(true);
      expect(config.tracedActions).toContain('core:go');
      expect(config.tracedActions).toContain('core:attack');
      expect(config.verbosity).toBe('detailed');
      expect(config.includePrerequisites).toBe(false);
      expect(config.maxTraceFiles).toBe(50);
    });

    it('should load configuration with new dual-format fields', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack'],
          outputDirectory: './test-traces',
          verbosity: 'detailed',
          includeComponentData: true,
          includePrerequisites: false,
          includeTargets: true,
          maxTraceFiles: 50,
          rotationPolicy: 'count',
          maxFileAge: 7200,
          outputFormats: ['json', 'text', 'html'],
          textFormatOptions: {
            enableColors: true,
            lineWidth: 100,
            indentSize: 4,
            sectionSeparator: '-',
            includeTimestamps: false,
            performanceSummary: true,
          },
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      // Test new fields are loaded correctly
      expect(config.outputFormats).toEqual(['json', 'text', 'html']);
      expect(config.textFormatOptions).toEqual({
        enableColors: true,
        lineWidth: 100,
        indentSize: 4,
        sectionSeparator: '-',
        includeTimestamps: false,
        performanceSummary: true,
      });

      // Test getter methods for new fields
      const outputFormats = await testLoader.getOutputFormats();
      expect(outputFormats).toEqual(['json', 'text', 'html']);

      const textOptions = await testLoader.getTextFormatOptions();
      expect(textOptions.enableColors).toBe(true);
      expect(textOptions.lineWidth).toBe(100);
      expect(textOptions.indentSize).toBe(4);
      expect(textOptions.sectionSeparator).toBe('-');
      expect(textOptions.includeTimestamps).toBe(false);
      expect(textOptions.performanceSummary).toBe(true);
    });

    it('should use default values for missing dual-format fields', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './test-traces',
          verbosity: 'standard',
          // Missing outputFormats and textFormatOptions - should use defaults
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      // Should use default values
      const outputFormats = await testLoader.getOutputFormats();
      expect(outputFormats).toEqual(['json']);

      const textOptions = await testLoader.getTextFormatOptions();
      expect(textOptions).toEqual({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
    });

    it('should handle missing configuration file gracefully', async () => {
      // Use a non-existent config path
      const missingConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: './non-existent-config.json',
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: missingConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      // Should return defaults
      expect(config.enabled).toBe(false);
      expect(config.tracedActions).toEqual([]);
      expect(config.outputDirectory).toBe('./traces/actions');
    });
  });

  describe('Configuration Migration', () => {
    it('should migrate configuration without action tracing', () => {
      const oldConfig = {
        traceAnalysisEnabled: true,
        performanceMonitoring: {
          enabled: true,
        },
      };

      const migratedConfig =
        ActionTracingConfigMigration.migrateConfig(oldConfig);

      expect(migratedConfig.traceAnalysisEnabled).toBe(true);
      expect(migratedConfig.performanceMonitoring.enabled).toBe(true);
      expect(migratedConfig.actionTracing).toBeDefined();
      expect(migratedConfig.actionTracing.enabled).toBe(false);
      expect(migratedConfig.actionTracing.tracedActions).toEqual([]);
    });

    it('should not modify configuration that already has action tracing', () => {
      const existingConfig = {
        traceAnalysisEnabled: true,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*'],
          outputDirectory: './custom-traces',
        },
      };

      const migratedConfig =
        ActionTracingConfigMigration.migrateConfig(existingConfig);

      expect(migratedConfig).toBe(existingConfig); // Same reference
    });

    it('should validate migrated configuration', () => {
      const validConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
          rotationPolicy: 'age',
        },
      };

      expect(ActionTracingConfigMigration.isValidMigration(validConfig)).toBe(
        true
      );

      const invalidConfig = {
        actionTracing: {
          enabled: 'not-a-boolean',
          tracedActions: 'not-an-array',
          outputDirectory: './traces',
        },
      };

      expect(ActionTracingConfigMigration.isValidMigration(invalidConfig)).toBe(
        false
      );
    });

    it('should merge user config with defaults', () => {
      const userConfig = {
        enabled: true,
        tracedActions: ['core:go'],
        verbosity: 'verbose',
      };

      const merged = ActionTracingConfigMigration.mergeWithDefaults(userConfig);

      expect(merged.enabled).toBe(true);
      expect(merged.tracedActions).toEqual(['core:go']);
      expect(merged.verbosity).toBe('verbose');
      // Defaults should be filled in
      expect(merged.outputDirectory).toBe('./traces/actions');
      expect(merged.includeComponentData).toBe(true);
      expect(merged.maxTraceFiles).toBe(100);
      expect(merged.rotationPolicy).toBe('age');
    });

    it('should merge user config with defaults including new dual-format fields', () => {
      const userConfig = {
        enabled: true,
        tracedActions: ['core:go'],
        verbosity: 'verbose',
        outputFormats: ['text', 'html'],
        textFormatOptions: {
          enableColors: true,
          lineWidth: 90,
        },
      };

      const merged = ActionTracingConfigMigration.mergeWithDefaults(userConfig);

      expect(merged.enabled).toBe(true);
      expect(merged.tracedActions).toEqual(['core:go']);
      expect(merged.verbosity).toBe('verbose');

      // New fields should be merged correctly
      expect(merged.outputFormats).toEqual(['text', 'html']);
      expect(merged.textFormatOptions.enableColors).toBe(true);
      expect(merged.textFormatOptions.lineWidth).toBe(90);

      // Missing textFormatOptions should be filled with defaults
      expect(merged.textFormatOptions.indentSize).toBe(2); // Default value
      expect(merged.textFormatOptions.sectionSeparator).toBe('='); // Default value
      expect(merged.textFormatOptions.includeTimestamps).toBe(true); // Default value
      expect(merged.textFormatOptions.performanceSummary).toBe(true); // Default value

      // Original defaults should still be present
      expect(merged.outputDirectory).toBe('./traces/actions');
      expect(merged.includeComponentData).toBe(true);
      expect(merged.maxTraceFiles).toBe(100);
      expect(merged.rotationPolicy).toBe('age');
    });
  });

  describe('TraceConfigLoader Integration', () => {
    it('should check if any tracing is enabled', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        performanceMonitoring: { enabled: false },
        visualization: { enabled: false },
        analysis: { enabled: false },
        actionTracing: {
          enabled: true,
          tracedActions: [],
          outputDirectory: './traces',
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const anyEnabled = await testTraceConfigLoader.isAnyTracingEnabled();
      expect(anyEnabled).toBe(true);

      // Test with all disabled
      testConfig.actionTracing.enabled = false;
      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader2 = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const noneEnabled = await testTraceConfigLoader2.isAnyTracingEnabled();
      expect(noneEnabled).toBe(false);
    });

    it('should get action tracing config from TraceConfigLoader', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*'],
          outputDirectory: './action-traces',
          verbosity: 'minimal',
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const actionConfig = await testTraceConfigLoader.getActionTracingConfig();

      expect(actionConfig).toBeDefined();
      expect(actionConfig.enabled).toBe(true);
      expect(actionConfig.tracedActions).toEqual(['core:*']);
      expect(actionConfig.outputDirectory).toBe('./action-traces');
      expect(actionConfig.verbosity).toBe('minimal');
    });
  });

  describe('Hot Reload', () => {
    it('should support configuration hot reload', async () => {
      const config1 = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: false,
          tracedActions: [],
          outputDirectory: './traces1',
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(config1, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      let config = await testLoader.loadConfig();
      expect(config.outputDirectory).toBe('./traces1');

      // Update config file
      const config2 = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*'],
          outputDirectory: './traces2',
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(config2, null, 2));

      // Reload configuration
      config = await testLoader.reloadConfig();
      expect(config.outputDirectory).toBe('./traces2');
      expect(config.enabled).toBe(true);
      expect(config.tracedActions).toEqual(['core:*']);
    });
  });

  describe('Enhanced Wildcard Pattern Integration', () => {
    it('should work with real config files containing complex patterns', async () => {
      const complexConfig = {
        enabled: true,
        tracedActions: [
          'core:*',
          'debug_*',
          '*_test',
          'combat:attack*',
          '*:move_*',
        ],
        outputDirectory: './test-traces',
        verbosity: 'detailed',
        includeComponentData: true,
      };

      const fullConfig = {
        traceAnalysisEnabled: false,
        actionTracing: complexConfig,
      };

      await fs.writeFile(testConfigPath, JSON.stringify(fullConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      expect(await testLoader.shouldTraceAction('core:anything')).toBe(true);
      expect(await testLoader.shouldTraceAction('debug_info')).toBe(true);
      expect(await testLoader.shouldTraceAction('custom:action_test')).toBe(
        true
      );
      expect(await testLoader.shouldTraceAction('combat:attack_sword')).toBe(
        true
      );
      expect(await testLoader.shouldTraceAction('player:move_north')).toBe(
        true
      );
      expect(await testLoader.shouldTraceAction('other:unrelated')).toBe(false);
    });

    it('should handle mixed pattern types in real configuration', async () => {
      const mixedConfig = {
        enabled: true,
        tracedActions: [
          'core:go', // Exact match
          'debug:*', // Mod wildcard
          '*', // Universal wildcard
          'action_*', // Prefix pattern
          '*_test', // Suffix pattern
          'mod:*_debug', // Complex pattern
        ],
        outputDirectory: './test-traces',
        verbosity: 'standard',
      };

      const fullConfig = {
        traceAnalysisEnabled: false,
        actionTracing: mixedConfig,
      };

      await fs.writeFile(testConfigPath, JSON.stringify(fullConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      // Test exact match
      expect(await testLoader.shouldTraceAction('core:go')).toBe(true);

      // Test mod wildcard
      expect(await testLoader.shouldTraceAction('debug:something')).toBe(true);

      // Test universal wildcard (should match everything)
      expect(await testLoader.shouldTraceAction('random:action')).toBe(true);

      // Test prefix pattern
      expect(await testLoader.shouldTraceAction('action_start')).toBe(true);

      // Test suffix pattern
      expect(await testLoader.shouldTraceAction('integration_test')).toBe(true);

      // Test complex pattern
      expect(await testLoader.shouldTraceAction('mod:function_debug')).toBe(
        true
      );
    });

    it('should validate and warn about invalid patterns in real config', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      const invalidConfig = {
        enabled: true,
        tracedActions: [
          'core:valid', // Valid
          'InvalidMod:action', // Invalid mod name
          'core:**redundant', // Redundant asterisks
          '', // Empty pattern
          'valid:*', // Valid
        ],
        outputDirectory: './test-traces',
        verbosity: 'standard',
      };

      const fullConfig = {
        traceAnalysisEnabled: false,
        actionTracing: invalidConfig,
      };

      await fs.writeFile(testConfigPath, JSON.stringify(fullConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: mockLogger,
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: mockLogger,
        validator,
      });

      await testLoader.loadConfig();

      // Should warn about invalid patterns
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid pattern')
      );

      // Valid patterns should still work
      expect(await testLoader.shouldTraceAction('core:valid')).toBe(true);
      expect(await testLoader.shouldTraceAction('valid:something')).toBe(true);
    });
  });

  describe('TTL Integration Behavior', () => {
    it('should reload from file system after cache expires', async () => {
      // Create initial configuration
      const initialConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './test-traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      await fs.writeFile(
        testConfigPath,
        JSON.stringify(initialConfig, null, 2)
      );

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
        cacheTtl: 100, // 100ms for testing
      });

      // Load initial config
      const config1 = await testLoader.loadConfig();
      expect(config1.enabled).toBe(true);
      expect(config1.tracedActions).toContain('core:go');

      // Modify the configuration file on disk
      const modifiedConfig = {
        ...initialConfig,
        actionTracing: {
          ...initialConfig.actionTracing,
          enabled: false,
          tracedActions: ['core:attack'],
        },
      };
      await fs.writeFile(
        testConfigPath,
        JSON.stringify(modifiedConfig, null, 2)
      );

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Load config again - should reflect file changes
      const config2 = await testLoader.loadConfig();
      expect(config2.enabled).toBe(false);
      expect(config2.tracedActions).toContain('core:attack');
      expect(config2.tracedActions).not.toContain('core:go');
    });

    it('should use cache when TTL has not expired with file system operations', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './test-traces',
          verbosity: 'detailed',
          includeComponentData: false,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 50,
          rotationPolicy: 'count',
          maxFileAge: 7200,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      // Spy on the fetchWithRetry to track calls
      fetchWithRetry.mockClear();
      fetchWithRetry.mockImplementation(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch {
          const httpError = new Error(`failed to fetch ${filePath}`);
          httpError.status = 404;
          throw httpError;
        }
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
        cacheTtl: 5000, // 5 seconds - long enough for test
      });

      // First load - should read from file
      const config1 = await testLoader.loadConfig();
      expect(config1.enabled).toBe(true);
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);

      // Modify file on disk but cache shouldn't reload yet
      const modifiedConfig = {
        ...testConfig,
        actionTracing: {
          ...testConfig.actionTracing,
          enabled: false,
        },
      };
      await fs.writeFile(
        testConfigPath,
        JSON.stringify(modifiedConfig, null, 2)
      );

      // Second load - should use cache, not read from modified file
      const config2 = await testLoader.loadConfig();
      expect(config2.enabled).toBe(true); // Still original value from cache
      expect(fetchWithRetry).toHaveBeenCalledTimes(1); // No additional file read
    });

    it('should handle file system errors during TTL reload gracefully', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
          outputDirectory: './test-traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: mockLogger,
        validator,
        cacheTtl: 50, // 50ms for quick expiration
      });

      // Load initial config
      const config1 = await testLoader.loadConfig();
      expect(config1.enabled).toBe(true);

      // Delete the config file to simulate an error
      await fs.unlink(testConfigPath);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Try to reload - should handle error gracefully and return defaults
      const config2 = await testLoader.loadConfig();
      expect(config2.enabled).toBe(false); // Default value
      expect(config2.tracedActions).toEqual([]); // Default value
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load trace configuration'),
        expect.anything()
      );
    });

    it('should maintain performance with TTL in real file operations', async () => {
      const testConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 100 },
            (_, i) => `mod${i}:action${i}`
          ),
          outputDirectory: './test-traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
        cacheTtl: 30000, // 30 seconds - long enough for performance test
      });

      // Load config once to populate cache
      await testLoader.loadConfig();

      // Perform many cache hit operations and measure performance
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await testLoader.loadConfig();
        await testLoader.shouldTraceAction(`mod${i % 100}:action${i % 100}`);
      }

      const duration = performance.now() - start;
      const avgTimePerOperation = duration / iterations;

      // Performance should still be excellent with TTL
      expect(avgTimePerOperation).toBeLessThan(1); // <1ms per operation including action tracing
    });
  });

  describe('Dual-Format Configuration Validation', () => {
    it('should load and validate complete dual-format configuration', async () => {
      // Create realistic dual-format configuration
      const dualFormatConfig = {
        traceAnalysisEnabled: false,
        actionTracing: {
          enabled: true,
          tracedActions: ['intimacy:fondle_ass', 'core:move'],
          outputDirectory: './traces/integration',
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
          outputFormats: ['json', 'text'],
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

      await fs.writeFile(
        testConfigPath,
        JSON.stringify(dualFormatConfig, null, 2)
      );

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      expect(config.outputFormats).toEqual(['json', 'text']);
      expect(config.textFormatOptions).toEqual(
        expect.objectContaining({
          enableColors: false,
          lineWidth: 120,
          indentSize: 2,
        })
      );
    });

    it('should handle malformed dual-format configuration gracefully', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };

      const malformedConfig = {
        actionTracing: {
          enabled: true,
          outputFormats: ['json', 'invalid_format', 'text', 'unsupported'],
          textFormatOptions: {
            lineWidth: 500, // Invalid - too large
            indentSize: -1, // Invalid - negative
            sectionSeparator: 'too-long-separator', // Invalid - too long
            enableColors: 'not-boolean', // Invalid type
          },
        },
      };

      await fs.writeFile(
        testConfigPath,
        JSON.stringify(malformedConfig, null, 2)
      );

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: mockLogger,
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: mockLogger,
        validator,
      });

      // Should handle malformed config by falling back to defaults
      const config = await testLoader.loadConfig();

      // Should fallback to safe defaults
      expect(config.outputFormats).toEqual(['json']); // Default fallback
      expect(config.textFormatOptions.lineWidth).toBe(120); // Default value
      expect(config.textFormatOptions.indentSize).toBe(2); // Default value
      expect(config.textFormatOptions.sectionSeparator).toBe('='); // Default value
      expect(config.textFormatOptions.enableColors).toBe(false); // Default value
    });

    it('should normalize partial dual-format configuration with defaults', async () => {
      const partialConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:test'],
          outputFormats: ['text'],
          // Missing textFormatOptions - should get defaults
        },
      };

      await fs.writeFile(
        testConfigPath,
        JSON.stringify(partialConfig, null, 2)
      );

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      expect(config.outputFormats).toEqual(['text']);
      expect(config.textFormatOptions).toEqual({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
    });

    it('should validate text format options boundaries', async () => {
      const boundaryConfig = {
        actionTracing: {
          enabled: true,
          outputFormats: ['json', 'text'],
          textFormatOptions: {
            lineWidth: 80, // Minimum valid
            indentSize: 1, // Minimum valid
            sectionSeparator: '~', // Single char valid
          },
        },
      };

      await fs.writeFile(
        testConfigPath,
        JSON.stringify(boundaryConfig, null, 2)
      );

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      expect(config.textFormatOptions.lineWidth).toBe(80);
      expect(config.textFormatOptions.indentSize).toBe(1);
      expect(config.textFormatOptions.sectionSeparator).toBe('~');
    });

    it('should support configuration evolution with version handling', async () => {
      // Test config that might come from an older version
      const legacyConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['legacy:action'],
          outputDirectory: './old-traces',
          // No outputFormats or textFormatOptions (pre dual-format)
        },
      };

      await fs.writeFile(testConfigPath, JSON.stringify(legacyConfig, null, 2));

      const testTraceConfigLoader = new TraceConfigLoader({
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        safeEventDispatcher: { dispatch: jest.fn() },
        configPath: testConfigPath,
      });

      const testLoader = new ActionTraceConfigLoader({
        traceConfigLoader: testTraceConfigLoader,
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
        validator,
      });

      const config = await testLoader.loadConfig();

      // Should maintain backward compatibility
      expect(config.enabled).toBe(true);
      expect(config.tracedActions).toEqual(['legacy:action']);
      expect(config.outputDirectory).toBe('./old-traces');

      // Should provide sensible defaults for new fields
      expect(config.outputFormats).toEqual(['json']); // Default to JSON-only
      expect(config.textFormatOptions).toEqual({
        enableColors: false,
        lineWidth: 120,
        indentSize: 2,
        sectionSeparator: '=',
        includeTimestamps: true,
        performanceSummary: true,
      });
    });
  });
});
