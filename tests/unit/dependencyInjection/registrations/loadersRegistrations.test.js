import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { registerLoaders } from '../../../../src/dependencyInjection/registrations/loadersRegistrations.js';

/**
 * @description Creates a logger mock compatible with the ILogger interface.
 * @returns {{ debug: jest.Mock, error: jest.Mock, info: jest.Mock, warn: jest.Mock }} Logger mock implementation.
 */
function createLoggerMock() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

/**
 * @description Configures a container with essential dependencies and executes loader registration.
 * @param {AppContainer} [container] - Container instance to configure.
 * @returns {Promise<{ container: AppContainer, logger: ReturnType<typeof createLoggerMock> }>} Initialized container and logger.
 */
async function setupContainer(container = new AppContainer()) {
  const logger = createLoggerMock();

  container.register(tokens.ILogger, () => logger);
  container.register(tokens.ISafeEventDispatcher, () => ({ dispatch: jest.fn() }));
  container.register(tokens.IValidatedEventDispatcher, () => ({ dispatchValidated: jest.fn() }));
  container.register(tokens.IPathConfiguration, () => ({ scopePath: 'scopes' }));

  await registerLoaders(container);

  return { container, logger };
}

/**
 * @description Custom container that forces a registration failure for mod validation services.
 */
class ModValidationFailingContainer extends AppContainer {
  /**
   * @override
   */
  register(token, factoryOrValue, options) {
    if (String(token) === tokens.IModReferenceExtractor) {
      throw new Error('forced mod validation failure');
    }
    return super.register(token, factoryOrValue, options);
  }
}

describe('registerLoaders', () => {
  it('registers ScopeLoader with TextDataFetcher dependency', async () => {
    const { container, logger } = await setupContainer();

    const scopeLoader = container.resolve(tokens.ScopeLoader);
    const textFetcher = container.resolve(tokens.ITextDataFetcher);

    expect(scopeLoader._dataFetcher).toBe(textFetcher);
    expect(logger.debug).toHaveBeenCalledWith(
      'Loaders Registration: All core services, loaders, and phases registered.'
    );
  });

  it('registers mod validation services when running in a server environment', async () => {
    const { container, logger } = await setupContainer();

    expect(container.isRegistered(tokens.IModReferenceExtractor)).toBe(true);
    expect(container.isRegistered(tokens.IModCrossReferenceValidator)).toBe(true);
    expect(container.isRegistered(tokens.IModValidationOrchestrator)).toBe(true);
    expect(container.isRegistered(tokens.IViolationReporter)).toBe(true);

    const orchestrator = container.resolve(tokens.IModValidationOrchestrator);
    expect(orchestrator).toBeTruthy();
    expect(logger.debug).toHaveBeenCalledWith(
      'Registered mod cross-reference validation services and orchestrator (server-side only)'
    );
  });

  it('skips mod validation services when process is unavailable', async () => {
    const originalProcessDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true });
    globalThis.window = {};

    let container;
    let logger;
    try {
      const result = await setupContainer();
      container = result.container;
      logger = result.logger;
    } finally {
      if (typeof originalWindow === 'undefined') {
        delete globalThis.window;
      } else {
        globalThis.window = originalWindow;
      }

      if (originalProcessDescriptor) {
        Object.defineProperty(globalThis, 'process', originalProcessDescriptor);
      }
    }

    expect(logger.debug).toHaveBeenCalledWith(
      'Skipped mod cross-reference validation services (browser environment)'
    );
    expect(container.isRegistered(tokens.IModValidationOrchestrator)).toBe(false);
  });

  it('logs a debug message when mod validation services fail to register', async () => {
    const { container, logger } = await setupContainer(
      new ModValidationFailingContainer()
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Failed to register validation services (likely browser environment): forced mod validation failure'
    );
    expect(container.isRegistered(tokens.IModValidationOrchestrator)).toBe(false);
  });
});
