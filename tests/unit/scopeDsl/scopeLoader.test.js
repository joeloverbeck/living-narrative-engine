import { jest } from '@jest/globals';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';

// Mock the parser
jest.mock('../../../src/scopeDsl/parser.js', () => ({
  parseInlineExpr: jest.fn()
}));

describe('ScopeLoader', () => {
  let loader;
  let mockParseInlineExpr;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseInlineExpr = require('../../../src/scopeDsl/parser.js').parseInlineExpr;
    
    const mockDependencies = {
      config: { 
        getModsBasePath: jest.fn(),
        getContentTypeSchemaId: jest.fn()
      },
      pathResolver: { resolveModContentPath: jest.fn() },
      dataFetcher: { fetch: jest.fn() },
      schemaValidator: { 
        validate: jest.fn(),
        getValidator: jest.fn(),
        isSchemaLoaded: jest.fn()
      },
      dataRegistry: { 
        store: jest.fn(),
        get: jest.fn()
      },
      logger: { 
        debug: jest.fn(), 
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
      }
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

  describe('parseContent', () => {
    test('should parse valid scope definitions', () => {
      const content = `
        inventory_items := actor -> inventory.items[]
        equipment_items := actor -> equipment.equipped[]
        followers := actor -> followers[]
      `;

      mockParseInlineExpr.mockReturnValue({ type: 'valid' });

      const result = loader.parseContent(content, 'test.scope');

      expect(result).toEqual({
        inventory_items: 'actor -> inventory.items[]',
        equipment_items: 'actor -> equipment.equipped[]',
        followers: 'actor -> followers[]'
      });
    });

    test('should handle comments and empty lines', () => {
      const content = `
        // This is a comment
        inventory_items := actor -> inventory.items[]
        
        // Another comment
        equipment_items := actor -> equipment.equipped[]
      `;

      mockParseInlineExpr.mockReturnValue({ type: 'valid' });

      const result = loader.parseContent(content, 'test.scope');

      expect(result).toEqual({
        inventory_items: 'actor -> inventory.items[]',
        equipment_items: 'actor -> equipment.equipped[]'
      });
    });

    test('should throw error for empty file', () => {
      const content = `
        // Only comments
        // No actual content
      `;

      expect(() => {
        loader.parseContent(content, 'test.scope');
      }).toThrow('Empty scope file: test.scope');
    });

    test('should throw error for invalid format', () => {
      const content = `
        inventory_items = actor -> inventory.items[]
        // Missing :=
      `;

      expect(() => {
        loader.parseContent(content, 'test.scope');
      }).toThrow('Invalid scope definition format in test.scope: "inventory_items = actor -> inventory.items[]". Expected "name := dsl_expression"');
    });

    test('should throw error for invalid DSL expression', () => {
      const content = `
        inventory_items := invalid dsl expression
      `;

      mockParseInlineExpr.mockImplementation(() => {
        throw new Error('Invalid DSL');
      });

      expect(() => {
        loader.parseContent(content, 'test.scope');
      }).toThrow('Invalid DSL expression in test.scope for scope "inventory_items": Invalid DSL');
    });

    test('should validate DSL expressions', () => {
      const content = `
        inventory_items := actor -> inventory.items[]
      `;

      mockParseInlineExpr.mockReturnValue({ type: 'valid' });

      loader.parseContent(content, 'test.scope');

      expect(mockParseInlineExpr).toHaveBeenCalledWith('actor -> inventory.items[]');
    });
  });

  describe('transformContent', () => {
    test('should transform scope definitions with mod prefix', () => {
      const parsedContent = {
        inventory_items: 'actor -> inventory.items[]',
        equipment_items: 'actor -> equipment.equipped[]'
      };

      const result = loader.transformContent(parsedContent, 'core');

      expect(result).toEqual({
        'core:inventory_items': {
          name: 'core:inventory_items',
          dsl: 'actor -> inventory.items[]',
          modId: 'core',
          source: 'file'
        },
        'core:equipment_items': {
          name: 'core:equipment_items',
          dsl: 'actor -> equipment.equipped[]',
          modId: 'core',
          source: 'file'
        }
      });
    });

    test('should handle custom mod IDs', () => {
      const parsedContent = {
        custom_scope: 'location -> entities(Item)'
      };

      const result = loader.transformContent(parsedContent, 'myMod');

      expect(result).toEqual({
        'myMod:custom_scope': {
          name: 'myMod:custom_scope',
          dsl: 'location -> entities(Item)',
          modId: 'myMod',
          source: 'file'
        }
      });
    });
  });

  describe('constructor', () => {
    test('should configure with correct content type', () => {
      expect(loader._primarySchemaId).toBeDefined();
    });
  });
}); 