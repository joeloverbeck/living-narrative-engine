# GOAP-TIER1-002: Effects Analyzer Implementation

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 3-4
**Status:** Not Started
**Dependencies:** GOAP-TIER1-001 (Schema Design and DI Setup)

## Overview

Implement the EffectsAnalyzer class that analyzes rule operations and extracts state-changing effects for planning. This is the core analysis engine that converts execution operations into planning metadata.

## Objectives

1. Implement EffectsAnalyzer class
2. Implement operation detection (state-changing vs. non-state-changing)
3. Implement operation-to-effect conversion
4. Implement data flow analysis for context variables
5. Implement path tracing for conditional operations (IF and IF_CO_LOCATED)
6. Integrate with existing data registry for rule access

## Architecture Corrections

### Key Assumptions Corrected

1. **Rule Access**: Rules are accessed via `IDataRegistry.get('rules', ruleId)`, NOT via a separate RuleLoader service with `getRule()`/`getRules()` methods.

2. **Macro Expansion**: Macros (`{"macro": "modId:macroId"}`) are ALREADY expanded during rule loading by `RuleLoader` using the `expandMacros()` utility from `src/utils/macroUtils.js`. The EffectsAnalyzer receives rules with macros already expanded.

3. **Placeholder Resolution**: Runtime placeholders like `{var: "itemId"}` are handled by `contextUtils.resolvePlaceholders()` during execution, NOT during analysis. The analyzer should preserve these as-is in effects or mark them as parameterized.

4. **Operation Types**: The codebase has 60+ operation types (see `src/utils/preValidationUtils.js` KNOWN_OPERATION_TYPES), not just the 20 initially assumed.

## Technical Details

### 1. EffectsAnalyzer Class

**File:** `src/goap/analysis/effectsAnalyzer.js`

