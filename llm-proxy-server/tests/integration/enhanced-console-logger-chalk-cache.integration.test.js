import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

function configureTerminalCapabilities() {
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

describe('Enhanced console logger chalk caching integration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_ICON_MODE = 'true';

    configureTerminalCapabilities();

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
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
    jest.resetModules();
  });

  it('reuses cached chalk availability when the first lookup fails', async () => {
    let chalkAttemptCount = 0;
    jest.doMock('chalk', () => {
      chalkAttemptCount += 1;
      throw new Error('chalk module not available');
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { default: EnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );

    const firstLogger = new EnhancedConsoleLogger();
    firstLogger.info('CacheService: emits ascii formatting on first failure');

    expect(chalkAttemptCount).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const secondLogger = new EnhancedConsoleLogger();
    secondLogger.info('CacheService: continues using cached fallback state');

    expect(chalkAttemptCount).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(2);

    const emittedLines = infoSpy.mock.calls.map(([line]) => line).join('\n');
    expect(emittedLines).toContain(
      'CacheService: emits ascii formatting on first failure'
    );
    expect(emittedLines).toContain(
      'CacheService: continues using cached fallback state'
    );
  });
});
