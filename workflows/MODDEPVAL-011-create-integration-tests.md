# MODDEPVAL-011: Create Integration Tests for End-to-End Validation Workflow

## Overview

Create comprehensive integration tests that validate the entire mod dependency validation system from end-to-end, ensuring all components work together correctly in real-world scenarios. This includes testing the complete workflow from file changes through validation reporting, with emphasis on production-like conditions.

## Background

Integration tests are crucial for validating that the mod dependency validation system works correctly as a complete system. Unlike unit tests that test individual components, integration tests verify:

- **Complete workflows**: End-to-end validation from trigger to report
- **Component integration**: All validation components working together
- **Real-world scenarios**: Actual mod structures and violations  
- **Performance characteristics**: System behavior under load
- **Error handling**: Graceful failure and recovery patterns

## Technical Specifications

### Integration Test Architecture

```javascript
// tests/integration/validation/modValidationWorkflow.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createIntegrationTestBed } from '../../common/integrationTestBed.js';
import { container } from '../../../src/dependencyInjection/container.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Comprehensive integration tests for the mod validation workflow
 * Tests the complete system from file changes to validation reports
 */
describe('Mod Validation Workflow - Integration Tests', () => {
  let testBed;
  let orchestrator;
  let reporter;
  let cache;
  let performanceMonitor;
  let tempDir;

  beforeEach(async () => {
    testBed = createIntegrationTestBed();
    tempDir = await testBed.createTempDirectory('integration-validation-tests');
    
    // Initialize real components (not mocks) for integration testing
    orchestrator = container.resolve(tokens.IPerformanceOptimizedValidationOrchestrator);
    reporter = container.resolve(tokens.IViolationReporter);
    cache = container.resolve(tokens.IValidationCache);
    performanceMonitor = container.resolve(tokens.IValidationPerformanceMonitor);
    
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('End-to-End Validation Workflow', () => {
    it('should execute complete validation workflow for ecosystem with violations', async () => {
      // Arrange: Create realistic mod ecosystem with known violation
      await testBed.createRealWorldModEcosystem(tempDir, {
        'core': {
          manifest: { 
            id: 'core', 
            version: '1.0.0', 
            dependencies: [] 
          },
          files: {
            'components/actor.component.json': {
              id: 'core:actor',
              dataSchema: { type: 'object', properties: { name: { type: 'string' } } }
            }
          }
        },
        'positioning': {
          manifest: { 
            id: 'positioning', 
            version: '1.0.0', 
            dependencies: [{ id: 'core', version: '^1.0.0' }]
          },
          files: {
            'components/closeness.component.json': {
              id: 'positioning:closeness',
              dataSchema: { type: 'object', properties: { distance: { type: 'string' } } }
            },
            'actions/turn_around.action.json': {
              required_components: { actor: ['positioning:closeness'] },
              forbidden_components: { actor: ['intimacy:kissing'] } // ← The violation
            },
            'scopes/nearby.scope': 'positioning:nearby_actors := actor.components.positioning:closeness.partners'
          }
        },
        'intimacy': {
          manifest: { 
            id: 'intimacy', 
            version: '1.0.0', 
            dependencies: [
              { id: 'core', version: '^1.0.0' },
              { id: 'positioning', version: '^1.0.0' }
            ]
          },
          files: {
            'components/kissing.component.json': {
              id: 'intimacy:kissing',
              dataSchema: { type: 'object', properties: { intensity: { type: 'number' } } }
            }
          }
        }
      });

      // Act: Execute complete validation workflow
      const startTime = performance.now();
      const results = await orchestrator.validateEcosystem({
        enableCaching: true,
        enableParallelProcessing: true,
        includeContext: true
      });
      const executionTime = performance.now() - startTime;

      // Assert: Verify complete workflow results
      expect(results).toBeDefined();
      expect(results.dependencies).toBeDefined();
      expect(results.dependencies.isValid).toBe(true); // Dependencies should be valid
      expect(results.crossReferences).toBeDefined();
      expect(results.crossReferences).toBeInstanceOf(Map);
      
      // Verify specific violation detection
      const positioningResult = results.crossReferences.get('positioning');
      expect(positioningResult).toBeDefined();
      expect(positioningResult.hasViolations).toBe(true);
      expect(positioningResult.violations).toHaveLength(1);
      
      const violation = positioningResult.violations[0];
      expect(violation.referencedMod).toBe('intimacy');
      expect(violation.referencedComponent).toBe('kissing');
      expect(violation.violatingMod).toBe('positioning');
      
      // Verify overall system state
      expect(results.isValid).toBe(false); // Should fail due to cross-reference violation
      expect(results.performance).toBeDefined();
      expect(results.performance.optimized).toBe(true);
      
      // Verify performance characteristics
      expect(executionTime).toBeLessThan(10000); // Should complete in <10 seconds
    });

    it('should handle large ecosystem validation efficiently', async () => {
      // Arrange: Create large mod ecosystem (50 mods)
      const modCount = 50;
      const ecosystem = await testBed.createLargeModEcosystem(tempDir, {
        modCount,
        includeViolations: 5, // 5 mods with violations
        complexityLevel: 'medium'
      });

      // Act: Validate entire ecosystem
      const startTime = performance.now();
      const results = await orchestrator.validateEcosystem({
        enableCaching: true,
        enableParallelProcessing: true,
        maxConcurrency: 5
      });
      const executionTime = performance.now() - startTime;

      // Assert: Verify performance and correctness
      expect(results.crossReferences.size).toBe(modCount);
      expect(executionTime).toBeLessThan(30000); // Should complete in <30 seconds
      
      // Verify violation detection
      const violationCount = Array.from(results.crossReferences.values())
        .reduce((sum, result) => sum + result.violations.length, 0);
      expect(violationCount).toBeGreaterThan(0); // Should find some violations
      
      // Verify performance optimization worked
      const stats = cache.getStats();
      expect(parseFloat(stats.hitRate)).toBeGreaterThan(0); // Cache should be used
    });

    it('should support incremental validation workflow', async () => {
      // Arrange: Create mod ecosystem and perform initial validation
      await testBed.createBasicModEcosystem(tempDir);
      
      const initialResults = await orchestrator.validateEcosystem();
      expect(initialResults.isValid).toBe(true);

      // Act: Make changes that introduce violations
      const violationChanges = {
        'positioning/actions/new_action.action.json': {
          required_components: { actor: ['missing_mod:component'] }
        }
      };
      
      const changedFiles = await testBed.applyFileChanges(tempDir, violationChanges);
      
      // Execute incremental validation
      const incrementalResults = await orchestrator.validateIncremental(changedFiles, {
        enableCaching: true
      });

      // Assert: Verify incremental validation
      expect(incrementalResults.incremental).toBe(true);
      expect(incrementalResults.affectedMods).toContain('positioning');
      expect(incrementalResults.isValid).toBe(false);
      
      // Verify only affected mods were validated
      expect(incrementalResults.affectedMods.length).toBeLessThan(3); // Should be minimal
    });
  });

  describe('Reporting Integration', () => {
    it('should generate comprehensive reports in multiple formats', async () => {
      // Arrange: Create ecosystem with known violations
      await testBed.createModEcosystemWithViolations(tempDir, {
        violationCount: 3,
        severityLevels: ['critical', 'high', 'medium']
      });

      const results = await orchestrator.validateEcosystem();

      // Act & Assert: Test multiple report formats
      const formats = ['console', 'json', 'html', 'markdown', 'junit'];
      
      for (const format of formats) {
        const report = reporter.generateReport(results.crossReferences, format, {
          showSuggestions: true,
          verbose: true,
          includeMetadata: true
        });
        
        expect(report).toBeDefined();
        expect(typeof report).toBe('string');
        expect(report.length).toBeGreaterThan(100); // Should be substantial
        
        // Format-specific validations
        switch (format) {
          case 'json':
            expect(() => JSON.parse(report)).not.toThrow();
            const jsonData = JSON.parse(report);
            expect(jsonData.type).toBe('ecosystem');
            expect(jsonData.mods).toBeDefined();
            break;
            
          case 'html':
            expect(report).toContain('<!DOCTYPE html>');
            expect(report).toContain('</html>');
            break;
            
          case 'junit':
            expect(report).toContain('<?xml version="1.0"');
            expect(report).toContain('<testsuite');
            break;
        }
      }
    });

    it('should provide actionable fix suggestions', async () => {
      // Arrange: Create mod with specific violation pattern
      await testBed.createModWithSpecificViolation(tempDir, {
        violatingMod: 'positioning',
        referencedMod: 'intimacy', 
        referencedComponent: 'kissing',
        violationType: 'undeclared_dependency'
      });

      const results = await orchestrator.validateEcosystem();
      const report = reporter.generateReport(results.crossReferences, 'console', {
        showSuggestions: true,
        colors: false
      });

      // Assert: Verify actionable suggestions are provided
      expect(report).toContain('💡'); // Suggestion indicator
      expect(report).toContain('Add "intimacy" to dependencies');
      expect(report).toContain('mod-manifest.json');
      
      // Verify structured suggestions in JSON format
      const jsonReport = JSON.parse(reporter.generateReport(results.crossReferences, 'json'));
      const positioningMod = jsonReport.mods.positioning;
      
      expect(positioningMod.violations[0].suggestedFixes).toBeDefined();
      expect(positioningMod.violations[0].suggestedFixes).toHaveLength(1);
      
      const primaryFix = positioningMod.violations[0].suggestedFixes[0];
      expect(primaryFix.type).toBe('add_dependency');
      expect(primaryFix.priority).toBe('primary');
      expect(primaryFix.implementation).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should demonstrate caching performance benefits', async () => {
      // Arrange: Create moderate ecosystem
      await testBed.createBasicModEcosystem(tempDir, { modCount: 10 });

      // Act: First validation (no cache)
      await cache.clear();
      const firstStart = performance.now();
      const firstResults = await orchestrator.validateEcosystem({ enableCaching: true });
      const firstTime = performance.now() - firstStart;

      // Second validation (with cache)
      const secondStart = performance.now();
      const secondResults = await orchestrator.validateEcosystem({ enableCaching: true });
      const secondTime = performance.now() - secondStart;

      // Assert: Verify caching benefits
      expect(secondTime).toBeLessThan(firstTime * 0.5); // At least 50% improvement
      
      const cacheStats = cache.getStats();
      expect(parseFloat(cacheStats.hitRate)).toBeGreaterThan(50); // >50% hit rate
      
      // Results should be identical
      expect(secondResults.isValid).toBe(firstResults.isValid);
    });

    it('should handle concurrent validation requests gracefully', async () => {
      // Arrange: Create test ecosystem
      await testBed.createBasicModEcosystem(tempDir);

      // Act: Run multiple concurrent validations
      const concurrentValidations = Array.from({ length: 5 }, () =>
        orchestrator.validateEcosystem({ enableCaching: true })
      );

      const results = await Promise.all(concurrentValidations);

      // Assert: All validations should succeed and be consistent
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.isValid).toBe(results[0].isValid); // All should be consistent
      });

      // Performance should not degrade significantly
      const performanceStats = performanceMonitor.getStats();
      expect(performanceStats.aggregate.averageTime).toBeLessThan(10000); // <10 seconds average
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle corrupted mod files gracefully', async () => {
      // Arrange: Create ecosystem with corrupted files
      await testBed.createBasicModEcosystem(tempDir);
      
      // Corrupt some files
      const corruptedFiles = {
        'positioning/actions/broken.action.json': '{ invalid json content',
        'positioning/components/missing.component.json': '', // Empty file
        'intimacy/scopes/malformed.scope': 'invalid:scope := missing syntax here'
      };
      
      await testBed.applyFileChanges(tempDir, corruptedFiles);

      // Act: Validate despite corruption
      const results = await orchestrator.validateEcosystem({
        continueOnError: true
      });

      // Assert: Should handle errors gracefully
      expect(results).toBeDefined();
      expect(results.errors).toBeDefined();
      expect(results.errors.length).toBeGreaterThan(0); // Should report errors
      
      // But should still process valid files
      expect(results.crossReferences).toBeDefined();
      expect(results.crossReferences.size).toBeGreaterThan(0);
    });

    it('should provide detailed error context for debugging', async () => {
      // Arrange: Create mod with dependency cycle
      await testBed.createModEcosystemWithCircularDependencies(tempDir);

      // Act: Attempt validation
      let error;
      try {
        await orchestrator.validateEcosystem({ failFast: true });
      } catch (err) {
        error = err;
      }

      // Assert: Error should be informative
      expect(error).toBeDefined();
      expect(error.message).toContain('Circular dependency');
      expect(error.validationResults).toBeDefined();
      
      // Should provide context for resolution
      expect(error.message).toContain('dependency');
    });
  });

  describe('CLI Integration', () => {
    it('should integrate with CLI workflow end-to-end', async () => {
      // Arrange: Create test ecosystem
      await testBed.createModEcosystemWithViolations(tempDir);

      // Act: Simulate CLI execution
      const cliResult = await testBed.executeCLI('validateMods', [
        '--ecosystem',
        '--format', 'json',
        '--output', path.join(tempDir, 'cli-report.json'),
        '--show-suggestions'
      ]);

      // Assert: CLI should complete successfully
      expect(cliResult.exitCode).toBe(1); // Should fail due to violations
      
      // Verify report file was created
      const reportPath = path.join(tempDir, 'cli-report.json');
      const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
      expect(reportExists).toBe(true);
      
      // Verify report content
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const reportData = JSON.parse(reportContent);
      
      expect(reportData.type).toBe('ecosystem');
      expect(reportData.mods).toBeDefined();
      expect(Object.keys(reportData.mods).length).toBeGreaterThan(0);
    });

    it('should integrate with updateManifest workflow', async () => {
      // Arrange: Create mod ecosystem
      await testBed.createBasicModEcosystem(tempDir);
      
      // Add violation to positioning mod
      const violationFile = {
        'positioning/actions/problematic.action.json': {
          required_components: { actor: ['nonexistent:component'] }
        }
      };
      await testBed.applyFileChanges(tempDir, violationFile);

      // Act: Run updateManifest with validation
      const updateResult = await testBed.executeCLI('updateManifest', [
        'positioning',
        '--validate-references',
        '--fail-on-violations',
        '--format', 'console'
      ]);

      // Assert: Should fail due to violations
      expect(updateResult.exitCode).toBe(1);
      expect(updateResult.output).toContain('cross-reference violations');
      expect(updateResult.output).toContain('nonexistent:component');
    });
  });

  describe('Real-World Scenario Tests', () => {
    it('should handle the actual positioning/intimacy violation case', async () => {
      // Arrange: Create exact reproduction of real violation
      await testBed.createRealPositioningIntimacyViolation(tempDir);

      // Act: Validate with production-like settings
      const results = await orchestrator.validateEcosystem({
        enableCaching: true,
        enableParallelProcessing: true,
        strictMode: false
      });

      // Assert: Should detect the specific violation
      const positioningResult = results.crossReferences.get('positioning');
      expect(positioningResult.hasViolations).toBe(true);
      
      const violation = positioningResult.violations.find(v => 
        v.referencedMod === 'intimacy' && v.referencedComponent === 'kissing'
      );
      
      expect(violation).toBeDefined();
      expect(violation.file).toContain('turn_around.action.json');
      expect(violation.context).toContain('forbidden_components');
      
      // Should provide actionable fix
      expect(violation.suggestedFixes).toBeDefined();
      expect(violation.suggestedFixes[0].description).toContain('Add "intimacy" to dependencies');
    });

    it('should validate complex mod ecosystem resembling production', async () => {
      // Arrange: Create production-like mod ecosystem
      const productionLikeEcosystem = await testBed.createProductionLikeEcosystem(tempDir, {
        coreMods: ['core', 'anatomy', 'descriptors'],
        gameplayMods: ['positioning', 'violence', 'intimacy'],
        specializedMods: ['exercise', 'examples'],
        worldMods: ['isekai'],
        includeRealViolations: true
      });

      // Act: Comprehensive validation
      const startTime = performance.now();
      const results = await orchestrator.validateEcosystem({
        enableCaching: true,
        enableParallelProcessing: true,
        maxConcurrency: 3,
        timeout: 120000 // 2 minute timeout
      });
      const executionTime = performance.now() - startTime;

      // Assert: Should handle production complexity
      expect(results.crossReferences.size).toBeGreaterThan(5);
      expect(executionTime).toBeLessThan(60000); // Should complete in <1 minute
      
      // Should find expected violations
      const totalViolations = Array.from(results.crossReferences.values())
        .reduce((sum, result) => sum + result.violations.length, 0);
      expect(totalViolations).toBeGreaterThan(0);
      
      // Performance should be reasonable
      const cacheStats = cache.getStats();
      expect(parseFloat(cacheStats.hitRate)).toBeGreaterThan(30); // >30% cache hit rate
    });
  });
});
```

