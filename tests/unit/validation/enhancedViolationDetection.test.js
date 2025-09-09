import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModCrossReferenceValidator from '../../../src/validation/modCrossReferenceValidator.js';

describe('ModCrossReferenceValidator - Enhanced Violation Detection', () => {
  let testBed;
  let validator;
  let mockLogger;
  let mockModDependencyValidator;
  let mockReferenceExtractor;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;
    
    // Create enhanced mock reference extractor with context capabilities
    mockReferenceExtractor = {
      extractReferences: jest.fn(),
      extractReferencesWithFileContext: jest.fn(),
    };
    
    mockModDependencyValidator = {
      validate: jest.fn(),
    };
    
    validator = new ModCrossReferenceValidator({
      logger: mockLogger,
      modDependencyValidator: mockModDependencyValidator,
      referenceExtractor: mockReferenceExtractor
    });
  });

  afterEach(() => {
    testBed.cleanup?.();
  });

  describe('Enhanced Violation Creation', () => {
    it('should create enhanced violations with file context', () => {
      const contexts = [{
        file: '/test/positioning/actions/test.action.json',
        line: 15,
        column: 8,
        snippet: '"required_components": ["intimacy:kissing"]',
        type: 'action',
        isBlocking: false,
        isOptional: false,
        isUserFacing: true
      }];
      
      const manifestsMap = new Map([
        ['intimacy', { version: '1.0.0' }]
      ]);

      // Access protected method for testing
      const violations = validator['_createEnhancedViolations'](
        'positioning', '/test/positioning', 'intimacy', 'kissing', 
        contexts, ['core'], manifestsMap
      );
      
      expect(violations).toHaveLength(1);
      const violation = violations[0];
      
      expect(violation).toMatchObject({
        violatingMod: 'positioning',
        referencedMod: 'intimacy',
        referencedComponent: 'kissing',
        file: 'actions/test.action.json',
        line: 15,
        column: 8,
        contextSnippet: '"required_components": ["intimacy:kissing"]',
        contextType: 'action',
        severity: 'high', // action context
        impact: expect.any(Object),
        suggestedFixes: expect.any(Array),
        metadata: expect.objectContaining({
          extractionTimestamp: expect.any(String),
          validatorVersion: expect.any(String),
          ruleApplied: 'cross-reference-dependency-check'
        })
      });
    });

    it('should create multiple violations for multiple contexts', () => {
      const contexts = [
        {
          file: '/test/positioning/actions/kiss.action.json',
          line: 5,
          column: 10,
          snippet: '"required_components": ["intimacy:kissing"]',
          type: 'action',
          isBlocking: false,
          isOptional: false,
          isUserFacing: true
        },
        {
          file: '/test/positioning/rules/romance.rule.json',
          line: 12,
          column: 15,
          snippet: '"condition_ref": "intimacy:romantic_mood"',
          type: 'rule',
          isBlocking: true,
          isOptional: false,
          isUserFacing: false
        }
      ];
      
      const manifestsMap = new Map([
        ['intimacy', { version: '1.0.0' }]
      ]);

      const violations = validator['_createEnhancedViolations'](
        'positioning', '/test/positioning', 'intimacy', 'kissing', 
        contexts, ['core'], manifestsMap
      );
      
      expect(violations).toHaveLength(2);
      
      const actionViolation = violations[0];
      expect(actionViolation.contextType).toBe('action');
      expect(actionViolation.severity).toBe('high');
      expect(actionViolation.file).toBe('actions/kiss.action.json');
      
      const ruleViolation = violations[1];
      expect(ruleViolation.contextType).toBe('rule');
      expect(ruleViolation.severity).toBe('critical');
      expect(ruleViolation.file).toBe('rules/romance.rule.json');
    });

    it('should fallback to basic violation when no contexts provided', () => {
      const contexts = [];
      const manifestsMap = new Map([
        ['intimacy', { version: '1.0.0' }]
      ]);

      const violations = validator['_createEnhancedViolations'](
        'positioning', '/test/positioning', 'intimacy', 'kissing', 
        contexts, ['core'], manifestsMap
      );
      
      expect(violations).toHaveLength(1);
      const violation = violations[0];
      
      expect(violation).toMatchObject({
        file: 'multiple', // fallback value
        line: null,
        severity: 'low', // default for unknown context
        suggestedFixes: expect.any(Array),
        metadata: expect.any(Object)
      });
    });
  });

  describe('Severity Calculation', () => {
    const testCases = [
      {
        context: { type: 'rule', isBlocking: true },
        expectedSeverity: 'critical',
        description: 'rule context should be critical'
      },
      {
        context: { type: 'action', isBlocking: false },
        expectedSeverity: 'high',
        description: 'action context should be high'
      },
      {
        context: { type: 'component', isBlocking: false },
        expectedSeverity: 'medium',
        description: 'component context should be medium'
      },
      {
        context: { type: 'scope', isBlocking: false },
        expectedSeverity: 'medium',
        description: 'scope context should be medium'
      },
      {
        context: { type: 'unknown', isBlocking: false },
        expectedSeverity: 'low',
        description: 'unknown context should be low'
      },
      {
        context: { type: 'event', isBlocking: true },
        expectedSeverity: 'critical',
        description: 'blocking context should override type to critical'
      }
    ];

    testCases.forEach(({ context, expectedSeverity, description }) => {
      it(description, () => {
        const severity = validator['_calculateSeverity'](context, 'test_mod');
        expect(severity).toBe(expectedSeverity);
      });
    });
  });

  describe('Impact Analysis', () => {
    it('should analyze impact for rule context', () => {
      const context = { type: 'rule', isUserFacing: false };
      const impact = validator['_analyzeImpact'](context, 'test_mod', 'test_component');
      
      expect(impact).toEqual({
        loadingFailure: 'high',
        runtimeFailure: 'medium',
        dataInconsistency: 'low',
        userExperience: 'low'
      });
    });

    it('should analyze impact for action context', () => {
      const context = { type: 'action', isUserFacing: true };
      const impact = validator['_analyzeImpact'](context, 'test_mod', 'test_component');
      
      expect(impact).toEqual({
        loadingFailure: 'low',
        runtimeFailure: 'high',
        dataInconsistency: 'low',
        userExperience: 'high'
      });
    });

    it('should analyze impact for component context', () => {
      const context = { type: 'component', isUserFacing: false };
      const impact = validator['_analyzeImpact'](context, 'test_mod', 'test_component');
      
      expect(impact).toEqual({
        loadingFailure: 'low',
        runtimeFailure: 'medium',
        dataInconsistency: 'high',
        userExperience: 'low'
      });
    });
  });

  describe('Fix Suggestion Generation', () => {
    it('should generate primary add dependency fix', () => {
      const context = { isOptional: false };
      const manifestsMap = new Map([
        ['intimacy', { version: '1.2.3' }]
      ]);

      const fixes = validator['_generateFixSuggestions'](
        'positioning', 'intimacy', 'test_component', context, manifestsMap
      );
      
      expect(fixes).toHaveLength(1);
      const primaryFix = fixes[0];
      
      expect(primaryFix).toMatchObject({
        type: 'add_dependency',
        priority: 'primary',
        description: 'Add "intimacy" to dependencies in mod-manifest.json',
        implementation: {
          file: 'mod-manifest.json',
          action: 'add_to_dependencies_array',
          value: {
            id: 'intimacy',
            version: '1.2.3'
          }
        },
        effort: 'low',
        risk: 'low'
      });
    });

    it('should generate alternative remove reference fix for optional contexts', () => {
      const context = { 
        isOptional: true, 
        file: 'actions/test.action.json', 
        line: 15 
      };
      const manifestsMap = new Map([
        ['intimacy', { version: '1.0.0' }]
      ]);

      const fixes = validator['_generateFixSuggestions'](
        'positioning', 'intimacy', 'test_component', context, manifestsMap
      );
      
      expect(fixes).toHaveLength(2);
      
      const alternativeFix = fixes.find(f => f.priority === 'alternative');
      expect(alternativeFix).toMatchObject({
        type: 'remove_reference',
        priority: 'alternative',
        description: 'Remove reference to intimacy:test_component',
        implementation: {
          file: 'actions/test.action.json',
          line: 15,
          action: 'remove_line_or_replace'
        },
        effort: 'medium',
        risk: 'medium'
      });
    });

    it('should handle missing manifest for referenced mod', () => {
      const context = { isOptional: false };
      const manifestsMap = new Map(); // Empty - no manifest for referenced mod

      const fixes = validator['_generateFixSuggestions'](
        'positioning', 'missing_mod', 'test_component', context, manifestsMap
      );
      
      expect(fixes).toHaveLength(0); // No fixes if manifest not found
    });
  });

  describe('Enhanced Validation Flow', () => {
    it('should use enhanced validation when context extraction is available', async () => {
      const manifestsMap = new Map([
        ['mod', { id: 'mod', dependencies: [{ id: 'core' }] }],
        ['intimacy', { id: 'intimacy', version: '1.0.0' }]
      ]);

      const contextualReferences = new Map([
        ['intimacy', [{
          componentId: 'kissing',
          contexts: [{
            file: '/test/mod/actions/kiss.action.json',
            line: 10,
            column: 5,
            snippet: '"required_components": ["intimacy:kissing"]',
            type: 'action',
            isBlocking: false,
            isOptional: false,
            isUserFacing: true
          }]
        }]]
      ]);

      mockReferenceExtractor.extractReferencesWithFileContext.mockResolvedValue(contextualReferences);

      const result = await validator.validateModReferencesEnhanced('/test/mod', manifestsMap);

      expect(result).toMatchObject({
        modId: 'mod',
        hasViolations: true,
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: 'high',
            contextType: 'action',
            file: 'actions/kiss.action.json',
            line: 10,
            suggestedFixes: expect.any(Array)
          })
        ])
      });
    });

    it('should fallback to basic validation when enhanced extraction is disabled', async () => {
      const manifestsMap = new Map([
        ['mod', { id: 'mod', dependencies: [{ id: 'core' }] }],
        ['intimacy', { id: 'intimacy', version: '1.0.0' }]
      ]);

      const basicReferences = new Map([
        ['intimacy', new Set(['kissing'])]
      ]);

      mockReferenceExtractor.extractReferences.mockResolvedValue(basicReferences);

      const result = await validator.validateModReferencesEnhanced(
        '/test/mod', 
        manifestsMap, 
        { includeContext: false }
      );

      expect(result).toMatchObject({
        modId: 'mod',
        hasViolations: true,
        violations: expect.arrayContaining([
          expect.objectContaining({
            file: 'multiple', // fallback value for basic validation
            line: null,
            severity: 'low', // enhanced with basic analysis
            suggestedFixes: expect.any(Array)
          })
        ])
      });
      
      expect(mockReferenceExtractor.extractReferences).toHaveBeenCalled();
      expect(mockReferenceExtractor.extractReferencesWithFileContext).not.toHaveBeenCalled();
    });

    it('should handle extraction method not available', async () => {
      // Create validator with extractor that doesn't have enhanced method
      const basicExtractor = {
        extractReferences: jest.fn()
      };

      const basicValidator = new ModCrossReferenceValidator({
        logger: mockLogger,
        modDependencyValidator: mockModDependencyValidator,
        referenceExtractor: basicExtractor
      });

      const manifestsMap = new Map([
        ['mod', { id: 'mod', dependencies: [{ id: 'core' }] }]
      ]);

      const basicReferences = new Map();
      basicExtractor.extractReferences.mockResolvedValue(basicReferences);

      const result = await basicValidator.validateModReferencesEnhanced('/test/mod', manifestsMap);

      expect(result.hasViolations).toBe(false);
      expect(basicExtractor.extractReferences).toHaveBeenCalled();
    });
  });
});