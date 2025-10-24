import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
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

    it('delegates cross-reference Map wrappers to the ecosystem console generator', () => {
      const crossReferenceMap = new Map([
        ['modA', { hasViolations: false, violations: [] }],
      ]);
      const options = { colors: false };
      const ecosystemSpy = jest
        .spyOn(reporter, '_generateEcosystemConsoleReport')
        .mockReturnValue('ecosystem-output');

      const wrapper = { crossReferences: crossReferenceMap };
      const result = reporter.generateReport(wrapper, 'console', options);

      expect(ecosystemSpy).toHaveBeenCalledTimes(1);
      expect(ecosystemSpy).toHaveBeenCalledWith(crossReferenceMap, options);
      expect(result).toBe('ecosystem-output');

      ecosystemSpy.mockRestore();
    });

    it('should include impact details when verbose mode is enabled', () => {
      const mockReport = {
        modId: 'impact_mod',
        hasViolations: true,
        violations: [
          {
            severity: 'critical',
            referencedMod: 'missing_mod',
            referencedComponent: 'component1',
            impact: { loadingFailure: true, runtimeFailure: false },
            suggestedFixes: [],
          },
        ],
        declaredDependencies: ['core'],
        referencedMods: ['missing_mod'],
        missingDependencies: ['missing_mod'],
      };

      const report = reporter.generateReport(mockReport, 'console', {
        verbose: true,
        colors: false,
      });

      expect(report).toContain(
        '📊 Impact: loading=true, runtime=false'
      );
    });

    it('should fall back to legacy formatting when severity data is unavailable', () => {
      const severitySpy = jest
        .spyOn(reporter, '_groupBySeverity')
        .mockReturnValue(new Map());

      const mockReport = {
        modId: 'legacy_mod',
        hasViolations: true,
        violations: [
          {
            referencedMod: 'missing_mod',
            referencedComponent: 'component1',
            file: 'missing.json',
            line: 42,
          },
        ],
        declaredDependencies: [],
        referencedMods: [],
        missingDependencies: ['missing_mod'],
      };

      const report = reporter.generateReport(mockReport, 'console');

      expect(report).toContain('Violations:');
      expect(report).toContain('📦 Missing dependency: missing_mod');
      expect(report).toContain(
        '💡 Fix: Add "missing_mod" to dependencies in mod-manifest.json'
      );
      expect(report).toContain('(none declared)');
      expect(report).toContain('(no external references found)');

      severitySpy.mockRestore();
    });

    it('delegates file existence validation results to the specialized reporter', () => {
      const fileExistenceResults = new Map([
        [
          'example_mod',
          {
            modId: 'example_mod',
            isValid: false,
            missingFiles: [],
            namingIssues: [],
          },
        ],
      ]);
      const options = { verbose: true };
      const originalImplementation = reporter._generateFileExistenceReport.bind(
        reporter
      );
      const fileReportSpy = jest
        .spyOn(reporter, '_generateFileExistenceReport')
        .mockImplementation(originalImplementation);

      const wrapper = { fileExistence: fileExistenceResults };
      const result = reporter.generateReport(wrapper, 'console', options);

      expect(fileReportSpy).toHaveBeenCalledTimes(1);
      expect(fileReportSpy).toHaveBeenCalledWith(fileExistenceResults, options);
      expect(result).toContain(
        'Living Narrative Engine - File Existence Validation Report'
      );

      fileReportSpy.mockRestore();
    });

    it('summarizes missing files and naming mismatches for invalid mods', () => {
      const fileExistenceResults = new Map([
        [
          'valid_mod',
          {
            modId: 'valid_mod',
            isValid: true,
            missingFiles: [],
            namingIssues: [],
          },
        ],
        [
          'problem_mod',
          {
            modId: 'problem_mod',
            isValid: false,
            missingFiles: [
              { category: 'rules', file: 'missing.rule.json' },
              { category: 'stories', file: 'absent.story.json' },
            ],
            namingIssues: [
              {
                category: 'events',
                manifestRef: 'bad_event',
                actualFile: 'bad-event',
              },
            ],
          },
        ],
      ]);

      const output = reporter.generateReport(
        { fileExistence: fileExistenceResults },
        'console'
      );

      expect(output).toContain(
        'Living Narrative Engine - File Existence Validation Report'
      );
      expect(output).toContain('❌ Found 3 issues in 1 mod(s):');
      expect(output).toContain('   - 2 missing files');
      expect(output).toContain('   - 1 naming convention mismatches');
      expect(output).toContain('📦 Mod: problem_mod');
      expect(output).toContain('❌ Missing files:');
      expect(output).toContain('- rules/missing.rule.json');
      expect(output).toContain('- stories/absent.story.json');
      expect(output).toContain('⚠️  Naming mismatches (underscore vs hyphen):');
      expect(output).toContain('Manifest: events/bad_event');
      expect(output).toContain('Actual:   events/bad-event');
      expect(output).toContain('💡 Fix: Update manifest to use "bad-event"');
    });

    it('reports success when all manifest file references are valid', () => {
      const fileExistenceResults = new Map([
        [
          'modA',
          {
            modId: 'modA',
            isValid: true,
            missingFiles: [],
            namingIssues: [],
          },
        ],
        [
          'modB',
          {
            modId: 'modB',
            isValid: true,
            missingFiles: [],
            namingIssues: [],
          },
        ],
      ]);

      const output = reporter.generateReport(
        { fileExistence: fileExistenceResults },
        'console',
        { colors: false }
      );

      expect(output).toContain('✅ All manifest file references are valid');
      expect(output).toContain('📊 Validated 2 mods successfully');
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

    it('should handle nested cross-reference structures with suggestions', () => {
      const nestedResults = new Map([
        [
          'modNested',
          {
            hasViolations: false,
            crossReferences: {
              hasViolations: true,
              violations: [
                {
                  severity: 'critical',
                  referencedMod: 'missing_mod',
                  referencedComponent: 'component1',
                  suggestedFixes: [
                    {
                      priority: 'primary',
                      description: 'Declare missing_mod dependency',
                    },
                  ],
                },
                {
                  severity: 'high',
                  referencedMod: 'other_mod',
                  referencedComponent: 'component2',
                  suggestedFix: 'Add other_mod dependency',
                },
              ],
              missingDependencies: ['missing_mod', 'other_mod'],
            },
          },
        ],
      ]);

      const report = reporter.generateReport(nestedResults, 'console', {
        colors: false,
        showSuggestions: true,
      });

      expect(report).toContain('❌ Found 2 violations across 1 mods');
      expect(report).toContain('missing_mod');
      expect(report).toContain('other_mod');
      expect(report).toContain('Declare missing_mod dependency');
      expect(report).toContain('Add other_mod dependency');
    });

    it('includes file locations and severity icons for ecosystem violations', () => {
      const ecosystemResults = new Map([
        [
          'detailed_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'missing_mod',
                referencedComponent: 'componentX',
                file: 'path/to/rule.json',
                line: 42,
                severity: 'medium',
              },
            ],
            missingDependencies: ['missing_mod'],
          },
        ],
      ]);

      const output = reporter.generateReport(ecosystemResults, 'console', {
        colors: false,
      });

      expect(output).toContain('path/to/rule.json:42');
      expect(output).toContain('componentX (path/to/rule.json:42) ⚡');
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

    it('skips null entries when summarizing ecosystem reports', () => {
      const mockResults = new Map([
        ['mod1', { hasViolations: false, violations: [] }],
        ['mod2', null],
      ]);

      const report = reporter.generateReport(mockResults, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.summary).toEqual({
        totalMods: 2,
        modsWithViolations: 0,
        totalViolations: 0,
        validationPassed: true,
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

    it('should summarize nested cross-reference results in JSON output', () => {
      const nestedResults = new Map([
        [
          'modNested',
          {
            hasViolations: false,
            crossReferences: {
              hasViolations: true,
              violations: [
                {
                  referencedMod: 'missing_mod',
                  referencedComponent: 'component1',
                },
              ],
            },
          },
        ],
        ['modWithoutViolations', { hasViolations: false }],
      ]);

      const report = reporter.generateReport(nestedResults, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.type).toBe('ecosystem');
      expect(parsed.summary).toEqual(
        expect.objectContaining({
          totalMods: 2,
          modsWithViolations: 1,
          totalViolations: 1,
          validationPassed: false,
        })
      );
      expect(parsed.mods).toHaveProperty('modNested');
      expect(parsed.mods).toHaveProperty('modWithoutViolations');
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

    it('should render ecosystem HTML with no violations', () => {
      const results = new Map([
        ['modA', { hasViolations: false, violations: [] }],
        ['modB', { hasViolations: false, violations: [] }],
      ]);

      const report = reporter.generateReport(results, 'html');

      expect(report).toContain('✅ No violations detected');
      expect(report).toContain('Successfully validated 2 mods.');
    });

    it('should render ecosystem HTML with violation details', () => {
      const results = new Map([
        ['safe_mod', { hasViolations: false, violations: [] }],
        [
          'problem_mod',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'high',
                referencedMod: 'missing_mod',
                referencedComponent: 'component1',
                file: 'test.json',
                line: 7,
                contextSnippet: 'missing_mod:component1',
              },
            ],
          },
        ],
      ]);

      const report = reporter.generateReport(results, 'html');

      expect(report).toContain('❌ 1 violations found across 1 mods');
      expect(report).toContain('<h3>📦 problem_mod</h3>');
      expect(report).toContain('missing_mod:component1');
      expect(report).toContain('💡 Add dependency to manifest');
      expect(report).toContain('📁 test.json:7');
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

    it('should render ecosystem Markdown with no violations', () => {
      const results = new Map([
        ['modA', { hasViolations: false, violations: [] }],
        ['modB', { hasViolations: false, violations: [] }],
      ]);

      const report = reporter.generateReport(results, 'markdown');

      expect(report).toContain('## ✅ No violations detected');
      expect(report).toContain('Successfully validated 2 mods.');
    });

    it('should render ecosystem Markdown with violation details', () => {
      const results = new Map([
        ['safe_mod', { hasViolations: false, violations: [] }],
        [
          'problem_mod',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'medium',
                referencedMod: 'missing_mod',
                referencedComponent: 'component1',
                file: 'test.json',
                line: 12,
                contextSnippet: 'missing_mod:component1',
              },
            ],
          },
        ],
      ]);

      const report = reporter.generateReport(results, 'markdown');

      expect(report).toContain('## ❌ 1 violations found across 1 mods');
      expect(report).toContain('### 📦 problem_mod');
      expect(report).toContain('- **missing_mod:component1**');
      expect(report).toContain('💡 Add dependency to manifest');
      expect(report).toContain('📝 `missing_mod:component1`');
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
