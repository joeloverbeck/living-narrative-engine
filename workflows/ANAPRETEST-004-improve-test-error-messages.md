# ANAPRETEST-004: Improve Test Error Messages for Prerequisites

**Phase:** 2 (Developer Experience)
**Priority:** P2 (Medium)
**Effort:** Medium (3-4 days)
**Impact:** Medium - Significantly improves debugging experience
**Status:** Not Started

## Context

When prerequisite evaluation fails in tests, error messages are vague and don't indicate which prerequisite failed or why. Developers must enable verbose diagnostics and manually inspect logs to understand failures.

**Current Behavior:**
```
"Action not discovered"
```

**Desired Behavior:**
```
Action 'seduction:grab_crotch_draw_attention' not discovered
  Prerequisite #3 failed: hasOtherActorsAtLocation(['actor'])
  Expected: true (other actors present)
  Actual: false (no other actors found)
  Actor location: room1
  Entities at location: 1 (only the actor)
```

**Impact:** Slow debugging cycles, difficult root cause analysis, time wasted on manual log inspection.

**Reference:** Report lines 194-217

## Solution Overview

Enhance prerequisite evaluation error messages to provide actionable debugging information:

1. **Enhanced Error Context**
   - Include which prerequisite failed (index and logic)
   - Show actual vs expected values
   - Display relevant entity state
   - Provide contextual hints

2. **Debug Mode Integration**
   - Add optional debug mode flag for verbose prerequisite logging
   - Integrate with existing ModTestFixture diagnostics
   - Control verbosity levels (error, warn, debug)

3. **Structured Error Reporting**
   - Create `PrerequisiteEvaluationError` class with rich context
   - Format errors for both test output and logging
   - Support JSON serialization for tooling

## File Structure

```
src/actions/validation/
├── errors/
│   └── prerequisiteEvaluationError.js      # NEW: Rich error class
├── prerequisiteEvaluationService.js         # Modified: Enhanced errors
└── prerequisiteDebugger.js                  # NEW: Debug utilities

tests/common/engine/
└── systemLogicTestEnv.js                    # Modified: Debug mode support

tests/unit/actions/validation/
└── prerequisiteErrorMessages.test.js        # NEW: Error message tests

docs/testing/
└── debugging-prerequisites.md               # NEW: Debugging guide
```

## Detailed Implementation Steps

### Step 1: Create PrerequisiteEvaluationError Class

**File:** `src/actions/validation/errors/prerequisiteEvaluationError.js`

```javascript
/**
 * @file Prerequisite Evaluation Error
 * @description Rich error class for prerequisite evaluation failures
 */

/**
 * Error thrown when prerequisite evaluation fails with enhanced context.
 */
export class PrerequisiteEvaluationError extends Error {
  /**
   * @param {Object} context - Error context
   * @param {string} context.actionId - Action ID being evaluated
   * @param {number} context.prerequisiteIndex - Index of failed prerequisite
   * @param {Object} context.prerequisiteLogic - The prerequisite logic that failed
   * @param {*} context.expectedResult - Expected evaluation result
   * @param {*} context.actualResult - Actual evaluation result
   * @param {Object} context.entityState - Relevant entity state
   * @param {string} context.hint - Debugging hint
   */
  constructor(context) {
    const message = PrerequisiteEvaluationError.formatMessage(context);
    super(message);

    this.name = 'PrerequisiteEvaluationError';
    this.actionId = context.actionId;
    this.prerequisiteIndex = context.prerequisiteIndex;
    this.prerequisiteLogic = context.prerequisiteLogic;
    this.expectedResult = context.expectedResult;
    this.actualResult = context.actualResult;
    this.entityState = context.entityState;
    this.hint = context.hint;
    this.context = context;
  }

  /**
   * Format error message with context.
   *
   * @param {Object} context - Error context
   * @returns {string} Formatted error message
   */
  static formatMessage(context) {
    const parts = [];

    // Header
    parts.push(`Action '${context.actionId}' not discovered`);

    // Failed prerequisite
    parts.push(
      `  Prerequisite #${context.prerequisiteIndex + 1} failed: ` +
      `${JSON.stringify(context.prerequisiteLogic)}`
    );

    // Expected vs Actual
    parts.push(`  Expected: ${formatValue(context.expectedResult)}`);
    parts.push(`  Actual: ${formatValue(context.actualResult)}`);

    // Entity state
    if (context.entityState) {
      parts.push('  Entity State:');
      for (const [key, value] of Object.entries(context.entityState)) {
        parts.push(`    ${key}: ${formatValue(value)}`);
      }
    }

    // Hint
    if (context.hint) {
      parts.push(`  💡 Hint: ${context.hint}`);
    }

    return parts.join('\n');
  }

  /**
   * Convert error to JSON for structured logging.
   *
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      error: this.name,
      actionId: this.actionId,
      prerequisiteIndex: this.prerequisiteIndex,
      prerequisiteLogic: this.prerequisiteLogic,
      expectedResult: this.expectedResult,
      actualResult: this.actualResult,
      entityState: this.entityState,
      hint: this.hint
    };
  }
}

/**
 * Format a value for display in error messages.
 *
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[] (empty array)';
    return `[${value.map(v => formatValue(v)).join(', ')}] (${value.length} items)`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{} (empty object)';
    return `{ ${keys.join(', ')} } (${keys.length} keys)`;
  }
  return String(value);
}
```

### Step 2: Create Prerequisite Debugger Utility

**File:** `src/actions/validation/prerequisiteDebugger.js`

```javascript
/**
 * @file Prerequisite Debugger
 * @description Utilities for debugging prerequisite evaluation
 */

