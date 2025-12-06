import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = process.env;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  process,
  'platform'
);
const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

describe('Log formatter environment integration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.LOG_ICON_MODE = 'true';
    delete process.env.LOG_FORCE_EMOJI;
    delete process.env.LOG_DISABLE_EMOJI;
    delete process.env.TERM_PROGRAM;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.WSL_DISTRO_NAME;
    delete process.env.WT_SESSION;
    delete process.env.TERM;

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

    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }

    jest.restoreAllMocks();
  });

  it('enables emoji icons when terminal metadata advertises support', async () => {
    process.env.TERM_PROGRAM = 'vscode';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('CacheService: warmed entries for downstream clients', {
      batchSize: 5,
    });

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('💾');
    expect(output).not.toContain('[CACHE]');
  });

  it('falls back to ASCII icons when running under constrained WSL terminals', async () => {
    process.env.WSL_DISTRO_NAME = 'Ubuntu';
    process.env.TERM = 'xterm';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('CacheService: warmed entries for downstream clients', {
      batchSize: 3,
    });

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('[CACHE]');
    expect(output).not.toContain('💾');
  });

  it('recognises Windows Terminal sessions and respects circular payload formatting failures', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: false,
      enumerable: true,
      configurable: true,
    });

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    // Without WT_SESSION the formatter should fall back to ASCII icons on Windows
    logger.info('CacheService: warmed entries for downstream clients', {
      batchSize: 2,
    });

    const firstOutput = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(firstOutput).toContain('[CACHE]');
    expect(firstOutput).not.toContain('💾');

    // Reset modules so the formatter reevaluates environment flags
    jest.resetModules();
    process.env.WT_SESSION = '1';
    process.env.LOG_ICON_MODE = 'true';

    const { getEnhancedConsoleLogger: getLoggerWithSession } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const loggerWithSession = getLoggerWithSession();

    const bigintContext = { session: BigInt(42) };
    const bigintDetail = { attempts: BigInt(1) };

    loggerWithSession.info(
      'CacheService: warmed entries for downstream clients',
      bigintContext,
      'stream complete',
      bigintDetail
    );

    const sessionOutput = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(sessionOutput).toContain('💾');
    expect(sessionOutput).toContain('stream complete');
    expect(sessionOutput).toContain('[Unable to format:');
  });
});
