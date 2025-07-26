# Ticket: Implement MultiTargetResolutionStage

## Ticket ID: PHASE2-TICKET4

## Priority: High

## Estimated Time: 8-10 hours

## Dependencies: PHASE1-TICKET1, PHASE1-TICKET2

## Blocks: PHASE2-TICKET5, PHASE2-TICKET6, PHASE3-TICKET8

## Overview

Create a new pipeline stage `MultiTargetResolutionStage` that replaces the existing `TargetResolutionStage`. This stage handles both legacy single-target actions and new multi-target actions, resolving targets sequentially with support for context dependencies between targets.

**Note**: The TargetContextBuilder and target-context schema were already implemented in PHASE1-TICKET2.

## Key Features

1. **Backward Compatibility**: Seamlessly handle legacy single-target actions
2. **Sequential Resolution**: Resolve targets in dependency order
3. **Context Propagation**: Pass resolved targets as context to dependent scopes
4. **Error Handling**: Clear error messages for resolution failures
5. **Performance**: Efficient resolution with caching where possible
6. **Tracing**: Comprehensive trace support for debugging

## Implementation Steps

### Step 1: Create MultiTargetResolutionStage Class

Create file: `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

```javascript
/**
 * @file MultiTargetResolutionStage - Pipeline stage for resolving multi-target actions
 */

// Type imports
/** @typedef {import('../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../interfaces/coreServices.js').IScopeInterpreter} IScopeInterpreter */
/** @typedef {import('../../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../interfaces/ITargetResolutionService.js').ITargetResolutionService} ITargetResolutionService */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../tracing/traceContext.js').TraceContext} TraceContext */
/** @typedef {import('../../../scopeDsl/utils/targetContextBuilder.js').default} TargetContextBuilder */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ActionResult } from '../../core/actionResult.js';

/**
 * @typedef {Object} TargetDefinition
 * @property {string} scope - Scope ID or expression
 * @property {string} placeholder - Template placeholder name
 * @property {string} [description] - Human-readable description
 * @property {string} [contextFrom] - Use another target as context
 * @property {boolean} [optional] - Whether target is optional
 */

/**
 * @typedef {Object} ResolvedTarget
 * @property {string} id - Entity ID
 * @property {string} displayName - Display name for formatting
 * @property {Object} entity - Full entity object
 */

/**
 * Pipeline stage that resolves action targets using scope DSL
 * Supports both single-target (legacy) and multi-target actions
 */
export class MultiTargetResolutionStage extends PipelineStage {
  #scopeInterpreter;
  #entityManager;
  #targetResolver;
  #contextBuilder;

  /**
   * @param {Object} deps
   * @param {IScopeInterpreter} deps.scopeInterpreter
   * @param {IEntityManager} deps.entityManager
   * @param {ITargetResolutionService} deps.targetResolver
   * @param {TargetContextBuilder} deps.targetContextBuilder
   * @param {ILogger} deps.logger
   */
  constructor({
    scopeInterpreter,
    entityManager,
    targetResolver,
    targetContextBuilder,
    logger,
  }) {
    super({ logger });
    validateDependency(scopeInterpreter, 'IScopeInterpreter');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(targetResolver, 'ITargetResolutionService');
    validateDependency(targetContextBuilder, 'TargetContextBuilder');

    this.#scopeInterpreter = scopeInterpreter;
    this.#entityManager = entityManager;
    this.#targetResolver = targetResolver;
    this.#contextBuilder = targetContextBuilder;
  }

