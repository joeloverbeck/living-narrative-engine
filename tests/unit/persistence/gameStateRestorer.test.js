/** @jest-environment node */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameStateRestorer from '../../../src/persistence/gameStateRestorer.js';
import { createMockLogger } from '../testUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('GameStateRestorer', () => {
  let logger;
  let entityManager;
  let playtimeTracker;
  let safeEventDispatcher;
  let restorer;

  const baseSaveData = () => ({
    metadata: {},
    gameState: {
      entities: [],
    },
  });

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = {
      clearAll: jest.fn(),
      reconstructEntity: jest.fn().mockReturnValue({ instanceId: 'foo' }),
    };
    playtimeTracker = {
      setAccumulatedPlaytime: jest.fn(),
    };
    safeEventDispatcher = {
      dispatch: jest.fn(),
    };

    restorer = new GameStateRestorer({
      logger,
      entityManager,
      playtimeTracker,
      safeEventDispatcher,
    });
  });

  it('fails when game state is missing', async () => {
    const result = await restorer.restoreGameState({ metadata: {} });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid save data structure provided')
    );
  });

  it('returns success when entities list is not an array', async () => {
    const data = baseSaveData();
    data.gameState.entities = 'not-an-array';

    const result = await restorer.restoreGameState(data);

    expect(result).toEqual({ success: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('entitiesToRestore is not an array')
    );
    expect(entityManager.clearAll).toHaveBeenCalled();
  });

  it('dispatches a system error when an entity definition is missing', async () => {
    const missingDefinitionError = new DefinitionNotFoundError('missing-def');
    entityManager.reconstructEntity.mockImplementation(() => {
      throw missingDefinitionError;
    });

    const data = baseSaveData();
    data.gameState.entities = [
      { instanceId: 'instance-1', definitionId: 'missing-def' },
    ];

    const result = await restorer.restoreGameState(data);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Definition 'missing-def' not found"),
      missingDefinitionError
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining("Definition 'missing-def' not found"),
        details: expect.objectContaining({
          definitionId: 'missing-def',
          instanceId: 'instance-1',
        }),
      })
    );
  });

  it('continues restoration when reconstructEntity throws a recoverable error', async () => {
    const recoverableError = new Error('temporary issue');
    entityManager.reconstructEntity
      .mockImplementationOnce(() => {
        throw recoverableError;
      })
      .mockReturnValue({ instanceId: 'entity-2' });

    const data = baseSaveData();
    data.gameState.entities = [
      { instanceId: 'entity-1', definitionId: 'def-1' },
      { instanceId: 'entity-2', definitionId: 'def-2' },
    ];

    const result = await restorer.restoreGameState(data);

    expect(result).toEqual({ success: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during reconstructEntity for instanceId: entity-1'
      ),
      recoverableError
    );
    expect(entityManager.reconstructEntity).toHaveBeenCalledTimes(2);
  });

  it('returns a failure when clearing entities throws', async () => {
    const clearError = new Error('clear-failure');
    entityManager.clearAll.mockImplementation(() => {
      throw clearError;
    });

    const result = await restorer.restoreGameState(baseSaveData());

    expect(result.success).toBe(false);
    expect(result.error.code).toBe(PersistenceErrorCodes.UNEXPECTED_ERROR);
    expect(result.error.message).toContain(
      'Critical error during state clearing'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to clear existing entity state: clear-failure'
      ),
      clearError
    );
  });

  it('restores playtime and logs errors when setting playtime fails', async () => {
    playtimeTracker.setAccumulatedPlaytime
      .mockImplementationOnce(() => {
        throw new Error('cannot set');
      })
      .mockImplementation(() => {});

    const data = baseSaveData();
    data.metadata.playtimeSeconds = 123;

    const result = await restorer.restoreGameState(data);

    expect(result).toEqual({ success: true });
    expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenNthCalledWith(
      1,
      123
    );
    expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenNthCalledWith(
      2,
      0
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error setting accumulated playtime'),
      expect.any(Error)
    );
  });

  it('resets playtime when metadata lacks a numeric playtime', async () => {
    const data = baseSaveData();
    data.metadata.playtimeSeconds = undefined;

    const result = await restorer.restoreGameState(data);

    expect(result).toEqual({ success: true });
    expect(playtimeTracker.setAccumulatedPlaytime).toHaveBeenCalledWith(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Playtime data not found/invalid')
    );
  });
});
