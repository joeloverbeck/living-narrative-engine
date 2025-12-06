import AlertRouter from '../../../src/alerting/alertRouter.js';
import {
  SYSTEM_WARNING_OCCURRED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';

describe('AlertRouter error-handling coverage', () => {
  let dispatcher;
  let subscribedHandlers;
  let consoleErrorMock;
  let consoleWarnMock;

  const createRouter = () =>
    new AlertRouter({ safeEventDispatcher: dispatcher });

  beforeEach(() => {
    subscribedHandlers = {};
    dispatcher = {
      subscribe: jest.fn((eventId, handler) => {
        subscribedHandlers[eventId] = handler;
      }),
      dispatch: jest.fn(),
    };

    consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    consoleWarnMock = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs and swallows unexpected failures while handling incoming events', () => {
    const router = createRouter();
    router.queue.push = jest.fn(() => {
      throw new Error('queue failure');
    });

    subscribedHandlers[SYSTEM_WARNING_OCCURRED_ID]({
      payload: { message: 'ignored' },
    });

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'AlertRouter error:',
      expect.any(Error)
    );
  });

  it('flushes queued events to console and covers error branch output', () => {
    jest.useFakeTimers();
    const router = createRouter();

    router.queue = [
      {
        name: SYSTEM_WARNING_OCCURRED_ID,
        payload: { message: 'warn-message' },
      },
      { name: SYSTEM_ERROR_OCCURRED_ID, payload: { message: 'error-message' } },
    ];

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(consoleWarnMock).toHaveBeenCalledWith('warn-message');
    expect(consoleErrorMock).toHaveBeenCalledWith('error-message');
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('protects the flush loop from unexpected failures', () => {
    jest.useFakeTimers();
    const router = createRouter();
    const innerError = new Error('loop failure');

    router.queue = {
      forEach: jest.fn(() => {
        throw innerError;
      }),
    };

    router.startFlushTimer();
    jest.runOnlyPendingTimers();

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'AlertRouter flush error:',
      innerError
    );
    expect(router.queue).toEqual([]);
    expect(router.flushTimer).toBeNull();
  });

  it('keeps forwarding queued events but logs forwarding errors when UI becomes ready', () => {
    jest.useFakeTimers();
    const router = createRouter();

    router.flushTimer = setTimeout(() => undefined, 1000);
    router.queue = [
      { name: SYSTEM_WARNING_OCCURRED_ID, payload: { message: 'queued' } },
    ];
    router.forwardToUI = jest.fn(() => {
      throw new Error('forward failure');
    });

    router.notifyUIReady();

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'AlertRouter error forwarding queued event:',
      expect.any(Error)
    );
    expect(router.queue).toEqual([]);
    expect(router.uiReady).toBe(true);
    expect(router.flushTimer).toBeNull();
  });

  it('logs dispatch errors while forwarding live events to the UI', () => {
    const router = createRouter();
    dispatcher.dispatch.mockImplementation(() => {
      throw new Error('dispatch failure');
    });

    router.forwardToUI(SYSTEM_ERROR_OCCURRED_ID, { message: 'live' });

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'AlertRouter dispatch error:',
      expect.any(Error)
    );
  });
});