### Integration Test Bed Enhancement

```javascript
// tests/common/integrationTestBed.js - Enhanced test utilities

import { createTestBed } from './testBed.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';

/**
 * Enhanced test bed for integration testing with real-world scenarios
 */
export function createIntegrationTestBed() {
  const baseBed = createTestBed();

  return {
    ...baseBed,

    /**
     * Creates a realistic mod ecosystem with complex interdependencies
     * @param {string} baseDir - Base directory for ecosystem
     * @param {Object} ecosystemSpec - Ecosystem specification
     * @returns {Promise<Object>} Created ecosystem metadata
     */
    async createRealWorldModEcosystem(baseDir, ecosystemSpec) {
      const ecosystemDir = path.join(baseDir, 'data', 'mods');
      await fs.mkdir(ecosystemDir, { recursive: true });

      for (const [modId, modSpec] of Object.entries(ecosystemSpec)) {
        const modDir = path.join(ecosystemDir, modId);
        await fs.mkdir(modDir, { recursive: true });

        // Create manifest
        const manifestPath = path.join(modDir, 'mod-manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify(modSpec.manifest, null, 2));

        // Create files
        for (const [filePath, content] of Object.entries(modSpec.files || {})) {
          const fullFilePath = path.join(modDir, filePath);
          const fileDir = path.dirname(fullFilePath);
          
          await fs.mkdir(fileDir, { recursive: true });
          
          const fileContent = typeof content === 'string' 
            ? content 
            : JSON.stringify(content, null, 2);
            
          await fs.writeFile(fullFilePath, fileContent);
        }
      }

      return {
        ecosystemDir,
        modCount: Object.keys(ecosystemSpec).length,
        modIds: Object.keys(ecosystemSpec)
      };
    },

    /**
     * Creates large mod ecosystem for performance testing
     * @param {string} baseDir - Base directory
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated ecosystem metadata
     */
    async createLargeModEcosystem(baseDir, options = {}) {
      const {
        modCount = 50,
        includeViolations = 5,
        complexityLevel = 'medium'
      } = options;

      const ecosystemSpec = {};

      // Create core mod
      ecosystemSpec.core = {
        manifest: { id: 'core', version: '1.0.0', dependencies: [] },
        files: {
          'components/actor.component.json': {
            id: 'core:actor',
            dataSchema: { type: 'object', properties: { name: { type: 'string' } } }
          }
        }
      };

      // Generate additional mods
      for (let i = 1; i < modCount; i++) {
        const modId = `mod-${i.toString().padStart(3, '0')}`;
        const hasViolation = i <= includeViolations;
        
        const dependencies = [{ id: 'core', version: '^1.0.0' }];
        
        // Add random dependencies for complexity
        if (complexityLevel === 'high' && i > 10) {
          const depCount = Math.floor(Math.random() * 3) + 1;
          for (let d = 0; d < depCount; d++) {
            const depIndex = Math.floor(Math.random() * Math.min(i - 1, 10)) + 1;
            const depId = `mod-${depIndex.toString().padStart(3, '0')}`;
            dependencies.push({ id: depId, version: '^1.0.0' });
          }
        }

        ecosystemSpec[modId] = {
          manifest: { id: modId, version: '1.0.0', dependencies },
          files: {
            [`components/${modId}-component.component.json`]: {
              id: `${modId}:component`,
              dataSchema: { type: 'object', properties: { value: { type: 'string' } } }
            },
            [`actions/${modId}-action.action.json`]: hasViolation ? {
              required_components: { 
                actor: [`${modId}:component`],
                target: [`violation-mod:missing-component`] // ← Violation
              }
            } : {
              required_components: { actor: [`${modId}:component`] }
            }
          }
        };
      }

      return this.createRealWorldModEcosystem(baseDir, ecosystemSpec);
    },

    /**
     * Creates the exact positioning/intimacy violation scenario
     * @param {string} baseDir - Base directory
     * @returns {Promise<Object>} Created scenario metadata
     */
    async createRealPositioningIntimacyViolation(baseDir) {
      const violationScenario = {
        'core': {
          manifest: { id: 'core', version: '1.0.0', dependencies: [] },
          files: {
            'components/actor.component.json': {
              id: 'core:actor',
              dataSchema: { type: 'object', properties: { name: { type: 'string' } } }
            }
          }
        },
        'positioning': {
          manifest: { 
            id: 'positioning', 
            version: '1.0.0', 
            dependencies: [{ id: 'core', version: '^1.0.0' }] // Missing intimacy dependency
          },
          files: {
            'components/closeness.component.json': {
              id: 'positioning:closeness',
              dataSchema: { 
                type: 'object', 
                properties: { 
                  distance: { type: 'string' },
                  partners: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            'actions/turn_around.action.json': {
              id: 'positioning:turn_around',
              required_components: { actor: ['positioning:closeness'] },
              forbidden_components: { actor: ['intimacy:kissing'] }, // ← The actual violation
              operations: [
                { type: 'set_component_value', target: 'actor', component: 'positioning:closeness', field: 'direction', value: 'opposite' }
              ]
            }
          }
        },
        'intimacy': {
          manifest: { 
            id: 'intimacy', 
            version: '1.0.0', 
            dependencies: [
              { id: 'core', version: '^1.0.0' },
              { id: 'positioning', version: '^1.0.0' } // Correctly declares positioning
            ]
          },
          files: {
            'components/kissing.component.json': {
              id: 'intimacy:kissing',
              dataSchema: { 
                type: 'object', 
                properties: { 
                  intensity: { type: 'number', minimum: 0, maximum: 100 }
                }
              }
            }
          }
        }
      };

      return this.createRealWorldModEcosystem(baseDir, violationScenario);
    },

    /**
     * Creates production-like ecosystem with realistic mod structure
     * @param {string} baseDir - Base directory
     * @param {Object} options - Ecosystem options
     * @returns {Promise<Object>} Created ecosystem metadata
     */
    async createProductionLikeEcosystem(baseDir, options = {}) {
      const {
        coreMods = ['core', 'anatomy', 'descriptors'],
        gameplayMods = ['positioning', 'violence', 'intimacy'],
        specializedMods = ['exercise', 'examples'],
        worldMods = ['isekai'],
        includeRealViolations = false
      } = options;

      const productionSpec = {};

      // Core mods (foundation)
      productionSpec.core = {
        manifest: { id: 'core', version: '1.0.0', dependencies: [] },
        files: {
          'components/actor.component.json': { id: 'core:actor', dataSchema: { type: 'object' } },
          'components/position.component.json': { id: 'core:position', dataSchema: { type: 'object' } }
        }
      };

      productionSpec.anatomy = {
        manifest: { id: 'anatomy', version: '1.0.0', dependencies: [{ id: 'core', version: '^1.0.0' }] },
        files: {
          'components/body.component.json': { id: 'anatomy:body', dataSchema: { type: 'object' } },
          'blueprints/human.blueprint.json': { id: 'anatomy:human', parts: ['anatomy:body'] }
        }
      };

      productionSpec.descriptors = {
        manifest: { id: 'descriptors', version: '1.0.0', dependencies: [{ id: 'core', version: '^1.0.0' }] },
        files: {
          'components/appearance.component.json': { id: 'descriptors:appearance', dataSchema: { type: 'object' } }
        }
      };

      // Gameplay mods (level 2)
      productionSpec.positioning = {
        manifest: { 
          id: 'positioning', 
          version: '1.0.0', 
          dependencies: [
            { id: 'core', version: '^1.0.0' },
            { id: 'anatomy', version: '^1.0.0' }
          ]
        },
        files: {
          'components/closeness.component.json': { id: 'positioning:closeness', dataSchema: { type: 'object' } },
          'actions/move_to.action.json': { 
            id: 'positioning:move_to',
            required_components: { actor: ['positioning:closeness'] }
          },
          'scopes/nearby.scope': 'positioning:nearby := actor.components.positioning:closeness.partners'
        }
      };

      // Add violation if requested
      if (includeRealViolations) {
        productionSpec.positioning.files['actions/turn_around.action.json'] = {
          id: 'positioning:turn_around',
          forbidden_components: { actor: ['intimacy:kissing'] } // ← Violation
        };
      }

      productionSpec.intimacy = {
        manifest: { 
          id: 'intimacy', 
          version: '1.0.0', 
          dependencies: [
            { id: 'core', version: '^1.0.0' },
            { id: 'anatomy', version: '^1.0.0' },
            { id: 'positioning', version: '^1.0.0' }
          ]
        },
        files: {
          'components/kissing.component.json': { id: 'intimacy:kissing', dataSchema: { type: 'object' } },
          'components/attraction.component.json': { id: 'intimacy:attraction', dataSchema: { type: 'object' } }
        }
      };

      productionSpec.violence = {
        manifest: { 
          id: 'violence', 
          version: '1.0.0', 
          dependencies: [
            { id: 'core', version: '^1.0.0' },
            { id: 'anatomy', version: '^1.0.0' },
            { id: 'positioning', version: '^1.0.0' }
          ]
        },
        files: {
          'components/health.component.json': { id: 'violence:health', dataSchema: { type: 'object' } },
          'actions/attack.action.json': { 
            id: 'violence:attack',
            required_components: { actor: ['violence:health'], target: ['violence:health'] }
          }
        }
      };

      return this.createRealWorldModEcosystem(baseDir, productionSpec);
    },

    /**
     * Executes CLI commands for integration testing
     * @param {string} scriptName - Script to execute
     * @param {string[]} args - Command arguments
     * @returns {Promise<Object>} Execution result
     */
    async executeCLI(scriptName, args = []) {
      return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'scripts', `${scriptName}.js`);
        const child = spawn('node', [scriptPath, ...args], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'test' }
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({
            exitCode: code,
            output: stdout,
            error: stderr,
            success: code === 0
          });
        });

        child.on('error', reject);

        // Set timeout for long-running operations
        setTimeout(() => {
          child.kill();
          reject(new Error('CLI execution timeout'));
        }, 60000); // 1 minute timeout
      });
    },

    /**
     * Applies file changes to existing ecosystem
     * @param {string} baseDir - Base directory
     * @param {Object} changes - File changes to apply
     * @returns {Promise<string[]>} List of changed file paths
     */
    async applyFileChanges(baseDir, changes) {
      const changedFiles = [];

      for (const [relativePath, content] of Object.entries(changes)) {
        const fullPath = path.join(baseDir, 'data', 'mods', relativePath);
        const dir = path.dirname(fullPath);
        
        await fs.mkdir(dir, { recursive: true });
        
        const fileContent = typeof content === 'string' 
          ? content 
          : JSON.stringify(content, null, 2);
          
        await fs.writeFile(fullPath, fileContent);
        changedFiles.push(fullPath);
      }

      return changedFiles;
    }
  };
}
```

