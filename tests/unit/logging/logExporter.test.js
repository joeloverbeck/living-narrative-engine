/**
 * @file Unit tests for LogExporter component
 * @see logExporter.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import LogExporter from '../../../src/logging/logExporter.js';

describe('LogExporter - Core Functionality', () => {
  let testBed;
  let logExporter;
  let mockLogger;
  let sampleLogs;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    const now = Date.now();
    sampleLogs = [
      {
        timestamp: now,
        level: 'warn',
        message: 'Test warning message',
        category: 'engine',
      },
      {
        timestamp: now - 30000, // 30 seconds ago
        level: 'error',
        message: 'Test error message',
        category: 'network',
        metadata: {
          stack: 'Error stack trace\nLine 1\nLine 2',
          errorName: 'TestError',
        },
      },
      {
        timestamp: now - 360000, // 6 minutes ago
        level: 'warn',
        message: 'Message with "quotes" and, comma',
        category: 'system',
      },
    ];

    logExporter = new LogExporter({
      logger: mockLogger,
      appInfo: { name: 'Test App', version: '1.0.0' },
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create LogExporter with valid dependencies', () => {
      expect(logExporter).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should use default app info when not provided', () => {
      const exporter = new LogExporter({ logger: mockLogger });
      const result = exporter.exportAsJSON([]);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.application.name).toBe('Living Narrative Engine');
      expect(parsed.metadata.application.version).toBe('0.0.1');
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new LogExporter({ logger: null });
      }).toThrow();
    });
  });

  describe('JSON Export', () => {
    it('should export logs as valid JSON with metadata', () => {
      const result = logExporter.exportAsJSON(sampleLogs);

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('logs');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.logs).toHaveLength(3);
    });

    it('should include application metadata', () => {
      const result = logExporter.exportAsJSON(sampleLogs);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.application.name).toBe('Test App');
      expect(parsed.metadata.application.version).toBe('1.0.0');
      expect(parsed.metadata.exportedBy).toBe('CriticalLogNotifier');
    });

    it('should include browser metadata', () => {
      const result = logExporter.exportAsJSON(sampleLogs);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.browser).toHaveProperty('userAgent');
      expect(parsed.metadata.browser).toHaveProperty('platform');
      expect(parsed.metadata.browser).toHaveProperty('language');
    });

    it('should include summary statistics', () => {
      const result = logExporter.exportAsJSON(sampleLogs);
      const parsed = JSON.parse(result);

      expect(parsed.summary.total).toBe(3);
      expect(parsed.summary.warnings).toBe(2);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.summary.categories).toContain('engine');
      expect(parsed.summary.categories).toContain('network');
    });

    it('should sanitize log data', () => {
      const result = logExporter.exportAsJSON(sampleLogs);
      const parsed = JSON.parse(result);

      const logWithMetadata = parsed.logs.find((log) => log.metadata);
      expect(logWithMetadata.metadata).toHaveProperty('stack');
      expect(logWithMetadata.metadata).toHaveProperty('errorName');
    });
  });

  describe('CSV Export', () => {
    it('should export logs as CSV with headers', () => {
      const result = logExporter.exportAsCSV(sampleLogs);
      const lines = result.split('\n');

      // Should have metadata comments + header + 3 data rows
      expect(lines.length).toBeGreaterThan(8);

      // Check for CSV headers
      const headerLine = lines.find((line) =>
        line.startsWith('Timestamp,ISO Time')
      );
      expect(headerLine).toBeDefined();
    });

    it('should escape CSV special characters correctly', () => {
      const result = logExporter.exportAsCSV(sampleLogs);

      // Should escape quotes and commas
      expect(result).toContain('"Message with ""quotes"" and, comma"');
    });

    it('should include metadata as comments', () => {
      const result = logExporter.exportAsCSV(sampleLogs);
      const lines = result.split('\n');

      const metadataLines = lines.filter((line) => line.startsWith('#'));
      expect(metadataLines.length).toBeGreaterThan(0);
      expect(metadataLines.some((line) => line.includes('Test App'))).toBe(
        true
      );
    });

    it('should format timestamps correctly', () => {
      const result = logExporter.exportAsCSV(sampleLogs);
      const dataLines = result
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.includes('WARN'));

      expect(dataLines.length).toBeGreaterThan(0);
      // Should contain both local time and ISO time
      expect(dataLines[0]).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Local date format
    });

    it('should handle missing fields and applied filters', () => {
      const sparseLogs = [
        {
          timestamp: Date.now(),
          level: 'error',
          message: null,
        },
      ];

      const result = logExporter.exportAsCSV(sparseLogs, {
        filters: { level: 'error' },
      });
      const lines = result.split('\n');
      const dataLine = lines[lines.length - 1];

      expect(lines[3]).toBe('# Filters Applied: Yes');
      expect(dataLine).toContain('ERROR');
      expect(dataLine).toContain('general');
      expect(dataLine.endsWith(',')).toBe(true);
    });
  });

  describe('Text Export', () => {
    it('should create formatted text output', () => {
      const result = logExporter.exportAsText(sampleLogs);

      expect(result).toContain('CRITICAL LOGS EXPORT');
      expect(result).toContain('Test App v1.0.0');
      expect(result).toContain('Total Logs: 3');
      expect(result).toContain('WARNINGS (2):');
      expect(result).toContain('ERRORS (1):');
    });

    it('should group logs by level', () => {
      const result = logExporter.exportAsText(sampleLogs);

      const warningsIndex = result.indexOf('WARNINGS (2):');
      const errorsIndex = result.indexOf('ERRORS (1):');

      expect(warningsIndex).toBeGreaterThan(-1);
      expect(errorsIndex).toBeGreaterThan(-1);
      expect(warningsIndex).toBeLessThan(errorsIndex);
    });

    it('should include filter information when provided', () => {
      const options = { filters: { level: 'error', category: 'network' } };
      const result = logExporter.exportAsText(sampleLogs, options);

      expect(result).toContain('Applied Filters:');
      expect(result).toContain('level: error');
      expect(result).toContain('category: network');
    });

    it('should ignore neutral filter values in text export', () => {
      const options = { filters: { level: 'warn', category: 'all' } };
      const result = logExporter.exportAsText(sampleLogs, options);

      expect(result).toContain('Applied Filters:');
      expect(result).toContain('level: warn');
      expect(result).not.toContain('category: all');
    });

    it('should include stack traces when available', () => {
      const result = logExporter.exportAsText(sampleLogs);

      expect(result).toContain('Stack Trace:');
      expect(result).toContain('Error stack trace');
    });

    it('should omit warning section when none exist', () => {
      const errorOnlyLogs = [
        {
          timestamp: Date.now(),
          level: 'error',
          message: 'Only error present',
        },
      ];

      const result = logExporter.exportAsText(errorOnlyLogs);

      expect(result).not.toContain('WARNINGS (');
      expect(result).toContain('ERRORS (1):');
    });

    it('should omit error section when none exist', () => {
      const warningOnlyLogs = [
        {
          timestamp: Date.now(),
          level: 'warn',
          message: 'Only warning present',
        },
      ];

      const result = logExporter.exportAsText(warningOnlyLogs);

      expect(result).toContain('WARNINGS (1):');
      expect(result).not.toContain('ERRORS (');
    });

    it('should default missing categories to general in text output', () => {
      const uncategorizedLogs = [
        {
          timestamp: Date.now(),
          level: 'warn',
          message: 'No category message',
        },
      ];

      const result = logExporter.exportAsText(uncategorizedLogs);

      expect(result).toContain('[general');
    });
  });

  describe('Markdown Export', () => {
    it('should create valid markdown format', () => {
      const result = logExporter.exportAsMarkdown(sampleLogs);

      expect(result).toContain('# Critical Logs Export');
      expect(result).toContain('## Metadata');
      expect(result).toContain('## Summary');
      expect(result).toContain('## Logs');
      expect(result).toContain('| Time | Level | Category | Message |');
    });

    it('should escape markdown special characters', () => {
      const logsWithSpecialChars = [
        {
          timestamp: Date.now(),
          level: 'warn',
          message: 'Message with *bold* and [link] and | pipe',
          category: 'test',
        },
      ];

      const result = logExporter.exportAsMarkdown(logsWithSpecialChars);

      expect(result).toContain('\\*bold\\*');
      expect(result).toContain('\\[link\\]');
      expect(result).toContain('\\|');
    });

    it('should include browser information', () => {
      const result = logExporter.exportAsMarkdown(sampleLogs);

      expect(result).toContain('**Browser**:');
    });

    it('should format warnings and errors with emojis', () => {
      const result = logExporter.exportAsMarkdown(sampleLogs);

      expect(result).toContain('⚠️ WARN');
      expect(result).toContain('❌ ERROR');
    });

    it('should list applied filters while ignoring neutral values', () => {
      const result = logExporter.exportAsMarkdown(sampleLogs, {
        filters: {
          level: 'warn',
          category: 'all',
          empty: '',
        },
      });

      expect(result).toContain('- **level**: warn');
      expect(result).not.toContain('- **category**: all');
      expect(result).not.toContain('- **empty**:');
    });

    it('should handle empty messages and missing categories', () => {
      const minimalLogs = [
        {
          timestamp: Date.now(),
          level: 'error',
          message: '',
        },
      ];

      const result = logExporter.exportAsMarkdown(minimalLogs);

      expect(result).toContain('| ❌ ERROR | general |  |');
    });
  });

  describe('Filename Generation', () => {
    it('should generate timestamped filenames', () => {
      const filename = logExporter.generateFilename('test', 'json');

      expect(filename).toMatch(
        /^test_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/
      );
    });

    it('should use default values', () => {
      const filename = logExporter.generateFilename();

      expect(filename).toMatch(
        /^critical-logs_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/
      );
    });
  });

  describe('File Download', () => {
    it('should clean up created DOM nodes and revoke object URLs', () => {
      jest.useFakeTimers();

      const appendSpy = jest.spyOn(document.body, 'appendChild');
      const removeSpy = jest.spyOn(document.body, 'removeChild');
      const link = document.createElement('a');
      const clickSpy = jest.spyOn(link, 'click');
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(link);

      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
      URL.revokeObjectURL = jest.fn();

      try {
        logExporter.downloadAsFile('test content', 'test.txt', 'text/plain');

        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(appendSpy).toHaveBeenCalledWith(link);
        expect(clickSpy).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Downloaded logs as test.txt');

        expect(removeSpy).not.toHaveBeenCalled();
        jest.runAllTimers();

        expect(removeSpy).toHaveBeenCalledWith(link);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
      } finally {
        createElementSpy.mockRestore();
        appendSpy.mockRestore();
        removeSpy.mockRestore();
        clickSpy.mockRestore();
        if (originalCreateObjectURL) {
          URL.createObjectURL = originalCreateObjectURL;
        } else {
          delete URL.createObjectURL;
        }
        if (originalRevokeObjectURL) {
          URL.revokeObjectURL = originalRevokeObjectURL;
        } else {
          delete URL.revokeObjectURL;
        }
        jest.useRealTimers();
      }
    });

    it('should rethrow errors from download failures', () => {
      const originalBlob = global.Blob;
      const error = new Error('blob failure');
      global.Blob = jest.fn(() => {
        throw error;
      });

      try {
        expect(() =>
          logExporter.downloadAsFile('content', 'file.txt', 'text/plain')
        ).toThrow(error);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to download logs',
          error
        );
      } finally {
        global.Blob = originalBlob;
      }
    });

    it('should default mime type to text/plain when not provided', () => {
      jest.useFakeTimers();

      const appendSpy = jest.spyOn(document.body, 'appendChild');
      const removeSpy = jest.spyOn(document.body, 'removeChild');
      const link = document.createElement('a');
      const clickSpy = jest.spyOn(link, 'click');
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(link);

      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn().mockReturnValue('blob:default');
      URL.revokeObjectURL = jest.fn();

      try {
        logExporter.downloadAsFile('default content', 'default.txt');

        expect(URL.createObjectURL).toHaveBeenCalledWith(
          expect.objectContaining({
            size: expect.any(Number),
          })
        );
        jest.runAllTimers();
        expect(appendSpy).toHaveBeenCalledWith(link);
        expect(removeSpy).toHaveBeenCalledWith(link);
      } finally {
        createElementSpy.mockRestore();
        appendSpy.mockRestore();
        removeSpy.mockRestore();
        clickSpy.mockRestore();
        if (originalCreateObjectURL) {
          URL.createObjectURL = originalCreateObjectURL;
        } else {
          delete URL.createObjectURL;
        }
        if (originalRevokeObjectURL) {
          URL.revokeObjectURL = originalRevokeObjectURL;
        } else {
          delete URL.revokeObjectURL;
        }
        jest.useRealTimers();
      }
    });
  });

  describe('Clipboard Functionality', () => {
    it('should use the async clipboard API in secure contexts', async () => {
      const hadClipboard = Object.prototype.hasOwnProperty.call(
        navigator,
        'clipboard'
      );
      const previousClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockResolvedValue() },
        configurable: true,
      });

      const hadSecureContext = Object.prototype.hasOwnProperty.call(
        globalThis,
        'isSecureContext'
      );
      const previousSecureContext = globalThis.isSecureContext;
      Object.defineProperty(globalThis, 'isSecureContext', {
        value: true,
        configurable: true,
      });

      try {
        const result = await logExporter.copyToClipboard('secure content');

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'secure content'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Logs copied to clipboard'
        );
        expect(result).toBe(true);
      } finally {
        if (hadClipboard) {
          Object.defineProperty(navigator, 'clipboard', {
            value: previousClipboard,
            configurable: true,
          });
        } else {
          delete navigator.clipboard;
          if (previousClipboard !== undefined) {
            Object.defineProperty(navigator, 'clipboard', {
              value: previousClipboard,
              configurable: true,
            });
          }
        }

        if (hadSecureContext) {
          Object.defineProperty(globalThis, 'isSecureContext', {
            value: previousSecureContext,
            configurable: true,
          });
        } else {
          delete globalThis.isSecureContext;
          if (previousSecureContext !== undefined) {
            Object.defineProperty(globalThis, 'isSecureContext', {
              value: previousSecureContext,
              configurable: true,
            });
          }
        }
      }
    });

    it('should fall back to document.execCommand when clipboard API is unavailable', async () => {
      const appendSpy = jest.spyOn(document.body, 'appendChild');
      const removeSpy = jest.spyOn(document.body, 'removeChild');

      const hadClipboard = Object.prototype.hasOwnProperty.call(
        navigator,
        'clipboard'
      );
      const previousClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      const hadSecureContext = Object.prototype.hasOwnProperty.call(
        globalThis,
        'isSecureContext'
      );
      const previousSecureContext = globalThis.isSecureContext;
      Object.defineProperty(globalThis, 'isSecureContext', {
        value: false,
        configurable: true,
      });

      const originalExecCommand = document.execCommand;
      document.execCommand = jest.fn().mockReturnValue(true);

      try {
        const result = await logExporter.copyToClipboard('fallback content');

        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(appendSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Logs copied to clipboard (fallback)'
        );
        expect(result).toBe(true);
      } finally {
        appendSpy.mockRestore();
        removeSpy.mockRestore();
        if (originalExecCommand) {
          document.execCommand = originalExecCommand;
        } else {
          delete document.execCommand;
        }

        if (hadClipboard) {
          Object.defineProperty(navigator, 'clipboard', {
            value: previousClipboard,
            configurable: true,
          });
        } else {
          delete navigator.clipboard;
          if (previousClipboard !== undefined) {
            Object.defineProperty(navigator, 'clipboard', {
              value: previousClipboard,
              configurable: true,
            });
          }
        }

        if (hadSecureContext) {
          Object.defineProperty(globalThis, 'isSecureContext', {
            value: previousSecureContext,
            configurable: true,
          });
        } else {
          delete globalThis.isSecureContext;
          if (previousSecureContext !== undefined) {
            Object.defineProperty(globalThis, 'isSecureContext', {
              value: previousSecureContext,
              configurable: true,
            });
          }
        }
      }
    });

    it('should return false when clipboard operations throw', async () => {
      const hadClipboard = Object.prototype.hasOwnProperty.call(
        navigator,
        'clipboard'
      );
      const previousClipboard = navigator.clipboard;
      const clipboardError = new Error('clipboard failure');
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockRejectedValue(clipboardError) },
        configurable: true,
      });

      const hadSecureContext = Object.prototype.hasOwnProperty.call(
        globalThis,
        'isSecureContext'
      );
      const previousSecureContext = globalThis.isSecureContext;
      Object.defineProperty(globalThis, 'isSecureContext', {
        value: true,
        configurable: true,
      });

      try {
        const result = await logExporter.copyToClipboard('error content');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to copy to clipboard',
          clipboardError
        );
        expect(result).toBe(false);
      } finally {
        if (hadClipboard) {
          Object.defineProperty(navigator, 'clipboard', {
            value: previousClipboard,
            configurable: true,
          });
        } else {
          delete navigator.clipboard;
          if (previousClipboard !== undefined) {
            Object.defineProperty(navigator, 'clipboard', {
              value: previousClipboard,
              configurable: true,
            });
          }
        }

        if (hadSecureContext) {
          Object.defineProperty(globalThis, 'isSecureContext', {
            value: previousSecureContext,
            configurable: true,
          });
        } else {
          delete globalThis.isSecureContext;
          if (previousSecureContext !== undefined) {
            Object.defineProperty(globalThis, 'isSecureContext', {
              value: previousSecureContext,
              configurable: true,
            });
          }
        }
      }
    });

    it('should return false when fallback copy fails', async () => {
      const appendSpy = jest.spyOn(document.body, 'appendChild');
      const removeSpy = jest.spyOn(document.body, 'removeChild');

      const hadClipboard = Object.prototype.hasOwnProperty.call(
        navigator,
        'clipboard'
      );
      const previousClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      const hadSecureContext = Object.prototype.hasOwnProperty.call(
        globalThis,
        'isSecureContext'
      );
      const previousSecureContext = globalThis.isSecureContext;
      Object.defineProperty(globalThis, 'isSecureContext', {
        value: false,
        configurable: true,
      });

      const originalExecCommand = document.execCommand;
      document.execCommand = jest.fn().mockReturnValue(false);

      try {
        const result = await logExporter.copyToClipboard('fallback failure');

        expect(result).toBe(false);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(mockLogger.debug).not.toHaveBeenCalledWith(
          'Logs copied to clipboard (fallback)'
        );
      } finally {
        appendSpy.mockRestore();
        removeSpy.mockRestore();
        if (originalExecCommand) {
          document.execCommand = originalExecCommand;
        } else {
          delete document.execCommand;
        }

        if (hadClipboard) {
          Object.defineProperty(navigator, 'clipboard', {
            value: previousClipboard,
            configurable: true,
          });
        } else {
          delete navigator.clipboard;
          if (previousClipboard !== undefined) {
            Object.defineProperty(navigator, 'clipboard', {
              value: previousClipboard,
              configurable: true,
            });
          }
        }

        if (hadSecureContext) {
          Object.defineProperty(globalThis, 'isSecureContext', {
            value: previousSecureContext,
            configurable: true,
          });
        } else {
          delete globalThis.isSecureContext;
          if (previousSecureContext !== undefined) {
            Object.defineProperty(globalThis, 'isSecureContext', {
              value: previousSecureContext,
              configurable: true,
            });
          }
        }
      }
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive metadata fields', () => {
      const logsWithSensitiveData = [
        {
          timestamp: Date.now(),
          level: 'error',
          message: 'Test error',
          metadata: {
            stack: 'Error stack',
            errorName: 'TestError',
            sensitiveData: 'should not be included',
            userId: 'user123', // Safe field
            password: 'secret123', // Should be filtered out
          },
        },
      ];

      const result = logExporter.exportAsJSON(logsWithSensitiveData);
      const parsed = JSON.parse(result);
      const logMetadata = parsed.logs[0].metadata;

      expect(logMetadata).toHaveProperty('stack');
      expect(logMetadata).toHaveProperty('errorName');
      expect(logMetadata).toHaveProperty('userId');
      expect(logMetadata).not.toHaveProperty('sensitiveData');
      expect(logMetadata).not.toHaveProperty('password');
    });
  });
});
