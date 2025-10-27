import { afterEach, describe, expect, it, jest } from '@jest/globals';

const actualTokens = jest
  .requireActual('../../../../src/dependencyInjection/tokens.js')
  .tokens;

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

class RecordingContainer {
  constructor(logger, resolveOverrides = new Map()) {
    this.logger = logger;
    this.registrations = new Map();
    this._resolveOverrides = resolveOverrides;
    this.register = jest.fn((token, factoryOrValue, options = {}) => {
      this.registrations.set(token, {
        factoryOrValue,
        options,
      });
    });
    this.resolve = jest.fn((token) => {
      if (token === actualTokens.ILogger) {
        return logger;
      }
      if (this._resolveOverrides.has(token)) {
        const value = this._resolveOverrides.get(token);
        return typeof value === 'function' ? value() : value;
      }
      throw new Error(`Mock Resolve Error: Token not registered: ${String(token)}`);
    });
  }
}

const originalNodeEnv = process.env.NODE_ENV;
const hadWindow = Object.prototype.hasOwnProperty.call(global, 'window');
const originalWindow = global.window;

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  jest.restoreAllMocks();
  process.env.NODE_ENV = originalNodeEnv;
  if (hadWindow) {
    global.window = originalWindow;
  } else {
    delete global.window;
  }
});