  /**
   * Execute target resolution
   * @param {Object} context - Pipeline context
   * @param {ActionDefinition} context.actionDef - Action definition
   * @param {Entity} context.actor - Acting entity
   * @param {Object} context.actionContext - Action discovery context
   * @param {TraceContext} [trace] - Trace context
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context, trace) {
    const { actionDef, actor, actionContext } = context;

    trace?.step(
      `Resolving targets for action '${actionDef.id}'`,
      'MultiTargetResolutionStage'
    );

    try {
      // Check if this is a legacy single-target action
      if (this.#isLegacyAction(actionDef)) {
        return this.#resolveLegacyTarget(context, trace);
      }

      // Resolve multi-target action
      return this.#resolveMultiTargets(context, trace);
    } catch (error) {
      this.logger.error(
        `Error resolving targets for action '${actionDef.id}':`,
        error
      );
      return PipelineResult.error(error, 'MultiTargetResolutionStage');
    }
  }

  /**
   * Check if action uses legacy single-target format
   * @private
   */
  #isLegacyAction(actionDef) {
    return (
      typeof actionDef.targets === 'string' ||
      (actionDef.scope && !actionDef.targets)
    );
  }

  /**
   * Resolve legacy single-target action for backward compatibility
   * @private
   */
  async #resolveLegacyTarget(context, trace) {
    const { actionDef, actor, actionContext } = context;
    const scope = actionDef.targets || actionDef.scope;

    trace?.step(
      `Resolving legacy scope '${scope}'`,
      'MultiTargetResolutionStage'
    );

    // Use existing target resolver for compatibility
    const result = await this.#targetResolver.resolveTargets(
      scope,
      actor,
      actionContext,
      trace,
      actionDef.id
    );

    if (!result.success) {
      return PipelineResult.error(result.error, 'MultiTargetResolutionStage');
    }

    const targetContexts = result.value;

    if (targetContexts.length === 0) {
      trace?.info(
        'No targets found for legacy action',
        'MultiTargetResolutionStage'
      );
      return PipelineResult.skip('No targets found');
    }

    // Convert to multi-target format for consistency
    const resolvedTargets = {
      primary: targetContexts.map((tc) => ({
        id: tc.entityId,
        displayName: tc.displayName || tc.entityId,
        entity: this.#entityManager.getEntity(tc.entityId),
      })),
    };

    return PipelineResult.continue({
      ...context,
      resolvedTargets,
      targetContexts, // Keep for backward compatibility
    });
  }

  /**
   * Resolve multi-target action
   * @private
   */
  async #resolveMultiTargets(context, trace) {
    const { actionDef, actor, actionContext } = context;
    const targetDefs = actionDef.targets;

    // Validate targets object
    if (!targetDefs || typeof targetDefs !== 'object') {
      return PipelineResult.error(
        new Error('Invalid targets configuration'),
        'MultiTargetResolutionStage'
      );
    }

    // Get resolution order based on dependencies
    const resolutionOrder = this.#getResolutionOrder(targetDefs);
    trace?.info(
      `Target resolution order: ${resolutionOrder.join(', ')}`,
      'MultiTargetResolutionStage'
    );

    // Resolve targets sequentially
    const resolvedTargets = {};
    const allTargetContexts = []; // For backward compatibility

    for (const targetKey of resolutionOrder) {
      const targetDef = targetDefs[targetKey];
      trace?.step(
        `Resolving ${targetKey} target`,
        'MultiTargetResolutionStage'
      );

      // Build scope context
      const scopeContext = this.#buildScopeContext(
        actor,
        actionContext,
        resolvedTargets,
        targetDef,
        trace
      );

      // Resolve scope
      const candidates = await this.#resolveScope(
        targetDef.scope,
        scopeContext,
        trace
      );

      // Check if target is required
      if (!targetDef.optional && candidates.length === 0) {
        trace?.failure(
          `No candidates found for required target '${targetKey}'`,
          'MultiTargetResolutionStage'
        );
        return PipelineResult.skip(`No ${targetKey} targets found`);
      }

      // Store resolved targets
      resolvedTargets[targetKey] = candidates.map((entityId) => ({
        id: entityId,
        displayName: this.#getEntityDisplayName(entityId),
        entity: this.#entityManager.getEntity(entityId),
      }));

      // Add to flat list for backward compatibility
      candidates.forEach((entityId) => {
        allTargetContexts.push({
          entityId,
          displayName: this.#getEntityDisplayName(entityId),
          placeholder: targetDef.placeholder,
        });
      });

      trace?.success(
        `Resolved ${candidates.length} candidates for ${targetKey}`,
        'MultiTargetResolutionStage'
      );
    }

    // Check if we have at least one valid target
    const hasTargets = Object.values(resolvedTargets).some(
      (targets) => targets.length > 0
    );
    if (!hasTargets) {
      return PipelineResult.skip('No targets found for any target definition');
    }

    return PipelineResult.continue({
      ...context,
      resolvedTargets,
      targetContexts: allTargetContexts, // Backward compatibility
      targetDefinitions: targetDefs, // Pass definitions for formatting
    });
  }

  /**
   * Determine target resolution order based on dependencies
   * @private
   */
  #getResolutionOrder(targetDefs) {
    const order = [];
    const pending = new Set(Object.keys(targetDefs));
    const maxIterations = pending.size * 2; // Prevent infinite loops
    let iterations = 0;

    while (pending.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find targets with no unresolved dependencies
      const ready = Array.from(pending).filter((key) => {
        const targetDef = targetDefs[key];

        // No dependencies
        if (!targetDef.contextFrom) return true;

        // Dependency already resolved
        return order.includes(targetDef.contextFrom);
      });

      if (ready.length === 0) {
        // Circular dependency or invalid reference
        const remaining = Array.from(pending);
        throw new Error(
          `Circular dependency detected in target resolution: ${remaining.join(', ')}`
        );
      }

      // Add ready targets to order
      ready.forEach((key) => {
        order.push(key);
        pending.delete(key);
      });
    }

    return order;
  }

  /**
   * Build scope evaluation context
   * @private
   */
  #buildScopeContext(actor, actionContext, resolvedTargets, targetDef, trace) {
    // Start with base context
    const baseContext = this.#contextBuilder.buildBaseContext(
      actor.id,
      actionContext.location?.id ||
        actor.getComponent('core:position')?.locationId
    );

    // Add resolved targets if this is a dependent target
    if (targetDef.contextFrom || Object.keys(resolvedTargets).length > 0) {
      return this.#contextBuilder.buildDependentContext(
        baseContext,
        resolvedTargets,
        targetDef
      );
    }

    return baseContext;
  }

  /**
   * Resolve a scope expression to entity IDs
   * @private
   */
  async #resolveScope(scope, context, trace) {
    try {
      trace?.step(`Evaluating scope '${scope}'`, 'MultiTargetResolutionStage');

      // Resolve scope using interpreter
      const result = await this.#scopeInterpreter.evaluate(scope, context, {
        trace,
        cache: true,
      });

      // Filter to valid entity IDs
      const entityIds = result.filter((id) => {
        if (typeof id !== 'string') return false;

        // Verify entity exists
        const entity = this.#entityManager.getEntity(id);
        return entity !== null;
      });

      trace?.info(
        `Scope resolved to ${entityIds.length} entities`,
        'MultiTargetResolutionStage'
      );

      return entityIds;
    } catch (error) {
      this.logger.error(`Error evaluating scope '${scope}':`, error);
      trace?.failure(
        `Scope evaluation failed: ${error.message}`,
        'MultiTargetResolutionStage'
      );
      return [];
    }
  }

  /**
   * Get display name for an entity
   * @private
   */
  #getEntityDisplayName(entityId) {
    try {
      const entity = this.#entityManager.getEntity(entityId);
      if (!entity) return entityId;

      // Try common name sources
      const name =
        entity.getComponent('core:description')?.name ||
        entity.getComponent('core:actor')?.name ||
        entity.getComponent('core:item')?.name ||
        entityId;

      return name;
    } catch (error) {
      return entityId;
    }
  }
}

