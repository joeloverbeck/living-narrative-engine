/**
 * @file Tests for ExpressionFileService
 * @description Verifies expression file scanning and status update functionality
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ExpressionFileService } from '../../../src/services/expressionFileService.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('ExpressionFileService', () => {
  /** @type {ExpressionFileService} */
  let service;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new ExpressionFileService(mockLogger, '/test/project');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws when logger is not provided', () => {
      expect(() => new ExpressionFileService(null)).toThrow(
        'ExpressionFileService: logger is required'
      );
    });

    it('initializes with correct paths', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ExpressionFileService: Instance created',
        expect.objectContaining({
          projectRoot: expect.any(String),
          modsPath: expect.any(String),
        })
      );
    });
  });

  describe('validateFilePath', () => {
    it('returns false for null path', () => {
      expect(service.validateFilePath(null)).toBe(false);
    });

    it('returns false for non-string path', () => {
      expect(service.validateFilePath(123)).toBe(false);
    });

    it('returns false for non-expression file', () => {
      expect(service.validateFilePath('data/mods/test/file.json')).toBe(false);
    });

    it('returns true for valid expression file path', () => {
      expect(
        service.validateFilePath('data/mods/emotions-test/expressions/test.expression.json')
      ).toBe(true);
    });

    it('returns false for path traversal attempt', () => {
      expect(
        service.validateFilePath('../../../etc/passwd.expression.json')
      ).toBe(false);
    });
  });

  describe('scanAllExpressionStatuses', () => {
    it('should scan expressions from all mods, not just emotions-* mods', async () => {
      // Setup: mock directory structure with both emotions-* and non-emotions mods
      const mockModDirs = [
        { name: 'core', isDirectory: () => true },
        { name: 'emotions-agency', isDirectory: () => true },
        { name: 'positioning', isDirectory: () => true },
        { name: 'clothing', isDirectory: () => true },
        { name: '.gitkeep', isDirectory: () => false },
      ];

      // Mock readdir for mods directory
      fs.readdir.mockImplementation(async (dirPath, options) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        // Return expression files for any mod's expressions directory
        return ['test.expression.json'];
      });

      // Mock access - all expression directories exist
      fs.access.mockResolvedValue(undefined);

      // Mock readFile for expression files
      fs.readFile.mockImplementation(async (filePath) => {
        const modName = filePath.includes('emotions-agency')
          ? 'emotions-agency'
          : filePath.includes('core')
            ? 'core'
            : filePath.includes('positioning')
              ? 'positioning'
              : 'clothing';
        return JSON.stringify({
          id: `${modName}:test`,
          diagnosticStatus: null,
        });
      });

      const results = await service.scanAllExpressionStatuses();

      // Should include expressions from ALL mods that have expression directories
      expect(results.length).toBeGreaterThan(1);

      // Should include emotions-* mod
      const emotionsExpr = results.find((r) => r.id.startsWith('emotions-'));
      expect(emotionsExpr).toBeDefined();

      // Should also include non-emotions mods (core, positioning, clothing)
      const coreExpr = results.find((r) => r.id.startsWith('core:'));
      expect(coreExpr).toBeDefined();

      const positioningExpr = results.find((r) => r.id.startsWith('positioning:'));
      expect(positioningExpr).toBeDefined();
    });

    it('should skip directories that are not mod directories', async () => {
      const mockModDirs = [
        { name: 'test-mod', isDirectory: () => true },
        { name: 'file.json', isDirectory: () => false }, // Not a directory
      ];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['expr.expression.json'];
      });

      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(
        JSON.stringify({ id: 'test-mod:expr', diagnosticStatus: null })
      );

      const results = await service.scanAllExpressionStatuses();

      // Should only include the directory, not the file
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('test-mod:expr');
    });

    it('should skip mods without expressions directory', async () => {
      const mockModDirs = [
        { name: 'mod-with-expressions', isDirectory: () => true },
        { name: 'mod-without-expressions', isDirectory: () => true },
      ];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['test.expression.json'];
      });

      // Only mod-with-expressions has an expressions directory
      fs.access.mockImplementation(async (dirPath) => {
        if (dirPath.includes('mod-without-expressions')) {
          throw new Error('ENOENT');
        }
        return undefined;
      });

      fs.readFile.mockResolvedValue(
        JSON.stringify({ id: 'mod-with-expressions:test', diagnosticStatus: null })
      );

      const results = await service.scanAllExpressionStatuses();

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('mod-with-expressions:test');
    });

    it('should only include .expression.json files', async () => {
      const mockModDirs = [{ name: 'test-mod', isDirectory: () => true }];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        // Return both expression and non-expression files
        return ['valid.expression.json', 'invalid.json', 'readme.md'];
      });

      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(
        JSON.stringify({ id: 'test-mod:valid', diagnosticStatus: null })
      );

      const results = await service.scanAllExpressionStatuses();

      // Should only read the .expression.json file
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('test-mod:valid');
    });

    it('should handle file read errors gracefully', async () => {
      const mockModDirs = [{ name: 'test-mod', isDirectory: () => true }];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['good.expression.json', 'bad.expression.json'];
      });

      fs.access.mockResolvedValue(undefined);

      // First file reads successfully, second fails
      let readCount = 0;
      fs.readFile.mockImplementation(async () => {
        readCount++;
        if (readCount === 2) {
          throw new Error('Read error');
        }
        return JSON.stringify({ id: 'test-mod:good', diagnosticStatus: null });
      });

      const results = await service.scanAllExpressionStatuses();

      // Should include the successful read
      expect(results.length).toBe(1);
      // Should log warning for failed read
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ExpressionFileService: Failed to read expression file',
        expect.any(Object)
      );
    });

    it('should return expressions with correct structure', async () => {
      const mockModDirs = [{ name: 'emotions-test', isDirectory: () => true }];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['test.expression.json'];
      });

      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          id: 'emotions-test:test',
          diagnosticStatus: 'rare',
        })
      );

      const results = await service.scanAllExpressionStatuses();

      expect(results[0]).toEqual({
        id: 'emotions-test:test',
        filePath: expect.stringContaining('emotions-test/expressions/test.expression.json'),
        diagnosticStatus: 'rare',
        triggerRate: null,
      });
    });

    it('should include triggerRate when present in expression file', async () => {
      const mockModDirs = [{ name: 'emotions-test', isDirectory: () => true }];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['test.expression.json'];
      });

      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          id: 'emotions-test:test',
          diagnosticStatus: 'rare',
          triggerRate: 0.00125,
        })
      );

      const results = await service.scanAllExpressionStatuses();

      expect(results[0]).toEqual({
        id: 'emotions-test:test',
        filePath: expect.stringContaining('emotions-test/expressions/test.expression.json'),
        diagnosticStatus: 'rare',
        triggerRate: 0.00125,
      });
    });

    it('should return null triggerRate when not set', async () => {
      const mockModDirs = [{ name: 'emotions-test', isDirectory: () => true }];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        return ['test.expression.json'];
      });

      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          id: 'emotions-test:test',
          diagnosticStatus: 'rare',
        })
      );

      const results = await service.scanAllExpressionStatuses();

      expect(results[0].triggerRate).toBeNull();
    });

    it('should return empty array when scan fails', async () => {
      fs.readdir.mockRejectedValue(new Error('Permission denied'));

      const results = await service.scanAllExpressionStatuses();

      expect(results).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ExpressionFileService: Failed to scan expressions',
        expect.any(Object)
      );
    });

    it('should use parallel I/O for performance', async () => {
      // Setup: Create many mods with many expressions
      const numMods = 10;
      const numExpressionsPerMod = 5;
      const mockModDirs = Array.from({ length: numMods }, (_, i) => ({
        name: `mod-${i}`,
        isDirectory: () => true,
      }));

      // Track order of operations to verify parallelism
      const operationOrder = [];

      fs.readdir.mockImplementation(async (dirPath) => {
        if (dirPath.endsWith('mods')) {
          return mockModDirs;
        }
        // Return expression files for each mod
        return Array.from({ length: numExpressionsPerMod }, (_, i) => `expr-${i}.expression.json`);
      });

      fs.access.mockResolvedValue(undefined);

      // Add small delay to simulate I/O and track order
      fs.readFile.mockImplementation(async (filePath) => {
        const match = filePath.match(/mod-(\d+).*expr-(\d+)/);
        if (match) {
          operationOrder.push(`read:mod-${match[1]}:expr-${match[2]}`);
        }
        // Small delay to make parallelism measurable
        await new Promise((resolve) => setTimeout(resolve, 10));
        return JSON.stringify({ id: 'test:expr', diagnosticStatus: null });
      });

      const startTime = Date.now();
      const results = await service.scanAllExpressionStatuses();
      const duration = Date.now() - startTime;

      // Should return all expressions
      expect(results.length).toBe(numMods * numExpressionsPerMod);

      // With parallel I/O, time should be MUCH less than sequential
      // Sequential would be: numMods * numExpressionsPerMod * 10ms = 500ms minimum
      // Parallel should complete in roughly 10-50ms (depending on batch depth)
      // We use a generous threshold to avoid flaky tests
      expect(duration).toBeLessThan(200);
    });
  });

  describe('updateExpressionStatus', () => {
    it('should reject invalid status values', async () => {
      const result = await service.updateExpressionStatus(
        'data/mods/test/expressions/test.expression.json',
        'invalid_status'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid status');
    });

    it('should reject invalid file paths', async () => {
      const result = await service.updateExpressionStatus(
        '../../../etc/passwd',
        'normal'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid file path');
    });

    it('should update status successfully', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: null,
      });

      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await service.updateExpressionStatus(
        'data/mods/test/expressions/test.expression.json',
        'normal'
      );

      expect(result.success).toBe(true);
      expect(result.expressionId).toBe('test:expr');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"diagnosticStatus": "normal"'),
        'utf-8'
      );
    });

    it('should skip write when status unchanged', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
      });

      fs.readFile.mockResolvedValue(existingContent);

      const result = await service.updateExpressionStatus(
        'data/mods/test/expressions/test.expression.json',
        'normal'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Status unchanged');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file not found', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await service.updateExpressionStatus(
        'data/mods/test/expressions/missing.expression.json',
        'normal'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Expression file not found');
    });

    describe('should accept all valid statuses including uncommon and unobserved', () => {
      const ALL_VALID_STATUSES = [
        'unknown',
        'impossible',
        'unobserved',
        'extremely_rare',
        'rare',
        'uncommon',
        'normal',
        'frequent',
      ];

      it.each(ALL_VALID_STATUSES)(
        'should accept status: %s',
        async (status) => {
          const existingContent = JSON.stringify({
            id: 'test:expr',
            diagnosticStatus: null,
          });

          fs.readFile.mockResolvedValue(existingContent);
          fs.writeFile.mockResolvedValue(undefined);

          const result = await service.updateExpressionStatus(
            'data/mods/emotions-test/expressions/test.expression.json',
            status
          );

          expect(result.success).toBe(true);
          expect(result.expressionId).toBe('test:expr');
          expect(fs.writeFile).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining(`"diagnosticStatus": "${status}"`),
            'utf-8'
          );
        }
      );

      it('should specifically accept uncommon status', async () => {
        const existingContent = JSON.stringify({
          id: 'test:uncommon-expr',
          diagnosticStatus: null,
        });

        fs.readFile.mockResolvedValue(existingContent);
        fs.writeFile.mockResolvedValue(undefined);

        const result = await service.updateExpressionStatus(
          'data/mods/emotions-curiosity/expressions/test.expression.json',
          'uncommon'
        );

        expect(result.success).toBe(true);
        expect(result.message).not.toContain('Invalid status');
      });

      it('should specifically accept unobserved status', async () => {
        const existingContent = JSON.stringify({
          id: 'test:unobserved-expr',
          diagnosticStatus: null,
        });

        fs.readFile.mockResolvedValue(existingContent);
        fs.writeFile.mockResolvedValue(undefined);

        const result = await service.updateExpressionStatus(
          'data/mods/emotions-attention/expressions/test.expression.json',
          'unobserved'
        );

        expect(result.success).toBe(true);
        expect(result.message).not.toContain('Invalid status');
      });
    });
  });

  describe('updateExpressionTriggerRate', () => {
    it('should reject non-number trigger rate', async () => {
      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        'not-a-number'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be a number');
    });

    it('should reject NaN trigger rate', async () => {
      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        NaN
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be a number');
    });

    it('should reject trigger rate below 0', async () => {
      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        -0.1
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should reject trigger rate above 1.0', async () => {
      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        1.5
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0.0 and 1.0');
    });

    it('should reject invalid file paths', async () => {
      const result = await service.updateExpressionTriggerRate(
        '../../../etc/passwd',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid file path');
    });

    it('should update trigger rate successfully', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
      });

      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.125
      );

      expect(result.success).toBe(true);
      expect(result.expressionId).toBe('test:expr');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"triggerRate": 0.125'),
        'utf-8'
      );
    });

    it('should round trigger rate to 6 decimal places', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
      });

      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.123456789
      );

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"triggerRate": 0.123457'),
        'utf-8'
      );
    });

    it('should skip write when trigger rate unchanged', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
        triggerRate: 0.125,
      });

      fs.readFile.mockResolvedValue(existingContent);

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.125
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Trigger rate unchanged');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file not found', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/missing.expression.json',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Expression file not found');
    });

    it('should handle invalid JSON in file', async () => {
      fs.readFile.mockResolvedValue('not valid json');

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.5
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid JSON');
    });

    it('should accept boundary values 0.0 and 1.0', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
      });

      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue(undefined);

      // Test 0.0
      let result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.0
      );
      expect(result.success).toBe(true);

      // Test 1.0
      result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        1.0
      );
      expect(result.success).toBe(true);
    });

    it('should accept very small trigger rates like EXTREMELY_RARE threshold', async () => {
      const existingContent = JSON.stringify({
        id: 'test:expr',
        diagnosticStatus: 'normal',
      });

      fs.readFile.mockResolvedValue(existingContent);
      fs.writeFile.mockResolvedValue(undefined);

      const result = await service.updateExpressionTriggerRate(
        'data/mods/test/expressions/test.expression.json',
        0.00001 // EXTREMELY_RARE threshold
      );

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"triggerRate": 0.00001'),
        'utf-8'
      );
    });
  });
});
