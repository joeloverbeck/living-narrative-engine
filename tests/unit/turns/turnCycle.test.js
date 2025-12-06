// tests/unit/turns/turnCycle.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TurnCycle from '../../../src/turns/turnCycle.js';
import { PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('TurnCycle - Constructor Validation', () => {
  let mockService;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockService = {
      isEmpty: jest.fn(),
      getNextEntity: jest.fn(),
      clearCurrentRound: jest.fn(),
      getCurrentOrder: jest.fn().mockReturnValue([]),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  it('should instantiate successfully with valid dependencies', () => {
    let turnCycle;
    expect(() => {
      turnCycle = new TurnCycle(mockService, mockEntityManager, mockLogger);
    }).not.toThrow();

    expect(turnCycle).toBeInstanceOf(TurnCycle);
  });

  it('should throw when entityManager is missing', () => {
    expect(() => {
      new TurnCycle(mockService, null, mockLogger);
    }).toThrow('TurnCycle requires a valid EntityManager instance.');
  });

  it('should throw when entityManager lacks getComponentData method', () => {
    const invalidEntityManager = {};
    expect(() => {
      new TurnCycle(mockService, invalidEntityManager, mockLogger);
    }).toThrow('TurnCycle requires a valid EntityManager instance.');
  });
});

describe('TurnCycle - Participation Filtering', () => {
  let mockService;
  let mockEntityManager;
  let mockLogger;
  let turnCycle;

  beforeEach(() => {
    mockService = {
      isEmpty: jest.fn(),
      getNextEntity: jest.fn(),
      clearCurrentRound: jest.fn(),
      getCurrentOrder: jest.fn().mockReturnValue([]),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    turnCycle = new TurnCycle(mockService, mockEntityManager, mockLogger);
  });

  describe('nextActor()', () => {
    it('should return null when queue is empty', async () => {
      mockService.isEmpty.mockResolvedValue(true);

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): queue empty'
      );
      expect(mockService.getNextEntity).not.toHaveBeenCalled();
    });

    it('should return participating actor normally', async () => {
      const mockEntity = { id: 'actor-1' };
      mockService.isEmpty.mockResolvedValue(false);
      mockService.getNextEntity.mockResolvedValue(mockEntity);
      mockService.getCurrentOrder.mockReturnValue([mockEntity]);
      mockEntityManager.getComponentData.mockReturnValue({
        participating: true,
      });

      const result = await turnCycle.nextActor();

      expect(result).toBe(mockEntity);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-1',
        PARTICIPATION_COMPONENT_ID
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Selected participating actor actor-1'
      );
    });

    it('should skip non-participating actors and return next participating actor', async () => {
      const nonParticipatingActor = { id: 'actor-1' };
      const participatingActor = { id: 'actor-2' };

      mockService.isEmpty.mockResolvedValue(false);
      mockService.getCurrentOrder.mockReturnValue([
        nonParticipatingActor,
        participatingActor,
      ]);

      mockService.getNextEntity
        .mockResolvedValueOnce(nonParticipatingActor)
        .mockResolvedValueOnce(participatingActor);

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ participating: false }) // First actor not participating
        .mockReturnValueOnce({ participating: true }); // Second actor participating

      const result = await turnCycle.nextActor();

      expect(result).toBe(participatingActor);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Skipping actor actor-1 - participation disabled'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Selected participating actor actor-2'
      );
    });

    it('should default to participating=true when component is missing', async () => {
      const mockEntity = { id: 'actor-1' };
      mockService.isEmpty.mockResolvedValue(false);
      mockService.getNextEntity.mockResolvedValue(mockEntity);
      mockService.getCurrentOrder.mockReturnValue([mockEntity]);
      mockEntityManager.getComponentData.mockReturnValue(null); // Component missing

      const result = await turnCycle.nextActor();

      expect(result).toBe(mockEntity);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Selected participating actor actor-1'
      );
    });

    it('should default to participating=true when participation property is undefined', async () => {
      const mockEntity = { id: 'actor-1' };
      mockService.isEmpty.mockResolvedValue(false);
      mockService.getNextEntity.mockResolvedValue(mockEntity);
      mockService.getCurrentOrder.mockReturnValue([mockEntity]);
      mockEntityManager.getComponentData.mockReturnValue({}); // Component exists but no participating property

      const result = await turnCycle.nextActor();

      expect(result).toBe(mockEntity);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Selected participating actor actor-1'
      );
    });

    it('should return null and log warning when all actors are non-participating', async () => {
      const actor1 = { id: 'actor-1' };
      const actor2 = { id: 'actor-2' };

      mockService.isEmpty.mockResolvedValue(false);
      mockService.getCurrentOrder.mockReturnValue([actor1, actor2]);
      mockService.getNextEntity
        .mockResolvedValueOnce(actor1)
        .mockResolvedValueOnce(actor2);

      mockEntityManager.getComponentData.mockReturnValue({
        participating: false,
      });

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'No participating actors found in turn queue after'
        )
      );
    });

    it('should respect max attempts limit (queue size)', async () => {
      const actors = Array.from({ length: 3 }, (_, i) => ({
        id: `actor-${i}`,
      }));

      mockService.isEmpty.mockResolvedValue(false);
      mockService.getCurrentOrder.mockReturnValue(actors);

      // All actors return as non-participating
      mockService.getNextEntity.mockImplementation(() =>
        Promise.resolve(actors[0])
      );
      mockEntityManager.getComponentData.mockReturnValue({
        participating: false,
      });

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      expect(mockService.getNextEntity).toHaveBeenCalledTimes(3); // Should stop at queue size
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('max: 3')
      );
    });

    it('should respect max attempts limit of 50 even with larger queue', async () => {
      const largeQueue = Array.from({ length: 100 }, (_, i) => ({
        id: `actor-${i}`,
      }));

      mockService.isEmpty.mockResolvedValue(false);
      mockService.getCurrentOrder.mockReturnValue(largeQueue);

      let callCount = 0;
      mockService.getNextEntity.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ id: `actor-${callCount}` });
      });
      mockEntityManager.getComponentData.mockReturnValue({
        participating: false,
      });

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      expect(mockService.getNextEntity).toHaveBeenCalledTimes(50); // Should cap at 50
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('max: 50')
      );
    });

    it('should return null when getNextEntity returns null during iteration', async () => {
      const actor1 = { id: 'actor-1' };
      const actor2 = { id: 'actor-2' };

      mockService.isEmpty.mockResolvedValue(false);
      mockService.getCurrentOrder.mockReturnValue([actor1, actor2]); // Queue size of 2
      mockService.getNextEntity
        .mockResolvedValueOnce(actor1)
        .mockResolvedValueOnce(null); // Queue exhausted after first skip

      mockEntityManager.getComponentData.mockReturnValue({
        participating: false,
      });

      const result = await turnCycle.nextActor();

      expect(result).toBeNull();
      // Should skip first actor, then get null from queue
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): Skipping actor actor-1 - participation disabled'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): queue returned null'
      );
    });

    it('should handle errors and rethrow them', async () => {
      const testError = new Error('Test error');
      mockService.isEmpty.mockRejectedValue(testError);

      await expect(turnCycle.nextActor()).rejects.toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnCycle.nextActor(): failed',
        testError
      );
    });
  });

  describe('clear()', () => {
    it('should call clearCurrentRound and log success', async () => {
      mockService.clearCurrentRound.mockResolvedValue();

      await turnCycle.clear();

      expect(mockService.clearCurrentRound).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TurnCycle.clear(): current round cleared'
      );
    });

    it('should handle errors during clear', async () => {
      const testError = new Error('Clear failed');
      mockService.clearCurrentRound.mockRejectedValue(testError);

      await expect(turnCycle.clear()).rejects.toThrow('Clear failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnCycle.clear(): failed',
        testError
      );
    });
  });
});
