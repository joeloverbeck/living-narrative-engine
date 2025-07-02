import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('AnatomyInitializationService', () => {
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
      unsubscribe: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockAnatomyGenerationService = {
      generateAnatomyIfNeeded: jest.fn().mockResolvedValue(false),
    };

    // Create service instance
    service = new AnatomyInitializationService({
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
      anatomyGenerationService: mockAnatomyGenerationService,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw error if eventDispatcher is not provided', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            logger: mockLogger,
            anatomyGenerationService: mockAnatomyGenerationService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            eventDispatcher: mockEventDispatcher,
            anatomyGenerationService: mockAnatomyGenerationService,
          })
      ).toThrow(InvalidArgumentError);
    });

    it('should throw error if anatomyGenerationService is not provided', () => {
      expect(
        () =>
          new AnatomyInitializationService({
            eventDispatcher: mockEventDispatcher,
            logger: mockLogger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('initialize', () => {
    it('should register event listener on first initialization', () => {
      service.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: Registering event listeners'
      );
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Initialized'
      );
    });

    it('should warn and return early if already initialized', () => {
      service.initialize();

      // Clear previous calls
      mockLogger.warn.mockClear();
      mockEventDispatcher.subscribe.mockClear();

      // Initialize again
      service.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Already initialized'
      );
      expect(mockEventDispatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should bind event handler correctly', () => {
      service.initialize();

      expect(boundHandlerRef).toBeDefined();
      expect(typeof boundHandlerRef).toBe('function');
    });
  });

  describe('handleEntityCreated', () => {
    beforeEach(() => {
      service.initialize();
    });

    describe('EventBus wrapped format (event.payload)', () => {
      it('should handle event with nested payload structure', async () => {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
          true
        );

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-1',
            definitionId: 'def-1',
            wasReconstructed: false,
            entity: { id: 'entity-1' },
          },
        };

        await boundHandlerRef(event);

        expect(
          mockAnatomyGenerationService.generateAnatomyIfNeeded
        ).toHaveBeenCalledWith('entity-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          "AnatomyInitializationService: Generated anatomy for entity 'entity-1'"
        );
      });

      it('should skip reconstructed entities with nested payload', async () => {
        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-1',
            definitionId: 'def-1',
            wasReconstructed: true,
            entity: { id: 'entity-1' },
          },
        };

        await boundHandlerRef(event);

        expect(
          mockAnatomyGenerationService.generateAnatomyIfNeeded
        ).not.toHaveBeenCalled();
      });

      it('should warn when instanceId is missing in nested payload', async () => {
        const event = {
          type: 'core:entity_created',
          payload: {
            definitionId: 'def-1',
            wasReconstructed: false,
            entity: { id: 'entity-1' },
          },
        };

        await boundHandlerRef(event);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'AnatomyInitializationService: Entity created event missing instanceId'
        );
        expect(
          mockAnatomyGenerationService.generateAnatomyIfNeeded
        ).not.toHaveBeenCalled();
      });

      it('should handle errors gracefully with nested payload', async () => {
        const error = new Error('Generation failed');
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
          error
        );

        const event = {
          type: 'core:entity_created',
          payload: {
            instanceId: 'entity-1',
            definitionId: 'def-1',
            wasReconstructed: false,
            entity: { id: 'entity-1' },
          },
        };

        // Should not throw
        await expect(boundHandlerRef(event)).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
          "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1'",
          { error }
        );
      });
    });

    describe('Direct format (legacy/backwards compatibility)', () => {
      it('should skip reconstructed entities', async () => {
        const event = {
          instanceId: 'entity-1',
          definitionId: 'def-1',
          wasReconstructed: true,
        };

        await boundHandlerRef(event);

        expect(
          mockAnatomyGenerationService.generateAnatomyIfNeeded
        ).not.toHaveBeenCalled();
      });

      it('should generate anatomy for new entities', async () => {
        mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
          true
        );

        const event = {
          instanceId: 'entity-1',
          definitionId: 'def-1',
          wasReconstructed: false,
        };

        await boundHandlerRef(event);

        expect(
          mockAnatomyGenerationService.generateAnatomyIfNeeded
        ).toHaveBeenCalledWith('entity-1');
        expect(mockLogger.info).toHaveBeenCalledWith(
          "AnatomyInitializationService: Generated anatomy for entity 'entity-1'"
        );
      });
    });

    it('should not log if anatomy was not generated', async () => {
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        false
      );

      const event = {
        instanceId: 'entity-1',
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      await boundHandlerRef(event);

      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith('entity-1');
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Generated anatomy')
      );
    });

    it('should warn if instanceId is missing', async () => {
      const event = {
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      await boundHandlerRef(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Generation failed');
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        error
      );

      const event = {
        instanceId: 'entity-1',
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      // Should not throw
      await expect(boundHandlerRef(event)).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "AnatomyInitializationService: Failed to generate anatomy for entity 'entity-1'",
        { error }
      );
    });

    it('should handle null instanceId', async () => {
      const event = {
        instanceId: null,
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      await boundHandlerRef(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
    });

    it('should handle undefined instanceId', async () => {
      const event = {
        // instanceId is undefined
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      await boundHandlerRef(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
    });

    it('should handle empty string instanceId', async () => {
      const event = {
        instanceId: '',
        definitionId: 'def-1',
        wasReconstructed: false,
      };

      await boundHandlerRef(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
    });
  });

  describe('dispose', () => {
    it('should remove event listener when initialized', () => {
      service.initialize();

      service.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: Removing event listeners'
      );
      expect(mockUnsubscribeFn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Disposed'
      );
    });

    it('should do nothing if not initialized', () => {
      service.dispose();

      expect(mockUnsubscribeFn).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'AnatomyInitializationService: Removing event listeners'
      );
    });

    it('should allow re-initialization after disposal', () => {
      service.initialize();
      service.dispose();

      // Clear mocks
      mockEventDispatcher.subscribe.mockClear();
      mockLogger.info.mockClear();

      // Should be able to initialize again
      service.initialize();

      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Initialized'
      );
    });

    it('should handle multiple dispose calls', () => {
      service.initialize();
      service.dispose();

      // Clear mocks
      mockUnsubscribeFn.mockClear();
      mockLogger.info.mockClear();

      // Second dispose should do nothing
      service.dispose();

      expect(mockUnsubscribeFn).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid initialization and disposal', () => {
      // First cycle - create a new unsubscribe function for this cycle
      const firstUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValueOnce(firstUnsubscribe);

      service.initialize();
      service.dispose();

      // Second cycle - create another new unsubscribe function
      const secondUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockReturnValueOnce(secondUnsubscribe);

      service.initialize();
      service.dispose();

      expect(mockEventDispatcher.subscribe).toHaveBeenCalledTimes(2);
      expect(firstUnsubscribe).toHaveBeenCalled();
      expect(secondUnsubscribe).toHaveBeenCalled();
    });

    it('should maintain correct state through lifecycle', async () => {
      // Initialize
      service.initialize();
      expect(mockEventDispatcher.subscribe).toHaveBeenCalled();

      // Handle an event
      const event = {
        instanceId: 'entity-1',
        definitionId: 'def-1',
        wasReconstructed: false,
      };
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );
      await boundHandlerRef(event);
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalled();

      // Dispose
      service.dispose();
      expect(mockUnsubscribeFn).toHaveBeenCalled();

      // Clear mocks
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockClear();

      // After disposal, the unsubscribe function should have been called
      // which would remove the handler from the event dispatcher
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });
  });
});
