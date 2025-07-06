import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyUnitOfWork } from '../../../../src/anatomy/orchestration/anatomyUnitOfWork.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { AnatomyGenerationError } from '../../../../src/anatomy/orchestration/anatomyErrorHandler.js';

describe('AnatomyUnitOfWork', () => {
  let unitOfWork;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    unitOfWork = new AnatomyUnitOfWork({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should throw error if entityManager is not provided', () => {
      expect(() => new AnatomyUnitOfWork({ logger: mockLogger })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () => new AnatomyUnitOfWork({ entityManager: mockEntityManager })
      ).toThrow(InvalidArgumentError);
    });

    it('should initialize with clean state', () => {
      expect(unitOfWork.isCommitted).toBe(false);
      expect(unitOfWork.isRolledBack).toBe(false);
      expect(unitOfWork.trackedEntityCount).toBe(0);
    });
  });

  describe('trackEntity', () => {
    it('should track a single entity', () => {
      unitOfWork.trackEntity('entity-1');

      expect(unitOfWork.trackedEntityCount).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Tracked entity 'entity-1'")
      );
    });

    it('should throw error if entityId is not provided', () => {
      expect(() => unitOfWork.trackEntity()).toThrow(InvalidArgumentError);
      expect(() => unitOfWork.trackEntity(null)).toThrow(InvalidArgumentError);
      expect(() => unitOfWork.trackEntity('')).toThrow(InvalidArgumentError);
    });

    it('should throw error if unit of work is already committed', async () => {
      await unitOfWork.commit();
      expect(() => unitOfWork.trackEntity('entity-1')).toThrow(
        'Unit of work has already been committed'
      );
    });

    it('should throw error if unit of work is already rolled back', async () => {
      await unitOfWork.rollback();
      expect(() => unitOfWork.trackEntity('entity-1')).toThrow(
        'Unit of work has already been rolled back'
      );
    });
  });

  describe('trackEntities', () => {
    it('should track multiple entities', () => {
      unitOfWork.trackEntities(['entity-1', 'entity-2', 'entity-3']);

      expect(unitOfWork.trackedEntityCount).toBe(3);
    });

    it('should throw error if entityIds is not an array', () => {
      expect(() => unitOfWork.trackEntities('not-an-array')).toThrow(
        InvalidArgumentError
      );
    });

    it('should handle empty array', () => {
      unitOfWork.trackEntities([]);
      expect(unitOfWork.trackedEntityCount).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute operation successfully', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');

      const result = await unitOfWork.execute(mockOperation);

      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should trigger rollback on operation failure', async () => {
      const error = new Error('Operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);

      unitOfWork.trackEntity('entity-1');
      mockEntityManager.getEntityInstance.mockReturnValue({});

      await expect(unitOfWork.execute(mockOperation)).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed, triggering rollback'),
        expect.objectContaining({ trackedEntities: 1 })
      );
      expect(unitOfWork.isRolledBack).toBe(true);
    });

    it('should throw error if unit of work is already committed', async () => {
      await unitOfWork.commit();
      const mockOperation = jest.fn();

      await expect(unitOfWork.execute(mockOperation)).rejects.toThrow(
        'Unit of work has already been committed'
      );
    });
  });

  describe('commit', () => {
    it('should commit successfully', async () => {
      unitOfWork.trackEntities(['entity-1', 'entity-2']);

      await unitOfWork.commit();

      expect(unitOfWork.isCommitted).toBe(true);
      expect(unitOfWork.trackedEntityCount).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Committing unit of work')
      );
    });

    it('should throw error if already committed', async () => {
      await unitOfWork.commit();
      await expect(unitOfWork.commit()).rejects.toThrow(
        'Unit of work has already been committed'
      );
    });

    it('should throw error if already rolled back', async () => {
      await unitOfWork.rollback();
      await expect(unitOfWork.commit()).rejects.toThrow(
        'Unit of work has already been rolled back'
      );
    });
  });

  describe('rollback', () => {
    it('should rollback entities in reverse order', async () => {
      unitOfWork.trackEntities(['entity-1', 'entity-2', 'entity-3']);

      // Mock entities exist
      mockEntityManager.getEntityInstance.mockReturnValue({});

      await unitOfWork.rollback();

      expect(unitOfWork.isRolledBack).toBe(true);
      expect(unitOfWork.trackedEntityCount).toBe(0);

      // Verify deletion order (reverse)
      const removeEntityCalls =
        mockEntityManager.removeEntityInstance.mock.calls;
      expect(removeEntityCalls[0][0]).toBe('entity-3');
      expect(removeEntityCalls[1][0]).toBe('entity-2');
      expect(removeEntityCalls[2][0]).toBe('entity-1');
    });

    it('should handle already removed entities', async () => {
      unitOfWork.trackEntities(['entity-1', 'entity-2']);

      // Mock first entity exists, second doesn't
      mockEntityManager.getEntityInstance
        .mockReturnValueOnce({})
        .mockReturnValueOnce(null);

      await unitOfWork.rollback();

      expect(mockEntityManager.removeEntityInstance).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity 'entity-1' already removed")
      );
    });

    it('should throw error for partial rollback failure', async () => {
      unitOfWork.trackEntities(['entity-1', 'entity-2']);

      mockEntityManager.getEntityInstance.mockReturnValue({});
      mockEntityManager.removeEntityInstance
        .mockImplementationOnce(() => {
          throw new Error('Delete failed');
        })
        .mockImplementationOnce(() => {});

      await expect(unitOfWork.rollback()).rejects.toThrow(
        AnatomyGenerationError
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete entity 'entity-2'"),
        expect.any(Object)
      );
    });

    it('should not rollback if already rolled back', async () => {
      unitOfWork.trackEntity('entity-1');
      await unitOfWork.rollback();

      // Clear mock calls
      mockEntityManager.removeEntityInstance.mockClear();

      await unitOfWork.rollback();

      expect(mockEntityManager.removeEntityInstance).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyUnitOfWork: Rollback already performed'
      );
    });

    it('should throw error if trying to rollback committed work', async () => {
      await unitOfWork.commit();

      await expect(unitOfWork.rollback()).rejects.toThrow(
        'Cannot rollback a committed unit of work'
      );
    });
  });

  describe('state properties', () => {
    it('should correctly report committed state', async () => {
      expect(unitOfWork.isCommitted).toBe(false);
      await unitOfWork.commit();
      expect(unitOfWork.isCommitted).toBe(true);
    });

    it('should correctly report rolled back state', async () => {
      expect(unitOfWork.isRolledBack).toBe(false);
      await unitOfWork.rollback();
      expect(unitOfWork.isRolledBack).toBe(true);
    });

    it('should correctly report tracked entity count', () => {
      expect(unitOfWork.trackedEntityCount).toBe(0);

      unitOfWork.trackEntity('entity-1');
      expect(unitOfWork.trackedEntityCount).toBe(1);

      unitOfWork.trackEntities(['entity-2', 'entity-3']);
      expect(unitOfWork.trackedEntityCount).toBe(3);
    });
  });
});
