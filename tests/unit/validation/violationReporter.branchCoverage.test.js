import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ViolationReporter from '../../../src/validation/violationReporter.js';

describe('ViolationReporter branch coverage', () => {
  let testBed;
  let reporter;

  beforeEach(() => {
    testBed = createTestBed();
    reporter = new ViolationReporter({ logger: testBed.mockLogger });
  });

  afterEach(() => {
    testBed.cleanup?.();
  });

  it('uses default console format and falls back when metadata is missing', () => {
    const output = reporter.generateReport({
      modId: 'minimal_mod',
      hasViolations: false,
    });

    expect(output).toContain("Cross-Reference Validation Report for 'minimal_mod'");
    expect(output).toContain('References to 0 mods');
    expect(output).toContain('0 total component references');
  });

  it('omits suggestions when only secondary fixes exist and marks declared references as satisfied', () => {
    const output = reporter.generateReport({
      modId: 'branch_mod',
      hasViolations: true,
      violations: [
        {
          severity: 'high',
          referencedMod: 'missing_mod',
          referencedComponent: 'componentA',
          suggestedFixes: [
            {
              priority: 'secondary',
              description: 'Secondary recommendation only',
            },
          ],
        },
      ],
      declaredDependencies: ['declared_mod'],
      referencedMods: ['declared_mod', 'missing_mod'],
      missingDependencies: ['missing_mod'],
    });

    expect(output).toContain('HIGH (1):');
    expect(output).not.toContain('💡 Secondary recommendation only');
    expect(output).toContain('✅ declared_mod');
    expect(output).toContain('❌ missing_mod');
  });

  it('generates console output with default internal options when called directly', () => {
    const lines = reporter
      ._generateConsoleReport({
        modId: 'direct_mod',
        hasViolations: true,
        violations: [
          {
            referencedMod: 'indirect_mod',
            referencedComponent: 'componentB',
          },
        ],
        declaredDependencies: [],
        referencedMods: [],
        missingDependencies: ['indirect_mod'],
      })
      .split('\n');

    expect(lines[0]).toBe("Cross-Reference Validation Report for 'direct_mod'");
    expect(lines.some((line) => line.includes('📝 LOW (1):'))).toBe(true);
  });

  it('supports nested ecosystem data and per-mod fallbacks when suggestions are allowed', () => {
    const report = reporter._generateEcosystemConsoleReport(
      new Map([
        [
          'cross_mod',
          {
            hasViolations: false,
            crossReferences: {
              hasViolations: true,
              violations: [
                {
                  severity: 'medium',
                  referencedMod: 'modA',
                  referencedComponent: 'componentA',
                  file: 'a.json',
                  line: 12,
                  suggestedFix: 'Declare modA dependency',
                },
              ],
              missingDependencies: ['modA'],
            },
          },
        ],
        [
          'legacy_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modB',
                referencedComponent: 'componentB',
                file: 'multiple',
                suggestedFix: 'Add modB dependency',
              },
            ],
          },
        ],
      ])
    );

    expect(report).toContain('cross_mod');
    expect(report).toContain('legacy_mod');
    expect(report).toContain('Declare modA dependency');
    expect(report).toContain('Add modB dependency');
  });

  it('sorts nested ecosystem results when cross-reference entries lead the violation counts', () => {
    const report = reporter._generateEcosystemConsoleReport(
      new Map([
        [
          'legacy_small',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modC',
                referencedComponent: 'componentC',
              },
            ],
          },
        ],
        [
          'nested_dominant',
          {
            hasViolations: false,
            crossReferences: {
              hasViolations: true,
              violations: [
                {
                  referencedMod: 'modA',
                  referencedComponent: 'componentA',
                  file: 'nested.json',
                  line: 4,
                },
                {
                  referencedMod: 'modA',
                  referencedComponent: 'componentB',
                },
              ],
              missingDependencies: ['modA'],
            },
          },
        ],
        [
          'legacy_large',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modD',
                referencedComponent: 'componentD1',
                file: 'legacy.json',
                line: 11,
                suggestedFix: 'Add modD dependency',
              },
              {
                referencedMod: 'modD',
                referencedComponent: 'componentD2',
                file: 'multiple',
              },
              {
                referencedMod: 'modD',
                referencedComponent: 'componentD3',
              },
            ],
          },
        ],
      ])
    );

    expect(report).toContain('nested_dominant');
    expect(report).toContain('legacy_large');
    expect(report).toContain('legacy_small');
    expect(report).not.toContain('componentD2 (');
  });

  it('suppresses ecosystem suggestions when disabled', () => {
    const report = reporter._generateEcosystemConsoleReport(
      new Map([
        [
          'no_hint_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modC',
                referencedComponent: 'componentC',
                suggestedFix: 'Add modC dependency',
              },
            ],
            missingDependencies: ['modC'],
          },
        ],
      ]),
      { showSuggestions: false }
    );

    expect(report).not.toContain('💡');
  });

  it('falls back to suggestion text when cross-reference fixes omit priority metadata', () => {
    const stubViolations = [
      {
        referencedMod: 'stub_mod',
        referencedComponent: 'componentA',
        file: null,
        suggestedFix: 'Add stub_mod dependency',
      },
    ];

    const groupSpy = jest
      .spyOn(reporter, '_groupByMod')
      .mockReturnValue(new Map([[stubViolations[0].referencedMod, stubViolations]]));

    const report = reporter._generateEcosystemConsoleReport(
      new Map([
        [
          'stub',
          {
            hasViolations: true,
            violations: stubViolations,
          },
        ],
      ])
    );

    expect(report).toContain('Add stub_mod dependency');
    expect(report).toContain('componentA');

    groupSpy.mockRestore();
  });

  it('skips ecosystem metadata when no primary fix is available', () => {
    const report = reporter._generateEcosystemConsoleReport(
      new Map([
        [
          'partial_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'partial_dep',
                referencedComponent: 'componentA',
                file: 'multiple',
                suggestedFixes: [
                  { priority: 'secondary', description: 'Secondary plan' },
                ],
              },
              {
                referencedMod: 'partial_dep',
                referencedComponent: 'componentB',
                file: 'context-only.json',
              },
            ],
          },
        ],
      ])
    );

    expect(report).toContain('componentA');
    expect(report).not.toContain('componentA (');
    expect(report).toContain('componentB (context-only.json');
    expect(report).not.toContain('Secondary plan');
    expect(report).not.toContain('💡');
  });

  it('exposes minimal JSON, HTML, and Markdown outputs with default options', () => {
    const json = reporter._generateJsonReport(new Map([['mod', { hasViolations: false }]]));
    const html = reporter._generateHtmlReport({ modId: 'html_mod', hasViolations: false });
    const markdown = reporter._generateMarkdownReport({ modId: 'md_mod', hasViolations: false });

    expect(() => JSON.parse(json)).not.toThrow();
    expect(html).toContain('<!DOCTYPE html>');
    expect(markdown).toContain('# Cross-Reference Validation Report');
  });

  it('handles unknown severities and ignores totals for unrecognized levels', () => {
    expect(reporter._getSeverityIcon('mystery')).toBe('❓');

    const totals = reporter._calculateEcosystemSeverityTotals([
      [
        'unknown_mod',
        {
          violations: [
            { severity: 'unknown' },
          ],
        },
      ],
    ]);

    expect(totals).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('renders ecosystem HTML content with and without optional metadata', () => {
    const html = reporter._generateEcosystemHtmlContent(
      new Map([
        [
          'plain_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modA',
                referencedComponent: 'componentA',
              },
            ],
          },
        ],
        [
          'detailed_mod',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'high',
                referencedMod: 'modB',
                referencedComponent: 'componentB',
                file: 'b.json',
                line: 27,
                contextSnippet: 'context',
                suggestedFix: 'Add modB dependency',
              },
            {
              referencedMod: 'modB',
              referencedComponent: 'componentC',
              file: 'no-line.html',
            },
            ],
          },
        ],
      ])
    );

    expect(html).toContain('<div class="violation ">');
    expect(html).toContain('class="violation severity-high"');
    expect(html).toContain('📁 b.json:27');
    expect(html).toContain('<code>context</code>');
    expect(html).toContain('Add dependency to manifest');
  });

  it('renders single-mod HTML content with default fallbacks', () => {
    const html = reporter._generateSingleModHtmlContent({
      modId: 'single_mod',
      hasViolations: true,
      violations: [
        {
          referencedMod: 'modA',
          referencedComponent: 'componentA',
        },
        {
          severity: 'low',
          referencedMod: 'modB',
          referencedComponent: 'componentB',
          file: 'c.json',
          line: 5,
          contextSnippet: 'detail',
          suggestedFix: 'Add modB dependency',
        },
        {
          referencedMod: 'modC',
          referencedComponent: 'componentC',
          file: 'no-line.json',
        },
      ],
    });

    expect(html).toContain('<div class="violation ">');
    expect(html).toContain('class="violation severity-low"');
    expect(html).toContain('📁 c.json:5');
    expect(html).toContain('<code>detail</code>');
    expect(html).toContain('Add dependency to manifest');
  });

  it('falls back to legacy console formatting for mixed violation metadata', () => {
    const severitySpy = jest
      .spyOn(reporter, '_groupBySeverity')
      .mockReturnValue(new Map());

    const output = reporter.generateReport(
      {
        modId: 'fallback_mod',
        hasViolations: true,
        violations: [
          {
            referencedMod: 'modWithLine',
            referencedComponent: 'component1',
            file: 'with-line.json',
            line: 15,
          },
          {
            referencedMod: 'modNoLine',
            referencedComponent: 'component2',
            file: 'no-line.json',
          },
          {
            referencedMod: 'modMultiple',
            referencedComponent: 'component3',
            file: 'multiple',
          },
        ],
        declaredDependencies: [],
        referencedMods: [],
        missingDependencies: ['modWithLine', 'modNoLine', 'modMultiple'],
      },
      'console'
    );

    expect(output).toContain('with-line.json:15');
    expect(output).toContain('no-line.json');
    expect(output).not.toContain('multiple)');

    severitySpy.mockRestore();
  });

  it('renders ecosystem Markdown content with optional fields', () => {
    const markdown = reporter._generateEcosystemMarkdownContent(
      new Map([
        [
          'plain_mod',
          {
            hasViolations: true,
            violations: [
              {
                referencedMod: 'modA',
                referencedComponent: 'componentA',
              },
            ],
          },
        ],
        [
          'detailed_mod',
          {
            hasViolations: true,
            violations: [
              {
                severity: 'critical',
                referencedMod: 'modB',
                referencedComponent: 'componentB',
                file: 'd.json',
                line: 9,
                contextSnippet: 'snippet',
                suggestedFix: 'Add modB dependency',
              },
              {
                referencedMod: 'modB',
                referencedComponent: 'componentC',
                file: 'no-line.md',
              },
            ],
          },
        ],
      ])
    );

    expect(markdown).toContain('**modA:componentA**');
    expect(markdown).toContain('📁 `d.json:9`');
    expect(markdown).toContain('📝 `snippet`');
    expect(markdown).toContain('💡 Add dependency to manifest');
  });

  it('renders single-mod Markdown content with default messaging', () => {
    const markdown = reporter._generateSingleModMarkdownContent({
      modId: 'markdown_mod',
      hasViolations: true,
      violations: [
        {
          referencedMod: 'modA',
          referencedComponent: 'componentA',
        },
        {
          severity: 'medium',
          referencedMod: 'modB',
          referencedComponent: 'componentB',
          file: 'e.json',
          line: 3,
          contextSnippet: 'info',
          suggestedFix: 'Add modB dependency',
        },
        {
          referencedMod: 'modC',
          referencedComponent: 'componentC',
          file: 'no-line.md',
        },
      ],
    });

    expect(markdown).toContain('## Mod: markdown_mod');
    expect(markdown).toContain('💡 Add dependency to manifest');
    expect(markdown).toContain('⚡ Severity: medium');
    expect(markdown).toContain('📁 `e.json:3`');
  });

  it('generates file existence summaries without explicit options', () => {
    const report = reporter._generateFileExistenceReport(
      new Map([
        [
          'mod_ok',
          {
            modId: 'mod_ok',
            isValid: true,
            missingFiles: [],
            namingIssues: [],
          },
        ],
        [
          'mod_bad',
          {
            modId: 'mod_bad',
            isValid: false,
            missingFiles: [
              { category: 'stories', file: 'missing.story.json' },
            ],
            namingIssues: [
              {
                category: 'rules',
                manifestRef: 'bad_rule',
                actualFile: 'bad-rule',
              },
            ],
          },
        ],
      ])
    );

    expect(report).toContain('❌ Found 2 issues in 1 mod(s):');
    expect(report).toContain('stories/missing.story.json');
    expect(report).toContain('Manifest: rules/bad_rule');
    expect(report).toContain('Actual:   rules/bad-rule');
  });
});
