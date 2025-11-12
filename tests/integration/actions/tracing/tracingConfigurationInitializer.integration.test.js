/**
 * @file Integration tests for tracingConfigurationInitializer covering real collaborators
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
import { fileURLToPath } from 'url';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import ActionTraceConfigLoader from '../../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import TracingConfigurationInitializer from '../../../../src/actions/tracing/tracingConfigurationInitializer.js';
import { createTestBed } from '../../../common/testBed.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function loadTraceConfigSchema() {
  const schemaPath = path.resolve(
    __dirname,
    '../../../../data/schemas/trace-config.schema.json'
  );
  const schemaContent = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(schemaContent);
}

function createTraceConfigLoaderStub(initialConfig, { delayMs = 0 } = {}) {
  let currentConfig = initialConfig;
  const loadConfig = jest.fn().mockImplementation(async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return { actionTracing: currentConfig };
  });

  return {
    loadConfig,
    setConfig(newConfig) {
      currentConfig = newConfig;
    },
  };
}

async function createRealConfigLoader({
  traceConfig,
  logger,
  delayMs = 0,
}) {
  const schemaValidator = new AjvSchemaValidator({ logger });
  const schema = await loadTraceConfigSchema();
  await schemaValidator.addSchema(schema, schema.$id);

  const traceConfigLoader = createTraceConfigLoaderStub(traceConfig, { delayMs });

  const configLoader = new ActionTraceConfigLoader({
    traceConfigLoader,
    validator: schemaValidator,
    logger,
  });

  return { configLoader, traceConfigLoader };
}

function createOutputService({ logger, actionTraceFilter }) {
  return new ActionTraceOutputService({
    logger,
    actionTraceFilter,
    testMode: true,
  });
}

describe('TracingConfigurationInitializer - Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('initializes tracing system using real configuration loader and filter', async () => {
    const traceConfig = {
      enabled: true,
      tracedActions: ['core:*', 'movement:go'],
      outputDirectory: './integration-traces',
      verbosity: 'detailed',
      includeComponentData: true,
      includePrerequisites: true,
      includeTargets: false,
      outputFormats: ['json', 'text'],
      textFormatOptions: {
        enableColors: true,
        lineWidth: 100,
        indentSize: 2,
        sectionSeparator: '-',
        includeTimestamps: true,
        performanceSummary: true,
      },
    };

    const { configLoader } = await createRealConfigLoader({
      traceConfig,
      logger: testBed.mockLogger,
    });

    const actionTraceFilter = new ActionTraceFilter({
      enabled: false,
      tracedActions: ['core:none'],
      logger: testBed.mockLogger,
    });

    const outputService = createOutputService({
      logger: testBed.mockLogger,
      actionTraceFilter,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: outputService,
      logger: testBed.mockLogger,
    });

    const result = await initializer.initialize();

    expect(result.success).toBe(true);
    expect(initializer.isInitialized()).toBe(true);
    expect(actionTraceFilter.getConfigurationSummary().enabled).toBe(true);
    expect(actionTraceFilter.shouldTrace('core:attack')).toBe(true);

    const diagnostics = await initializer.validateAndDiagnose();
    expect(diagnostics.configurationValid).toBe(true);
    expect(diagnostics.issues).toHaveLength(0);

    const status = await initializer.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.enabled).toBe(true);
    expect(status.outputDirectory).toBe(traceConfig.outputDirectory);
    expect(status.tracedActions).toContain('core:*');
  });

  it('reuses initialization promise while configuration is loading', async () => {
    const traceConfig = {
      enabled: true,
      tracedActions: ['analytics:*'],
      outputDirectory: './delayed-traces',
      verbosity: 'standard',
    };

    const { configLoader, traceConfigLoader } = await createRealConfigLoader({
      traceConfig,
      logger: testBed.mockLogger,
      delayMs: 25,
    });

    const actionTraceFilter = new ActionTraceFilter({
      enabled: false,
      tracedActions: ['analytics:none'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: createOutputService({
        logger: testBed.mockLogger,
        actionTraceFilter,
      }),
      logger: testBed.mockLogger,
    });

    const promise1 = initializer.initialize();
    const promise2 = initializer.initialize();

    expect(typeof promise2.then).toBe('function');

    const [firstResult, secondResult] = await Promise.all([
      promise1,
      promise2,
    ]);
    expect(firstResult).toBe(secondResult);
    expect(firstResult.success).toBe(true);
    expect(traceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);
  });

  it('returns already initialized message on subsequent calls', async () => {
    const traceConfig = {
      enabled: false,
      tracedActions: ['*'],
      outputDirectory: './initialized-traces',
      verbosity: 'minimal',
    };

    const { configLoader } = await createRealConfigLoader({
      traceConfig,
      logger: testBed.mockLogger,
    });

    const actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:*'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: createOutputService({
        logger: testBed.mockLogger,
        actionTraceFilter,
      }),
      logger: testBed.mockLogger,
    });

    const first = await initializer.initialize();
    expect(first.success).toBe(true);

    const second = await initializer.initialize();
    expect(second.success).toBe(true);
    expect(second.message).toBe('Already initialized');
  });

  it('provides diagnostics when tracing is enabled but misconfigured', async () => {
    const misconfiguredLoader = {
      loadConfig: jest.fn().mockResolvedValue({
        enabled: true,
        tracedActions: [],
        outputDirectory: '',
        verbosity: 'standard',
      }),
      reloadConfig: jest.fn(),
      isEnabled: jest.fn().mockResolvedValue(true),
      getOutputDirectory: jest.fn().mockResolvedValue(''),
    };

    const actionTraceFilter = new ActionTraceFilter({
      enabled: false,
      tracedActions: ['core:*'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader: misconfiguredLoader,
      actionTraceFilter,
      actionTraceOutputService: null,
      logger: testBed.mockLogger,
    });

    const diagnosis = await initializer.validateAndDiagnose();

    expect(misconfiguredLoader.loadConfig).toHaveBeenCalled();
    expect(diagnosis.configurationValid).toBe(false);
    expect(diagnosis.issues).toEqual(
      expect.arrayContaining([
        'Tracing is enabled but no actions configured for tracing',
        'Tracing is enabled but no output directory specified',
        'Filter enabled state does not match configuration',
      ])
    );
    expect(diagnosis.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('resets initialization state after a failure and allows retry', async () => {
    const failingLoader = {
      loadConfig: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          enabled: true,
          tracedActions: ['retry:*'],
          outputDirectory: './retry-traces',
          verbosity: 'standard',
        }),
      reloadConfig: jest.fn(),
      isEnabled: jest.fn(),
      getOutputDirectory: jest.fn(),
    };

    const actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:none'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader: failingLoader,
      actionTraceFilter,
      actionTraceOutputService: createOutputService({
        logger: testBed.mockLogger,
        actionTraceFilter,
      }),
      logger: testBed.mockLogger,
    });

    const failure = await initializer.initialize();
    expect(failure.success).toBe(false);
    expect(failure.message).toContain('Tracing initialization failed');
    expect(initializer.isInitialized()).toBe(false);

    const retry = await initializer.initialize();
    expect(retry.success).toBe(true);
    expect(failingLoader.loadConfig).toHaveBeenCalledTimes(3);
  });

  it('reloads configuration and updates collaborators', async () => {
    const traceConfigLoader = createTraceConfigLoaderStub({
      enabled: false,
      tracedActions: ['initial:*'],
      outputDirectory: './initial-traces',
      verbosity: 'standard',
    });

    const schemaValidator = new AjvSchemaValidator({ logger: testBed.mockLogger });
    const schema = await loadTraceConfigSchema();
    await schemaValidator.addSchema(schema, schema.$id);

    const configLoader = new ActionTraceConfigLoader({
      traceConfigLoader,
      validator: schemaValidator,
      logger: testBed.mockLogger,
    });

    const actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:none'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: createOutputService({
        logger: testBed.mockLogger,
        actionTraceFilter,
      }),
      logger: testBed.mockLogger,
    });

    await initializer.initialize();

    traceConfigLoader.setConfig({
      enabled: true,
      tracedActions: ['reloaded:*'],
      outputDirectory: './reloaded-traces',
      verbosity: 'verbose',
    });

    const reloadResult = await initializer.reloadConfiguration();
    expect(reloadResult.success).toBe(true);
    expect(reloadResult.config.enabled).toBe(true);
    expect(reloadResult.config.tracedActions).toContain('reloaded:*');

    const summary = actionTraceFilter.getConfigurationSummary();
    expect(summary.enabled).toBe(true);
    expect(summary.tracedActions).toContain('reloaded:*');
  });

  it('handles reload configuration failures gracefully', async () => {
    const configLoader = {
      loadConfig: jest.fn().mockResolvedValue({
        enabled: false,
        tracedActions: ['*'],
        outputDirectory: './noop',
        verbosity: 'standard',
      }),
      reloadConfig: jest.fn().mockRejectedValue(new Error('reload failed')),
      isEnabled: jest.fn(),
      getOutputDirectory: jest.fn(),
    };

    const actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:none'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: null,
      logger: testBed.mockLogger,
    });

    const result = await initializer.reloadConfiguration();
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to reload configuration');
  });

  it('returns status with error details when configuration lookup fails', async () => {
    const configLoader = {
      loadConfig: jest.fn().mockRejectedValue(new Error('status failure')),
      reloadConfig: jest.fn(),
      isEnabled: jest.fn(),
      getOutputDirectory: jest.fn(),
    };

    const actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['core:none'],
      logger: testBed.mockLogger,
    });

    const initializer = new TracingConfigurationInitializer({
      configLoader,
      actionTraceFilter,
      actionTraceOutputService: null,
      logger: testBed.mockLogger,
    });

    const status = await initializer.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.configLoaded).toBe(false);
    expect(status.error).toBe('status failure');
  });
});