```javascript
/**
 * @file Effects analyzer for GOAP planning
 * Analyzes rule operations and extracts state-changing effects
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Analyzes rule operations and extracts planning effects
 */
class EffectsAnalyzer {
  #logger;
  #dataRegistry;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.dataRegistry - Data registry for accessing rules
   */
  constructor({ logger, dataRegistry }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll']
    });

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Analyzes a rule and extracts planning effects
   * @param {String} ruleId - Rule ID (qualified with mod prefix, e.g., 'positioning:sit_down')
   * @returns {Object} Planning effects structure
   */
  analyzeRule(ruleId) {
    string.assertNonBlank(ruleId, 'ruleId', 'analyzeRule', this.#logger);

    this.#logger.debug(`Analyzing rule: ${ruleId}`);

    // Fetch rule from data registry
    const rule = this.#dataRegistry.get('rules', ruleId);
    if (!rule) {
      throw new Error(`Rule not found in registry: ${ruleId}`);
    }

    try {
      // Note: Macros are already expanded during rule loading (see RuleLoader)
      // The rule.actions array contains fully expanded operations
      const operations = rule.actions || [];

      // Step 1: Analyze data flow (track context variables produced by operations)
      const dataFlow = this.#analyzeDataFlow(operations);

      // Step 2: Trace execution paths (handle conditionals: IF, IF_CO_LOCATED)
      const paths = this.#traceExecutionPaths(operations, dataFlow);

      // Step 3: Extract state changes from each path
      const effects = this.#extractEffectsFromPaths(paths);

      // Step 4: Generate abstract preconditions for runtime-dependent conditions
      const abstractPreconditions = this.#generateAbstractPreconditions(dataFlow);

      // Step 5: Calculate cost
      const cost = this.#calculateCost(rule, effects);

      return {
        effects,
        cost,
        abstractPreconditions: Object.keys(abstractPreconditions).length > 0
          ? abstractPreconditions
          : undefined
      };
    } catch (error) {
      this.#logger.error(`Failed to analyze rule ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Determines if an operation changes world state
   * @param {Object} operation - Operation from rule
   * @returns {boolean} True if state-changing
   */
  isWorldStateChanging(operation) {
    assertPresent(operation, 'Operation is required');
    assertPresent(operation.type, 'Operation type is required');

    // State-changing operations that modify world state for planning purposes
    // Based on actual operation types in src/utils/preValidationUtils.js
    const stateChangingOperations = [
      // Core component operations
      'ADD_COMPONENT',
      'REMOVE_COMPONENT',
      'MODIFY_COMPONENT',
      'ATOMIC_MODIFY_COMPONENT',
      'MODIFY_ARRAY_FIELD',

      // Movement and positioning
      'LOCK_MOVEMENT',
      'UNLOCK_MOVEMENT',
      'SYSTEM_MOVE_ENTITY',

      // Closeness relationships
      'ESTABLISH_SITTING_CLOSENESS',
      'ESTABLISH_LYING_CLOSENESS',
      'REMOVE_SITTING_CLOSENESS',
      'REMOVE_LYING_CLOSENESS',
      'BREAK_CLOSENESS_WITH_TARGET',
      'REMOVE_FROM_CLOSENESS_CIRCLE',
      'MERGE_CLOSENESS_CIRCLE',

      // Mouth engagement
      'LOCK_MOUTH_ENGAGEMENT',
      'UNLOCK_MOUTH_ENGAGEMENT',

      // Items and inventory
      'TRANSFER_ITEM',
      'DROP_ITEM_AT_LOCATION',
      'PICK_UP_ITEM_FROM_LOCATION',

      // Containers
      'OPEN_CONTAINER',
      'TAKE_FROM_CONTAINER',
      'PUT_IN_CONTAINER',

      // Clothing
      'UNEQUIP_CLOTHING',

      // Consumption
      'DRINK_FROM',
      'DRINK_ENTIRELY',

      // Following and companionship
      'ESTABLISH_FOLLOW_RELATION',
      'BREAK_FOLLOW_RELATION',
      'REBUILD_LEADER_LIST_CACHE',

      // Auto-movement
      'AUTO_MOVE_CLOSENESS_PARTNERS',
      'AUTO_MOVE_FOLLOWERS',

      // Perception
      'ADD_PERCEPTION_LOG_ENTRY'
    ];

    return stateChangingOperations.includes(operation.type);
  }

  /**
   * Determines if an operation produces context data
   * @param {Object} operation - Operation from rule
   * @returns {boolean} True if produces context data
   */
  isContextProducing(operation) {
    // Operations that produce data used by other operations
    // These don't change world state but provide information
    const contextProducingOperations = [
      'QUERY_COMPONENT',
      'QUERY_COMPONENTS',
      'QUERY_ENTITIES',
      'QUERY_LOOKUP',
      'GET_NAME',
      'GET_TIMESTAMP',
      'SET_VARIABLE',
      'MODIFY_CONTEXT_ARRAY',
      'VALIDATE_INVENTORY_CAPACITY',
      'VALIDATE_CONTAINER_CAPACITY',
      'HAS_COMPONENT',
      'HAS_BODY_PART_WITH_COMPONENT_VALUE',
      'RESOLVE_DIRECTION',
      'MATH',
      'CHECK_FOLLOW_CYCLE'
    ];

    return contextProducingOperations.includes(operation.type);
  }

  /**
   * Converts operation to planning effect
   * @param {Object} operation - Operation from rule
   * @returns {Object|Array<Object>} Planning effect(s)
   */
  operationToEffect(operation) {
    assertPresent(operation, 'Operation is required');
    assertPresent(operation.type, 'Operation type is required');

    switch (operation.type) {
      case 'ADD_COMPONENT':
        return this.#convertAddComponent(operation);

      case 'REMOVE_COMPONENT':
        return this.#convertRemoveComponent(operation);

      case 'MODIFY_COMPONENT':
      case 'ATOMIC_MODIFY_COMPONENT':
        return this.#convertModifyComponent(operation);

      case 'LOCK_MOVEMENT':
        return this.#convertLockMovement(operation);

      case 'UNLOCK_MOVEMENT':
        return this.#convertUnlockMovement(operation);

      case 'ESTABLISH_SITTING_CLOSENESS':
      case 'ESTABLISH_LYING_CLOSENESS':
        return this.#convertEstablishCloseness(operation);

      case 'REMOVE_SITTING_CLOSENESS':
      case 'REMOVE_LYING_CLOSENESS':
      case 'BREAK_CLOSENESS_WITH_TARGET':
        return this.#convertRemoveCloseness(operation);

      case 'TRANSFER_ITEM':
      case 'DROP_ITEM_AT_LOCATION':
      case 'PICK_UP_ITEM_FROM_LOCATION':
        return this.#convertItemOperation(operation);

      case 'OPEN_CONTAINER':
      case 'TAKE_FROM_CONTAINER':
      case 'PUT_IN_CONTAINER':
        return this.#convertContainerOperation(operation);

      case 'LOCK_MOUTH_ENGAGEMENT':
        return this.#convertLockMouthEngagement(operation);

      case 'UNLOCK_MOUTH_ENGAGEMENT':
        return this.#convertUnlockMouthEngagement(operation);

      case 'UNEQUIP_CLOTHING':
        return this.#convertUnequipClothing(operation);

      default:
        this.#logger.warn(`Unknown or unhandled state-changing operation: ${operation.type}`);
        return null;
    }
  }

  // Private helper methods

  // Note: Macros are already expanded during rule loading by RuleLoader
  // The macro system in src/utils/macroUtils.js expands {"macro": "modId:macroId"}
  // references to action arrays. This happens before the rule reaches this analyzer.
  //
  // What we need to handle here is recognizing that runtime placeholders
  // like {var: "itemId"} or {param: "targetId"} cannot be fully resolved during
  // analysis. These are resolved during execution by contextUtils.resolvePlaceholders().
  // For planning purposes, we preserve these as parameterized values or mark them
  // with special notation (e.g., "{itemId}") to indicate runtime dependency.

  #analyzeDataFlow(operations) {
    // Track operations that produce context variables
    // Returns map of variable names to operations that produce them
    const dataFlow = new Map();

    for (const operation of operations) {
      if (this.isContextProducing(operation)) {
        // Note: Different operations store result variables differently
        // Some use 'result_variable', others use 'variable', 'output_variable', etc.
        const resultVar = operation.parameters?.result_variable ||
                         operation.parameters?.variable ||
                         operation.parameters?.output_variable;
        if (resultVar) {
          dataFlow.set(resultVar, operation);
        }
      }
    }

    return dataFlow;
  }

  #traceExecutionPaths(operations, dataFlow) {
    // Identify all possible execution paths through conditionals
    // Returns array of path objects, each containing operations and conditions
    const paths = [];
    this.#tracePathRecursive(operations, [], [], paths);
    return paths;
  }

  #tracePathRecursive(operations, currentPath, conditions, allPaths) {
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      // Handle both IF and IF_CO_LOCATED conditionals
      if (op.type === 'IF' || op.type === 'IF_CO_LOCATED') {
        // Branch into then and else paths
        const thenPath = [...currentPath];
        const elsePath = [...currentPath];

        // Determine the condition
        let condition;
        if (op.type === 'IF') {
          condition = op.parameters.condition;
        } else if (op.type === 'IF_CO_LOCATED') {
          // IF_CO_LOCATED compares locations of two entities
          const entityA = op.parameters.entity_a || 'actor';
          const entityB = op.parameters.entity_b || 'target';
          condition = {
            '==': [
              { var: `${entityA}.location` },
              { var: `${entityB}.location` }
            ]
          };
        }

        // Then branch
        const thenConditions = [...conditions, condition];
        this.#tracePathRecursive(
          op.parameters.then_actions || [],
          thenPath,
          thenConditions,
          allPaths
        );

        // Else branch (if exists)
        if (op.parameters.else_actions) {
          const elseConditions = [
            ...conditions,
            { not: condition }
          ];
          this.#tracePathRecursive(
            op.parameters.else_actions || [],
            elsePath,
            elseConditions,
            allPaths
          );
        }

        return; // Don't process operations after conditional
      } else {
        currentPath.push(op);
      }
    }

    // Reached end of path
    allPaths.push({
      operations: currentPath,
      conditions
    });
  }

  #extractEffectsFromPaths(paths) {
    // For each path, extract state-changing operations
    // Convert to conditional effects if paths have different conditions
    const effects = [];

    if (paths.length === 1 && paths[0].conditions.length === 0) {
      // Single unconditional path
      for (const op of paths[0].operations) {
        if (this.isWorldStateChanging(op)) {
          const effect = this.operationToEffect(op);
          if (effect) {
            // Handle both single effects and arrays of effects
            if (Array.isArray(effect)) {
              effects.push(...effect);
            } else {
              effects.push(effect);
            }
          }
        }
      }
    } else {
      // Multiple paths or conditional paths
      for (const path of paths) {
        const pathEffects = [];
        for (const op of path.operations) {
          if (this.isWorldStateChanging(op)) {
            const effect = this.operationToEffect(op);
            if (effect) {
              if (Array.isArray(effect)) {
                pathEffects.push(...effect);
              } else {
                pathEffects.push(effect);
              }
            }
          }
        }

        if (pathEffects.length > 0) {
          if (path.conditions.length > 0) {
            effects.push({
              operation: 'CONDITIONAL',
              condition: this.#combineConditions(path.conditions),
              then: pathEffects
            });
          } else {
            effects.push(...pathEffects);
          }
        }
      }
    }

    return effects;
  }

  #generateAbstractPreconditions(dataFlow) {
    // Convert context-producing operations to abstract preconditions
    // Abstract preconditions are for conditions that depend on runtime state
    const preconditions = {};

    for (const [varName, operation] of dataFlow.entries()) {
      const precondition = this.#operationToAbstractPrecondition(operation);
      if (precondition) {
        preconditions[varName] = precondition;
      }
    }

    return preconditions;
  }

  #operationToAbstractPrecondition(operation) {
    // Map operation types to abstract precondition definitions
    // These represent runtime checks that the planner cannot evaluate statically
    const preconditionMap = {
      'VALIDATE_INVENTORY_CAPACITY': {
        description: 'Checks if actor can carry the item',
        parameters: ['actorId', 'itemId'],
        simulationFunction: 'assumeTrue'  // Optimistic: assume inventory has space
      },
      'VALIDATE_CONTAINER_CAPACITY': {
        description: 'Checks if container has space for item',
        parameters: ['containerId', 'itemId'],
        simulationFunction: 'assumeTrue'  // Optimistic: assume container has space
      },
      'HAS_COMPONENT': {
        description: 'Checks if entity has component',
        parameters: ['entityId', 'componentId'],
        simulationFunction: 'assumeTrue'  // Optimistic: assume component exists
      },
      'CHECK_FOLLOW_CYCLE': {
        description: 'Checks if following relationship would create a cycle',
        parameters: ['leaderId', 'followerId'],
        simulationFunction: 'assumeFalse'  // Conservative: assume no cycle
      }
      // Add more mappings as needed during implementation
    };

    return preconditionMap[operation.type] || null;
  }

  #calculateCost(rule, effects) {
    // Calculate action cost based on effects complexity
    // Base cost is 1.0
    let cost = 1.0;

    // Add cost for each state-changing effect
    const flatEffects = effects.filter(e => e.operation !== 'CONDITIONAL');
    const conditionalEffects = effects.filter(e => e.operation === 'CONDITIONAL');

    cost += flatEffects.length * 0.1;
    cost += conditionalEffects.length * 0.2;

    // Round to 1 decimal place
    return Math.round(cost * 10) / 10;
  }

  #combineConditions(conditions) {
    if (conditions.length === 0) return true;
    if (conditions.length === 1) return conditions[0];
    return { and: conditions };
  }

  // Conversion methods for specific operation types

  #convertAddComponent(operation) {
    return {
      operation: 'ADD_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: operation.parameters.component,
      data: operation.parameters.data || {}
    };
  }

  #convertRemoveComponent(operation) {
    return {
      operation: 'REMOVE_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: operation.parameters.component
    };
  }

  #convertModifyComponent(operation) {
    return {
      operation: 'MODIFY_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: operation.parameters.component,
      updates: operation.parameters.updates || {}
    };
  }

  #convertLockMovement(operation) {
    return {
      operation: 'ADD_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: 'positioning:movement_locked',
      data: {}
    };
  }

  #convertUnlockMovement(operation) {
    return {
      operation: 'REMOVE_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: 'positioning:movement_locked'
    };
  }

  #convertLockMouthEngagement(operation) {
    return {
      operation: 'ADD_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: 'positioning:mouth_engagement_locked',
      data: {}
    };
  }

  #convertUnlockMouthEngagement(operation) {
    return {
      operation: 'REMOVE_COMPONENT',
      entity: operation.parameters.entity || 'actor',
      component: 'positioning:mouth_engagement_locked'
    };
  }

  #convertEstablishCloseness(operation) {
    const component = operation.type === 'ESTABLISH_SITTING_CLOSENESS'
      ? 'positioning:sitting_close_to'
      : 'positioning:lying_close_to';

    // Closeness is bidirectional - both entities get the component
    const entity = operation.parameters.entity || 'actor';
    const targetEntity = operation.parameters.target_entity || 'target';

    return [
      {
        operation: 'ADD_COMPONENT',
        entity: entity,
        component,
        data: {
          targetId: `{${targetEntity}.id}`  // Runtime placeholder
        }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: targetEntity,
        component,
        data: {
          targetId: `{${entity}.id}`  // Runtime placeholder
        }
      }
    ];
  }

  #convertRemoveCloseness(operation) {
    const entity = operation.parameters.entity || 'actor';

    // Determine component based on operation type
    if (operation.type === 'REMOVE_SITTING_CLOSENESS') {
      return {
        operation: 'REMOVE_COMPONENT',
        entity: entity,
        component: 'positioning:sitting_close_to'
      };
    } else if (operation.type === 'REMOVE_LYING_CLOSENESS') {
      return {
        operation: 'REMOVE_COMPONENT',
        entity: entity,
        component: 'positioning:lying_close_to'
      };
    } else if (operation.type === 'BREAK_CLOSENESS_WITH_TARGET') {
      // BREAK_CLOSENESS_WITH_TARGET removes both sitting and lying closeness
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: entity,
          component: 'positioning:sitting_close_to'
        },
        {
          operation: 'REMOVE_COMPONENT',
          entity: entity,
          component: 'positioning:lying_close_to'
        }
      ];
    }

    return null;
  }

  #convertItemOperation(operation) {
    // TRANSFER_ITEM, DROP_ITEM_AT_LOCATION, PICK_UP_ITEM_FROM_LOCATION
    const effects = [];
    const itemId = operation.parameters.item_id || '{itemId}';  // Placeholder if not specified

    if (operation.type === 'PICK_UP_ITEM_FROM_LOCATION') {
      effects.push(
        {
          operation: 'REMOVE_COMPONENT',
          entity: itemId,
          component: 'items:at_location'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: itemId }
        }
      );
    } else if (operation.type === 'DROP_ITEM_AT_LOCATION') {
      const location = operation.parameters.location || '{actor.location}';
      effects.push(
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: itemId }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: itemId,
          component: 'items:at_location',
          data: { location: location }
        }
      );
    } else if (operation.type === 'TRANSFER_ITEM') {
      const fromEntity = operation.parameters.from_entity || 'actor';
      const toEntity = operation.parameters.to_entity || 'target';
      effects.push(
        {
          operation: 'REMOVE_COMPONENT',
          entity: fromEntity,
          component: 'items:inventory_item',
          data: { itemId: itemId }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: toEntity,
          component: 'items:inventory_item',
          data: { itemId: itemId }
        }
      );
    }

    return effects.length > 0 ? effects : null;
  }

  #convertContainerOperation(operation) {
    // Container operations (OPEN_CONTAINER, TAKE_FROM_CONTAINER, PUT_IN_CONTAINER)
    if (operation.type === 'OPEN_CONTAINER') {
      return {
        operation: 'MODIFY_COMPONENT',
        entity: operation.parameters.container_entity || 'target',
        component: 'items:container',
        updates: { isOpen: true }
      };
    } else if (operation.type === 'TAKE_FROM_CONTAINER') {
      const containerId = operation.parameters.container_id || 'target';
      const itemId = operation.parameters.item_id || '{itemId}';
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: itemId,
          component: 'items:contained_in'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: itemId }
        }
      ];
    } else if (operation.type === 'PUT_IN_CONTAINER') {
      const containerId = operation.parameters.container_id || 'target';
      const itemId = operation.parameters.item_id || '{itemId}';
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { itemId: itemId }
        },
        {
          operation: 'ADD_COMPONENT',
          entity: itemId,
          component: 'items:contained_in',
          data: { containerId: containerId }
        }
      ];
    }

    return null;
  }

  #convertUnequipClothing(operation) {
    const clothingId = operation.parameters.clothing_id || '{clothingId}';
    return [
      {
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'clothing:equipped',
        data: { clothingId: clothingId }
      },
      {
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item',
        data: { itemId: clothingId }
      }
    ];
  }
}

