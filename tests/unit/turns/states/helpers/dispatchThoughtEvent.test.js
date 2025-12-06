import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ENTITY_THOUGHT_ID } from '../../../../../src/constants/eventIds.js';

const MODULE_PATH =
  '../../../../../src/turns/states/helpers/dispatchThoughtEvent.js';
const CONTEXT_UTILS_PATH =
  '../../../../../src/turns/states/helpers/contextUtils.js';

describe('dispatchThoughtEvent', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('dispatches thought events when available and resolves gracefully otherwise', async () => {
    const dispatchMock = jest.fn().mockResolvedValue(undefined);
    const getDispatcherMock = jest
      .fn()
      .mockReturnValueOnce({ dispatch: dispatchMock })
      .mockReturnValueOnce(null);

    const results = [];

    await jest.isolateModulesAsync(async () => {
      jest.doMock(CONTEXT_UTILS_PATH, () => ({
        getSafeEventDispatcher: getDispatcherMock,
      }));

      const { dispatchThoughtEvent } = await import(MODULE_PATH);

      const turnContext = { turn: 'ctx' };
      const handler = { id: 'handler-1' };
      const actorId = 'actor-123';
      const payloadBase = { thought: 'pondering' };

      results.push(
        await dispatchThoughtEvent(turnContext, handler, actorId, payloadBase)
      );

      results.push(
        await dispatchThoughtEvent(null, { id: 'handler-2' }, 'actor-456', {
          memo: 'empty',
        })
      );
    });

    expect(results).toEqual([undefined, undefined]);
    expect(getDispatcherMock).toHaveBeenNthCalledWith(
      1,
      { turn: 'ctx' },
      { id: 'handler-1' }
    );
    expect(getDispatcherMock).toHaveBeenNthCalledWith(2, null, {
      id: 'handler-2',
    });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(ENTITY_THOUGHT_ID, {
      entityId: 'actor-123',
      thought: 'pondering',
    });
  });
});
