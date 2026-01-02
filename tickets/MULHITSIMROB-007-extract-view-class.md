# MULHITSIMROB-007: Extract MultiHitSimulatorView Class

## Summary

Extract all DOM rendering and event binding logic from `MultiHitSimulator` into a separate `MultiHitSimulatorView` class, enabling testing of simulation logic without DOM mocks.

## Background

The current `MultiHitSimulator` has tight coupling between simulation logic and DOM manipulation. This required ~1,100 lines of DOM mock helpers in tests. Separating concerns enables:

1. Testing simulation logic without DOM mocks
2. Reusing view logic with different simulators
3. Easier UI updates without touching simulation logic

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 371-384

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/domUI/damage-simulator/MultiHitSimulatorView.js` | CREATE | New view class with DOM logic |
| `src/domUI/damage-simulator/MultiHitSimulator.js` | MODIFY | Delegate to view for UI operations |
| `tests/unit/domUI/damage-simulator/MultiHitSimulatorView.test.js` | CREATE | Unit tests for view class |

## Out of Scope

- NOT changing public API of MultiHitSimulator
- NOT modifying DamageExecutionService
- NOT modifying event emission contracts (events still come from simulator)
- NOT changing DOM element IDs or class names
- NOT modifying TargetSelector

## Implementation Details

### Methods to Extract to View

| Method | Lines | Purpose |
|--------|-------|---------|
| `render()` | ~100 | Creates DOM structure |
| `#bindEventListeners()` | ~50 | Attaches event handlers |
| `#updateProgressDisplay()` | ~30 | Updates progress bar/text |
| `#updateResultsDisplay()` | ~50 | Updates results panel |
| `#updateControlsState()` | ~40 | Enable/disable buttons |
| `#updateFocusPartOptions()` | ~30 | Populates focus part dropdown |

### New MultiHitSimulatorView Class

```javascript
/**
 * @file MultiHitSimulatorView.js
 * @description Handles DOM rendering and event binding for multi-hit simulation.
 */

class MultiHitSimulatorView {
  #containerElement;
  #eventHandlers;

  /**
   * @param {HTMLElement} containerElement - DOM container
   */
  constructor(containerElement) {
    this.#containerElement = containerElement;
    this.#eventHandlers = {};
  }

  /**
   * Renders the simulation UI.
   */
  render() { /* DOM creation logic */ }

  /**
   * Binds event handlers for UI controls.
   * @param {Object} handlers - { onRun, onStop, onConfigChange }
   */
  bindEventListeners(handlers) {
    this.#eventHandlers = handlers;
    /* Event binding logic */
  }

  /**
   * Updates progress display.
   * @param {SimulationProgress} progress
   */
  updateProgress(progress) { /* Progress update logic */ }

  /**
   * Updates results display.
   * @param {SimulationResults} results
   */
  updateResults(results) { /* Results update logic */ }

  /**
   * Updates control states (enabled/disabled).
   * @param {boolean} isRunning
   */
  updateControlsState(isRunning) { /* Control state logic */ }

  /**
   * Updates focus part dropdown options.
   * @param {Array<{id: string, name: string}>} parts
   */
  updateFocusPartOptions(parts) { /* Dropdown update logic */ }
}

export default MultiHitSimulatorView;
```

### Updated MultiHitSimulator

```javascript
import MultiHitSimulatorView from './MultiHitSimulatorView.js';

class MultiHitSimulator {
  #view;
  // ... other private fields

  constructor({ containerElement, executionService, eventBus, logger }) {
    // ... validation
    this.#view = new MultiHitSimulatorView(containerElement);
    // ...
  }

  render() {
    this.#view.render();
    this.#view.bindEventListeners({
      onRun: () => this.#handleRunClick(),
      onStop: () => this.stop(),
      onConfigChange: (config) => this.configure(config),
    });
    // ...
  }

  // Delegate UI updates to view
  #updateProgressDisplay() {
    this.#view.updateProgress(this.#progress);
  }

  #updateResultsDisplay(results) {
    this.#view.updateResults(results);
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] All existing 94 MultiHitSimulator tests pass unchanged
- [ ] New MultiHitSimulatorView tests achieve 100% coverage
- [ ] View tests do not require simulator logic mocks
- [ ] Simulator tests require less DOM mocking after refactor

### Invariants That Must Remain True

- Same DOM structure produced (element IDs, class names)
- Same event handling behavior (click handlers work the same)
- Same UI update timing (progress updates at same points)
- Same error handling for null elements

### New Test Coverage Requirements

```javascript
describe('MultiHitSimulatorView', () => {
  describe('constructor', () => {
    it('should accept container element');
    it('should handle null container gracefully');
  });

  describe('render', () => {
    it('should create progress bar');
    it('should create results panel');
    it('should create control buttons');
    it('should create configuration inputs');
  });

  describe('bindEventListeners', () => {
    it('should bind run button click handler');
    it('should bind stop button click handler');
    it('should bind config change handlers');
    it('should handle missing elements gracefully');
  });

  describe('updateProgress', () => {
    it('should update progress bar width');
    it('should update progress text');
    it('should handle null elements');
  });

  describe('updateResults', () => {
    it('should display hit counts');
    it('should display total damage');
    it('should display effects triggered');
    it('should handle null elements');
  });

  describe('updateControlsState', () => {
    it('should enable run button when not running');
    it('should disable run button when running');
    it('should enable stop button when running');
  });

  describe('updateFocusPartOptions', () => {
    it('should populate dropdown with parts');
    it('should handle empty parts array');
  });
});
```

## Verification Commands

```bash
# Run view tests
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulatorView.test.js --no-coverage --verbose

# Verify simulator tests still pass
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --silent

# Full coverage check
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/ --coverage
```

## Dependencies

- **Blocks**: MULHITSIMROB-008 (state machine may interact with view)
- **Blocked by**: MULHITSIMROB-004, MULHITSIMROB-005, MULHITSIMROB-006 (simpler refactors first)
- **Related**: Tests in MULHITSIMROB-001, MULHITSIMROB-002 should continue passing

## Estimated Effort

Medium - significant refactoring with careful testing to ensure no regressions.

## Migration Notes

1. **Incremental approach**: Extract one method at a time
2. **Test after each extraction**: Run full test suite after each method move
3. **Preserve behavior**: No functional changes during extraction
4. **Update mocks gradually**: Reduce DOM mock complexity as view is extracted

## Reference Files

- Source: `src/domUI/damage-simulator/MultiHitSimulator.js`
- Test: `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` (DOM mock helpers lines 16-21, 1091-1217, 1333-1428, 1572-1615)
- Pattern: Consider existing view patterns in `src/domUI/` if any
