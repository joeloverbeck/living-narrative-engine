# GOAPIMPL-025-04: State Diff Viewer Tool

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Priority**: MEDIUM
**Estimated Effort**: 1.5 hours
**Dependencies**: None (uses PlanningEffectsSimulator)

## Description

Create a state diff viewer that shows symbolic world state changes during GOAP planning. The tool compares planning state hashes (before/after task application) to visualize what changed in the abstract planning model.

**IMPORTANT**: This works with **planning state hashes** (symbolic key-value pairs), NOT ECS components. Planning state is an abstract representation used by the GOAP planner, separate from the actual game entity-component state.

**Reference**:
- Parent ticket: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md` (Issue #6)
- Spec: `specs/goap-system-specs.md` lines 507-516

## Acceptance Criteria

- [ ] Compares two planning state hashes
- [ ] Identifies added, modified, removed facts
- [ ] Formats changes in readable text
- [ ] Handles nested state structures
- [ ] Returns JSON format option for tooling
- [ ] Clearly documents planning state vs ECS distinction
- [ ] Unit tests validate diff calculation
- [ ] Integration tests with PlanningEffectsSimulator

## Current State Analysis

### Planning State Structure

From `src/goap/planner/planningEffectsSimulator.js`:

Planning state is a **symbolic hash** (flat key-value pairs):
```javascript
{
  'actor.state.hunger': 50,
  'actor.state.health': 100,
  'actor.inventory.count': 0,
  'world.location.forest-1.resources.available': true,
  'world.entities.food-1.exists': true,
}
```

**NOT** ECS components:
```javascript
// This is ECS (execution time)
entity.getComponent('core:actor') => { health: 100, ... }

// Planning state is flattened symbolic representation
'actor.state.health' => 100
```

### PlanningEffectsSimulator

From `src/goap/planner/planningEffectsSimulator.js`:

```javascript
async simulate(state, task, params) {
  // Returns new state (immutable)
  const newState = { ...state };
  
  // Apply task planning effects
  for (const effect of task.planningEffects) {
    this.#applyEffect(newState, effect, params);
  }
  
  return newState;
}
```

Output is a **new state hash** with changes applied.

### State Changes Example

Before task:
```javascript
{
  'actor.state.hunger': 50,
  'actor.inventory.items.length': 0,
  'world.entities.food-1.exists': true,
}
```

After `consume_nourishing_item(item: food-1)`:
```javascript
{
  'actor.state.hunger': 30,          // MODIFIED
  'actor.inventory.items.length': 0,
  'world.entities.food-1.exists': false, // MODIFIED
  'actor.state.last_ate': 1234567890,    // ADDED
}
```

## Implementation Details

### File to Create

`src/goap/debug/stateDiffViewer.js`

```javascript
/**
 * @file State diff viewer for planning state changes
 * 
 * IMPORTANT: This works with PLANNING STATE HASHES (symbolic key-value pairs),
 * not ECS components. Planning state is an abstract representation used by
 * the GOAP planner, separate from execution-time entity components.
 */

import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Visualizes differences between planning state hashes.
 */
class StateDiffViewer {
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.logger - Logger instance
   */
  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Calculate diff between two planning states.
   * @param {object} beforeState - Planning state before task
   * @param {object} afterState - Planning state after task
   * @returns {object} Diff with added, modified, removed facts
   */
  diff(beforeState, afterState) {
    assertPresent(beforeState, 'beforeState is required');
    assertPresent(afterState, 'afterState is required');
    
    const added = [];
    const modified = [];
    const removed = [];
    
    // Find added and modified
    for (const [key, afterValue] of Object.entries(afterState)) {
      if (!(key in beforeState)) {
        added.push({ key, value: afterValue });
      } else if (!this.#deepEquals(beforeState[key], afterValue)) {
        modified.push({
          key,
          oldValue: beforeState[key],
          newValue: afterValue,
        });
      }
    }
    
    // Find removed
    for (const [key, beforeValue] of Object.entries(beforeState)) {
      if (!(key in afterState)) {
        removed.push({ key, value: beforeValue });
      }
    }
    
    return { added, modified, removed };
  }

  /**
   * Visualize diff as formatted text.
   * @param {object} diff - Diff from diff()
   * @param {object} options - Formatting options
   * @param {string} [options.taskId] - Task that caused changes
   * @param {object} [options.params] - Task parameters
   * @returns {string} Formatted diff text
   */
  visualize(diff, options = {}) {
    assertPresent(diff, 'diff is required');
    
    let output = '';
    output += `=== State Diff: Before Task → After Task ===\n`;
    
    if (options.taskId) {
      output += `Task Applied: ${options.taskId}`;
      if (options.params) {
        output += ` (params: ${JSON.stringify(options.params)})`;
      }
      output += `\n`;
    }
    output += `\n`;
    
    // Added facts
    if (diff.added.length > 0) {
      output += `Added Facts:\n`;
      for (const { key, value } of diff.added) {
        output += `  + ${key} = ${this.#formatValue(value)}\n`;
      }
      output += `\n`;
    }
    
    // Modified facts
    if (diff.modified.length > 0) {
      output += `Modified Facts:\n`;
      for (const { key, oldValue, newValue } of diff.modified) {
        output += `  ~ ${key}: ${this.#formatValue(oldValue)} → ${this.#formatValue(newValue)}\n`;
      }
      output += `\n`;
    }
    
    // Removed facts
    if (diff.removed.length > 0) {
      output += `Removed Facts:\n`;
      for (const { key, value } of diff.removed) {
        output += `  - ${key} = ${this.#formatValue(value)}\n`;
      }
      output += `\n`;
    }
    
    // Summary
    const totalChanges = diff.added.length + diff.modified.length + diff.removed.length;
    if (totalChanges === 0) {
      output += `No state changes detected.\n\n`;
    } else {
      output += `Total Changes: ${totalChanges} (${diff.added.length} added, ${diff.modified.length} modified, ${diff.removed.length} removed)\n\n`;
    }
    
    output += `=== End Diff ===\n`;
    
    return output;
  }

