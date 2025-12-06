import {
  beforeEach,
  afterEach,
  describe,
  expect,
  test,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = process.env;
const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

/**
 * Ensures the logger evaluates terminal capabilities in a consistent way across tests.
 */
function configureTty() {
  if (stdoutDescriptor?.configurable) {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    });
  }

  if (stderrDescriptor?.configurable) {
    Object.defineProperty(process.stderr, 'isTTY', {
      configurable: true,
      value: true,
    });
  }
}

describe('Enhanced console logger fallback behaviour integration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    configureTty();
    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }
    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    }
    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }
    jest.restoreAllMocks();
  });

  test('suppresses development-only test output when not running in development mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.testOutput();

    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
    );
  });

  test('falls back to simple output when console methods are unavailable and preserves additional arguments', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const originalInfo = console.info;

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Simulate an execution environment where console.info is not available.
    // This forces the logger to enter its fallback path after the initial logging attempt fails.
    // @ts-ignore - intentional runtime mutation for test coverage.
    console.info = undefined;

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    const payload = { stage: 'integration', token: 'should-mask' };

    logger.info('Observability check', 42, payload);

    expect(errorSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Formatting error, falling back to simple output'
    );

    const fallbackCall = logSpy.mock.calls.find(
      ([message]) =>
        typeof message === 'string' &&
        message.startsWith('[FALLBACK] INFO: Observability check')
    );

    expect(fallbackCall).toBeDefined();
    expect(fallbackCall?.[1]).toBe(42);
    expect(fallbackCall?.[2]).toEqual({
      stage: 'integration',
      token: 'should-mask',
    });

    console.info = originalInfo;
  });
});
