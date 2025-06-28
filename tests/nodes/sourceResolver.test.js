import { describe, expect, it, beforeEach } from '@jest/globals';
import createSourceResolver from '../../src/scopeDsl/nodes/sourceResolver.js';

describe('sourceResolver', () => {
  let resolver;
  let entitiesGateway;
  let locationProvider;

  beforeEach(() => {
    // Create stub gateways with deterministic data
    entitiesGateway = {
      getEntities: () => [
        { id: 'entity1' },
        { id: 'entity2' },
        { id: 'entity3' },
        { id: 'entity4' },
      ],
      getEntitiesWithComponent: (componentId) => {
        // Deterministic component assignments
        if (componentId === 'core:name') {
          return [{ id: 'entity1' }, { id: 'entity2' }];
        }
        if (componentId === 'core:position') {
          return [{ id: 'entity1' }, { id: 'entity3' }];
        }
        return [];
      },
      hasComponent: (entityId, componentId) => {
        // Deterministic component checks
        const componentMap = {
          entity1: ['core:name', 'core:position'],
          entity2: ['core:name'],
          entity3: ['core:position'],
          entity4: [],
        };
        return componentMap[entityId]?.includes(componentId) || false;
      },
      getComponentData: () => null,
      getEntityInstance: () => null,
    };

    locationProvider = {
      getLocation: () => ({ id: 'location1' }),
    };

    resolver = createSourceResolver({ entitiesGateway, locationProvider });
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
      it('should throw UnknownSourceError for unknown source kinds', () => {
        const node = { type: 'Source', kind: 'unknown' };
        const ctx = { actorEntity: { id: 'actor123' } };

        expect(() => resolver.resolve(node, ctx)).toThrow('Unknown source kind: unknown');
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
});
