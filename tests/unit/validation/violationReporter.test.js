import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ViolationReporter from '../../../src/validation/violationReporter.js';

describe('ViolationReporter', () => {
  let testBed;
  let reporter;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    reporter = new ViolationReporter({ logger: mockLogger });
  });

  afterEach(() => {
    testBed.cleanup?.();
  });

  describe('Constructor Validation', () => {
    it('should require logger dependency', () => {
      expect(() => {
        new ViolationReporter({ logger: null });
      }).toThrow();
    });

    it('should validate logger has required methods', () => {
      expect(() => {
        new ViolationReporter({
          logger: { info: () => {} }, // missing other required methods
        });
      }).toThrow();
    });
  });

  describe('Console Report Generation', () => {
    it('should generate report for single mod with no violations', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      const report = reporter.generateReport(mockReport, 'console');

      expect(report).toContain('✅ No cross-reference violations detected');
      expect(report).toContain(
        "Cross-Reference Validation Report for 'test_mod'"
      );
      expect(report).toContain('References to 1 mods');
      expect(report).toContain('5 total component references');
    });

    it('should generate enhanced console output with severity grouping', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [
          {
            severity: 'critical',
            referencedMod: 'missing_mod',
            referencedComponent: 'component1',
            file: 'test.rule.json',
            line: 10,
            contextSnippet: '"condition_ref": "missing_mod:component1"',
            suggestedFixes: [
              {
                priority: 'primary',
                description: 'Add missing_mod to dependencies',
              },
            ],
          },
          {
            severity: 'high',
            referencedMod: 'missing_mod',
            referencedComponent: 'component2',
            file: 'test.action.json',
            line: 15,
            contextSnippet: '"required_components": ["missing_mod:component2"]',
            suggestedFixes: [
              {
                priority: 'primary',
                description: 'Add missing_mod to dependencies',
              },
            ],
          },
        ],
        declaredDependencies: ['core'],
        referencedMods: ['missing_mod'],
        missingDependencies: ['missing_mod'],
      };

      const report = reporter.generateReport(mockReport, 'console', {
        showSuggestions: true,
      });

      expect(report).toContain('CRITICAL (1):');
      expect(report).toContain('HIGH (1):');
      expect(report).toContain('📁 test.rule.json:10');
      expect(report).toContain('📁 test.action.json:15');
      expect(report).toContain('📝 "condition_ref": "missing_mod:component1"');
      expect(report).toContain('💡 Add missing_mod to dependencies');
    });

    it('should handle basic violations without enhanced data', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [
          {
            referencedMod: 'missing_mod',
            referencedComponent: 'component1',
            file: 'multiple',
            line: null,
            suggestedFix:
              'Add "missing_mod" to dependencies in mod-manifest.json',
          },
        ],
        declaredDependencies: ['core'],
        referencedMods: ['missing_mod'],
        missingDependencies: ['missing_mod'],
      };

      const report = reporter.generateReport(mockReport, 'console');

      // Since violations without severity default to 'low', expect LOW grouping
      expect(report).toContain('📝 LOW (1):');
      expect(report).toContain('❌ missing_mod:component1');
      expect(report).not.toContain('Violations:'); // Old format no longer used
      expect(report).not.toContain('📦 Missing dependency:'); // Old format no longer used
    });

    it('should hide suggestions when requested', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [
          {
            severity: 'high',
            referencedMod: 'missing_mod',
            referencedComponent: 'component1',
            suggestedFixes: [
              {
                priority: 'primary',
                description: 'Add missing_mod to dependencies',
              },
            ],
          },
        ],
        declaredDependencies: [],
        referencedMods: ['missing_mod'],
        missingDependencies: ['missing_mod'],
      };

      const report = reporter.generateReport(mockReport, 'console', {
        showSuggestions: false,
      });

      expect(report).not.toContain('💡');
      expect(report).not.toContain('Add missing_mod to dependencies');
    });
  });

  describe('Ecosystem Console Report Generation', () => {
    it('should generate ecosystem report with no violations', () => {
      const mockResults = new Map([
        ['mod1', { hasViolations: false, violations: [] }],
        ['mod2', { hasViolations: false, violations: [] }],
      ]);

      const report = reporter.generateReport(mockResults, 'console');

      expect(report).toContain(
        '✅ No cross-reference violations detected in ecosystem'
      );
      expect(report).toContain('📊 Validated 2 mods successfully');
    });

    it('should generate ecosystem report with violations and severity totals', () => {
      const mockResults = new Map([
        [
          'mod1',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'critical',
                referencedMod: 'missing1',
                referencedComponent: 'comp1',
              },
              {
                severity: 'high',
                referencedMod: 'missing1',
                referencedComponent: 'comp2',
              },
            ],
            missingDependencies: ['missing1'],
          },
        ],
        [
          'mod2',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'medium',
                referencedMod: 'missing2',
                referencedComponent: 'comp1',
              },
            ],
            missingDependencies: ['missing2'],
          },
        ],
      ]);

      const report = reporter.generateReport(mockResults, 'console');

      expect(report).toContain('❌ Found 3 violations across 2 mods');
      expect(report).toContain('Violation Summary by Severity:');
      expect(report).toContain('🚨 CRITICAL: 1 violations');
      expect(report).toContain('⚠️ HIGH: 1 violations');
      expect(report).toContain('⚡ MEDIUM: 1 violations');
      expect(report).toContain('📦 mod1:');
      expect(report).toContain('📦 mod2:');
    });

    it('should sort mods by violation count in summary table', () => {
      const mockResults = new Map([
        [
          'low_violations',
          {
            hasViolations: true,
            violations: [
              { referencedMod: 'missing', referencedComponent: 'comp1' },
            ],
            missingDependencies: ['missing'],
          },
        ],
        [
          'high_violations',
          {
            hasViolations: true,
            violations: [
              { referencedMod: 'missing', referencedComponent: 'comp1' },
              { referencedMod: 'missing', referencedComponent: 'comp2' },
              { referencedMod: 'missing', referencedComponent: 'comp3' },
            ],
            missingDependencies: ['missing'],
          },
        ],
      ]);

      const report = reporter.generateReport(mockResults, 'console');

      const lines = report.split('\n');
      const summaryStart = lines.findIndex((line) =>
        line.includes('Violation Summary by Mod:')
      );
      const highViolationsLine = lines.findIndex((line) =>
        line.includes('high_violations')
      );
      const lowViolationsLine = lines.findIndex((line) =>
        line.includes('low_violations')
      );

      expect(highViolationsLine).toBeLessThan(lowViolationsLine);
      expect(highViolationsLine).toBeGreaterThan(summaryStart);
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate valid JSON for single mod report', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [{ referencedMod: 'missing', referencedComponent: 'comp' }],
      };

      const report = reporter.generateReport(mockReport, 'json');

      expect(() => JSON.parse(report)).not.toThrow();
      const parsed = JSON.parse(report);

      expect(parsed).toMatchObject({
        timestamp: expect.any(String),
        validatorVersion: expect.any(String),
        format: 'json',
        type: 'single-mod',
        mod: mockReport,
      });
    });

    it('should generate valid JSON for ecosystem report', () => {
      const mockResults = new Map([
        ['mod1', { hasViolations: false, violations: [] }],
        ['mod2', { hasViolations: true, violations: [{ test: 'violation' }] }],
      ]);

      const report = reporter.generateReport(mockResults, 'json');

      expect(() => JSON.parse(report)).not.toThrow();
      const parsed = JSON.parse(report);

      expect(parsed).toMatchObject({
        timestamp: expect.any(String),
        validatorVersion: expect.any(String),
        format: 'json',
        type: 'ecosystem',
        mods: expect.any(Object),
        summary: expect.objectContaining({
          totalMods: 2,
          modsWithViolations: 1,
          totalViolations: 1,
          validationPassed: false,
        }),
      });
    });

    it('should support pretty printing', () => {
      const mockReport = {
        modId: 'test',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      const compactReport = reporter.generateReport(mockReport, 'json', {
        pretty: false,
      });
      const prettyReport = reporter.generateReport(mockReport, 'json', {
        pretty: true,
      });

      expect(compactReport.includes('\n')).toBe(false);
      expect(prettyReport.includes('\n')).toBe(true);
      expect(prettyReport.includes('  ')).toBe(true); // indentation
    });
  });

  describe('HTML Report Generation', () => {
    it('should generate valid HTML structure', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: false,
      };

      const report = reporter.generateReport(mockReport, 'html');

      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('<html lang="en">');
      expect(report).toContain('<head>');
      expect(report).toContain('<body>');
      expect(report).toContain(
        '<title>Cross-Reference Validation Report</title>'
      );
      expect(report).toContain('✅ No violations detected');
    });

    it('should generate HTML with violations and severity classes', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [
          {
            severity: 'critical',
            referencedMod: 'missing',
            referencedComponent: 'comp',
            file: 'test.json',
            line: 10,
            contextSnippet: 'code snippet',
            suggestedFix: 'Add dependency',
          },
        ],
      };

      const report = reporter.generateReport(mockReport, 'html');

      expect(report).toContain('class="violation severity-critical"');
      expect(report).toContain('missing:comp');
      expect(report).toContain('📁 test.json:10');
      expect(report).toContain('<code>code snippet</code>');
      expect(report).toContain('💡 Add dependency');
    });

    it('should support custom title', () => {
      const mockReport = {
        modId: 'test',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      const report = reporter.generateReport(mockReport, 'html', {
        title: 'Custom Report Title',
      });

      expect(report).toContain('<title>Custom Report Title</title>');
      expect(report).toContain('<h1>Custom Report Title</h1>');
    });
  });

  describe('Markdown Report Generation', () => {
    it('should generate valid Markdown structure', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: false,
      };

      const report = reporter.generateReport(mockReport, 'markdown');

      expect(report).toContain('# Cross-Reference Validation Report');
      expect(report).toContain('Generated:');
      expect(report).toContain('## Mod: test_mod');
      expect(report).toContain('### ✅ No violations detected');
    });

    it('should generate Markdown with violations list', () => {
      const mockReport = {
        modId: 'test_mod',
        hasViolations: true,
        violations: [
          {
            severity: 'high',
            referencedMod: 'missing',
            referencedComponent: 'comp',
            file: 'test.json',
            line: 10,
            contextSnippet: 'code snippet',
            suggestedFix: 'Add dependency',
          },
        ],
      };

      const report = reporter.generateReport(mockReport, 'markdown');

      expect(report).toContain('### ❌ 1 violations detected');
      expect(report).toContain('- **missing:comp**');
      expect(report).toContain('  - 📁 `test.json:10`');
      expect(report).toContain('  - 📝 `code snippet`');
      expect(report).toContain('  - ⚠️ Severity: high');
      expect(report).toContain('  - 💡 Add dependency');
    });

    it('should support custom title in Markdown', () => {
      const mockReport = {
        modId: 'test',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      const report = reporter.generateReport(mockReport, 'markdown', {
        title: 'Custom Markdown Title',
      });

      expect(report).toContain('# Custom Markdown Title');
    });
  });

  describe('Format Validation', () => {
    it('should throw error for unsupported format', () => {
      const mockReport = {
        modId: 'test',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      expect(() => {
        reporter.generateReport(mockReport, 'unsupported_format');
      }).toThrow('Unsupported report format: unsupported_format');
    });

    it('should handle format case insensitivity', () => {
      const mockReport = {
        modId: 'test',
        hasViolations: false,
        referencedMods: ['core'],
        summary: {
          totalReferences: 5,
        },
      };

      expect(() => {
        reporter.generateReport(mockReport, 'JSON');
      }).not.toThrow();

      expect(() => {
        reporter.generateReport(mockReport, 'HTML');
      }).not.toThrow();

      expect(() => {
        reporter.generateReport(mockReport, 'CONSOLE');
      }).not.toThrow();
    });
  });

  describe('Helper Methods', () => {
    it('should group violations by severity correctly', () => {
      const violations = [
        { severity: 'high' },
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'low' },
      ];

      const grouped = reporter['_groupBySeverity'](violations);

      expect(grouped.get('high')).toHaveLength(2);
      expect(grouped.get('critical')).toHaveLength(1);
      expect(grouped.get('low')).toHaveLength(1);
      expect(grouped.has('medium')).toBe(false);
    });

    it('should group violations by mod correctly', () => {
      const violations = [
        { referencedMod: 'mod1' },
        { referencedMod: 'mod2' },
        { referencedMod: 'mod1' },
      ];

      const grouped = reporter['_groupByMod'](violations);

      expect(grouped.get('mod1')).toHaveLength(2);
      expect(grouped.get('mod2')).toHaveLength(1);
    });

    it('should calculate ecosystem severity totals correctly', () => {
      const modsWithViolations = [
        [
          'mod1',
          {
            violations: [{ severity: 'critical' }, { severity: 'high' }],
          },
        ],
        [
          'mod2',
          {
            violations: [{ severity: 'high' }, { severity: 'medium' }],
          },
        ],
      ];

      const totals =
        reporter['_calculateEcosystemSeverityTotals'](modsWithViolations);

      expect(totals).toEqual({
        critical: 1,
        high: 2,
        medium: 1,
        low: 0,
      });
    });
  });
});
