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
        'AnatomyInitializationService: All anatomy generations completed'
      );
    });

    it('should wait for single pending generation to complete', async () => {
      // Mock generation that resolves quickly
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      const event = {
        payload: {
          instanceId: 'entity-1',
          wasReconstructed: false,
        },
      };

      // Trigger generation (adds to queue)
      boundHandlerRef(event);

      // Should have one pending generation in queue
      expect(service.getPendingGenerationCount()).toBe(1);

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should wait for multiple pending generations', async () => {
      // Mock generations that resolve sequentially
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      // Trigger two generations
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };

      boundHandlerRef(event1);
      boundHandlerRef(event2);

      // Both should be in queue
      expect(service.getPendingGenerationCount()).toBe(2);

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
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
      ).rejects.toThrow(/Timeout waiting for anatomy generation to complete/);

      // The new implementation throws with queue and pending info in the message
      // No error logging is done in waitForAllGenerationsToComplete
    });

    it('should handle mixed success and failure of generations', async () => {
      // Mock one success and one failure
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Generation failed'));

      // Trigger two generations
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };

      boundHandlerRef(event1);
      boundHandlerRef(event2);

      // Should complete without throwing (errors are caught internally)
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity-2'`,
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle generation completing during wait', async () => {
      // Mock generation that resolves
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };

      // Trigger generation
      boundHandlerRef(event);

      // Wait for completion
      await service.waitForAllGenerationsToComplete();

      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should log correct message when waiting for multiple generations', async () => {
      // Mock 3 generations
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      // Trigger generations
      for (let i = 1; i <= 3; i++) {
        boundHandlerRef({
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        });
      }

      expect(service.getPendingGenerationCount()).toBe(3);

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
      );
    });
  });

  describe('getPendingGenerationCount', () => {
    it('should return 0 when no generations are pending', () => {
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should track pending generation count accurately', async () => {
      // Mock generations
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

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

      // Wait for all to complete (they process sequentially)
      await service.waitForAllGenerationsToComplete();
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('destroy with pending operations', () => {
    it('should clean up pending operations when destroyed', async () => {
      // Create a generation that won't complete immediately
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      expect(service.getPendingGenerationCount()).toBe(1);

      // Destroy before the generation completes
      service.destroy();

      // Verify cleanup
      expect(service.getPendingGenerationCount()).toBe(0);
    });
    it('should clear all pending generations when destroyed', async () => {
      // Create multiple pending generations that won't complete
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves

      // Trigger generations
      for (let i = 1; i <= 3; i++) {
        const event = {
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        };
        boundHandlerRef(event);
      }

      expect(service.getPendingGenerationCount()).toBe(3);

      // Destroy the service - this should clean up pending generations
      service.destroy();

      // The destroy method should have cleared all pending generations
      expect(service.getPendingGenerationCount()).toBe(0);

      // Verify that trying to wait after destruction returns immediately
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
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
      service.destroy();

      // Pending count should be 0 after disposal
      expect(service.getPendingGenerationCount()).toBe(0);

      // Verify the internal state was cleaned up properly
      await service.waitForAllGenerationsToComplete();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: All anatomy generations completed'
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
      service.destroy();

      // Verify state was cleaned up
      expect(service.getPendingGenerationCount()).toBe(0);

      // Reinitialize
      service.initialize();

      // Should work normally again
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );
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

      // Trigger the generation that will fail
      boundHandlerRef(event);

      // Wait should complete successfully (errors are caught internally)
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1'`,
        { error: testError }
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should properly clean up after rejection', async () => {
      const testError = new Error('Test error');
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        testError
      );

      // Trigger generation
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      // Wait for completion
      await service.waitForAllGenerationsToComplete();

      // Verify no pending generations remain
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent entity creation events', async () => {
      // Mock 5 generations
      for (let i = 0; i < 5; i++) {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValueOnce(
          true
        );
      }

      // Trigger all events (they'll be queued)
      for (let i = 1; i <= 5; i++) {
        boundHandlerRef({
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        });
      }

      expect(service.getPendingGenerationCount()).toBe(5);

      // Wait for all to complete (processed sequentially)
      await service.waitForAllGenerationsToComplete();

      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should handle multiple different entities being created', async () => {
      // Mock two generations
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

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

      await service.waitForAllGenerationsToComplete();
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should handle waitForAllGenerationsToComplete called multiple times', async () => {
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      // Multiple wait calls
      const wait1 = service.waitForAllGenerationsToComplete();
      const wait2 = service.waitForAllGenerationsToComplete();
      const wait3 = service.waitForAllGenerationsToComplete();

      // All should resolve
      await Promise.all([wait1, wait2, wait3]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });
  });
});
