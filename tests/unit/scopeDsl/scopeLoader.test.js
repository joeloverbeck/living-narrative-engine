import { jest } from '@jest/globals';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';

// Mock the parser utility at the top level. This is hoisted by Jest.
jest.mock('../../../src/scopeDsl/scopeDefinitionParser.js', () => ({
  parseScopeDefinitions: jest.fn(),
}));

// Mock the lower-level parser for specific error simulation.
// FIX: Corrected typo 'parseDslExpression' to 'parseDslExpression'
jest.mock('../../../src/scopeDsl/parser/parser.js', () => ({
  parseDslExpression: jest.fn(),
}));

describe('ScopeLoader', () => {
  let loader;
  let mockParseScopeDefinitions;
  let mockDependencies;

  // Get the REAL implementation of the parser utility once using requireActual.
  const { parseScopeDefinitions: realParseScopeDefinitions } =
    jest.requireActual('../../../src/scopeDsl/scopeDefinitionParser.js');

  // Get the REAL implementation of the lower-level parser.
  const { parseDslExpression: realParseDslExpression } = jest.requireActual(
    '../../../src/scopeDsl/parser/parser.js'
  );

  // Get the MOCKED function. This will be used to control mock behavior.
  const {
    parseDslExpression,
  } = require('../../../src/scopeDsl/parser/parser.js');

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock function from the mocked module for each test.
    mockParseScopeDefinitions =
      require('../../../src/scopeDsl/scopeDefinitionParser.js').parseScopeDefinitions;

    mockDependencies = {
      config: {
        getModsBasePath: jest.fn(),
        getContentTypeSchemaId: jest.fn().mockReturnValue(null),
      },
      pathResolver: { resolveModContentPath: jest.fn() },
      dataFetcher: { fetch: jest.fn() },
      schemaValidator: {
        validate: jest.fn(),
        getValidator: jest.fn(),
        isSchemaLoaded: jest.fn(),
      },
      dataRegistry: {
        store: jest.fn(),
        get: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
    };

    loader = new ScopeLoader(
      mockDependencies.config,
      mockDependencies.pathResolver,
      mockDependencies.dataFetcher,
      mockDependencies.schemaValidator,
      mockDependencies.dataRegistry,
      mockDependencies.logger
    );
  });

  // These are the unit tests that rely on the mocked implementation.
  describe('parseScopeFile (Unit)', () => {
    test('should delegate parsing to scopeDefinitionParser utility', () => {
      const content = `inventory_items := actor.inventory.items[]`;
      const filePath = 'test.scope';
      const expectedMap = new Map([
        [
          'inventory_items',
          { expr: 'actor.inventory.items[]', ast: { type: 'mock' } },
        ],
      ]);

      mockParseScopeDefinitions.mockReturnValue(expectedMap);

      const result = loader.parseScopeFile(content, filePath);

      expect(mockParseScopeDefinitions).toHaveBeenCalledWith(content, filePath);
      expect(result).toBe(expectedMap);
    });
  });

  describe('transformContent (Unit)', () => {
    test('should transform scope definitions that are already properly namespaced', () => {
      const parsedContent = new Map([
        [
          'core:inventory_items',
          { expr: 'actor.inventory.items[]', ast: { type: 'mock' } },
        ],
        [
          'core:equipment_items',
          { expr: 'actor.equipment.equipped[]', ast: { type: 'mock' } },
        ],
      ]);

      const result = loader.transformContent(parsedContent, 'core');

      expect(result).toEqual({
        'core:inventory_items': {
          name: 'core:inventory_items',
          expr: 'actor.inventory.items[]',
          ast: { type: 'mock' },
          modId: 'core',
          source: 'file',
        },
        'core:equipment_items': {
          name: 'core:equipment_items',
          expr: 'actor.equipment.equipped[]',
          ast: { type: 'mock' },
          modId: 'core',
          source: 'file',
        },
      });
    });

    test('should handle custom mod IDs with properly namespaced scopes', () => {
      const parsedContent = new Map([
        [
          'myMod:custom_scope',
          { expr: 'location.entities(core:Item)', ast: { type: 'mock' } },
        ],
      ]);
      const result = loader.transformContent(parsedContent, 'myMod');
      expect(result).toEqual({
        'myMod:custom_scope': {
          name: 'myMod:custom_scope',
          expr: 'location.entities(core:Item)',
          ast: { type: 'mock' },
          modId: 'myMod',
          source: 'file',
        },
      });
    });

    test('should handle an empty map of parsed content', () => {
      const parsedContent = new Map();
      const result = loader.transformContent(parsedContent, 'testMod');
      expect(result).toEqual({});
    });

    test('should reject non-namespaced scope names', () => {
      const parsedContent = new Map([
        [
          'inventory_items',
          { expr: 'actor.inventory.items[]', ast: { type: 'mock' } },
        ],
      ]);

      expect(() => loader.transformContent(parsedContent, 'core')).toThrow(
        "Scope 'inventory_items' must be namespaced (e.g., 'core:inventory_items'). Only 'none' and 'self' are allowed without namespace."
      );
    });

    test('should reject scopes with wrong namespace', () => {
      const parsedContent = new Map([
        [
          'wrong:inventory_items',
          { expr: 'actor.inventory.items[]', ast: { type: 'mock' } },
        ],
      ]);

      expect(() => loader.transformContent(parsedContent, 'core')).toThrow(
        "Scope 'wrong:inventory_items' is declared in mod 'core' but claims to belong to mod 'wrong'. Scope names must match the mod they're defined in."
      );
    });
  });

  describe('_processFetchedItem (Unit)', () => {
    const modId = 'core';
    const filename = 'test.scope';
    const registryKey = 'scopes';
    const resolvedPath = '/mods/core/scopes/test.scope';

    test('should process, transform, and store each scope returning the last result', async () => {
      const parsedMap = new Map([
        ['core:first_scope', { expr: 'expr1', ast: { type: 'ast1' } }],
        ['core:second_scope', { expr: 'expr2', ast: { type: 'ast2' } }],
      ]);
      const transformedScopes = {
        'core:first_scope': {
          name: 'core:first_scope',
          expr: 'expr1',
          ast: { type: 'ast1' },
        },
        'core:second_scope': {
          name: 'core:second_scope',
          expr: 'expr2',
          ast: { type: 'ast2' },
        },
      };
      jest.spyOn(loader, 'parseScopeFile').mockReturnValue(parsedMap);
      jest.spyOn(loader, 'transformContent').mockReturnValue(transformedScopes);

      const storeSpy = jest
        .spyOn(loader, '_storeItemInRegistry')
        .mockImplementation((category, mod, baseId) => {
          if (baseId === 'first_scope') {
            return { qualifiedId: `${mod}:first_scope`, didOverride: false };
          }
          if (baseId === 'second_scope') {
            return { qualifiedId: `${mod}:second_scope`, didOverride: true };
          }
          throw new Error(`Unexpected baseId ${baseId}`);
        });

      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        'raw scope content',
        registryKey
      );

      expect(loader.parseScopeFile).toHaveBeenCalledWith(
        'raw scope content',
        filename
      );
      expect(loader.transformContent).toHaveBeenCalledWith(parsedMap, modId);
      expect(storeSpy).toHaveBeenNthCalledWith(
        1,
        registryKey,
        modId,
        'first_scope',
        transformedScopes['core:first_scope'],
        filename
      );
      expect(storeSpy).toHaveBeenNthCalledWith(
        2,
        registryKey,
        modId,
        'second_scope',
        transformedScopes['core:second_scope'],
        filename
      );
      expect(result).toEqual({
        qualifiedId: `${modId}:second_scope`,
        didOverride: true,
      });
    });

    test('should return default result when no scopes are produced', async () => {
      jest
        .spyOn(loader, 'parseScopeFile')
        .mockReturnValue(
          new Map([['core:orphan_scope', { expr: 'noop', ast: {} }]])
        );
      jest.spyOn(loader, 'transformContent').mockReturnValue({});
      const storeSpy = jest.spyOn(loader, '_storeItemInRegistry');

      const result = await loader._processFetchedItem(
        modId,
        filename,
        resolvedPath,
        'noop content',
        registryKey
      );

      expect(storeSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ qualifiedId: null, didOverride: false });
    });

    test('should log and rethrow errors encountered during processing', async () => {
      const failure = new Error('Parsing failure');
      jest.spyOn(loader, 'parseScopeFile').mockImplementation(() => {
        throw failure;
      });

      await expect(
        loader._processFetchedItem(
          modId,
          filename,
          resolvedPath,
          'failing content',
          registryKey
        )
      ).rejects.toThrow(failure);

      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'ScopeLoader: Failed to process scope file test.scope for mod core: Parsing failure'
        ),
        {
          modId,
          filename,
          error: failure,
        }
      );
    });
  });

  // This suite tests the loader's interaction with the REAL parser utility.
  describe('Integration with scopeDefinitionParser', () => {
    // FIX: For this suite, set the mock's implementation to the real one.
    beforeAll(() => {
      mockParseScopeDefinitions.mockImplementation(realParseScopeDefinitions);
      // We also need to use the real implementation for the lower-level parser,
      // as the real scopeDefinitionParser depends on it.
      parseDslExpression.mockImplementation(realParseDslExpression);
    });

    // FIX: After the suite, restore the mock to its original state (an empty jest.fn()).
    afterAll(() => {
      mockParseScopeDefinitions.mockRestore();
      parseDslExpression.mockRestore();
    });

    test('should parse valid namespaced scope definitions', () => {
      const content = `
        core:inventory_items := actor.inventory.items[]
        core:equipment_items := actor.equipment.equipped[]
        core:followers := actor.followers[]
      `;
      // loader.parseScopeFile now calls the real parser via the mock's implementation
      const result = loader.parseScopeFile(content, 'test.scope');
      const entries = Object.fromEntries(result);
      expect(entries['core:inventory_items'].expr).toBe(
        'actor.inventory.items[]'
      );
      expect(entries['core:equipment_items'].expr).toBe(
        'actor.equipment.equipped[]'
      );
      expect(entries['core:followers'].expr).toBe('actor.followers[]');
      // Verify ASTs are present
      expect(entries['core:inventory_items'].ast).toBeDefined();
      expect(entries['core:equipment_items'].ast).toBeDefined();
      expect(entries['core:followers'].ast).toBeDefined();
    });

    test('should handle comments and empty lines', () => {
      const content = `
        // Comment
        core:inventory_items := actor.inventory.items[]

        core:equipment_items := actor.equipment.equipped[]
      `;
      const result = loader.parseScopeFile(content, 'test.scope');
      const entries = Object.fromEntries(result);
      expect(entries['core:inventory_items'].expr).toBe(
        'actor.inventory.items[]'
      );
      expect(entries['core:equipment_items'].expr).toBe(
        'actor.equipment.equipped[]'
      );
      // Verify ASTs are present
      expect(entries['core:inventory_items'].ast).toBeDefined();
      expect(entries['core:equipment_items'].ast).toBeDefined();
    });

    test('should throw error for empty file', () => {
      const content = `// Only comments`;
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow('Scope file is empty or contains only comments: test.scope');
    });

    test('should throw error for invalid format', () => {
      const content = `core:inventory_items = actor.inventory.items[]`;
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow('Invalid scope definition format in test.scope:');
    });

    test('should throw error for invalid DSL expression', () => {
      const content = `core:inventory_items := invalid dsl expression`;

      // The real parser will throw a ScopeSyntaxError, so we don't need to mock it
      // to throw a generic error anymore. The beforeAll hook has already set it to the real implementation.
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow(
        'Invalid DSL expression in test.scope for scope "core:inventory_items":'
      );
    });
  });

  describe('constructor', () => {
    test('should configure with correct content type', () => {
      expect(loader._primarySchemaId).toBe(null);
    });
  });
});