describe('registerLoaders additional coverage', () => {
  it('falls back to console debug when ILogger is unavailable in a browser-like environment', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    global.window = {};

    const consoleSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);

    const container = {
      register: jest.fn(),
      resolve: jest.fn(() => {
        throw new Error('ILogger not registered');
      }),
    };

    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    await expect(registerLoaders(container)).rejects.toThrow(/reading 'debug'/i);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Loaders Registration: Starting... (ILogger not yet available)'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skipped mod cross-reference validation services (browser environment)'
      )
    );
  });

  it('registers validation services when running in a server environment', async () => {
    jest.resetModules();
    delete global.window;
    process.env.NODE_ENV = 'test';

    jest.doMock('../../../../src/validation/modReferenceExtractor', () => ({
      __esModule: true,
      default: class MockModReferenceExtractor {
        constructor(deps) {
          this.deps = deps;
        }
      },
    }), { virtual: true });

    jest.doMock('../../../../src/validation/modCrossReferenceValidator', () => ({
      __esModule: true,
      default: class MockModCrossReferenceValidator {
        constructor(deps) {
          this.deps = deps;
        }
      },
    }), { virtual: true });

    jest.doMock('../../../../src/validation/modValidationOrchestrator', () => ({
      __esModule: true,
      default: class MockModValidationOrchestrator {
        constructor(deps) {
          this.deps = deps;
        }
      },
    }), { virtual: true });

    jest.doMock('../../../../src/validation/violationReporter.js', () => ({
      __esModule: true,
      default: class MockViolationReporter {
        constructor(deps) {
          this.deps = deps;
        }
      },
    }));

    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const logger = createLogger();
    const container = new RecordingContainer(logger);

    await registerLoaders(container);

    expect(container.registrations.has(actualTokens.IModReferenceExtractor)).toBe(
      true
    );
    expect(
      container.registrations.has(actualTokens.IModCrossReferenceValidator)
    ).toBe(true);
    expect(
      container.registrations.has(actualTokens.IModValidationOrchestrator)
    ).toBe(true);
    expect(container.registrations.has(actualTokens.IViolationReporter)).toBe(true);

    expect(logger.debug).toHaveBeenCalledWith(
      'Registered mod cross-reference validation services and orchestrator (server-side only)'
    );
  });

  it('logs debug output when validation service registration fails', async () => {
    jest.resetModules();
    delete global.window;
    process.env.NODE_ENV = 'test';

    jest.doMock('../../../../src/validation/modReferenceExtractor.js', () => {
      throw new Error('dynamic import failure');
    });

    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const logger = createLogger();
    const container = new RecordingContainer(logger);

    await registerLoaders(container);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Failed to register validation services')
    );
  });

  it('invokes the aggregator factory when constructing ContentLoadManager', async () => {
    jest.resetModules();
    delete global.window;
    process.env.NODE_ENV = 'test';

    jest.doMock('../../../../src/loaders/ContentLoadManager.js', () => ({
      __esModule: true,
      default: class MockContentLoadManager {
        constructor(deps) {
          this.deps = deps;
          this.aggregator = deps.aggregatorFactory({ rules: 7 });
        }
      },
    }));

    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');
    const { default: ActiveLoadResultAggregator } = require('../../../../src/loaders/LoadResultAggregator.js');

    const logger = createLogger();
    const container = new RecordingContainer(logger);

    await registerLoaders(container);

    const registration = container.registrations.get(actualTokens.ContentLoadManager);
    expect(registration).toBeDefined();

    const stubValues = new Map([
      [actualTokens.ComponentLoader, { id: 'component' }],
      [actualTokens.EventLoader, { id: 'event' }],
      [actualTokens.ConditionLoader, { id: 'condition' }],
      [actualTokens.MacroLoader, { id: 'macro' }],
      [actualTokens.ActionLoader, { id: 'action' }],
      [actualTokens.RuleLoader, { id: 'rule' }],
      [actualTokens.GoalLoader, { id: 'goal' }],
      [actualTokens.ScopeLoader, { id: 'scope' }],
      [actualTokens.EntityLoader, { id: 'entityDefinition' }],
      [actualTokens.EntityInstanceLoader, { id: 'entityInstance' }],
      [actualTokens.AnatomySlotLibraryLoader, { id: 'slotLibrary' }],
      [actualTokens.AnatomyBlueprintPartLoader, { id: 'blueprintPart' }],
      [actualTokens.AnatomyBlueprintLoader, { id: 'blueprint' }],
      [actualTokens.AnatomyRecipeLoader, { id: 'recipe' }],
      [actualTokens.AnatomyFormattingLoader, { id: 'formatting' }],
      [actualTokens.AnatomyStructureTemplateLoader, { id: 'structureTemplate' }],
      [actualTokens.IValidatedEventDispatcher, { dispatch: jest.fn() }],
      [actualTokens.ILogger, logger],
    ]);

    const stubContainer = {
      resolve: jest.fn((token) => {
        if (stubValues.has(token)) {
          return stubValues.get(token);
        }
        throw new Error(`Missing stub for token: ${String(token)}`);
      }),
    };

    const contentManager = registration.factoryOrValue(stubContainer);

    expect(stubContainer.resolve).toHaveBeenCalledWith(actualTokens.ComponentLoader);
    expect(contentManager.aggregator).toBeInstanceOf(ActiveLoadResultAggregator);
    expect(contentManager.aggregator.getTotalCounts()).toEqual({ rules: 7 });
  });

  it('logs an error when ModsLoader phase resolution fails and rethrows the error', async () => {
    jest.resetModules();
    delete global.window;
    process.env.NODE_ENV = 'test';

    const { registerLoaders } = require('../../../../src/dependencyInjection/registrations/loadersRegistrations.js');

    const logger = createLogger();
    const container = new RecordingContainer(logger);

    await registerLoaders(container);

    const registration = container.registrations.get(actualTokens.ModsLoader);
    expect(registration).toBeDefined();

    logger.error.mockClear();

    const phaseMap = new Map([
      [actualTokens.SchemaPhase, { name: 'SchemaPhase' }],
      [actualTokens.GameConfigPhase, { name: 'GameConfigPhase' }],
      [actualTokens.ManifestPhase, { name: 'ManifestPhase' }],
      [actualTokens.WorldPhase, { name: 'WorldPhase' }],
      [actualTokens.SummaryPhase, { name: 'SummaryPhase' }],
    ]);

    const failingContainer = {
      resolve: jest.fn((token) => {
        if (token === actualTokens.ILogger) {
          return logger;
        }
        if (phaseMap.has(token)) {
          return phaseMap.get(token);
        }
        if (token === actualTokens.ContentPhase) {
          throw new Error('phase resolver missing');
        }
        if (token === actualTokens.ILoadCache) {
          return { cache: true };
        }
        if (token === actualTokens.IDataRegistry) {
          return { registry: true };
        }
        if (token === actualTokens.ModManifestLoader) {
          return { loader: true };
        }
        if (token === actualTokens.ModLoadOrderResolver) {
          return { resolve: jest.fn() };
        }
        return { token };
      }),
    };

    expect(() => registration.factoryOrValue(failingContainer)).toThrow(
      'phase resolver missing'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ModsLoader: Failed to resolve ContentPhase'),
      expect.objectContaining({ message: 'phase resolver missing' })
    );
  });
});