export default MultiTargetResolutionStage;
```

### Step 2: Update Dependency Injection Registration

Update file: `src/dependencyInjection/registrations/commandAndActionRegistrations.js`

Add the following imports at the top:
```javascript
import { MultiTargetResolutionStage } from '../../actions/pipeline/stages/MultiTargetResolutionStage.js';
import TargetContextBuilder from '../../scopeDsl/utils/targetContextBuilder.js';
```

Add the following token to `src/dependencyInjection/tokens.js`:
```javascript
IMultiTargetResolutionStage: Symbol('IMultiTargetResolutionStage'),
ITargetContextBuilder: Symbol('ITargetContextBuilder'),
```

Add the following registrations in the `registerCommandAndAction` function:
```javascript
// --- Target Context Builder ---
// Must be registered before MultiTargetResolutionStage
registrar.singletonFactory(tokens.ITargetContextBuilder, (c) => {
  return new TargetContextBuilder({
    entityManager: c.resolve(tokens.IEntityManager),
    gameStateManager: c.resolve(tokens.IGameStateManager),
    logger: c.resolve(tokens.ILogger),
  });
});
logger.debug(
  'Command and Action Registration: Registered TargetContextBuilder.'
);

// --- Multi-Target Resolution Stage ---
registrar.singletonFactory(tokens.IMultiTargetResolutionStage, (c) => {
  return new MultiTargetResolutionStage({
    scopeInterpreter: c.resolve(tokens.IScopeInterpreter),
    entityManager: c.resolve(tokens.IEntityManager),
    targetResolver: c.resolve(tokens.ITargetResolutionService),
    targetContextBuilder: c.resolve(tokens.ITargetContextBuilder),
    logger: c.resolve(tokens.ILogger),
  });
});
logger.debug(
  'Command and Action Registration: Registered MultiTargetResolutionStage.'
);
```

### Step 3: Create Unit Tests

Create file: `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';

