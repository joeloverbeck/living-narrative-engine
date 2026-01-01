/**
 * @file MultiHitSimulator.js
 * @description Multi-hit damage simulation component with configurable hit counts,
 * delays, and targeting modes. Enables testing damage accumulation over multiple hits.
 * @see DamageExecutionService.js - Handles actual damage application
 * @see DamageHistoryTracker.js - Records damage history via events
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./DamageExecutionService.js').default} DamageExecutionService */

/**
 * Event types emitted by the simulator
 * @readonly
 */
const SIMULATION_EVENTS = Object.freeze({
  PROGRESS: 'damage-simulator:simulation-progress',
  COMPLETE: 'damage-simulator:simulation-complete',
  STOPPED: 'damage-simulator:simulation-stopped',
  ERROR: 'damage-simulator:simulation-error',
});

/**
 * Default simulation configuration
 * @readonly
 */
const DEFAULTS = Object.freeze({
  HIT_COUNT: 10,
  DELAY_MS: 100,
  TARGET_MODE: 'random',
  MIN_HITS: 1,
  MAX_HITS: 100,
  MIN_DELAY: 0,
  MAX_DELAY: 1000,
});

/**
 * Valid target modes
 * @readonly
 */
const TARGET_MODES = Object.freeze(['random', 'round-robin', 'focus']);

/**
 * @typedef {Object} SimulationConfig
 * @property {number} hitCount - Number of hits (1-100)
 * @property {number} delayMs - Delay between hits in milliseconds
 * @property {string} targetMode - 'random' | 'round-robin' | 'focus'
 * @property {string|null} focusPartId - Part ID for focus mode
 * @property {Object} damageEntry - Damage configuration to apply
 * @property {number} multiplier - Damage multiplier
 * @property {string} entityId - Target entity ID
 */

/**
 * @typedef {Object} SimulationResult
 * @property {boolean} completed - Whether simulation ran to completion
 * @property {number} hitsExecuted - Number of hits performed
 * @property {number} totalDamage - Total damage dealt
 * @property {Object<string, number>} partHitCounts - Hits per part
 * @property {Array<string>} effectsTriggered - Status effects triggered
 * @property {number} durationMs - Duration in milliseconds
 * @property {string|null} stoppedReason - Reason if stopped early
 */

/**
 * @typedef {Object} SimulationProgress
 * @property {number} currentHit - Current hit number
 * @property {number} totalHits - Total hits planned
 * @property {number} percentComplete - Percentage complete (0-100)
 * @property {string} status - 'idle' | 'running' | 'stopping' | 'completed'
 */

/**
 * Helper class for target selection across different modes
 */
class TargetSelector {
  /** @type {Array<{id: string, name: string, weight: number}>} */
  #parts;

  /** @type {string} */
  #mode;

  /** @type {string|null} */
  #focusPartId;

  /** @type {number} */
  #currentIndex;

  /**
   * @param {Array<{id: string, name: string, weight: number}>} parts - Available target parts
   * @param {string} mode - Targeting mode
   * @param {string|null} focusPartId - Focus target part ID
   */
  constructor(parts, mode, focusPartId) {
    this.#parts = parts;
    this.#mode = mode;
    this.#focusPartId = focusPartId;
    this.#currentIndex = 0;
  }

  /**
   * Get the next target part ID based on the targeting mode
   * @returns {string|null} Part ID or null for weighted random
   */
  getNextTarget() {
    if (this.#parts.length === 0) {
      return null;
    }

    switch (this.#mode) {
      case 'random':
        return this.#parts[Math.floor(Math.random() * this.#parts.length)].id;

      case 'round-robin': {
        const part = this.#parts[this.#currentIndex];
        this.#currentIndex = (this.#currentIndex + 1) % this.#parts.length;
        return part.id;
      }

      case 'focus':
        return this.#focusPartId;

      default:
        return null; // Use weighted random from execution service
    }
  }

  /**
   * Reset the selector state (e.g., round-robin index)
   */
  reset() {
    this.#currentIndex = 0;
  }
}

/**
 * Multi-hit damage simulator component
 */
class MultiHitSimulator {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {DamageExecutionService} */
  #executionService;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {SimulationConfig|null} */
  #config;

  /** @type {boolean} */
  #isRunning;

  /** @type {boolean} */
  #shouldStop;

  /** @type {number|null} */
  #delayTimeout;

  /** @type {Function|null} */
  #delayResolve;

  /** @type {TargetSelector|null} */
  #targetSelector;

  /** @type {SimulationProgress} */
  #progress;