import { PrerequisiteEvaluationError } from './errors/prerequisiteEvaluationError.js';
import { ActionValidationContextBuilder } from './actionValidationContextBuilder.js';

/**
 * Debug mode levels.
 */
export const DebugLevel = {
  NONE: 0,     // No debugging
  ERROR: 1,    // Only log errors
  WARN: 2,     // Log errors and warnings
  DEBUG: 3     // Log everything
};

/**
 * Prerequisite debugger for enhanced error messages.
 */
export class PrerequisiteDebugger {
  #logger;
  #debugLevel;
  #entityManager;

  constructor({ logger, debugLevel = DebugLevel.NONE, entityManager }) {
    this.#logger = logger;
    this.#debugLevel = debugLevel;
    this.#entityManager = entityManager;
  }

  /**
   * Evaluate prerequisite with enhanced error context.
   *
   * @param {Object} params - Evaluation parameters
   * @param {string} params.actionId - Action ID
   * @param {number} params.prerequisiteIndex - Prerequisite index
   * @param {Object} params.prerequisiteLogic - Prerequisite logic
   * @param {Function} params.evaluator - Evaluation function
   * @param {Object} params.context - Evaluation context
   * @returns {Object} { success: boolean, result: *, error: PrerequisiteEvaluationError? }
   */
  evaluate({ actionId, prerequisiteIndex, prerequisiteLogic, evaluator, context }) {
    try {
      const result = evaluator(prerequisiteLogic, context);

      if (this.#debugLevel >= DebugLevel.DEBUG) {
        this.#logger.debug('Prerequisite evaluated', {
          actionId,
          prerequisiteIndex,
          logic: prerequisiteLogic,
          result,
          context: this.#sanitizeContext(context)
        });
      }

