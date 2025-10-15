import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const fetchMock = jest.fn();
const readdirMock = jest.fn();
const statMock = jest.fn();
const readFileMock = jest.fn();

async function loadModule() {
  jest.resetModules();

  fetchMock.mockReset();
  readdirMock.mockReset();
  statMock.mockReset();
  readFileMock.mockReset();

  jest.unstable_mockModule(
    'node-fetch',
    () => ({
      default: fetchMock,
      __esModule: true,
    }),
    { virtual: true }
  );

  jest.unstable_mockModule('fs/promises', () => ({
    __esModule: true,
    readdir: readdirMock,
    stat: statMock,
    readFile: readFileMock,
  }));

  return import('../../../test-log-flushing.js');
}

describe('test-log-flushing utility functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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

    const errorResponse = { error: 'nope' };
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue(errorResponse),
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

  test('checkLogFiles reports existing files and returns true', async () => {
    jest.useFakeTimers({ now: new Date('2025-01-02T03:04:05Z') });

    const module = await loadModule();
    const { checkLogFiles } = module;

    readdirMock.mockResolvedValue(['proxy.log', 'debug.log']);
    statMock
      .mockResolvedValueOnce({ size: 128 })
      .mockResolvedValueOnce({ size: 256 });
    readFileMock
      .mockResolvedValueOnce('entry-one\nentry-two\n')
      .mockResolvedValueOnce('alpha\n\n beta ');

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const result = await checkLogFiles();

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Log files in logs/2025-01-02:')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('proxy.log: 128 bytes, 2 log entries')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('debug.log: 256 bytes, 2 log entries')
    );

    consoleLogSpy.mockRestore();
  });

  test('checkLogFiles logs failures and returns false', async () => {
    const module = await loadModule();
    const { checkLogFiles } = module;

    const failure = new Error('cannot read directory');
    readdirMock.mockRejectedValue(failure);

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await checkLogFiles();

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to check log files:',
      failure.message
    );

    consoleErrorSpy.mockRestore();
  });

  test('testLogFlushing orchestrates batches and reports success', async () => {
    const module = await loadModule();
    const { testLogFlushing } = module;

    const generateSpy = jest
      .spyOn(module, 'generateTestLogs')
      .mockReturnValue([{ level: 'info', message: 'ok' }]);
    const sendSpy = jest
      .spyOn(module, 'sendLogs')
      .mockResolvedValue({ status: 'ok' });
    const checkSpy = jest
      .spyOn(module, 'checkLogFiles')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    jest.useFakeTimers();

    const promise = testLogFlushing();

    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();

    await promise;

    expect(generateSpy).toHaveBeenCalledTimes(3);
    expect(generateSpy).toHaveBeenCalledWith(15);
    expect(sendSpy).toHaveBeenCalledTimes(3);
    expect(checkSpy).toHaveBeenCalledTimes(5);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ TEST PASSED: Logs are being flushed to files properly!')
    );

    consoleLogSpy.mockRestore();
  });

  test('testLogFlushing logs failures when batches or final checks do not succeed', async () => {
    const module = await loadModule();
    const { testLogFlushing } = module;

    jest
      .spyOn(module, 'generateTestLogs')
      .mockReturnValue([{ level: 'warn', message: 'retry' }]);

    jest
      .spyOn(module, 'sendLogs')
      .mockResolvedValueOnce({ status: 'ok' })
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ status: 'ok' });

    jest
      .spyOn(module, 'checkLogFiles')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    jest.useFakeTimers();

    const promise = testLogFlushing();

    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();
    await jest.runOnlyPendingTimersAsync();

    await promise;

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Failed to send batch 2')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ No log files found yet...')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ TEST FAILED: No log files found.')
    );

    consoleLogSpy.mockRestore();
  });
});