  /** @type {Array<{id: string, name: string, weight: number}>} */
  #targetableParts;

  /**
   * Expose constants for testing and external use
   */
  static SIMULATION_EVENTS = SIMULATION_EVENTS;
  static DEFAULTS = DEFAULTS;
  static TARGET_MODES = TARGET_MODES;

  /**
   * @param {Object} dependencies
   * @param {HTMLElement} dependencies.containerElement - DOM container for rendering
   * @param {DamageExecutionService} dependencies.damageExecutionService - Damage execution service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ containerElement, damageExecutionService, eventBus, logger }) {
    validateDependency(containerElement, 'HTMLElement', console, {
      requiredMethods: ['appendChild', 'querySelector'],
    });
    validateDependency(damageExecutionService, 'DamageExecutionService', console, {
      requiredMethods: ['applyDamage', 'getTargetableParts'],
    });
    validateDependency(eventBus, 'IEventBus', console, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#containerElement = containerElement;
    this.#executionService = damageExecutionService;
    this.#eventBus = eventBus;
    this.#logger = logger;

    this.#config = null;
    this.#isRunning = false;
    this.#shouldStop = false;
    this.#delayTimeout = null;
    this.#delayResolve = null;
    this.#targetSelector = null;
    this.#targetableParts = [];
    this.#progress = {
      currentHit: 0,
      totalHits: 0,
      percentComplete: 0,
      status: 'idle',
    };
  }

  /**
   * Configure simulation parameters
   * @param {SimulationConfig} config - Simulation configuration
   * @throws {Error} If configuration is invalid
   */
  configure(config) {
    this.#logger.debug('[MultiHitSimulator] Configuring simulation', config);

    // Validate hit count
    if (
      typeof config.hitCount !== 'number' ||
      config.hitCount < DEFAULTS.MIN_HITS ||
      config.hitCount > DEFAULTS.MAX_HITS
    ) {
      throw new Error(
        `Hit count must be between ${DEFAULTS.MIN_HITS} and ${DEFAULTS.MAX_HITS}`
      );
    }

    // Validate delay
    if (
      typeof config.delayMs !== 'number' ||
      config.delayMs < DEFAULTS.MIN_DELAY ||
      config.delayMs > DEFAULTS.MAX_DELAY
    ) {
      throw new Error(
        `Delay must be between ${DEFAULTS.MIN_DELAY} and ${DEFAULTS.MAX_DELAY}ms`
      );
    }

    // Validate target mode
    if (!TARGET_MODES.includes(config.targetMode)) {
      throw new Error(`Target mode must be one of: ${TARGET_MODES.join(', ')}`);
    }

    // Validate focus mode requirements
    if (config.targetMode === 'focus' && !config.focusPartId) {
      throw new Error('Focus mode requires a focusPartId');
    }

    // Validate entity ID
    if (!config.entityId) {
      throw new Error('Entity ID is required');
    }

    // Validate damage entry
    if (!config.damageEntry) {
      throw new Error('Damage entry is required');
    }

    this.#config = {
      hitCount: config.hitCount,
      delayMs: config.delayMs,
      targetMode: config.targetMode,
      focusPartId: config.focusPartId || null,
      damageEntry: config.damageEntry,
      multiplier: config.multiplier ?? 1,
      entityId: config.entityId,
    };

