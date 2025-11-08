/**
 * @file Unit tests for ScopeConditionAnalyzer
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import ScopeConditionAnalyzer from '../../../common/engine/scopeConditionAnalyzer.js';

describe('ScopeConditionAnalyzer', () => {
  afterEach(() => {
    // Clear cache between tests
    ScopeConditionAnalyzer.clearCache();
  });

  describe('extractConditionRefs', () => {
    it('should extract single condition_ref from AST', () => {
      // Simulating parsed AST structure from parseScopeDefinitions
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            condition_ref: 'positioning:actor-facing',
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set(['positioning:actor-facing']));
    });

    it('should extract multiple condition_refs from AST', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            and: [
              { condition_ref: 'positioning:actor-facing' },
              { condition_ref: 'anatomy:has-exposed-part' },
            ],
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(
        new Set(['positioning:actor-facing', 'anatomy:has-exposed-part'])
      );
    });

    it('should extract nested condition_refs from AST', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            or: [
              {
                and: [
                  { condition_ref: 'positioning:actor-facing' },
                  { condition_ref: 'anatomy:has-part' },
                ],
              },
              { condition_ref: 'positioning:close-actors' },
            ],
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(
        new Set([
          'positioning:actor-facing',
          'anatomy:has-part',
          'positioning:close-actors',
        ])
      );
    });

    it('should handle scope AST with no condition_refs', () => {
      const scopeAst = {
        ast: {
          type: 'FieldAccess',
          path: 'actor.items[]',
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set());
    });

    it('should deduplicate duplicate condition_refs', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            and: [
              { condition_ref: 'positioning:actor-facing' },
              { condition_ref: 'positioning:actor-facing' },
            ],
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set(['positioning:actor-facing']));
    });

    it('should handle complex real-world scope AST', () => {
      // Actual AST structure from sex-dry-intimacy mod after parsing
      const scopeAst = {
        expr: 'actor.components.positioning:closeness.partners[][{...}]',
        ast: {
          type: 'ArrayIteration',
          parent: {
            type: 'FieldAccess',
            path: 'actor.components.positioning:closeness.partners',
          },
          filter: {
            and: [
              {
                or: [
                  { condition_ref: 'positioning:actor-in-entity-facing-away' },
                  { '!!': { var: 'entity.components.positioning:lying_down' } },
                ],
              },
              {
                and: [
                  { hasPartOfType: ['.', 'asshole'] },
                  { not: { isSocketCovered: ['.', 'asshole'] } },
                ],
              },
            ],
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toContain('positioning:actor-in-entity-facing-away');
      expect(refs.size).toBe(1);
    });

    it('should handle AST with filter property instead of logic', () => {
      const scopeAst = {
        ast: {
          type: 'ArrayIteration',
          filter: {
            condition_ref: 'positioning:actor-facing',
          },
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set(['positioning:actor-facing']));
    });

    it('should handle empty AST', () => {
      const scopeAst = {
        ast: {},
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set());
    });

    it('should handle null AST', () => {
      const scopeAst = {
        ast: null,
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set());
    });

    it('should handle condition_refs in arrays', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: [
            { condition_ref: 'positioning:actor-facing' },
            { condition_ref: 'positioning:close-actors' },
          ],
        },
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(
        new Set(['positioning:actor-facing', 'positioning:close-actors'])
      );
    });
  });

  describe('discoverTransitiveDependencies', () => {
    it('should discover single-level dependencies', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:condition-a') {
          return {
            logic: {
              condition_ref: 'mod:condition-b',
            },
          };
        }
        return { logic: {} };
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:condition-a'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:condition-a', 'mod:condition-b']));
      expect(mockLoader).toHaveBeenCalledWith('mod:condition-a');
      expect(mockLoader).toHaveBeenCalledWith('mod:condition-b');
    });

    it('should discover multi-level dependencies', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:a') {
          return { logic: { condition_ref: 'mod:b' } };
        }
        if (id === 'mod:b') {
          return { logic: { condition_ref: 'mod:c' } };
        }
        return { logic: {} };
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:a'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:a', 'mod:b', 'mod:c']));
    });

    it('should handle circular dependencies without infinite loop', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:a') {
          return { logic: { condition_ref: 'mod:b' } };
        }
        if (id === 'mod:b') {
          return { logic: { condition_ref: 'mod:a' } };
        }
        return { logic: {} };
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:a'],
        mockLoader,
        5
      );

      expect(deps).toEqual(new Set(['mod:a', 'mod:b']));
      // Should not call loader infinitely
      expect(mockLoader.mock.calls.length).toBeLessThan(10);
    });

    it('should respect maxDepth limit', async () => {
      const mockLoader = jest.fn(async (id) => ({
        logic: {
          condition_ref: `${id}-child`,
        },
      }));

      await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:root'],
        mockLoader,
        2
      );

      // Should stop at depth 2
      expect(mockLoader.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('should handle conditions with no nested dependencies', async () => {
      const mockLoader = jest.fn(async () => ({
        logic: { var: 'actor.id' },
      }));

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:standalone'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:standalone']));
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should handle loader errors gracefully', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:exists') {
          return { logic: { condition_ref: 'mod:missing' } };
        }
        throw new Error('Condition not found');
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:exists'],
        mockLoader
      );

      // Should still return the valid condition
      expect(deps).toContain('mod:exists');
      expect(deps).toContain('mod:missing');
    });

    it('should handle multiple initial conditions', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:a') {
          return { logic: { condition_ref: 'mod:shared' } };
        }
        if (id === 'mod:b') {
          return { logic: { condition_ref: 'mod:shared' } };
        }
        return { logic: {} };
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:a', 'mod:b'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:a', 'mod:b', 'mod:shared']));
      // Should only load 'mod:shared' once due to deduplication
      const sharedCalls = mockLoader.mock.calls.filter(
        (call) => call[0] === 'mod:shared'
      );
      expect(sharedCalls.length).toBe(1);
    });
  });

  describe('validateConditions', () => {
    it('should identify valid conditions', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set(['positioning:actor-in-entity-facing-away']),
        'test/scope/path.scope'
      );

      expect(validation.valid).toContain('positioning:actor-in-entity-facing-away');
      expect(validation.missing).toEqual([]);
    });

    it('should identify missing conditions', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set(['positioning:nonexistent-condition-xyz']),
        'test/scope/path.scope'
      );

      expect(validation.valid).toEqual([]);
      expect(validation.missing).toContain('positioning:nonexistent-condition-xyz');
    });

    it('should handle mix of valid and missing conditions', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set([
          'positioning:actor-in-entity-facing-away',
          'positioning:nonexistent-condition',
        ]),
        'test/scope/path.scope'
      );

      expect(validation.valid).toContain('positioning:actor-in-entity-facing-away');
      expect(validation.missing).toContain('positioning:nonexistent-condition');
    });

    it('should handle empty condition set', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set([]),
        'test/scope/path.scope'
      );

      expect(validation.valid).toEqual([]);
      expect(validation.missing).toEqual([]);
    });

    it('should handle array input', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        ['positioning:actor-in-entity-facing-away'],
        'test/scope/path.scope'
      );

      expect(validation.valid).toContain('positioning:actor-in-entity-facing-away');
    });

    it('should handle invalid condition ID format', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set(['invalid-id-without-colon']),
        'test/scope/path.scope'
      );

      expect(validation.missing).toContain('invalid-id-without-colon');
      expect(validation.valid).toEqual([]);
    });
  });

  describe('loadConditionDefinition', () => {
    it('should load valid condition definition', async () => {
      const condition = await ScopeConditionAnalyzer.loadConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      expect(condition).toBeDefined();
      expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
      expect(condition.logic).toBeDefined();
    });

    it('should cache loaded conditions', async () => {
      // Load once
      const condition1 = await ScopeConditionAnalyzer.loadConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      // Load again - should return cached version
      const condition2 = await ScopeConditionAnalyzer.loadConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      // Should be the exact same object reference
      expect(condition1).toBe(condition2);
    });

    it('should throw error for missing condition', async () => {
      await expect(
        ScopeConditionAnalyzer.loadConditionDefinition(
          'positioning:nonexistent-condition-xyz'
        )
      ).rejects.toThrow(/Failed to load condition/);
    });

    it('should throw error for invalid condition ID format', async () => {
      await expect(
        ScopeConditionAnalyzer.loadConditionDefinition('invalid-id')
      ).rejects.toThrow(/Invalid condition ID format/);
    });

    it('should throw error for empty condition ID', async () => {
      await expect(
        ScopeConditionAnalyzer.loadConditionDefinition('')
      ).rejects.toThrow(/Invalid condition ID format/);
    });

    it('should throw error for null condition ID', async () => {
      await expect(
        ScopeConditionAnalyzer.loadConditionDefinition(null)
      ).rejects.toThrow(/Invalid condition ID format/);
    });
  });

  describe('clearCache', () => {
    it('should clear the condition cache', async () => {
      // Load a condition to populate cache
      await ScopeConditionAnalyzer.loadConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      // Clear cache
      ScopeConditionAnalyzer.clearCache();

      // The condition should still load (from file, not cache)
      // but we can't easily verify if it came from cache or file
      const condition = await ScopeConditionAnalyzer.loadConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );

      expect(condition).toBeDefined();
    });
  });
});
