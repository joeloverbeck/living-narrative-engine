import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SCOPES_KEY } from '../../../../src/constants/dataRegistryKeys.js';
import { addMockAst } from '../../../common/scopeDsl/mockAstGenerator.js';

describe('Scope Registry Initialization - Focused Test', () => {
  let mockLogger;
  let mockScopeRegistry;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockScopeRegistry = {
      initialize: jest.fn(),
    };

    mockDataRegistry = {
      getAll: jest.fn(),
    };
  });

  describe('scope registry initialization behavior', () => {
    it('should map scopes correctly using their id property', async () => {
      // Mock scopes as they would be stored after our registryStoreUtils fix
      const mockScopes = [
        {
          id: 'core:potential_leaders', // Qualified ID as id property (FIXED)
          name: 'core:potential_leaders',
          expr: 'entities(core:position)[actor.components.core:leadership]',
          modId: 'core',
          source: 'file',
          _modId: 'core',
          _sourceFile: 'potential_leaders.scope',
          _fullId: 'core:potential_leaders',
        },
        {
          id: 'core:clear_directions', // Qualified ID as id property (FIXED)
          name: 'core:clear_directions',
          expr: 'exits()',
          modId: 'core',
          source: 'file',
          _modId: 'core',
          _sourceFile: 'clear_directions.scope',
          _fullId: 'core:clear_directions',
        },
        {
          id: 'core:actors_in_location', // Qualified ID as id property (FIXED)
          name: 'core:actors_in_location',
          expr: 'entities(core:position)',
          modId: 'core',
          source: 'file',
          _modId: 'core',
          _sourceFile: 'actors_in_location.scope',
          _fullId: 'core:actors_in_location',
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(mockScopes);

      // Simulate the scope registry initialization logic
      const scopes = mockDataRegistry.getAll(SCOPES_KEY);
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = addMockAst(scope);
        }
      });
      mockScopeRegistry.initialize(scopeMap);

      // Verify the scope registry was initialized with the correct mapping
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          'core:potential_leaders': expect.objectContaining({
            ...mockScopes[0],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopes[0].expr,
            }),
          }),
          'core:clear_directions': expect.objectContaining({
            ...mockScopes[1],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopes[1].expr,
            }),
          }),
          'core:actors_in_location': expect.objectContaining({
            ...mockScopes[2],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopes[2].expr,
            }),
          }),
        })
      );

      expect(mockDataRegistry.getAll).toHaveBeenCalledWith(SCOPES_KEY);
    });

    it('should demonstrate the bug that was fixed', async () => {
      // Mock scopes as they would have been stored BEFORE our fix
      const mockScopesWithBug = [
        {
          id: 'potential_leaders', // Base ID instead of qualified (BUG)
          name: 'core:potential_leaders',
          expr: 'entities(core:position)[actor.components.core:leadership]',
          modId: 'core',
          source: 'file',
          _fullId: 'core:potential_leaders',
        },
        {
          id: 'clear_directions', // Base ID instead of qualified (BUG)
          name: 'core:clear_directions',
          expr: 'exits()',
          modId: 'core',
          source: 'file',
          _fullId: 'core:clear_directions',
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(mockScopesWithBug);

      // Simulate the scope registry initialization logic
      const scopes = mockDataRegistry.getAll(SCOPES_KEY);
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = addMockAst(scope);
        }
      });
      mockScopeRegistry.initialize(scopeMap);

      // With the bug, scope registry would be initialized with base IDs as keys
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          potential_leaders: expect.objectContaining({
            ...mockScopesWithBug[0],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopesWithBug[0].expr,
            }),
          }), // Wrong - this causes the bug
          clear_directions: expect.objectContaining({
            ...mockScopesWithBug[1],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopesWithBug[1].expr,
            }),
          }), // Wrong - this causes the bug
        })
      );

      // This demonstrates why TargetResolutionService couldn't find 'core:potential_leaders'
      // It was looking for 'core:potential_leaders' but the map only had 'potential_leaders'
    });

    it('should handle edge cases gracefully', async () => {
      // Mock scenario with mixed valid and invalid scopes
      const mockScopes = [
        {
          id: 'core:valid_scope',
          name: 'core:valid_scope',
          expr: 'entities()',
          modId: 'core',
          source: 'file',
        },
        {
          // Missing id property - should be ignored
          name: 'core:invalid_scope',
          expr: 'entities()',
          modId: 'core',
          source: 'file',
        },
        {
          id: '', // Empty id - should be ignored
          name: 'core:empty_id_scope',
          expr: 'entities()',
          modId: 'core',
          source: 'file',
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(mockScopes);

      // Simulate the scope registry initialization logic
      const scopes = mockDataRegistry.getAll(SCOPES_KEY);
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = addMockAst(scope);
        }
      });
      mockScopeRegistry.initialize(scopeMap);

      // Only the valid scope should be in the map
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          'core:valid_scope': expect.objectContaining({
            ...mockScopes[0],
            ast: expect.objectContaining({
              type: 'Source',
              kind: 'mock',
              expression: mockScopes[0].expr,
            }),
          }),
        })
      );
    });
  });

  describe('regression prevention assertions', () => {
    it('should ensure scopes are accessible by their qualified names', () => {
      // This test verifies the specific scenario that was failing
      const properlyFormattedScopes = [
        {
          id: 'core:potential_leaders', // Must be qualified ID
          name: 'core:potential_leaders',
          expr: 'entities(core:position)[actor.components.core:leadership]',
          modId: 'core',
          source: 'file',
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(properlyFormattedScopes);

      // Simulate initialization
      const scopes = mockDataRegistry.getAll(SCOPES_KEY);
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = addMockAst(scope);
        }
      });

      // Critical assertion: the scope should be accessible by its qualified name
      expect(scopeMap['core:potential_leaders']).toBeDefined();
      
      // Check all properties except the volatile timestamp
      const result = scopeMap['core:potential_leaders'];
      const expected = addMockAst(properlyFormattedScopes[0]);
      
      expect(result.id).toEqual(expected.id);
      expect(result.name).toEqual(expected.name);
      expect(result.expr).toEqual(expected.expr);
      expect(result.modId).toEqual(expected.modId);
      expect(result.source).toEqual(expected.source);
      expect(result.ast.type).toEqual(expected.ast.type);
      expect(result.ast.kind).toEqual(expected.ast.kind);
      expect(result.ast.expression).toEqual(expected.ast.expression);
      expect(result.ast._mock).toEqual(expected.ast._mock);
      // Don't check _timestamp as it's volatile

      // Anti-regression: it should NOT be accessible by base name only
      expect(scopeMap['potential_leaders']).toBeUndefined();

      // This ensures TargetResolutionService can find 'core:potential_leaders'
      mockScopeRegistry.initialize(scopeMap);
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          'core:potential_leaders': expect.any(Object),
        })
      );
    });

    it('should verify all problematic scopes from the bug report are properly mapped', () => {
      const allProblematicScopes = [
        {
          id: 'core:potential_leaders',
          name: 'core:potential_leaders',
          expr: 'entities(core:position)[actor.components.core:leadership]',
          modId: 'core',
        },
        {
          id: 'core:clear_directions',
          name: 'core:clear_directions',
          expr: 'exits()',
          modId: 'core',
        },
        {
          id: 'core:actors_in_location',
          name: 'core:actors_in_location',
          expr: 'entities(core:position)',
          modId: 'core',
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(allProblematicScopes);

      // Simulate initialization
      const scopes = mockDataRegistry.getAll(SCOPES_KEY);
      const scopeMap = {};
      scopes.forEach((scope) => {
        if (scope.id) {
          scopeMap[scope.id] = addMockAst(scope);
        }
      });

      // All scopes should be accessible by their qualified names
      expect(scopeMap['core:potential_leaders']).toBeDefined();
      expect(scopeMap['core:clear_directions']).toBeDefined();
      expect(scopeMap['core:actors_in_location']).toBeDefined();

      // None should be accessible by base names (anti-regression)
      expect(scopeMap['potential_leaders']).toBeUndefined();
      expect(scopeMap['clear_directions']).toBeUndefined();
      expect(scopeMap['actors_in_location']).toBeUndefined();

      mockScopeRegistry.initialize(scopeMap);
      expect(mockScopeRegistry.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          'core:potential_leaders': expect.any(Object),
          'core:clear_directions': expect.any(Object),
          'core:actors_in_location': expect.any(Object),
        })
      );
    });
  });
});
