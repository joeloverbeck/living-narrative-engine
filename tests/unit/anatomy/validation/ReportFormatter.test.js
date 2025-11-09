/**
 * @file Unit tests for ReportFormatter
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReportFormatter } from '../../../../src/anatomy/validation/ReportFormatter.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('ReportFormatter', () => {
  let mockReportData;
  let report;

  beforeEach(() => {
    mockReportData = {
      recipeId: 'test:recipe',
      recipePath: 'data/mods/test/recipes/test.recipe.json',
      timestamp: '2025-01-01T00:00:00.000Z',
      errors: [
        {
          type: 'COMPONENT_NOT_FOUND',
          message: 'Component not found',
          componentId: 'test:missing',
          location: { type: 'slot', name: 'test_slot' },
          fix: 'Add component definition',
        },
      ],
      warnings: [
        {
          type: 'PATTERN_NO_MATCH',
          message: 'Pattern has no matching slots',
          location: { type: 'pattern', name: 'test_pattern' },
          suggestion: 'Adjust pattern tags',
        },
      ],
      suggestions: [
        {
          type: 'MISSING_DESCRIPTORS',
          message: 'Slot may not appear in descriptions',
          location: { type: 'slot', name: 'test_slot' },
          reason: 'No descriptor components',
          suggestion: 'Add descriptor components',
          impact: 'Part excluded from description',
        },
      ],
      passed: [
        {
          check: 'component_existence',
          message: 'All component references exist',
        },
      ],
    };

    report = new ValidationReport(mockReportData);
  });

  describe('constructor', () => {
    it('should create formatter with report', () => {
      const formatter = new ReportFormatter(report);
      expect(formatter).toBeDefined();
    });

    it('should throw error if report is missing', () => {
      expect(() => new ReportFormatter(null)).toThrow('Report is required');
    });
  });

  describe('toHTML', () => {
    it('should generate valid HTML report', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('Validation Report');
    });

    it('should include recipe information in HTML', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('test:recipe');
      expect(html).toContain('data/mods/test/recipes/test.recipe.json');
    });

    it('should include summary statistics in HTML', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('Errors');
      expect(html).toContain('Warnings');
      expect(html).toContain('Suggestions');
      expect(html).toContain('Passed Checks');
    });

    it('should include errors section in HTML', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('Component not found');
      expect(html).toContain('test:missing');
      expect(html).toContain('Add component definition');
    });

    it('should include warnings section in HTML', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('Pattern has no matching slots');
      expect(html).toContain('Adjust pattern tags');
    });

    it('should include suggestions section in HTML', () => {
      const formatter = new ReportFormatter(report);
      const html = formatter.toHTML();

      expect(html).toContain('Slot may not appear in descriptions');
      expect(html).toContain('Add descriptor components');
    });

    it('should escape HTML special characters', () => {
      const maliciousData = {
        ...mockReportData,
        recipeId: '<script>alert("xss")</script>',
      };
      const maliciousReport = new ValidationReport(maliciousData);
      const formatter = new ReportFormatter(maliciousReport);
      const html = formatter.toHTML();

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('toMarkdown', () => {
    it('should generate valid Markdown report', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('# Validation Report: test:recipe');
      expect(md).toContain('## Metadata');
      expect(md).toContain('## Summary');
    });

    it('should include metadata in Markdown', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('test:recipe');
      expect(md).toContain('data/mods/test/recipes/test.recipe.json');
      expect(md).toContain('2025-01-01T00:00:00.000Z');
    });

    it('should include summary table in Markdown', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('| Metric | Count |');
      expect(md).toContain('| Errors |');
      expect(md).toContain('| Warnings |');
      expect(md).toContain('| Suggestions |');
    });

    it('should include errors section in Markdown', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('## ✗ Errors');
      expect(md).toContain('### Error 1');
      expect(md).toContain('Component not found');
    });

    it('should include warnings section in Markdown', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('## ⚠ Warnings');
      expect(md).toContain('### Warning 1');
      expect(md).toContain('Pattern has no matching slots');
    });

    it('should include suggestions section in Markdown', () => {
      const formatter = new ReportFormatter(report);
      const md = formatter.toMarkdown();

      expect(md).toContain('## 💡 Suggestions');
      expect(md).toContain('### Suggestion 1');
      expect(md).toContain('Slot may not appear in descriptions');
    });
  });

  describe('toCSV', () => {
    it('should generate valid CSV report', () => {
      const formatter = new ReportFormatter(report);
      const csv = formatter.toCSV();

      expect(csv).toContain('Severity,Type,Message,Location Type,Location Name,Component,Fix,Suggestion');
    });

    it('should include errors in CSV', () => {
      const formatter = new ReportFormatter(report);
      const csv = formatter.toCSV();

      expect(csv).toContain('Error,COMPONENT_NOT_FOUND');
      expect(csv).toContain('Component not found');
    });

    it('should include warnings in CSV', () => {
      const formatter = new ReportFormatter(report);
      const csv = formatter.toCSV();

      expect(csv).toContain('Warning,PATTERN_NO_MATCH');
      expect(csv).toContain('Pattern has no matching slots');
    });

    it('should include suggestions in CSV', () => {
      const formatter = new ReportFormatter(report);
      const csv = formatter.toCSV();

      expect(csv).toContain('Suggestion,MISSING_DESCRIPTORS');
      expect(csv).toContain('Slot may not appear in descriptions');
    });

    it('should escape CSV special characters', () => {
      const csvData = {
        ...mockReportData,
        errors: [
          {
            type: 'TEST',
            message: 'Message with "quotes" and, commas',
          },
        ],
      };
      const csvReport = new ValidationReport(csvData);
      const formatter = new ReportFormatter(csvReport);
      const csv = formatter.toCSV();

      expect(csv).toContain('"Message with ""quotes"" and, commas"');
    });
  });

  describe('formatter() integration', () => {
    it('should be accessible via report.formatter()', () => {
      const formatter = report.formatter();
      expect(formatter).toBeInstanceOf(ReportFormatter);
    });

    it('should produce consistent output through formatter()', () => {
      const formatter = report.formatter();
      const html = formatter.toHTML();
      expect(html).toContain('test:recipe');
    });
  });
});
