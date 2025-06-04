// src/core/adapters/EventBusPromptAdapter.test.js
// --- FILE START ---

import { EventBusPromptAdapter } from '../../../src/turns/adapters/eventBusPromptAdapter.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- Mocks ---
const mockSafeDispatcher = {
  dispatchSafely: jest.fn().mockResolvedValue(true), // Default mock success
};

const mockVed = {
  dispatchValidated: jest.fn().mockResolvedValue(true), // Default mock success
  // Add subscribe/unsubscribe if needed for other tests/classes
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

describe('EventBusPromptAdapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should throw an error if no valid dispatcher is provided', () => {
    expect(() => new EventBusPromptAdapter({})).toThrow(
      /Requires a valid ISafeEventDispatcher \(preferred\) or IValidatedEventDispatcher/
    );
    expect(
      () => new EventBusPromptAdapter({ safeEventDispatcher: {} })
    ).toThrow();
    expect(
      () => new EventBusPromptAdapter({ validatedEventDispatcher: {} })
    ).toThrow();
    expect(
      () =>
        new EventBusPromptAdapter({
          safeEventDispatcher: {},
          validatedEventDispatcher: {},
        })
    ).toThrow();
  });

  it('should prefer ISafeEventDispatcher if provided and valid', () => {
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
      validatedEventDispatcher: mockVed,
    });
    expect(adapter).toBeDefined();
    // We can't directly check private fields, but we can test behavior
  });

  it('should use IValidatedEventDispatcher if ISafeEventDispatcher is not provided or invalid', () => {
    // Mock console.warn to check the warning message
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new EventBusPromptAdapter({
      validatedEventDispatcher: mockVed,
    });
    expect(adapter).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('falling back to IValidatedEventDispatcher')
    );

    const adapter2 = new EventBusPromptAdapter({
      safeEventDispatcher: {},
      validatedEventDispatcher: mockVed,
    });
    expect(adapter2).toBeDefined();
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it('should throw an error during prompt if entityId is invalid', async () => {
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });
    await expect(adapter.prompt(null, [])).rejects.toThrow(
      'entityId must be a non-empty string'
    );
    await expect(adapter.prompt('', [])).rejects.toThrow(
      'entityId must be a non-empty string'
    );
    await expect(adapter.prompt(123, [])).rejects.toThrow(
      'entityId must be a non-empty string'
    );
  });

  it('should throw an error during prompt if availableActions is not an array', async () => {
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });
    await expect(adapter.prompt('player1', null)).rejects.toThrow(
      'availableActions must be an array'
    );
    await expect(adapter.prompt('player1', {})).rejects.toThrow(
      'availableActions must be an array'
    );
    await expect(adapter.prompt('player1', 'not-an-array')).rejects.toThrow(
      'availableActions must be an array'
    );
  });

  it('should call dispatchSafely with correct arguments when using ISafeEventDispatcher', async () => {
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });
    const entityId = 'player1';
    const actions = [
      { id: 'act1', command: 'do act1' },
      { id: 'act2', command: 'do act2' },
    ];
    const errorMsg = 'Invalid command.';

    await adapter.prompt(entityId, actions, errorMsg);

    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
      'core:player_turn_prompt',
      {
        entityId: entityId,
        availableActions: actions,
        error: errorMsg,
      }
    );
  });

  it('should call dispatchSafely without error property if error is null or empty', async () => {
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });
    const entityId = 'player2';
    const actions = [{ id: 'act3', command: 'do act3' }];

    await adapter.prompt(entityId, actions, null);
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
      'core:player_turn_prompt',
      {
        entityId: entityId,
        availableActions: actions,
        // No error property
      }
    );

    mockSafeDispatcher.dispatchSafely.mockClear();
    await adapter.prompt(entityId, actions, ''); // Empty string error
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
      'core:player_turn_prompt',
      {
        entityId: entityId,
        availableActions: actions,
        // No error property
      }
    );

    mockSafeDispatcher.dispatchSafely.mockClear();
    await adapter.prompt(entityId, actions, '   '); // Whitespace only error
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledWith(
      'core:player_turn_prompt',
      {
        entityId: entityId,
        availableActions: actions,
        // No error property
      }
    );
  });

  it('should call dispatchValidated with correct arguments when using IValidatedEventDispatcher', async () => {
    const adapter = new EventBusPromptAdapter({
      validatedEventDispatcher: mockVed,
    });
    const entityId = 'player3';
    const actions = [];
    const errorMsg = 'Another error.';

    await adapter.prompt(entityId, actions, errorMsg);

    expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(mockVed.dispatchValidated).toHaveBeenCalledWith(
      'core:player_turn_prompt',
      {
        entityId: entityId,
        availableActions: actions,
        error: errorMsg,
      }
    );
    expect(mockSafeDispatcher.dispatchSafely).not.toHaveBeenCalled(); // Ensure safe wasn't called
  });

  it('should resolve void even if dispatchSafely returns false', async () => {
    mockSafeDispatcher.dispatchSafely.mockResolvedValueOnce(false); // Simulate dispatch failure
    const adapter = new EventBusPromptAdapter({
      safeEventDispatcher: mockSafeDispatcher,
    });
    const entityId = 'player4';
    const actions = [];

    // Expect the promise to resolve successfully (void)
    await expect(adapter.prompt(entityId, actions)).resolves.toBeUndefined();
    expect(mockSafeDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
  });

  it('should resolve void if dispatchValidated succeeds', async () => {
    mockVed.dispatchValidated.mockResolvedValueOnce(true);
    const adapter = new EventBusPromptAdapter({
      validatedEventDispatcher: mockVed,
    });
    const entityId = 'player5';
    const actions = [];

    await expect(adapter.prompt(entityId, actions)).resolves.toBeUndefined();
    expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
  });

  it('should reject if dispatchValidated throws an error', async () => {
    const dispatchError = new Error('VED dispatch failed');
    mockVed.dispatchValidated.mockRejectedValueOnce(dispatchError);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error
    const adapter = new EventBusPromptAdapter({
      validatedEventDispatcher: mockVed,
    });
    const entityId = 'player6';
    const actions = [];

    await expect(adapter.prompt(entityId, actions)).rejects.toThrow(
      dispatchError
    );
    expect(mockVed.dispatchValidated).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error dispatching 'core:player_turn_prompt' via VED"
      ),
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});
// --- FILE END ---
