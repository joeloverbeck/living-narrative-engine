/**
 * @file Tests for namespaced scope requirements
 * @description Ensures that scopes can only be referred to by namespaced names (e.g., 'core:followers')
 * with the only exceptions being 'none' and 'self'
 */

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeLoader from '../../../src/loaders/scopeLoader.js';
import { addMockAstsToScopes } from '../../common/scopeDsl/mockAstGenerator.js';

describe('Namespaced Scope Requirements', () => {
  describe('ScopeRegistry', () => {
    let scopeRegistry;

    beforeEach(() => {
      scopeRegistry = new ScopeRegistry();
    });

    describe('getScope validation', () => {
      beforeEach(() => {
        scopeRegistry.initialize(addMockAstsToScopes({
          'core:followers': {
            expr: 'actor.core:leading.followers[]',
            modId: 'core',
          },
          'intimacy:close_actors': {
            expr: 'actor.components.intimacy:closeness.partners[]',
            modId: 'intimacy',
          },
        }));
      });

      it('should allow special case "none" without namespace', () => {
        expect(() => scopeRegistry.getScope('none')).not.toThrow();
        expect(scopeRegistry.getScope('none')).toBeNull(); // Handled by target resolution service
      });

      it('should allow special case "self" without namespace', () => {
        expect(() => scopeRegistry.getScope('self')).not.toThrow();
        expect(scopeRegistry.getScope('self')).toBeNull(); // Handled by target resolution service
      });

      it('should return scope definition for valid namespaced scope', () => {
        const scope = scopeRegistry.getScope('core:followers');
        expect(scope).toBeDefined();
        expect(scope.expr).toBe('actor.core:leading.followers[]');
      });

      it('should throw error for non-namespaced scope names (except none/self)', () => {
        expect(() => scopeRegistry.getScope('followers')).toThrow(
          "Scope names must be namespaced (e.g., 'core:followers'), but got: 'followers'. Only 'none' and 'self' are allowed without namespace."
        );
      });

      it('should throw error for unknown scope names regardless of format', () => {
        expect(() => scopeRegistry.getScope('unknown_scope')).toThrow();
        expect(() =>
          scopeRegistry.getScope('core:unknown_scope')
        ).not.toThrow();
        expect(scopeRegistry.getScope('core:unknown_scope')).toBeNull();
      });

      it('should throw error for multiple non-namespaced scope names', () => {
        const nonNamespacedScopes = [
          'potential_leaders',
          'environment',
          'close_actors',
          'actors_in_location',
        ];

        nonNamespacedScopes.forEach((scopeName) => {
          expect(() => scopeRegistry.getScope(scopeName)).toThrow(
            `Scope names must be namespaced (e.g., 'core:${scopeName}'), but got: '${scopeName}'. Only 'none' and 'self' are allowed without namespace.`
          );
        });
      });
    });

    describe('hasScope method', () => {
      beforeEach(() => {
        scopeRegistry.initialize(addMockAstsToScopes({
          'core:followers': {
            expr: 'actor.core:leading.followers[]',
            modId: 'core',
          },
        }));
      });

      it('should return true for existing namespaced scopes', () => {
        expect(scopeRegistry.hasScope('core:followers')).toBe(true);
      });

      it('should return false for non-existent scopes', () => {
        expect(scopeRegistry.hasScope('core:unknown')).toBe(false);
        expect(scopeRegistry.hasScope('unknown:scope')).toBe(false);
      });

      it('should return false for non-namespaced scope names (even if they exist)', () => {
        expect(scopeRegistry.hasScope('followers')).toBe(false);
      });

      it('should return false for special cases none/self', () => {
        expect(scopeRegistry.hasScope('none')).toBe(false);
        expect(scopeRegistry.hasScope('self')).toBe(false);
      });
    });
  });

  describe('Scope Definition Parser', () => {
    it('should require namespace in scope definitions', () => {
      const validContent = 'core:followers := actor.core:leading.followers[]';
      expect(() =>
        parseScopeDefinitions(validContent, 'test.scope')
      ).not.toThrow();

      const result = parseScopeDefinitions(validContent, 'test.scope');
      expect(result.has('core:followers')).toBe(true);
    });

    it('should reject non-namespaced scope definitions', () => {
      const invalidContent = 'followers := actor.core:leading.followers[]';
      expect(() =>
        parseScopeDefinitions(invalidContent, 'test.scope')
      ).toThrow();
    });

    it('should reject scope definitions without colon separator', () => {
      const invalidContent = 'coreFollowers := actor.core:leading.followers[]';
      expect(() =>
        parseScopeDefinitions(invalidContent, 'test.scope')
      ).toThrow();
    });

    it('should handle multiple namespaced scopes', () => {
      const content = `
        core:followers := actor.core:leading.followers[]
        core:environment := entities(core:position)
        intimacy:close_actors := actor.components.intimacy:closeness.partners[]
      `;

      const result = parseScopeDefinitions(content, 'test.scope');
      expect(result.size).toBe(3);
      expect(result.has('core:followers')).toBe(true);
      expect(result.has('core:environment')).toBe(true);
      expect(result.has('intimacy:close_actors')).toBe(true);
    });

    it('should reject mixed valid and invalid scope definitions', () => {
      const mixedContent = `
        core:followers := actor.core:leading.followers[]
        invalid_scope := entities(core:position)
      `;

      expect(() => parseScopeDefinitions(mixedContent, 'test.scope')).toThrow();
    });
  });

  describe('Scope Loader Validation', () => {
    let mockPathResolver;
    let mockDataFetcher;
    let mockSchemaValidator;
    let mockDataRegistry;
    let mockLogger;
    let scopeLoader;

    beforeEach(() => {
      mockPathResolver = {
        resolve: jest.fn(),
        resolveModContentPath: jest.fn(),
      };
      mockDataFetcher = { fetch: jest.fn() };
      mockSchemaValidator = {
        validate: jest.fn(),
        getValidator: jest.fn(),
        isSchemaLoaded: jest.fn(),
      };
      mockDataRegistry = {
        set: jest.fn(),
        has: jest.fn().mockReturnValue(false),
        store: jest.fn(),
        get: jest.fn().mockReturnValue(undefined),
      };
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      scopeLoader = new ScopeLoader(
        {
          scopes: { enabled: true },
          getModsBasePath: jest.fn(),
          getContentTypeSchemaId: jest.fn().mockReturnValue(null),
        },
        mockPathResolver,
        mockDataFetcher,
        mockSchemaValidator,
        mockDataRegistry,
        mockLogger
      );
    });

    describe('transformContent validation', () => {
      it('should reject scope definitions without namespace', () => {
        const parsedContent = new Map([
          ['followers', 'actor.core:leading.followers[]'],
        ]);

        expect(() =>
          scopeLoader.transformContent(parsedContent, 'core')
        ).toThrow(
          "Scope 'followers' must be namespaced (e.g., 'core:followers'). Only 'none' and 'self' are allowed without namespace."
        );
      });

      it('should reject scope definitions with wrong namespace', () => {
        const parsedContent = new Map([
          ['intimacy:followers', 'actor.core:leading.followers[]'],
        ]);

        expect(() =>
          scopeLoader.transformContent(parsedContent, 'core')
        ).toThrow(
          "Scope 'intimacy:followers' is declared in mod 'core' but claims to belong to mod 'intimacy'. Scope names must match the mod they're defined in."
        );
      });

      it('should accept scope definitions with correct namespace', () => {
        const parsedContent = new Map([
          ['core:followers', 'actor.core:leading.followers[]'],
          ['core:environment', 'entities(core:position)'],
        ]);

        const result = scopeLoader.transformContent(parsedContent, 'core');

        expect(result['core:followers']).toBeDefined();
        expect(result['core:followers'].name).toBe('core:followers');
        expect(result['core:followers'].modId).toBe('core');

        expect(result['core:environment']).toBeDefined();
        expect(result['core:environment'].name).toBe('core:environment');
        expect(result['core:environment'].modId).toBe('core');
      });

      it('should reject multiple invalid scope definitions', () => {
        const parsedContent = new Map([
          ['followers', 'actor.core:leading.followers[]'],
          ['environment', 'entities(core:position)'],
        ]);

        expect(() =>
          scopeLoader.transformContent(parsedContent, 'core')
        ).toThrow();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should enforce namespaced scopes throughout the entire pipeline', () => {
      // Test that the entire pipeline from file content to registry enforces namespacing
      const scopeRegistry = new ScopeRegistry();

      // Valid namespaced scope content
      const validContent = 'core:test_scope := entities(core:position)';
      const parsedScopes = parseScopeDefinitions(validContent, 'test.scope');

      // Transform through loader logic
      const mockLoader = new ScopeLoader(
        {
          scopes: { enabled: true },
          getModsBasePath: jest.fn(),
          getContentTypeSchemaId: jest.fn().mockReturnValue(null),
        },
        { resolve: jest.fn(), resolveModContentPath: jest.fn() },
        { fetch: jest.fn() },
        {
          validate: jest.fn(),
          getValidator: jest.fn(),
          isSchemaLoaded: jest.fn(),
        },
        {
          set: jest.fn(),
          has: jest.fn().mockReturnValue(false),
          store: jest.fn(),
          get: jest.fn().mockReturnValue(undefined),
        },
        { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
      );

      const transformedScopes = mockLoader.transformContent(
        parsedScopes,
        'core'
      );

      // Initialize registry
      scopeRegistry.initialize(transformedScopes);

      // Test registry access
      expect(() => scopeRegistry.getScope('core:test_scope')).not.toThrow();
      expect(scopeRegistry.getScope('core:test_scope')).toBeDefined();

      // Test that non-namespaced access fails
      expect(() => scopeRegistry.getScope('test_scope')).toThrow();
    });

    it('should allow special cases none and self throughout pipeline', () => {
      const scopeRegistry = new ScopeRegistry();
      scopeRegistry.initialize({});

      // These should not throw and should return null (handled by target resolution service)
      expect(() => scopeRegistry.getScope('none')).not.toThrow();
      expect(() => scopeRegistry.getScope('self')).not.toThrow();
      expect(scopeRegistry.getScope('none')).toBeNull();
      expect(scopeRegistry.getScope('self')).toBeNull();
    });
  });
});
