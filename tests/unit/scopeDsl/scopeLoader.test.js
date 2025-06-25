import { jest } from '@jest/globals';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';

// Mock the parser utility at the top level. This is hoisted by Jest.
jest.mock('../../../src/scopeDsl/scopeDefinitionParser.js', () => ({
  parseScopeDefinitions: jest.fn(),
}));

// Mock the lower-level parser for specific error simulation.
// FIX: Corrected typo 'parseDslExpression' to 'parseDslExpression'
jest.mock('../../../src/scopeDsl/parser.js', () => ({
  parseDslExpression: jest.fn(),
}));

describe('ScopeLoader', () => {
  let loader;
  let mockParseScopeDefinitions;

  // Get the REAL implementation of the parser utility once using requireActual.
  const { parseScopeDefinitions: realParseScopeDefinitions } =
    jest.requireActual('../../../src/scopeDsl/scopeDefinitionParser.js');

  // Get the REAL implementation of the lower-level parser.
  const { parseDslExpression: realParseDslExpression } = jest.requireActual(
    '../../../src/scopeDsl/parser.js'
  );

  // Get the MOCKED function. This will be used to control mock behavior.
  const { parseDslExpression } = require('../../../src/scopeDsl/parser.js');

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock function from the mocked module for each test.
    mockParseScopeDefinitions =
      require('../../../src/scopeDsl/scopeDefinitionParser.js').parseScopeDefinitions;

    const mockDependencies = {
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
        ['inventory_items', 'actor.inventory.items[]'],
      ]);

      mockParseScopeDefinitions.mockReturnValue(expectedMap);

      const result = loader.parseScopeFile(content, filePath);

      expect(mockParseScopeDefinitions).toHaveBeenCalledWith(content, filePath);
      expect(result).toBe(expectedMap);
    });
  });

  describe('transformContent (Unit)', () => {
    test('should transform scope definitions with mod prefix', () => {
      const parsedContent = new Map([
        ['inventory_items', 'actor.inventory.items[]'],
        ['equipment_items', 'actor.equipment.equipped[]'],
      ]);

      const result = loader.transformContent(parsedContent, 'core');

      expect(result).toEqual({
        'core:inventory_items': {
          name: 'core:inventory_items',
          expr: 'actor.inventory.items[]',
          modId: 'core',
          source: 'file',
        },
        'core:equipment_items': {
          name: 'core:equipment_items',
          expr: 'actor.equipment.equipped[]',
          modId: 'core',
          source: 'file',
        },
      });
    });

    test('should handle custom mod IDs', () => {
      const parsedContent = new Map([
        ['custom_scope', 'location.entities(core:Item)'],
      ]);
      const result = loader.transformContent(parsedContent, 'myMod');
      expect(result).toEqual({
        'myMod:custom_scope': {
          name: 'myMod:custom_scope',
          expr: 'location.entities(core:Item)',
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

    test('should parse valid scope definitions', () => {
      const content = `
        inventory_items := actor.inventory.items[]
        equipment_items := actor.equipment.equipped[]
        followers := actor.followers[]
      `;
      // loader.parseScopeFile now calls the real parser via the mock's implementation
      const result = loader.parseScopeFile(content, 'test.scope');
      expect(Object.fromEntries(result)).toEqual({
        inventory_items: 'actor.inventory.items[]',
        equipment_items: 'actor.equipment.equipped[]',
        followers: 'actor.followers[]',
      });
    });

    test('should handle comments and empty lines', () => {
      const content = `
        // Comment
        inventory_items := actor.inventory.items[]

        equipment_items := actor.equipment.equipped[]
      `;
      const result = loader.parseScopeFile(content, 'test.scope');
      expect(Object.fromEntries(result)).toEqual({
        inventory_items: 'actor.inventory.items[]',
        equipment_items: 'actor.equipment.equipped[]',
      });
    });

    test('should throw error for empty file', () => {
      const content = `// Only comments`;
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow('Scope file is empty or contains only comments: test.scope');
    });

    test('should throw error for invalid format', () => {
      const content = `inventory_items = actor.inventory.items[]`;
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow(
        'Invalid scope definition format in test.scope: "inventory_items = actor.inventory.items[]". Expected "name := dsl_expression"'
      );
    });

    test('should throw error for invalid DSL expression', () => {
      const content = `inventory_items := invalid dsl expression`;

      // The real parser will throw a ScopeSyntaxError, so we don't need to mock it
      // to throw a generic error anymore. The beforeAll hook has already set it to the real implementation.
      expect(() => {
        loader.parseScopeFile(content, 'test.scope');
      }).toThrow(
        'Invalid DSL expression in test.scope for scope "inventory_items":'
      );
    });
  });

  describe('constructor', () => {
    test('should configure with correct content type', () => {
      expect(loader._primarySchemaId).toBe(null);
    });
  });
});
