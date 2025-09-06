import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyInitializationService - Full Coverage', () => {
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

  describe('generateAnatomy method', () => {
    it('should successfully generate anatomy with blueprint', async () => {
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      const result = await service.generateAnatomy('entity-1', 'blueprint-1');

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity 'entity-1' with blueprint 'blueprint-1'`
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Successfully generated anatomy for entity 'entity-1' with blueprint 'blueprint-1'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith('entity-1');
    });

    it('should return false when anatomy generation is not needed', async () => {
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        false
      );

      const result = await service.generateAnatomy('entity-1', 'blueprint-1');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity 'entity-1' with blueprint 'blueprint-1'`
      );
      // Should NOT log success when wasGenerated is false
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated anatomy')
      );
    });

    it('should propagate errors when generation fails', async () => {
      const testError = new Error('Generation failed');
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        testError
      );

      await expect(
        service.generateAnatomy('entity-1', 'blueprint-1')
      ).rejects.toThrow('Generation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1' with blueprint 'blueprint-1'`,
        { error: testError }
      );
    });
  });

  describe('waitForEntityGeneration method', () => {
    it('should return false immediately when entity is not pending', async () => {
      const result = await service.waitForEntityGeneration('entity-1');
      expect(result).toBe(false);
    });

    it('should wait for specific entity generation to complete successfully', async () => {
      // Setup a generation that will complete
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          })
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Start waiting for this specific entity
      const waitPromise = service.waitForEntityGeneration('entity-1');

      // Complete the generation
      resolveGeneration(true);

      // Wait should resolve with true
      const result = await waitPromise;
      expect(result).toBe(true);
    });

    it('should handle timeout when waiting for entity generation', async () => {
      // Setup a generation that never completes
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Wait with short timeout
      await expect(
        service.waitForEntityGeneration('entity-1', 100)
      ).rejects.toThrow(
        `AnatomyInitializationService: Timeout waiting for anatomy generation for entity 'entity-1'`
      );
    });

    it('should handle generation failure when waiting for specific entity', async () => {
      // Setup a generation that will fail
      let rejectGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            rejectGeneration = reject;
          })
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Start waiting for this specific entity
      const waitPromise = service.waitForEntityGeneration('entity-1');

      // Make the generation fail
      const testError = new Error('Generation failed');
      rejectGeneration(testError);

      // Wait should reject with the error
      await expect(waitPromise).rejects.toThrow('Generation failed');
    });

    it('should handle multiple waiters for the same entity', async () => {
      // Setup a generation that will complete
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          })
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Multiple waiters for the same entity
      const wait1 = service.waitForEntityGeneration('entity-1');
      const wait2 = service.waitForEntityGeneration('entity-1');
      const wait3 = service.waitForEntityGeneration('entity-1');

      // Complete the generation
      resolveGeneration(true);

      // All waiters should resolve with true
      const results = await Promise.all([wait1, wait2, wait3]);
      expect(results).toEqual([true, true, true]);
    });
  });

  describe('hasPendingGenerations method', () => {
    it('should return false when no generations are pending', () => {
      expect(service.hasPendingGenerations()).toBe(false);
    });

    it('should return true when entities are in the queue', () => {
      // Add an entity to the queue (but don't let it process)
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      expect(service.hasPendingGenerations()).toBe(true);
    });

    it('should return true when entities are being processed', async () => {
      // Setup a generation that we can control
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          })
      );

      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Should have pending generations
      expect(service.hasPendingGenerations()).toBe(true);

      // Complete the generation
      resolveGeneration(true);

      // Wait for completion
      await service.waitForAllGenerationsToComplete();

      // Now should have no pending generations
      expect(service.hasPendingGenerations()).toBe(false);
    });
  });

  describe('queue processing concurrency', () => {
    it('should handle concurrent calls to processQueue (line 118 coverage)', async () => {
      // This test ensures the early return in processQueue is hit
      // when multiple entity creation events trigger queue processing

      // Use fast resolving promises
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      // Trigger multiple entity creations rapidly
      const event1 = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      const event2 = {
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      };
      const event3 = {
        payload: { instanceId: 'entity-3', wasReconstructed: false },
      };

      // Fire events synchronously - they'll all try to start processing
      boundHandlerRef(event1);
      boundHandlerRef(event2);
      boundHandlerRef(event3);

      // Should have items in queue/processing
      expect(service.getPendingGenerationCount()).toBeGreaterThan(0);

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
      expect(service.getPendingGenerationCount()).toBe(0);
    });

    it('should process queue sequentially even with rapid additions', async () => {
      // Track the order of processing
      const processingOrder = [];

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        (entityId) => {
          processingOrder.push(entityId);
          return Promise.resolve(true);
        }
      );

      // Add multiple entities rapidly
      for (let i = 1; i <= 5; i++) {
        boundHandlerRef({
          payload: { instanceId: `entity-${i}`, wasReconstructed: false },
        });
      }

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      // Verify sequential processing
      expect(processingOrder).toEqual([
        'entity-1',
        'entity-2',
        'entity-3',
        'entity-4',
        'entity-5',
      ]);
    });
  });

  describe('promise management edge cases', () => {
    it('should handle resolve when no promises are waiting', async () => {
      // This covers the case where resolveGenerationPromise is called
      // but no one is waiting for that specific entity

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      // Trigger generation without anyone waiting
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Wait for completion
      await service.waitForAllGenerationsToComplete();

      // Should complete without errors
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
    });

    it('should handle reject when no promises are waiting', async () => {
      // This covers the case where rejectGenerationPromise is called
      // but no one is waiting for that specific entity

      const testError = new Error('Generation failed');
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        testError
      );

      // Trigger generation without anyone waiting
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Wait for completion (error is caught internally)
      await service.waitForAllGenerationsToComplete();

      // Should log error but not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1'`,
        { error: testError }
      );
    });

    it('should clean up promise map after resolution', async () => {
      // Setup controllable generation
      let resolveGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGeneration = resolve;
          })
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Start waiting
      const waitPromise = service.waitForEntityGeneration('entity-1');

      // Complete generation
      resolveGeneration(false);

      // Wait should resolve
      const result = await waitPromise;
      expect(result).toBe(false);

      // Trying to wait again should return false immediately
      // (entity is no longer pending)
      const secondWait = await service.waitForEntityGeneration('entity-1');
      expect(secondWait).toBe(false);
    });

    it('should clean up promise map after rejection', async () => {
      // Setup controllable generation
      let rejectGeneration;
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            rejectGeneration = reject;
          })
      );

      // Trigger generation
      const event = {
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      };
      boundHandlerRef(event);

      // Start waiting
      const waitPromise = service.waitForEntityGeneration('entity-1');

      // Fail generation
      rejectGeneration(new Error('Test error'));

      // Wait should reject
      await expect(waitPromise).rejects.toThrow('Test error');

      // Trying to wait again should return false immediately
      // (entity is no longer pending)
      const secondWait = await service.waitForEntityGeneration('entity-1');
      expect(secondWait).toBe(false);
    });
  });

  describe('complex integration scenarios', () => {
    it('should handle mixed entity generation scenarios', async () => {
      // Some succeed, some fail, some timeout
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true) // entity-1 succeeds
        .mockRejectedValueOnce(new Error('Failed')) // entity-2 fails
        .mockResolvedValueOnce(false); // entity-3 returns false

      // Trigger three generations
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });
      boundHandlerRef({
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      });
      boundHandlerRef({
        payload: { instanceId: 'entity-3', wasReconstructed: false },
      });

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      // Verify appropriate logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity-2'`,
        expect.any(Object)
      );
      // entity-3 should not log info (returned false)
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('entity-3')
      );
    });

    it('should handle entity generation added while processing', async () => {
      // Use fast resolving promises to avoid timeout
      mockAnatomyGenerationService.generateAnatomyIfNeeded
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      // Start first generation
      boundHandlerRef({
        payload: { instanceId: 'entity-1', wasReconstructed: false },
      });

      // While first is processing, add another
      boundHandlerRef({
        payload: { instanceId: 'entity-2', wasReconstructed: false },
      });

      expect(service.getPendingGenerationCount()).toBeGreaterThan(0);

      // Add another
      boundHandlerRef({
        payload: { instanceId: 'entity-3', wasReconstructed: false },
      });

      // Wait for all to complete
      await service.waitForAllGenerationsToComplete();

      expect(service.getPendingGenerationCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity-1'`
      );
    });
  });
});