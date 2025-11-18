import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

class FakeContainer {
  constructor() {
    this.registrations = new Map();
  }

  register(token, value, options = {}) {
    this.registrations.set(token, { value, options, instance: undefined });
  }

  resolve(token) {
    const entry = this.registrations.get(token);
    if (!entry) {
      throw new Error(`No registration for token ${String(token)}`);
    }

    const { value, options } = entry;
    if (options?.isInstance) {
      return value;
    }

    if (options?.lifecycle === 'singletonFactory') {
      if (entry.instance === undefined) {
        entry.instance = value(this);
      }
      return entry.instance;
    }

    if (options?.lifecycle === 'singleton') {
      if (entry.instance === undefined) {
        if (typeof value === 'function') {
          const dependencies = options.dependencies || [];
          const resolvedDeps = dependencies.map((dep) => this.resolve(dep));
          entry.instance = new value(...resolvedDeps);
        } else {
          entry.instance = value;
        }
      }
      return entry.instance;
    }

    if (typeof value === 'function') {
      return value(this);
    }

    return value;
  }
}

/**
 *
 * @param container
 * @param token
 * @param instance
 */
function registerInstance(container, token, instance) {
  container.register(token, instance, { lifecycle: 'singleton', isInstance: true });
}

/**
 *
 * @param root0
 * @param root0.withValidation
 * @param root0.failValidationImport
 */
async function importModuleWithMocks({ withValidation = false, failValidationImport = false } = {}) {
  const consoleLoggerInstance = { log: jest.fn() };
  const ConsoleLoggerMock = jest.fn(() => consoleLoggerInstance);
  const loggerStrategyInstance = {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    getMode: jest.fn(() => 'console'),
  };
  const LoggerStrategyMock = jest.fn(() => loggerStrategyInstance);
  const configureBaseContainerMock = jest.fn().mockResolvedValue();
  const loadAndApplyLoggerConfigMock = jest.fn().mockResolvedValue();

  jest.doMock('../../../src/logging/consoleLogger.js', () => ({
    __esModule: true,
    default: ConsoleLoggerMock,
    LogLevel: { INFO: 'info' },
  }));

  jest.doMock('../../../src/logging/loggerStrategy.js', () => ({
    __esModule: true,
    default: LoggerStrategyMock,
  }));

  jest.doMock('../../../src/dependencyInjection/baseContainerConfig.js', () => ({
    __esModule: true,
    configureBaseContainer: configureBaseContainerMock,
  }));

  jest.doMock('../../../src/configuration/utils/loggerConfigUtils.js', () => ({
    __esModule: true,
    loadAndApplyLoggerConfig: loadAndApplyLoggerConfigMock,
  }));

  let validationMocks = null;

  if (withValidation) {
    if (failValidationImport) {
      jest.doMock('../../../cli/validation/modReferenceExtractor.js', () => {
        throw new Error('import failure');
      });
    } else {
      const ModDependencyValidator = jest.fn(function ModDependencyValidator() {});
      const ModReferenceExtractor = jest.fn(function ModReferenceExtractor(config) {
        this.config = config;
      });
      const ModCrossReferenceValidator = jest.fn(function ModCrossReferenceValidator(config) {
        this.config = config;
      });
      const ModValidationOrchestrator = jest.fn(function ModValidationOrchestrator(config) {
        this.config = config;
      });
      const ViolationReporter = jest.fn(function ViolationReporter(config) {
        this.config = config;
      });

      jest.doMock('../../../cli/validation/modReferenceExtractor.js', () => ({
        __esModule: true,
        default: ModReferenceExtractor,
      }));
      jest.doMock('../../../cli/validation/modCrossReferenceValidator.js', () => ({
        __esModule: true,
        default: ModCrossReferenceValidator,
      }));
      jest.doMock('../../../cli/validation/modValidationOrchestrator.js', () => ({
        __esModule: true,
        default: ModValidationOrchestrator,
      }));
      jest.doMock('../../../src/validation/violationReporter.js', () => ({
        __esModule: true,
        default: ViolationReporter,
      }));
      jest.doMock('../../../src/modding/modDependencyValidator.js', () => ({
        __esModule: true,
        default: ModDependencyValidator,
      }));

      validationMocks = {
        ModDependencyValidator,
        ModReferenceExtractor,
        ModCrossReferenceValidator,
        ModValidationOrchestrator,
        ViolationReporter,
      };
    }
  }

  const module = await import('../../../src/dependencyInjection/minimalContainerConfig.js');
  const tokensModule = await import('../../../src/dependencyInjection/tokens.js');

  return {
    configureMinimalContainer: module.configureMinimalContainer,
    tokens: tokensModule.tokens,
    mocks: {
      ConsoleLoggerMock,
      consoleLoggerInstance,
      LoggerStrategyMock,
      loggerStrategyInstance,
      configureBaseContainerMock,
      loadAndApplyLoggerConfigMock,
    },
    validationMocks,
  };
}

