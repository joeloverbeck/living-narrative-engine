import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
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
const ORIGINAL_STDOUT_VALUE = process.stdout.isTTY;
const ORIGINAL_STDERR_VALUE = process.stderr.isTTY;
const ORIGINAL_CHALK = global.chalk;

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LOG_ENHANCED_FORMATTING;
  delete process.env.LOG_CONTEXT_PRETTY_PRINT;
  delete process.env.LOG_ICON_MODE;
  delete process.env.LOG_COLOR_MODE;
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
  delete process.env.LOG_MAX_MESSAGE_LENGTH;
  delete process.env.TERM_PROGRAM;
  delete process.env.TERMINAL_EMULATOR;
  delete process.env.WSL_DISTRO_NAME;
  delete process.env.WT_SESSION;
}

describe('log formatter default fallback integration coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    resetEnv();

    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.LOG_DISABLE_EMOJI = 'true';

    if (stdoutDescriptor?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: true,
      });
    } else {
      process.stdout.isTTY = true;
    }

    if (stderrDescriptor?.configurable) {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: true,
      });
    } else {
      process.stderr.isTTY = true;
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEnv();

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    } else {
      process.stdout.isTTY = ORIGINAL_STDOUT_VALUE;
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    } else {
      process.stderr.isTTY = ORIGINAL_STDERR_VALUE;
    }

    if (ORIGINAL_CHALK === undefined) {
      delete globalThis.chalk;
      if (typeof global !== 'undefined') {
        delete global.chalk;
      }
    } else {
      global.chalk = ORIGINAL_CHALK;
    }
  });

  it('uses the default context icon when messages lack classification hints and respects disabled truncation limits', async () => {
    process.env.LOG_MAX_MESSAGE_LENGTH = '0';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { ConsoleLogger } = await import('../../src/consoleLogger.js');
    const logger = new ConsoleLogger();

    const message =
      'Neutral integration coverage message relying on default detection heuristics';

    logger.info(message, Object.create(null));

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0][0];

    expect(output).toMatch(/(📝|\[LOG\]) INFO System:/);
    expect(output).toContain(message);
    expect(output).toContain('↳ Context: {}');
    expect(output).not.toContain('...');

    warnSpy.mockRestore();
  });

  it('treats primitive payloads as detail entries when no context object is provided', async () => {
    const { getLogFormatter } = await import(
      '../../src/logging/logFormatter.js'
    );
    const formatter = getLogFormatter();

    const formatted = formatter.formatMessage(
      'info',
      'Auxiliary integration formatter coverage',
      'string-context'
    );

    expect(formatted.contextLines).toContain(
      '                    ↳ Details[0]: string-context'
    );
  });
});
