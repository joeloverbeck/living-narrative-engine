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
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
  delete process.env.LOG_COLOR_MODE;
  delete process.env.WSL_DISTRO_NAME;
  delete process.env.TERM;
  delete process.env.TERM_PROGRAM;
  delete process.env.WT_SESSION;
};

const restoreTty = () => {
  if (stdoutDescriptor) {
    Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
  }
  if (stderrDescriptor) {
    Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
  }
};

const importLogFormatter = async () => {
  jest.resetModules();
  const module = await import('../../src/logging/logFormatter.js');
  return module.getLogFormatter;
};

describe('log formatter integration additional branches', () => {
  beforeEach(() => {
    resetEnv();
    delete global.chalk;
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
  });

  it('falls back to ASCII icon mapping when WSL heuristics disable emoji support', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.WSL_DISTRO_NAME = 'Ubuntu';
    process.env.TERM = 'xterm';

    const getLogFormatter = await importLogFormatter();
    const formatter = getLogFormatter();

    const formatted = formatter.formatMessage(
      'info',
      'CacheService: priming branch coverage under WSL heuristics'
    );

    expect(formatted.icon).toBe('[CACHE]');
  });

  it('preserves full messages when LOG_MAX_MESSAGE_LENGTH is configured as non-positive', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_MAX_MESSAGE_LENGTH = '0';

    const getLogFormatter = await importLogFormatter();
    const formatter = getLogFormatter();

    const originalMessage = 'CacheService: ' + 'x'.repeat(150);
    const formatted = formatter.formatMessage('info', originalMessage);

    expect(formatted.message).toBe(originalMessage);
  });

  it('formats single-line context payloads and scalar detail values without multiline braces', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';

    const getLogFormatter = await importLogFormatter();
    const formatter = getLogFormatter();

    const context = {
      toJSON: () => 'single-line-context',
    };

    const formatted = formatter.formatMessage(
      'info',
      'CacheService: producing compact context output',
      context,
      'scalar-detail-value'
    );

    expect(formatted.contextLines).toContain(
      '                    ↳ Context: "single-line-context"'
    );
    expect(formatted.contextLines).toContain(
      '                    ↳ Details[0]: scalar-detail-value'
    );
  });
});
