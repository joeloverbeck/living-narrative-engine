/**
 * @file Unit tests for LogFilter component
 * @see logFilter.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import LogFilter from '../../../src/logging/logFilter.js';
import { createTestBed } from '../../common/testBed.js';

describe('LogFilter - Core Functionality', () => {
  let testBed;
  let logFilter;
  let mockLogger;
  let mockCallback;
  let sampleLogs;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockCallback = jest.fn();

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
      },
      {
        timestamp: now - 360000, // 6 minutes ago
        level: 'warn',
        message: 'Another warning',
        category: 'engine',
      },
      {
        timestamp: now - 1000000, // 16+ minutes ago
        level: 'error',
        message: 'Old error message',
        category: 'system',
      },
    ];

    logFilter = new LogFilter({
      logger: mockLogger,
      callbacks: {
        onFilterChange: mockCallback,
      },
    });
  });

  describe('Initialization', () => {
    it('should initialize with default filter criteria', () => {
      const filter = logFilter.getFilter();

      expect(filter).toEqual({
        level: 'all',
        searchText: '',
        category: 'all',
        timeRange: 'all',
      });
    });

    it('should initialize with empty logs array', () => {
      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toEqual([]);
    });

    it('should have initial categories set to ["all"]', () => {
      const categories = logFilter.getCategories();
      expect(categories).toEqual(['all']);
    });
  });

  describe('Log Management', () => {
    it('should set logs and update categories', () => {
      logFilter.setLogs(sampleLogs);

      const categories = logFilter.getCategories();
      expect(categories).toContain('all');
      expect(categories).toContain('engine');
      expect(categories).toContain('network');
      expect(categories).toContain('system');
    });

    it('should add individual logs', () => {
      const newLog = {
        timestamp: Date.now(),
        level: 'error',
        message: 'New error',
        category: 'database',
      };

      logFilter.addLog(newLog);

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toContain(newLog);

      const categories = logFilter.getCategories();
      expect(categories).toContain('database');
    });

    it('should clear all logs', () => {
      logFilter.setLogs(sampleLogs);
      logFilter.clearLogs();

      expect(logFilter.getFilteredLogs()).toEqual([]);
      expect(logFilter.getCategories()).toEqual(['all']);
    });

    it('should call onFilterChange when logs are set', () => {
      logFilter.setLogs(sampleLogs);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('Level Filtering', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should filter by warning level', () => {
      logFilter.setFilter({ level: 'warn' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs.every((log) => log.level === 'warn')).toBe(true);
    });

    it('should filter by error level', () => {
      logFilter.setFilter({ level: 'error' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs.every((log) => log.level === 'error')).toBe(true);
    });

    it('should show all logs when level is "all"', () => {
      logFilter.setFilter({ level: 'all' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(4);
    });
  });

  describe('Search Text Filtering', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should filter by message text', () => {
      logFilter.setFilter({ searchText: 'Test warning' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].message).toBe('Test warning message');
    });

    it('should filter by category text', () => {
      logFilter.setFilter({ searchText: 'engine' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs.every((log) => log.category === 'engine')).toBe(true);
    });

    it('should be case insensitive', () => {
      logFilter.setFilter({ searchText: 'ERROR' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs.length).toBeGreaterThan(0);
    });

    it('should handle empty search text', () => {
      logFilter.setFilter({ searchText: '' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(4);
    });
  });

  describe('Category Filtering', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should filter by specific category', () => {
      logFilter.setFilter({ category: 'engine' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs.every((log) => log.category === 'engine')).toBe(true);
    });

    it('should show all logs when category is "all"', () => {
      logFilter.setFilter({ category: 'all' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(4);
    });
  });

  describe('Time Range Filtering', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should filter by last 5 minutes', () => {
      logFilter.setFilter({ timeRange: 'last5min' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2); // Current and 30 seconds ago
    });

    it('should filter by last 15 minutes', () => {
      logFilter.setFilter({ timeRange: 'last15min' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(3); // Excludes 16+ minutes old log
    });

    it('should show all logs when timeRange is "all"', () => {
      logFilter.setFilter({ timeRange: 'all' });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(4);
    });
  });

  describe('Combined Filtering', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should apply multiple filters simultaneously', () => {
      logFilter.setFilter({
        level: 'warn',
        category: 'engine',
      });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2);
      expect(
        filteredLogs.every(
          (log) => log.level === 'warn' && log.category === 'engine'
        )
      ).toBe(true);
    });

    it('should handle complex filter combinations', () => {
      logFilter.setFilter({
        level: 'error',
        searchText: 'Test',
        timeRange: 'last5min',
      });

      const filteredLogs = logFilter.getFilteredLogs();
      expect(filteredLogs).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should provide accurate statistics', () => {
      const stats = logFilter.getStats();

      expect(stats.total).toBe(4);
      expect(stats.filtered).toBe(4);
      expect(stats.warnings).toBe(2);
      expect(stats.errors).toBe(2);
    });

    it('should update statistics after filtering', () => {
      logFilter.setFilter({ level: 'warn' });
      const stats = logFilter.getStats();

      expect(stats.total).toBe(4);
      expect(stats.filtered).toBe(2);
      expect(stats.warnings).toBe(2);
      expect(stats.errors).toBe(0);
    });

    it('should provide category breakdown', () => {
      const stats = logFilter.getStats();

      expect(stats.byCategory).toEqual({
        engine: 2,
        network: 1,
        system: 1,
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      logFilter.setLogs(sampleLogs);
    });

    it('should export as JSON', () => {
      const jsonData = logFilter.exportAsJSON();
      const parsed = JSON.parse(jsonData);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(4);
    });

    it('should export as CSV', () => {
      const csvData = logFilter.exportAsCSV();
      const lines = csvData.split('\n');

      expect(lines[0]).toBe('Timestamp,Level,Category,Message');
      expect(lines).toHaveLength(5); // Header + 4 data rows
    });

    it('should handle CSV escaping for quotes in messages', () => {
      const logWithQuotes = {
        timestamp: Date.now(),
        level: 'error',
        message: 'Message with "quotes"',
        category: 'test',
      };

      logFilter.setLogs([logWithQuotes]);
      const csvData = logFilter.exportAsCSV();

      expect(csvData).toContain('"Message with ""quotes"""');
    });
  });

  describe('Filter State Management', () => {
    it('should only trigger callback when filter actually changes', () => {
      logFilter.setLogs(sampleLogs);
      mockCallback.mockClear();

      logFilter.setFilter({ level: 'warn' });
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Set same filter again
      logFilter.setFilter({ level: 'warn' });
      expect(mockCallback).toHaveBeenCalledTimes(1); // Should not call again
    });

    it('should maintain immutable filter criteria', () => {
      const originalCriteria = logFilter.getFilter();
      const retrieved = logFilter.getFilter();

      retrieved.level = 'modified';

      expect(logFilter.getFilter().level).toBe(originalCriteria.level);
    });
  });

  describe('Edge Cases', () => {
    it('should handle logs without categories', () => {
      const logsWithoutCategories = [
        { timestamp: Date.now(), level: 'warn', message: 'Test' },
      ];

      logFilter.setLogs(logsWithoutCategories);
      const stats = logFilter.getStats();

      expect(stats.byCategory.general).toBe(1);
    });

    it('should handle malformed log entries gracefully', () => {
      const malformedLogs = [
        { timestamp: null, level: 'warn', message: null },
        { timestamp: Date.now(), level: null, message: 'Test' },
      ];

      expect(() => {
        logFilter.setLogs(malformedLogs);
        logFilter.setFilter({ searchText: 'test' });
      }).not.toThrow();
    });
  });
});
