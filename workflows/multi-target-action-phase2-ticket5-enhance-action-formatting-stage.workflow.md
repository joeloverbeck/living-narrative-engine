# Ticket: Enhance ActionFormattingStage for Multi-Target Support

## Ticket ID: PHASE2-TICKET5

## Priority: High

## Estimated Time: 6-8 hours

## Dependencies: PHASE2-TICKET4

## Blocks: PHASE4-TICKET11, PHASE4-TICKET13

## Overview

Enhance the existing ActionFormattingStage to support multi-target action formatting, including the ability to generate combinations of targets when `generateCombinations` is enabled. The stage must handle multi-placeholder template substitution while maintaining backward compatibility with single-target actions.

## Key Features

1. **Multi-Placeholder Substitution**: Replace multiple placeholders in templates
2. **Combination Generation**: Create cartesian product of target combinations
3. **Backward Compatibility**: Continue supporting single {target} placeholder
4. **Flexible Formatting**: Support custom display name resolution
5. **Performance**: Efficient combination generation for large target sets
6. **Validation**: Ensure placeholders match template variables

## Implementation Steps

### Step 1: Update ActionFormattingStage Class

Update file: `src/actions/pipeline/stages/ActionFormattingStage.js`

```javascript
/**
 * @file Enhanced ActionFormattingStage with multi-target support
 */

// Type imports
/** @typedef {import('../../actionTypes.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../logging/consoleLogger.js').default} ILogger */
/** @typedef {import('../../tracing/traceContext.js').TraceContext} TraceContext */

import { PipelineStage } from '../PipelineStage.js';
import { PipelineResult } from '../PipelineResult.js';
import { validateDependency } from '../../../utils/validationUtils.js';

/**
 * @typedef {Object} FormattedAction
 * @property {string} actionId - Action definition ID
 * @property {string} actorId - Actor entity ID
 * @property {Object} targets - Target entities keyed by definition name
 * @property {string} formattedText - Formatted action text
 * @property {Object} metadata - Additional formatting metadata
 */

/**
 * Pipeline stage that formats actions with resolved targets
 * Supports both single-target (legacy) and multi-target formatting
 */
export class ActionFormattingStage extends PipelineStage {
  #entityManager;
  #displayNameResolver;
  #maxCombinations;

  /**
   * @param {Object} deps
   * @param {EntityManager} deps.entityManager
   * @param {Function} [deps.displayNameResolver] - Custom display name function
   * @param {number} [deps.maxCombinations=100] - Maximum combinations to generate
   * @param {ILogger} deps.logger
   */
  constructor({
    entityManager,
    displayNameResolver,
    maxCombinations = 100,
    logger,
  }) {
    super({ logger });
    validateDependency(entityManager, 'IEntityManager');

    this.#entityManager = entityManager;
    this.#displayNameResolver =
      displayNameResolver || this.#defaultDisplayNameResolver.bind(this);
    this.#maxCombinations = maxCombinations;
  }

  /**
   * Execute action formatting
   * @param {Object} context - Pipeline context
   * @param {ActionDefinition} context.actionDef - Action definition
   * @param {Entity} context.actor - Acting entity
   * @param {Object} context.resolvedTargets - Resolved targets by definition name
   * @param {Array} [context.targetContexts] - Legacy target contexts
   * @param {Object} [context.targetDefinitions] - Target definitions from action
   * @param {TraceContext} [trace] - Trace context
   * @returns {Promise<PipelineResult>}
   */
  async executeInternal(context, trace) {
    const { actionDef, actor, resolvedTargets, targetContexts } = context;

    trace?.step(`Formatting action '${actionDef.id}'`, 'ActionFormattingStage');

    try {
      // Handle legacy single-target formatting
      if (this.#isLegacyFormat(context)) {
        return this.#formatLegacyAction(context, trace);
      }

      // Handle multi-target formatting
      if (actionDef.generateCombinations) {
        return this.#generateCombinations(context, trace);
      }

      // Format single action with all targets
      return this.#formatSingleAction(context, trace);
    } catch (error) {
      this.logger.error(`Error formatting action '${actionDef.id}':`, error);
      return PipelineResult.error(error, 'ActionFormattingStage');
    }
  }

  /**
   * Check if this is legacy single-target format
   * @private
   */
  #isLegacyFormat(context) {
    const { resolvedTargets, targetContexts } = context;

    // Legacy format has targetContexts but not multi-target resolvedTargets
    return (
      targetContexts &&
      (!resolvedTargets ||
        (Object.keys(resolvedTargets).length === 1 && resolvedTargets.primary))
    );
  }

  /**
   * Format legacy single-target action
   * @private
   */
  #formatLegacyAction(context, trace) {
    const { actionDef, actor, targetContexts } = context;

    trace?.step(
      'Formatting legacy single-target action',
      'ActionFormattingStage'
    );

    const formattedActions = targetContexts.map((targetContext) => {
      const displayName =
        targetContext.displayName ||
        this.#displayNameResolver(targetContext.entityId);

      const formattedText = actionDef.template.replace(
        /\{target\}/g,
        displayName
      );

      return {
        actionId: actionDef.id,
        actorId: actor.id,
        targetId: targetContext.entityId, // Legacy field
        targets: {
          primary: {
            id: targetContext.entityId,
            displayName,
          },
        },
        formattedText,
        metadata: {
          isLegacy: true,
        },
      };
    });

    trace?.success(
      `Formatted ${formattedActions.length} legacy actions`,
      'ActionFormattingStage'
    );

    return PipelineResult.continue({
      ...context,
      formattedActions,
    });
  }

  /**
   * Generate all combinations of targets
   * @private
   */
  #generateCombinations(context, trace) {
    const { actionDef, actor, resolvedTargets } = context;

    trace?.step('Generating target combinations', 'ActionFormattingStage');

    // Get target keys that have candidates
    const targetKeys = Object.keys(resolvedTargets).filter(
      (key) => resolvedTargets[key].length > 0
    );

    if (targetKeys.length === 0) {
      return PipelineResult.skip('No targets to combine');
    }

    // Calculate total combinations
    const totalCombinations = targetKeys.reduce(
      (total, key) => total * resolvedTargets[key].length,
      1
    );

    if (totalCombinations > this.#maxCombinations) {
      trace?.warn(
        `Too many combinations (${totalCombinations}), limiting to ${this.#maxCombinations}`,
        'ActionFormattingStage'
      );
    }

    // Generate combinations
    const combinations = this.#cartesianProduct(resolvedTargets, targetKeys);
    const limitedCombinations = combinations.slice(0, this.#maxCombinations);

    // Format each combination
    const formattedActions = limitedCombinations.map((targetMap) =>
      this.#formatActionWithTargets(
        actionDef,
        actor,
        targetMap,
        context.targetDefinitions
      )
    );

    trace?.success(
      `Generated ${formattedActions.length} action combinations`,
      'ActionFormattingStage'
    );

    return PipelineResult.continue({
      ...context,
      formattedActions,
      metadata: {
        totalCombinations,
        limitedTo: formattedActions.length,
      },
    });
  }

  /**
   * Format single action with first of each target
   * @private
   */
  #formatSingleAction(context, trace) {
    const { actionDef, actor, resolvedTargets } = context;

    trace?.step(
      'Formatting single multi-target action',
      'ActionFormattingStage'
    );

    // Use first target from each definition
    const targetMap = {};
    for (const [key, targets] of Object.entries(resolvedTargets)) {
      if (targets.length > 0) {
        targetMap[key] = targets[0];
      }
    }

    const formattedAction = this.#formatActionWithTargets(
      actionDef,
      actor,
      targetMap,
      context.targetDefinitions
    );

    return PipelineResult.continue({
      ...context,
      formattedActions: [formattedAction],
    });
  }

  /**
   * Format an action with specific targets
   * @private
   */
  #formatActionWithTargets(actionDef, actor, targetMap, targetDefinitions) {
    let formattedText = actionDef.template;
    const targets = {};

    // Get target definitions from action or context
    const targetDefs = targetDefinitions || actionDef.targets || {};

    // Replace each placeholder
    for (const [key, target] of Object.entries(targetMap)) {
      const targetDef = this.#getTargetDefinition(targetDefs, key);
      const placeholder = targetDef?.placeholder || 'target';
      const displayName =
        target.displayName || this.#displayNameResolver(target.id);

      // Replace all occurrences of the placeholder
      const placeholderRegex = new RegExp(`\\{${placeholder}\\}`, 'g');
      formattedText = formattedText.replace(placeholderRegex, displayName);

      // Store formatted target info
      targets[key] = {
        id: target.id,
        displayName,
        placeholder,
      };
    }

    // Build result
    const result = {
      actionId: actionDef.id,
      actorId: actor.id,
      targets,
      formattedText,
      metadata: {
        templateOriginal: actionDef.template,
        placeholdersReplaced: Object.keys(targets).length,
      },
    };

    // Add legacy targetId for backward compatibility (primary target)
    if (targets.primary) {
      result.targetId = targets.primary.id;
    }

    return result;
  }

  /**
   * Get target definition by key
   * @private
   */
  #getTargetDefinition(targetDefs, key) {
    // Handle both object and string format
    if (typeof targetDefs === 'string') {
      // Legacy format
      return { placeholder: 'target' };
    }

    return targetDefs[key] || null;
  }

  /**
   * Generate cartesian product of targets
   * @private
   */
  #cartesianProduct(resolvedTargets, targetKeys) {
    const combinations = [];
    const indices = new Array(targetKeys.length).fill(0);
    const limits = targetKeys.map((key) => resolvedTargets[key].length);

    while (true) {
      // Create combination for current indices
      const targetMap = {};
      targetKeys.forEach((key, i) => {
        targetMap[key] = resolvedTargets[key][indices[i]];
      });

      combinations.push(targetMap);

      // Stop if we've reached the limit
      if (combinations.length >= this.#maxCombinations) {
        break;
      }

      // Increment indices
      let carry = 1;
      for (let i = targetKeys.length - 1; i >= 0 && carry; i--) {
        indices[i] += carry;
        if (indices[i] >= limits[i]) {
          indices[i] = 0;
        } else {
          carry = 0;
        }
      }

      // All combinations generated
      if (carry) break;
    }

    return combinations;
  }

  /**
   * Default display name resolver
   * @private
   */
  #defaultDisplayNameResolver(entityId) {
    try {
      const entity = this.#entityManager.getEntity(entityId);
      if (!entity) return entityId;

      // Try common name sources in order
      const nameSources = [
        () => entity.getComponent('core:description')?.name,
        () => entity.getComponent('core:actor')?.name,
        () => entity.getComponent('core:item')?.name,
        () => entity.getComponent('core:location')?.name,
        () => {
          // Try to build name from type
          const item = entity.getComponent('core:item');
          if (item?.type) {
            return `${item.type} (${entityId})`;
          }
          return null;
        },
      ];

      for (const getNameFn of nameSources) {
        const name = getNameFn();
        if (name) return name;
      }

      // Fallback to entity ID
      return entityId;
    } catch (error) {
      this.logger.warn(`Error resolving display name for ${entityId}:`, error);
      return entityId;
    }
  }
}

