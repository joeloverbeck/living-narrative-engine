import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ModCrossReferenceValidator from '../../../cli/validation/modCrossReferenceValidator.js';
import ViolationReporter from '../../../src/validation/violationReporter.js';
import { createTestBed } from '../../common/testBed.js';

const MOD_PATH = '/test/mods/positioning';

/**
 * @returns {Map<string, Set<string>>}
 */
const createBaseReferenceMap = () =>
  new Map([
    ['affection', new Set(['romantic_interest', 'support_rule'])],
    ['kissing', new Set(['kiss_component'])],
    ['decor', new Set(['ambient_chair'])],
    ['ambient', new Set(['mood_component'])],
    ['mystery', new Set(['unknown_component'])],
  ]);

/**
 * @returns {Map<string, Array<object>>}
 */
const createContextualReferenceMap = () =>
  new Map([
    [
      'affection',
      [
        {
          componentId: 'romantic_interest',
          contexts: [
            {
              file: `${MOD_PATH}/actions/kiss.action.json`,
              line: 5,
              column: 15,
              snippet: '"affection:romantic_interest"',
              type: 'action',
              isBlocking: false,
              isOptional: false,
              isUserFacing: true,
            },
          ],
        },
        {
          componentId: 'support_rule',
          contexts: [
            {
              file: `${MOD_PATH}/rules/support.rule.json`,
              line: 8,
              column: 3,
              snippet: 'support_rule',
              type: 'rule',
              isBlocking: true,
              isOptional: false,
              isUserFacing: false,
            },
          ],
        },
      ],
    ],
    [
      'kissing',
      [
        {
          componentId: 'kiss_component',
          contexts: [
            {
              file: `${MOD_PATH}/actions/kiss.action.json`,
              line: 7,
              column: 12,
              snippet: '"kissing:kiss_component"',
              type: 'action',
              isBlocking: false,
              isOptional: true,
              isUserFacing: true,
            },
          ],
        },
      ],
    ],
    [
      'decor',
      [
        {
          componentId: 'ambient_chair',
          contexts: [
            {
              file: `${MOD_PATH}/scopes/chairs.scope`,
              line: 2,
              column: 4,
              snippet: 'decor:ambient_chair',
              type: 'scope',
              isBlocking: false,
              isOptional: false,
              isUserFacing: false,
            },
          ],
        },
      ],
    ],
    [
      'ambient',
      [
        {
          componentId: 'mood_component',
          contexts: [
            {
              file: `${MOD_PATH}/components/mood.json`,
              line: 4,
              column: 8,
              snippet: '"ambient:mood_component"',
              type: 'component',
              isBlocking: false,
              isOptional: false,
              isUserFacing: false,
            },
          ],
        },
      ],
    ],
    [
      'mystery',
      [
        {
          componentId: 'unknown_component',
          contexts: [],
        },
      ],
    ],
  ]);

