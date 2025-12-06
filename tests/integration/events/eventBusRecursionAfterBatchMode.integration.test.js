/**
 * @file Integration test for EventBus recursion depth management after batch mode
 * @description Verifies that recursion depth counters reset properly when transitioning
 * from batch mode (game initialization) to normal gameplay mode, preventing false
 * positive recursion errors during regular game operations.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import EventBus from '../../../src/events/eventBus.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

describe('EventBus Recursion Management After Batch Mode - Integration', () => {
  let bus;
  let mockLogger;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mockLogger = createLogger();
    bus = new EventBus({ logger: mockLogger });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Game Initialization to Normal Gameplay Transition', () => {
    it('should not trigger recursion errors in normal gameplay after batch initialization', async () => {
      // Phase 1: Simulate game initialization with batch mode
      bus.setBatchMode(true, {
        context: 'game-initialization',
        maxRecursionDepth: 200,
        maxGlobalRecursion: 300,
        timeoutMs: 30000,
      });

      // Simulate entity creation cascades during initialization
      // This represents creating multiple characters with anatomy systems
      const entityCreationHandler = jest.fn();
      bus.subscribe('core:entity_created', entityCreationHandler);

      const componentAddHandler = jest.fn();
      bus.subscribe('core:component_added', componentAddHandler);

      // Create 3 "characters" with 50 anatomy parts each (150 component adds total)
      for (let charIdx = 0; charIdx < 3; charIdx++) {
        await bus.dispatch('core:entity_created', {
          entityId: `character-${charIdx}`,
        });

        // Each character triggers 50 component additions for anatomy parts
        for (let partIdx = 0; partIdx < 50; partIdx++) {
          await bus.dispatch('core:component_added', {
            entityId: `character-${charIdx}`,
            componentTypeId: `anatomy:part-${partIdx}`,
            componentData: { value: partIdx },
          });
        }
      }

      // Verify initialization completed without errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(entityCreationHandler).toHaveBeenCalledTimes(3);
      expect(componentAddHandler).toHaveBeenCalledTimes(150);

      // Phase 2: Exit batch mode (simulates initialization completion)
      bus.setBatchMode(false);

      // Verify counters were reset
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Recursion depth counters reset')
      );

      // Phase 3: Normal gameplay - turn system operations
      // Clear handlers and set up turn-based handlers
      bus.unsubscribe('core:entity_created', entityCreationHandler);
      bus.unsubscribe('core:component_added', componentAddHandler);

      const turnStartHandler = jest.fn();
      const turnEndHandler = jest.fn();
      const currentActorAddHandler = jest.fn();

      bus.subscribe('core:turn_started', turnStartHandler);
      bus.subscribe('core:turn_ended', turnEndHandler);
      bus.subscribe('core:component_added', currentActorAddHandler);

      // Simulate 10 turn cycles (as would happen in normal gameplay)
      for (let turn = 0; turn < 10; turn++) {
        const actorId = `character-${turn % 3}`;

        // Turn started
        await bus.dispatch('core:turn_started', { entityId: actorId });

        // Add current_actor component (this is what was failing in production)
        await bus.dispatch('core:component_added', {
          entityId: actorId,
          componentTypeId: 'core:current_actor',
          componentData: {},
        });

        // Turn ended
        await bus.dispatch('core:turn_ended', { entityId: actorId });
      }

      // Verify normal gameplay completed without recursion errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      expect(turnStartHandler).toHaveBeenCalledTimes(10);
      expect(turnEndHandler).toHaveBeenCalledTimes(10);
      expect(currentActorAddHandler).toHaveBeenCalledTimes(10);
    });

    it('should handle multiple batch mode cycles without accumulating depth', async () => {
      // Cycle 1: First initialization
      bus.setBatchMode(true, {
        context: 'first-load',
        maxRecursionDepth: 200,
        timeoutMs: 30000,
      });

      const handler = jest.fn();
      bus.subscribe('core:component_added', handler);

      // Create 50 component additions
      for (let i = 0; i < 50; i++) {
        await bus.dispatch('core:component_added', {
          entityId: 'entity-1',
          componentTypeId: `comp-${i}`,
        });
      }

      bus.setBatchMode(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      handler.mockClear();

      // Cycle 2: Second initialization (e.g., loading different world)
      bus.setBatchMode(true, {
        context: 'second-load',
        maxRecursionDepth: 200,
        timeoutMs: 30000,
      });

      // Create another 50 component additions
      for (let i = 0; i < 50; i++) {
        await bus.dispatch('core:component_added', {
          entityId: 'entity-2',
          componentTypeId: `comp-${i}`,
        });
      }

      bus.setBatchMode(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      handler.mockClear();

      // Normal gameplay phase
      await bus.dispatch('core:component_added', {
        entityId: 'player',
        componentTypeId: 'core:current_actor',
      });

      // Should work without errors despite two prior batch cycles
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Production-Like Scenario', () => {
    it('should replicate production error scenario and verify fix', async () => {
      // This test replicates the exact scenario from the production logs:
      // 1. Game initialization with anatomy generation
      // 2. Batch mode ends
      // 3. First turn starts and adds current_actor component
      // 4. Should NOT trigger recursion depth error

      // Enable batch mode for game initialization
      bus.setBatchMode(true, {
        context: 'game-initialization',
        maxRecursionDepth: 200,
        maxGlobalRecursion: 300,
        timeoutMs: 30000,
      });

      const componentHandler = jest.fn();
      bus.subscribe('core:component_added', componentHandler);

      // Simulate anatomy generation for 3 characters (49 parts each as in logs)
      // This builds up recursion depth to ~150
      for (let charIdx = 0; charIdx < 3; charIdx++) {
        for (let partIdx = 0; partIdx < 49; partIdx++) {
          await bus.dispatch('core:component_added', {
            entityId: `actor-${charIdx}`,
            componentTypeId: `anatomy:part-${partIdx}`,
            componentData: {},
          });
        }
      }

      // At this point, we've dispatched 147 component_added events in batch mode
      expect(componentHandler).toHaveBeenCalledTimes(147);

      // In batch mode with maxRecursionDepth=200, warnings appear at depths 100, 150, 180
      // Since we're dispatching concurrently (not nested), we shouldn't hit those thresholds
      // The key point is that these events succeeded without errors in batch mode

      // Exit batch mode (this is where the fix happens - counters reset)
      bus.setBatchMode(false);

      // Verify reset occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('game-initialization')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Recursion depth counters reset')
      );

      // Clear for normal gameplay phase
      componentHandler.mockClear();
      consoleErrorSpy.mockClear();
      consoleWarnSpy.mockClear();

      // Now simulate the exact operation that was failing:
      // Adding current_actor component on first turn
      await bus.dispatch('core:component_added', {
        entityId: 'p_erotica:markel_aguirre_instance',
        componentTypeId: 'core:current_actor',
        componentData: {},
      });

      // This should succeed WITHOUT the "Maximum recursion depth (100) exceeded" error
      // that was occurring in production (because depth was at 110 from batch mode)
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(componentHandler).toHaveBeenCalledTimes(1);

      // Verify no recursion warnings either
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
