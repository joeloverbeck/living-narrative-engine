import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { storeItemInRegistry } from '../../../../src/loaders/helpers/registryStoreUtils.js';

describe('registryStoreUtils - Scope ID Mapping', () => {
  let mockLogger;
  let mockRegistry;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRegistry = {
      store: jest.fn().mockReturnValue(false), // false = no override
      get: jest.fn().mockReturnValue(undefined), // no existing item
    };
  });

  describe('scope ID mapping behavior', () => {
    it('should store scopes with qualified ID as the id property', () => {
      const scopeData = {
        name: 'core:test_scope',
        expr: 'entities(core:position)',
        modId: 'core',
        source: 'file',
      };

      const result = storeItemInRegistry(
        mockLogger,
        mockRegistry,
        'ScopeLoader',
        'scopes',
        'core',
        'test_scope',
        scopeData,
        'test_scope.scope'
      );

      // Verify the registry.store was called with the qualified ID as the key
      expect(mockRegistry.store).toHaveBeenCalledWith(
        'scopes',
        'core:test_scope',
        expect.objectContaining({
          id: 'core:test_scope', // This is the critical assertion - id should be qualified
          name: 'core:test_scope',
          expr: 'entities(core:position)',
          modId: 'core',
          source: 'file',
          _modId: 'core',
          _sourceFile: 'test_scope.scope',
          _fullId: 'core:test_scope',
        })
      );

      expect(result).toEqual({
        qualifiedId: 'core:test_scope',
        didOverride: false,
      });
    });

    it('should handle multiple scopes with different qualified IDs', () => {
      const scopes = [
        {
          name: 'core:potential_leaders',
          expr: 'entities(core:position)[actor.components.core:leadership]',
          modId: 'core',
          source: 'file',
        },
        {
          name: 'core:clear_directions',
          expr: 'exits()',
          modId: 'core',
          source: 'file',
        },
        {
          name: 'core:actors_in_location',
          expr: 'entities(core:position)',
          modId: 'core',
          source: 'file',
        },
      ];

      scopes.forEach((scopeData, index) => {
        const baseName = scopeData.name.split(':', 2)[1];
        const result = storeItemInRegistry(
          mockLogger,
          mockRegistry,
          'ScopeLoader',
          'scopes',
          'core',
          baseName,
          scopeData,
          `${baseName}.scope`
        );

        expect(result.qualifiedId).toBe(scopeData.name);
      });

      // Verify all scopes were stored with their qualified IDs
      expect(mockRegistry.store).toHaveBeenCalledTimes(3);

      // Check each specific call
      expect(mockRegistry.store).toHaveBeenNthCalledWith(
        1,
        'scopes',
        'core:potential_leaders',
        expect.objectContaining({ id: 'core:potential_leaders' })
      );

      expect(mockRegistry.store).toHaveBeenNthCalledWith(
        2,
        'scopes',
        'core:clear_directions',
        expect.objectContaining({ id: 'core:clear_directions' })
      );

      expect(mockRegistry.store).toHaveBeenNthCalledWith(
        3,
        'scopes',
        'core:actors_in_location',
        expect.objectContaining({ id: 'core:actors_in_location' })
      );
    });

    it('should differentiate scope ID behavior from other categories', () => {
      const testCases = [
        {
          category: 'actions',
          baseId: 'test_actions',
          data: { name: 'core:test_actions', someProperty: 'value' },
          expectedIdInObject: 'core:test_actions',
          sourceFile: 'test_actions.json',
        },
        {
          category: 'scopes',
          baseId: 'test_scope',
          data: { name: 'core:test_scope', expr: 'test_expr' },
          expectedIdInObject: 'core:test_scope', // qualified ID for scopes
          sourceFile: 'test_scope.scope',
        },
        {
          category: 'entityDefinitions',
          baseId: 'test_entity',
          data: { name: 'core:test_entity', someProp: 'entity_prop' },
          expectedIdInObject: 'core:test_entity', // qualified ID for entity definitions
          sourceFile: 'test_entity.entity.json',
        },
        {
          category: 'entityInstances',
          baseId: 'test_instance',
          data: { definitionId: 'core:test_entity', someInstProp: 'inst_prop' },
          expectedIdInObject: 'core:test_instance', // qualified ID for entity instances
          sourceFile: 'test_instance.instance.json',
        },
      ];

      testCases.forEach(
        ({ category, baseId, data, expectedIdInObject, sourceFile }) => {
          mockRegistry.store.mockClear();

          storeItemInRegistry(
            mockLogger,
            mockRegistry,
            'TestLoader',
            category,
            'core',
            baseId,
            data,
            sourceFile
          );

          expect(mockRegistry.store).toHaveBeenCalledWith(
            category,
            `core:${baseId}`,
            expect.objectContaining({
              id: expectedIdInObject,
            })
          );
        }
      );
    });
  });

  describe('regression prevention', () => {
    it('should prevent the specific bug where scopes had base ID but were accessed by qualified ID', () => {
      // This test simulates the exact scenario that was broken
      const scopeData = {
        name: 'core:potential_leaders',
        expr: 'entities(core:position)[actor.components.core:leadership]',
        modId: 'core',
        source: 'file',
      };

      // This is how ScopeLoader calls storeItemInRegistry
      storeItemInRegistry(
        mockLogger,
        mockRegistry,
        'ScopeLoader',
        'scopes',
        'core',
        'potential_leaders', // Base name extracted from qualified name
        scopeData,
        'potential_leaders.scope'
      );

      // The stored object should have the qualified ID as its id property
      const storedObject = mockRegistry.store.mock.calls[0][2];

      // This is the critical assertion that would have failed before the fix
      expect(storedObject.id).toBe('core:potential_leaders');
      expect(storedObject.id).not.toBe('potential_leaders'); // This was the bug

      // Additional assertions to ensure the object is properly formed
      expect(storedObject).toMatchObject({
        id: 'core:potential_leaders',
        name: 'core:potential_leaders',
        expr: 'entities(core:position)[actor.components.core:leadership]',
        modId: 'core',
        source: 'file',
        _modId: 'core',
        _sourceFile: 'potential_leaders.scope',
        _fullId: 'core:potential_leaders',
      });
    });
  });
});