export default ActionFormattingStage;
```

### Step 2: Create Formatting Utilities

Create file: `src/actions/utils/formattingUtils.js`

```javascript
/**
 * @file Utilities for action formatting
 */

/**
 * Validate that all placeholders in template have corresponding targets
 * @param {string} template - Action template string
 * @param {Object} targetDefinitions - Target definitions with placeholders
 * @returns {Object} Validation result
 */
export function validateTemplatePlaceholders(template, targetDefinitions) {
  // Extract all placeholders from template
  const placeholderRegex = /\{([^}]+)\}/g;
  const foundPlaceholders = new Set();
  let match;

  while ((match = placeholderRegex.exec(template)) !== null) {
    foundPlaceholders.add(match[1]);
  }

  // Get defined placeholders
  const definedPlaceholders = new Set();

  if (typeof targetDefinitions === 'string') {
    // Legacy format always uses 'target'
    definedPlaceholders.add('target');
  } else if (targetDefinitions && typeof targetDefinitions === 'object') {
    // Multi-target format
    for (const targetDef of Object.values(targetDefinitions)) {
      if (targetDef.placeholder) {
        definedPlaceholders.add(targetDef.placeholder);
      }
    }
  }

  // Find missing and extra placeholders
  const missing = Array.from(foundPlaceholders).filter(
    (p) => !definedPlaceholders.has(p)
  );
  const extra = Array.from(definedPlaceholders).filter(
    (p) => !foundPlaceholders.has(p)
  );

  return {
    valid: missing.length === 0,
    missing,
    extra,
    foundPlaceholders: Array.from(foundPlaceholders),
    definedPlaceholders: Array.from(definedPlaceholders),
  };
}