      return { success: true, result };

    } catch (error) {
      const enrichedError = this.#enrichError({
        actionId,
        prerequisiteIndex,
        prerequisiteLogic,
        originalError: error,
        context
      });

      if (this.#debugLevel >= DebugLevel.ERROR) {
        this.#logger.error('Prerequisite evaluation failed', enrichedError.toJSON());
      }

      return { success: false, error: enrichedError };
    }
  }

  /**
   * Enrich error with context from entity state.
   *
   * @param {Object} params - Error enrichment parameters
   * @returns {PrerequisiteEvaluationError} Enriched error
   */
  #enrichError({ actionId, prerequisiteIndex, prerequisiteLogic, originalError, context }) {
    const entityState = this.#extractEntityState(prerequisiteLogic, context);
    const hint = this.#generateHint(prerequisiteLogic, entityState);

    return new PrerequisiteEvaluationError({
      actionId,
      prerequisiteIndex,
      prerequisiteLogic,
      expectedResult: true,
      actualResult: false,
      entityState,
      hint,
      originalError: originalError.message
    });
  }

  /**
   * Extract relevant entity state based on prerequisite logic.
   *
   * @param {Object} logic - Prerequisite logic
   * @param {Object} context - Evaluation context
   * @returns {Object} Relevant entity state
   */
  #extractEntityState(logic, context) {
    const state = {};

    // Extract operator name
    const operator = Object.keys(logic)[0];
    const args = logic[operator];

    // Common state extraction
    if (context.actor) {
      state.actorId = context.actor.id;
      state.actorLocation = this.#getEntityLocation(context.actor.id);
    }

    if (context.target) {
      state.targetId = context.target.id;
      state.targetLocation = this.#getEntityLocation(context.target.id);
    }

    // Operator-specific state
    switch (operator) {
      case 'hasPartOfType':
        state.bodyParts = this.#getBodyParts(args[0], context);
        break;

      case 'hasOtherActorsAtLocation':
        state.entitiesAtLocation = this.#getEntitiesAtLocation(context.actor.id);
        break;

      case 'hasClothingInSlot':
        state.wornItems = this.#getWornItems(args[0], context);
        break;

      case 'component_present':
        state.hasComponent = this.#hasComponent(args[0], args[1], context);
        break;
    }

    return state;
  }

  /**
   * Generate debugging hint based on prerequisite logic.
   *
   * @param {Object} logic - Prerequisite logic
   * @param {Object} entityState - Entity state
   * @returns {string} Debugging hint
   */
  #generateHint(logic, entityState) {
    const operator = Object.keys(logic)[0];
    const args = logic[operator];

    switch (operator) {
      case 'hasPartOfType':
        if (!entityState.bodyParts || entityState.bodyParts.length === 0) {
          return `Actor does not have any body parts of type "${args[1]}". Check anatomy:body component.`;
        }
        break;

      case 'hasOtherActorsAtLocation':
        if (entityState.entitiesAtLocation === 1) {
          return 'Only the actor is at this location. Add other actors to the scene.';
        }
        break;

      case 'hasClothingInSlot':
        if (!entityState.wornItems || entityState.wornItems.length === 0) {
          return `No clothing in slot "${args[1]}". Add worn_items component with slot.`;
        }
        break;

      case 'component_present':
        if (!entityState.hasComponent) {
          return `Entity missing component "${args[1]}". Add component to entity.`;
        }
        break;
    }

    return 'Review prerequisite logic and entity state above.';
  }

  /**
   * Get entity location from position component.
   *
   * @param {string} entityId - Entity ID
   * @returns {string|null} Location ID
   */
  #getEntityLocation(entityId) {
    const positionData = this.#entityManager.getComponentData(entityId, 'core:position');
    return positionData?.locationId || null;
  }

  /**
   * Get body parts from anatomy component.
   *
   * @param {string} entityRef - Entity reference ('actor' or 'target')
   * @param {Object} context - Evaluation context
   * @returns {Array} Body part types
   */
  #getBodyParts(entityRef, context) {
    const entity = context[entityRef];
    if (!entity) return [];

    const bodyComponent = this.#entityManager.getComponentData(entity.id, 'anatomy:body');
    if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.parts) return [];

    return Object.values(bodyComponent.body.parts).map(partId => {
      const partComponent = this.#entityManager.getComponentData(partId, 'anatomy:part');
      return partComponent?.subType;
    }).filter(Boolean);
  }

  /**
   * Get entities at same location as actor.
   *
   * @param {string} actorId - Actor ID
   * @returns {number} Count of entities at location
   */
  #getEntitiesAtLocation(actorId) {
    const actorLocation = this.#getEntityLocation(actorId);
    if (!actorLocation) return 0;

    const entities = this.#entityManager.getEntities();
    return entities.filter(e => {
      const loc = this.#getEntityLocation(e.id);
      return loc === actorLocation;
    }).length;
  }

  /**
   * Get worn items from clothing component.
   *
   * @param {string} entityRef - Entity reference
   * @param {Object} context - Evaluation context
   * @returns {Array} Worn item slots
   */
  #getWornItems(entityRef, context) {
    const entity = context[entityRef];
    if (!entity) return [];

    const clothingData = this.#entityManager.getComponentData(entity.id, 'clothing:worn_items');
    if (!clothingData || !clothingData.slots) return [];

    return Object.keys(clothingData.slots);
  }

  /**
   * Check if entity has component.
   *
   * @param {string} entityRef - Entity reference
   * @param {string} componentType - Component type
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if entity has component
   */
  #hasComponent(entityRef, componentType, context) {
    const entity = context[entityRef];
    if (!entity) return false;

    return this.#entityManager.hasComponent(entity.id, componentType);
  }

  /**
   * Sanitize context for logging (remove circular references).
   *
   * @param {Object} context - Context to sanitize
   * @returns {Object} Sanitized context
   */
  #sanitizeContext(context) {
    return {
      actor: context.actor?.id || null,
      target: context.target?.id || null,
      targets: Object.keys(context.targets || {})
    };
  }
}
```

### Step 3: Integrate with PrerequisiteEvaluationService

**File:** `src/actions/validation/prerequisiteEvaluationService.js` (modify)

**Note:** The actual integration requires modifying the existing `PrerequisiteEvaluationService.evaluate()` method to optionally use the debugger when debug mode is enabled.

```javascript
// Add to imports
import { PrerequisiteDebugger, DebugLevel } from './prerequisiteDebugger.js';

