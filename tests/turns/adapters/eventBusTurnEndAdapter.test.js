// tests/turns/adapters/EventBusTurnEndAdapter.test.js
// --- FILE START ---

import EventBusTurnEndAdapter from '../../../src/turns/adapters/eventBusTurnEndAdapter.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
} from '../../../src/constants/eventIds.js';

// --- Mocks ---
const mockSafeDispatcher = {
  dispatch: jest.fn().mockResolvedValue(true), // Default mock success
};

const mockVed = {
  dispatch: jest.fn().mockResolvedValue(true), // Default mock success
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
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
    mockVed.dispatch.mockResolvedValue(true);
  });

  it('should throw an error if no valid dispatcher is provided', () => {
    expect(() => new EventBusTurnEndAdapter({ logger: mockLogger })).toThrow(
      /Requires a valid ISafeEventDispatcher \(preferred\) or IValidatedEventDispatcher/
    );
    expect(
      () =>
        new EventBusTurnEndAdapter({
          safeEventDispatcher: {},
          logger: mockLogger,
        })
    ).toThrow();
    expect(
      () =>
        new EventBusTurnEndAdapter({
          validatedEventDispatcher: {},
          logger: mockLogger,
        })
    ).toThrow();
  });

  it('should prefer ISafeEventDispatcher if provided and valid', () => {
    const adapter = new EventBusTurnEndAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });
    expect(adapter).toBeDefined();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should use IValidatedEventDispatcher if ISafeEventDispatcher is not provided or invalid', () => {
    const adapter = new EventBusTurnEndAdapter({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });
    expect(adapter).toBeDefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to IValidatedEventDispatcher')
    );
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

  it('should call dispatch with correct arguments when using IValidatedEventDispatcher', async () => {
    const adapter = new EventBusTurnEndAdapter({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });
    const entityId = 'player99';
    const success = false;

    await adapter.notifyTurnEnded(entityId, success);

    expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
    // Test that the payload dispatched now includes 'entityId' and 'success'
    expect(mockVed.dispatch).toHaveBeenCalledWith(
      TURN_ENDED_ID,
      { entityId, success } // Adjusted expectation
    );
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Received notifyTurnEnded for ${entityId} with success=${success}`
      )
    );
    // Adjusted log message expectation
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
    mockVed.dispatch.mockResolvedValueOnce(true);
    const adapter = new EventBusTurnEndAdapter({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });
    const entityId = 'item1';
    const expectedSuccess = true; // turnEnded always calls notifyTurnEnded with true

    await expect(adapter.turnEnded(entityId)).resolves.toBeUndefined();
    expect(mockVed.dispatch).toHaveBeenCalledTimes(1);
    // Adjusted log message expectation to include the success status
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Successfully dispatched ${TURN_ENDED_ID} for ${entityId} with success=${expectedSuccess}.`
      )
    );
  });

  it('should reject if dispatch throws an error', async () => {
    const dispatchError = new Error('VED failed for turn end');
    mockVed.dispatch.mockRejectedValueOnce(dispatchError);
    const adapter = new EventBusTurnEndAdapter({
      validatedEventDispatcher: mockVed,
      logger: mockLogger,
    });
    const entityId = 'system_actor';

    await expect(adapter.turnEnded(entityId)).rejects.toThrow(dispatchError);
    expect(mockVed.dispatch).toHaveBeenCalledTimes(2);
    expect(mockVed.dispatch).toHaveBeenLastCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('failed to dispatch'),
      })
    );
  });
});
// --- FILE END ---
