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
const ORIGINAL_STDOUT_VALUE = process.stdout.isTTY;
const ORIGINAL_STDERR_VALUE = process.stderr.isTTY;

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  process.env.LOG_DISABLE_EMOJI = 'true';
  process.env.LOG_COLOR_MODE = 'never';
  delete process.env.LOG_FORCE_EMOJI;
};

describe('log formatter warn level truncation guard integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    resetEnv();

    if (stdoutDescriptor?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: true,
      });
    } else {
      process.stdout.isTTY = true;
    }

    if (stderrDescriptor?.configurable) {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: true,
      });
    } else {
      process.stderr.isTTY = true;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    resetEnv();

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    } else {
      process.stdout.isTTY = ORIGINAL_STDOUT_VALUE;
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    } else {
      process.stderr.isTTY = ORIGINAL_STDERR_VALUE;
    }
  });

  it('preserves long warning messages without truncation and formats details', async () => {
    const { ConsoleLogger } = await import('../../src/consoleLogger.js');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = new ConsoleLogger();

    const longWarning = 'cache-eviction-warning-branch'.repeat(8);

    logger.warn(longWarning, 'primitive-warning-detail', {
      cause: 'timeout',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [formattedOutput] = warnSpy.mock.calls[0];
    const lines = formattedOutput.split('\n');
    const mainLine = lines[0];

    expect(mainLine.endsWith(longWarning)).toBe(true);
    expect(
      lines.includes(
        '                    ↳ Details[0]: primitive-warning-detail'
      )
    ).toBe(true);
    expect(lines.some((line) => line.includes('"cause": "timeout"'))).toBe(
      true
    );

    warnSpy.mockRestore();
  });
});