// Modify the PrerequisiteEvaluationService class
class PrerequisiteEvaluationService extends BaseService {
  #logger;
  #jsonLogicEvaluationService;
  #actionValidationContextBuilder;
  #gameDataRepository;
  #debugger; // NEW: Optional debugger

  constructor({
    logger,
    jsonLogicEvaluationService,
    actionValidationContextBuilder,
    gameDataRepository,
    entityManager, // NEW: Required for debugger
    debugMode = false, // NEW: Debug mode flag
  }) {
    // ... existing initialization ...

    // NEW: Create debugger if entity manager is provided
    if (entityManager) {
      const debugLevel = debugMode ? DebugLevel.DEBUG : DebugLevel.ERROR;
      this.#debugger = new PrerequisiteDebugger({
        logger,
        debugLevel,
        entityManager
      });
    }
  }

  /**
   * Modified internal evaluation to use debugger when available
   */
  #evaluatePrerequisiteInternal(
    prereqObject,
    ruleNumber,
    totalRules,
    evaluationContext,
    actionId,
    trace = null
  ) {
    // Validate rule structure
    if (!this._validatePrerequisiteRule(prereqObject, ruleNumber, totalRules, actionId)) {
      return false;
    }

    // If debugger is available, use it for enhanced error context
    if (this.#debugger) {
      const result = this.#debugger.evaluate({
        actionId,
        prerequisiteIndex: ruleNumber - 1,
        prerequisiteLogic: prereqObject.logic,
        evaluator: (logic) => this.#resolveAndEvaluate(prereqObject, actionId, evaluationContext, trace),
        context: evaluationContext
      });

      if (!result.success) {
        // Error with enhanced context already logged by debugger
        return false;
      }

      return this._logPrerequisiteResult(
        result.result,
        prereqObject,
        ruleNumber,
        totalRules,
        actionId
      );
    }

    // Fallback to existing implementation when debugger not available
    let rulePassed;
    try {
      rulePassed = this.#resolveAndEvaluate(prereqObject, actionId, evaluationContext, trace);
    } catch (evalError) {
      // ... existing error handling ...
      return false;
    }

    return this._logPrerequisiteResult(rulePassed, prereqObject, ruleNumber, totalRules, actionId);
  }
}
```

### Step 4: Add Debug Mode to ModTestFixture

**File:** `tests/common/engine/systemLogicTestEnv.js` (modify)

**Note:** The test environment uses `PrerequisiteEvaluationService` which is created in the test setup. Debug mode integration requires passing `entityManager` and `debugMode` flags during service instantiation.

```javascript
export function createBaseRuleEnvironment({
  // ... existing parameters ...
  debugPrerequisites = false, // NEW: Debug mode flag
}) {
  // ... existing setup ...

  // Modify the prerequisite service creation to include entityManager
  const prerequisiteService = new PrerequisiteEvaluationService({
    logger: testLogger,
    jsonLogicEvaluationService: jsonLogic,
    actionValidationContextBuilder,
    gameDataRepository: testDataRegistry,
    entityManager: init.entityManager, // NEW: Pass entity manager for debugging
    debugMode: debugPrerequisites, // NEW: Enable debug mode
  });

  return {
    // ... existing properties ...
    prerequisiteService,
    // NEW: Methods to control debug mode
    enablePrerequisiteDebug: () => {
      // This would require adding setDebugMode method to PrerequisiteEvaluationService
      // Or recreating the service with debugMode: true
    },
    disablePrerequisiteDebug: () => {
      // Similar to enable
    }
  };
}
```

**File:** `tests/common/mods/ModTestFixture.js` (modify)

Add helper methods:

```javascript
class ModTestFixture {
  // ... existing code ...