  /**
   * Get diff as JSON for tooling.
   * @param {object} beforeState - Planning state before task
   * @param {object} afterState - Planning state after task
   * @returns {object} Diff object
   */
  diffJSON(beforeState, afterState) {
    const diff = this.diff(beforeState, afterState);
    return {
      diff,
      summary: {
        added: diff.added.length,
        modified: diff.modified.length,
        removed: diff.removed.length,
        total: diff.added.length + diff.modified.length + diff.removed.length,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Deep equality check for state values.
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if deeply equal
   * @private
   */
  #deepEquals(a, b) {
    if (a === b) return true;
    
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
      return false;
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key) || !this.#deepEquals(a[key], b[key])) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Format a state value for display.
   * @param {*} value - State value
   * @returns {string} Formatted value
   * @private
   */
  #formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}

export default StateDiffViewer;
```

## Testing Requirements

### Unit Tests

Create: `tests/unit/goap/debug/stateDiffViewer.test.js`

**Test Cases**:

1. **Added Facts**:
   - Detects new keys in afterState
   - Formats added facts correctly

2. **Modified Facts**:
   - Detects value changes
   - Shows old and new values
   - Handles nested objects

3. **Removed Facts**:
   - Detects missing keys in afterState
   - Formats removed facts correctly

4. **No Changes**:
   - Returns empty diff for identical states
   - Shows "No state changes" message

5. **Complex Changes**:
   - Handles multiple changes simultaneously
   - Calculates summary correctly

6. **Deep Equality**:
   - Detects nested object changes
   - Handles arrays correctly
   - Handles null/undefined correctly

**Test Structure**:
```javascript
import { describe, it, expect } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import StateDiffViewer from '../../../../src/goap/debug/stateDiffViewer.js';

describe('StateDiffViewer', () => {
  let viewer;

  beforeEach(() => {
    const testBed = createTestBed();
    viewer = new StateDiffViewer({
      logger: testBed.createMockLogger(),
    });
  });

  describe('diff', () => {
    it('should detect added facts', () => {
      const before = { 'actor.hunger': 50 };
      const after = { 'actor.hunger': 50, 'actor.health': 100 };
      
      const diff = viewer.diff(before, after);
      
      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].key).toBe('actor.health');
      expect(diff.added[0].value).toBe(100);
    });

    it('should detect modified facts', () => {
      const before = { 'actor.hunger': 50 };
      const after = { 'actor.hunger': 30 };
      
      const diff = viewer.diff(before, after);
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].key).toBe('actor.hunger');
      expect(diff.modified[0].oldValue).toBe(50);
      expect(diff.modified[0].newValue).toBe(30);
    });

    it('should detect removed facts', () => {
      const before = { 'actor.hunger': 50, 'actor.health': 100 };
      const after = { 'actor.hunger': 50 };
      
      const diff = viewer.diff(before, after);
      
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].key).toBe('actor.health');
      expect(diff.removed[0].value).toBe(100);
    });

    it('should return empty diff for identical states', () => {
      const state = { 'actor.hunger': 50, 'actor.health': 100 };
      
      const diff = viewer.diff(state, state);
      
      expect(diff.added).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
    });
  });

  describe('visualize', () => {
    it('should format diff as readable text', () => {
      const diff = {
        added: [{ key: 'actor.health', value: 100 }],
        modified: [{ key: 'actor.hunger', oldValue: 50, newValue: 30 }],
        removed: [{ key: 'actor.tired', value: true }],
      };
      
      const output = viewer.visualize(diff, {
        taskId: 'consume_food',
        params: { item: 'food-1' },
      });
      
      expect(output).toContain('consume_food');
      expect(output).toContain('+ actor.health = 100');
      expect(output).toContain('~ actor.hunger: 50 → 30');
      expect(output).toContain('- actor.tired = true');
    });
  });
});
```

### Integration Tests

Create: `tests/integration/goap/debug/stateDiffViewerIntegration.test.js`

Test with actual PlanningEffectsSimulator:

```javascript
it('should visualize state changes from task simulation', async () => {
  const task = {
    taskId: 'consume_nourishing_item',
    planningEffects: [
      { op: 'decrease', path: 'actor.state.hunger', amount: 20 },
      { op: 'set', path: 'world.entities.${item}.exists', value: false },
    ],
  };
  
  const beforeState = {
    'actor.state.hunger': 50,
    'world.entities.food-1.exists': true,
  };
  
  const afterState = await simulator.simulate(beforeState, task, { item: 'food-1' });
  
  const diff = viewer.diff(beforeState, afterState);
  const output = viewer.visualize(diff, { taskId: task.taskId });
  
  expect(diff.modified.length).toBeGreaterThan(0);
  expect(output).toContain('actor.state.hunger');
});
```

## Success Validation

✅ **Done when**:
- StateDiffViewer class implemented
- Diff calculation handles added/modified/removed
- Text and JSON output modes working
- Deep equality comparison functional
- Unit tests pass with coverage
- Integration tests with simulator pass
- Documentation clarifies planning state vs ECS
- No TypeScript errors
- No ESLint errors

## References

- Parent: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- Planning state: `src/goap/planner/planningEffectsSimulator.js`
- Validation: `claudedocs/workflow-validation-GOAPIMPL-025.md`
- Spec: `specs/goap-system-specs.md`
