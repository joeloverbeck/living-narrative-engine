import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

function setTtyCapabilities() {
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

describe('Enhanced console logger fallback resilience', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_FORCE_EMOJI = 'true';
    process.env.LOG_ICON_MODE = 'true';
    setTtyCapabilities();

    const stableChalk = {
      blue: (value) => value,
      green: (value) => value,
      yellow: (value) => value,
      cyan: (value) => value,
      red: Object.assign((value) => value, {
        bold: (value) => value,
      }),
      gray: Object.assign((value) => value, {
        italic: (value) => value,
      }),
    };

    globalThis.chalk = stableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = stableChalk;
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };

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

  test('recovers with fallback formatting when argument sanitization throws', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    const hazardousContext = {
      safe: 'value',
      get token() {
        throw new Error('token inspection denied');
      },
    };

    const supplementalDetail = { attempt: 'fallback-path' };

    logger.info(
      'SecurityService: initiating fallback pathway validation',
      hazardousContext,
      supplementalDetail
    );

    expect(errorSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Formatting error, falling back to simple output'
    );

    const fallbackCall = infoSpy.mock.calls.find(
      ([firstArg]) =>
        typeof firstArg === 'string' &&
        firstArg.startsWith(
          '[FALLBACK] INFO: SecurityService: initiating fallback pathway validation'
        )
    );

    expect(fallbackCall).toBeDefined();
    expect(fallbackCall?.[1]).toBe(hazardousContext);
    expect(fallbackCall?.[2]).toBe(supplementalDetail);
  });
});