    // Get targetable parts for the entity
    this.#targetableParts = this.#executionService.getTargetableParts(
      this.#config.entityId
    );

    // Create target selector
    this.#targetSelector = new TargetSelector(
      this.#targetableParts,
      this.#config.targetMode,
      this.#config.focusPartId
    );

    this.#logger.info('[MultiHitSimulator] Configuration set', {
      hitCount: this.#config.hitCount,
      delayMs: this.#config.delayMs,
      targetMode: this.#config.targetMode,
      partsAvailable: this.#targetableParts.length,
    });
  }

  /**
   * Start the simulation
   * @returns {Promise<SimulationResult>} Simulation results
   * @throws {Error} If already running or not configured
   */
  async run() {
    if (this.#isRunning) {
      throw new Error('Simulation already running');
    }

    if (!this.#config) {
      throw new Error('Simulation not configured');
    }

    this.#logger.info('[MultiHitSimulator] Starting simulation', {
      hitCount: this.#config.hitCount,
      targetMode: this.#config.targetMode,
    });

    this.#isRunning = true;
    this.#shouldStop = false;
    this.#progress = {
      currentHit: 0,
      totalHits: this.#config.hitCount,
      percentComplete: 0,
      status: 'running',
    };

    // Reset target selector for round-robin consistency
    if (this.#targetSelector) {
      this.#targetSelector.reset();
    }

    /** @type {SimulationResult} */
    const results = {
      completed: false,
      hitsExecuted: 0,
      totalDamage: 0,
      partHitCounts: {},
      effectsTriggered: [],
      durationMs: 0,
      stoppedReason: null,
    };

    const startTime = Date.now();

    try {
      for (let i = 0; i < this.#config.hitCount; i++) {
        if (this.#shouldStop) {
          results.stoppedReason = 'user_stopped';
          this.#progress.status = 'stopping';
          this.#logger.info('[MultiHitSimulator] Simulation stopped by user', {
            hitsExecuted: results.hitsExecuted,
          });
          break;
        }

        // Get next target
        const targetPartId = this.#targetSelector
          ? this.#targetSelector.getNextTarget()
          : null;

        // Execute damage
        const damageResult = await this.#executionService.applyDamage({
          entityId: this.#config.entityId,
          damageEntry: this.#config.damageEntry,
          multiplier: this.#config.multiplier,
          targetPartId,
        });

        // Track results
        results.hitsExecuted++;

        if (damageResult.success && damageResult.results.length > 0) {
          const firstResult = damageResult.results[0];
          results.totalDamage += firstResult.damageDealt || 0;

          const hitPartId = firstResult.targetPartId || targetPartId || 'unknown';
          results.partHitCounts[hitPartId] =
            (results.partHitCounts[hitPartId] || 0) + 1;

          // Track severity as a triggered effect
          if (
            firstResult.severity &&
            !results.effectsTriggered.includes(firstResult.severity)
          ) {
            results.effectsTriggered.push(firstResult.severity);
          }
        }

        // Update progress
        this.#progress = {
          currentHit: i + 1,
          totalHits: this.#config.hitCount,
          percentComplete: ((i + 1) / this.#config.hitCount) * 100,
          status: 'running',
        };

        // Emit progress event
        this.#eventBus.dispatch(SIMULATION_EVENTS.PROGRESS, {
          ...this.#progress,
        });

        // Update UI progress
        this.#updateProgressDisplay();

        // Apply delay between hits (except after last hit)
        if (this.#config.delayMs > 0 && i < this.#config.hitCount - 1) {
          await this.#delay(this.#config.delayMs);
        }
      }

      results.completed = !this.#shouldStop;
      results.durationMs = Date.now() - startTime;

      this.#progress.status = 'completed';

      this.#logger.info('[MultiHitSimulator] Simulation complete', {
        completed: results.completed,
        hitsExecuted: results.hitsExecuted,
        totalDamage: results.totalDamage,
        durationMs: results.durationMs,
      });

      // Emit completion or stopped event
      if (results.completed) {
        this.#eventBus.dispatch(SIMULATION_EVENTS.COMPLETE, results);
      } else {
        this.#eventBus.dispatch(SIMULATION_EVENTS.STOPPED, results);
      }

      // Update results display
      this.#updateResultsDisplay(results);

      return results;
    } catch (error) {
      this.#logger.error('[MultiHitSimulator] Simulation error:', error);

      results.stoppedReason = `error: ${error.message}`;
      results.durationMs = Date.now() - startTime;

      this.#eventBus.dispatch(SIMULATION_EVENTS.ERROR, {
        error: error.message,
        results,
      });

      throw error;
    } finally {
      this.#isRunning = false;
      this.#updateControlsState();
    }
  }

  /**
   * Stop the current simulation
   */
  stop() {
    this.#logger.debug('[MultiHitSimulator] Stop requested');
    this.#shouldStop = true;

    if (this.#delayTimeout) {
      clearTimeout(this.#delayTimeout);
      this.#delayTimeout = null;
    }

    // Resolve any pending delay to unblock the simulation loop
    if (this.#delayResolve) {
      this.#delayResolve();
      this.#delayResolve = null;
    }
  }

  /**
   * Check if simulation is running
   * @returns {boolean} True if running
   */
  isRunning() {
    return this.#isRunning;
  }

  /**
   * Get current simulation progress
   * @returns {SimulationProgress} Current progress
   */
  getProgress() {
    return { ...this.#progress };
  }

  /**
   * Get targetable parts for the current entity
   * @returns {Array<{id: string, name: string, weight: number}>} Targetable parts
   */
  getTargetableParts() {
    return [...this.#targetableParts];
  }

  /**
   * Render the simulator controls
   */
  render() {
    this.#logger.debug('[MultiHitSimulator] Rendering controls');

    this.#containerElement.innerHTML = `
      <div class="ds-multi-hit-simulator">
        <h4>Multi-Hit Simulation</h4>

        <!-- Configuration -->
        <div class="ds-sim-config">
          <div class="ds-form-group">
            <label for="ds-hit-count">Number of Hits</label>
            <input type="number" id="ds-hit-count"
                   min="${DEFAULTS.MIN_HITS}"
                   max="${DEFAULTS.MAX_HITS}"
                   value="${DEFAULTS.HIT_COUNT}">
          </div>

          <div class="ds-form-group">
            <label for="ds-hit-delay">Delay Between Hits</label>
            <input type="range" id="ds-hit-delay-slider"
                   min="${DEFAULTS.MIN_DELAY}"
                   max="${DEFAULTS.MAX_DELAY}"
                   value="${DEFAULTS.DELAY_MS}">
            <span id="ds-hit-delay-value">${DEFAULTS.DELAY_MS}ms</span>
          </div>

          <fieldset class="ds-target-mode-fieldset">
            <legend>Target Mode</legend>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="random" checked>
              Random (weighted)
            </label>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="round-robin">
              Round-Robin
            </label>
            <label>
              <input type="radio" name="ds-sim-target-mode" value="focus">
              Focus Part:
              <select id="ds-sim-focus-part" disabled>
                <option value="">Select...</option>
              </select>
            </label>
          </fieldset>
        </div>

        <!-- Controls -->
        <div class="ds-sim-controls">
          <button id="ds-sim-run-btn" class="ds-button ds-button--primary">&#9658; Run Simulation</button>
          <button id="ds-sim-stop-btn" class="ds-button ds-button--danger" disabled>&#9632; Stop</button>
        </div>

        <!-- Progress -->
        <div class="ds-sim-progress" hidden>
          <div class="ds-progress-bar">
            <div class="ds-progress-fill" style="width: 0%"></div>
          </div>
          <span class="ds-progress-text">0 / ${DEFAULTS.HIT_COUNT} hits</span>
        </div>

        <!-- Results -->
        <div class="ds-sim-results" hidden>
          <h5>Simulation Results</h5>
          <div class="ds-results-grid">
            <div class="ds-result-item">
              <span class="ds-result-label">Hits Executed</span>
              <span class="ds-result-value" id="ds-result-hits">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Total Damage</span>
              <span class="ds-result-value" id="ds-result-damage">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Duration</span>
              <span class="ds-result-value" id="ds-result-duration">--</span>
            </div>
            <div class="ds-result-item">
              <span class="ds-result-label">Avg Damage/Hit</span>
              <span class="ds-result-value" id="ds-result-avg">--</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.#bindEventListeners();
  }

  /**
   * Bind event listeners to rendered elements
   * @private
   */
  #bindEventListeners() {
    const container = this.#containerElement;

    // Delay slider value display
    const delaySlider = container.querySelector('#ds-hit-delay-slider');
    const delayValue = container.querySelector('#ds-hit-delay-value');
    if (delaySlider && delayValue) {
      delaySlider.addEventListener('input', (e) => {
        delayValue.textContent = `${e.target.value}ms`;
      });
    }

    // Target mode radio buttons
    const targetModeRadios = container.querySelectorAll(
      'input[name="ds-sim-target-mode"]'
    );
    const focusPartSelect = container.querySelector('#ds-sim-focus-part');

    targetModeRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        if (focusPartSelect) {
          focusPartSelect.disabled = e.target.value !== 'focus';
        }
      });
    });

    // Run button
    const runBtn = container.querySelector('#ds-sim-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.#handleRunClick());
    }

    // Stop button
    const stopBtn = container.querySelector('#ds-sim-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stop());
    }
  }

  /**
   * Handle run button click
   * @private
   */
  async #handleRunClick() {
    const container = this.#containerElement;

    // Get configuration from UI
    const hitCountInput = container.querySelector('#ds-hit-count');
    const delaySlider = container.querySelector('#ds-hit-delay-slider');
    const targetModeRadio = container.querySelector(
      'input[name="ds-sim-target-mode"]:checked'
    );
    const focusPartSelect = container.querySelector('#ds-sim-focus-part');

    if (!hitCountInput || !delaySlider || !targetModeRadio) {
      this.#logger.error('[MultiHitSimulator] Missing UI elements');
      return;
    }

    // Validate we have an entity configured
    if (!this.#config?.entityId && !this.#targetableParts.length) {
      this.#logger.warn('[MultiHitSimulator] No entity configured');
      return;
    }

    try {
      // Configure simulation
      this.configure({
        hitCount: parseInt(hitCountInput.value, 10),
        delayMs: parseInt(delaySlider.value, 10),
        targetMode: targetModeRadio.value,
        focusPartId: focusPartSelect?.value || null,
        damageEntry: this.#config?.damageEntry || { base_damage: 10 },
        multiplier: this.#config?.multiplier || 1,
        entityId: this.#config?.entityId || '',
      });

      // Show progress, hide results
      const progressEl = container.querySelector('.ds-sim-progress');
      const resultsEl = container.querySelector('.ds-sim-results');
      if (progressEl) progressEl.hidden = false;
      if (resultsEl) resultsEl.hidden = true;

      // Update controls state
      this.#updateControlsState();

      // Run simulation
      await this.run();
    } catch (error) {
      this.#logger.error('[MultiHitSimulator] Run failed:', error);
    }
  }

  /**
   * Update the progress display
   * @private
   */
  #updateProgressDisplay() {
    const container = this.#containerElement;
    const progressFill = container.querySelector('.ds-progress-fill');
    const progressText = container.querySelector('.ds-progress-text');

    if (progressFill) {
      progressFill.style.width = `${this.#progress.percentComplete}%`;
    }

    if (progressText) {
      progressText.textContent = `${this.#progress.currentHit} / ${this.#progress.totalHits} hits`;
    }
  }

  /**
   * Update the results display
   * @private
   * @param {SimulationResult} results - Simulation results
   */
  #updateResultsDisplay(results) {
    const container = this.#containerElement;
    const resultsEl = container.querySelector('.ds-sim-results');

    if (resultsEl) {
      resultsEl.hidden = false;

      const hitsEl = container.querySelector('#ds-result-hits');
      const damageEl = container.querySelector('#ds-result-damage');
      const durationEl = container.querySelector('#ds-result-duration');
      const avgEl = container.querySelector('#ds-result-avg');

      if (hitsEl) hitsEl.textContent = results.hitsExecuted.toString();
      if (damageEl) damageEl.textContent = results.totalDamage.toFixed(1);
      if (durationEl) durationEl.textContent = `${results.durationMs}ms`;
      if (avgEl) {
        const avg =
          results.hitsExecuted > 0
            ? results.totalDamage / results.hitsExecuted
            : 0;
        avgEl.textContent = avg.toFixed(2);
      }
    }
  }

  /**
   * Update controls enabled/disabled state based on running status
   * @private
   */
  #updateControlsState() {
    const container = this.#containerElement;
    const runBtn = container.querySelector('#ds-sim-run-btn');
    const stopBtn = container.querySelector('#ds-sim-stop-btn');

    if (runBtn) {
      runBtn.disabled = this.#isRunning;
    }

    if (stopBtn) {
      stopBtn.disabled = !this.#isRunning;
    }
  }

  /**
   * Create a cancellable delay
   * @private
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise((resolve) => {
      this.#delayResolve = resolve;
      this.#delayTimeout = setTimeout(() => {
        this.#delayTimeout = null;
        this.#delayResolve = null;
        resolve();
      }, ms);
    });
  }

  /**
   * Set entity and damage configuration from external source
   * @param {Object} options
   * @param {string} options.entityId - Entity ID to target
   * @param {Object} options.damageEntry - Damage entry configuration
   * @param {number} [options.multiplier=1] - Damage multiplier
   */
  setEntityConfig({ entityId, damageEntry, multiplier = 1 }) {
    this.#logger.debug('[MultiHitSimulator] Setting entity config', {
      entityId,
      damageEntry,
      multiplier,
    });

    // Initialize partial config
    this.#config = {
      hitCount: DEFAULTS.HIT_COUNT,
      delayMs: DEFAULTS.DELAY_MS,
      targetMode: DEFAULTS.TARGET_MODE,
      focusPartId: null,
      damageEntry,
      multiplier,
      entityId,
    };

    // Get targetable parts
    this.#targetableParts = this.#executionService.getTargetableParts(entityId);

    // Update focus part dropdown
    this.#updateFocusPartOptions();
  }

  /**
   * Update the focus part dropdown with available parts
   * @private
   */
  #updateFocusPartOptions() {
    const focusPartSelect = this.#containerElement.querySelector(
      '#ds-sim-focus-part'
    );

    if (!focusPartSelect) return;

    // Clear existing options
    focusPartSelect.innerHTML = '<option value="">Select...</option>';

    // Add options for each targetable part
    for (const part of this.#targetableParts) {
      const option = document.createElement('option');
      option.value = part.id;
      option.textContent = part.name;
      focusPartSelect.appendChild(option);
    }
  }
}

export default MultiHitSimulator;
