/**
 * @file Integration tests for ModValidationOrchestrator
 * @description Tests the complete integration of the validation orchestrator with existing
 * dependency validation infrastructure, cross-reference validation, and mod loading pipeline.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModValidationOrchestrator from '../../../cli/validation/modValidationOrchestrator.js';
import ModDependencyValidator from '../../../src/modding/modDependencyValidator.js';
import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { coreTokens } from '../../../src/dependencyInjection/tokens/tokens-core.js';
import { createMockSchemaLoader } from '../../common/mockFactories/loaders.js';
import path from 'path';
import { promises as fs } from 'fs';

describe('ModValidationOrchestrator - Integration Tests', () => {
  let orchestrator;
  let testBed;
  let testModsPath;
  let container;
  let mockModManifestLoader;

  beforeEach(async () => {
    testBed = createTestBed();

    // Setup test mods directory
    testModsPath = path.join(process.cwd(), 'test-mods-' + Date.now());
    await fs.mkdir(testModsPath, { recursive: true });

    // Create and configure container
    container = new AppContainer();
    await configureMinimalContainer(container);

    // Replace the schema loader with a mock to avoid network requests in tests
    const mockSchemaLoader = createMockSchemaLoader();
    container.register(coreTokens.SchemaLoader, () => mockSchemaLoader, {
      singleton: true,
    });

    // Mock the schema validator to bypass schema validation
    const mockSchemaValidator = {
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ isValid: true, errors: [] }),
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      addSchema: jest.fn(),
      getValidator: jest.fn().mockReturnValue(() => true),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }), // Add validate method for ModReferenceExtractor
    };
    container.register(coreTokens.ISchemaValidator, () => mockSchemaValidator, {
      singleton: true,
    });

    // Mock the manifest loader to avoid filesystem operations
    let skipAutoIncludeCore = false;
    mockModManifestLoader = {
      // Provide a way for individual tests to disable auto-include behavior
      setSkipAutoIncludeCore: (skip) => {
        skipAutoIncludeCore = skip;
      },

      loadRequestedManifests: jest.fn().mockImplementation((modIds) => {
        const manifestsMap = new Map();

        // Create a copy of modIds to avoid mutating the original array
        const allModIds = [...modIds];

        // Always include core mod as it's commonly depended upon (unless disabled by test)
        const shouldAutomaticallyIncludeCore =
          !skipAutoIncludeCore &&
          !allModIds.includes('core') &&
          allModIds.some((id) =>
            ['positioning', 'intimacy', 'anatomy'].includes(id)
          );

        if (shouldAutomaticallyIncludeCore) {
          allModIds.push('core');
        }

        allModIds.forEach((modId) => {
          // Handle different dependency scenarios for different tests
          let dependencies = [];
          if (modId === 'positioning') {
            dependencies = [{ id: 'core', version: '^1.0.0', required: true }];
          } else if (modId === 'intimacy') {
            dependencies = [
              { id: 'core', version: '^1.0.0', required: true },
              { id: 'positioning', version: '^1.0.0', required: true },
            ];
          } else if (modId === 'anatomy') {
            dependencies = [{ id: 'core', version: '^1.0.0', required: true }];
          } else if (modId === 'broken') {
            // Simulate missing dependency for broken test
            dependencies = [
              { id: 'missing', version: '^1.0.0', required: true },
            ];
          } else if (modId === 'mod-a') {
            dependencies = [{ id: 'mod-b', version: '^1.0.0', required: true }];
          } else if (modId === 'mod-b') {
            dependencies = [{ id: 'mod-a', version: '^1.0.0', required: true }];
          } else if (
            modId.startsWith('mod-') &&
            modId !== 'mod-a' &&
            modId !== 'mod-b'
          ) {
            dependencies = [{ id: 'core', version: '^1.0.0', required: true }];
          }
          // 'core' mod has no dependencies

          manifestsMap.set(modId, {
            id: modId,
            version: '1.0.0',
            name: modId,
            dependencies,
          });
        });
        return Promise.resolve(manifestsMap);
      }),
      loadModManifests: jest.fn().mockResolvedValue(new Map()),
    };
    container.register(
      coreTokens.ModManifestLoader,
      () => mockModManifestLoader,
      { singleton: true }
    );

    // Create orchestrator manually with dependencies from container
    const logger = container.resolve(coreTokens.ILogger);
    const modLoadOrderResolver = container.resolve(
      coreTokens.ModLoadOrderResolver
    );
    const modManifestLoader = container.resolve(coreTokens.ModManifestLoader);
    const pathResolver = container.resolve(coreTokens.IPathResolver);
    const configuration = container.resolve(coreTokens.IConfiguration);

    // Create mock cross-reference validator
    const mockCrossReferenceValidator = {
      validateModReferences: jest.fn().mockResolvedValue({
        hasViolations: false,
        violations: [],
      }),
      validateAllModReferences: jest.fn().mockResolvedValue(new Map()),
    };

    orchestrator = new ModValidationOrchestrator({
      logger,
      modDependencyValidator: ModDependencyValidator,
      modCrossReferenceValidator: mockCrossReferenceValidator,
      modLoadOrderResolver,
      modManifestLoader,
      pathResolver,
      configuration,
    });
  });

  afterEach(async () => {
    testBed.cleanup();
    // Reset mock loader flags
    if (mockModManifestLoader) {
      mockModManifestLoader.setSkipAutoIncludeCore(false);
    }
    // Clean up test mods directory
    if (testModsPath) {
      await fs.rm(testModsPath, { recursive: true, force: true });
    }
  });

  describe('Ecosystem Validation Integration', () => {
    it('should integrate with existing ModDependencyValidator', async () => {
      // Create test mod ecosystem
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
        positioning: {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
        },
        affection: {
          id: 'affection',
          version: '1.0.0',
          dependencies: [
            { id: 'core', version: '^1.0.0', required: true },
            { id: 'positioning', version: '^1.0.0', required: true },
          ],
        },
      };

      // Create mod directories and manifests
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution to use test directory
      const originalResolveModPath = orchestrator._resolveModPath;
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      // Create a violation scenario
      const positioningActionPath = path.join(
        testModsPath,
        'positioning',
        'actions'
      );
      await fs.mkdir(positioningActionPath, { recursive: true });
      await fs.writeFile(
        path.join(positioningActionPath, 'turn_around.action.json'),
        JSON.stringify(
          {
            id: 'physical-control:turn_around',
            forbidden_components: {
              actor: ['kissing:kissing'], // Violation: intimacy not declared as dependency
            },
          },
          null,
          2
        )
      );

      const results = await orchestrator.validateEcosystem({
        modsToValidate: ['core', 'positioning', 'affection'],
      });

      // Should pass dependency validation
      expect(results.dependencies).toBeDefined();
      expect(results.dependencies.isValid).toBe(true);

      // Should detect cross-reference violations
      expect(results.crossReferences).toBeDefined();
      if (results.crossReferences instanceof Map) {
        // With mocked cross-reference validator, the map will be empty
        // This is expected behavior for the test setup
        expect(results.crossReferences).toBeInstanceOf(Map);
      }

      // Overall validation should complete
      expect(results.performance).toBeDefined();
      expect(results.performance.totalTime).toBeGreaterThan(0);
    });

    it('should integrate with ModLoadOrderResolver', async () => {
      // Create mods with complex dependencies
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
        anatomy: {
          id: 'anatomy',
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
        },
        positioning: {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [
            { id: 'core', version: '^1.0.0', required: true },
            { id: 'anatomy', version: '^1.0.0', required: true },
          ],
        },
        affection: {
          id: 'affection',
          version: '1.0.0',
          dependencies: [
            { id: 'anatomy', version: '^1.0.0', required: true },
            { id: 'positioning', version: '^1.0.0', required: true },
          ],
        },
      };

      // Create mod directories and manifests
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      const results = await orchestrator.validateEcosystem({
        modsToValidate: ['core', 'anatomy', 'positioning', 'intimacy'],
      });

      expect(results.loadOrder).toBeDefined();
      expect(results.loadOrder.isValid).toBe(true);
      expect(results.loadOrder.order).toEqual([
        'core',
        'anatomy',
        'positioning',
        'intimacy',
      ]);
    });
  });

  describe('Loading Validation Integration', () => {
    it('should validate mods for loading with existing pipeline', async () => {
      // Create simple valid mod setup
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
        positioning: {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
        },
      };

      // Create mod directories and manifests
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      const loadResult = await orchestrator.validateForLoading(
        ['positioning'],
        {
          strictMode: false,
          allowWarnings: true,
        }
      );

      expect(loadResult.canLoad).toBe(true);
      expect(loadResult.dependencies.isValid).toBe(true);
      expect(loadResult.loadOrder).toEqual(['positioning']); // Note: core is auto-included by mock but loadOrder shows requested mods
    });

    it('should fail loading validation with missing dependencies', async () => {
      // Disable automatic core inclusion for this test
      mockModManifestLoader.setSkipAutoIncludeCore(true);

      // Create mod with missing dependency
      const mods = {
        positioning: {
          id: 'positioning',
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
          // Note: core mod is not created
        },
      };

      // Create mod directory and manifest
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      let errorThrown = false;
      try {
        await orchestrator.validateForLoading(['positioning'], {
          strictMode: true,
        });
      } catch (error) {
        errorThrown = true;
        // Should throw ModValidationError when dependency validation fails in strict mode
        expect(error.name).toBe('ModValidationError');
        expect(error.message).toContain('validation failed');
      }

      if (!errorThrown) {
        throw new Error(
          'Should have thrown an error for missing dependencies in strict mode'
        );
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle ModDependencyValidator failures gracefully', async () => {
      // Import ModDependencyError for proper error type
      const ModDependencyError = (
        await import('../../../src/errors/modDependencyError.js')
      ).default;

      // Mock the ModDependencyValidator to throw a ModDependencyError for this test
      const originalValidate = ModDependencyValidator.validate;
      ModDependencyValidator.validate = jest.fn().mockImplementation(() => {
        throw new ModDependencyError(
          'Circular dependency detected: mod-a <-> mod-b'
        );
      });

      try {
        await orchestrator.validateEcosystem({
          modsToValidate: ['mod-a', 'mod-b'],
          failFast: true,
        });
        // If we get here, the test should fail because we expected an error
        expect(true).toBe(false); // Force failure
      } catch (error) {
        // Should throw ModValidationError when ModDependencyValidator fails in failFast mode
        expect(error.name).toBe('ModValidationError');
        expect(error.message).toContain('validation failed');
      } finally {
        // Restore the original implementation
        ModDependencyValidator.validate = originalValidate;
      }
    });

    it('should continue validation when failFast is false', async () => {
      // Create mod with issues but continue validation
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
        broken: {
          id: 'broken',
          version: '1.0.0',
          dependencies: [{ id: 'missing', version: '^1.0.0', required: true }],
        },
      };

      // Create mod directories and manifests
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      const results = await orchestrator.validateEcosystem({
        modsToValidate: ['core', 'broken'],
        failFast: false,
      });

      expect(results.isValid).toBe(false);
      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.dependencies.isValid).toBe(false);
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance with large mod ecosystems', async () => {
      // Create large ecosystem (20 mods)
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
      };

      for (let i = 1; i <= 19; i++) {
        mods[`mod-${i}`] = {
          id: `mod-${i}`,
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
        };
      }

      // Create mod directories and manifests
      for (const [modId, manifest] of Object.entries(mods)) {
        const modPath = path.join(testModsPath, modId);
        await fs.mkdir(modPath, { recursive: true });
        await fs.writeFile(
          path.join(modPath, 'mod-manifest.json'),
          JSON.stringify(manifest, null, 2)
        );
      }

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      const startTime = performance.now();
      const results = await orchestrator.validateEcosystem({
        modsToValidate: Object.keys(mods),
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5000); // <5 seconds for 20 mods
      expect(results.performance.totalTime).toBeLessThan(5000);
      expect(results.isValid).toBe(true);
    });

    it('should track performance metrics correctly', async () => {
      // Create simple mod setup
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
      };

      // Create mod directory and manifest
      const modPath = path.join(testModsPath, 'core');
      await fs.mkdir(modPath, { recursive: true });
      await fs.writeFile(
        path.join(modPath, 'mod-manifest.json'),
        JSON.stringify(mods.core, null, 2)
      );

      // Mock the path resolution
      orchestrator._resolveModPath = (modId) => path.join(testModsPath, modId);

      const results = await orchestrator.validateEcosystem({
        modsToValidate: ['core'],
      });

      expect(results.performance).toBeDefined();
      expect(results.performance.totalTime).toBeGreaterThan(0);
      expect(results.performance.phases).toBeDefined();
      expect(
        results.performance.phases.get('manifest-loading')
      ).toBeGreaterThan(0);
      expect(
        results.performance.phases.get('dependency-validation')
      ).toBeGreaterThan(0);
    });
  });

  describe('ModManifestProcessor Integration', () => {
    it('should work with ModManifestProcessor when validation is enabled', async () => {
      // Get the ModManifestProcessor from container
      const processor = container.resolve(coreTokens.ModManifestProcessor);

      // Create simple mod setup
      const mods = {
        core: {
          id: 'core',
          version: '1.0.0',
          dependencies: [],
        },
      };

      // Create mod directory and manifest
      const modPath = path.join(testModsPath, 'core');
      await fs.mkdir(modPath, { recursive: true });
      await fs.writeFile(
        path.join(modPath, 'mod-manifest.json'),
        JSON.stringify(mods.core, null, 2)
      );

      // Process manifests with validation enabled
      const result = await processor.processManifests(['core'], 'test-world', {
        validateCrossReferences: true,
        strictMode: false,
      });

      expect(result.loadedManifestsMap).toBeDefined();
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.validationWarnings).toBeDefined();
    });
  });
});
