/**
 * @file Unit tests for CharacterBuilderService extensions for thematic directions manager
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../../src/characterBuilder/services/characterBuilderService.js';

describe('CharacterBuilderService - Thematic Directions Manager Extensions', () => {
  let service;
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;

  // Mock data
  const mockConcept = {
    id: 'concept-1',
    concept: 'A brave warrior seeking redemption',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDirection = {
    id: 'direction-1',
    conceptId: 'concept-1',
    title: 'The Redemption Arc',
    description: 'A story of personal growth and redemption',
    coreTension: 'Internal struggle between past mistakes and future hopes',
    uniqueTwist: 'The hero must face their former victims',
    narrativePotential: 'Rich character development opportunities',
    createdAt: new Date().toISOString(),
  };

  const mockOrphanedDirection = {
    id: 'direction-2',
    conceptId: 'missing-concept',
    title: 'Orphaned Direction',
    description: 'A direction without a valid concept',
    coreTension: 'Existential uncertainty',
    uniqueTwist: 'No one knows where this came from',
    narrativePotential: 'Limited due to lack of context',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn(),
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

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    service = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllThematicDirectionsWithConcepts', () => {
    it('should return all directions with their associated concepts', async () => {
      const mockDirections = [mockDirection, mockOrphanedDirection];
      mockStorageService.getAllThematicDirections.mockResolvedValue(
        mockDirections
      );
      mockStorageService.getCharacterConcept
        .mockResolvedValueOnce(mockConcept) // For first direction
        .mockResolvedValueOnce(null); // For orphaned direction

      const result = await service.getAllThematicDirectionsWithConcepts();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        direction: mockDirection,
        concept: mockConcept,
      });
      expect(result[1]).toEqual({
        direction: mockOrphanedDirection,
        concept: null,
      });

      expect(mockStorageService.getAllThematicDirections).toHaveBeenCalled();
      expect(mockStorageService.getCharacterConcept).toHaveBeenCalledWith(
        'concept-1'
      );
      expect(mockStorageService.getCharacterConcept).toHaveBeenCalledWith(
        'missing-concept'
      );
    });

    it('should handle storage service errors gracefully', async () => {
      const error = new Error('Storage service failure');
      mockStorageService.getAllThematicDirections.mockRejectedValue(error);

      await expect(
        service.getAllThematicDirectionsWithConcepts()
      ).rejects.toThrow(
        'Failed to get all thematic directions with concepts: Storage service failure'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get all thematic directions with concepts: Storage service failure',
        expect.any(Error)
      );
    });

    it('should handle individual concept loading failures', async () => {
      const mockDirections = [mockDirection];
      mockStorageService.getAllThematicDirections.mockResolvedValue(
        mockDirections
      );
      mockStorageService.getCharacterConcept.mockRejectedValue(
        new Error('Concept not found')
      );

      const result = await service.getAllThematicDirectionsWithConcepts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        direction: mockDirection,
        concept: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CharacterBuilderService: Failed to load concept for direction direction-1',
        { directionId: 'direction-1', conceptId: 'concept-1' }
      );
    });

    it('should handle empty directions list', async () => {
      mockStorageService.getAllThematicDirections.mockResolvedValue([]);

      const result = await service.getAllThematicDirectionsWithConcepts();

      expect(result).toEqual([]);
      expect(mockStorageService.getAllThematicDirections).toHaveBeenCalled();
    });
  });

  describe('getOrphanedThematicDirections', () => {
    it('should return orphaned directions', async () => {
      const orphanedDirections = [mockOrphanedDirection];
      mockStorageService.findOrphanedDirections.mockResolvedValue(
        orphanedDirections
      );

      const result = await service.getOrphanedThematicDirections();

      expect(result).toEqual(orphanedDirections);
      expect(mockStorageService.findOrphanedDirections).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Found 1 orphaned directions'
      );
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Storage failure');
      mockStorageService.findOrphanedDirections.mockRejectedValue(error);

      await expect(service.getOrphanedThematicDirections()).rejects.toThrow(
        'Failed to get orphaned thematic directions: Storage failure'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get orphaned thematic directions: Storage failure',
        expect.any(Error)
      );
    });

    it('should handle empty orphaned directions list', async () => {
      mockStorageService.findOrphanedDirections.mockResolvedValue([]);

      const result = await service.getOrphanedThematicDirections();

      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CharacterBuilderService: Found 0 orphaned directions'
      );
    });
  });

  describe('updateThematicDirection', () => {
    it('should update direction successfully', async () => {
      const updates = { title: 'Updated Title' };
      const updatedDirection = { ...mockDirection, title: 'Updated Title' };

      // Mock the getThematicDirection call
      mockStorageService.getThematicDirection.mockResolvedValue(mockDirection);
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      const result = await service.updateThematicDirection(
        'direction-1',
        updates
      );

      expect(result).toEqual(updatedDirection);
      expect(mockStorageService.getThematicDirection).toHaveBeenCalledWith(
        'direction-1'
      );
      expect(mockStorageService.updateThematicDirection).toHaveBeenCalledWith(
        'direction-1',
        updates
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId: 'direction-1',
          field: 'title',
          oldValue: 'The Redemption Arc',
          newValue: 'Updated Title',
        }
      );
    });

    it('should validate directionId parameter', async () => {
      await expect(
        service.updateThematicDirection('', { title: 'New Title' })
      ).rejects.toThrow('directionId must be a non-empty string');

      await expect(
        service.updateThematicDirection(null, { title: 'New Title' })
      ).rejects.toThrow('directionId must be a non-empty string');
    });

    it('should validate updates parameter', async () => {
      await expect(
        service.updateThematicDirection('direction-1', null)
      ).rejects.toThrow('updates must be a valid object');

      await expect(
        service.updateThematicDirection('direction-1', 'invalid')
      ).rejects.toThrow('updates must be a valid object');
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Update failed');
      // Mock getThematicDirection to return the existing direction
      mockStorageService.getThematicDirection.mockResolvedValue(mockDirection);
      // Then mock updateThematicDirection to fail
      mockStorageService.updateThematicDirection.mockRejectedValue(error);

      await expect(
        service.updateThematicDirection('direction-1', { title: 'New Title' })
      ).rejects.toThrow(
        'Failed to update thematic direction direction-1: Update failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update thematic direction direction-1: Update failed',
        expect.any(Error)
      );
    });
  });

  describe('deleteThematicDirection', () => {
    it('should delete direction successfully', async () => {
      mockStorageService.deleteThematicDirection.mockResolvedValue(true);

      const result = await service.deleteThematicDirection('direction-1');

      expect(result).toBe(true);
      expect(mockStorageService.deleteThematicDirection).toHaveBeenCalledWith(
        'direction-1'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_deleted',
        {
          directionId: 'direction-1',
        }
      );
    });

    it('should handle deletion failure', async () => {
      mockStorageService.deleteThematicDirection.mockResolvedValue(false);

      const result = await service.deleteThematicDirection('direction-1');

      expect(result).toBe(false);
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should validate directionId parameter', async () => {
      await expect(service.deleteThematicDirection('')).rejects.toThrow(
        'directionId must be a non-empty string'
      );

      await expect(service.deleteThematicDirection(null)).rejects.toThrow(
        'directionId must be a non-empty string'
      );
    });

    it('should handle storage service errors', async () => {
      const error = new Error('Deletion failed');
      mockStorageService.deleteThematicDirection.mockRejectedValue(error);

      await expect(
        service.deleteThematicDirection('direction-1')
      ).rejects.toThrow(
        'Failed to delete thematic direction direction-1: Deletion failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete thematic direction direction-1: Deletion failed',
        expect.any(Error)
      );
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch DIRECTION_UPDATED event with correct payload', async () => {
      const updates = { title: 'Updated Title' };
      const updatedDirection = { ...mockDirection, title: 'Updated Title' };

      mockStorageService.getThematicDirection.mockResolvedValue(mockDirection);
      mockStorageService.updateThematicDirection.mockResolvedValue(
        updatedDirection
      );

      await service.updateThematicDirection('direction-1', updates);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_updated',
        {
          directionId: 'direction-1',
          field: 'title',
          oldValue: 'The Redemption Arc',
          newValue: 'Updated Title',
        }
      );
    });

    it('should dispatch DIRECTION_DELETED event with correct payload', async () => {
      mockStorageService.deleteThematicDirection.mockResolvedValue(true);

      await service.deleteThematicDirection('direction-1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:direction_deleted',
        {
          directionId: 'direction-1',
        }
      );
    });

    it('should not dispatch events on operation failures', async () => {
      mockStorageService.updateThematicDirection.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(
        service.updateThematicDirection('direction-1', { title: 'New Title' })
      ).rejects.toThrow();

      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });
});
