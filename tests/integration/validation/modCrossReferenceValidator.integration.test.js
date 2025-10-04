import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModCrossReferenceValidator from '../../../cli/validation/modCrossReferenceValidator.js';
import ModReferenceExtractor from '../../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ModCrossReferenceValidator - Integration', () => {
  let testBed;
  let validator;
  let tempDir;

  beforeEach(async () => {
    testBed = createTestBed();

    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-validation-test-'));

    // Create validator with real dependencies
    const logger = testBed.mockLogger;
    // Create a mock instance that matches the expected interface
    const modDependencyValidator = {
      validate: jest.fn(),
    };
    const referenceExtractor = new ModReferenceExtractor({
      logger,
      ajvValidator: {
        validate: jest.fn().mockReturnValue(true),
        formatErrors: jest.fn().mockReturnValue([]),
      },
    });

    validator = new ModCrossReferenceValidator({
      logger,
      modDependencyValidator,
      referenceExtractor,
      testModBasePath: tempDir, // Configure test base path
    });
  });

  afterEach(async () => {
    testBed.cleanup?.();

    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error.message);
      }
    }
  });

  describe('Real Component Integration', () => {
    it('should work with ModDependencyValidator integration', async () => {
      // Test that we can use the dependency validator through the cross-reference validator
      // First create a core mod directory
      const coreModPath = path.join(tempDir, 'core');
      await fs.mkdir(coreModPath, { recursive: true });

      const manifestsMap = new Map();
      manifestsMap.set('core', {
        id: 'core',
        version: '1.0.0',
        dependencies: [],
      });

      const result = await validator.validateAllModReferences(manifestsMap);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Map);

      // Verify the core mod was processed
      expect(result.has('core')).toBe(true);
      const coreReport = result.get('core');
      expect(coreReport).toBeDefined();
      expect(coreReport.modId).toBe('core');
    });

    it('should integrate with real reference extractor for file processing', async () => {
      // Create a test mod with actual files
      const modPath = path.join(tempDir, 'test-mod');
      await fs.mkdir(modPath, { recursive: true });

      // Create an action file with REAL cross-mod references that exist
      const actionData = {
        id: 'test-action',
        required_components: {
          actor: ['positioning:closeness'], // This is a REAL reference used by intimacy mod
        },
        targets: 'positioning:close_actors', // This is a REAL scope from positioning mod
      };

      await fs.writeFile(
        path.join(modPath, 'test.action.json'),
        JSON.stringify(actionData, null, 2)
      );

      // Create manifest
      const manifestsMap = new Map();
      manifestsMap.set('test-mod', {
        id: 'test-mod',
        dependencies: [{ id: 'core', version: '^1.0.0' }], // Missing positioning dependency
      });
      manifestsMap.set('positioning', { id: 'positioning' });
      manifestsMap.set('core', { id: 'core' });

      const report = await validator.validateModReferences(
        modPath,
        manifestsMap
      );

      expect(report.hasViolations).toBe(true);
      expect(report.violations.length).toBeGreaterThan(0);

      // Verify that positioning references were detected
      const positioningViolations = report.violations.filter(
        (v) => v.referencedMod === 'positioning'
      );
      expect(positioningViolations.length).toBeGreaterThan(0);

      // Check specific components were found
      const componentNames = positioningViolations.map(
        (v) => v.referencedComponent
      );
      expect(componentNames).toContain('closeness');
      expect(componentNames).toContain('close_actors');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle real intimacy mod referencing positioning components', async () => {
      // Test the ACTUAL scenario - intimacy mod DOES reference positioning components
      const intimacyPath = path.join(tempDir, 'intimacy');
      await fs.mkdir(intimacyPath, { recursive: true });
      await fs.mkdir(path.join(intimacyPath, 'actions'), { recursive: true });

      // Create a real intimacy action that references positioning components
      const kissAction = {
        id: 'kiss_cheek',
        description: 'Kiss someone on the cheek',
        targets: 'positioning:close_actors', // Real reference from intimacy mod
        required_components: {
          actor: ['positioning:closeness'], // Real reference from intimacy mod
        },
      };

      await fs.writeFile(
        path.join(intimacyPath, 'actions', 'kiss_cheek.action.json'),
        JSON.stringify(kissAction, null, 2)
      );

      // Set up manifestsMap simulating a missing dependency scenario
      const manifestsMap = new Map();
      manifestsMap.set('intimacy', {
        id: 'intimacy',
        version: '1.0.0',
        dependencies: [
          { id: 'anatomy', version: '^1.0.0' },
          // Missing positioning dependency to test violation detection
        ],
      });
      manifestsMap.set('positioning', {
        id: 'positioning',
        version: '1.0.0',
        dependencies: [{ id: 'core', version: '^1.0.0' }],
      });
      manifestsMap.set('anatomy', {
        id: 'anatomy',
        version: '1.0.0',
        dependencies: [{ id: 'core', version: '^1.0.0' }],
      });
      manifestsMap.set('core', {
        id: 'core',
        version: '1.0.0',
        dependencies: [],
      });

      // Should detect positioning violations
      const report = await validator.validateModReferences(
        intimacyPath,
        manifestsMap
      );

      expect(report.hasViolations).toBe(true);
      expect(report.modId).toBe('intimacy');
      expect(report.missingDependencies).toContain('positioning');

      // Verify specific violations
      const positioningViolations = report.violations.filter(
        (v) => v.referencedMod === 'positioning'
      );
      expect(positioningViolations.length).toBeGreaterThan(0);

      // Should find the actual referenced components
      const componentNames = positioningViolations.map(
        (v) => v.referencedComponent
      );
      expect(componentNames).toContain('close_actors');
      expect(componentNames).toContain('closeness');

      // Verify violation messages are helpful
      positioningViolations.forEach((violation) => {
        expect(violation.message).toContain('intimacy');
        expect(violation.message).toContain('positioning');
        expect(violation.suggestedFix).toContain(
          'Add "positioning" to dependencies'
        );
      });
    });

    it('should handle complex multi-mod ecosystem validation', async () => {
      // Create multiple interconnected mods with REALISTIC references
      const modConfigs = {
        core: { files: [], dependencies: [] },
        anatomy: {
          files: [],
          dependencies: [{ id: 'core', version: '^1.0.0' }],
        },
        positioning: {
          files: [],
          dependencies: [{ id: 'core', version: '^1.0.0' }],
        },
        intimacy: {
          files: [
            // Intimacy ACTUALLY references positioning components
            {
              name: 'kiss.action.json',
              content: {
                id: 'kiss',
                required_components: { actor: ['positioning:closeness'] },
                targets: 'positioning:close_actors',
              },
            },
          ],
          dependencies: [{ id: 'anatomy', version: '^1.0.0' }], // Missing positioning dependency
        },
        violence: {
          files: [],
          dependencies: [{ id: 'positioning', version: '^1.0.0' }],
        },
      };

      // Create mod directories and files
      for (const [modId, config] of Object.entries(modConfigs)) {
        const modPath = path.join(tempDir, modId);
        await fs.mkdir(modPath, { recursive: true });

        for (const file of config.files) {
          await fs.writeFile(
            path.join(modPath, file.name),
            JSON.stringify(file.content, null, 2)
          );
        }
      }

      // Set up manifestsMap
      const manifestsMap = new Map();
      for (const [modId, config] of Object.entries(modConfigs)) {
        manifestsMap.set(modId, {
          id: modId,
          dependencies: config.dependencies,
        });
      }

      const results = await validator.validateAllModReferences(manifestsMap);

      expect(results.size).toBe(5);

      // Core should have no violations (no files)
      expect(results.get('core').hasViolations).toBe(false);

      // Intimacy should have violations (missing positioning dependency)
      expect(results.get('intimacy').hasViolations).toBe(true);
      expect(results.get('intimacy').missingDependencies).toContain(
        'positioning'
      );

      // Other mods should be clean (no cross-references)
      expect(results.get('anatomy').hasViolations).toBe(false);
      expect(results.get('positioning').hasViolations).toBe(false);
      expect(results.get('violence').hasViolations).toBe(false);
    });

    it('should generate comprehensive ecosystem report', async () => {
      // Create simple violation scenario with REAL references
      const testPath = path.join(tempDir, 'test-mod');
      await fs.mkdir(testPath, { recursive: true });

      const testAction = {
        id: 'test',
        required_components: {
          actor: ['positioning:closeness'], // Real component from positioning mod
        },
      };

      await fs.writeFile(
        path.join(testPath, 'test.action.json'),
        JSON.stringify(testAction, null, 2)
      );

      const manifestsMap = new Map();
      manifestsMap.set('test-mod', {
        id: 'test-mod',
        dependencies: [{ id: 'core', version: '^1.0.0' }], // Missing positioning dependency
      });
      manifestsMap.set('positioning', { id: 'positioning' });
      manifestsMap.set('core', { id: 'core' });

      const results = await validator.validateAllModReferences(manifestsMap);
      const report = validator.generateReport(results);

      expect(report).toContain(
        'Living Narrative Engine - Cross-Reference Validation Report'
      );
      expect(report).toContain('test-mod');
      expect(report).toContain('positioning');
      expect(report).toContain('Next Steps:');
      expect(report).toContain('mod-manifest.json');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing mod directories gracefully', async () => {
      const manifestsMap = new Map();
      manifestsMap.set('missing-mod', { id: 'missing-mod' });

      const results = await validator.validateAllModReferences(manifestsMap);

      expect(results.size).toBe(0); // No successful validations
      // Should log error messages about the validation failure
      expect(testBed.mockLogger.error).toHaveBeenCalled();

      // Check that one of the error calls is the validation failure
      const errorCalls = testBed.mockLogger.error.mock.calls;
      const validationFailureCalls = errorCalls.filter(
        (call) => call[0] === 'Failed to validate mod missing-mod'
      );
      expect(validationFailureCalls.length).toBeGreaterThan(0);
    });

    it('should handle corrupted JSON files gracefully', async () => {
      const modPath = path.join(tempDir, 'corrupt-mod');
      await fs.mkdir(modPath, { recursive: true });

      // Create invalid JSON file
      await fs.writeFile(
        path.join(modPath, 'corrupt.json'),
        '{ invalid json content'
      );

      const manifestsMap = new Map();
      manifestsMap.set('corrupt-mod', { id: 'corrupt-mod' });

      // Should not crash, but may log warnings
      const report = await validator.validateModReferences(
        modPath,
        manifestsMap
      );

      expect(report).toBeDefined();
      expect(report.modId).toBe('corrupt-mod');
      // The reference extractor should handle the JSON parse error gracefully
    });

    it('should handle empty mod directories', async () => {
      const modPath = path.join(tempDir, 'empty-mod');
      await fs.mkdir(modPath, { recursive: true });

      const manifestsMap = new Map();
      manifestsMap.set('empty-mod', { id: 'empty-mod' });

      const report = await validator.validateModReferences(
        modPath,
        manifestsMap
      );

      expect(report.hasViolations).toBe(false);
      expect(report.violations).toHaveLength(0);
      expect(report.referencedMods).toEqual([]);
    });

    it('should handle large mod ecosystems efficiently', async () => {
      // Create fewer mods but with more realistic references
      const modCount = 10;
      const manifestsMap = new Map();

      // Core mod (no references)
      const coreModPath = path.join(tempDir, 'core');
      await fs.mkdir(coreModPath, { recursive: true });
      manifestsMap.set('core', { id: 'core', dependencies: [] });

      // Create mods with realistic cross-references
      for (let i = 0; i < modCount; i++) {
        const modId = `test-mod-${i}`;
        const modPath = path.join(tempDir, modId);
        await fs.mkdir(modPath, { recursive: true });

        // Some mods reference positioning:closeness (realistic reference)
        if (i % 3 === 0) {
          const testFile = {
            id: `${modId}-action`,
            required_components: {
              actor: ['positioning:closeness'], // Realistic cross-mod reference
            },
          };

          await fs.writeFile(
            path.join(modPath, 'action.json'),
            JSON.stringify(testFile, null, 2)
          );

          // Missing positioning dependency
          manifestsMap.set(modId, {
            id: modId,
            dependencies: [{ id: 'core', version: '^1.0.0' }],
          });
        } else {
          // Mods without cross-references
          manifestsMap.set(modId, {
            id: modId,
            dependencies: [{ id: 'core', version: '^1.0.0' }],
          });
        }
      }

      manifestsMap.set('positioning', { id: 'positioning' });

      const startTime = Date.now();
      const results = await validator.validateAllModReferences(manifestsMap);
      const endTime = Date.now();

      expect(results.size).toBe(modCount + 1); // +1 for core
      expect(endTime - startTime).toBeLessThan(5000); // Should complete under 5 seconds

      // Every third mod should have violations (missing positioning dependency)
      const modsWithViolations = [];
      const cleanMods = [];

      for (let i = 0; i < modCount; i++) {
        const modId = `test-mod-${i}`;
        const report = results.get(modId);

        if (i % 3 === 0) {
          modsWithViolations.push({ modId, report });
        } else {
          cleanMods.push({ modId, report });
        }
      }

      // Test mods with violations
      modsWithViolations.forEach(({ report }) => {
        expect(report.hasViolations).toBe(true);
        expect(report.violations.length).toBeGreaterThan(0);
        expect(report.missingDependencies).toContain('positioning');
      });

      // Test clean mods
      cleanMods.forEach(({ report }) => {
        expect(report.hasViolations).toBe(false);
      });
    });
  });

  describe('Integration with File System', () => {
    it('should handle different file types in mod directory', async () => {
      const modPath = path.join(tempDir, 'mixed-mod');
      await fs.mkdir(modPath, { recursive: true });
      await fs.mkdir(path.join(modPath, 'subdir'), { recursive: true });

      // Create various file types with REALISTIC references
      await fs.writeFile(
        path.join(modPath, 'action.action.json'),
        JSON.stringify({
          id: 'test',
          targets: 'positioning:close_actors',
          required_components: { actor: ['positioning:closeness'] },
        })
      );

      await fs.writeFile(
        path.join(modPath, 'rule.rule.json'),
        JSON.stringify({
          id: 'test',
          condition: { condition_ref: 'positioning:actor-is-in-closeness' },
        })
      );

      await fs.writeFile(
        path.join(modPath, 'test.scope'),
        'close_to_target := positioning:close_actors'
      );

      await fs.writeFile(
        path.join(modPath, 'readme.txt'),
        'This is a readme file' // Should be ignored
      );

      await fs.writeFile(
        path.join(modPath, 'subdir', 'nested.action.json'),
        JSON.stringify({
          id: 'nested',
          required_components: { actor: ['intimacy:kissing'] },
        })
      );

      const manifestsMap = new Map();
      manifestsMap.set('mixed-mod', { id: 'mixed-mod', dependencies: [] });
      manifestsMap.set('positioning', { id: 'positioning' });
      manifestsMap.set('intimacy', { id: 'intimacy' });

      const report = await validator.validateModReferences(
        modPath,
        manifestsMap
      );

      expect(report.hasViolations).toBe(true);
      expect(report.referencedMods).toEqual(
        expect.arrayContaining(['positioning', 'intimacy'])
      );
      expect(report.violations.length).toBeGreaterThan(0);

      // Should find references from different file types
      const referencedMods = report.violations.map((v) => v.referencedMod);
      expect(referencedMods).toContain('positioning');
      expect(referencedMods).toContain('intimacy');
    });
  });
});
