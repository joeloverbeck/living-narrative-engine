# MULHITSIMROB-004: Extract TargetSelector to Separate Module

## Summary

Extract the `TargetSelector` class from `MultiHitSimulator.js` into its own module for independent testing and reusability.

## Status

Completed

## Background

The `TargetSelector` class (lines 79-137 in `MultiHitSimulator.js`) manages target part selection across three modes: random, round-robin, and focus. Currently embedded in `MultiHitSimulator.js`, it cannot be tested independently.

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 386-399

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/domUI/damage-simulator/TargetSelector.js` | CREATE | New module with extracted class |
| `src/domUI/damage-simulator/MultiHitSimulator.js` | MODIFY | Import TargetSelector from new module |
| `tests/unit/domUI/damage-simulator/TargetSelector.test.js` | CREATE | New unit tests for TargetSelector |

## Out of Scope

- NOT modifying TargetSelector behavior or API
- NOT modifying MultiHitSimulator logic beyond the import change
- NOT modifying existing MultiHitSimulator tests
- NOT changing mode validation (stays in `configure()`)
- NOT adding new targeting modes

## Implementation Details

### Current TargetSelector (lines 79-137)

```javascript
class TargetSelector {
  #mode;
  #focusPartId;
  #parts;
  #currentIndex;

  constructor(parts, mode, focusPartId) {
    this.#parts = parts;
    this.#mode = mode;
    this.#focusPartId = focusPartId;
    this.#currentIndex = 0;
  }

  getNextTarget() {
    if (this.#parts.length === 0) return null;

    switch (this.#mode) {
      case 'random':
        return this.#parts[Math.floor(Math.random() * this.#parts.length)].id;
      case 'round-robin':
        const part = this.#parts[this.#currentIndex];
        this.#currentIndex = (this.#currentIndex + 1) % this.#parts.length;
        return part.id;
      case 'focus':
        return this.#focusPartId;
    }
  }

  reset() {
    this.#currentIndex = 0;
  }
}
```

### New Module: TargetSelector.js

```javascript
/**
 * @file TargetSelector.js
 * @description Manages target part selection for multi-hit simulations.
 * Supports random, round-robin, and focus targeting modes.
 * @see specs/multi-hit-simulator-robustness.md
 */

/**
 * @typedef {Object} TargetPart
 * @property {string} id - Unique part identifier
 * @property {string} name - Display name
 * @property {number} [weight] - Selection weight (for random mode)
 */

/**
 * TargetSelector manages target selection across three modes.
 */
class TargetSelector {
  // ... (exact same implementation)
}

export default TargetSelector;
```

### Updated Import in MultiHitSimulator.js

```javascript
// Before (class defined inline)
class TargetSelector { ... }

// After
import TargetSelector from './TargetSelector.js';
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] New `TargetSelector.test.js` achieves 100% coverage of TargetSelector
- [ ] All existing 94 MultiHitSimulator tests pass unchanged
- [ ] Random mode returns valid part IDs
- [ ] Round-robin mode cycles through parts deterministically
- [ ] Focus mode returns focusPartId when parts are present
- [ ] Empty parts array returns null
- [ ] Reset() resets round-robin index to 0

### Invariants That Must Remain True

- TargetSelector API unchanged (constructor signature, getNextTarget(), reset())
- Round-robin determinism preserved (same sequence given same parts)
- Mode validation still happens in `configure()`, NOT in TargetSelector
- Focus mode returns null when parts array is empty (guard runs before mode switch)
- TargetSelector expects `parts` to be an array (no new null handling added)

### New Test Coverage Requirements

```javascript
describe('TargetSelector', () => {
  describe('constructor', () => {
    it('should accept parts, mode, and focusPartId');
    it('should handle empty parts array');
  });

  describe('getNextTarget - random mode', () => {
    it('should return a valid part id from parts array');
    it('should return null for empty parts');
  });

  describe('getNextTarget - round-robin mode', () => {
    it('should cycle through parts in order');
    it('should wrap around after last part');
    it('should return null for empty parts');
  });

  describe('getNextTarget - focus mode', () => {
    it('should always return focusPartId when parts exist');
    it('should return null with empty parts');
  });

  describe('reset', () => {
    it('should reset round-robin index to 0');
    it('should not affect random or focus modes');
  });
});
```

## Verification Commands

```bash
# Run new TargetSelector tests
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/TargetSelector.test.js --no-coverage --verbose

# Verify MultiHitSimulator tests still pass
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --silent

# Full coverage check for both files
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/ --coverage --collectCoverageFrom='src/domUI/damage-simulator/TargetSelector.js' --collectCoverageFrom='src/domUI/damage-simulator/MultiHitSimulator.js'
```

## Dependencies

- **Blocks**: MULHITSIMROB-007 (View extraction may need TargetSelector reference)
- **Blocked by**: MULHITSIMROB-001, MULHITSIMROB-002, MULHITSIMROB-003 (tests should be in place first)
- **Related**: MULHITSIMROB-008 (state machine may interact with targeting)

## Estimated Effort

Small - straightforward class extraction with no logic changes.

## Reference Files

- Source: `src/domUI/damage-simulator/MultiHitSimulator.js` (lines 79-137)
- Pattern: Any standalone class module in `src/` (e.g., `src/entities/Entity.js`)

## Outcome

TargetSelector was extracted into a standalone module and unit tests were added as planned. Assumptions were corrected to reflect the actual constructor signature and focus-mode behavior with empty parts (returns null), but no behavior changes were introduced.