  /**
   * Enable detailed prerequisite debugging.
   */
  enablePrerequisiteDebug() {
    this.testEnv.enablePrerequisiteDebug();
  }

  /**
   * Disable prerequisite debugging.
   */
  disablePrerequisiteDebug() {
    this.testEnv.disablePrerequisiteDebug();
  }
}
```

### Step 5: Create Error Message Tests

**File:** `tests/unit/actions/validation/prerequisiteErrorMessages.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationError } from '../../../../src/actions/validation/errors/prerequisiteEvaluationError.js';
import { PrerequisiteDebugger, DebugLevel } from '../../../../src/actions/validation/prerequisiteDebugger.js';

describe('Prerequisite Error Messages', () => {
  describe('PrerequisiteEvaluationError', () => {
    it('should format error with all context', () => {
      const error = new PrerequisiteEvaluationError({
        actionId: 'test:action',
        prerequisiteIndex: 2,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        expectedResult: true,
        actualResult: false,
        entityState: {
          actorId: 'actor-1',
          bodyParts: ['head', 'torso']
        },
        hint: 'Actor does not have any body parts of type "hand"'
      });

      const message = error.message;

      expect(message).toContain("Action 'test:action' not discovered");
      expect(message).toContain('Prerequisite #3 failed');
      expect(message).toContain('hasPartOfType');
      expect(message).toContain('Expected: true');
      expect(message).toContain('Actual: false');
      expect(message).toContain('actorId: "actor-1"');
      expect(message).toContain('bodyParts:');
      expect(message).toContain('💡 Hint: Actor does not have any body parts of type "hand"');
    });

    it('should serialize to JSON for structured logging', () => {
      const error = new PrerequisiteEvaluationError({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { component_present: ['actor', 'positioning:sitting'] },
        expectedResult: true,
        actualResult: false,
        entityState: { actorId: 'actor-1', hasComponent: false },
        hint: 'Entity missing component'
      });

      const json = error.toJSON();

      expect(json.error).toBe('PrerequisiteEvaluationError');
      expect(json.actionId).toBe('test:action');
      expect(json.prerequisiteIndex).toBe(0);
      expect(json.hint).toBe('Entity missing component');
    });
  });

  describe('PrerequisiteDebugger', () => {
    let logger;
    let entityManager;
    let debugger;

    beforeEach(() => {
      logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };

      entityManager = {
        getEntities: jest.fn(() => []),
        getComponentData: jest.fn(() => null),
        hasComponent: jest.fn(() => false)
      };

      debugger = new PrerequisiteDebugger({
        logger,
        debugLevel: DebugLevel.DEBUG,
        entityManager
      });
    });

    it('should generate helpful hints for hasPartOfType failures', () => {
      const result = debugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'breast'] },
        evaluator: () => { throw new Error('Part not found'); },
        context: { actor: { id: 'actor-1' } }
      });

      expect(result.success).toBe(false);
      expect(result.error.hint).toContain('does not have any body parts of type "breast"');
    });

    it('should extract entity state for debugging', () => {
      entityManager.getComponentData.mockReturnValue({
        parts: {
          'hand-left': { type: 'hand', name: 'left hand' },
          'hand-right': { type: 'hand', name: 'right hand' }
        }
      });

      const result = debugger.evaluate({
        actionId: 'test:action',
        prerequisiteIndex: 0,
        prerequisiteLogic: { hasPartOfType: ['actor', 'hand'] },
        evaluator: () => true,
        context: { actor: { id: 'actor-1' } }
      });

      expect(result.success).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        'Prerequisite evaluated',
        expect.objectContaining({
          result: true
        })
      );
    });
  });
});
```

### Step 6: Create Debugging Guide

**File:** `docs/testing/debugging-prerequisites.md`

```markdown
# Debugging Prerequisite Evaluation

