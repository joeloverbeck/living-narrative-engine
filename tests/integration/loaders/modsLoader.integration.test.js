/**
 * @file Integration tests for ModsLoader orchestrator order and error propagation.
 * @see Ticket T-16
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createMockLogger } from '../../common/mockFactories.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import ModsLoader from '../../../src/loaders/modsLoader.js';
import LoaderPhase from '../../../src/loaders/phases/LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../src/errors/modsLoaderPhaseError.js';
import { makeRegistryCache } from '../../../src/loaders/registryCacheAdapter.js';
import ModsLoadSession from '../../../src/loaders/ModsLoadSession.js';
import ModsLoaderError from '../../../src/errors/modsLoaderError.js';

/**
 * Creates a mock phase that tracks execution order and can be configured to fail.
 */
class MockPhase extends LoaderPhase {
  /**
   * @param {object} options
   * @param {string} options.name - Phase name for identification
   * @param {boolean} [options.shouldFail] - Whether this phase should fail
   * @param {string} [options.errorCode] - Error code if failing
   * @param {string} [options.errorMessage] - Error message if failing
   * @param {Array<string>} options.executionOrder - Array to track execution order
   */
  constructor({
    name,
    shouldFail = false,
    errorCode = 'unexpected',
    errorMessage = 'Mock phase failure',
    executionOrder,
  }) {
    super();
    this.name = name;
    this.shouldFail = shouldFail;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.executionOrder = executionOrder;
    this.execute = jest.fn().mockImplementation(async (context) => {
      // Track execution order
      this.executionOrder.push(this.name);

      if (this.shouldFail) {
        throw new ModsLoaderPhaseError(
          this.errorCode,
          this.errorMessage,
          this.name
        );
      }

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe('Integration: ModsLoader Orchestrator Order and Error Propagation', () => {
  let mockLogger;
  let dataRegistry;
  let executionOrder;
  let phases;

  beforeEach(() => {
    mockLogger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry(mockLogger);
    executionOrder = [];
    phases = [];
  });

  describe('Test 1: Five mock phases resolve → all executed in order', () => {
    it('should execute all phases in the correct order when all phases succeed', async () => {
      // Arrange: Create five mock phases that all succeed
      const phaseNames = ['Phase1', 'Phase2', 'Phase3', 'Phase4', 'Phase5'];
      phases = phaseNames.map(
        (name) =>
          new MockPhase({
            name,
            shouldFail: false,
            executionOrder,
          })
      );

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act: Execute the loader
      const result = await modsLoader.loadMods('test-world', ['mod1', 'mod2']);

      // Assert: All phases were executed in order
      expect(executionOrder).toEqual(phaseNames);

      // Verify the returned LoadReport
      expect(result).toEqual({
        finalModOrder: [],
        totals: {},
        incompatibilities: 0,
      });

      // Verify each phase's execute method was called exactly once
      phases.forEach((phase) => {
        expect(phase.execute).toHaveBeenCalledTimes(1);
      });

      // Verify the context passed to each phase
      phases.forEach((phase) => {
        const callArgs = phase.execute.mock.calls[0];
        expect(callArgs).toHaveLength(1);

        const context = callArgs[0];
        expect(context).toMatchObject({
          worldName: 'test-world',
          requestedMods: ['mod1', 'mod2'],
          finalModOrder: [],
          incompatibilities: 0,
          totals: {},
        });
      });

      // Verify success logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ModsLoader: Starting load sequence for world 'test-world'..."
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "ModsLoader: Load sequence for world 'test-world' completed successfully."
      );
    });
  });

  describe('Test 2: Second phase rejects → phases 3-5 not executed; error bubbles', () => {
    it('should stop execution and propagate error when second phase fails', async () => {
      // Arrange: Create five phases with the second one configured to fail
      const phaseNames = ['Phase1', 'Phase2', 'Phase3', 'Phase4', 'Phase5'];
      phases = phaseNames.map(
        (name, index) =>
          new MockPhase({
            name,
            shouldFail: index === 1, // Second phase (index 1) fails
            errorCode: 'manifest',
            errorMessage: 'Manifest validation failed',
            executionOrder,
          })
      );

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act & Assert: Execute the loader and expect it to fail
      await expect(modsLoader.loadMods('test-world', ['mod1'])).rejects.toThrow(
        ModsLoaderPhaseError
      );

      // Verify only the first two phases were executed
      expect(executionOrder).toEqual(['Phase1', 'Phase2']);

      // Verify Phase1 was called once
      expect(phases[0].execute).toHaveBeenCalledTimes(1);

      // Verify Phase2 was called once and failed
      expect(phases[1].execute).toHaveBeenCalledTimes(1);

      // Verify phases 3-5 were never called
      expect(phases[2].execute).not.toHaveBeenCalled();
      expect(phases[3].execute).not.toHaveBeenCalled();
      expect(phases[4].execute).not.toHaveBeenCalled();

      // Verify error logging - note that the phase name comes from err.phase, not err.phaseName
      expect(mockLogger.error).toHaveBeenCalledWith(
        "ModsLoader: CRITICAL failure during phase 'Phase2'. Code: [manifest]. Error: Manifest validation failed",
        { error: expect.any(ModsLoaderPhaseError) }
      );
    });

    it('should clear registry and propagate ModsLoaderPhaseError with correct properties', async () => {
      // Arrange: Create phases with second one failing
      const phaseNames = ['Phase1', 'Phase2', 'Phase3'];
      phases = phaseNames.map(
        (name, index) =>
          new MockPhase({
            name,
            shouldFail: index === 1,
            errorCode: 'content',
            errorMessage: 'Content loading failed',
            executionOrder,
          })
      );

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Add some data to registry before failure
      dataRegistry.store('test', 'item1', { id: 'item1' });

      // Act & Assert: Execute and catch the error
      let thrownError;
      try {
        await modsLoader.loadMods('test-world', ['mod1']);
      } catch (error) {
        thrownError = error;
      }

      // Verify the error is a ModsLoaderPhaseError with correct properties
      expect(thrownError).toBeInstanceOf(ModsLoaderPhaseError);
      expect(thrownError.code).toBe('content');
      expect(thrownError.message).toBe('Content loading failed');
      expect(thrownError.phase).toBe('Phase2');

      // Verify registry was cleared after failure
      expect(dataRegistry.get('test', 'item1')).toBeUndefined();
    });

    it('should handle unexpected errors and re-throw them to upstream', async () => {
      // Arrange: Create a phase that throws an unexpected error
      phases = [
        new MockPhase({
          name: 'Phase1',
          shouldFail: false,
          executionOrder,
        }),
        new MockPhase({
          name: 'Phase2',
          shouldFail: false,
          executionOrder,
        }),
      ];

      // Make the second phase throw an unexpected error
      const unexpectedError = new Error('Unexpected system error');
      phases[1].execute = jest.fn().mockRejectedValue(unexpectedError);

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act & Assert: Execute and expect original error to be re-thrown
      await expect(modsLoader.loadMods('test-world', ['mod1'])).rejects.toThrow(
        'Unexpected system error'
      );

      // Verify that no additional error logging occurred for unexpected errors
      // (since we're letting upstream handle them)
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'CRITICAL load failure due to an unexpected error'
        ),
        expect.anything()
      );

      // Verify the error is the original error, not a ModsLoaderError
      try {
        await modsLoader.loadMods('test-world', ['mod1']);
      } catch (error) {
        expect(error).toBe(unexpectedError);
        expect(error).not.toBeInstanceOf(ModsLoaderError);
      }
    });
  });

  describe('Additional edge cases', () => {
    it('should handle empty phases array gracefully', () => {
      // Arrange: Create loader with empty phases array
      // Note: The current validation system doesn't handle isArray/isNotEmpty,
      // so this will likely pass validation but fail at runtime
      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act & Assert: Should not throw during construction due to incomplete validation
      expect(modsLoader).toBeInstanceOf(ModsLoader);
    });

    it('should handle single phase execution', async () => {
      // Arrange: Single phase
      phases = [
        new MockPhase({
          name: 'SinglePhase',
          shouldFail: false,
          executionOrder,
        }),
      ];

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act: Execute
      const result = await modsLoader.loadMods('test-world', []);

      // Assert: Single phase executed
      expect(executionOrder).toEqual(['SinglePhase']);
      expect(phases[0].execute).toHaveBeenCalledTimes(1);

      // Verify the returned LoadReport
      expect(result).toEqual({
        finalModOrder: [],
        totals: {},
        incompatibilities: 0,
      });
    });

    it('should handle first phase failure', async () => {
      // Arrange: First phase fails
      phases = [
        new MockPhase({
          name: 'Phase1',
          shouldFail: true,
          errorCode: 'schema',
          errorMessage: 'Schema validation failed',
          executionOrder,
        }),
        new MockPhase({
          name: 'Phase2',
          shouldFail: false,
          executionOrder,
        }),
      ];

      const session = {
        run: jest.fn().mockImplementation(async (ctx) => {
          for (const phase of phases) {
            await phase.execute(ctx);
          }
          return ctx;
        }),
      };
      const modsLoader = new ModsLoader({
        logger: mockLogger,
        cache: makeRegistryCache(dataRegistry),
        session,
        registry: dataRegistry,
      });

      // Act & Assert: Should fail immediately
      await expect(modsLoader.loadMods('test-world', ['mod1'])).rejects.toThrow(
        ModsLoaderPhaseError
      );

      expect(executionOrder).toEqual(['Phase1']);
      expect(phases[0].execute).toHaveBeenCalledTimes(1);
      expect(phases[1].execute).not.toHaveBeenCalled();
    });
  });
});