export default EffectsAnalyzer;
```

## Files to Create

- [ ] `src/goap/analysis/effectsAnalyzer.js`

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/analysis/effectsAnalyzer.test.js`

Test Coverage:
- State-changing operation detection (40+ operation types from KNOWN_OPERATION_TYPES)
- Context-producing operation detection
- Operation to effect conversion (each operation type)
- Data flow analysis (tracking context variables)
- Path tracing for IF and IF_CO_LOCATED operations
- Abstract precondition generation
- Cost calculation
- Integration with data registry

**File:** `tests/unit/goap/analysis/effectsAnalyzer.edgeCases.test.js`

Edge Cases:
- Empty operations list
- Operations with no state changes
- Nested IF operations
- Multiple conditional paths (IF_CO_LOCATED combined with IF)
- Operations with missing parameters
- Invalid operation types
- Rule not found in registry
- Bidirectional effects (closeness operations)

**Coverage Target:** 90% branches, 95% functions/lines

## Documentation Requirements

- [ ] JSDoc comments for all public methods
- [ ] JSDoc comments for all private methods
- [ ] Code examples in comments
- [ ] Document operation type mappings in comments
- [ ] Create `docs/goap/effects-analyzer-usage.md` with usage examples
- [ ] Document integration with existing macro expansion system