## Overview

This guide explains how to debug prerequisite evaluation failures using enhanced error messages and debug mode.

## Quick Start

### Enable Debug Mode

```javascript
beforeEach(async () => {
  fixture = await ModTestFixture.forAction('mod', 'action');
  fixture.enablePrerequisiteDebug(); // Enable detailed logging
});
```

### Read Enhanced Error Messages

When a prerequisite fails, you'll see:

```
Action 'seduction:grab_crotch_draw_attention' not discovered
  Prerequisite #3 failed: {"hasOtherActorsAtLocation":["actor"]}
  Expected: true (other actors present)
  Actual: false (no other actors found)
  Entity State:
    actorId: "actor-1"
    actorLocation: "room1"
    entitiesAtLocation: 1 (only the actor)
  💡 Hint: Only the actor is at this location. Add other actors to the scene.
```

## Error Message Components

### 1. Action Identification
```
Action 'seduction:grab_crotch_draw_attention' not discovered
```

**What it tells you:** Which action failed discovery

### 2. Failed Prerequisite
```
Prerequisite #3 failed: {"hasOtherActorsAtLocation":["actor"]}
```

**What it tells you:**
- Which prerequisite failed (index #3 means 4th prerequisite, 0-indexed)
- The exact prerequisite logic that was evaluated

### 3. Expected vs Actual
```
Expected: true (other actors present)
Actual: false (no other actors found)
```

**What it tells you:**
- What the prerequisite should have returned
- What it actually returned

### 4. Entity State
```
Entity State:
  actorId: "actor-1"
  actorLocation: "room1"
  entitiesAtLocation: 1 (only the actor)
```

**What it tells you:**
- Relevant entity state at evaluation time
- Operator-specific context (varies by operator)

### 5. Debugging Hint
```
💡 Hint: Only the actor is at this location. Add other actors to the scene.
```

**What it tells you:**
- Actionable suggestion for fixing the test
- Common remediation steps

## Operator-Specific State

### hasPartOfType

**State Provided:**
- `actorId` / `targetId`: Entity IDs
- `bodyParts`: Array of body part types the entity has

**Example:**
```
Entity State:
  actorId: "actor-1"
  bodyParts: ["head", "torso", "arm"] (3 items)
💡 Hint: Actor does not have any body parts of type "breast"
```

**Fix:** Add required anatomy to actor's `anatomy:body` component

### hasOtherActorsAtLocation

**State Provided:**
- `actorId`: Actor ID
- `actorLocation`: Actor's location ID
- `entitiesAtLocation`: Count of entities at same location

**Example:**
```
Entity State:
  actorId: "actor-1"
  actorLocation: "room1"
  entitiesAtLocation: 1 (only the actor)
💡 Hint: Only the actor is at this location. Add other actors
```

**Fix:** Add other actors to the same location

### hasClothingInSlot

**State Provided:**
- `actorId` / `targetId`: Entity IDs
- `wornItems`: Array of occupied clothing slots

**Example:**
```
Entity State:
  actorId: "actor-1"
  wornItems: ["head", "feet"] (2 items)
💡 Hint: No clothing in slot "chest". Add worn_items component
```

**Fix:** Add clothing to required slot in `clothing:worn_items` component

### component_present

**State Provided:**
- `actorId` / `targetId`: Entity IDs
- `hasComponent`: Boolean indicating component presence

**Example:**
```
Entity State:
  actorId: "actor-1"
  hasComponent: false
💡 Hint: Entity missing component "positioning:sitting"
```

**Fix:** Add required component to entity

## Debug Mode Levels

```javascript
// No debugging (default)
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.NONE });

// Log only errors
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.ERROR });

// Log errors and warnings
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.WARN });

// Log everything
const debugger = new PrerequisiteDebugger({ logger, debugLevel: DebugLevel.DEBUG });
```

## Best Practices

### 1. Enable Debug Mode Only When Needed

```javascript
it('should discover action', async () => {
  // Only enable if test is failing
  // fixture.enablePrerequisiteDebug();

  const actions = await fixture.discoverActions(actor.id);
  expect(actions).toContainAction('mod:action');
});
```

### 2. Read Error Messages Top to Bottom

1. **Action ID** - Confirms which action failed
2. **Prerequisite** - Identifies which logic to fix
3. **Entity State** - Shows what data was missing
4. **Hint** - Provides remediation steps

### 3. Use Structured Logging

```javascript
it('should log prerequisite failures', async () => {
  try {
    await fixture.discoverActions(actor.id);
  } catch (error) {
    // Error is PrerequisiteEvaluationError with toJSON()
    console.log(JSON.stringify(error.toJSON(), null, 2));
  }
});
```

## Common Patterns

### Missing Anatomy

**Error:**
```
💡 Hint: Actor does not have any body parts of type "breast"
```

**Fix:**
```javascript
const actor = fixture.createEntity({
  components: {
    'anatomy:body': {
      parts: {
        'breast-left': { type: 'breast', ... },
        'breast-right': { type: 'breast', ... }
      }
    }
  }
});
```

### Missing Other Actors

**Error:**
```
💡 Hint: Only the actor is at this location. Add other actors
```

**Fix:**
```javascript
const actors = fixture.createStandardActorTarget(['Actor', 'Target']);
// Both actors now at same location
```

### Missing Components

**Error:**
```
💡 Hint: Entity missing component "positioning:sitting"
```

**Fix:**
```javascript
actor.components['positioning:sitting'] = { furniture_id: 'couch' };
```

## References

- **Error Class:** `src/actions/validation/errors/prerequisiteEvaluationError.js`
- **Debugger:** `src/actions/validation/prerequisiteDebugger.js`
- **Evaluation Service:** `src/actions/validation/prerequisiteEvaluationService.js`
- **Tests:** `tests/unit/actions/validation/prerequisiteErrorMessages.test.js`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 194-217)
```

## Acceptance Criteria

- [ ] `PrerequisiteEvaluationError` class created with rich context
- [ ] `PrerequisiteDebugger` utility created with operator-specific state extraction
- [ ] `PrerequisiteEvaluator` integrated with debugger
- [ ] Debug mode integrated into `ModTestFixture` (`enablePrerequisiteDebug()`)
- [ ] Error messages include:
  - Action ID
  - Failed prerequisite index and logic
  - Expected vs actual results
  - Relevant entity state
  - Actionable debugging hints
- [ ] Tests verify error message formatting
- [ ] Debugging guide created at `docs/testing/debugging-prerequisites.md`
- [ ] All existing tests pass (no regressions)

## Implementation Notes

**Key Design Decisions:**

1. **Opt-in Debug Mode**: Debug mode is opt-in to avoid performance overhead in normal test runs
2. **Operator-Specific State**: Each operator type provides relevant state (anatomy, location, components)
3. **Actionable Hints**: Generate hints based on common failure patterns

**Testing Strategy:**

1. Unit tests verify error message formatting
2. Integration tests verify debug mode integration
3. Manual testing confirms readability

**Performance Considerations:**

- Debug mode should have minimal overhead when disabled
- State extraction only happens on failure
- Structured logging uses JSON serialization for efficiency

## Dependencies

**Requires:**
- None (standalone improvement)

**Enhances:**
- ANAPRETEST-002 (Targetless Action Validation) - Better error messages for failures

## References

- **Report Section:** Suggestion #4 - Improve Test Error Messages
- **Report Lines:** 194-217
- **Example Improvements:**
  - Before: "Action not discovered"
  - After: Multi-line error with prerequisite details, entity state, and hints
