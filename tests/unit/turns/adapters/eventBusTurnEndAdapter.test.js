// tests/turns/adapters/EventBusTurnEndAdapter.test.js
// --- FILE START ---

import EventBusTurnEndAdapter from '../../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
} from '../../../../src/constants/eventIds.js';

// --- Mocks ---
const mockSafeDispatcher = {
  dispatch: jest.fn().mockResolvedValue(true), // Default mock success
};

// Mock logger to spy on
const mockLogger = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('EventBusTurnEndAdapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Reset mocks to default behavior for each test
    mockSafeDispatcher.dispatch.mockResolvedValue(true);
  });

  it('should throw an error if no valid dispatcher is provided', () => {
    expect(() => new EventBusTurnEndAdapter({ logger: mockLogger })).toThrow(
      /Requires a valid ISafeEventDispatcher/
    );
    expect(
      () =>
        new EventBusTurnEndAdapter({
          safeEventDispatcher: {},
          logger: mockLogger,
        })
    ).toThrow();
  });

  it('should create adapter when a valid ISafeEventDispatcher is provided', () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    expect(adapter).toBeDefined();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should throw an error during turnEnded if entityId is invalid', async () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    await expect(adapter.turnEnded(null)).rejects.toThrow(
      'EventBusTurnEndAdapter: entityId must be a non-empty string'
    );
    await expect(adapter.turnEnded('')).rejects.toThrow(
      'EventBusTurnEndAdapter: entityId must be a non-empty string'
    );
    await expect(adapter.turnEnded(123)).rejects.toThrow(
      'EventBusTurnEndAdapter: entityId must be a non-empty string'
    );
  });

  it('should call dispatch with correct arguments when using ISafeEventDispatcher', async () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    const entityId = 'npc1';
    const success = true;

    await adapter.notifyTurnEnded(entityId, success);

    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(1);
    // Test that the payload dispatched now includes 'entityId' and 'success'
    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledWith(
      TURN_ENDED_ID,
      { entityId, success } // Adjusted expectation
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Received notifyTurnEnded for ${entityId} with success=${success}`
      )
    );
    // Adjusted log message expectation to reflect the change in the adapter
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Dispatching ${TURN_ENDED_ID} with entityId and success status.`
      )
    );
  });

  it('should resolve void even if dispatch returns false', async () => {
    mockSafeDispatcher.dispatch.mockResolvedValueOnce(false);
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    const entityId = 'monster1';
    const expectedSuccess = true; // turnEnded always calls notifyTurnEnded with true

    await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(1);
    // Adjusted log message expectation to include the success status
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Successfully dispatched ${TURN_ENDED_ID} for ${entityId} with success=${expectedSuccess}.`
      )
    );
  });

  it('should resolve void if dispatch succeeds', async () => {
    mockSafeDispatcher.dispatch.mockResolvedValueOnce(true);
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    const entityId = 'item1';
    const expectedSuccess = true; // turnEnded always calls notifyTurnEnded with true

    await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(1);
    // Adjusted log message expectation to include the success status
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Successfully dispatched ${TURN_ENDED_ID} for ${entityId} with success=${expectedSuccess}.`
      )
    );
  });

  it('should reject non-boolean success values and emit a system error', async () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    const entityId = 'npc-invalid-success';

    await expect(
      adapter.notifyTurnEnded(entityId, undefined)
    ).rejects.toThrow(
      /success' parameter must be a boolean/
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("'success' parameter must be a boolean")
    );

    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          "'success' parameter must be a boolean"
        ),
        details: expect.objectContaining({
          entityId,
          receivedType: 'undefined',
          receivedValue: undefined,
        }),
      })
    );

    expect(
      mockSafeDispatcher.dispatch
    ).not.toHaveBeenCalledWith(TURN_ENDED_ID, expect.anything());
  });

  it('should attempt fallback error dispatch when invalid entity dispatch fails', async () => {
    const invalidEntityId = '';
    const dispatchError = new Error('primary dispatch failure');

    mockSafeDispatcher.dispatch
      .mockRejectedValueOnce(dispatchError)
      .mockResolvedValueOnce(true);

    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });

    await expect(
      adapter.notifyTurnEnded(invalidEntityId, true)
    ).rejects.toThrow(
      'EventBusTurnEndAdapter: entityId must be a non-empty string'
    );

    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(mockSafeDispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('entityId must be a non-empty string'),
      })
    );
    expect(mockSafeDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Error dispatching'),
        details: expect.objectContaining({
          error: dispatchError.message,
          entityId: invalidEntityId,
        }),
      })
    );
  });

  it('should log when system error dispatch fails after invalid success value', async () => {
    const dispatchError = new Error('secondary dispatch failure');

    mockSafeDispatcher.dispatch.mockRejectedValueOnce(dispatchError);

    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });

    await expect(
      adapter.notifyTurnEnded('npc-invalid-success', 'nope')
    ).rejects.toThrow(TypeError);

    expect(mockLogger.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'success' parameter must be a boolean")
    );

    const lastErrorCall = mockLogger.error.mock.calls.at(-1);
    expect(lastErrorCall).toBeDefined();
    expect(lastErrorCall[0]).toContain(
      'EventBusTurnEndAdapter: Error dispatching core:system_error_occurred after invalid success value'
    );
    expect(lastErrorCall[1]).toBe(dispatchError);
  });

  it('should reject if dispatch throws an error', async () => {
    const dispatchError = new Error('VED failed for turn end');
    mockSafeDispatcher.dispatch.mockRejectedValueOnce(dispatchError);
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });
    const entityId = 'system_actor';

    await expect(adapter.turnEnded(entityId)).rejects.toThrow(dispatchError);
    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(mockSafeDispatcher.dispatch).toHaveBeenLastCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('failed to dispatch'),
      })
    );
  });

  it('should attempt secondary error dispatch when reporting dispatch failure also fails', async () => {
    const turnEndError = new Error('turn end failure');
    const reportingError = new Error('reporting failure');

    mockSafeDispatcher.dispatch
      .mockRejectedValueOnce(turnEndError)
      .mockRejectedValueOnce(reportingError)
      .mockResolvedValueOnce(true);

    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });

    await expect(adapter.notifyTurnEnded('actor-1', true)).rejects.toThrow(
      turnEndError
    );

    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledTimes(3);
    expect(mockSafeDispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      TURN_ENDED_ID,
      expect.objectContaining({ entityId: 'actor-1', success: true })
    );
    expect(mockSafeDispatcher.dispatch).toHaveBeenNthCalledWith(
      2,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('failed to dispatch'),
        details: expect.objectContaining({ raw: turnEndError.message }),
      })
    );
    expect(mockSafeDispatcher.dispatch).toHaveBeenNthCalledWith(
      3,
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'Error dispatching core:system_error_occurred after failing core:turn_ended'
        ),
        details: expect.objectContaining({
          error: reportingError.message,
          entityId: 'actor-1',
        }),
      })
    );
  });

  it('should use console as the default logger when none is provided', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });

    try {
      await adapter.notifyTurnEnded('console-actor', true);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'EventBusTurnEndAdapter: Received notifyTurnEnded for console-actor with success=true.'
        )
      );
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('should log legacy turnEnded usage with assumed success', async () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      logger: mockLogger,
    });

    await adapter.turnEnded('legacy-actor');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'EventBusTurnEndAdapter: Legacy turnEnded called for legacy-actor. Assuming success=true.'
      )
    );
  });
});
// --- FILE END ---
