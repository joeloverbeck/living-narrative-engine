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

/**
 * Restores environment variables mutated during the test run.
 */
function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('log formatter terminal + detail integration coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    restoreEnv();

    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_COLOR_MODE = 'never';

    delete process.env.LOG_FORCE_EMOJI;
    delete process.env.LOG_DISABLE_EMOJI;
    delete process.env.TERM_PROGRAM;
    delete process.env.WSL_DISTRO_NAME;
    delete process.env.WT_SESSION;

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
    restoreEnv();

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
  });

  it('detects emoji support through TERMINAL_EMULATOR metadata when TERM_PROGRAM is absent', async () => {
    process.env.TERMINAL_EMULATOR = 'kitty';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { ConsoleLogger } = await import('../../src/consoleLogger.js');
    const logger = new ConsoleLogger();

    logger.info('CacheService: refreshing terminal emulator detection path');

    expect(infoSpy).toHaveBeenCalled();
    const output = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('💾');
  });

  it('formats short detail payloads without truncation while preserving context blocks', async () => {
    process.env.LOG_MAX_MESSAGE_LENGTH = '200';
    process.env.LOG_FORCE_EMOJI = 'true';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { ConsoleLogger } = await import('../../src/consoleLogger.js');
    const logger = new ConsoleLogger();

    logger.warn(
      'SecurityService: concise detail formatting coverage',
      { requestId: 'det-123' },
      { outcome: 'allowed', attempts: 2 }
    );

    expect(warnSpy).toHaveBeenCalled();
    const output = warnSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(output).toContain('↳ Context: {');
    expect(output).toContain('requestId');
    expect(output).toContain('↳ Details[0]: {');
    expect(output).toMatch(
      /↳ Details\[0\]: \{[\s\S]*"outcome": "allowed",[\s\S]*"attempts": 2[\s\S]*\}/
    );
    expect(output).not.toMatch(/Details\[0\]: .*\.\.\./);
  });
});
