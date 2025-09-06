import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyInitializationService } from '../../../src/anatomy/anatomyInitializationService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('AnatomyInitializationService - Method Coverage', () => {
  let service;
  let mockEventDispatcher;
  let mockLogger;
  let mockAnatomyGenerationService;

  beforeEach(() => {
    // Create mocks
    mockEventDispatcher = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
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
  });

  describe('generateAnatomy method (lines 127-149)', () => {
    it('should successfully generate anatomy with blueprint ID', async () => {
      const entityId = 'test_entity';
      const blueprintId = 'humanoid_blueprint';

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith(entityId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Successfully generated anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(result).toBe(true);
    });

    it('should handle anatomy generation returning false', async () => {
      const entityId = 'test_entity';
      const blueprintId = 'humanoid_blueprint';

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        false
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith(entityId);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Successfully generated anatomy')
      );
      expect(result).toBe(false);
    });

    it('should handle and re-throw errors from anatomy generation', async () => {
      const entityId = 'test_entity';
      const blueprintId = 'humanoid_blueprint';
      const testError = new Error('Anatomy generation failed');

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        testError
      );

      await expect(
        service.generateAnatomy(entityId, blueprintId)
      ).rejects.toThrow('Anatomy generation failed');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity '${entityId}' with blueprint '${blueprintId}'`,
        { error: testError }
      );
    });

    it('should handle null entity ID gracefully', async () => {
      const entityId = null;
      const blueprintId = 'humanoid_blueprint';

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        false
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith(entityId);
      expect(result).toBe(false);
    });

    it('should handle empty string entity ID', async () => {
      const entityId = '';
      const blueprintId = 'humanoid_blueprint';

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        false
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith(entityId);
      expect(result).toBe(false);
    });

    it('should handle null blueprint ID gracefully', async () => {
      const entityId = 'test_entity';
      const blueprintId = null;

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).toHaveBeenCalledWith(entityId);
      expect(result).toBe(true);
    });

    it('should handle anatomy generation service rejection with specific error types', async () => {
      const entityId = 'test_entity';
      const blueprintId = 'invalid_blueprint';
      const invalidArgError = new InvalidArgumentError(
        'Invalid blueprint provided'
      );

      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        invalidArgError
      );

      await expect(
        service.generateAnatomy(entityId, blueprintId)
      ).rejects.toThrow(InvalidArgumentError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity '${entityId}' with blueprint '${blueprintId}'`,
        { error: invalidArgError }
      );
    });

    it('should handle async anatomy generation that resolves after delay', async () => {
      const entityId = 'test_entity';
      const blueprintId = 'slow_blueprint';

      // Simulate async operation
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10))
      );

      const result = await service.generateAnatomy(entityId, blueprintId);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Successfully generated anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );
    });
  });

  describe('Function coverage edge cases', () => {
    it('should handle destroy when not initialized', () => {
      // Service hasn't been initialized yet
      expect(() => service.destroy()).not.toThrow();

      // The production code always logs "Destroyed" regardless of initialization state
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AnatomyInitializationService: Destroyed'
      );
    });

    it('should handle multiple initialization calls gracefully', () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());

      // First initialization
      service.initialize();
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Second initialization should log warning
      service.initialize();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Already initialized'
      );
    });

    it('should handle entity created event with missing payload', async () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());
      service.initialize();

      // Get the event handler that was registered
      const eventHandler = mockEventDispatcher.subscribe.mock.calls[0][1];

      // Call with event missing instanceId
      await eventHandler({
        type: 'ENTITY_CREATED',
        payload: {}, // Missing instanceId
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).not.toHaveBeenCalled();
    });

    it('should handle entity created event with null payload', async () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());
      service.initialize();

      const eventHandler = mockEventDispatcher.subscribe.mock.calls[0][1];

      // Call with null payload
      await eventHandler({
        type: 'ENTITY_CREATED',
        payload: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
    });

    it('should handle entity created event for reconstructed entity', async () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());
      service.initialize();

      const eventHandler = mockEventDispatcher.subscribe.mock.calls[0][1];

      // Call with reconstructed entity
      await eventHandler({
        type: 'ENTITY_CREATED',
        payload: {
          instanceId: 'entity1',
          wasReconstructed: true,
        },
      });

      // Should return early without calling anatomy generation
      expect(
        mockAnatomyGenerationService.generateAnatomyIfNeeded
      ).not.toHaveBeenCalled();
    });

    it('should handle anatomy generation failure in entity created handler', async () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockRejectedValue(
        new Error('Generation failed')
      );

      service.initialize();

      const eventHandler = mockEventDispatcher.subscribe.mock.calls[0][1];

      // Call with valid entity
      await eventHandler({
        type: 'ENTITY_CREATED',
        payload: {
          instanceId: 'entity1',
          wasReconstructed: false,
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        `AnatomyInitializationService: Failed to generate anatomy for entity 'entity1'`,
        { error: expect.any(Error) }
      );
    });

    it('should handle successful anatomy generation in entity created handler', async () => {
      mockEventDispatcher.subscribe.mockReturnValue(jest.fn());
      mockAnatomyGenerationService.generateAnatomyIfNeeded.mockResolvedValue(
        true
      );

      service.initialize();

      const eventHandler = mockEventDispatcher.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'ENTITY_CREATED',
        payload: {
          instanceId: 'entity1',
          wasReconstructed: false,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyInitializationService: Generated anatomy for entity 'entity1'`
      );
    });
  });
});
