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

  beforeEach(() => {
    // Create mocks
    mockEventDispatcher = {
      on: jest.fn((eventId, handler) => {
        boundHandlerRef = handler;
      }),
      off: jest.fn(),
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
      expect(mockEventDispatcher.on).toHaveBeenCalledWith(
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
      mockEventDispatcher.on.mockClear();

      // Initialize again
      service.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Already initialized'
      );
      expect(mockEventDispatcher.on).not.toHaveBeenCalled();
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
      const handler = boundHandlerRef;

      service.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'AnatomyInitializationService: Removing event listeners'
      );
      expect(mockEventDispatcher.off).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Disposed'
      );
    });

    it('should do nothing if not initialized', () => {
      service.dispose();

      expect(mockEventDispatcher.off).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'AnatomyInitializationService: Removing event listeners'
      );
    });

    it('should allow re-initialization after disposal', () => {
      service.initialize();
      service.dispose();

      // Clear mocks
      mockEventDispatcher.on.mockClear();
      mockLogger.info.mockClear();

      // Should be able to initialize again
      service.initialize();

      expect(mockEventDispatcher.on).toHaveBeenCalledWith(
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
      mockEventDispatcher.off.mockClear();
      mockLogger.info.mockClear();

      // Second dispose should do nothing
      service.dispose();

      expect(mockEventDispatcher.off).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid initialization and disposal', () => {
      service.initialize();
      service.dispose();
      service.initialize();
      service.dispose();

      expect(mockEventDispatcher.on).toHaveBeenCalledTimes(2);
      expect(mockEventDispatcher.off).toHaveBeenCalledTimes(2);
    });

    it('should maintain correct state through lifecycle', async () => {
      // Initialize
      service.initialize();
      expect(mockEventDispatcher.on).toHaveBeenCalled();

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
      expect(mockEventDispatcher.off).toHaveBeenCalled();

      // Clear mocks
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockClear();

      // Try to handle event after disposal (should not work as handler is removed)
      // This would only work if the event dispatcher actually removed the handler
      // In our test, we're just verifying the off method was called
      expect(mockEventDispatcher.off).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
    });
  });
});