### Performance Integration Tests

```javascript
// tests/integration/validation/performanceIntegration.integration.test.js

describe('Performance Integration Tests', () => {
  describe('Cache Performance Integration', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const testBed = createIntegrationTestBed();
      const tempDir = await testBed.createTempDirectory('cache-performance');
      
      await testBed.createLargeModEcosystem(tempDir, { 
        modCount: 30,
        complexityLevel: 'high'
      });

      const orchestrator = container.resolve(tokens.IPerformanceOptimizedValidationOrchestrator);
      await orchestrator.initialize();

      // Cold run (no cache)
      await orchestrator.clearCache();
      const coldStart = performance.now();
      const coldResults = await orchestrator.validateEcosystem({ enableCaching: true });
      const coldTime = performance.now() - coldStart;

      // Warm run (with cache)
      const warmStart = performance.now();
      const warmResults = await orchestrator.validateEcosystem({ enableCaching: true });
      const warmTime = performance.now() - warmStart;

      // Verify performance improvement
      const improvement = coldTime / warmTime;
      expect(improvement).toBeGreaterThan(2); // At least 2x improvement

      // Verify results consistency
      expect(warmResults.isValid).toBe(coldResults.isValid);
    });
  });

  describe('Parallel Processing Integration', () => {
    it('should scale efficiently with concurrent processing', async () => {
      const testBed = createIntegrationTestBed();
      const tempDir = await testBed.createTempDirectory('parallel-performance');
      
      await testBed.createLargeModEcosystem(tempDir, { modCount: 25 });

      const orchestrator = container.resolve(tokens.IPerformanceOptimizedValidationOrchestrator);
      
      // Sequential processing
      const sequentialStart = performance.now();
      const sequentialResults = await orchestrator.validateEcosystem({ 
        enableParallelProcessing: false,
        maxConcurrency: 1
      });
      const sequentialTime = performance.now() - sequentialStart;

      // Parallel processing
      const parallelStart = performance.now();
      const parallelResults = await orchestrator.validateEcosystem({ 
        enableParallelProcessing: true,
        maxConcurrency: 5
      });
      const parallelTime = performance.now() - parallelStart;

      // Verify performance scaling
      const improvement = sequentialTime / parallelTime;
      expect(improvement).toBeGreaterThan(1.5); // At least 1.5x improvement

      // Verify results consistency
      expect(parallelResults.isValid).toBe(sequentialResults.isValid);
    });
  });

  describe('Memory Management Integration', () => {
    it('should maintain stable memory usage during large operations', async () => {
      const testBed = createIntegrationTestBed();
      const tempDir = await testBed.createTempDirectory('memory-management');
      
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple large validation operations
      for (let i = 0; i < 5; i++) {
        await testBed.createLargeModEcosystem(path.join(tempDir, `ecosystem-${i}`), { 
          modCount: 20 
        });

        const orchestrator = container.resolve(tokens.IPerformanceOptimizedValidationOrchestrator);
        await orchestrator.initialize();
        await orchestrator.validateEcosystem({ enableCaching: true });
        
        // Periodic cleanup
        if (i % 2 === 0) {
          await orchestrator.clearCache();
          if (global.gc) global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (<100MB)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
```

