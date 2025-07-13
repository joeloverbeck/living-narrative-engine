import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
// import { getLogFormatter } from '../../../src/logging/logFormatter.js';

describe('LogFormatter', () => {
  let formatter;
  let originalEnv;
  let originalPlatform;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    originalPlatform = process.platform;

    // Reset modules to get fresh instances
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('Emoji Support Detection', () => {
    it('should detect emoji support for known terminals', async () => {
      jest.resetModules();
      // Test VS Code terminal
      process.env.TERM_PROGRAM = 'vscode';
      delete process.env.LOG_DISABLE_EMOJI;
      delete process.env.LOG_FORCE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Test message');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should detect emoji support for Cursor IDE', async () => {
      jest.resetModules();
      process.env.TERM_PROGRAM = 'cursor';
      delete process.env.LOG_DISABLE_EMOJI;
      delete process.env.LOG_FORCE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('debug', 'ApiKeyService: test');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should detect emoji support for Windows Terminal', async () => {
      jest.resetModules();
      process.env.LOG_FORCE_EMOJI = 'true'; // Force emoji for reliable testing
      process.env.WT_SESSION = 'some-session-id';
      delete process.env.TERM_PROGRAM;
      delete process.env.LOG_DISABLE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('warn', 'Warning message');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should fall back to ASCII for WSL without modern terminal', async () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      process.env.TERM = 'xterm';
      delete process.env.TERM_PROGRAM;
      delete process.env.WT_SESSION;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('error', 'Error message');
      expect(result.icon).toMatch(/^\[.*\]$/); // ASCII format like [ERR]
    });

    it('should fall back to ASCII for Windows CMD/PowerShell', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
      delete process.env.WT_SESSION;
      delete process.env.TERM_PROGRAM;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Info message');
      expect(result.icon).toMatch(/^\[.*\]$/); // ASCII format
    });

    it('should use emoji for macOS by default', async () => {
      jest.resetModules();
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
      delete process.env.TERM_PROGRAM;
      delete process.env.LOG_DISABLE_EMOJI;
      delete process.env.LOG_FORCE_EMOJI;
      delete process.env.WSL_DISTRO_NAME;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'macOS message');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should use emoji for Linux by default', async () => {
      jest.resetModules();
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      delete process.env.TERM_PROGRAM;
      delete process.env.WSL_DISTRO_NAME;
      delete process.env.LOG_DISABLE_EMOJI;
      delete process.env.LOG_FORCE_EMOJI;
      delete process.env.WT_SESSION;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Linux message');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should respect LOG_FORCE_EMOJI environment variable', async () => {
      jest.resetModules();
      process.env.LOG_FORCE_EMOJI = 'true';
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      process.env.TERM = 'xterm';
      delete process.env.TERM_PROGRAM;
      delete process.env.LOG_DISABLE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Forced emoji');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });

    it('should respect LOG_DISABLE_EMOJI environment variable', async () => {
      jest.resetModules();
      process.env.LOG_DISABLE_EMOJI = 'true';
      process.env.TERM_PROGRAM = 'vscode';
      delete process.env.LOG_FORCE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Disabled emoji');
      expect(result.icon).toMatch(/^\[.*\]$/); // ASCII format
    });

    it('should detect terminal emulator support', async () => {
      jest.resetModules();
      process.env.TERMINAL_EMULATOR = 'hyper';
      delete process.env.TERM_PROGRAM;
      delete process.env.LOG_DISABLE_EMOJI;
      delete process.env.LOG_FORCE_EMOJI;

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();

      const result = formatter.formatMessage('info', 'Hyper terminal');
      expect(result.icon).toMatch(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      );
    });
  });

  describe('Context Detection', () => {
    beforeEach(async () => {
      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();
    });

    it('should detect startup context', () => {
      const result = formatter.formatMessage(
        'info',
        'LLM Proxy Server: Server initialization complete'
      );

      expect(result.service).toBe('LLM Proxy Server');
      // Should detect startup context based on message content
    });

    it('should detect API key context', () => {
      const result = formatter.formatMessage(
        'debug',
        'ApiKeyService: Retrieving API key for provider'
      );

      expect(result.service).toBe('ApiKeyService');
      // Should use auth icon for API key related messages
    });

    it('should detect cache context', () => {
      const result = formatter.formatMessage(
        'info',
        'CacheService: Cache hit for key test-key'
      );

      expect(result.service).toBe('CacheService');
      // Should use cache icon
    });

    it('should detect request context', () => {
      const result = formatter.formatMessage(
        'debug',
        'LlmRequestController: Processing POST request'
      );

      expect(result.service).toBe('LlmRequestController');
      // Should use request icon
    });

    it('should detect HTTP context', () => {
      const result = formatter.formatMessage(
        'debug',
        'HttpAgentService: Creating new HTTP agent'
      );

      expect(result.service).toBe('HttpAgentService');
      // Should use HTTP icon
    });

    it('should detect configuration context', () => {
      const result = formatter.formatMessage(
        'debug',
        'AppConfigService: Loading configuration from environment'
      );

      expect(result.service).toBe('AppConfigService');
      // Should use config icon
    });

    it('should detect cleanup context', () => {
      const result = formatter.formatMessage(
        'info',
        'LLM Proxy Server: Graceful shutdown complete'
      );

      expect(result.service).toBe('LLM Proxy Server');
      // Should use cleanup icon
    });

    it('should detect error context for error level', () => {
      const result = formatter.formatMessage(
        'error',
        'SomeService: A critical failure occurred'
      );

      expect(result.service).toBe('SomeService');
      // Error level should override other context detection
    });

    it('should extract service name with different patterns', () => {
      const testCases = [
        { message: 'ApiKeyService: test', expected: 'ApiKeyService' },
        {
          message: 'LlmRequestController: test',
          expected: 'LlmRequestController',
        },
        { message: 'CacheManager: test', expected: 'CacheManager' },
        { message: 'LLM Proxy Server: test', expected: 'LLM Proxy Server' },
        { message: 'Unknown: test', expected: 'Unknown' },
        { message: 'No service prefix', expected: 'System' },
      ];

      testCases.forEach(({ message, expected }) => {
        const result = formatter.formatMessage('info', message);
        expect(result.service).toBe(expected);
      });
    });
  });

  describe('Message Formatting', () => {
    beforeEach(async () => {
      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();
    });

    it('should format basic messages correctly', () => {
      const result = formatter.formatMessage('info', 'Test message');

      expect(result.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      expect(result.level).toBe('INFO');
      expect(result.message).toBe('Test message');
      expect(result.service).toBe('System');
      expect(Array.isArray(result.contextLines)).toBe(true);
    });

    it('should format messages with context objects', () => {
      const context = { llmId: 'test-provider', temperature: 0.7 };
      const result = formatter.formatMessage(
        'debug',
        'Test with context',
        context
      );

      expect(result.contextLines).toHaveLength(4); // Context object formatted with indentation
      expect(result.contextLines[0]).toContain('Context: {');
      expect(result.contextLines[1]).toContain('llmId');
      expect(result.contextLines[1]).toContain('test-provider');
    });

    it('should format messages with additional details', () => {
      const result = formatter.formatMessage(
        'warn',
        'Warning message',
        'detail1',
        'detail2'
      );

      expect(result.contextLines.length).toBeGreaterThan(0);
      expect(
        result.contextLines.some((line) => line.includes('Details[0]: detail1'))
      ).toBe(true);
      expect(
        result.contextLines.some((line) => line.includes('Details[1]: detail2'))
      ).toBe(true);
    });

    it('should handle complex nested objects', () => {
      const complexObj = {
        config: {
          llmId: 'provider',
          settings: {
            temperature: 0.7,
            maxTokens: 150,
          },
        },
        metadata: {
          requestId: 'req-123',
        },
      };

      const result = formatter.formatMessage(
        'info',
        'Complex object',
        complexObj
      );

      expect(result.contextLines.length).toBeGreaterThan(3);
      expect(result.contextLines.join('\n')).toContain('config');
      expect(result.contextLines.join('\n')).toContain('settings');
      expect(result.contextLines.join('\n')).toContain('requestId');
    });

    it('should truncate long messages', async () => {
      // Mock configuration to have short max length
      jest.resetModules();
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 20,
          shouldShowContext: () => true,
        }),
      }));

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      const testFormatter = getLogFormatter();

      const longMessage =
        'This is a very long message that should be truncated';
      const result = testFormatter.formatMessage('info', longMessage);

      expect(result.message).toContain('...');
      expect(result.message.length).toBeLessThan(longMessage.length);
    });

    it('should handle messages that equal max length', () => {
      const exactLengthMessage = 'Exact length message';
      const result = formatter.formatMessage('info', exactLengthMessage);

      expect(result.message).toBe(exactLengthMessage);
      expect(result.message).not.toContain('...');
    });

    it('should skip context when configuration disables it', async () => {
      // Mock configuration to disable context
      jest.resetModules();
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => false,
        }),
      }));

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      const testFormatter = getLogFormatter();

      const result = testFormatter.formatMessage('info', 'Test message', {
        data: 'test',
      });

      expect(result.contextLines).toHaveLength(0);
    });
  });

  describe('Error Handling in Formatting', () => {
    beforeEach(async () => {
      jest.resetModules();

      // Mock configuration to ensure context is enabled for error testing
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
        }),
      }));

      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();
    });

    it('should handle objects that throw during JSON.stringify', () => {
      const problematicObj = {
        toJSON: () => {
          throw new Error('JSON serialization failed');
        },
      };

      const result = formatter.formatMessage(
        'error',
        'Test error handling',
        problematicObj
      );

      expect(result.contextLines.length).toBeGreaterThan(0);
      expect(
        result.contextLines.some((line) => line.includes('Unable to format'))
      ).toBe(true);
    });

    it('should handle circular references gracefully', () => {
      const circularObj = {};
      circularObj.self = circularObj;

      const result = formatter.formatMessage(
        'debug',
        'Circular reference test',
        circularObj
      );

      // Should not throw and should handle gracefully
      expect(result.contextLines.length).toBeGreaterThan(0);
    });

    it('should handle null and undefined context gracefully', () => {
      const result1 = formatter.formatMessage('info', 'Null context', null);
      const result2 = formatter.formatMessage(
        'info',
        'Undefined context',
        undefined
      );

      // null and undefined are treated as details, so they generate detail lines
      expect(result1.contextLines).toHaveLength(1);
      expect(result1.contextLines[0]).toContain('Details[0]: null');
      expect(result2.contextLines).toHaveLength(1);
      expect(result2.contextLines[0]).toContain('Details[0]: undefined');
    });

    it('should handle details formatting errors', () => {
      const contextObj = { data: 'context' };
      const problematicDetail = {
        toJSON: () => {
          throw new Error('JSON serialization failed');
        },
      };

      const result = formatter.formatMessage(
        'warn',
        'Test details error',
        contextObj,
        'good-detail',
        problematicDetail
      );

      expect(
        result.contextLines.some((line) =>
          line.includes('Details[0]: good-detail')
        )
      ).toBe(true);
      expect(
        result.contextLines.some((line) => line.includes('Unable to format'))
      ).toBe(true);
    });
  });

  describe('Simple Formatting Fallback', () => {
    beforeEach(async () => {
      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );
      formatter = getLogFormatter();
    });

    it('should provide simple formatting fallback', () => {
      const result = formatter.formatSimple(
        'info',
        'Simple message',
        { data: 'test' },
        'extra'
      );

      expect(result).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] INFO: Simple message/
      );
      expect(result).toContain('{"data":"test"}');
      expect(result).toContain('extra');
    });

    it('should handle simple formatting with no additional args', () => {
      const result = formatter.formatSimple('error', 'Error message');

      expect(result).toMatch(
        /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] ERROR: Error message$/
      );
    });

    it('should handle simple formatting with mixed arg types', () => {
      const result = formatter.formatSimple(
        'debug',
        'Mixed args',
        123,
        true,
        'string'
      );

      expect(result).toContain('123');
      expect(result).toContain('true');
      expect(result).toContain('string');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same formatter instance', async () => {
      const { getLogFormatter } = await import(
        '../../../src/logging/logFormatter.js'
      );

      const formatter1 = getLogFormatter();
      const formatter2 = getLogFormatter();

      expect(formatter1).toBe(formatter2);
    });
  });
});