## Acceptance Criteria

- [ ] EffectsAnalyzer class implemented with all methods
- [ ] Detects all 40+ state-changing operation types correctly (based on KNOWN_OPERATION_TYPES)
- [ ] Converts operations to effects correctly
- [ ] Integrates with data registry for rule access
- [ ] Traces conditional paths correctly (IF and IF_CO_LOCATED)
- [ ] Generates abstract preconditions for validation operations
- [ ] Handles nested conditionals
- [ ] Handles multiple execution paths
- [ ] Preserves runtime placeholders in effects
- [ ] All unit tests pass with 90%+ coverage
- [ ] All edge case tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Documentation complete

## Success Metrics

- ✅ Correctly identifies state-changing operations
- ✅ Accurately converts operations to effects
- ✅ Handles complex conditional logic (IF and IF_CO_LOCATED)
- ✅ Generates valid planning effects structures
- ✅ All tests green with high coverage
- ✅ Integrates seamlessly with existing macro expansion in RuleLoader

## Notes

- **Macro Expansion Already Handled:** Macros are expanded during rule loading by `RuleLoader` using `src/utils/macroUtils.js`. The analyzer receives rules with macros already expanded.

- **Runtime Placeholders:** Placeholders like `{var: "itemId"}` are runtime concerns, resolved by `contextUtils.resolvePlaceholders()` during execution. The analyzer should preserve these in effects or mark them with special notation (e.g., `"{itemId}"`).

- **Data Registry Integration:** Rules are accessed via `dataRegistry.get('rules', ruleId)`, not through a separate RuleLoader service.

- **Path Tracing:** Algorithm must handle both IF and IF_CO_LOCATED operations, as well as nested conditionals.

- **Abstract Preconditions:** Foundation for planner simulation of runtime-dependent checks (inventory capacity, component existence, etc.).

- **Bidirectional Effects:** Some operations (like closeness establishment) create effects on multiple entities.

- **Operation Type Completeness:** The implementation should reference `src/utils/preValidationUtils.js` KNOWN_OPERATION_TYPES for the authoritative list of valid operations.

## Related Tickets

- Depends on: GOAP-TIER1-001 (Schema Design and DI Setup)
- Blocks: GOAP-TIER1-003 (Effects Generator Implementation)
- Blocks: GOAP-TIER1-004 (Content Generation and Validation Tools)
