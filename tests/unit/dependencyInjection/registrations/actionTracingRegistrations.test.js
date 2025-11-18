import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { actionTracingTokens } from '../../../../src/dependencyInjection/tokens/actionTracingTokens.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';

const createConstructorMock = (name) =>
  jest.fn().mockImplementation((dependencies) => ({
    __mockName: name,
    dependencies,
  }));

const mockActionTraceConfigValidator = createConstructorMock(
  'ActionTraceConfigValidator'
);
const mockActionTraceConfigLoader = createConstructorMock(
  'ActionTraceConfigLoader'
);
const mockTraceDirectoryManager = createConstructorMock(
  'TraceDirectoryManager'
);
const mockActionTraceFilter = createConstructorMock('ActionTraceFilter');
const mockActionAwareStructuredTrace = createConstructorMock(
  'ActionAwareStructuredTrace'
);
const mockActionTraceOutputService = createConstructorMock(
  'ActionTraceOutputService'
);
const mockJsonTraceFormatter = createConstructorMock('JsonTraceFormatter');
const mockHumanReadableFormatter = createConstructorMock(
  'HumanReadableFormatter'
);
const mockIndexedDBStorageAdapter = createConstructorMock(
  'IndexedDBStorageAdapter'
);
const mockEventDispatchTracer = createConstructorMock('EventDispatchTracer');
const mockErrorMetricsService = createConstructorMock('ErrorMetricsService');
const mockRetryManager = createConstructorMock('RetryManager');
const mockRecoveryManager = createConstructorMock('RecoveryManager');
const mockTraceErrorHandler = createConstructorMock('TraceErrorHandler');
const mockTracingConfigurationInitializer = createConstructorMock(
  'TracingConfigurationInitializer'
);

const mockNamingStrategy = { TIMESTAMP_FIRST: 'timestamp-first' };
const mockTimestampFormat = { COMPACT: 'compact' };

jest.mock(
  '../../../../src/configuration/actionTraceConfigValidator.js',
  () => ({
    __esModule: true,
    default: mockActionTraceConfigValidator,
  })
);
jest.mock(
  '../../../../src/configuration/actionTraceConfigLoader.js',
  () => ({
    __esModule: true,
    default: mockActionTraceConfigLoader,
  })
);
jest.mock(
  '../../../../src/actions/tracing/traceDirectoryManager.js',
  () => ({
    __esModule: true,
    default: mockTraceDirectoryManager,
  })
);
jest.mock(
  '../../../../src/actions/tracing/actionTraceFilter.js',
  () => ({
    __esModule: true,
    default: mockActionTraceFilter,
  })
);
jest.mock(
  '../../../../src/actions/tracing/actionAwareStructuredTrace.js',
  () => ({
    __esModule: true,
    default: mockActionAwareStructuredTrace,
  })
);
jest.mock(
  '../../../../src/actions/tracing/actionTraceOutputService.js',
  () => ({
    __esModule: true,
    ActionTraceOutputService: mockActionTraceOutputService,
    NamingStrategy: mockNamingStrategy,
    TimestampFormat: mockTimestampFormat,
  })
);
jest.mock(
  '../../../../src/actions/tracing/jsonTraceFormatter.js',
  () => ({
    __esModule: true,
    JsonTraceFormatter: mockJsonTraceFormatter,
  })
);
jest.mock(
  '../../../../src/actions/tracing/humanReadableFormatter.js',
  () => ({
    __esModule: true,
    HumanReadableFormatter: mockHumanReadableFormatter,
  })
);
jest.mock(
  '../../../../src/storage/indexedDBStorageAdapter.js',
  () => ({
    __esModule: true,
    IndexedDBStorageAdapter: mockIndexedDBStorageAdapter,
  })
);
jest.mock(
  '../../../../src/events/tracing/eventDispatchTracer.js',
  () => ({
    __esModule: true,
    EventDispatchTracer: mockEventDispatchTracer,
  })
);
jest.mock(
  '../../../../src/actions/tracing/metrics/errorMetricsService.js',
  () => ({
    __esModule: true,
    ErrorMetricsService: mockErrorMetricsService,
  })
);
jest.mock(
  '../../../../src/actions/tracing/resilience/retryManager.js',
  () => ({
    __esModule: true,
    RetryManager: mockRetryManager,
  })
);
jest.mock(
  '../../../../src/actions/tracing/recovery/recoveryManager.js',
  () => ({
    __esModule: true,
    RecoveryManager: mockRecoveryManager,
  })
);
jest.mock(
  '../../../../src/actions/tracing/errors/traceErrorHandler.js',
  () => ({
    __esModule: true,
    TraceErrorHandler: mockTraceErrorHandler,
  })
);
jest.mock(
  '../../../../src/actions/tracing/tracingConfigurationInitializer.js',
  () => ({
    __esModule: true,
    default: mockTracingConfigurationInitializer,
  })
);

