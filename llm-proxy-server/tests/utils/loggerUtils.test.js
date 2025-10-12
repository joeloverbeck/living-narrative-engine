// llm-proxy-server/tests/utils/loggerUtils.test.js
// --- FILE START ---
import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  ensureValidLogger,
  maskApiKey,
  createSecureLogger,
} from '../../src/utils/loggerUtils.js';

describe('ensureValidLogger', () => {
  let consoleSpies;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  test('returns the provided logger when valid', () => {
    const validLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const result = ensureValidLogger(validLogger, 'MyPrefix');
    expect(result).toBe(validLogger);
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  test('returns a console fallback logger when logger is null', () => {
    const prefix = 'Fallback';
    const fallback = ensureValidLogger(null, prefix);

    fallback.info('hello');
    fallback.warn('warn');
    fallback.error('error');
    fallback.debug('dbg');

    expect(consoleSpies.info).toHaveBeenCalledWith(`${prefix}: `, 'hello');
    expect(consoleSpies.warn).toHaveBeenCalledWith(`${prefix}: `, 'warn');
    expect(consoleSpies.error).toHaveBeenCalledWith(`${prefix}: `, 'error');
    expect(consoleSpies.debug).toHaveBeenCalledWith(`${prefix}: `, 'dbg');
  });

  test('warns once and uses console fallback when logger is invalid', () => {
    const invalidLogger = { info: () => {}, warn: () => {} };
    const prefix = 'Bad';
    const fallback = ensureValidLogger(invalidLogger, prefix);

    expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      `${prefix}: `,
      `An invalid logger instance was provided. Falling back to console logging with prefix "${prefix}".`
    );

    fallback.warn('again');
    expect(consoleSpies.warn).toHaveBeenNthCalledWith(
      2,
      `${prefix}: `,
      'again'
    );
  });

  test('uses default prefix when none is provided', () => {
    const invalidLogger = { info: () => {} };
    const fallback = ensureValidLogger(invalidLogger);

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      'FallbackLogger: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "FallbackLogger".'
    );

    fallback.info('msg');
    expect(consoleSpies.info).toHaveBeenLastCalledWith(
      'FallbackLogger: ',
      'msg'
    );
  });
});

describe('maskApiKey', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('should mask API key in production environment', () => {
    process.env.NODE_ENV = 'production';

    const result = maskApiKey('sk-abcdef123456789');

    expect(result).toBe('[MASKED]');
  });

  test('should show partial API key in development environment', () => {
    process.env.NODE_ENV = 'development';

    const result = maskApiKey('sk-abcdef123456789');

    expect(result).toBe('sk-a**************');
  });

  test('should default to development behavior when NODE_ENV not set', () => {
    delete process.env.NODE_ENV;

    const result = maskApiKey('sk-abcdef123456789');

    expect(result).toBe('sk-a**************');
  });

  test('should handle short API keys correctly', () => {
    process.env.NODE_ENV = 'development';

    const result = maskApiKey('abc');

    expect(result).toBe('a**');
  });

  test('should handle null/undefined API keys', () => {
    expect(maskApiKey(null)).toBe('[NULL]');
    expect(maskApiKey(undefined)).toBe('[UNDEFINED]');
    expect(maskApiKey('')).toBe('[EMPTY]');
  });

  test('should handle single character API key in development', () => {
    process.env.NODE_ENV = 'development';

    const result = maskApiKey('x');

    expect(result).toBe('*');
  });

  test('should handle two character API key in development', () => {
    process.env.NODE_ENV = 'development';

    const result = maskApiKey('xy');

    expect(result).toBe('x*');
  });
});

