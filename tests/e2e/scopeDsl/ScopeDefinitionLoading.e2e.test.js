/**
 * @file Scope Definition Loading E2E Test Suite
 * @see tests/e2e/scopeDsl/ScopeDefinitionLoading.e2e.test.js
 *
 * This test suite validates .scope file processing in realistic mod scenarios,
 * covering:
 * - Multi-mod scope loading without conflicts
 * - Namespace handling and conflict resolution
 * - Syntax error handling with clear error messages
 * - Partial failure recovery
 * - Multi-line scope definitions
 * - Comment and empty line processing
 *
 * Addresses Priority 2 requirements from ScopeDSL Architecture and E2E Coverage Analysis
 * Coverage: Workflows 1 (parsing) and 2 (registry management)
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ScopeTestUtilities } from '../../common/scopeDsl/scopeTestUtilities.js';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import { ScopeDefinitionError } from '../../../src/scopeDsl/errors/scopeDefinitionError.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * E2E test suite for scope definition loading from .scope files
 * Tests the complete pipeline from file parsing to registry storage
 */
describe('Scope Definition Loading E2E', () => {
  let container;
  let scopeRegistry;
  let scopeLoader;
  let dataRegistry;
  let logger;
  let tempDir;
  let pathResolver;
  let dataFetcher;
  let schemaValidator;

  /**
   * Creates a temporary directory structure for testing mod loading
   *
   * @returns {Promise<string>} Path to the temporary directory
   */
  async function createTempModDirectory() {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scope-test-'));
    return tmpDir;
  }

  /**
   * Creates a mock mod with scope files
   *
   * @param {string} baseDir - Base directory for mods
   * @param {string} modId - Mod identifier
   * @param {Array<{filename: string, content: string}>} scopeFiles - Scope files to create
   * @returns {Promise<string>} Path to the mod directory
   */
  async function createMockMod(baseDir, modId, scopeFiles) {
    const modDir = path.join(baseDir, 'mods', modId);
    const scopesDir = path.join(modDir, 'scopes');

    await fs.mkdir(scopesDir, { recursive: true });

    // Create mod manifest
    const manifest = {
      id: modId,
      name: `Test Mod ${modId}`,
      version: '1.0.0',
      dependencies: [],
    };
    await fs.writeFile(
      path.join(modDir, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create scope files
    for (const scopeFile of scopeFiles) {
      await fs.writeFile(
        path.join(scopesDir, scopeFile.filename),
        scopeFile.content
      );
    }

    return modDir;
  }

  /**
   * Helper to create valid scope file content
   *
   * @param {string} modId - Mod identifier
   * @param {string} scopeName - Name of the scope (without mod prefix)
   * @param {string} expression - DSL expression
   * @param {object} options - Additional options
   * @returns {string} Scope file content
   */
  function createScopeContent(modId, scopeName, expression, options = {}) {
    const { multiline = false, withComments = false } = options;

    let content = '';

    if (withComments) {
      content += '// Test scope definition file\n';
      content += `// Mod: ${modId}\n\n`;
    }

    if (multiline) {
      const parts = expression.split(' ');
      content += `${modId}:${scopeName} := ${parts[0]}\n`;
      for (let i = 1; i < parts.length; i++) {
        content += `    ${parts[i]}${i < parts.length - 1 ? '\n' : ''}`;
      }
    } else {
      content += `${modId}:${scopeName} := ${expression}`;
    }

    if (withComments) {
      content += '\n\n// End of scope definition';
    }

    return content;
  }

  /**
   * Mock data fetcher for testing
   */
  class MockDataFetcher {
    async fetch(path) {
      try {
        const content = await fs.readFile(path, 'utf-8');
        return content;
      } catch (error) {
        throw new Error(`Failed to fetch data from ${path}: ${error.message}`);
      }
    }
  }

  /**
   * Mock path resolver for testing
   */
  class MockPathResolver {
    constructor(baseDir) {
      this.baseDir = baseDir;
    }

    resolvePath(modId, itemType, filename) {
      return path.join(this.baseDir, 'mods', modId, itemType, filename);
    }

    resolveModContentPath(modId, contentType) {
      return path.join(this.baseDir, 'mods', modId, contentType);
    }
  }

  /**
   * Mock configuration for testing
   */
  class MockConfiguration {
    constructor(baseDir) {
      this.baseDir = baseDir;
    }

    getModsBasePath() {
      return path.join(this.baseDir, 'mods');
    }

    getDataPath() {
      return this.baseDir;
    }

    getContentTypeSchemaId(contentType) {
      // Return a mock schema ID for scopes
      if (contentType === 'scopes') {
        return 'scope.schema.json';
      }
      return `${contentType}.schema.json`;
    }
  }

  // ONE-TIME container setup (expensive - 700-900ms)
  // Shared across all tests for performance
  beforeAll(async () => {
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get real services from container
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    dataRegistry = container.resolve(tokens.IDataRegistry);
    logger = container.resolve(tokens.ILogger);
    schemaValidator = container.resolve(tokens.ISchemaValidator);
  });

  // PER-TEST setup (fast - ~50-100ms)
  beforeEach(async () => {
    // Clear shared registries to ensure test isolation
    scopeRegistry.clear();
    dataRegistry.clear();

    // Create temporary directory for test mods
    tempDir = await createTempModDirectory();

    // Create mock services for file operations
    const mockConfig = new MockConfiguration(tempDir);
    pathResolver = new MockPathResolver(tempDir);
    dataFetcher = new MockDataFetcher();

    // Create scope loader instance
    scopeLoader = new ScopeLoader(
      mockConfig,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Scenario 1: Multi-Mod Scope Loading
   * Tests loading scopes from multiple mods without conflicts
   */
  describe('Multi-Mod Scope Loading', () => {
    test('should load scopes from multiple mods without conflicts', async () => {
      // Create multiple mods with different scopes
      const mod1Files = [
        {
          filename: 'basic_scopes.scope',
          content: createScopeContent('mod1', 'actors', 'entities(core:actor)'),
        },
        {
          filename: 'location_scopes.scope',
          content: createScopeContent('mod1', 'current_location', 'location'),
        },
      ];

      const mod2Files = [
        {
          filename: 'combat_scopes.scope',
          content: createScopeContent(
            'mod2',
            'enemies',
            'entities(core:actor)[{"var": "entity.components.core:faction.hostile", "==": true}]'
          ),
        },
        {
          filename: 'ally_scopes.scope',
          content: createScopeContent(
            'mod2',
            'allies',
            'entities(core:actor)[{"var": "entity.components.core:faction.allied", "==": true}]'
          ),
        },
      ];

      await createMockMod(tempDir, 'mod1', mod1Files);
      await createMockMod(tempDir, 'mod2', mod2Files);

      // Load scopes from both mods
      const scopeDefinitions = {};

      // Process mod1 scopes
      for (const scopeFile of mod1Files) {
        const resolvedPath = pathResolver.resolvePath(
          'mod1',
          'scopes',
          scopeFile.filename
        );
        const content = await dataFetcher.fetch(resolvedPath);
        await scopeLoader._processFetchedItem(
          'mod1',
          scopeFile.filename,
          resolvedPath,
          content,
          'scopes'
        );
      }

      // Process mod2 scopes
      for (const scopeFile of mod2Files) {
        const resolvedPath = pathResolver.resolvePath(
          'mod2',
          'scopes',
          scopeFile.filename
        );
        const content = await dataFetcher.fetch(resolvedPath);
        await scopeLoader._processFetchedItem(
          'mod2',
          scopeFile.filename,
          resolvedPath,
          content,
          'scopes'
        );
      }

      // Verify all scopes were loaded correctly
      const mod1Actors = dataRegistry.get('scopes', 'mod1:actors');
      expect(mod1Actors).toBeDefined();
      expect(mod1Actors.expr).toBe('entities(core:actor)');
      expect(mod1Actors.ast).toBeDefined();
      expect(mod1Actors.modId).toBe('mod1');

      const mod1Location = dataRegistry.get('scopes', 'mod1:current_location');
      expect(mod1Location).toBeDefined();
      expect(mod1Location.expr).toBe('location');
      expect(mod1Location.ast).toBeDefined();

      const mod2Enemies = dataRegistry.get('scopes', 'mod2:enemies');
      expect(mod2Enemies).toBeDefined();
      expect(mod2Enemies.expr).toContain('hostile');
      expect(mod2Enemies.ast).toBeDefined();
      expect(mod2Enemies.modId).toBe('mod2');

      const mod2Allies = dataRegistry.get('scopes', 'mod2:allies');
      expect(mod2Allies).toBeDefined();
      expect(mod2Allies.expr).toContain('allied');
      expect(mod2Allies.ast).toBeDefined();
    });

    test('should handle scope dependencies between mods', async () => {
      // Create mod1 with base scopes
      const mod1Files = [
        {
          filename: 'base_scopes.scope',
          content: createScopeContent(
            'mod1',
            'base_actors',
            'entities(core:actor)'
          ),
        },
      ];

      // Create mod2 that might reference mod1 concepts (though scopes themselves don't directly reference each other)
      const mod2Files = [
        {
          filename: 'extended_scopes.scope',
          content: createScopeContent(
            'mod2',
            'special_actors',
            'entities(core:actor)[{"var": "entity.components.mod1:special", "==": true}]'
          ),
        },
      ];

      await createMockMod(tempDir, 'mod1', mod1Files);
      await createMockMod(tempDir, 'mod2', mod2Files);

      // Load scopes from both mods
      for (const scopeFile of mod1Files) {
        const resolvedPath = pathResolver.resolvePath(
          'mod1',
          'scopes',
          scopeFile.filename
        );
        const content = await dataFetcher.fetch(resolvedPath);
        await scopeLoader._processFetchedItem(
          'mod1',
          scopeFile.filename,
          resolvedPath,
          content,
          'scopes'
        );
      }

      for (const scopeFile of mod2Files) {
        const resolvedPath = pathResolver.resolvePath(
          'mod2',
          'scopes',
          scopeFile.filename
        );
        const content = await dataFetcher.fetch(resolvedPath);
        await scopeLoader._processFetchedItem(
          'mod2',
          scopeFile.filename,
          resolvedPath,
          content,
          'scopes'
        );
      }

      // Verify both scopes loaded successfully
      const mod1BaseActors = dataRegistry.get('scopes', 'mod1:base_actors');
      expect(mod1BaseActors).toBeDefined();

      const mod2SpecialActors = dataRegistry.get(
        'scopes',
        'mod2:special_actors'
      );
      expect(mod2SpecialActors).toBeDefined();
      expect(mod2SpecialActors.expr).toContain('mod1:special');
    });

    test('should handle multi-line scope definitions correctly', async () => {
      const multilineFiles = [
        {
          filename: 'multiline_scopes.scope',
          content: createScopeContent(
            'testmod',
            'complex_scope',
            'location.locations:exits[ { "condition_ref": "movement:exit-is-unblocked" } ].target',
            { multiline: true }
          ),
        },
      ];

      await createMockMod(tempDir, 'testmod', multilineFiles);

      const resolvedPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        multilineFiles[0].filename
      );
      const content = await dataFetcher.fetch(resolvedPath);
      await scopeLoader._processFetchedItem(
        'testmod',
        multilineFiles[0].filename,
        resolvedPath,
        content,
        'scopes'
      );

      const complexScope = dataRegistry.get('scopes', 'testmod:complex_scope');
      expect(complexScope).toBeDefined();
      expect(complexScope.expr).toBe(
        'location.locations:exits[ { "condition_ref": "movement:exit-is-unblocked" } ].target'
      );
      expect(complexScope.ast).toBeDefined();
      expect(complexScope.ast.type).toBe('Step'); // Should be a step node
    });

    test('should ignore comments and empty lines', async () => {
      const filesWithComments = [
        {
          filename: 'commented_scopes.scope',
          content: createScopeContent(
            'testmod',
            'actors_with_comments',
            'entities(core:actor)',
            { withComments: true }
          ),
        },
      ];

      await createMockMod(tempDir, 'testmod', filesWithComments);

      const resolvedPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        filesWithComments[0].filename
      );
      const content = await dataFetcher.fetch(resolvedPath);
      await scopeLoader._processFetchedItem(
        'testmod',
        filesWithComments[0].filename,
        resolvedPath,
        content,
        'scopes'
      );

      const scope = dataRegistry.get('scopes', 'testmod:actors_with_comments');
      expect(scope).toBeDefined();
      expect(scope.expr).toBe('entities(core:actor)');
      expect(scope.ast).toBeDefined();
    });
  });

  /**
   * Scenario 2: Error Handling in Scope Loading
   * Tests syntax error handling and recovery
   */
  describe('Error Handling in Scope Loading', () => {
    test('should provide clear errors for syntax failures', async () => {
      // Create scope files with various syntax errors
      const errorFiles = [
        {
          filename: 'invalid_syntax.scope',
          content: 'invalid syntax without := operator',
        },
        {
          filename: 'malformed_expression.scope',
          content: 'testmod:broken := entities(((]]]',
        },
        {
          filename: 'wrong_namespace.scope',
          content: 'othermod:wrong_mod := actor', // This will test the namespace validation
        },
      ];

      await createMockMod(tempDir, 'testmod', errorFiles);

      // Test invalid syntax error
      const invalidSyntaxPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        errorFiles[0].filename
      );
      const invalidSyntaxContent = await dataFetcher.fetch(invalidSyntaxPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          errorFiles[0].filename,
          invalidSyntaxPath,
          invalidSyntaxContent,
          'scopes'
        )
      ).rejects.toThrow('Invalid scope definition format');

      // Test malformed expression error
      const malformedPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        errorFiles[1].filename
      );
      const malformedContent = await dataFetcher.fetch(malformedPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          errorFiles[1].filename,
          malformedPath,
          malformedContent,
          'scopes'
        )
      ).rejects.toThrow();

      // Test namespace ownership error
      const wrongNamespacePath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        errorFiles[2].filename
      );
      const wrongNamespaceContent = await dataFetcher.fetch(wrongNamespacePath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          errorFiles[2].filename,
          wrongNamespacePath,
          wrongNamespaceContent,
          'scopes'
        )
      ).rejects.toThrow('claims to belong to mod');
    });

    test('should continue loading valid scopes after errors', async () => {
      // Create a mix of valid and invalid scope files
      const mixedFiles = [
        {
          filename: 'valid_scope_1.scope',
          content: createScopeContent(
            'testmod',
            'valid_actors',
            'entities(core:actor)'
          ),
        },
        {
          filename: 'invalid_scope.scope',
          content: 'this is invalid syntax',
        },
        {
          filename: 'valid_scope_2.scope',
          content: createScopeContent('testmod', 'valid_location', 'location'),
        },
      ];

      await createMockMod(tempDir, 'testmod', mixedFiles);

      // Load first valid scope
      const validPath1 = pathResolver.resolvePath(
        'testmod',
        'scopes',
        mixedFiles[0].filename
      );
      const validContent1 = await dataFetcher.fetch(validPath1);
      await scopeLoader._processFetchedItem(
        'testmod',
        mixedFiles[0].filename,
        validPath1,
        validContent1,
        'scopes'
      );

      // Try to load invalid scope (should fail)
      const invalidPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        mixedFiles[1].filename
      );
      const invalidContent = await dataFetcher.fetch(invalidPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          mixedFiles[1].filename,
          invalidPath,
          invalidContent,
          'scopes'
        )
      ).rejects.toThrow();

      // Load second valid scope (should succeed)
      const validPath2 = pathResolver.resolvePath(
        'testmod',
        'scopes',
        mixedFiles[2].filename
      );
      const validContent2 = await dataFetcher.fetch(validPath2);
      await scopeLoader._processFetchedItem(
        'testmod',
        mixedFiles[2].filename,
        validPath2,
        validContent2,
        'scopes'
      );

      // Verify valid scopes were loaded
      const validActors = dataRegistry.get('scopes', 'testmod:valid_actors');
      expect(validActors).toBeDefined();
      expect(validActors.expr).toBe('entities(core:actor)');

      const validLocation = dataRegistry.get(
        'scopes',
        'testmod:valid_location'
      );
      expect(validLocation).toBeDefined();
      expect(validLocation.expr).toBe('location');
    });

    test('should handle empty or comment-only files gracefully', async () => {
      const emptyFiles = [
        {
          filename: 'empty.scope',
          content: '',
        },
        {
          filename: 'comments_only.scope',
          content: '// Just comments\n// Nothing else\n\n// More comments',
        },
      ];

      await createMockMod(tempDir, 'testmod', emptyFiles);

      // Test empty file
      const emptyPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        emptyFiles[0].filename
      );
      const emptyContent = await dataFetcher.fetch(emptyPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          emptyFiles[0].filename,
          emptyPath,
          emptyContent,
          'scopes'
        )
      ).rejects.toThrow('empty or contains only comments');

      // Test comment-only file
      const commentsPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        emptyFiles[1].filename
      );
      const commentsContent = await dataFetcher.fetch(commentsPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          emptyFiles[1].filename,
          commentsPath,
          commentsContent,
          'scopes'
        )
      ).rejects.toThrow('empty or contains only comments');
    });

    test('should validate mod namespace ownership', async () => {
      // Create a scope that claims to belong to a different mod
      const wrongModFiles = [
        {
          filename: 'wrong_mod.scope',
          content: 'othermod:some_scope := actor',
        },
      ];

      await createMockMod(tempDir, 'testmod', wrongModFiles);

      const wrongModPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        wrongModFiles[0].filename
      );
      const wrongModContent = await dataFetcher.fetch(wrongModPath);

      await expect(
        scopeLoader._processFetchedItem(
          'testmod',
          wrongModFiles[0].filename,
          wrongModPath,
          wrongModContent,
          'scopes'
        )
      ).rejects.toThrow("claims to belong to mod 'othermod'");
    });
  });

  /**
   * Edge Cases and Advanced Scenarios
   * Tests complex edge cases in scope loading
   */
  describe('Edge Cases and Advanced Scenarios', () => {
    test('should handle complex nested DSL expressions', async () => {
      const complexFiles = [
        {
          filename: 'complex_nested.scope',
          content: createScopeContent(
            'testmod',
            'complex_filter',
            'entities(core:actor)[{"condition_ref": "test:level-above-threshold"}]'
          ),
        },
      ];

      await createMockMod(tempDir, 'testmod', complexFiles);

      const complexPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        complexFiles[0].filename
      );
      const complexContent = await dataFetcher.fetch(complexPath);
      await scopeLoader._processFetchedItem(
        'testmod',
        complexFiles[0].filename,
        complexPath,
        complexContent,
        'scopes'
      );

      const complexScope = dataRegistry.get('scopes', 'testmod:complex_filter');
      expect(complexScope).toBeDefined();
      expect(complexScope.ast).toBeDefined();
      expect(complexScope.ast.type).toBe('Filter'); // Should parse as a filter node
    });

    test('should handle multiple scopes in a single file', async () => {
      const multiScopeContent = `testmod:scope1 := actor
testmod:scope2 := location
testmod:scope3 := entities(core:actor)`;

      const multiScopeFiles = [
        {
          filename: 'multiple_scopes.scope',
          content: multiScopeContent,
        },
      ];

      await createMockMod(tempDir, 'testmod', multiScopeFiles);

      const multiPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        multiScopeFiles[0].filename
      );
      const multiContent = await dataFetcher.fetch(multiPath);
      await scopeLoader._processFetchedItem(
        'testmod',
        multiScopeFiles[0].filename,
        multiPath,
        multiContent,
        'scopes'
      );

      // Verify all three scopes were loaded
      const scope1 = dataRegistry.get('scopes', 'testmod:scope1');
      expect(scope1).toBeDefined();
      expect(scope1.expr).toBe('actor');

      const scope2 = dataRegistry.get('scopes', 'testmod:scope2');
      expect(scope2).toBeDefined();
      expect(scope2.expr).toBe('location');

      const scope3 = dataRegistry.get('scopes', 'testmod:scope3');
      expect(scope3).toBeDefined();
      expect(scope3.expr).toBe('entities(core:actor)');
    });

    test('should preserve AST structure correctly', async () => {
      const astFiles = [
        {
          filename: 'ast_preservation.scope',
          content: createScopeContent(
            'testmod',
            'step_filter',
            'location.locations:exits[{"var": "blocked", "==": false}]'
          ),
        },
      ];

      await createMockMod(tempDir, 'testmod', astFiles);

      const astPath = pathResolver.resolvePath(
        'testmod',
        'scopes',
        astFiles[0].filename
      );
      const astContent = await dataFetcher.fetch(astPath);
      await scopeLoader._processFetchedItem(
        'testmod',
        astFiles[0].filename,
        astPath,
        astContent,
        'scopes'
      );

      const scope = dataRegistry.get('scopes', 'testmod:step_filter');
      expect(scope).toBeDefined();
      expect(scope.ast).toBeDefined();
      expect(scope.ast.type).toBe('Filter');
      expect(scope.ast.parent).toBeDefined();
      expect(scope.ast.parent.type).toBe('Step');
    });
  });

  /**
   * Performance and Integration Tests
   * Validates performance characteristics of scope loading
   */
  describe('Performance and Integration', () => {
    test('should load multiple scope files efficiently', async () => {
      // Create many scope files to test loading performance
      const scopeFiles = [];
      for (let i = 0; i < 20; i++) {
        scopeFiles.push({
          filename: `scope_${i}.scope`,
          content: createScopeContent(
            'perftest',
            `scope_${i}`,
            `entities(core:actor)[{"var": "id", "!=": "${i}"}]`
          ),
        });
      }

      await createMockMod(tempDir, 'perftest', scopeFiles);

      const startTime = Date.now();

      // Load all scopes
      for (const scopeFile of scopeFiles) {
        const scopePath = pathResolver.resolvePath(
          'perftest',
          'scopes',
          scopeFile.filename
        );
        const scopeContent = await dataFetcher.fetch(scopePath);
        await scopeLoader._processFetchedItem(
          'perftest',
          scopeFile.filename,
          scopePath,
          scopeContent,
          'scopes'
        );
      }

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should complete in reasonable time
      expect(loadTime).toBeLessThan(1000); // Less than 1 second for 20 files

      // Verify all scopes were loaded
      for (let i = 0; i < 20; i++) {
        const scope = dataRegistry.get('scopes', `perftest:scope_${i}`);
        expect(scope).toBeDefined();
      }
    });

    test('should integrate correctly with scope registry', async () => {
      // Create test scopes
      const integrationFiles = [
        {
          filename: 'registry_test.scope',
          content: createScopeContent(
            'integration',
            'test_actors',
            'entities(core:actor)'
          ),
        },
      ];

      await createMockMod(tempDir, 'integration', integrationFiles);

      const integrationPath = pathResolver.resolvePath(
        'integration',
        'scopes',
        integrationFiles[0].filename
      );
      const integrationContent = await dataFetcher.fetch(integrationPath);
      await scopeLoader._processFetchedItem(
        'integration',
        integrationFiles[0].filename,
        integrationPath,
        integrationContent,
        'scopes'
      );

      // Initialize scope registry with loaded scopes
      const allScopes = {};
      const scope = dataRegistry.get('scopes', 'integration:test_actors');
      if (scope) {
        allScopes['integration:test_actors'] = {
          id: 'integration:test_actors',
          expr: scope.expr,
          ast: scope.ast,
          description: 'Test scope for integration',
        };
      }

      scopeRegistry.initialize(allScopes);

      // Verify scope can be retrieved from registry
      const registryScope = scopeRegistry.getScope('integration:test_actors');
      expect(registryScope).toBeDefined();
      expect(registryScope.expr).toBe('entities(core:actor)');

      const registryAst = scopeRegistry.getScopeAst('integration:test_actors');
      expect(registryAst).toBeDefined();
      expect(registryAst.type).toBe('Source');
    });
  });
});
