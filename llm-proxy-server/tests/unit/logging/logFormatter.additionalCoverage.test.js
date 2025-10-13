import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const baseConfigMock = {
  isIconsEnabled: () => false,
  shouldShowContext: () => true,
  getMaxMessageLength: () => 120,
  getTimestampFormat: () => 'HH:mm:ss.SSS',
};

describe('LogFormatter additional coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const setupFormatter = async (configOverrides = {}) => {
    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        ...baseConfigMock,
        ...configOverrides,
      }),
    }));

    const { getLogFormatter } = await import(
      '../../../src/logging/logFormatter.js'
    );

    return getLogFormatter();
  };

  it('captures formatting errors for complex context objects', async () => {
    const formatter = await setupFormatter();

    const circularContext = {};
    circularContext.self = circularContext;

    const result = formatter.formatMessage('info', 'circular context', circularContext);

    expect(result.contextLines).toHaveLength(1);
    expect(result.contextLines[0]).toContain('Unable to format');
    expect(result.contextLines[0]).toContain('circular');
  });

  it('captures formatting errors for additional detail arguments', async () => {
    const formatter = await setupFormatter();

    const context = { requestId: 'abc123' };
    const problematicDetail = {
      toJSON: () => {
        throw new Error('detail explosion');
      },
    };

    const result = formatter.formatMessage(
      'warn',
      'detail formatting error',
      context,
      problematicDetail
    );

    expect(result.contextLines.length).toBeGreaterThan(1);
    const detailLine = result.contextLines.find((line) =>
      line.includes('↳ Details[0]:')
    );
    expect(detailLine).toContain('Unable to format: detail explosion');
  });

  it('truncates oversized detail payloads to maintain readability', async () => {
    const formatter = await setupFormatter();

    const context = { requestId: 'oversized' };
    const largeDetail = {
      payload: 'x'.repeat(200),
    };

    const result = formatter.formatMessage(
      'info',
      'large detail payload',
      context,
      largeDetail
    );

    expect(result.contextLines.length).toBeGreaterThan(1);
    const detailLine = result.contextLines.find((line) =>
      line.includes('↳ Details[0]:')
    );
    expect(detailLine).toMatch(/\.\.\.$/);
    expect(detailLine.length).toBeLessThan(150);
  });
});
