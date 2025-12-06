import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LOG_ENHANCED_FORMATTING;
  delete process.env.LOG_CONTEXT_PRETTY_PRINT;
  delete process.env.LOG_ICON_MODE;
  delete process.env.LOG_MAX_MESSAGE_LENGTH;
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
  delete process.env.LOG_COLOR_MODE;
  delete process.env.TERM_PROGRAM;
  delete process.env.TERMINAL_EMULATOR;
  delete process.env.WSL_DISTRO_NAME;
  delete process.env.WT_SESSION;
};

const importConsoleLogger = async () => {
  jest.resetModules();
  const module = await import('../../src/consoleLogger.js');
  return module.ConsoleLogger;
};

const importLogFormatter = async () => {
  jest.resetModules();
  const module = await import('../../src/logging/logFormatter.js');
  return module.getLogFormatter;
};

describe('enhanced log formatter integration coverage', () => {
  beforeEach(() => {
    resetEnv();
    delete global.chalk;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEnv();
    delete global.chalk;
  });

  test('renders multi-line pretty logs with context blocks and truncated details', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_MAX_MESSAGE_LENGTH = '40';
    process.env.LOG_FORCE_EMOJI = 'true';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.TERM_PROGRAM = 'vscode';

    const ConsoleLogger = await importConsoleLogger();
    const logger = new ConsoleLogger();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const context = {
      requestId: 'req-789',
      payload: { size: 42, nested: { level: 'deep' } },
    };

    const longDetail = {
      chunk: 'x'.repeat(150),
    };

    logger.info(
      'CacheService: warming caches to hydrate integration coverage scenarios with extensive payload data 12345678901234567890',
      context,
      longDetail,
      'final-detail'
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0][0];

    expect(output).toContain('CacheService');
    expect(output).toContain('...');
    expect(output).toMatch(/(🔄|💾|\[REQ\]|\[CACHE\])/);

    const lines = output.split('\n');
    const contextStart = lines.find((line) => line.includes('↳ Context: {'));
    expect(contextStart).toBeDefined();
    expect(lines.some((line) => line.includes('"size": 42'))).toBe(true);
    expect(lines.some((line) => line.includes('↳ Details[0]:'))).toBe(true);
    expect(
      lines.some((line) => line.includes('↳ Details[1]: final-detail'))
    ).toBe(true);
  });

  test('gracefully handles unstringifiable context objects', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_FORCE_EMOJI = 'true';

    const getLogFormatter = await importLogFormatter();
    const formatter = getLogFormatter();

    const circular = { id: 'ctx-1' };
    circular.self = circular;

    const formatted = formatter.formatMessage(
      'info',
      'Startup process initializing core components',
      circular
    );

    expect(formatted.icon).toMatch(/(🚀|\[START\])/);
    expect(formatted.contextLines[0]).toContain(
      '↳ Context: [Unable to format:'
    );
  });

  test('falls back to console output when sanitization fails', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_FORCE_EMOJI = 'true';
    process.env.LOG_COLOR_MODE = 'never';

    const ConsoleLogger = await importConsoleLogger();
    const logger = new ConsoleLogger();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const circular = { id: 'ctx-1' };
    circular.self = circular;

    logger.info('Startup process initializing core components', circular);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0][0];
    expect(output).toContain(
      '[FALLBACK] INFO: Startup process initializing core components'
    );
  });

  test('falls back to simple formatting when enhanced mode is disabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_ENHANCED_FORMATTING = 'false';
    process.env.LOG_COLOR_MODE = 'never';

    const ConsoleLogger = await importConsoleLogger();
    const logger = new ConsoleLogger();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('LLM Proxy Server boot complete', { ready: true }, 'detail');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0][0];
    expect(output).toMatch(
      /\[\d{2}:\d{2}:\d{2}\.\d{3}\] INFO: LLM Proxy Server boot complete/
    );
    expect(output).toContain('{"ready":true} detail');
  });

  test('uses ASCII icons when emoji support is disabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_DISABLE_EMOJI = 'true';
    process.env.LOG_COLOR_MODE = 'never';

    const ConsoleLogger = await importConsoleLogger();
    const logger = new ConsoleLogger();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('SecurityService: validation failure detected', {
      ip: '127.0.0.1',
      reason: 'rate-limit',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const output = warnSpy.mock.calls[0][0];
    expect(output).toContain('[SEC]');
    expect(output).toContain('↳ Context: {');
    expect(output).toContain('"reason": "rate-limit"');
  });

  test('defaults to system context and error icon for unmatched messages', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_DISABLE_EMOJI = 'true';
    process.env.LOG_COLOR_MODE = 'never';

    const ConsoleLogger = await importConsoleLogger();
    const logger = new ConsoleLogger();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('Unexpected meltdown occurred in pipeline', {
      phase: 'aggregation',
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('[ERR]');
    expect(output).toMatch(/System:/);
    expect(output).toContain('↳ Context: {');
    expect(output).toContain('"phase": "aggregation"');
  });
});