describe('MultiTargetResolutionStage', () => {
  let stage;
  let mockDeps;
  let mockContext;

  beforeEach(() => {
    // Create mock dependencies
    mockDeps = {
      scopeInterpreter: {
        evaluate: jest.fn(),
      },
      entityManager: {
        getEntity: jest.fn(),
      },
      targetResolver: {
        resolveTargets: jest.fn(),
      },
      targetContextBuilder: {
        buildBaseContext: jest.fn(),
        buildDependentContext: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    // Create stage instance
    stage = new MultiTargetResolutionStage(mockDeps);

    // Create mock context
    mockContext = {
      actionDef: {
        id: 'test:action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
          },
        },
      },
      actor: {
        id: 'player',
        getComponent: jest.fn(),
      },
      actionContext: {
        location: { id: 'room' },
      },
    };
  });

  describe('Legacy Action Support', () => {
    it('should handle string targets property', async () => {
      mockContext.actionDef = {
        id: 'test:legacy',
        targets: 'test:valid_targets',
        template: 'test {target}',
      };

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntity.mockReturnValue({
        id: 'target1',
        components: {},
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets).toEqual({
        primary: [
          {
            id: 'target1',
            displayName: 'Target 1',
            entity: { id: 'target1', components: {} },
          },
        ],
      });
    });

    it('should handle legacy scope property', async () => {
      mockContext.actionDef = {
        id: 'test:legacy',
        scope: 'test:valid_targets', // Old property
        template: 'test {target}',
      };

      mockDeps.targetResolver.resolveTargets.mockResolvedValue({
        success: true,
        value: [{ entityId: 'target1', displayName: 'Target 1' }],
      });

      mockDeps.entityManager.getEntity.mockReturnValue({
        id: 'target1',
        components: {},
      });

      const result = await stage.executeInternal(mockContext);

      expect(mockDeps.targetResolver.resolveTargets).toHaveBeenCalledWith(
        'test:valid_targets',
        mockContext.actor,
        mockContext.actionContext,
        undefined,
        'test:legacy'
      );
      expect(result.shouldContinue).toBe(true);
    });
  });

  describe('Multi-Target Resolution', () => {
    it('should resolve single primary target', async () => {
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      mockDeps.scopeInterpreter.evaluate.mockResolvedValue(['item1', 'item2']);

      mockDeps.entityManager.getEntity
        .mockReturnValueOnce({ id: 'item1', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item2', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item1', getComponent: jest.fn() })
        .mockReturnValueOnce({ id: 'item2', getComponent: jest.fn() });

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets.primary).toHaveLength(2);
      expect(result.data.resolvedTargets.primary[0].id).toBe('item1');
      expect(result.data.resolvedTargets.primary[1].id).toBe('item2');
    });

    it('should resolve dependent targets with context', async () => {
      mockContext.actionDef.targets = {
        primary: {
          scope: 'test:actors',
          placeholder: 'person',
        },
        secondary: {
          scope: 'test:target_items',
          placeholder: 'item',
          contextFrom: 'primary',
        },
      };

      // Setup base context
      const baseContext = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      };
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue(
        baseContext
      );

      // First resolution (primary)
      mockDeps.scopeInterpreter.evaluate.mockResolvedValueOnce(['npc1']);

      mockDeps.entityManager.getEntity.mockReturnValue({
        id: 'npc1',
        getComponent: jest.fn(),
      });

      // Setup dependent context
      const dependentContext = {
        ...baseContext,
        target: { id: 'npc1', components: {} },
        targets: {
          primary: [{ id: 'npc1', components: {} }],
        },
      };
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue(
        dependentContext
      );

      // Second resolution (secondary)
      mockDeps.scopeInterpreter.evaluate.mockResolvedValueOnce([
        'item1',
        'item2',
      ]);

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(
        mockDeps.targetContextBuilder.buildDependentContext
      ).toHaveBeenCalledWith(
        baseContext,
        expect.objectContaining({
          primary: expect.arrayContaining([
            expect.objectContaining({ id: 'npc1' }),
          ]),
        }),
        mockContext.actionDef.targets.secondary
      );
    });

    it('should handle optional targets', async () => {
      mockContext.actionDef.targets = {
        primary: {
          scope: 'test:required',
          placeholder: 'main',
        },
        secondary: {
          scope: 'test:optional',
          placeholder: 'extra',
          optional: true,
        },
      };

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // Primary resolves successfully
      mockDeps.scopeInterpreter.evaluate.mockResolvedValueOnce(['target1']);

      // Secondary resolves to empty (but is optional)
      mockDeps.scopeInterpreter.evaluate.mockResolvedValueOnce([]);

      mockDeps.entityManager.getEntity.mockReturnValue({
        id: 'target1',
        getComponent: jest.fn(),
      });

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets.primary).toHaveLength(1);
      expect(result.data.resolvedTargets.secondary).toHaveLength(0);
    });

    it('should skip when required target has no candidates', async () => {
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 },
      });

      // No candidates found
      mockDeps.scopeInterpreter.evaluate.mockResolvedValue([]);

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('No primary targets found');
    });
  });

  describe('Resolution Order', () => {
    it('should resolve targets in dependency order', async () => {
      mockContext.actionDef.targets = {
        secondary: {
          scope: 'test:dependent',
          placeholder: 'dep',
          contextFrom: 'primary',
        },
        primary: {
          scope: 'test:base',
          placeholder: 'base',
        },
        tertiary: {
          scope: 'test:final',
          placeholder: 'final',
          contextFrom: 'secondary',
        },
      };

      const evaluationOrder = [];
      mockDeps.scopeInterpreter.evaluate.mockImplementation((scope) => {
        evaluationOrder.push(scope);
        return ['dummy'];
      });

      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.targetContextBuilder.buildDependentContext.mockReturnValue({});
      mockDeps.entityManager.getEntity.mockReturnValue({ id: 'dummy' });

      await stage.executeInternal(mockContext);

      expect(evaluationOrder).toEqual([
        'test:base', // primary first (no deps)
        'test:dependent', // secondary next (depends on primary)
        'test:final', // tertiary last (depends on secondary)
      ]);
    });

    it('should detect circular dependencies', async () => {
      mockContext.actionDef.targets = {
        primary: {
          scope: 'test:a',
          placeholder: 'a',
          contextFrom: 'secondary',
        },
        secondary: {
          scope: 'test:b',
          placeholder: 'b',
          contextFrom: 'primary',
        },
      };

      const result = await stage.executeInternal(mockContext);

      expect(result.isError).toBe(true);
      expect(result.error.message).toContain('Circular dependency');
    });
  });

  describe('Error Handling', () => {
    it('should handle scope evaluation errors gracefully', async () => {
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.scopeInterpreter.evaluate.mockRejectedValue(
        new Error('Invalid scope syntax')
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    it('should filter out non-string entity IDs', async () => {
      mockDeps.targetContextBuilder.buildBaseContext.mockReturnValue({});
      mockDeps.scopeInterpreter.evaluate.mockResolvedValue([
        'valid_id',
        123, // Invalid
        null, // Invalid
        undefined, // Invalid
        { id: 'x' }, // Invalid
        'another_valid',
      ]);

      mockDeps.entityManager.getEntity.mockImplementation((id) =>
        ['valid_id', 'another_valid'].includes(id) ? { id } : null
      );

      const result = await stage.executeInternal(mockContext);

      expect(result.data.resolvedTargets.primary).toHaveLength(2);
      expect(result.data.resolvedTargets.primary[0].id).toBe('valid_id');
      expect(result.data.resolvedTargets.primary[1].id).toBe('another_valid');
    });
  });
});
```

## Testing Strategy

### Unit Tests

1. Legacy action compatibility
2. Multi-target resolution logic
3. Dependency ordering algorithm
4. Context building for dependent targets
5. Error handling and edge cases

### Integration Tests

1. Full pipeline integration
2. Scope interpreter integration
3. Entity manager integration
4. Performance with large target sets

### Performance Tests

1. Resolution speed with multiple targets
2. Memory usage with large result sets
3. Caching effectiveness

## Acceptance Criteria

1. ✅ Stage handles legacy single-target actions without breaking changes
2. ✅ Multi-target actions resolve in correct dependency order
3. ✅ Context is properly built and passed to dependent scopes
4. ✅ Optional targets don't block action availability
5. ✅ Circular dependencies are detected and reported
6. ✅ Non-existent entities are filtered from results
7. ✅ Comprehensive trace logging for debugging
8. ✅ Performance targets met (<50ms for typical cases)
9. ✅ All unit tests pass with >95% coverage
10. ✅ Integration with existing pipeline components works

## Migration Notes

### For Pipeline Configuration

Replace TargetResolutionStage with MultiTargetResolutionStage:

```javascript
// Before
pipeline.addStage(new TargetResolutionStage(deps));

// After
pipeline.addStage(new MultiTargetResolutionStage(deps));
```

### For Action Definitions

No changes needed - backward compatibility maintained.

## Performance Optimization

1. **Scope Caching**: Cache scope results within same turn
2. **Entity Caching**: Cache entity lookups during resolution
3. **Lazy Context Building**: Only build needed context properties
4. **Parallel Resolution**: Consider parallel resolution for independent targets

## Security Considerations

1. Validate all entity IDs before lookup
2. Prevent infinite loops in dependency resolution
3. Limit maximum targets per action
4. Sanitize display names for UI rendering

## Future Enhancements

1. Support for more complex dependency graphs
2. Parallel resolution of independent targets
3. Target validation beyond existence checks
4. Custom resolution strategies per target
5. Target result transformations
