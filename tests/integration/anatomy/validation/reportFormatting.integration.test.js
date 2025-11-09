/**
 * @file Integration tests for validation report formatting workflow
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';
import { ReportFormatter } from '../../../../src/anatomy/validation/ReportFormatter.js';
import { FixableIssueDetector } from '../../../../src/anatomy/validation/FixableIssueDetector.js';
import { RelatedFileFinder } from '../../../../src/anatomy/validation/RelatedFileFinder.js';

describe('Report Formatting Workflow Integration', () => {
  let complexReportData;
  let report;

  beforeEach(() => {
    // Create a complex validation report with multiple issue types
    complexReportData = {
      recipeId: 'test:complex_recipe',
      recipePath: 'data/mods/test/recipes/complex.recipe.json',
      timestamp: '2025-01-01T12:00:00.000Z',
      errors: [
        {
          type: 'COMPONENT_NOT_FOUND',
          message: 'Component "test:missing_component" not found',
          componentId: 'test:missing_component',
          location: { type: 'slot', name: 'torso' },
          suggestion: 'Review available components in data/mods/*/components/',
        },
        {
          type: 'BLUEPRINT_NOT_FOUND',
          message: 'Blueprint "test:custom_humanoid" does not exist',
          blueprintId: 'test:custom_humanoid',
          fix: 'Create blueprint at data/mods/test/blueprints/custom_humanoid.blueprint.json',
        },
        {
          type: 'SOCKET_NOT_FOUND',
          message: 'Socket "invalid_socket" not found',
          socketKey: 'invalid_socket',
          suggestion: 'Use valid socket key from blueprint',
          location: { type: 'slot', name: 'left_arm' },
        },
        {
          type: 'SCHEMA_VALIDATION_ERROR',
          message: 'Property "size" has invalid type',
          componentId: 'test:size_component',
          location: { type: 'pattern', name: 'body_pattern' },
        },
      ],
      warnings: [
        {
          type: 'PATTERN_NO_MATCH',
          message: 'Pattern "limb_pattern" has no matching slots',
          location: { type: 'pattern', name: 'limb_pattern' },
          suggestion: 'Adjust pattern tags or blueprint structure',
        },
        {
          type: 'MISSING_SLOT_TAG',
          message: 'Slot "head" missing descriptor tag',
          location: { type: 'slot', name: 'head' },
          suggestion: 'Add descriptor tag',
          suggestedTag: 'descriptors:size_category',
        },
      ],
      suggestions: [
        {
          type: 'MISSING_DESCRIPTORS',
          message: 'Slot "legs" may not appear in descriptions',
          location: { type: 'slot', name: 'legs' },
          reason: 'No descriptor components in tags',
          suggestion: 'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
          impact: 'Part will be excluded from anatomy description',
        },
      ],
      passed: [
        {
          check: 'component_existence',
          message: 'All 42 component references exist',
        },
        {
          check: 'property_schemas',
          message: 'All 15 property objects valid',
        },
      ],
    };

    report = new ValidationReport(complexReportData);
  });

  describe('Complete Workflow', () => {
    it('should create formatter from report', () => {
      const formatter = report.formatter();
      expect(formatter).toBeInstanceOf(ReportFormatter);
    });

    it('should generate HTML report with all sections', () => {
      const formatter = report.formatter();
      const html = formatter.toHTML();

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');

      // Verify all error messages present (HTML entities are escaped)
      expect(html).toContain('Component &quot;test:missing_component&quot; not found');
      expect(html).toContain('Blueprint &quot;test:custom_humanoid&quot; does not exist');
      expect(html).toContain('Socket &quot;invalid_socket&quot; not found');
      expect(html).toContain('Property &quot;size&quot; has invalid type');

      // Verify all warning messages present
      expect(html).toContain('Pattern &quot;limb_pattern&quot; has no matching slots');
      expect(html).toContain('Slot &quot;head&quot; missing descriptor tag');

      // Verify suggestion messages
      expect(html).toContain('Slot &quot;legs&quot; may not appear in descriptions');
    });

    it('should generate Markdown report with all sections', () => {
      const formatter = report.formatter();
      const md = formatter.toMarkdown();

      // Verify structure
      expect(md).toContain('# Validation Report');
      expect(md).toContain('## Metadata');
      expect(md).toContain('## Summary');
      expect(md).toContain('## ✗ Errors');
      expect(md).toContain('## ⚠ Warnings');
      expect(md).toContain('## 💡 Suggestions');

      // Verify content
      expect(md).toContain('test:complex_recipe');
      expect(md).toContain('Component "test:missing_component" not found');
      expect(md).toContain('Pattern "limb_pattern" has no matching slots');
    });

    it('should generate CSV report with all issues', () => {
      const formatter = report.formatter();
      const csv = formatter.toCSV();

      // Verify header
      expect(csv).toContain('Severity,Type,Message');

      // Verify all issue types
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(7); // Header + 4 errors + 2 warnings + 1 suggestion
    });

    it('should analyze fixable issues', () => {
      const fixable = FixableIssueDetector.analyze(report);

      // Should detect all error types
      expect(fixable.length).toBeGreaterThan(0);

      // Verify detection of different issue types
      const types = fixable.map((f) => f.type);
      expect(types).toContain('missing_component');
      expect(types).toContain('missing_blueprint');
      expect(types).toContain('invalid_socket_reference');
    });

    it('should batch fixable issues correctly', () => {
      const fixable = FixableIssueDetector.analyze(report);
      const batched = FixableIssueDetector.generateBatchSuggestions(fixable);

      expect(batched.summary.total).toBeGreaterThan(0);
      expect(batched.automatic.length + batched.semiAutomatic.length + batched.manual.length).toBe(
        batched.summary.total
      );
    });

    it('should extract all related files', () => {
      const files = RelatedFileFinder.extractFiles(report);

      // Should extract recipe file
      expect(files.recipes).toContain('data/mods/test/recipes/complex.recipe.json');

      // Should extract blueprint file
      expect(files.blueprints).toContain(
        'data/mods/test/blueprints/custom_humanoid.blueprint.json'
      );

      // Should extract component files
      expect(files.components.length).toBeGreaterThan(0);

      // Should have correct total
      expect(files.total).toBe(
        files.recipes.length +
          files.blueprints.length +
          files.components.length +
          files.other.length
      );
    });

    it('should format file list for display', () => {
      const files = RelatedFileFinder.extractFiles(report);
      const formatted = RelatedFileFinder.formatFileList(files);

      expect(formatted).toContain('Related Files:');
      expect(formatted).toContain('Recipes');
      expect(formatted).toContain('Blueprints');
      expect(formatted).toContain('Components');
      expect(formatted).toContain('Total:');
    });

    it('should generate fix script commands', () => {
      const fixable = FixableIssueDetector.analyze(report);
      const script = FixableIssueDetector.generateFixScript(fixable);

      expect(script.length).toBeGreaterThan(0);
      expect(script.join('\n')).toContain('#');
      expect(script.join('\n')).toContain('data/mods/');
    });

    it('should generate file check commands', () => {
      const files = RelatedFileFinder.extractFiles(report);
      const commands = RelatedFileFinder.generateFileCommands(files);

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.join('\n')).toContain('if [ ! -f');
      expect(commands.join('\n')).toContain('mkdir -p');
    });
  });

  describe('Cross-Component Integration', () => {
    it('should use formatter, detector, and finder together', () => {
      // Get formatter
      const formatter = report.formatter();

      // Generate reports
      const html = formatter.toHTML();
      const markdown = formatter.toMarkdown();
      const csv = formatter.toCSV();

      // Analyze fixability
      const fixable = FixableIssueDetector.analyze(report);
      const batched = FixableIssueDetector.generateBatchSuggestions(fixable);

      // Extract files
      const files = RelatedFileFinder.extractFiles(report);
      const fileList = RelatedFileFinder.formatFileList(files);

      // Verify all outputs are consistent
      expect(html).toContain('test:complex_recipe');
      expect(markdown).toContain('test:complex_recipe');
      // CSV contains issue data, not recipe ID in the data rows
      expect(csv).toContain('COMPONENT_NOT_FOUND');
      expect(batched.summary.total).toBeGreaterThan(0);
      expect(files.total).toBeGreaterThan(0);
    });

    it('should handle report with no issues', () => {
      const cleanReport = new ValidationReport({
        recipeId: 'test:clean',
        recipePath: 'data/mods/test/recipes/clean.recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [],
        suggestions: [],
        passed: [{ check: 'all', message: 'All checks passed' }],
      });

      const formatter = cleanReport.formatter();
      const html = formatter.toHTML();
      const fixable = FixableIssueDetector.analyze(cleanReport);
      const files = RelatedFileFinder.extractFiles(cleanReport);

      expect(html).toContain('PASSED');
      expect(fixable).toEqual([]);
      expect(files.total).toBe(1); // Only recipe file
    });

    it('should handle report with only warnings', () => {
      const warningOnlyReport = new ValidationReport({
        recipeId: 'test:warnings',
        recipePath: 'data/mods/test/recipes/warnings.recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [],
        warnings: [
          {
            type: 'PATTERN_NO_MATCH',
            message: 'Pattern has no matching slots',
          },
        ],
        suggestions: [],
        passed: [],
      });

      const formatter = warningOnlyReport.formatter();
      const md = formatter.toMarkdown();
      const fixable = FixableIssueDetector.analyze(warningOnlyReport);

      expect(md).toContain('## ⚠ Warnings');
      expect(fixable.length).toBe(1);
      expect(fixable[0].severity).toBe('warning');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in all formats', () => {
      const specialCharsReport = new ValidationReport({
        recipeId: 'test:<special>&chars',
        recipePath: 'data/mods/test/recipes/"quoted".recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: [
          {
            message: 'Error with <html> & "quotes" and, commas',
          },
        ],
        warnings: [],
        suggestions: [],
        passed: [],
      });

      const formatter = specialCharsReport.formatter();
      const html = formatter.toHTML();
      const csv = formatter.toCSV();

      // HTML should escape
      expect(html).not.toContain('<html>');
      expect(html).toContain('&lt;html&gt;');

      // CSV should quote
      expect(csv).toContain('"');
    });

    it('should handle very large reports efficiently', () => {
      const largeErrors = Array(100)
        .fill(null)
        .map((_, i) => ({
          type: 'TEST_ERROR',
          message: `Error ${i}`,
        }));

      const largeReport = new ValidationReport({
        recipeId: 'test:large',
        recipePath: 'data/mods/test/recipes/large.recipe.json',
        timestamp: '2025-01-01T00:00:00.000Z',
        errors: largeErrors,
        warnings: [],
        suggestions: [],
        passed: [],
      });

      const formatter = largeReport.formatter();
      const startTime = Date.now();
      const html = formatter.toHTML();
      const endTime = Date.now();

      expect(html).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