describe('configureMinimalContainer', () => {
  let originalEnv;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('configures base container and loads logger config outside test environment', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEBUG_LOG_MODE;

    const { configureMinimalContainer, tokens, mocks } = await importModuleWithMocks();
    const container = new FakeContainer();

    await configureMinimalContainer(container, { includeCharacterBuilder: true });

    expect(mocks.LoggerStrategyMock).toHaveBeenCalledWith({
      mode: undefined,
      config: {},
      dependencies: { consoleLogger: mocks.consoleLoggerInstance },
    });

    const registeredLogger = container.resolve(tokens.ILogger);
    expect(registeredLogger).toBe(mocks.loggerStrategyInstance);

    expect(mocks.configureBaseContainerMock).toHaveBeenCalledWith(container, {
      includeGameSystems: false,
      includeUI: false,
      includeAnatomySystems: true,
      includeCharacterBuilder: true,
      logger: mocks.loggerStrategyInstance,
    });

    expect(mocks.loadAndApplyLoggerConfigMock).toHaveBeenCalledWith(
      container,
      mocks.loggerStrategyInstance,
      tokens,
      'MinimalContainerConfig'
    );

    expect(mocks.loggerStrategyInstance.debug).toHaveBeenCalledWith(
      expect.stringContaining('[MinimalContainerConfig] Initial logger registered')
    );
    expect(mocks.loggerStrategyInstance.debug).toHaveBeenCalledWith(
      '[MinimalContainerConfig] All core bundles registered.'
    );
    expect(mocks.loggerStrategyInstance.debug).toHaveBeenCalledWith(
      '[MinimalContainerConfig] Minimal configuration complete.'
    );
  });

  it('registers validation services and skips config loading in test environment', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEBUG_LOG_MODE;

    const { configureMinimalContainer, tokens, mocks, validationMocks } =
      await importModuleWithMocks({ withValidation: true });

    const container = new FakeContainer();

    await configureMinimalContainer(container, { includeValidationServices: true });

    expect(mocks.LoggerStrategyMock).toHaveBeenCalledWith({
      mode: 'console',
      config: {},
      dependencies: { consoleLogger: mocks.consoleLoggerInstance },
    });

    expect(mocks.loadAndApplyLoggerConfigMock).not.toHaveBeenCalled();
    expect(mocks.loggerStrategyInstance.debug).toHaveBeenCalledWith(
      '[MinimalContainerConfig] Skipping logger config loading in test environment.'
    );

    // Register stub dependencies required by validation factories
    registerInstance(container, tokens.ISchemaValidator, { id: 'schema' });
    registerInstance(container, tokens.ModLoadOrderResolver, { id: 'resolver' });
    registerInstance(container, tokens.ModManifestLoader, { id: 'manifest' });
    registerInstance(container, tokens.IPathResolver, { id: 'path' });
    registerInstance(container, tokens.IConfiguration, { id: 'config' });

    const referenceExtractor = container.resolve(tokens.IModReferenceExtractor);
    expect(referenceExtractor).toBeInstanceOf(validationMocks.ModReferenceExtractor);
    expect(validationMocks.ModReferenceExtractor).toHaveBeenCalledWith({
      logger: mocks.loggerStrategyInstance,
      ajvValidator: { id: 'schema' },
    });

    const crossReferenceValidator = container.resolve(tokens.IModCrossReferenceValidator);
    expect(crossReferenceValidator).toBeInstanceOf(
      validationMocks.ModCrossReferenceValidator
    );
    expect(validationMocks.ModCrossReferenceValidator).toHaveBeenCalledWith({
      logger: mocks.loggerStrategyInstance,
      modDependencyValidator: validationMocks.ModDependencyValidator,
      referenceExtractor,
    });

    const orchestrator = container.resolve(tokens.IModValidationOrchestrator);
    expect(orchestrator).toBeInstanceOf(validationMocks.ModValidationOrchestrator);
    expect(validationMocks.ModValidationOrchestrator).toHaveBeenCalledWith({
      logger: mocks.loggerStrategyInstance,
      modDependencyValidator: validationMocks.ModDependencyValidator,
      modCrossReferenceValidator: crossReferenceValidator,
      modLoadOrderResolver: { id: 'resolver' },
      modManifestLoader: { id: 'manifest' },
      pathResolver: { id: 'path' },
      configuration: { id: 'config' },
    });

    const violationReporter = container.resolve(tokens.IViolationReporter);
    expect(violationReporter).toBeInstanceOf(validationMocks.ViolationReporter);
    expect(validationMocks.ViolationReporter).toHaveBeenCalledWith({
      logger: mocks.loggerStrategyInstance,
    });
  });

  it('logs and rethrows errors when validation service registration fails', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEBUG_LOG_MODE;

    const { configureMinimalContainer, mocks } = await importModuleWithMocks({
      withValidation: true,
      failValidationImport: true,
    });

    const container = new FakeContainer();

    await expect(
      configureMinimalContainer(container, { includeValidationServices: true })
    ).rejects.toThrow('import failure');

    expect(mocks.loadAndApplyLoggerConfigMock).not.toHaveBeenCalled();
    expect(mocks.loggerStrategyInstance.error).toHaveBeenCalledWith(
      '[MinimalContainerConfig] Failed to register validation services:',
      expect.any(Error)
    );
  });
});
