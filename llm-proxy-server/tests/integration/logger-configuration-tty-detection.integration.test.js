import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/**
 * Create a chalk stub that tags formatted strings so we can
 * detect whether color formatting was applied.
 * @returns {Record<string, Function>} Chalk-like stub implementation
 */
const createChalkStub = () => {
  const build = (label) => {
    const fn = (text) => `[${label}]${text}`;
    return fn;
  };

  const grayBase = build('gray');
  grayBase.italic = (text) => `[grayItalic]${text}`;

  const redBase = build('red');
  redBase.bold = (text) => `[redBold]${text}`;

  return {
    cyan: build('cyan'),
    green: build('green'),
    yellow: build('yellow'),
    red: redBase,
    blue: build('blue'),
    gray: grayBase,
  };
};

/**
 * Override the TTY descriptors for stdout/stderr so that
 * LoggerConfiguration exercises the fallback detection branch.
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

describe('logger configuration TTY detection integration', () => {
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

    // Ensure the logger bootstraps with the stubbed chalk implementation.
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

  it('treats missing TTY indicators as interactive in development and keeps color formatting', async () => {
    process.env.NODE_ENV = 'development';
    overrideTTYDescriptors(undefined, undefined);

    const chalkStub = createChalkStub();
    global.chalk = chalkStub;

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { default: EnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );

    const logger = new EnhancedConsoleLogger();
    logger.info('dev-mode coverage exercise', { requestId: 'abc123' });

    expect(infoSpy).toHaveBeenCalled();
    const loggedOutput = infoSpy.mock.calls[0][0];

    expect(loggedOutput).toContain('[green]');
    expect(loggedOutput).toContain('dev-mode coverage exercise');
    expect(loggedOutput).toContain('abc123');

    infoSpy.mockRestore();
  });

  it('treats missing TTY indicators as non-interactive in production and disables colors', async () => {
    process.env.NODE_ENV = 'production';
    overrideTTYDescriptors(undefined, undefined);

    const chalkStub = createChalkStub();
    global.chalk = chalkStub;

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { default: EnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );

    const logger = new EnhancedConsoleLogger();
    logger.info('prod-mode coverage exercise', { requestId: 'xyz789' });

    expect(infoSpy).toHaveBeenCalled();
    const loggedOutput = infoSpy.mock.calls[0][0];

    expect(loggedOutput).not.toContain('[green]');
    expect(loggedOutput).toContain('prod-mode coverage exercise');
    expect(loggedOutput).toContain('xyz789');

    infoSpy.mockRestore();
  });
});
