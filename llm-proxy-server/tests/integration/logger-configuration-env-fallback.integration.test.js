import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/**
 * Builds a chalk-style stub so that colorized output can be detected in
 * assertions. Each method returns a tagged string describing the color that
 * would have been applied.
 * @returns {Record<string, Function>} A chalk compatible stub implementation.
 */
const createChalkStub = () => {
  const build = (label) => {
    const fn = (text) => `[${label}]${text}`;
    return fn;
  };

  const greenBase = build('green');
  const grayBase = build('gray');
  grayBase.italic = (text) => `[grayItalic]${text}`;

  return {
    cyan: build('cyan'),
    green: greenBase,
    yellow: build('yellow'),
    red: build('red'),
    blue: build('blue'),
    gray: grayBase,
  };
};

/**
 * Overrides the process stdout/stderr TTY descriptors so the logger exercises
 * the defensive branch that treats missing descriptors as interactive shells.
 * @param {unknown} stdoutValue
 * @param {unknown} stderrValue
 */
const overrideTTYDescriptors = (stdoutValue, stderrValue) => {
  Object.defineProperty(process.stdout, 'isTTY', {
    value: stdoutValue,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(process.stderr, 'isTTY', {
    value: stderrValue,
    configurable: true,
    writable: true,
  });
};

describe('logger configuration environment fallback integration', () => {
  let originalEnv;
  let originalStdoutDescriptor;
  let originalStderrDescriptor;
  let originalStdoutValue;
  let originalStderrValue;
  let originalChalk;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    originalEnv = { ...process.env };
    originalStdoutDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      'isTTY'
    );
    originalStderrDescriptor = Object.getOwnPropertyDescriptor(
      process.stderr,
      'isTTY'
    );
    originalStdoutValue = process.stdout.isTTY;
    originalStderrValue = process.stderr.isTTY;
    originalChalk = global.chalk;

    delete global.chalk;
  });

  afterEach(() => {
    process.env = originalEnv;

    if (originalStdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalStdoutDescriptor);
    } else {
      process.stdout.isTTY = originalStdoutValue;
    }

    if (originalStderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', originalStderrDescriptor);
    } else {
      process.stderr.isTTY = originalStderrValue;
    }

    if (originalChalk === undefined) {
      delete global.chalk;
    } else {
      global.chalk = originalChalk;
    }
  });

  it('falls back to development defaults when NODE_ENV is unset and keeps colorised output', async () => {
    delete process.env.NODE_ENV;
    overrideTTYDescriptors(undefined, undefined);

    const chalkStub = createChalkStub();
    global.chalk = chalkStub;

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { default: EnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = new EnhancedConsoleLogger();

    const { getLoggerConfiguration } = await import(
      '../../src/logging/loggerConfiguration.js'
    );
    const config = getLoggerConfiguration().getConfig();

    expect(config.environment).toBe('development');
    expect(config.enableColors).toBe(true);

    logger.info('environment fallback exercised', { integration: true });

    expect(infoSpy).toHaveBeenCalled();
    const loggedMessage = infoSpy.mock.calls[0][0];
    expect(loggedMessage).toContain('[green]');
    expect(loggedMessage).toContain('environment fallback exercised');

    infoSpy.mockRestore();
  });
});
