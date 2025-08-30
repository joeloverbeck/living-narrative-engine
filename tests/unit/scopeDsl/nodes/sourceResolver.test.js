import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createSourceResolver from '../../../../src/scopeDsl/nodes/sourceResolver.js';

describe('sourceResolver', () => {
  let resolver;
  let entitiesGateway;
  let locationProvider;
  let errorHandler;

  beforeEach(() => {
    // Create stub gateways with deterministic data
    entitiesGateway = {
      getEntities: jest.fn(() => [
        { id: 'entity1' },
        { id: 'entity2' },
        { id: 'entity3' },
        { id: 'entity4' },
      ]),
      getEntitiesWithComponent: jest.fn((componentId) => {
        // Deterministic component assignments
        if (componentId === 'core:name') {
          return [{ id: 'entity1' }, { id: 'entity2' }];
        }
        if (componentId === 'core:position') {
          return [{ id: 'entity1' }, { id: 'entity3' }];
        }
        return [];
      }),
      hasComponent: jest.fn((entityId, componentId) => {
        // Deterministic component checks
        const componentMap = {
          entity1: ['core:name', 'core:position'],
          entity2: ['core:name'],
          entity3: ['core:position'],
          entity4: [],
        };
        return componentMap[entityId]?.includes(componentId) || false;
      }),
      getComponentData: () => null,
      getEntityInstance: () => null,
    };

    locationProvider = {
      getLocation: () => ({ id: 'location1' }),
    };

    // Create mock error handler
    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    resolver = createSourceResolver({
      entitiesGateway,
      locationProvider,
      errorHandler,
    });
  });

  describe('canResolve', () => {
    it('should return true for Source nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(true);
    });

    it('should return false for non-Source nodes', () => {
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
      expect(resolver.canResolve({ type: 'Union' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('actor source', () => {
      it('should return a set containing the actor entity ID', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(1);
        expect(result.has('actor123')).toBe(true);
      });
    });

    describe('location source', () => {
      it('should return a set containing the location ID when location exists', () => {
        const node = { type: 'Source', kind: 'location' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(1);
        expect(result.has('location1')).toBe(true);
      });

      it('should return empty set when location is null', () => {
        locationProvider.getLocation = () => null;
        const node = { type: 'Source', kind: 'location' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });

      it('should return empty set when location has no ID', () => {
        locationProvider.getLocation = () => ({});
        const node = { type: 'Source', kind: 'location' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });
    });

    describe('entities source', () => {
      it('should return entities with the specified component', () => {
        const node = { type: 'Source', kind: 'entities', param: 'core:name' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });

      it('should return entities without the negated component', () => {
        const node = { type: 'Source', kind: 'entities', param: '!core:name' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);
        // verify internal calls for negated path
        expect(entitiesGateway.getEntities).toHaveBeenCalled();
        const entityCount = entitiesGateway.getEntities().length;
        expect(entitiesGateway.hasComponent).toHaveBeenCalledTimes(entityCount);
      });

      it('should return empty set when no component param is provided', () => {
        const node = { type: 'Source', kind: 'entities' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });

      it('should filter out non-string entity IDs', () => {
        entitiesGateway.getEntitiesWithComponent = () => [
          { id: 'entity1' },
          { id: 123 }, // Invalid ID
          { id: null }, // Invalid ID
          { id: 'entity2' },
        ];

        const node = { type: 'Source', kind: 'entities', param: 'core:test' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });
    });

    describe('unknown source kind', () => {
      it('should use error handler for unknown source kinds', () => {
        const node = { type: 'Source', kind: 'unknown' };
        const ctx = { actorEntity: { id: 'actor123' } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'UnknownSourceError',
            message: 'Unknown source kind: unknown',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_2001'
        );
      });

      it('should throw UnknownSourceError for unknown source kinds when no error handler', () => {
        const resolverWithoutHandler = createSourceResolver({
          entitiesGateway,
          locationProvider,
        });
        const node = { type: 'Source', kind: 'unknown' };
        const ctx = { actorEntity: { id: 'actor123' } };

        expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
          'Unknown source kind: unknown'
        );
      });
    });

    describe('context validation', () => {
      beforeEach(() => {
        // Reset error handler mock
        errorHandler.handleError.mockClear();
      });

      it('should use error handler when actorEntity is missing from context', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = {}; // Missing actorEntity

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity is missing from context',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1001'
        );
      });

      it('should throw error when actorEntity is missing and no error handler', () => {
        const resolverWithoutHandler = createSourceResolver({
          entitiesGateway,
          locationProvider,
        });
        const node = { type: 'Source', kind: 'actor' };
        const ctx = {}; // Missing actorEntity

        expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
          'SourceResolver: actorEntity is missing from context'
        );
      });

      it('should use error handler when actorEntity is null', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: null };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity is missing from context',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1001'
        );
      });

      it('should use error handler when actorEntity.id is null', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: null } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity has invalid ID: null',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1002'
        );
      });

      it('should use error handler when actorEntity.id is undefined', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: undefined } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity has invalid ID: undefined',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1002'
        );
      });

      it('should use error handler when actorEntity.id is not a string', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 123 } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity has invalid ID: 123',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1002'
        );
      });

      it('should use error handler when actorEntity.id is an object', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: { invalid: 'object' } } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message:
              'SourceResolver: actorEntity has invalid ID: {"invalid":"object"}',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1002'
        );
      });

      it('should use error handler when actorEntity.id is an empty string', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: '' } };

        resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'SourceResolver: actorEntity has invalid ID: ""',
          }),
          ctx,
          'SourceResolver',
          'SCOPE_1002'
        );
      });
    });

    describe('trace logging', () => {
      it('should add trace log when trace context is provided', () => {
        const trace = {
          addLog: jest.fn(),
        };
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 'actor123' }, trace };

        resolver.resolve(node, ctx);

        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          "Resolved source 'actor'. Found 1 item(s).",
          'ScopeEngine.resolveSource',
          {
            kind: 'actor',
            param: undefined,
            result: ['actor123'],
          }
        );
      });

      it('should not throw when trace is not provided', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 'actor123' } };

        expect(() => resolver.resolve(node, ctx)).not.toThrow();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex negated component query correctly', () => {
      // Set up a scenario where we have many entities
      entitiesGateway.getEntities = () => {
        const entities = [];
        for (let i = 1; i <= 100; i++) {
          entities.push({ id: `entity${i}` });
        }
        return entities;
      };

      // Only first 10 entities have core:actor component
      entitiesGateway.hasComponent = (entityId, componentId) => {
        if (componentId === 'core:actor') {
          const idNum = parseInt(entityId.replace('entity', ''));
          return idNum <= 10;
        }
        return false;
      };

      const node = { type: 'Source', kind: 'entities', param: '!core:actor' };
      const ctx = { actorEntity: { id: 'actor123' } };

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(90);
      expect(result.has('entity1')).toBe(false);
      expect(result.has('entity10')).toBe(false);
      expect(result.has('entity11')).toBe(true);
      expect(result.has('entity100')).toBe(true);
    });
  });

  describe('error handling integration', () => {
    describe('with error handler', () => {
      it('should validate error handler interface', () => {
        // Test that the error handler is properly validated
        expect(() =>
          createSourceResolver({
            entitiesGateway,
            locationProvider,
            errorHandler: { invalidInterface: true },
          })
        ).toThrow('Invalid or missing method');
      });

      it('should use error handler for all error scenarios', () => {
        const testCases = [
          {
            name: 'missing actorEntity',
            ctx: {},
            node: { type: 'Source', kind: 'actor' },
            expectedCode: 'SCOPE_1001',
          },
          {
            name: 'invalid actor ID',
            ctx: { actorEntity: { id: null } },
            node: { type: 'Source', kind: 'actor' },
            expectedCode: 'SCOPE_1002',
          },
          {
            name: 'unknown source kind',
            ctx: { actorEntity: { id: 'actor123' } },
            node: { type: 'Source', kind: 'invalidKind' },
            expectedCode: 'SCOPE_2001',
          },
        ];

        testCases.forEach(({ ctx, node, expectedCode }) => {
          errorHandler.handleError.mockClear();

          resolver.resolve(node, ctx);

          expect(errorHandler.handleError).toHaveBeenCalledWith(
            expect.any(Error),
            ctx,
            'SourceResolver',
            expectedCode
          );
        });
      });

      it('should not call error handler for successful resolutions', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 'actor123' } };

        errorHandler.handleError.mockClear();

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.has('actor123')).toBe(true);
        expect(errorHandler.handleError).not.toHaveBeenCalled();
      });
    });

    describe('without error handler (backward compatibility)', () => {
      let resolverWithoutHandler;

      beforeEach(() => {
        resolverWithoutHandler = createSourceResolver({
          entitiesGateway,
          locationProvider,
        });
      });

      it('should throw errors for missing actorEntity', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = {};

        expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
          'SourceResolver: actorEntity is missing from context'
        );
      });

      it('should throw errors for invalid actor ID', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: null } };

        expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
          'SourceResolver: actorEntity has invalid ID: null'
        );
      });

      it('should throw errors for unknown source kinds', () => {
        const node = { type: 'Source', kind: 'invalidKind' };
        const ctx = { actorEntity: { id: 'actor123' } };

        expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
          'Unknown source kind: invalidKind'
        );
      });

      it('should work normally for successful resolutions', () => {
        const node = { type: 'Source', kind: 'actor' };
        const ctx = { actorEntity: { id: 'actor123' } };

        const result = resolverWithoutHandler.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.has('actor123')).toBe(true);
      });
    });
  });
});
