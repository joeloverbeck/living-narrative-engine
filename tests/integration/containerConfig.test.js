// tests/integration/containerConfig.test.js

/**
 * @file Integration tests for Dependency Injection Container Configuration
 *
 * Performance Optimization:
 * - Uses shared container pattern (beforeAll instead of beforeEach)
 * - Skips async config loading (loadAndApplyLoggerConfig, loadAndApplyTraceConfig)
 * - Tests only verify service resolution, not config loading behavior
 *
 * @see tests/integration/configuration/OPTIMIZATION.md
 * @see tests/common/configuration/containerConfigTestHelpers.js
 */

import { tokens } from '../../src/dependencyInjection/tokens.js';

// --- Import the classes we want to check ---
import CommandOutcomeInterpreter from '../../src/commands/interpreters/commandOutcomeInterpreter.js';
import TurnManager from '../../src/turns/turnManager.js';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import ActorTurnHandler from '../../src/turns/handlers/actorTurnHandler.js';

// Import test helpers
import {
  createContainerConfigTestContainer,
  createPerformanceMonitor,
  resetContainerMocksForNextTest,
  PERFORMANCE_THRESHOLDS,
} from '../common/configuration/containerConfigTestHelpers.js';

describe('Dependency Injection Container Configuration', () => {
  let container;
  let setupTime;

  // Create container ONCE for all tests (performance optimization)
  beforeAll(async () => {
    const monitor = createPerformanceMonitor();
    monitor.start();

    container = await createContainerConfigTestContainer();

    setupTime = monitor.end();
    // eslint-disable-next-line no-console
    console.log(`[containerConfig.test] Container setup took ${setupTime.toFixed(2)}ms`);
  });

  afterAll(() => {
    // Clean up container after all tests complete
    if (container) {
      container.reset();
      container = null;
    }
  });

  beforeEach(() => {
    // Reset mocks between tests (lightweight operation)
    resetContainerMocksForNextTest(container);
  });

  afterEach(() => {
    // No per-test cleanup needed - container is shared
  });

  // Test 1: Verify CommandOutcomeInterpreter can be resolved
  it('should resolve CommandOutcomeInterpreter successfully', () => {
    const instance = container.resolve(tokens.ICommandOutcomeInterpreter);
    expect(instance).toBeInstanceOf(CommandOutcomeInterpreter);
    expect(typeof instance.interpret).toBe('function'); // public API check
  });

  // Test 2: Verify ActorTurnHandler (which depends on CommandOutcomeInterpreter) can be resolved
  it('should resolve ActorTurnHandler successfully', () => {
    const instance = container.resolve(tokens.ActorTurnHandler);
    expect(instance).toBeInstanceOf(ActorTurnHandler);
    expect(typeof instance.startTurn).toBe('function'); // public API check
  });

  // Test 3: Verify ITurnManager (which depends on ActorTurnHandler via Resolver) can be resolved
  it('should resolve ITurnManager successfully', () => {
    const instance = container.resolve(tokens.ITurnManager);
    expect(instance).toBeInstanceOf(TurnManager);
    expect(typeof instance.start).toBe('function');
    expect(typeof instance.advanceTurn).toBe('function');
  });

  // Test 4: Verify resolving by the "initializableSystem" tag includes ITurnManager
  // (This tests if the tagging and resolution order allows ITurnManager to be tagged correctly)
  it('should resolve ITurnManager when resolving by tag "initializableSystem"', () => {
    let initializables = [];
    expect(() => {
      // Assuming 'initializableSystem' is the correct tag string from ../tags.js
      initializables = container.resolveByTag('initializableSystem');
    }).not.toThrow();

    // Check that the array contains at least one item
    expect(initializables.length).toBeGreaterThan(0);

    // Find the TurnManager instance within the resolved tagged instances
    const turnManagerInstance = initializables.find(
      (instance) => instance instanceof TurnManager
    );

    // Assert that a TurnManager instance was found
    expect(turnManagerInstance).toBeInstanceOf(TurnManager);
  });

  // Test 5: Verify ActionCategorizationService can be resolved
  describe('Container Configuration - Action Categorization', () => {
    it('should register action categorization services', () => {
      expect(container.isRegistered(tokens.IActionCategorizationService)).toBe(
        true
      );
    });

    it('should resolve action categorization services', () => {
      expect(() =>
        container.resolve(tokens.IActionCategorizationService)
      ).not.toThrow();
    });
  });

  // Performance validation tests
  describe('Performance Validation', () => {
    it('should complete container setup within threshold', () => {
      expect(setupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTAINER_SETUP_MS);
    });

    it('should resolve services quickly', () => {
      const monitor = createPerformanceMonitor();
      monitor.start();

      // Resolve several key services
      container.resolve(tokens.ICommandOutcomeInterpreter);
      container.resolve(tokens.ActorTurnHandler);
      container.resolve(tokens.ITurnManager);
      container.resolve(tokens.IActionCategorizationService);

      const duration = monitor.end();
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS);
    });
  });
});
