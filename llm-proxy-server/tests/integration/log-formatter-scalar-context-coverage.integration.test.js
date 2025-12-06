import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
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

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LOG_ENHANCED_FORMATTING;
  delete process.env.LOG_CONTEXT_PRETTY_PRINT;
  delete process.env.LOG_ICON_MODE;
  delete process.env.LOG_MAX_MESSAGE_LENGTH;
  delete process.env.LOG_COLOR_MODE;
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
};

const restoreTty = () => {
  if (stdoutDescriptor?.configurable) {
    Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
  }
  if (stderrDescriptor?.configurable) {
    Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
  }
};

describe('log formatter scalar context integration coverage', () => {
  beforeEach(() => {
    resetEnv();
    jest.resetModules();
    delete global.chalk;
    delete globalThis.chalk;

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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEnv();
    restoreTty();
    delete global.chalk;
    delete globalThis.chalk;
  });

  it('pretty prints scalar-friendly context objects while stringifying primitive detail payloads', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';

    const { getLogFormatter } = await import(
      '../../src/logging/logFormatter.js'
    );
    const formatter = getLogFormatter();

    const context = {
      toJSON: () => 'scalar-context',
    };

    const formatted = formatter.formatMessage(
      'info',
      'CacheService: exercising primitive detail conversion',
      context,
      Symbol('scalar-detail'),
      404,
      false
    );

    expect(formatted.contextLines).toContain(
      '                    ↳ Context: "scalar-context"'
    );
    expect(formatted.contextLines).toContain(
      '                    ↳ Details[0]: Symbol(scalar-detail)'
    );
    expect(formatted.contextLines).toContain(
      '                    ↳ Details[1]: 404'
    );
    expect(formatted.contextLines).toContain(
      '                    ↳ Details[2]: false'
    );
  });

  it('suppresses context output while still recording primitive detail payloads when pretty printing is disabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'false';

    const { getLogFormatter } = await import(
      '../../src/logging/logFormatter.js'
    );
    const formatter = getLogFormatter();

    const formatted = formatter.formatMessage(
      'info',
      'CacheService: validating detail coverage without context',
      { requestId: 'abc123' },
      'simple-context-value'
    );

    expect(formatted.contextLines).toEqual([
      '                    ↳ Details[0]: simple-context-value',
    ]);
  });
});
