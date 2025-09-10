import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import path from 'path';
import ModCrossReferenceValidator from '../../../src/validation/modCrossReferenceValidator.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';
import ViolationReporter from '../../../src/validation/violationReporter.js';
import { createTestBed } from '../../common/testBed.js';

// Mock fs/promises module that production code actually imports
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

// Import the mocked fs/promises
import * as fs from 'fs/promises';

describe('Enhanced Cross-Reference Validation Integration', () => {
  let testBed;
  let validator;
  let extractor;
  let reporter;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    const mockAjvValidator = { validate: jest.fn() };
    const mockModDependencyValidator = { validate: jest.fn() };

    // Create a mock extractor that returns enhanced results for the first test
    extractor = {
      extractReferences: jest.fn(),
      extractReferencesWithFileContext: jest.fn(),
    };

    validator = new ModCrossReferenceValidator({
      logger: mockLogger,
      modDependencyValidator: mockModDependencyValidator,
      referenceExtractor: extractor,
    });

    reporter = new ViolationReporter({ logger: mockLogger });

    // Reset mocks
    fs.readFile.mockClear();
    fs.readdir.mockClear();
    extractor.extractReferences.mockClear();
    extractor.extractReferencesWithFileContext.mockClear();
  });

  afterEach(() => {
    testBed.cleanup?.();
    jest.clearAllMocks();
  });

  it('should perform end-to-end enhanced validation with detailed reporting', async () => {
    // Setup test scenario: mod that references missing dependency
    const manifestsMap = new Map([
      [
        'positioning',
        {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [{ id: 'core' }], // Missing 'intimacy' dependency
        },
      ],
      [
        'intimacy',
        {
          id: 'intimacy',
          version: '1.2.0',
        },
      ],
    ]);

    // Mock enhanced extraction to return contextual references
    const mockContextualReferences = new Map([
      [
        'intimacy',
        [
          {
            componentId: 'kissing',
            contexts: [
              {
                file: '/test/mods/positioning/actions/kiss.action.json',
                line: 5,
                column: 15,
                snippet: '"intimacy:kissing"',
                type: 'action',
                isBlocking: false,
                isOptional: false,
                isUserFacing: true,
              },
            ],
          },
          {
            componentId: 'romantic_interest',
            contexts: [
              {
                file: '/test/mods/positioning/actions/kiss.action.json',
                line: 5,
                column: 32,
                snippet: '"intimacy:romantic_interest"',
                type: 'action',
                isBlocking: false,
                isOptional: false,
                isUserFacing: true,
              },
            ],
          },
        ],
      ],
    ]);

    extractor.extractReferencesWithFileContext.mockResolvedValue(
      mockContextualReferences
    );

    // Perform enhanced validation
    const validationResult = await validator.validateModReferencesEnhanced(
      '/test/mods/positioning',
      manifestsMap,
      { includeContext: true }
    );

    // Verify validation results
    expect(validationResult).toMatchObject({
      modId: 'positioning',
      hasViolations: true,
      violations: expect.any(Array),
      missingDependencies: ['intimacy'],
    });

    // Verify enhanced violation data
    expect(validationResult.violations.length).toBeGreaterThan(0);

    const firstViolation = validationResult.violations[0];
    expect(firstViolation).toMatchObject({
      violatingMod: 'positioning',
      referencedMod: 'intimacy',
      file: expect.stringMatching(/actions\/(kiss|hug)\.action\.json/),
      line: expect.any(Number),
      column: expect.any(Number),
      contextSnippet: expect.stringContaining('intimacy:'),
      contextType: 'action',
      severity: 'high', // Actions are high severity
      impact: expect.objectContaining({
        runtimeFailure: 'high',
        userExperience: 'high',
      }),
      suggestedFixes: expect.arrayContaining([
        expect.objectContaining({
          type: 'add_dependency',
          priority: 'primary',
          description: 'Add "intimacy" to dependencies in mod-manifest.json',
          implementation: expect.objectContaining({
            file: 'mod-manifest.json',
            action: 'add_to_dependencies_array',
            value: {
              id: 'intimacy',
              version: '1.2.0',
            },
          }),
        }),
      ]),
      metadata: expect.objectContaining({
        extractionTimestamp: expect.any(String),
        validatorVersion: expect.any(String),
        ruleApplied: 'cross-reference-dependency-check',
      }),
    });

    // Test enhanced console reporting
    const consoleReport = reporter.generateReport(validationResult, 'console', {
      showSuggestions: true,
      verbose: true,
    });

    expect(consoleReport).toContain('HIGH (');
    expect(consoleReport).toContain('📁 actions/');
    expect(consoleReport).toContain('📝 "intimacy:');
    expect(consoleReport).toContain('💡 Add "intimacy" to dependencies');
    expect(consoleReport).toContain('📊 Impact: loading=');

    // Test JSON reporting
    const jsonReport = reporter.generateReport(validationResult, 'json', {
      pretty: true,
    });
    const jsonData = JSON.parse(jsonReport);

    expect(jsonData).toMatchObject({
      type: 'single-mod',
      timestamp: expect.any(String),
      mod: expect.objectContaining({
        modId: 'positioning',
        hasViolations: true,
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: expect.any(String),
            contextType: 'action',
            suggestedFixes: expect.any(Array),
          }),
        ]),
      }),
    });

    // Test HTML reporting
    const htmlReport = reporter.generateReport(validationResult, 'html');

    expect(htmlReport).toContain('<!DOCTYPE html>');
    expect(htmlReport).toContain('class="violation severity-high"');
    expect(htmlReport).toContain('positioning');
    expect(htmlReport).toContain('intimacy:');
  });

  it('should handle ecosystem validation with mixed results', async () => {
    const manifestsMap = new Map([
      [
        'clean_mod',
        {
          id: 'clean_mod',
          dependencies: [{ id: 'core' }],
        },
      ],
      [
        'violating_mod',
        {
          id: 'violating_mod',
          dependencies: [{ id: 'core' }],
        },
      ],
      [
        'missing_dependency',
        {
          id: 'missing_dependency',
        },
      ],
    ]);

    // Mock the violating mod to return contextual references
    const violatingContextualReferences = new Map([
      [
        'missing_dependency',
        [
          {
            componentId: 'component',
            contexts: [
              {
                file: 'test.json',
                line: 1,
                column: 8,
                snippet: '"missing_dependency:component"',
                type: 'unknown',
                isBlocking: false,
                isOptional: false,
                isUserFacing: false,
              },
            ],
          },
        ],
      ],
    ]);

    // Set up mocks for both calls in the second test
    extractor.extractReferencesWithFileContext.mockResolvedValueOnce(
      violatingContextualReferences
    ); // For violating_mod call

    // Create ecosystem results map manually for this test
    const cleanResult = {
      modId: 'clean_mod',
      hasViolations: false,
      violations: [],
      declaredDependencies: ['core'],
      referencedMods: [],
      missingDependencies: [],
      summary: { totalReferences: 0, violationCount: 0 },
    };

    const violatingResult = await validator.validateModReferencesEnhanced(
      '/test/mods/violating_mod',
      manifestsMap,
      { includeContext: true }
    );

    const ecosystemResults = new Map([
      ['clean_mod', cleanResult],
      ['violating_mod', violatingResult],
    ]);

    // Test ecosystem console report
    const ecosystemReport = reporter.generateReport(
      ecosystemResults,
      'console'
    );

    expect(ecosystemReport).toContain(
      'Living Narrative Engine - Cross-Reference Validation Report'
    );
    expect(ecosystemReport).toContain('Found');
    expect(ecosystemReport).toContain('violations across');
    expect(ecosystemReport).toContain('mods');
    expect(ecosystemReport).toContain('📦 violating_mod:');
    expect(ecosystemReport).not.toContain('📦 clean_mod:'); // Clean mod shouldn't appear in violations

    // Test ecosystem JSON report
    const ecosystemJsonReport = reporter.generateReport(
      ecosystemResults,
      'json'
    );
    const ecosystemJsonData = JSON.parse(ecosystemJsonReport);

    expect(ecosystemJsonData).toMatchObject({
      type: 'ecosystem',
      mods: expect.objectContaining({
        clean_mod: expect.objectContaining({ hasViolations: false }),
        violating_mod: expect.objectContaining({ hasViolations: true }),
      }),
      summary: expect.objectContaining({
        totalMods: 2,
        modsWithViolations: 1,
        validationPassed: false,
      }),
    });
  });

  it('should gracefully fallback when enhanced features are not available', async () => {
    // Create mock extractor that simulates missing enhanced method
    const basicExtractor = {
      extractReferences: jest.fn().mockResolvedValue(new Map()),
      // Note: extractReferencesWithFileContext is intentionally missing
    };

    const basicValidator = new ModCrossReferenceValidator({
      logger: mockLogger,
      modDependencyValidator: { validate: jest.fn() },
      referenceExtractor: basicExtractor,
    });

    const manifestsMap = new Map([
      ['mod', { id: 'mod', dependencies: [{ id: 'core' }] }],
    ]);

    const result = await basicValidator.validateModReferencesEnhanced(
      '/test/mod',
      manifestsMap,
      { includeContext: true }
    );

    expect(result).toMatchObject({
      modId: 'mod',
      hasViolations: false,
    });

    // Should use basic validation without errors
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Using basic validation')
    );
  });
});
