import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
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
const originalChalk = globalThis.chalk;

function resetEnvironment() {
  process.env = { ...ORIGINAL_ENV };
  process.env.NODE_ENV = 'development';
  process.env.LOG_ENHANCED_FORMATTING = 'true';
  process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
  process.env.LOG_ICON_MODE = 'true';
  process.env.LOG_COLOR_MODE = 'never';
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
  delete process.env.TERM_PROGRAM;
  delete process.env.TERMINAL_EMULATOR;
  delete process.env.WSL_DISTRO_NAME;
  delete process.env.WT_SESSION;
  delete process.env.TERM;
}

describe('enhanced console logger integration boundary coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    resetEnvironment();

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
    jest.restoreAllMocks();

    process.env = ORIGINAL_ENV;

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    }

    if (originalChalk === undefined) {
      delete globalThis.chalk;
      if (typeof global !== 'undefined') {
        delete global.chalk;
      }
    } else {
      globalThis.chalk = originalChalk;
      if (typeof global !== 'undefined') {
        global.chalk = originalChalk;
      }
    }
  });

  it('degrades to ASCII icons when WSL lacks terminal program metadata but TERM is non-standard', async () => {
    process.env.WSL_DISTRO_NAME = 'Ubuntu';
    process.env.TERM = 'xterm-256color';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('CacheService: warmed entries for downstream clients');

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('[CACHE]');
    expect(output).not.toContain('💾');
  });

  it('masks standalone tokens and preserves output when the primary message sanitizes to a falsy value', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    const longToken = 'A'.repeat(40);

    logger.warn('', longToken);

    expect(warnSpy).toHaveBeenCalled();
    const output = warnSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('WARN');
    expect(output).toContain('System');
    expect(output).toContain('AAAA' + '*'.repeat(36));
  });
});