describe('createSecureLogger', () => {
  test('should create logger that masks API keys in log context', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.info('API key successfully obtained for llmId test-llm', {
      apiKey: 'sk-secret123456789',
      llmId: 'test-llm',
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'API key successfully obtained for llmId test-llm',
      {
        apiKey: expect.stringMatching(/\[MASKED\]|^sk-s\*+$/),
        llmId: 'test-llm',
      }
    );
  });

  test('should pass through non-sensitive log messages unchanged', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.debug('Normal debug message', { data: 'test' });

    expect(mockLogger.debug).toHaveBeenCalledWith('Normal debug message', {
      data: 'test',
    });
  });

  test('should handle null/undefined context', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.info('Test message', null);
    secureLogger.warn('Test message', undefined);

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', null);
    expect(mockLogger.warn).toHaveBeenCalledWith('Test message', undefined);
  });

  test('should sanitize nested objects with sensitive data', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    const complexContext = {
      user: {
        id: '123',
        credentials: {
          apiKey: 'sk-secret123',
          password: 'secret456',
        },
      },
      config: {
        apikey: 'ak-secret789',
        setting: 'value',
      },
    };

    secureLogger.error('Complex nested error', complexContext);

    const expectedSanitized = {
      user: {
        id: '123',
        credentials: {
          apiKey: expect.stringContaining('sk-s'),
          password: expect.stringContaining('s'),
        },
      },
      config: {
        apikey: expect.stringContaining('ak-s'),
        setting: 'value',
      },
    };

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Complex nested error',
      expectedSanitized
    );
  });

  test('should handle arrays with sensitive data', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    const arrayContext = {
      users: [
        { id: '1', apiKey: 'sk-user1key' },
        { id: '2', apiKey: 'sk-user2key' },
      ],
      configs: [
        { name: 'prod', secret: 'prod-secret' },
        { name: 'dev', secret: 'dev-secret' },
      ],
    };

    secureLogger.warn('Array context test', arrayContext);

    const expectedSanitized = {
      users: [
        { id: '1', apiKey: expect.stringContaining('sk-u') },
        { id: '2', apiKey: expect.stringContaining('sk-u') },
      ],
      configs: [
        { name: 'prod', secret: expect.stringContaining('prod') },
        { name: 'dev', secret: expect.stringContaining('dev') },
      ],
    };

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Array context test',
      expectedSanitized
    );
  });

  test('should handle primitive values in context', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.debug('Primitive test', 'string value');
    secureLogger.info('Number test', 123);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Primitive test',
      'string value'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Number test', 123);
  });
});

describe('sanitizeLogContext - additional coverage', () => {
  test('should return null/undefined as-is', () => {
    // We can't directly test sanitizeLogContext as it's private, but we can test it through createSecureLogger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.info('Test null', null);
    secureLogger.warn('Test undefined', undefined);

    expect(mockLogger.info).toHaveBeenCalledWith('Test null', null);
    expect(mockLogger.warn).toHaveBeenCalledWith('Test undefined', undefined);
  });

  test('should handle non-object types directly', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    secureLogger.info('String test', 'just a string');
    secureLogger.warn('Number test', 42);
    secureLogger.error('Boolean test', true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'String test',
      'just a string'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith('Number test', 42);
    expect(mockLogger.error).toHaveBeenCalledWith('Boolean test', true);
  });

  test('should handle arrays at top level', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    const arrayData = [
      { id: '1', apiKey: 'sk-test1' },
      { id: '2', token: 'token-test2' },
      'plain string',
      123,
    ];

    secureLogger.debug('Array at top level', arrayData);

    const expectedSanitized = [
      { id: '1', apiKey: expect.stringContaining('sk-t') },
      { id: '2', token: expect.stringContaining('toke') },
      'plain string',
      123,
    ];

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Array at top level',
      expectedSanitized
    );
  });

  test('should preserve nullish nested values while masking siblings', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    const context = {
      service: 'api-gateway',
      nested: {
        token: 'tok-test-4567',
        optional: null,
        maybeLater: undefined,
      },
    };

    secureLogger.warn('Handles nested nullish values', context);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Handles nested nullish values',
      {
        service: 'api-gateway',
        nested: {
          token: expect.stringMatching(/^tok-/),
          optional: null,
          maybeLater: undefined,
        },
      }
    );
  });

  test('should handle deeply nested objects and arrays', () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const secureLogger = createSecureLogger(mockLogger);

    const deeplyNested = {
      level1: {
        level2: {
          level3: [
            {
              level4: {
                apiKey: 'sk-deep-secret',
                normalData: 'safe',
              },
            },
          ],
        },
      },
    };

    secureLogger.error('Deeply nested test', deeplyNested);

    const expectedSanitized = {
      level1: {
        level2: {
          level3: [
            {
              level4: {
                apiKey: expect.stringContaining('sk-d'),
                normalData: 'safe',
              },
            },
          ],
        },
      },
    };

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Deeply nested test',
      expectedSanitized
    );
  });
});
// --- FILE END ---
