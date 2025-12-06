import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import HttpAgentService from '../../src/services/httpAgentService.js';

/**
 * Creates a logger that records structured log entries for later assertions.
 * @returns {{ logger: import('../../src/interfaces/coreServices.js').ILogger & { isDebugEnabled: boolean }, entries: Array<{ level: string, message: string, context?: object }> }}
 */
const createCapturingLogger = () => {
  const entries = [];
  return {
    entries,
    logger: {
      info: (message, context) =>
        entries.push({ level: 'info', message, context }),
      warn: (message, context) =>
        entries.push({ level: 'warn', message, context }),
      error: (message, context) =>
        entries.push({ level: 'error', message, context }),
      debug: (message, context) =>
        entries.push({ level: 'debug', message, context }),
      isDebugEnabled: true,
    },
  };
};

describe('HttpAgentService default threshold coverage', () => {
  /** @type {jest.SpiedFunction<typeof Date.now>} */
  let nowSpy;
  let currentTimestamp;

  beforeEach(() => {
    currentTimestamp = 0;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTimestamp);
  });

  afterEach(() => {
    if (nowSpy) {
      nowSpy.mockRestore();
    }
  });

  it('cleans idle agents using the default threshold and recognizes https agents without explicit ports', () => {
    const { logger, entries } = createCapturingLogger();
    const service = new HttpAgentService(logger, {
      adaptiveCleanupEnabled: false,
      baseCleanupIntervalMs: 600000,
      minCleanupIntervalMs: 600000,
    });

    try {
      const httpUrl = 'http://plain-http.example/resource';
      const httpsUrl = 'https://secure.test.example/trace';

      service.getAgent(httpUrl);
      service.getAgent(httpsUrl);

      expect(service.hasAgent('http://plain-http.example/follow-up')).toBe(
        true
      );
      expect(service.hasAgent(httpsUrl)).toBe(true);

      currentTimestamp = 600000;

      const cleanedWithDefaults = service.cleanupIdleAgents();
      expect(cleanedWithDefaults).toBe(2);
      expect(service.getActiveAgentCount()).toBe(0);
      expect(service.hasAgent(httpsUrl)).toBe(false);

      const aggregatedLog = entries.find(
        (entry) =>
          entry.level === 'info' &&
          typeof entry.message === 'string' &&
          entry.message.includes('Cleaned up 2 idle agents')
      );
      expect(aggregatedLog).toBeDefined();
    } finally {
      service.cleanup();
    }
  });
});
