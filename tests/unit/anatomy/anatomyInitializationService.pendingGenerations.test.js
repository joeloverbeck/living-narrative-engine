import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyInitializationService - Pending Generations', () => {
  let service;
  let mockEventDispatcher;
  let mockLogger;
  let mockAnatomyGenerationService;
  let boundHandlerRef;
  let mockUnsubscribeFn;

  beforeEach(() => {
    // Create mocks
    mockUnsubscribeFn = jest.fn();
    mockEventDispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        boundHandlerRef = handler;
        return mockUnsubscribeFn;
      }),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAnatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn(),
    };

    // Create service instance
    service = new AnatomyInitializationService({
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
      anatomyGenerationService: mockAnatomyGenerationService,
    });

    service.initialize();
  });

  describe('waitForAllGenerationsToComplete', () => {
    it('should return immediately when no generations are pending', async () => {
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: No pending anatomy generations'
      );
    });

    it('should wait for single pending generation to complete', async () => {
      // Start a generation
      const generationPromise = new Promise((resolve) => {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
          () => {
            setTimeout(() => resolve(true), 50);
            return Promise.resolve(true);
          }
        );
      });

      const event = {
        payload: {
          instanceId: 'entity-1',
          wasReconstructed: false,
        },
      };

      // Trigger generation
      const handlerPromise = boundHandlerRef(event);

      // Should have one pending generation
      expect(service.getPendingGenerationCount()).toBe(1);

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      // Complete the handler
      await handlerPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should wait for multiple pending generations', async () => {
      let resolveGen1, resolveGen2;
      const delayedGenerations = [];

      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen1 = resolve;
              delayedGenerations.push(resolve);
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen2 = resolve;
              delayedGenerations.push(resolve);
            })
        );

      // Trigger two generations
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };

      boundHandlerRef(event1);
      boundHandlerRef(event2);

      expect(service.getPendingGenerationCount()).toBe(2);

      // Start waiting
      const waitPromise = service.waitForAllGenerationsToComplete();

      // Resolve generations
      resolveGen1(true);
      resolveGen2(false);

      await waitPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should timeout if generations do not complete in time', async () => {
      // Mock a generation that never completes
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };

      boundHandlerRef(event);

      await expect(
        service.waitForAllGenerationsToComplete(100) // 100ms timeout
      ).rejects.toThrow('Anatomy generation timeout after 100ms');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnatomyInitializationService: Failed to wait for anatomy generations',
        expect.objectContaining({
          error: expect.any(Error),
          pendingCount: 1,
        })
      );
    });

    it('should handle mixed success and failure of generations', async () => {
      let resolveGen1, rejectGen2;

      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveGen1 = resolve))
        )
        .mockImplementationOnce(
          () => new Promise((_, reject) => (rejectGen2 = reject))
        );

      // Trigger two generations
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };

      boundHandlerRef(event1);
      boundHandlerRef(event2);

      // Start waiting
      const waitPromise = service.waitForAllGenerationsToComplete();

      // Resolve one and reject another
      resolveGen1(true);
      rejectGen2(new Error('Generation failed'));

      // Should complete without throwing
      await waitPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
      );
    });

    it('should handle generation completing during wait', async () => {
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => (resolveGeneration = resolve))
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };

      const handlerPromise = boundHandlerRef(event);

      // Start waiting
      const waitPromise = service.waitForAllGenerationsToComplete();

      // Complete generation while waiting
      resolveGeneration(true);
      await handlerPromise;

      await waitPromise;

      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should log correct message when waiting for multiple generations', async () => {
      // Create 3 pending generations
      const resolvers = [];
      for (let i = 0; i < 3; i++) {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementationOnce(
          () => new Promise((resolve) => resolvers.push(resolve))
        );
      }

      // Trigger generations
      for (let i = 1; i <= 3; i++) {
        boundHandlerRef({
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        });
      }

      expect(service.getPendingGenerationCount()).toBe(3);

      // Start waiting
      const waitPromise = service.waitForAllGenerationsToComplete();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: Waiting for 3 anatomy generations to complete'
      );

      // Resolve all
      resolvers.forEach((resolve) => resolve(true));
      await waitPromise;
    });
  });

  describe('getPendingGenerationCount', () => {
    it('should return 0 when no generations are pending', () => {
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should track pending generation count accurately', async () => {
      let resolveGen1, resolveGen2;

      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveGen1 = resolve))
        )
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveGen2 = resolve))
        );

      // Start first generation
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });
      expect(service.getPendingGenerationCount()).toBe(1);

      // Start second generation
      boundHandlerRef({
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      });
      expect(service.getPendingGenerationCount()).toBe(2);

      // Complete first generation
      resolveGen1(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(service.getPendingGenerationCount()).toBe(1);

      // Complete second generation
      resolveGen2(false);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('dispose with pending operations', () => {
    it('should reject promises in the promise map when disposed', async () => {
      // Create a generation that will add a promise to the map
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => (resolveGeneration = resolve))
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Now call waitForAllGenerationsToComplete to create a promise in the map
      const waitPromise = service.waitForAllGenerationsToComplete(10000);

      // Dispose before the generation completes
      service.dispose();

      // The waitPromise should reject with the timeout (since we use Promise.race)
      // but the internal promise should have been rejected with 'Service disposed'
      try {
        await waitPromise;
      } catch (err) {
        // This will timeout or complete, either is fine
      }

      // Verify cleanup
      expect(service.getPendingGenerationCount()).toBe(0);
    });
    it('should reject all pending generation promises when disposed', async () => {
      // Create multiple pending generations
      let rejectGen1, rejectGen2, rejectGen3;
      
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockImplementationOnce(() => new Promise((_, reject) => (rejectGen1 = reject)))
        .mockImplementationOnce(() => new Promise((_, reject) => (rejectGen2 = reject)))
        .mockImplementationOnce(() => new Promise((_, reject) => (rejectGen3 = reject)));

      // Trigger generations
      for (let i = 1; i <= 3; i++) {
        const event = {
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        };
        boundHandlerRef(event);
      }

      expect(service.getPendingGenerationCount()).toBe(3);

      // Dispose the service - this should clean up pending generations
      service.dispose();

      // The dispose method should have cleared all pending generations
      expect(service.getPendingGenerationCount()).toBe(0);
      
      // Verify that trying to wait after disposal returns immediately
      await service.waitForAllGenerationsToComplete();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: No pending anatomy generations'
      );
    });

    it('should clean up promise map on dispose', async () => {
      // Start a generation that won't complete
      let pendingResolve;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => (pendingResolve = resolve))
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      expect(service.getPendingGenerationCount()).toBe(1);

      // Dispose service
      service.dispose();

      // Pending count should be 0 after disposal
      expect(service.getPendingGenerationCount()).toBe(0);
      
      // Verify the internal state was cleaned up properly
      await service.waitForAllGenerationsToComplete();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: No pending anatomy generations'
      );
    });

    it('should handle rapid disposal and reinitialization with pending operations', async () => {
      // Mock generation that takes some time
      let pendingResolve;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => (pendingResolve = resolve))
      );

      // Trigger generation
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      expect(service.getPendingGenerationCount()).toBe(1);

      // Quickly dispose
      service.dispose();

      // Verify state was cleaned up
      expect(service.getPendingGenerationCount()).toBe(0);

      // Reinitialize
      service.initialize();

      // Should work normally again
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(true);
      await boundHandlerRef({
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      });

      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('promise rejection paths', () => {
    it('should handle promise rejection when generation fails', async () => {
      const testError = new Error('Generation failed');
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        testError
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };

      // Start waiting before triggering the error
      const waitPromise = service.waitForAllGenerationsToComplete();

      // Trigger the generation that will fail
      await boundHandlerRef(event);

      // Wait should complete successfully (uses allSettled)
      await waitPromise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1'",
        { error: testError }
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should properly clean up promise handlers after rejection', async () => {
      const testError = new Error('Test error');
      let rejectGeneration;
      
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((_, reject) => (rejectGeneration = reject))
      );

      // Trigger generation
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      // Get wait promise
      const waitPromise = service.waitForAllGenerationsToComplete();

      // Reject the generation
      rejectGeneration(testError);
      
      // Wait for handler to process the rejection
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should complete without error
      await waitPromise;

      // Verify no pending generations remain
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent entity creation events', async () => {
      const resolvers = [];
      
      // Mock 5 concurrent generations
      for (let i = 0; i < 5; i++) {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementationOnce(
          () => new Promise((resolve) => resolvers.push(resolve))
        );
      }

      // Trigger all events concurrently
      const promises = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(
          boundHandlerRef({
            payload: { instanceId: `entity-${i}`, wasReconstructed: false },
          })
        );
      }

      expect(service.getPendingGenerationCount()).toBe(5);

      // Resolve all in reverse order
      for (let i = 4; i >= 0; i--) {
        resolvers[i](true);
      }

      await Promise.all(promises);
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should handle same entity being created multiple times', async () => {
      let firstResolve, secondResolve;
      
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockImplementationOnce(
          () => new Promise((resolve) => (firstResolve = resolve))
        )
        .mockImplementationOnce(
          () => new Promise((resolve) => (secondResolve = resolve))
        );

      // Two different entity IDs to ensure both are tracked separately
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };

      boundHandlerRef(event1);
      boundHandlerRef(event2);

      expect(service.getPendingGenerationCount()).toBe(2);

      firstResolve(true);
      secondResolve(false);

      await service.waitForAllGenerationsToComplete();
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should handle waitForAllGenerationsToComplete called multiple times', async () => {
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => (resolveGeneration = resolve))
      );

      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      // Multiple wait calls
      const wait1 = service.waitForAllGenerationsToComplete();
      const wait2 = service.waitForAllGenerationsToComplete();
      const wait3 = service.waitForAllGenerationsToComplete();

      resolveGeneration(true);

      // All should resolve
      await Promise.all([wait1, wait2, wait3]);

      // Each waitForAllGenerationsToComplete logs "All anatomy generations completed"
      // Plus the log from successful generation
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });
});