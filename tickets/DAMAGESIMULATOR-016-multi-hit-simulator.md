# DAMAGESIMULATOR-016: Create MultiHitSimulator

## Summary
Create the `MultiHitSimulator` component that enables batch damage application with configurable hit counts, delays, and targeting modes. This allows testing damage accumulation over multiple hits with run/stop controls.

## Dependencies
- DAMAGESIMULATOR-011 must be completed (DamageExecutionService for damage application)
- DAMAGESIMULATOR-012 must be completed (DamageHistoryTracker for recording)
- DAMAGESIMULATOR-007 must be completed (HierarchicalAnatomyRenderer for refresh)

## Files to Touch

### Create
- `src/domUI/damage-simulator/MultiHitSimulator.js` - Multi-hit simulator
- `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate simulator controls
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register simulator
- `css/damage-simulator.css` - Add simulator control styles

## Out of Scope
- DO NOT implement simulation presets/profiles
- DO NOT implement simulation export/replay
- DO NOT modify DamageExecutionService
- DO NOT implement damage prediction without execution
- DO NOT implement undo/rollback of simulated damage

## Acceptance Criteria

### Simulation Requirements
1. Configure number of hits (range: 1-100)
2. Configure delay between hits (0-1000ms)
3. Support target modes: Random, Round-Robin, Focus Single Part
4. Run/Stop controls with immediate stop capability
5. Progress indicator showing current hit number
6. Summary statistics after completion

### UI Requirements
1. Hit count input with validation
2. Delay slider with numeric display
3. Target mode radio buttons
4. Part selector for Focus mode
5. Run/Stop button with state indication
6. Progress bar during simulation
7. Results summary panel

### Tests That Must Pass
1. **Unit: MultiHitSimulator.test.js**
   - `should validate hit count range`
   - `should execute configured number of hits`
   - `should respect delay between hits`
   - `should support random targeting mode`
   - `should support round-robin targeting mode`
   - `should support focus single part mode`
   - `should stop immediately when requested`
   - `should track progress correctly`
   - `should emit progress events`
   - `should generate summary statistics`
   - `should handle errors during simulation`
   - `should prevent concurrent simulations`
   - `should reset state between simulations`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Only one simulation can run at a time
2. Stop is always responsive (no blocked states)
3. All hits recorded in history
4. Anatomy display refreshes after each hit
5. Statistics reflect actual execution

## Implementation Notes

### MultiHitSimulator Interface
```javascript
class MultiHitSimulator {
  constructor({
    containerElement,
    damageExecutionService,
    damageHistoryTracker,
    eventBus,
    logger
  })

  /**
   * Configure simulation parameters
   * @param {SimulationConfig} config
   */
  configure(config)

  /**
   * Start the simulation
   * @returns {Promise<SimulationResult>}
   */
  async run()

  /**
   * Stop the current simulation
   */
  stop()

  /**
   * Check if simulation is running
   * @returns {boolean}
   */
  isRunning()

  /**
   * Get current progress
   * @returns {SimulationProgress}
   */
  getProgress()

  /**
   * Render the simulator controls
   */
  render()
}
```

### SimulationConfig Structure
```javascript
/**
 * @typedef {Object} SimulationConfig
 * @property {number} hitCount - Number of hits (1-100)
 * @property {number} delayMs - Delay between hits in milliseconds
 * @property {string} targetMode - 'random' | 'round-robin' | 'focus'
 * @property {string|null} focusPartId - Part ID for focus mode
 * @property {Object} damageEntry - Damage configuration to apply
 * @property {number} multiplier - Damage multiplier
 */
```

### SimulationResult Structure
```javascript
/**
 * @typedef {Object} SimulationResult
 * @property {boolean} completed - Whether simulation ran to completion
 * @property {number} hitsExecuted
 * @property {number} totalDamage
 * @property {Object} partHitCounts - Hits per part
 * @property {Array<string>} effectsTriggered
 * @property {number} durationMs
 * @property {string|null} stoppedReason
 */
```

### SimulationProgress Structure
```javascript
/**
 * @typedef {Object} SimulationProgress
 * @property {number} currentHit
 * @property {number} totalHits
 * @property {number} percentComplete
 * @property {string} status - 'idle' | 'running' | 'stopping' | 'completed'
 */
```

### Target Mode Implementation
```javascript
class TargetSelector {
  constructor(parts, mode, focusPartId) {
    this.parts = parts;
    this.mode = mode;
    this.focusPartId = focusPartId;
    this.currentIndex = 0;
  }

  getNextTarget() {
    switch (this.mode) {
      case 'random':
        return this.parts[Math.floor(Math.random() * this.parts.length)].id;

      case 'round-robin':
        const part = this.parts[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.parts.length;
        return part.id;

      case 'focus':
        return this.focusPartId;

      default:
        return null; // Use weighted random from execution service
    }
  }
}
```

### Simulation Loop
```javascript
async run() {
  if (this.#isRunning) {
    throw new Error('Simulation already running');
  }

  this.#isRunning = true;
  this.#shouldStop = false;
  const results = { hitsExecuted: 0, totalDamage: 0, partHitCounts: {} };
  const startTime = Date.now();

  try {
    for (let i = 0; i < this.#config.hitCount; i++) {
      if (this.#shouldStop) {
        results.stoppedReason = 'user_stopped';
        break;
      }

      // Get next target
      const targetPartId = this.#targetSelector.getNextTarget();

      // Execute damage
      const result = await this.#executionService.applyDamage({
        entityId: this.#entityId,
        damageEntry: this.#config.damageEntry,
        multiplier: this.#config.multiplier,
        targetPartId
      });

      // Track results
      results.hitsExecuted++;
      results.totalDamage += result.results[0]?.damageDealt || 0;
      results.partHitCounts[targetPartId] = (results.partHitCounts[targetPartId] || 0) + 1;

      // Emit progress
      this.#eventBus.dispatch({
        type: 'damage-simulator:simulation-progress',
        payload: {
          currentHit: i + 1,
          totalHits: this.#config.hitCount,
          percentComplete: ((i + 1) / this.#config.hitCount) * 100
        }
      });