## Testing Infrastructure

### Jest Configuration for Integration Tests

```javascript
// jest.config.integration.js

module.exports = {
  displayName: 'Integration Tests',
  testMatch: [
    '**/tests/integration/**/*.integration.test.js'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/setup.js'
  ],
  testTimeout: 120000, // 2 minutes for integration tests
  maxWorkers: 2, // Limit concurrent workers for integration tests
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/test/**/*.js'
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'html', 'json'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
```

### Integration Test Setup

```javascript
// tests/integration/setup.js - Integration test setup

import { container } from '../../src/dependencyInjection/container.js';
import { registerValidationServices } from '../../src/dependencyInjection/registrations/validationRegistrations.js';
import { registerPerformanceServices } from '../../src/dependencyInjection/registrations/performanceRegistrations.js';

// Global test setup for integration tests
beforeAll(async () => {
  // Initialize dependency injection container
  registerValidationServices(container);
  registerPerformanceServices(container);
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
  
  console.log('Integration test environment initialized');
});

afterAll(async () => {
  // Cleanup global resources
  await container.dispose?.();
  
  console.log('Integration test environment cleaned up');
});

// Global error handling for integration tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process during tests
});
```

### Continuous Integration Enhancement

```yaml
# .github/workflows/integration-tests.yml

name: Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        NODE_ENV: test
        LOG_LEVEL: error
    
    - name: Upload integration test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: integration-test-results-${{ matrix.node-version }}
        path: |
          coverage/integration/
          test-results-integration.xml
    
    - name: Report integration test coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/integration/lcov.info
        flags: integration
        name: integration-coverage-${{ matrix.node-version }}
```

