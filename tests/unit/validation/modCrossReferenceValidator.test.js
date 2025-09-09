import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModCrossReferenceValidator, { CrossReferenceViolationError } from '../../../src/validation/modCrossReferenceValidator.js';

describe('ModCrossReferenceValidator - Core Functionality', () => {
  let testBed;
  let validator;
  let mockLogger;
  let mockModDependencyValidator;
  let mockReferenceExtractor;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;
    
    // Create mock dependencies with required methods
    mockModDependencyValidator = {
      validate: jest.fn(),
    };
    
    mockReferenceExtractor = {
      extractReferences: jest.fn(),
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

  describe('Constructor Validation', () => {
    it('should validate all required dependencies', () => {
      expect(() => {
        new ModCrossReferenceValidator({
          logger: null,
          modDependencyValidator: mockModDependencyValidator,
          referenceExtractor: mockReferenceExtractor
        });
      }).toThrow();
    });

    it('should require modDependencyValidator with validate method', () => {
      expect(() => {
        new ModCrossReferenceValidator({
          logger: mockLogger,
          modDependencyValidator: {},
          referenceExtractor: mockReferenceExtractor
        });
      }).toThrow();
    });

    it('should require referenceExtractor with extractReferences method', () => {
      expect(() => {
        new ModCrossReferenceValidator({
          logger: mockLogger,
          modDependencyValidator: mockModDependencyValidator,
          referenceExtractor: {}
        });
      }).toThrow();
    });

    it('should successfully create validator with valid dependencies', () => {
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(ModCrossReferenceValidator);
    });
  });

  describe('Single Mod Validation', () => {
    it('should detect missing dependencies for external references', async () => {
      // Mock reference extraction - positioning mod references intimacy and violence
      const extractedRefs = new Map();
      extractedRefs.set('intimacy', new Set(['kissing', 'attraction']));
      extractedRefs.set('violence', new Set(['attacking']));
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      // Mock manifest with limited dependencies - only declares core
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      });
      manifestsMap.set('intimacy', { id: 'intimacy' });
      manifestsMap.set('violence', { id: 'violence' });
      
      const report = await validator.validateModReferences('/test/mods/positioning', manifestsMap);
      
      expect(report.hasViolations).toBe(true);
      expect(report.violations).toHaveLength(3); // 2 intimacy + 1 violence
      expect(report.missingDependencies).toEqual(expect.arrayContaining(['intimacy', 'violence']));
      expect(report.modId).toBe('positioning');
      expect(report.declaredDependencies).toEqual(expect.arrayContaining(['core']));
      
      // Verify violation details
      const intimacyViolations = report.violations.filter(v => v.referencedMod === 'intimacy');
      expect(intimacyViolations).toHaveLength(2);
      expect(intimacyViolations[0].suggestedFix).toContain('Add "intimacy" to dependencies');
    });

    it('should pass validation when all references are properly declared', async () => {
      // Mock reference extraction
      const extractedRefs = new Map();
      extractedRefs.set('core', new Set(['actor']));
      extractedRefs.set('anatomy', new Set(['body']));
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      // Mock manifest with all dependencies declared
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [
          { id: 'core', version: '^1.0.0' },
          { id: 'anatomy', version: '^1.0.0' }
        ]
      });
      manifestsMap.set('core', { id: 'core' });
      manifestsMap.set('anatomy', { id: 'anatomy' });
      
      const report = await validator.validateModReferences('/test/mods/positioning', manifestsMap);
      
      expect(report.hasViolations).toBe(false);
      expect(report.violations).toHaveLength(0);
      expect(report.missingDependencies).toEqual([]);
      expect(report.summary.violationCount).toBe(0);
    });

    it('should ignore self-references', async () => {
      // Mock reference extraction with self-reference
      const extractedRefs = new Map();
      extractedRefs.set('positioning', new Set(['stand', 'sit'])); // Self-reference
      extractedRefs.set('core', new Set(['actor']));
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      });
      manifestsMap.set('core', { id: 'core' });
      
      const report = await validator.validateModReferences('/test/mods/positioning', manifestsMap);
      
      expect(report.hasViolations).toBe(false);
      expect(report.violations).toHaveLength(0);
      // Self-references should not appear in referencedMods
      expect(report.referencedMods).toEqual(['core']);
    });

    it('should skip references to non-existent mods with warning', async () => {
      // Mock reference extraction with reference to non-existent mod
      const extractedRefs = new Map();
      extractedRefs.set('nonexistent', new Set(['component']));
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      });
      
      const report = await validator.validateModReferences('/test/mods/positioning', manifestsMap);
      
      expect(report.hasViolations).toBe(false);
      expect(report.violations).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Referenced mod 'nonexistent' not found in ecosystem")
      );
    });

    it('should handle manifest not found error', async () => {
      const manifestsMap = new Map();
      // No manifest for 'positioning'
      
      await expect(
        validator.validateModReferences('/test/mods/positioning', manifestsMap)
      ).rejects.toThrow('Manifest not found for mod: positioning');
    });

    it('should handle reference extraction errors', async () => {
      mockReferenceExtractor.extractReferences.mockRejectedValue(
        new Error('Failed to read mod directory')
      );
      
      const manifestsMap = new Map();
      manifestsMap.set('positioning', { id: 'positioning' });
      
      await expect(
        validator.validateModReferences('/test/mods/positioning', manifestsMap)
      ).rejects.toThrow('Failed to read mod directory');
    });
  });

  describe('Ecosystem-wide Validation', () => {
    it('should validate all mods in ecosystem', async () => {
      // Mock different reference patterns for different mods
      mockReferenceExtractor.extractReferences
        .mockResolvedValueOnce(new Map([['intimacy', new Set(['kissing'])]])) // positioning
        .mockResolvedValueOnce(new Map([['anatomy', new Set(['body'])]])) // intimacy
        .mockResolvedValueOnce(new Map()); // anatomy
      
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }] // Missing intimacy
      });
      manifestsMap.set('intimacy', {
        id: 'intimacy',
        dependencies: [{ id: 'anatomy', version: '^1.0.0' }] // Has anatomy
      });
      manifestsMap.set('anatomy', {
        id: 'anatomy',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      });
      
      const results = await validator.validateAllModReferences(manifestsMap);
      
      expect(results.size).toBe(3);
      expect(results.get('positioning').hasViolations).toBe(true);
      expect(results.get('intimacy').hasViolations).toBe(false);
      expect(results.get('anatomy').hasViolations).toBe(false);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Ecosystem validation complete: 1 total violations across 3 mods')
      );
    });

    it('should continue validation when individual mod fails', async () => {
      mockReferenceExtractor.extractReferences
        .mockRejectedValueOnce(new Error('Mod 1 failed'))
        .mockResolvedValueOnce(new Map());
      
      const manifestsMap = new Map();
      manifestsMap.set('mod1', { id: 'mod1' });
      manifestsMap.set('mod2', { id: 'mod2' });
      
      const results = await validator.validateAllModReferences(manifestsMap);
      
      expect(results.size).toBe(1); // Only mod2 succeeded
      expect(results.has('mod1')).toBe(false);
      expect(results.has('mod2')).toBe(true);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to validate mod mod1',
        expect.any(Error)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '1 mods failed validation',
        expect.objectContaining({ errors: expect.any(Array) })
      );
    });
  });

  describe('Report Generation', () => {
    it('should generate single mod report with violations', async () => {
      const report = {
        modId: 'positioning',
        hasViolations: true,
        violations: [
          {
            violatingMod: 'positioning',
            referencedMod: 'intimacy',
            referencedComponent: 'kissing',
            message: 'Mod positioning references intimacy:kissing but doesn\'t declare intimacy as a dependency',
            suggestedFix: 'Add "intimacy" to dependencies in mod-manifest.json'
          }
        ],
        declaredDependencies: ['core'],
        referencedMods: ['intimacy'],
        missingDependencies: ['intimacy'],
        summary: {
          totalReferences: 1,
          uniqueModsReferenced: 1,
          violationCount: 1,
          missingDependencyCount: 1
        }
      };
      
      const reportText = validator.generateReport(report);
      
      expect(reportText).toContain('Cross-Reference Validation Report for \'positioning\'');
      expect(reportText).toContain('❌ 1 cross-reference violations detected');
      expect(reportText).toContain('📦 Missing dependency: intimacy');
      expect(reportText).toContain('References component: kissing');
      expect(reportText).toContain('Add "intimacy" to dependencies');
    });

    it('should generate single mod report without violations', async () => {
      const report = {
        modId: 'positioning',
        hasViolations: false,
        violations: [],
        declaredDependencies: ['core', 'anatomy'],
        referencedMods: ['core', 'anatomy'],
        missingDependencies: [],
        summary: {
          totalReferences: 2,
          uniqueModsReferenced: 2,
          violationCount: 0,
          missingDependencyCount: 0
        }
      };
      
      const reportText = validator.generateReport(report);
      
      expect(reportText).toContain('✅ No cross-reference violations detected');
      expect(reportText).toContain('References to 2 mods');
      expect(reportText).toContain('2 total component references');
      expect(reportText).toContain('All references properly declared as dependencies');
    });

    it('should generate ecosystem report with violations', async () => {
      const results = new Map();
      results.set('positioning', {
        modId: 'positioning',
        hasViolations: true,
        violations: [{ referencedMod: 'intimacy', referencedComponent: 'kissing' }],
        missingDependencies: ['intimacy']
      });
      results.set('anatomy', {
        modId: 'anatomy',
        hasViolations: false,
        violations: [],
        missingDependencies: []
      });
      
      const reportText = validator.generateReport(results);
      
      expect(reportText).toContain('Living Narrative Engine - Cross-Reference Validation Report');
      expect(reportText).toContain('❌ Found 1 violations across 1 mods');
      expect(reportText).toContain('Violation Summary:');
      expect(reportText).toContain('positioning');
      expect(reportText).toContain('intimacy');
    });

    it('should generate ecosystem report without violations', async () => {
      const results = new Map();
      results.set('mod1', { hasViolations: false, violations: [] });
      results.set('mod2', { hasViolations: false, violations: [] });
      
      const reportText = validator.generateReport(results);
      
      expect(reportText).toContain('✅ No cross-reference violations detected in ecosystem');
      expect(reportText).toContain('📊 Validated 2 mods successfully');
    });
  });

  describe('Dependency Declaration Parsing', () => {
    it('should include core as implicit dependency', async () => {
      mockReferenceExtractor.extractReferences.mockResolvedValue(new Map());
      
      const manifestsMap = new Map();
      manifestsMap.set('test', {
        id: 'test',
        dependencies: [] // No explicit dependencies
      });
      
      const report = await validator.validateModReferences('/test/mods/test', manifestsMap);
      
      expect(report.declaredDependencies).toContain('core');
    });

    it('should handle missing dependencies array', async () => {
      mockReferenceExtractor.extractReferences.mockResolvedValue(new Map());
      
      const manifestsMap = new Map();
      manifestsMap.set('test', {
        id: 'test'
        // No dependencies array
      });
      
      const report = await validator.validateModReferences('/test/mods/test', manifestsMap);
      
      expect(report.declaredDependencies).toEqual(['core']); // Only implicit core
    });

    it('should handle invalid dependency objects', async () => {
      mockReferenceExtractor.extractReferences.mockResolvedValue(new Map());
      
      const manifestsMap = new Map();
      manifestsMap.set('test', {
        id: 'test',
        dependencies: [
          { id: 'valid', version: '1.0.0' },
          { invalidDep: 'missing id' },
          null,
          { id: '', version: '1.0.0' } // Empty id
        ]
      });
      
      const report = await validator.validateModReferences('/test/mods/test', manifestsMap);
      
      expect(report.declaredDependencies).toEqual(['core', 'valid']);
    });
  });

  describe('CrossReferenceViolationError', () => {
    it('should create error with violation details', () => {
      const violations = [
        {
          file: 'test.json',
          message: 'Missing dependency: intimacy'
        },
        {
          file: 'other.json',
          message: 'Missing dependency: violence'
        }
      ];
      
      const error = new CrossReferenceViolationError(violations);
      
      expect(error.name).toBe('CrossReferenceViolationError');
      expect(error.message).toContain('Cross-reference violations detected:');
      expect(error.message).toContain('test.json: Missing dependency: intimacy');
      expect(error.message).toContain('other.json: Missing dependency: violence');
      expect(error.violations).toEqual(violations);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should validate modPath parameter', async () => {
      const manifestsMap = new Map();
      
      await expect(
        validator.validateModReferences('', manifestsMap)
      ).rejects.toThrow();
      
      await expect(
        validator.validateModReferences(null, manifestsMap)
      ).rejects.toThrow();
    });

    it('should handle empty reference extraction results', async () => {
      mockReferenceExtractor.extractReferences.mockResolvedValue(new Map());
      
      const manifestsMap = new Map();
      manifestsMap.set('test', { id: 'test' });
      
      const report = await validator.validateModReferences('/test/mods/test', manifestsMap);
      
      expect(report.hasViolations).toBe(false);
      expect(report.referencedMods).toEqual([]);
      expect(report.summary.totalReferences).toBe(0);
    });

    it('should handle large numbers of violations efficiently', async () => {
      // Create a large number of reference violations
      const extractedRefs = new Map();
      for (let i = 0; i < 100; i++) {
        extractedRefs.set(`mod${i}`, new Set([`component${i}`]));
      }
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      const manifestsMap = new Map();
      manifestsMap.set('test', { id: 'test' }); // Only declares core implicitly
      
      // Add all referenced mods to ecosystem
      for (let i = 0; i < 100; i++) {
        manifestsMap.set(`mod${i}`, { id: `mod${i}` });
      }
      
      const report = await validator.validateModReferences('/test/mods/test', manifestsMap);
      
      expect(report.violations).toHaveLength(100);
      expect(report.missingDependencies).toHaveLength(100);
    });
  });
});