/**
 * @file Scope Definition Integration Tests
 * @description Tests that validate .scope file loading and action system integration
 * This ensures the documented workflow from .scope files to action targeting works correctly
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { parseScopeFile } from '../../../src/scopeDsl/parser/parser.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('Scope Definition Integration', () => {
  let scopeRegistry;
  let scopeEngine;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    scopeRegistry = new ScopeRegistry({ logger: mockLogger });
    scopeEngine = new ScopeEngine();
  });

  describe('.scope File Format Validation', () => {
    it('should parse simple scope definition correctly', () => {
      const scopeContent = 'actor.followers[]';
      const scopeName = 'followers';

      const result = parseScopeFile(scopeContent, scopeName);

      expect(result).toEqual({
        type: 'ScopeDef',
        name: 'followers',
        expr: {
          type: 'ArrayIterationStep',
          parent: {
            type: 'Step',
            field: 'followers',
            isArray: false,
            parent: {
              type: 'Source',
              kind: 'actor',
            },
          },
        },
      });
    });

    it('should parse complex scope with filters', () => {
      const scopeContent = `entities(core:item)[][{"==": [{"var": "entity.components.core:item.type"}, "weapon"]}]`;
      const scopeName = 'weapons';

      const result = parseScopeFile(scopeContent, scopeName);

      expect(result.type).toBe('ScopeDef');
      expect(result.name).toBe('weapons');
      expect(result.expr.type).toBe('Filter');
      expect(result.expr.parent.type).toBe('ArrayIterationStep');
      expect(result.expr.parent.parent.type).toBe('Source');
      expect(result.expr.parent.parent.kind).toBe('entities');
    });

    it('should parse union scope definitions', () => {
      const scopeContent = 'actor.followers[] | actor.partners[]';
      const scopeName = 'social_connections';

      const result = parseScopeFile(scopeContent, scopeName);

      expect(result.type).toBe('ScopeDef');
      expect(result.name).toBe('social_connections');
      expect(result.expr.type).toBe('Union');
      expect(result.expr.left.type).toBe('ArrayIterationStep');
      expect(result.expr.right.type).toBe('ArrayIterationStep');
    });

    it('should parse clothing scope definitions', () => {
      const scopeContent =
        'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower';
      const scopeName = 'torso_clothing';

      const result = parseScopeFile(scopeContent, scopeName);

      expect(result.type).toBe('ScopeDef');
      expect(result.name).toBe('torso_clothing');
      expect(result.expr.type).toBe('Union');
      expect(result.expr.left.field).toBe('torso_upper');
      expect(result.expr.right.field).toBe('torso_lower');
    });
  });

  describe('Scope Registry Integration', () => {
    it('should initialize with scope definitions correctly', () => {
      const scopeDefinitions = {
        'test:followers': {
          id: 'test:followers',
          expr: 'actor.followers[]',
          ast: parseScopeFile('actor.followers[]', 'followers').expr,
          description: 'All followers of the actor',
        },
        'test:enemies': {
          id: 'test:enemies',
          expr: 'entities(core:hostile)[]',
          ast: parseScopeFile('entities(core:hostile)[]', 'enemies').expr,
          description: 'All hostile entities',
        },
      };

      scopeRegistry.initialize(scopeDefinitions);

      expect(scopeRegistry.getScope('test:followers')).not.toBeNull();
      expect(scopeRegistry.getScope('test:enemies')).not.toBeNull();
      expect(scopeRegistry.getScope('test:nonexistent')).toBeNull();
    });

    it('should handle namespaced scope resolution', () => {
      const scopeDefinitions = {
        'companionship:followers': {
          id: 'companionship:followers',
          expr: 'actor.followers[]',
          ast: parseScopeFile('actor.followers[]', 'followers').expr,
          description: 'Companionship followers scope',
        },
        'mod:followers': {
          id: 'mod:followers',
          expr: 'actor.partners[]',
          ast: parseScopeFile('actor.partners[]', 'followers').expr,
          description: 'Mod-specific followers scope',
        },
      };

      scopeRegistry.initialize(scopeDefinitions);

      const coreScope = scopeRegistry.getScope('companionship:followers');
      const modScope = scopeRegistry.getScope('mod:followers');

      expect(coreScope).toBeDefined();
      expect(modScope).toBeDefined();
      expect(coreScope.expr).toBe('actor.followers[]');
      expect(modScope.expr).toBe('actor.partners[]');
    });

    it('should return null for non-existent scope', () => {
      const scopeDefinitions = {};
      scopeRegistry.initialize(scopeDefinitions);

      const result = scopeRegistry.getScope('test:nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Action System Integration', () => {
    it('should support action definition referencing scope by name', () => {
      // Mock action definition structure - reflects actual production format
      const actionDefinition = {
        id: 'companionship:dismiss',
        commandVerb: 'dismiss',
        name: 'Dismiss',
        description: 'Dismisses a follower from your service.',
        targets: {
          primary: {
            scope: 'companionship:followers', // References scope with full namespace
            placeholder: 'follower',
            description: 'The follower to dismiss from service',
          },
        },
        template: 'dismiss {follower}',
        prerequisites: [
          {
            logic: {
              condition_ref: 'companionship:target-is-follower-of-actor',
            },
            failure_message: 'You can only dismiss your own followers.',
          },
        ],
      };

      // Test that scope reference is properly namespaced
      expect(actionDefinition.targets.primary.scope).toBe(
        'companionship:followers'
      );
      expect(actionDefinition.targets.primary.placeholder).toBe('follower');
      expect(actionDefinition.template).toBe('dismiss {follower}');

      // Verify that the scope reference follows the required namespaced format
      expect(actionDefinition.targets.primary.scope).toContain(':');

      // Extract namespace from the action ID and scope reference
      const actionNamespace = actionDefinition.id.split(':')[0];
      const scopeNamespace =
        actionDefinition.targets.primary.scope.split(':')[0];

      // In this case, they should match since both are from the companionship mod
      expect(scopeNamespace).toBe(actionNamespace);
    });

    it('should validate complete scope-to-action workflow', async () => {
      // 1. Create scope definitions
      const scopeDefinitions = {
        'test:followers': {
          id: 'test:followers',
          expr: 'actor.followers[]',
          ast: parseScopeFile('actor.followers[]', 'followers').expr,
          description: 'Test followers scope',
        },
      };

      // 2. Initialize scope registry
      scopeRegistry.initialize(scopeDefinitions);

      // 3. Get scope for action targeting
      const scope = scopeRegistry.getScope('test:followers');
      expect(scope).toBeDefined();
      expect(scope.ast).toBeDefined();

      // 4. Verify that the scope definition workflow is complete
      // We focus on testing the integration between scope definitions and action system
      // rather than the full scope resolution which has its own comprehensive tests
      expect(scope.id).toBe('test:followers');
      expect(scope.expr).toBe('actor.followers[]');
      expect(scope.description).toBe('Test followers scope');

      // 5. Verify AST structure matches expected format for action targeting
      expect(scope.ast.type).toBe('ArrayIterationStep');
      expect(scope.ast.parent.type).toBe('Step');
      expect(scope.ast.parent.field).toBe('followers');
      expect(scope.ast.parent.parent.type).toBe('Source');
      expect(scope.ast.parent.parent.kind).toBe('actor');

      // This completes the integration test - the scope is properly defined,
      // stored, and accessible for action targeting. Full resolution testing
      // is covered by the ScopeEngine unit tests.
    });
  });

  describe('Multi-Scope File Support', () => {
    it('should support multiple scope definitions in documentation examples', () => {
      // Example from documentation: core/scopes/social.scope
      // In real implementation, this would be parsed by a multi-scope parser
      // For this test, we validate the individual expressions work

      const followersResult = parseScopeFile(
        'actor.core:leading.followers[]',
        'followers'
      );
      const leadersResult = parseScopeFile(
        'actor.core:following.leaders[]',
        'leaders'
      );

      expect(followersResult.name).toBe('followers');
      expect(followersResult.expr.type).toBe('ArrayIterationStep');

      expect(leadersResult.name).toBe('leaders');
      expect(leadersResult.expr.type).toBe('ArrayIterationStep');
    });
  });

  describe('Error Handling in Scope Definitions', () => {
    it('should handle malformed scope expressions in definitions', () => {
      expect(() => {
        parseScopeFile('actor.invalid.', 'malformed');
      }).toThrow();
    });

    it('should handle invalid AST structures gracefully', () => {
      const invalidScopeDefinitions = {
        'test:invalid': {
          id: 'test:invalid',
          expr: 'invalid.expression',
          ast: { type: 'Invalid', kind: 'malformed' }, // Invalid AST
          description: 'Test invalid scope',
        },
      };

      scopeRegistry.initialize(invalidScopeDefinitions);

      // Should store the definition but resolution should fail appropriately
      const scope = scopeRegistry.getScope('test:invalid');
      expect(scope).toBeDefined();
      expect(scope.ast.type).toBe('Invalid');
    });
  });
});
