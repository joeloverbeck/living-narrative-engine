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
4. Implement macro resolution integration
5. Implement data flow analysis for context variables
6. Implement path tracing for conditional operations

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
  #ruleLoader;
  #macroResolver;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.ruleLoader - Rule loader service
   * @param {Object} params.macroResolver - Macro resolver service
   */
  constructor({ logger, ruleLoader, macroResolver }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(ruleLoader, 'IRuleLoader', logger, {
      requiredMethods: ['getRule', 'getRules']
    });
    validateDependency(macroResolver, 'IMacroResolver', logger, {
      requiredMethods: ['resolveMacro', 'expandMacros']
    });

    this.#logger = logger;
    this.#ruleLoader = ruleLoader;
    this.#macroResolver = macroResolver;
  }

  /**
   * Analyzes a rule and extracts planning effects
   * @param {Object} rule - Rule definition
   * @returns {Object} Planning effects structure
   */
  analyzeRule(rule) {
    assertPresent(rule, 'Rule is required');
    string.assertNonBlank(rule.id, 'rule.id', 'analyzeRule', this.#logger);

    this.#logger.debug(`Analyzing rule: ${rule.id}`);

    try {
      // Step 1: Expand macros
      const expandedOperations = this.#expandMacros(rule.operations);

      // Step 2: Analyze data flow (track context variables)
      const dataFlow = this.#analyzeDataFlow(expandedOperations);

      // Step 3: Trace execution paths (handle conditionals)
      const paths = this.#traceExecutionPaths(expandedOperations, dataFlow);

      // Step 4: Extract state changes from each path
      const effects = this.#extractEffectsFromPaths(paths);

      // Step 5: Generate abstract preconditions
      const abstractPreconditions = this.#generateAbstractPreconditions(dataFlow);

      // Step 6: Calculate cost
      const cost = this.#calculateCost(rule, effects);

      return {
        effects,
        cost,
        abstractPreconditions: Object.keys(abstractPreconditions).length > 0
          ? abstractPreconditions
          : undefined
      };
    } catch (error) {
      this.#logger.error(`Failed to analyze rule ${rule.id}`, error);
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

    const stateChangingOperations = [
      'ADD_COMPONENT',
      'REMOVE_COMPONENT',
      'MODIFY_COMPONENT',
      'ATOMIC_MODIFY_COMPONENT',
      'LOCK_MOVEMENT',
      'UNLOCK_MOVEMENT',
      'LOCK_MOUTH_ENGAGEMENT',
      'UNLOCK_MOUTH_ENGAGEMENT',
      'ESTABLISH_SITTING_CLOSENESS',
      'ESTABLISH_LYING_CLOSENESS',
      'REMOVE_SITTING_CLOSENESS',
      'REMOVE_LYING_CLOSENESS',
      'BREAK_CLOSENESS_WITH_TARGET',
      'TRANSFER_ITEM',
      'DROP_ITEM_AT_LOCATION',
      'PICK_UP_ITEM_FROM_LOCATION',
      'OPEN_CONTAINER',
      'TAKE_FROM_CONTAINER',
      'PUT_IN_CONTAINER',
      'UNEQUIP_CLOTHING',
      'DRINK_FROM',
      'DRINK_ENTIRELY'
    ];

    return stateChangingOperations.includes(operation.type);
  }

  /**
   * Determines if an operation produces context data
   * @param {Object} operation - Operation from rule
   * @returns {boolean} True if produces context data
   */
  isContextProducing(operation) {
    const contextProducingOperations = [
      'QUERY_COMPONENT',
      'QUERY_COMPONENTS',
      'QUERY_ENTITIES',
      'QUERY_LOOKUP',
      'GET_NAME',
      'GET_TIMESTAMP',
      'SET_VARIABLE',
      'VALIDATE_INVENTORY_CAPACITY',
      'VALIDATE_CONTAINER_CAPACITY',
      'HAS_COMPONENT',
      'HAS_BODY_PART_WITH_COMPONENT_VALUE',
      'RESOLVE_DIRECTION',
      'MATH'
    ];

    return contextProducingOperations.includes(operation.type);
  }

  /**
   * Converts operation to planning effect
   * @param {Object} operation - Operation from rule
   * @returns {Object} Planning effect
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

      default:
        this.#logger.warn(`Unknown state-changing operation: ${operation.type}`);
        return null;
    }
  }

  // Private helper methods

  #expandMacros(operations) {
    // Use macro resolver to expand all macro references
    return this.#macroResolver.expandMacros(operations);
  }

  #analyzeDataFlow(operations) {
    // Track operations that produce context variables
    // Returns map of variable names to operations that produce them
    const dataFlow = new Map();

    for (const operation of operations) {
      if (this.isContextProducing(operation)) {
        const resultVar = operation.parameters?.result_variable;
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

      if (op.type === 'IF') {
        // Branch into then and else paths
        const thenPath = [...currentPath];
        const elsePath = [...currentPath];

        // Then branch
        const thenConditions = [...conditions, op.parameters.condition];
        this.#tracePathRecursive(
          op.parameters.then_actions || [],
          thenPath,
          thenConditions,
          allPaths
        );

        // Else branch
        const elseConditions = [
          ...conditions,
          { not: op.parameters.condition }
        ];
        this.#tracePathRecursive(
          op.parameters.else_actions || [],
          elsePath,
          elseConditions,
          allPaths
        );

        return; // Don't process operations after IF
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
          if (effect) effects.push(effect);
        }
      }
    } else {
      // Multiple paths or conditional paths
      for (const path of paths) {
        const pathEffects = [];
        for (const op of path.operations) {
          if (this.isWorldStateChanging(op)) {
            const effect = this.operationToEffect(op);
            if (effect) pathEffects.push(effect);
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
    const preconditionMap = {
      'VALIDATE_INVENTORY_CAPACITY': {
        description: 'Checks if actor can carry the item',
        parameters: ['actorId', 'itemId'],
        simulationFunction: 'simulateInventoryCapacity'
      },
      'VALIDATE_CONTAINER_CAPACITY': {
        description: 'Checks if container has space for item',
        parameters: ['containerId', 'itemId'],
        simulationFunction: 'simulateContainerCapacity'
      },
      'HAS_COMPONENT': {
        description: 'Checks if entity has component',
        parameters: ['entityId', 'componentId'],
        simulationFunction: 'simulateHasComponent'
      }
      // Add more mappings as needed
    };

    return preconditionMap[operation.type] || null;
  }

  #calculateCost(rule, effects) {
    // Default cost is 1.0
    // Can be made more sophisticated based on effect complexity
    return 1.0;
  }

  #combineConditions(conditions) {
    if (conditions.length === 0) return true;
    if (conditions.length === 1) return conditions[0];
    return { and: conditions };
  }

  // Conversion methods for specific operation types
  // (Implementation details for each converter method)

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
      entity: 'actor',
      component: 'positioning:movement_locked',
      data: {}
    };
  }

  #convertUnlockMovement(operation) {
    return {
      operation: 'REMOVE_COMPONENT',
      entity: 'actor',
      component: 'positioning:movement_locked'
    };
  }

  #convertEstablishCloseness(operation) {
    const component = operation.type === 'ESTABLISH_SITTING_CLOSENESS'
      ? 'positioning:sitting_close_to'
      : 'positioning:lying_close_to';

    return {
      operation: 'ADD_COMPONENT',
      entity: 'actor',
      component,
      data: {
        target_id: { ref: 'target.id' }
      }
    };
  }

  #convertRemoveCloseness(operation) {
    // Determine component based on operation type
    let component;
    if (operation.type === 'REMOVE_SITTING_CLOSENESS') {
      component = 'positioning:sitting_close_to';
    } else if (operation.type === 'REMOVE_LYING_CLOSENESS') {
      component = 'positioning:lying_close_to';
    } else {
      // BREAK_CLOSENESS_WITH_TARGET removes both
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'positioning:sitting_close_to'
        },
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'positioning:lying_close_to'
        }
      ];
    }

    return {
      operation: 'REMOVE_COMPONENT',
      entity: 'actor',
      component
    };
  }

  #convertItemOperation(operation) {
    // TRANSFER_ITEM, DROP_ITEM_AT_LOCATION, PICK_UP_ITEM_FROM_LOCATION
    // Return multiple effects for item movement
    const effects = [];

    if (operation.type === 'PICK_UP_ITEM_FROM_LOCATION') {
      effects.push(
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { item_id: { ref: 'target.id' } }
        },
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'target',
          component: 'core:at_location'
        }
      );
    } else if (operation.type === 'DROP_ITEM_AT_LOCATION') {
      effects.push(
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'target',
          component: 'core:at_location',
          data: { location_id: { ref: 'actor.location' } }
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
        entity: 'target',
        component: 'items:container',
        updates: { open: true }
      };
    } else if (operation.type === 'TAKE_FROM_CONTAINER') {
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'tertiary_target',
          component: 'items:contained_in'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'actor',
          component: 'items:inventory_item',
          data: { item_id: { ref: 'tertiary_target.id' } }
        }
      ];
    } else if (operation.type === 'PUT_IN_CONTAINER') {
      return [
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'tertiary_target',
          component: 'items:inventory_item'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'tertiary_target',
          component: 'items:contained_in',
          data: { container_id: { ref: 'target.id' } }
        }
      ];
    }

    return null;
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
- State-changing operation detection (all 20+ operation types)
- Context-producing operation detection
- Operation to effect conversion (each operation type)
- Macro expansion integration
- Data flow analysis
- Path tracing for IF operations
- Abstract precondition generation
- Cost calculation

**File:** `tests/unit/goap/analysis/effectsAnalyzer.edgeCases.test.js`

Edge Cases:
- Empty operations list
- Operations with no state changes
- Nested IF operations
- Multiple conditional paths
- Operations with missing parameters
- Invalid operation types
- Circular macro references

**Coverage Target:** 90% branches, 95% functions/lines

## Documentation Requirements

- [ ] JSDoc comments for all public methods
- [ ] JSDoc comments for all private methods
- [ ] Code examples in comments
- [ ] Document operation type mappings in comments
- [ ] Create `docs/goap/effects-analyzer-usage.md` with usage examples

## Acceptance Criteria

- [ ] EffectsAnalyzer class implemented with all methods
- [ ] Detects all 20+ state-changing operation types correctly
- [ ] Converts operations to effects correctly
- [ ] Handles macro expansion
- [ ] Traces conditional paths correctly
- [ ] Generates abstract preconditions for query operations
- [ ] Handles nested IF operations
- [ ] Handles multiple execution paths
- [ ] All unit tests pass with 90%+ coverage
- [ ] All edge case tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Documentation complete

## Success Metrics

- ✅ Correctly identifies state-changing operations
- ✅ Accurately converts operations to effects
- ✅ Handles complex conditional logic
- ✅ Generates valid planning effects structures
- ✅ All tests green with high coverage

## Notes

- **Macro Resolution Critical:** Must integrate with existing macro system
- **Path Tracing:** Algorithm must handle nested conditionals
- **Abstract Preconditions:** Foundation for planner simulation
- **Validation:** Each conversion should validate input parameters

## Related Tickets

- Depends on: GOAP-TIER1-001 (Schema Design and DI Setup)
- Blocks: GOAP-TIER1-003 (Effects Generator Implementation)
- Blocks: GOAP-TIER1-004 (Content Generation and Validation Tools)
