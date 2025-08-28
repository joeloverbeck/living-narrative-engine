/**
 * @file Performance Test Container Factory
 *
 * Creates a lightweight container for performance tests by reusing
 * the baseContainerConfig with minimal setup, avoiding full application initialization.
 */

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

/**
 * Creates a minimal container for ScopeDSL performance testing
 * using the base container configuration without UI or game systems.
 *
 * @returns {Promise<AppContainer>} Configured minimal container
 */
export async function createPerformanceTestContainer() {
  const container = new AppContainer();

  // Set up minimal logger (silent for performance)
  const logger = new ConsoleLogger(LogLevel.ERROR);
  container.register(tokens.ILogger, logger);

  // Use base container configuration which has all core dependencies
  // but skip UI and game initialization
  await configureBaseContainer(container);

  // Initialize only what's needed
  const entityManager = container.resolve(tokens.IEntityManager);
  if (entityManager?.initialize) {
    await entityManager.initialize();
  }

  return container;
}

/**
 * Cleanup function for performance test containers
 *
 * @param {AppContainer} container - Container to cleanup
 */
export function cleanupPerformanceContainer(container) {
  if (!container) return;

  // Clear entity manager
  const entityManager = container.resolve(tokens.IEntityManager);
  if (entityManager?.clear) {
    entityManager.clear();
  }
  if (entityManager?.cleanup) {
    entityManager.cleanup();
  }

  // Reset circuit breaker if it exists
  const monitoringService = container.resolve(tokens.IMonitoringService);
  if (monitoringService?.resetCircuitBreaker) {
    monitoringService.resetCircuitBreaker('createEntityInstance');
  }

  // Clear data registry
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  if (dataRegistry?.clear) {
    dataRegistry.clear();
  }

  // Clear scope registry
  const scopeRegistry = container.resolve(tokens.IScopeRegistry);
  if (scopeRegistry?.clear) {
    scopeRegistry.clear();
  }

  // Clear container
  if (container.cleanup) {
    container.cleanup();
  }
}
