/**
 * @file Performance tests for dependency injection container resolution
 * @description Tests performance characteristics of service resolution from the container
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('Container Performance', () => {
  let container;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let logger;

  beforeEach(async () => {
    container = new AppContainer();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Register logger first as it's needed by other services
    logger = new ConsoleLogger(LogLevel.ERROR);
    container.register(tokens.ILogger, () => logger);

    // Configure container with base services
    await configureBaseContainer(container, {
      includeGameSystems: false, // We only need core services for pipeline testing
      includeUI: false,
      logger: logger,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should resolve all pipeline services within acceptable time', () => {
    const iterations = 100;
    const maxTimeMs = 50; // 50ms for 100 iterations

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      container.resolve(tokens.IPipelineServiceFactory);
      container.resolve(tokens.IPipelineServiceRegistry);
      container.resolve(tokens.ITargetDependencyResolver);
      container.resolve(tokens.ILegacyTargetCompatibilityLayer);
      container.resolve(tokens.IScopeContextBuilder);
      container.resolve(tokens.ITargetDisplayNameResolver);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(maxTimeMs);
  });
});
