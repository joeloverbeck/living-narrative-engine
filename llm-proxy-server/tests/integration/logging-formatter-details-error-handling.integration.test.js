import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
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

const importLogFormatter = async () => {
  jest.resetModules();
  const module = await import('../../src/logging/logFormatter.js');
  return module.getLogFormatter;
};

describe('log formatter integration detail serialization safeguards', () => {
  beforeEach(() => {
    resetEnv();
    delete global.chalk;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEnv();
    delete global.chalk;
  });

  it('captures serialization failures from detail arguments without disrupting context rendering', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_FORCE_EMOJI = 'true';
    process.env.LOG_COLOR_MODE = 'never';

    const getLogFormatter = await importLogFormatter();
    const formatter = getLogFormatter();

    const context = {
      subsystem: 'CacheService',
      operation: 'mutation',
    };

    const circularDetail = { id: 'detail-1' };
    circularDetail.self = circularDetail;

    const formatted = formatter.formatMessage(
      'info',
      'CacheService: exercising serialization guard rails for detail payloads',
      context,
      circularDetail,
      'secondary-detail'
    );

    expect(
      formatted.contextLines.some((line) => line.includes('↳ Context: {'))
    ).toBe(true);
    expect(
      formatted.contextLines.some((line) =>
        line.includes('↳ Details[0]: [Unable to format:')
      )
    ).toBe(true);
    expect(
      formatted.contextLines.some((line) =>
        line.includes('↳ Details[1]: secondary-detail')
      )
    ).toBe(true);
  });
});
