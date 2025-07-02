import { describe, test, expect, jest } from '@jest/globals';
import { dispatchSpeechEvent } from '../../../../../src/turns/states/helpers/dispatchSpeechEvent.js';
import { ENTITY_SPOKE_ID } from '../../../../../src/constants/eventIds.js';

describe('dispatchSpeechEvent', () => {
  test('dispatches using context dispatcher', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = { getSafeEventDispatcher: () => dispatcher };
    await dispatchSpeechEvent(ctx, null, 'a1', { speechContent: 'hi' });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(ENTITY_SPOKE_ID, {
      entityId: 'a1',
      speechContent: 'hi',
    });
  });

  test('falls back to handler dispatcher', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctx = { getSafeEventDispatcher: () => null };
    const handler = { getSafeEventDispatcher: () => dispatcher };
    await dispatchSpeechEvent(ctx, handler, 'a1', { speechContent: 'hi' });
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });

  test('resolves when dispatcher missing', async () => {
    const ctx = { getSafeEventDispatcher: () => null };
    await expect(
      dispatchSpeechEvent(ctx, { getSafeEventDispatcher: () => null }, 'a1', {
        speechContent: 'hi',
      })
    ).resolves.toBeUndefined();
  });
});
