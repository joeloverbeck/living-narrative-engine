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

    it('should include stack traces when available', () => {
      const result = logExporter.exportAsText(sampleLogs);

      expect(result).toContain('Stack Trace:');
      expect(result).toContain('Error stack trace');
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
    it('should call downloadAsFile without errors', () => {
      // Test basic functionality without deep DOM mocking
      expect(() => {
        logExporter.downloadAsFile('test content', 'test.txt', 'text/plain');
      }).not.toThrow();
    });
  });

  describe('Clipboard Functionality', () => {
    it('should attempt to copy to clipboard', async () => {
      // Test basic functionality - the actual clipboard interaction is hard to mock reliably
      const success = await logExporter.copyToClipboard('test content');

      // Should return boolean
      expect(typeof success).toBe('boolean');
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
