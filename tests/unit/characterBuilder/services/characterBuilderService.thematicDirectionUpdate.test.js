import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  CharacterBuilderService,
  CharacterBuilderError,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('CharacterBuilderService - updateThematicDirection event dispatching', () => {
  let service;
  let mockLogger;
  let mockStorageService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockDirectionGenerator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      getThematicDirection: jest.fn(),
      getAllThematicDirections: jest.fn(),
      updateThematicDirection: jest.fn(),
      deleteThematicDirection: jest.fn(),
      findOrphanedDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn().mockReturnValue(true),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      formatAjvErrors: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      directionGenerator: mockDirectionGenerator,
    });
  });

  describe('Event dispatching with correct payload format', () => {
    const directionId = 'test-direction-id';
    const currentDirection = {
      id: directionId,
      conceptId: 'test-concept-id',
      title: 'Original Title',
      description: 'Original Description',
      coreTension: 'Original Tension',
      uniqueTwist: 'Original Twist',
      narrativePotential: 'Original Potential',
      createdAt: '2024-01-01T00:00:00Z',
    };

    it('should dispatch event for each changed field with correct format', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description',
      };

      const updatedDirection = {
        ...currentDirection,
        ...updates,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirection
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      const result = await service.updateThematicDirection(
        directionId,
        updates
      );

      // Verify the service called getThematicDirection to get old values
      expect(mockStorageService.getThematicDirection).toHaveBeenCalledWith(
        directionId
      );

      // Verify update was called
      expect(mockStorageService.updateThematicDirection).toHaveBeenCalledWith(
        directionId,
        updates
      );

      // Verify events were dispatched with correct format
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);

      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        1,
        'core:direction_updated',
        {
          directionId,
          field: 'title',
          oldValue: 'Original Title',
          newValue: 'Updated Title',
        }
      );

      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        2,
        'core:direction_updated',
        {
          directionId,
          field: 'description',
          oldValue: 'Original Description',
          newValue: 'Updated Description',
        }
      );

      expect(result).toEqual(updatedDirection);
    });

    it('should not dispatch events for unchanged fields', async () => {
      const updates = {
        title: 'Original Title', // Same as current
        description: 'Updated Description', // Different
      };

      const updatedDirection = {
        ...currentDirection,
        ...updates,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirection
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection(directionId, updates);

      // Should only dispatch one event for the changed field
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId,
          field: 'description',
          oldValue: 'Original Description',
          newValue: 'Updated Description',
        }
      );
    });

    it('should handle null/undefined values correctly', async () => {
      const currentDirectionWithNull = {
        ...currentDirection,
        uniqueTwist: null,
      };

      const updates = {
        uniqueTwist: 'New Twist',
        narrativePotential: null,
      };

      const updatedDirection = {
        ...currentDirectionWithNull,
        ...updates,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirectionWithNull
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection(directionId, updates);

      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);

      // Null old value should be converted to empty string
      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        1,
        'core:direction_updated',
        {
          directionId,
          field: 'uniqueTwist',
          oldValue: '',
          newValue: 'New Twist',
        }
      );

      // Null new value should be converted to empty string
      expect(mockEventBus.dispatch).toHaveBeenNthCalledWith(
        2,
        'core:direction_updated',
        {
          directionId,
          field: 'narrativePotential',
          oldValue: 'Original Potential',
          newValue: '',
        }
      );
    });

    it('should throw error if thematic direction not found', async () => {
      mockStorageService.getThematicDirection.mockResolvedValue(null);

      await expect(
        service.updateThematicDirection(directionId, { title: 'New Title' })
      ).rejects.toThrow(CharacterBuilderError);

      await expect(
        service.updateThematicDirection(directionId, { title: 'New Title' })
      ).rejects.toThrow(`Thematic direction not found: ${directionId}`);

      expect(mockStorageService.updateThematicDirection).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should handle single field update', async () => {
      const updates = {
        coreTension: 'Updated Tension',
      };

      const updatedDirection = {
        ...currentDirection,
        ...updates,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirection
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection(directionId, updates);

      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId,
          field: 'coreTension',
          oldValue: 'Original Tension',
          newValue: 'Updated Tension',
        }
      );
    });

    it('should handle multiple field updates', async () => {
      const updates = {
        title: 'New Title',
        description: 'New Description',
        coreTension: 'New Tension',
        uniqueTwist: 'New Twist',
        narrativePotential: 'New Potential',
      };

      const updatedDirection = {
        ...currentDirection,
        ...updates,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirection
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection(directionId, updates);

      // Should dispatch 5 events, one for each field
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(5);

      // Verify each field has its own event
      const dispatchCalls = mockEventBus.dispatch.mock.calls;
      const fields = dispatchCalls.map((call) => call[1].field);
      expect(fields).toEqual([
        'title',
        'description',
        'coreTension',
        'uniqueTwist',
        'narrativePotential',
      ]);
    });

    it('should handle empty updates object', async () => {
      const updates = {};

      const updatedDirection = {
        ...currentDirection,
        updatedAt: '2024-01-02T00:00:00Z',
      };

      mockStorageService.getThematicDirection.mockResolvedValue(
        currentDirection
      );
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection(directionId, updates);

      // No events should be dispatched
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle storage service errors gracefully', async () => {
      const error = new Error('Database error');
      mockStorageService.getThematicDirection.mockRejectedValue(error);

      await expect(
        service.updateThematicDirection('test-id', { title: 'New' })
      ).rejects.toThrow(CharacterBuilderError);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should validate directionId parameter', async () => {
      await expect(
        service.updateThematicDirection(null, { title: 'New' })
      ).rejects.toThrow('directionId must be a non-empty string');

      await expect(
        service.updateThematicDirection('', { title: 'New' })
      ).rejects.toThrow('directionId must be a non-empty string');

      await expect(
        service.updateThematicDirection(123, { title: 'New' })
      ).rejects.toThrow('directionId must be a non-empty string');
    });

    it('should validate updates parameter', async () => {
      await expect(
        service.updateThematicDirection('test-id', null)
      ).rejects.toThrow('updates must be a valid object');

      await expect(
        service.updateThematicDirection('test-id', 'not-an-object')
      ).rejects.toThrow('updates must be a valid object');
    });
  });
});