describe('ViolationReporter multi-format integration', () => {
  let testBed;
  let mockLogger;
  let extractor;
  let validator;
  let reporter;
  let manifestsMap;
  let baseEnhancedReport;

  const cloneReport = () => JSON.parse(JSON.stringify(baseEnhancedReport));

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    extractor = {
      extractReferences: jest.fn(),
      extractReferencesWithFileContext: jest.fn(),
    };
    extractor.extractReferences.mockResolvedValue(createBaseReferenceMap());
    extractor.extractReferencesWithFileContext.mockResolvedValue(
      createContextualReferenceMap()
    );

    validator = new ModCrossReferenceValidator({
      logger: mockLogger,
      modDependencyValidator: { validate: jest.fn() },
      referenceExtractor: extractor,
    });

    reporter = new ViolationReporter({ logger: mockLogger });

    manifestsMap = new Map([
      [
        'positioning',
        {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [{ id: 'core' }],
        },
      ],
      ['core', { id: 'core', version: '1.0.0' }],
      ['affection', { id: 'affection', version: '1.2.0' }],
      ['kissing', { id: 'kissing', version: '2.0.0' }],
      ['decor', { id: 'decor', version: '0.5.0' }],
      ['ambient', { id: 'ambient', version: '0.3.0' }],
      ['mystery', { id: 'mystery', version: '0.1.0' }],
    ]);

    baseEnhancedReport = await validator.validateModReferencesEnhanced(
      MOD_PATH,
      manifestsMap,
      { includeContext: true }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    testBed.cleanup?.();
  });

  it('generates rich single-mod reports across formats', () => {
    const report = cloneReport();

    const consoleReport = reporter.generateReport(report, 'console', {
      verbose: true,
    });

    expect(consoleReport).toContain(
      "Cross-Reference Validation Report for 'positioning'"
    );
    expect(consoleReport).toContain('❌');
    expect(consoleReport).toContain('🚨 CRITICAL');
    expect(consoleReport).toContain('⚠️ HIGH');
    expect(consoleReport).toContain('⚡ MEDIUM');
    expect(consoleReport).toContain('📝 LOW');
    expect(consoleReport).toContain('loading=high');
    expect(consoleReport).toContain('runtime=high');
    expect(consoleReport).toContain('Referenced Mods:');

    const jsonReport = JSON.parse(
      reporter.generateReport(report, 'json', { pretty: true })
    );
    expect(jsonReport.type).toBe('single-mod');
    expect(jsonReport.mod.modId).toBe('positioning');
    expect(jsonReport.mod.summary.violationCount).toBe(report.violations.length);

    const htmlReport = reporter.generateReport(report, 'html', {
      title: 'Single Mod Report',
    });
    expect(htmlReport).toContain('<h2>Mod: positioning</h2>');
    expect(htmlReport).toContain('class="violation severity-critical"');
    expect(htmlReport).toContain('<code>"affection:romantic_interest"</code>');

    const markdownReport = reporter.generateReport(report, 'markdown', {
      title: 'Single Mod Report',
    });
    expect(markdownReport).toContain('## Mod: positioning');
    expect(markdownReport).toContain('🚨 Severity: critical');
    expect(markdownReport).toContain('💡 Add "affection" to dependencies');
  });

  it('supports toggling suggestions and disabling coloring in console reports', () => {
    const report = cloneReport();

    const minimalReport = reporter.generateReport(report, 'console', {
      colors: false,
      showSuggestions: false,
    });

    expect(minimalReport).toContain('Cross-Reference Validation Report');
    expect(minimalReport).not.toContain('💡');
    expect(minimalReport).toContain('affection:support_rule');
  });

  it('produces ecosystem-level summaries across formats', () => {
    const detailedReport = cloneReport();

    const noSeverityReport = cloneReport();
    noSeverityReport.violations = noSeverityReport.violations.map(
      ({ severity, suggestedFixes, ...rest }) => ({
        ...rest,
        severity: undefined,
        suggestedFixes: undefined,
      })
    );

    const nestedViolations = detailedReport.violations
      .slice(0, 1)
      .map((violation) => ({
        ...violation,
        severity: 'medium',
        suggestedFix: 'Add dependency to manifest',
      }));

    const nestedCrossRef = {
      hasViolations: true,
      violations: nestedViolations,
      missingDependencies: ['affection'],
      crossReferences: {
        hasViolations: true,
        violations: nestedViolations,
        missingDependencies: ['affection'],
      },
    };

    const ecosystem = new Map([
      [detailedReport.modId, detailedReport],
      ['secondary-mod', noSeverityReport],
      ['aggregated', nestedCrossRef],
    ]);

    const consoleSummary = reporter.generateReport(ecosystem, 'console', {
      colors: true,
    });
    expect(consoleSummary).toContain(
      'Living Narrative Engine - Cross-Reference Validation Report'
    );
    expect(consoleSummary).toContain('Violation Summary by Severity');
    expect(consoleSummary).toContain('📋 Next Steps');

    const jsonSummary = JSON.parse(
      reporter.generateReport(ecosystem, 'json', { pretty: true })
    );
    expect(jsonSummary.type).toBe('ecosystem');
    expect(jsonSummary.summary.totalMods).toBe(ecosystem.size);
    expect(jsonSummary.summary.totalViolations).toBeGreaterThan(0);

    const htmlSummary = reporter.generateReport(ecosystem, 'html', {
      title: 'Ecosystem Report',
    });
    expect(htmlSummary).toContain('<h3>📦 positioning</h3>');
    expect(htmlSummary).toContain('class="violation severity-critical"');

    const markdownSummary = reporter.generateReport(ecosystem, 'markdown', {
      title: 'Ecosystem Report',
    });
    expect(markdownSummary).toContain('## ❌');
    expect(markdownSummary).toContain('### 📦 positioning');
  });

  it('handles clean ecosystems and unsupported formats', () => {
    const cleanMap = new Map([
      [
        'core',
        {
          modId: 'core',
          hasViolations: false,
          violations: [],
          declaredDependencies: ['core'],
          referencedMods: [],
          summary: { totalReferences: 0 },
        },
      ],
      [
        'affection',
        {
          modId: 'affection',
          hasViolations: false,
          violations: [],
          declaredDependencies: ['core'],
          referencedMods: [],
          summary: { totalReferences: 0 },
        },
      ],
    ]);

    const consoleClean = reporter.generateReport(cleanMap, 'console');
    expect(consoleClean).toContain('✅ No cross-reference violations detected in ecosystem');

    const htmlClean = reporter.generateReport(cleanMap, 'html', {
      title: 'Clean Report',
    });
    expect(htmlClean).toContain('✅ No violations detected');

    const markdownClean = reporter.generateReport(cleanMap, 'markdown', {
      title: 'Clean Report',
    });
    expect(markdownClean).toContain('## ✅ No violations detected');

    const jsonClean = JSON.parse(reporter.generateReport(cleanMap, 'json'));
    expect(jsonClean.summary.validationPassed).toBe(true);

    expect(() => reporter.generateReport(cloneReport(), 'xml')).toThrow(
      'Unsupported report format: xml'
    );
  });
});