/**
 *
 * @param baseMap
 */
function createContainer(baseMap) {
  const base = new Map(baseMap);
  const registrations = new Map();
  const singletons = new Map();

  const container = {
    register: jest.fn((token, factoryOrValue, options = {}) => {
      registrations.set(token, { factoryOrValue, options });
    }),
    resolve: jest.fn((token) => {
      if (base.has(token)) {
        return base.get(token);
      }

      if (singletons.has(token)) {
        return singletons.get(token);
      }

      if (!registrations.has(token)) {
        throw new Error(`Token not registered: ${String(token)}`);
      }

      const { factoryOrValue, options } = registrations.get(token);
      const value =
        typeof factoryOrValue === 'function'
          ? factoryOrValue(container)
          : factoryOrValue;

      if (options.lifecycle !== 'transient') {
        singletons.set(token, value);
      }

      return value;
    }),
    __registrations: registrations,
  };

  return container;
}

describe('registerActionTracing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers and wires all action tracing services', async () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const schemaValidator = { validate: jest.fn() };
    const traceConfigLoaderDependency = { load: jest.fn() };
    const storageProvider = { ensureDirectory: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const configuration = { get: jest.fn() };

    const container = createContainer([
      [tokens.ILogger, logger],
      [tokens.ISchemaValidator, schemaValidator],
      [tokens.ITraceConfigLoader, traceConfigLoaderDependency],
      [tokens.IStorageProvider, storageProvider],
      [tokens.IEventBus, eventBus],
      [tokens.IConfiguration, configuration],
    ]);

    const { registerActionTracing } = await import(
      '../../../../src/dependencyInjection/registrations/actionTracingRegistrations.js'
    );

    registerActionTracing(container);

    expect(container.register).toHaveBeenCalledTimes(15);
    expect(logger.debug).toHaveBeenCalledWith(
      'Action Tracing Registration: starting…'
    );

    const initializerRegistration = container.__registrations.get(
      actionTracingTokens.ITracingConfigurationInitializer
    );
    expect(initializerRegistration.options).toEqual({
      lifecycle: 'singleton',
      tags: INITIALIZABLE,
    });

    container.resolve(actionTracingTokens.IActionTraceConfigValidator);
    expect(mockActionTraceConfigValidator).toHaveBeenCalledWith({
      schemaValidator,
      logger,
    });

    const loaderInstance = container.resolve(
      actionTracingTokens.IActionTraceConfigLoader
    );
    expect(mockActionTraceConfigLoader).toHaveBeenCalledWith({
      traceConfigLoader: traceConfigLoaderDependency,
      validator: schemaValidator,
      logger,
    });

    const traceDirectoryManagerInstance = container.resolve(
      actionTracingTokens.ITraceDirectoryManager
    );
    expect(mockTraceDirectoryManager).toHaveBeenCalledWith({
      storageProvider,
      logger,
    });

    const storageAdapterInstance = container.resolve(
      actionTracingTokens.IIndexedDBStorageAdapter
    );
    expect(mockIndexedDBStorageAdapter).toHaveBeenCalledWith({
      logger,
      dbName: 'ActionTraces',
      dbVersion: 1,
      storeName: 'traces',
    });

    const filterInstance = container.resolve(
      actionTracingTokens.IActionTraceFilter
    );
    expect(mockActionTraceFilter).toHaveBeenCalledWith({
      enabled: false,
      tracedActions: [],
      excludedActions: [],
      verbosityLevel: 'standard',
      inclusionConfig: {
        componentData: false,
        prerequisites: false,
        targets: false,
      },
      logger,
    });

    const jsonFormatterInstance = container.resolve(
      actionTracingTokens.IJsonTraceFormatter
    );
    expect(mockJsonTraceFormatter).toHaveBeenCalledWith({
      logger,
      actionTraceFilter: filterInstance,
    });

    const humanFormatterInstance = container.resolve(
      actionTracingTokens.IHumanReadableFormatter
    );
    expect(mockHumanReadableFormatter).toHaveBeenCalledWith({
      logger,
      actionTraceFilter: filterInstance,
    });

    const outputServiceInstance = container.resolve(
      actionTracingTokens.IActionTraceOutputService
    );
    expect(mockActionTraceOutputService).toHaveBeenCalledWith(
      expect.objectContaining({
        storageAdapter: storageAdapterInstance,
        logger,
        actionTraceFilter: filterInstance,
        jsonFormatter: jsonFormatterInstance,
        humanReadableFormatter: humanFormatterInstance,
        traceDirectoryManager: traceDirectoryManagerInstance,
        eventBus,
        namingOptions: {
          strategy: mockNamingStrategy.TIMESTAMP_FIRST,
          timestampFormat: mockTimestampFormat.COMPACT,
          includeHash: true,
          hashLength: 6,
        },
        outputToFiles: true,
        outputDirectory: './traces/rub-vagina-debugging',
        actionTraceConfig: {
          outputFormats: ['json'],
          textFormatOptions: {},
        },
      })
    );

    const structuredTraceFactory = container.resolve(
      actionTracingTokens.IActionAwareStructuredTrace
    );
    expect(typeof structuredTraceFactory).toBe('function');
    expect(() => structuredTraceFactory({})).toThrow(
      'actorId is required to create ActionAwareStructuredTrace'
    );
    const structuredTrace = structuredTraceFactory({
      actorId: 'actor-1',
      context: { area: 'forest' },
      traceContext: { traceId: 'trace-123' },
      traceConfig: { verbosity: 'debug' },
    });
    expect(structuredTrace).toEqual(
      mockActionAwareStructuredTrace.mock.results[0].value
    );
    expect(mockActionAwareStructuredTrace).toHaveBeenCalledWith({
      actionTraceFilter: filterInstance,
      actorId: 'actor-1',
      context: { area: 'forest' },
      logger,
      traceContext: { traceId: 'trace-123' },
      traceConfig: { verbosity: 'debug' },
    });

    container.resolve(actionTracingTokens.IEventDispatchTracer);
    expect(mockEventDispatchTracer).toHaveBeenCalledWith({
      logger,
      outputService: outputServiceInstance,
    });

    container.resolve(actionTracingTokens.IErrorMetrics);
    expect(mockErrorMetricsService).toHaveBeenCalledWith({ logger });

    container.resolve(actionTracingTokens.IRetryManager);
    expect(mockRetryManager).toHaveBeenCalledTimes(1);

    const recoveryManagerInstance = container.resolve(
      actionTracingTokens.IRecoveryManager
    );
    const retryManagerInstance = container.resolve(
      actionTracingTokens.IRetryManager
    );
    expect(mockRecoveryManager).toHaveBeenCalledWith({
      logger,
      config: configuration,
      retryManager: retryManagerInstance,
    });

    container.resolve(actionTracingTokens.ITraceErrorHandler);
    const errorMetricsInstance = container.resolve(
      actionTracingTokens.IErrorMetrics
    );
    expect(mockTraceErrorHandler).toHaveBeenCalledWith({
      logger,
      errorMetrics: errorMetricsInstance,
      recoveryManager: recoveryManagerInstance,
      config: configuration,
    });

    container.resolve(actionTracingTokens.ITracingConfigurationInitializer);
    expect(mockTracingConfigurationInitializer).toHaveBeenCalledWith({
      configLoader: loaderInstance,
      actionTraceFilter: filterInstance,
      actionTraceOutputService: outputServiceInstance,
      logger,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'Action Tracing Registration: complete.'
    );
  });
});
