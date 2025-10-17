import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

async function loadFormatter() {
  const { getLogFormatter } = await import(
    '../../../src/logging/logFormatter.js'
  );

  return getLogFormatter();
}

describe('LogFormatter truncation edge cases', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns the original message when max length configuration is disabled', async () => {
    process.env.LOG_MAX_MESSAGE_LENGTH = '0';

    const formatter = await loadFormatter();
    const message = 'x'.repeat(120);

    const result = formatter.formatMessage('info', message);

    expect(result.message).toBe(message);
  });

  it('bypasses truncation for warning level entries even when a limit is configured', async () => {
    process.env.LOG_MAX_MESSAGE_LENGTH = '15';

    const formatter = await loadFormatter();
    const warningMessage = 'This warning message exceeds the threshold';

    const result = formatter.formatMessage('warn', warningMessage);

    expect(result.message).toBe(warningMessage);
  });
});
