import fs from 'fs/promises';
import path from 'path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
const LOG_ROOT = path.resolve('./logs');

async function removeLogsDirectory() {
  await fs.rm(LOG_ROOT, { recursive: true, force: true });
}

async function loadModule({ fetchImplementation = fetchMock } = {}) {
  jest.resetModules();
  fetchMock.mockReset();
  globalThis.fetch = fetchImplementation;
  return import('../../../test-log-flushing.js');
}

describe('test-log-flushing utility functions', () => {
  beforeEach(async () => {
    await removeLogsDirectory();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
    await removeLogsDirectory();
  });

  test('generateTestLogs creates deterministic log entries when Math.random is controlled', async () => {
    const module = await loadModule();
    const { generateTestLogs } = module;

    const randomSequence = [0, 0, 0.75, 0.5];
    const randomSpy = jest
      .spyOn(Math, 'random')
      .mockImplementation(() => randomSequence.shift() ?? 0.25);

    const logs = generateTestLogs(2);

    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        level: 'debug',
        category: 'engine',
        message: expect.stringContaining('Test log message 1'),
        metadata: expect.objectContaining({
          testRun: true,
          index: 1,
        }),
      })
    );
    expect(typeof logs[0].timestamp).toBe('string');
    expect(typeof logs[0].metadata.timestamp).toBe('number');

    expect(logs[1]).toEqual(
      expect.objectContaining({
        level: 'error',
        category: 'entities',
        message: expect.stringContaining('Test log message 2'),
        metadata: expect.objectContaining({
          testRun: true,
          index: 2,
        }),
      })
    );

    randomSpy.mockRestore();
  });

  test('generateTestLogs uses a default batch size when count is not provided', async () => {
    const module = await loadModule();
    const { generateTestLogs } = module;

    const logs = generateTestLogs();

    expect(Array.isArray(logs)).toBe(true);
    expect(logs).toHaveLength(10);
  });

  test('sendLogs posts payloads to the API endpoint and returns JSON', async () => {
    const module = await loadModule();
    const { sendLogs } = module;
    const payload = [{ level: 'info', message: 'hello' }];

    const jsonSpy = jest.fn().mockResolvedValue({ status: 'ok' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: jsonSpy });

    const result = await sendLogs(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/debug-log',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ logs: payload }),
      }
    );
    expect(jsonSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ok' });
  });

  test('sendLogs logs and rethrows errors when response is not OK', async () => {
    const module = await loadModule();
    const { sendLogs } = module;
    const payload = [{ level: 'warn', message: 'uh oh' }];

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'nope' }),
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(sendLogs(payload)).rejects.toThrow('HTTP error! status: 500');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send logs:',
      'HTTP error! status: 500'
    );

    consoleErrorSpy.mockRestore();
  });

  test('sendLogs throws a descriptive error when global fetch is unavailable', async () => {
    const module = await loadModule({ fetchImplementation: null });
    const { sendLogs } = module;

    await expect(
      sendLogs([{ level: 'info', message: 'test' }])
    ).rejects.toThrow('Global fetch API is not available in this runtime.');
  });

  test('checkLogFiles reports existing files and returns true', async () => {
    const module = await loadModule();
    const { checkLogFiles } = module;

    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('./logs', today);
    const todayAbsolute = path.resolve(todayDir);
    const proxyContent = 'entry-one\nentry-two\n';
    const debugContent = 'alpha\n\n beta ';

    await fs.mkdir(todayAbsolute, { recursive: true });
    await fs.writeFile(path.join(todayAbsolute, 'proxy.log'), proxyContent);
    await fs.writeFile(path.join(todayAbsolute, 'debug.log'), debugContent);

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const result = await checkLogFiles();

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Log files in ${todayDir}:`)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `proxy.log: ${Buffer.byteLength(proxyContent, 'utf8')} bytes, 2 log entries`
      )
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `debug.log: ${Buffer.byteLength(debugContent, 'utf8')} bytes, 2 log entries`
      )
    );

    consoleLogSpy.mockRestore();
  });

  test('checkLogFiles logs failures and returns false', async () => {
    const module = await loadModule();
    const { checkLogFiles } = module;

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await checkLogFiles();

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to check log files:',
      expect.stringContaining('ENOENT')
    );

    consoleErrorSpy.mockRestore();
  });

  test('testLogFlushing orchestrates batches and reports success', async () => {
    const module = await loadModule();
    const { testLogFlushing } = module;

    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('./logs', today);
    const todayAbsolute = path.resolve(todayDir);
    await fs.mkdir(todayAbsolute, { recursive: true });
    await fs.writeFile(path.join(todayAbsolute, 'proxy.log'), 'ready');

    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: 'ok' }),
      })
    );

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0;
      });

    await testLogFlushing();

    const messages = consoleLogSpy.mock.calls.map(([message]) => message);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(messages.some((message) => message.includes('Batch 1:'))).toBe(true);
    expect(messages.some((message) => message.includes('Batch 2:'))).toBe(true);
    expect(messages.some((message) => message.includes('Batch 3:'))).toBe(true);
    expect(
      messages.some((message) =>
        message.includes(
          '✅ TEST PASSED: Logs are being flushed to files properly!'
        )
      )
    ).toBe(true);

    timeoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('testLogFlushing logs failures when batches or final checks do not succeed', async () => {
    const module = await loadModule();
    const { testLogFlushing } = module;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: 'ok' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'nope' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: 'ok' }),
      });

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0;
      });

    await testLogFlushing();

    const messages = consoleLogSpy.mock.calls.map(([message]) => message);

    expect(
      messages.some((message) => message.includes('❌ Failed to send batch 2'))
    ).toBe(true);
    expect(
      messages.some((message) =>
        message.includes('⚠️ No log files found yet...')
      )
    ).toBe(true);
    expect(
      messages.some((message) =>
        message.includes('❌ TEST FAILED: No log files found.')
      )
    ).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send logs:',
      'HTTP error! status: 500'
    );

    timeoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('direct execution bootstrap triggers when script is invoked directly', async () => {
    jest.resetModules();

    const originalEnv = process.env.NODE_ENV;
    const originalArgv = [...process.argv];
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ status: 'ok' }),
    });
    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback) => {
        callback();
        return 0;
      });

    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('./logs', today);
    await fs.mkdir(path.resolve(todayDir), { recursive: true });

    globalThis.fetch = fetchSpy;
    process.env.NODE_ENV = 'development';
    process.argv = [
      '/usr/bin/node',
      path.join(process.cwd(), 'test-log-flushing.js'),
    ];

    try {
      const module = await import('../../../test-log-flushing.js');

      await module.directExecutionPromise;

      expect(timeoutSpy).toHaveBeenCalled();
      expect(
        consoleLogSpy.mock.calls.some(
          ([message]) =>
            message === '🧪 Starting Windows Terminal Log Flush Test'
        )
      ).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
      globalThis.fetch = originalFetch;
      timeoutSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      jest.resetModules();
    }
  });

  test('direct execution bootstrap remains disabled when running in test environment', async () => {
    jest.resetModules();

    const originalEnv = process.env.NODE_ENV;
    const originalArgv = [...process.argv];
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    process.env.NODE_ENV = 'test';
    process.argv = [
      '/usr/bin/node',
      path.join(process.cwd(), 'test-log-flushing.js'),
    ];

    try {
      const module = await import('../../../test-log-flushing.js');

      expect(module.directExecutionPromise).toBeNull();
      expect(timeoutSpy).not.toHaveBeenCalled();
      expect(
        consoleLogSpy.mock.calls.some(
          ([message]) =>
            message === '🧪 Starting Windows Terminal Log Flush Test'
        )
      ).toBe(false);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
      timeoutSpy.mockRestore();
      consoleLogSpy.mockRestore();
      jest.resetModules();
    }
  });
});