## Success Criteria

- [ ] Complete end-to-end validation workflow tested from file changes to reports
- [ ] Real-world scenarios including actual positioning/intimacy violation reproduced and tested
- [ ] Performance characteristics validated under production-like conditions
- [ ] Error handling and recovery tested with corrupted and problematic mod files
- [ ] CLI integration tested with realistic command-line workflows
- [ ] Caching and performance optimization benefits demonstrated quantitatively
- [ ] Concurrent validation handling verified for stability and consistency
- [ ] Memory management validated to prevent leaks during long operations
- [ ] Integration with existing infrastructure verified to maintain compatibility
- [ ] CI/CD pipeline integration provides automated validation of system integration

## Implementation Notes

### Test Strategy Focus
- **Real-world scenarios**: Test with actual mod structures and violations
- **Production conditions**: Large ecosystems, concurrent access, error conditions
- **End-to-end workflows**: Complete user journeys from trigger to result
- **Performance validation**: Quantitative measurement of optimization benefits

### Test Data Management
- **Realistic ecosystems**: Mirror production mod structures and relationships
- **Violation scenarios**: Include actual and synthetic violation patterns
- **Performance datasets**: Scalable test data for load testing
- **Error scenarios**: Comprehensive error condition coverage

### CI/CD Integration
- **Automated execution**: Run integration tests on every significant change
- **Performance regression detection**: Monitor performance characteristics over time
- **Coverage tracking**: Ensure integration test coverage meets quality standards
- **Artifact preservation**: Save test results and reports for analysis

## Next Steps

After completion:
1. **MODDEPVAL-012**: Add comprehensive error handling and security measures
2. **MODDEPVAL-013**: Create developer documentation and resolve current violation
3. **Performance monitoring**: Set up continuous performance monitoring

## References

- **Integration testing patterns**: Best practices for system-level testing
- **Jest integration testing**: Advanced Jest configuration and utilities
- **Node.js testing**: Memory management and resource cleanup in tests
- **CI/CD testing**: GitHub Actions integration and workflow optimization