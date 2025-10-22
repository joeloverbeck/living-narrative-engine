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

function configureTty() {
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

describe('Enhanced console logger degraded color handling integration', () => {
  let graySpy;
  let infoSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      LOG_ENHANCED_FORMATTING: 'true',
      LOG_CONTEXT_PRETTY_PRINT: 'true',
      LOG_COLOR_MODE: 'always',
      LOG_ICON_MODE: 'false',
      LOG_DISABLE_EMOJI: 'true',
    };

    configureTty();

    graySpy = jest.fn((value) => `gray(${value})`);
    // Explicitly omit the italic variant so the logger has to fall back to
    // plain-text rendering for context lines.
    graySpy.italic = undefined;

    const stableChalk = {
      blue: (value) => `blue(${value})`,
      green: (value) => `green(${value})`,
      yellow: (value) => `yellow(${value})`,
      cyan: (value) => `cyan(${value})`,
      red: Object.assign((value) => `red(${value})`, {
        bold: (value) => `red-bold(${value})`,
      }),
      gray: graySpy,
    };

    globalThis.chalk = stableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = stableChalk;
    }

    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
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
  });

  it('falls back to unstyled context lines when italic chalk helpers are unavailable', async () => {
    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('CacheService: hydrated operational cache entries', {
      batchSize: 4,
      nested: { token: 'sensitive-secret' },
    });

    expect(graySpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const [output] = infoSpy.mock.calls[0];
    const lines = output.split('\n');

    const timestampLine = lines[0];
    expect(timestampLine.startsWith('gray([')).toBe(true);

    const contextBlock = lines.filter((line) =>
      line.trimStart().startsWith('↳ Context:')
    );
    expect(contextBlock.length).toBeGreaterThan(0);
    contextBlock.forEach((line) => {
      expect(line).toContain('↳ Context:');
      expect(line).not.toContain('gray(');
    });
  });
});