      // Apply delay
      if (this.#config.delayMs > 0 && i < this.#config.hitCount - 1) {
        await this.#delay(this.#config.delayMs);
      }
    }

    results.completed = !this.#shouldStop;
    results.durationMs = Date.now() - startTime;

    this.#eventBus.dispatch({
      type: 'damage-simulator:simulation-complete',
      payload: results
    });

    return results;
  } finally {
    this.#isRunning = false;
  }
}

#delay(ms) {
  return new Promise(resolve => {
    this.#delayTimeout = setTimeout(resolve, ms);
  });
}

stop() {
  this.#shouldStop = true;
  if (this.#delayTimeout) {
    clearTimeout(this.#delayTimeout);
  }
}
```

### Simulator Controls HTML
```html
<div class="ds-multi-hit-simulator">
  <h4>Multi-Hit Simulation</h4>

  <!-- Configuration -->
  <div class="ds-sim-config">
    <div class="ds-form-group">
      <label for="hit-count">Number of Hits</label>
      <input type="number" id="hit-count" min="1" max="100" value="10">
    </div>

    <div class="ds-form-group">
      <label for="hit-delay">Delay Between Hits</label>
      <input type="range" id="hit-delay-slider" min="0" max="1000" value="100">
      <span id="hit-delay-value">100ms</span>
    </div>

    <fieldset class="ds-target-mode-fieldset">
      <legend>Target Mode</legend>
      <label>
        <input type="radio" name="sim-target-mode" value="random" checked>
        Random (weighted)
      </label>
      <label>
        <input type="radio" name="sim-target-mode" value="round-robin">
        Round-Robin
      </label>
      <label>
        <input type="radio" name="sim-target-mode" value="focus">
        Focus Part:
        <select id="sim-focus-part" disabled>
          <option value="">Select...</option>
        </select>
      </label>
    </fieldset>
  </div>

  <!-- Controls -->
  <div class="ds-sim-controls">
    <button id="sim-run-btn" class="ds-btn-primary">▶ Run Simulation</button>
    <button id="sim-stop-btn" class="ds-btn-danger" disabled>⏹ Stop</button>
  </div>

  <!-- Progress -->
  <div class="ds-sim-progress" hidden>
    <div class="ds-progress-bar">
      <div class="ds-progress-fill" style="width: 0%"></div>
    </div>
    <span class="ds-progress-text">0 / 10 hits</span>
  </div>

  <!-- Results -->
  <div class="ds-sim-results" hidden>
    <h5>Simulation Results</h5>
    <div class="ds-results-grid">
      <div class="ds-result-item">
        <span class="ds-result-label">Hits Executed</span>
        <span class="ds-result-value" id="result-hits">--</span>
      </div>
      <div class="ds-result-item">
        <span class="ds-result-label">Total Damage</span>
        <span class="ds-result-value" id="result-damage">--</span>
      </div>
      <div class="ds-result-item">
        <span class="ds-result-label">Duration</span>
        <span class="ds-result-value" id="result-duration">--</span>
      </div>
      <div class="ds-result-item">
        <span class="ds-result-label">Avg Damage/Hit</span>
        <span class="ds-result-value" id="result-avg">--</span>
      </div>
    </div>
  </div>
</div>
```

### CSS Additions
```css
.ds-multi-hit-simulator {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 16px;
  margin-top: 16px;
}

.ds-sim-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ds-sim-controls {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.ds-sim-progress {
  margin-top: 16px;
}

.ds-progress-bar {
  height: 20px;
  background: var(--bg-dark);
  border-radius: 4px;
  overflow: hidden;
}

.ds-progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.1s linear;
}

.ds-progress-text {
  display: block;
  text-align: center;
  margin-top: 4px;
  font-size: 12px;
}

.ds-sim-results {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-dark);
  border-radius: 4px;
}

.ds-results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.ds-result-item {
  display: flex;
  flex-direction: column;
}

.ds-result-label {
  font-size: 11px;
  color: var(--text-muted);
}

.ds-result-value {
  font-size: 18px;
  font-weight: bold;
}

.ds-btn-danger {
  background: var(--color-danger);
  color: white;
}

.ds-btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Definition of Done
- [ ] MultiHitSimulator created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Simulator registered in DI container
- [ ] Integrated with DamageSimulatorUI
- [ ] Hit count configuration working
- [ ] Delay configuration working
- [ ] All target modes implemented
- [ ] Run/Stop controls functional
- [ ] Progress display updates correctly
- [ ] Summary statistics generated
- [ ] Immediate stop capability works
- [ ] CSS styles complete
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/MultiHitSimulator.js`