/**
 * Escape special regex characters in placeholder names
 * @param {string} placeholder - Placeholder name
 * @returns {string} Escaped placeholder
 */
export function escapePlaceholder(placeholder) {
  return placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a display name formatter function
 * @param {Object} options - Formatter options
 * @returns {Function} Display name formatter
 */
export function createDisplayNameFormatter(options = {}) {
  const { includeId = false, maxLength = 50, ellipsis = '...' } = options;

  return (name, entityId) => {
    let displayName = name || entityId;

    // Truncate if needed
    if (displayName.length > maxLength) {
      displayName =
        displayName.substring(0, maxLength - ellipsis.length) + ellipsis;
    }

    // Add ID if requested
    if (includeId && name && name !== entityId) {
      displayName += ` (${entityId})`;
    }

    return displayName;
  };
}

/**
 * Estimate number of combinations without generating them
 * @param {Object} resolvedTargets - Resolved targets by key
 * @returns {number} Estimated combinations
 */
export function estimateCombinations(resolvedTargets) {
  return Object.values(resolvedTargets).reduce(
    (total, targets) => total * Math.max(1, targets.length),
    1
  );
}
```

### Step 3: Create Unit Tests

Create file: `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';

describe('ActionFormattingStage', () => {
  let stage;
  let mockEntityManager;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: jest.fn(),
    };

    stage = new ActionFormattingStage({
      entityManager: mockEntityManager,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    mockContext = {
      actionDef: {
        id: 'test:action',
        template: 'use {item} on {target}',
      },
      actor: { id: 'player' },
      resolvedTargets: {
        primary: [
          { id: 'item1', displayName: 'Sword' },
          { id: 'item2', displayName: 'Shield' },
        ],
        secondary: [
          { id: 'npc1', displayName: 'Goblin' },
          { id: 'npc2', displayName: 'Orc' },
        ],
      },
      targetDefinitions: {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      },
    };
  });

  describe('Legacy Format Support', () => {
    it('should format legacy single-target actions', async () => {
      mockContext = {
        actionDef: {
          id: 'test:legacy',
          template: 'attack {target}',
        },
        actor: { id: 'player' },
        targetContexts: [
          { entityId: 'enemy1', displayName: 'Goblin' },
          { entityId: 'enemy2', displayName: 'Orc' },
        ],
      };

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(2);
      expect(result.data.formattedActions[0]).toEqual({
        actionId: 'test:legacy',
        actorId: 'player',
        targetId: 'enemy1',
        targets: {
          primary: {
            id: 'enemy1',
            displayName: 'Goblin',
          },
        },
        formattedText: 'attack Goblin',
        metadata: { isLegacy: true },
      });
    });
  });

  describe('Multi-Target Formatting', () => {
    it('should format single multi-target action', async () => {
      mockContext.actionDef.generateCombinations = false;

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(1);
      expect(result.data.formattedActions[0]).toEqual({
        actionId: 'test:action',
        actorId: 'player',
        targetId: 'item1', // Primary target for compatibility
        targets: {
          primary: {
            id: 'item1',
            displayName: 'Sword',
            placeholder: 'item',
          },
          secondary: {
            id: 'npc1',
            displayName: 'Goblin',
            placeholder: 'target',
          },
        },
        formattedText: 'use Sword on Goblin',
        metadata: {
          templateOriginal: 'use {item} on {target}',
          placeholdersReplaced: 2,
        },
      });
    });

    it('should generate all combinations when enabled', async () => {
      mockContext.actionDef.generateCombinations = true;

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(4); // 2 items × 2 targets

      const texts = result.data.formattedActions.map((a) => a.formattedText);
      expect(texts).toEqual([
        'use Sword on Goblin',
        'use Sword on Orc',
        'use Shield on Goblin',
        'use Shield on Orc',
      ]);
    });

    it('should limit combinations to maxCombinations', async () => {
      // Create stage with limit of 2
      stage = new ActionFormattingStage({
        entityManager: mockEntityManager,
        maxCombinations: 2,
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      });

      mockContext.actionDef.generateCombinations = true;

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(2); // Limited to 2
      expect(result.data.metadata.totalCombinations).toBe(4);
      expect(result.data.metadata.limitedTo).toBe(2);
    });
  });

  describe('Display Name Resolution', () => {
    it('should use custom display name resolver', async () => {
      const customResolver = jest.fn().mockReturnValue('Custom Name');

      stage = new ActionFormattingStage({
        entityManager: mockEntityManager,
        displayNameResolver: customResolver,
        logger: {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      });

      // Remove display names to force resolver usage
      mockContext.resolvedTargets.primary[0].displayName = null;

      const result = await stage.executeInternal(mockContext);

      expect(customResolver).toHaveBeenCalledWith('item1');
      expect(result.data.formattedActions[0].targets.primary.displayName).toBe(
        'Custom Name'
      );
    });

    it('should fall back to entity ID when name not found', async () => {
      mockEntityManager.getEntity.mockReturnValue(null);

      mockContext.resolvedTargets.primary[0].displayName = null;

      const result = await stage.executeInternal(mockContext);

      expect(result.data.formattedActions[0].targets.primary.displayName).toBe(
        'item1'
      );
    });
  });

  describe('Placeholder Handling', () => {
    it('should handle multiple occurrences of same placeholder', async () => {
      mockContext.actionDef.template = 'give {item} to {target}, yes {item}!';

      const result = await stage.executeInternal(mockContext);

      expect(result.data.formattedActions[0].formattedText).toBe(
        'give Sword to Goblin, yes Sword!'
      );
    });

    it('should handle missing placeholders gracefully', async () => {
      mockContext.actionDef.template = 'use {item} on {target} with {tool}';

      const result = await stage.executeInternal(mockContext);

      // Should replace known placeholders and leave unknown ones
      expect(result.data.formattedActions[0].formattedText).toBe(
        'use Sword on Goblin with {tool}'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty resolved targets', async () => {
      mockContext.resolvedTargets = {
        primary: [],
        secondary: [],
      };
      mockContext.actionDef.generateCombinations = true;

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('No targets to combine');
    });

    it('should handle missing target definitions', async () => {
      mockContext.targetDefinitions = null;
      mockContext.actionDef.targets = {
        primary: { placeholder: 'item' },
        secondary: { placeholder: 'target' },
      };

      const result = await stage.executeInternal(mockContext);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions[0].formattedText).toBe(
        'use Sword on Goblin'
      );
    });
  });
});
```

### Step 4: Create Integration Tests

Create file: `tests/integration/actions/multiTargetFormatting.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Multi-Target Action Formatting Integration', () => {
  let testBed;
  let actionProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionProcessor = testBed.getService('actionCandidateProcessor');
  });

  it('should format throw action with all combinations', async () => {
    // Create action
    const throwAction = {
      id: 'combat:throw',
      name: 'Throw',
      description: 'Throw an item at a target',
      targets: {
        primary: {
          scope: 'actor.core:inventory.items[]',
          placeholder: 'item',
        },
        secondary: {
          scope: 'location.core:actors[]',
          placeholder: 'target',
        },
      },
      template: 'throw {item} at {target}',
      generateCombinations: true,
    };

    // Create entities
    const player = testBed.createEntity('player', {
      'core:inventory': { items: ['rock_001', 'knife_002'] },
      'core:position': { locationId: 'arena' },
    });

    const goblin = testBed.createEntity('goblin_001', {
      'core:actor': { name: 'Goblin Scout' },
      'core:position': { locationId: 'arena' },
    });

    const orc = testBed.createEntity('orc_001', {
      'core:actor': { name: 'Orc Warrior' },
      'core:position': { locationId: 'arena' },
    });

    const rock = testBed.createEntity('rock_001', {
      'core:item': { name: 'Small Rock', type: 'throwable' },
    });

    const knife = testBed.createEntity('knife_002', {
      'core:item': { name: 'Throwing Knife', type: 'weapon' },
    });

    const arena = testBed.createEntity('arena', {
      'core:location': { name: 'Combat Arena' },
      'core:actors': { actors: ['player', 'goblin_001', 'orc_001'] },
    });

    // Process action
    const result = await actionProcessor.process(throwAction, player, {
      location: arena,
    });

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(4);

    const commands = result.value.actions.map((a) => a.command);
    expect(commands).toContain('throw Small Rock at Goblin Scout');
    expect(commands).toContain('throw Small Rock at Orc Warrior');
    expect(commands).toContain('throw Throwing Knife at Goblin Scout');
    expect(commands).toContain('throw Throwing Knife at Orc Warrior');
  });

  it('should format clothing adjustment without combinations', async () => {
    // Create action
    const adjustAction = {
      id: 'intimacy:adjust_clothing',
      name: 'Adjust Clothing',
      description: "Adjust someone's clothing",
      targets: {
        primary: {
          scope: 'location.core:actors[]',
          placeholder: 'person',
        },
        secondary: {
          scope: 'target.topmost_clothing[]',
          placeholder: 'garment',
          contextFrom: 'primary',
        },
      },
      template: "adjust {person}'s {garment}",
      generateCombinations: false,
    };

    // Create entities
    const player = testBed.createEntity('player', {
      'core:position': { locationId: 'room' },
    });

    const npc = testBed.createEntity('npc_001', {
      'core:actor': { name: 'Alice' },
      'core:position': { locationId: 'room' },
      'clothing:equipment': {
        equipped: {
          torso_upper: {
            outer: 'jacket_001',
          },
        },
      },
    });

    const jacket = testBed.createEntity('jacket_001', {
      'core:item': { name: 'Blue Jacket' },
      'clothing:garment': {
        slot: 'torso_upper',
        properties: ['adjustable'],
      },
    });

    const room = testBed.createEntity('room', {
      'core:location': { name: 'Living Room' },
      'core:actors': { actors: ['player', 'npc_001'] },
    });

    // Process action
    const result = await actionProcessor.process(adjustAction, player, {
      location: room,
    });

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(1);
    expect(result.value.actions[0].command).toBe("adjust Alice's Blue Jacket");
  });
});
```

## Testing Strategy

### Unit Tests

1. Legacy format compatibility
2. Multi-placeholder substitution
3. Combination generation logic
4. Display name resolution
5. Error handling

### Integration Tests

1. Full pipeline with formatting
2. Complex multi-target scenarios
3. Performance with many combinations
4. Context-dependent formatting

### Performance Tests

1. Combination generation speed
2. Memory usage with large sets
3. Template substitution performance

## Acceptance Criteria

1. ✅ Legacy single-target actions format correctly
2. ✅ Multi-placeholder templates work properly
3. ✅ Combinations generate correctly when enabled
4. ✅ Display names resolve from entity data
5. ✅ Combination limits prevent memory issues
6. ✅ Backward compatibility maintained
7. ✅ All placeholders validated and replaced
8. ✅ Performance targets met (<100ms for 100 combinations)
9. ✅ Unit tests pass with >95% coverage
10. ✅ Integration tests demonstrate real usage

## Performance Considerations

1. **Lazy Evaluation**: Generate combinations on demand
2. **Streaming**: Consider streaming for very large sets
3. **Caching**: Cache display names within formatting
4. **Template Compilation**: Pre-compile regex patterns

## Security Considerations

1. Validate placeholder names to prevent injection
2. Escape display names for safe rendering
3. Limit maximum combinations to prevent DoS
4. Sanitize all user-visible strings

## Future Enhancements

1. Template syntax validation at load time
2. Custom formatting functions per placeholder
3. Conditional template sections
4. Localization support for templates
5. Streaming combination generation
