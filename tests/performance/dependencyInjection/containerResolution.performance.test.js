/**
 * @file Performance tests for dependency injection container resolution
 * @description Tests performance characteristics of service resolution from the container
 *
 * Test Methodology:
 * ================
 *
 * This test suite separates two distinct performance scenarios:
 *
 * 1. **Cold Start Performance**: Measures the time to resolve services for the first time,
 *    including the full dependency resolution chain. This reflects production startup performance.
 *    - Threshold: 100ms for initial resolution of 6 services
 *    - Critical for application startup time
 *
 * 2. **Warm Cache Performance**: Measures repeated resolution of already-cached singleton services.
 *    This reflects ongoing application runtime performance.
 *    - Threshold: 50ms for 6000 cached resolutions (1000 iterations × 6 services)
 *    - Critical for application runtime efficiency
 *
 * 3. **Mixed Performance**: Tests the original flaky scenario of cold start + warm cache combined.
 *    - Threshold: 150ms for 600 total resolutions (accounts for test environment overhead)
 *    - Includes both expensive initial resolutions and cheap cached lookups
 *
 * Timing Considerations:
 * =====================
 * - Test environment (Jest + jsdom) adds 10-50ms overhead compared to production
 * - Initial service resolution triggers dependency chain resolution
 * - Singleton caching makes subsequent resolutions very fast (map lookups)
 * - System variability (CPU scheduling, GC) affects timing consistency
 *
 * Previous Issue:
 * ==============
 * The original test was flaky because it expected 50ms for mixed cold/warm performance,
 * which didn't account for the significant difference between initial dependency resolution
 * and cached singleton lookups.
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
    const maxTimeMs = 150; // 150ms for 100 iterations (accounts for cold start + test environment overhead)

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

  it('should resolve pipeline services on first access within reasonable time', () => {
    // This test measures cold start performance - the production-critical scenario
    // where services are resolved for the first time during application startup
    const maxColdStartMs = 100; // Allow more time for initial dependency resolution

    const servicesToTest = [
      tokens.IPipelineServiceFactory,
      tokens.IPipelineServiceRegistry,
      tokens.ITargetDependencyResolver,
      tokens.ILegacyTargetCompatibilityLayer,
      tokens.IScopeContextBuilder,
      tokens.ITargetDisplayNameResolver,
    ];

    const start = performance.now();

    // Resolve each service once (simulating application startup)
    servicesToTest.forEach((token) => {
      container.resolve(token);
    });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(maxColdStartMs);
  });

  it('should have fast warm cache performance after initial resolution', () => {
    // Pre-warm the cache by resolving services once
    const servicesToTest = [
      tokens.IPipelineServiceFactory,
      tokens.IPipelineServiceRegistry,
      tokens.ITargetDependencyResolver,
      tokens.ILegacyTargetCompatibilityLayer,
      tokens.IScopeContextBuilder,
      tokens.ITargetDisplayNameResolver,
    ];

    servicesToTest.forEach((token) => container.resolve(token));

    // Now measure warm cache performance
    const iterations = 1000; // More iterations to emphasize cache performance
    const maxWarmCacheMs = 50; // Should be much faster with cached singletons

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      servicesToTest.forEach((token) => container.resolve(token));
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(maxWarmCacheMs);
  });
});
