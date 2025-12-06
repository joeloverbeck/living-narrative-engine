import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { createMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';

const silenceConsole = () => {
  const spies = [
    jest.spyOn(console, 'log').mockImplementation(() => {}),
    jest.spyOn(console, 'info').mockImplementation(() => {}),
    jest.spyOn(console, 'warn').mockImplementation(() => {}),
    jest.spyOn(console, 'error').mockImplementation(() => {}),
    jest.spyOn(console, 'debug').mockImplementation(() => {}),
  ];

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
};

describe('metrics middleware unknown error classification integration', () => {
  /** @type {() => void} */
  let restoreConsole;

  beforeEach(() => {
    restoreConsole = silenceConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  it('classifies anomalous status code objects as unknown errors with low severity', () => {
    const logger = new ConsoleLogger();
    const metricsService = new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: false,
    });

    const recordHttpRequestSpy = jest.spyOn(
      metricsService,
      'recordHttpRequest'
    );
    const recordErrorSpy = jest.spyOn(metricsService, 'recordError');

    const middleware = createMetricsMiddleware({
      metricsService,
      logger,
      enabled: true,
    });

    const statusCodeProxy = {
      callIndex: 0,
      valueOf() {
        this.callIndex += 1;
        if (this.callIndex === 1) {
          // The middleware sees a value >= 400 and attempts to classify the error.
          return 450;
        }
        // Subsequent numeric coercions should appear as a non-error status.
        return 0;
      },
      toString() {
        return 'status-code-proxy';
      },
    };

    const req = {
      method: 'POST',
      path: '/diagnostics',
      originalUrl: '/diagnostics?source=test',
      headers: {},
      get: jest.fn(() => undefined),
      correlationId: 'correlation-unknown-error',
    };

    const res = {
      statusCode: statusCodeProxy,
      headersSent: false,
      get: jest.fn(() => undefined),
      _finishHandler: undefined,
      on(event, handler) {
        if (event === 'finish') {
          this._finishHandler = handler;
        }
      },
      end: jest.fn(function (data) {
        this.headersSent = true;
        if (this._finishHandler) {
          this._finishHandler();
        }
        return data;
      }),
    };

    const next = jest.fn(() => {
      res.end('ok');
    });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
    expect(recordErrorSpy).toHaveBeenCalledTimes(1);

    const [[errorRecord]] = recordErrorSpy.mock.calls;
    expect(errorRecord.errorType).toBe('unknown_error');
    expect(errorRecord.severity).toBe('low');
    expect(errorRecord.component).toBe('http_server');

    metricsService.clear();
  });
});
