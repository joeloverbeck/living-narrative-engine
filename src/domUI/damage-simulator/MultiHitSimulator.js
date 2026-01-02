/**
 * @file MultiHitSimulator.js
 * @description Multi-hit damage simulation component with configurable hit counts,
 * delays, and targeting modes. Enables testing damage accumulation over multiple hits.
 * @see DamageExecutionService.js - Handles actual damage application
 * @see DamageHistoryTracker.js - Records damage history via events
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import TargetSelector from './TargetSelector.js';
import MultiHitSimulatorView from './MultiHitSimulatorView.js';
import {
  SimulationStateMachine,
  SimulationState,
} from './SimulationStateMachine.js';

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

  /** @type {SimulationStateMachine} */
  #stateMachine;

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

  /** @type {MultiHitSimulatorView} */
  #view;

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

    this.#stateMachine = new SimulationStateMachine((prev, next) => {
      this.#logger.debug(
        `[MultiHitSimulator] State transition: ${prev} -> ${next}`
      );
    });
    this.#config = null;
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
    this.#view = new MultiHitSimulatorView(containerElement, logger);
  }

  /**
   * Configure simulation parameters
   * @param {SimulationConfig} config - Simulation configuration
   * @throws {Error} If configuration is invalid
   */
  configure(config) {
    this.#logger.debug('[MultiHitSimulator] Configuring simulation', config);

    if (this.#stateMachine.isActive) {
      throw new Error('Cannot configure while simulation is active');
    }

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

    if (!this.#stateMachine.isConfigured) {
      this.#stateMachine.transition(SimulationState.CONFIGURED);
    }
  }

  /**
   * Start the simulation
   * @returns {Promise<SimulationResult>} Simulation results
   * @throws {Error} If already running or not configured
   */
  async run() {
    if (this.#stateMachine.isActive) {
      throw new Error('Simulation already running');
    }

    if (!this.#config) {
      throw new Error('Simulation not configured');
    }

    if (!this.#stateMachine.canTransition(SimulationState.RUNNING)) {
      throw new Error('Simulation not configured');
    }

    this.#logger.info('[MultiHitSimulator] Starting simulation', {
      hitCount: this.#config.hitCount,
      targetMode: this.#config.targetMode,
    });

    this.#stateMachine.transition(SimulationState.RUNNING);
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
    let wasStopped = false;

    try {
      for (let i = 0; i < this.#config.hitCount; i++) {
        if (this.#stateMachine.isStopping) {
          wasStopped = true;
          results.stoppedReason = 'user_stopped';
          this.#progress.status = 'stopping';
          this.#logger.info('[MultiHitSimulator] Simulation stopped by user', {
            hitsExecuted: results.hitsExecuted,
          });
          break;
        }

        this.#assertInvariant(
          this.#stateMachine.isRunning === true,
          'state must be RUNNING during simulation loop'
        );

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

          const hitPartId = this.#resolvePartId(firstResult, targetPartId);
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

      results.completed = !wasStopped;
      results.durationMs = Date.now() - startTime;

      this.#progress.status = 'completed';
      if (this.#stateMachine.canTransition(SimulationState.COMPLETED)) {
        this.#stateMachine.transition(SimulationState.COMPLETED);
      }

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

      if (this.#stateMachine.canTransition(SimulationState.ERROR)) {
        this.#stateMachine.transition(SimulationState.ERROR);
      }

      results.stoppedReason = `error: ${error.message}`;
      results.durationMs = Date.now() - startTime;

      this.#eventBus.dispatch(SIMULATION_EVENTS.ERROR, {
        error: error.message,
        results,
      });

      throw error;
    } finally {
      this.#updateControlsState();
    }
  }

  /**
   * Stop the current simulation
   */
  stop() {
    this.#logger.debug('[MultiHitSimulator] Stop requested');
    if (this.#stateMachine.canTransition(SimulationState.STOPPING)) {
      this.#stateMachine.transition(SimulationState.STOPPING);
    }

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
    return this.#stateMachine.isActive;
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
   * Resolves the part ID from damage result or selector target.
   * Fallback order: result.targetPartId > selectorTarget > 'unknown'
   * @param {Object} result - Damage result object
   * @param {string|null} selectorTarget - Target from TargetSelector
   * @returns {string} Resolved part ID
   */
  #resolvePartId(result, selectorTarget) {
    if (result?.targetPartId) return result.targetPartId;
    if (selectorTarget) return selectorTarget;
    return 'unknown';
  }

  /**
   * Render the simulator controls
   */
  render() {
    this.#logger.debug('[MultiHitSimulator] Rendering controls');
    this.#view.render(DEFAULTS);
    this.#view.bindEventListeners({
      onRun: (config) => this.#handleRunRequest(config),
      onStop: () => this.stop(),
    });
  }

  /**
   * Handle run request from the view
   * @private
   */
  async #handleRunRequest(config) {
    // Validate we have an entity configured
    if (!this.#config?.entityId && !this.#targetableParts.length) {
      this.#logger.warn('[MultiHitSimulator] No entity configured');
      return;
    }

    try {
      // Configure simulation
      this.configure({
        hitCount: config.hitCount,
        delayMs: config.delayMs,
        targetMode: config.targetMode,
        focusPartId: config.focusPartId || null,
        damageEntry: this.#config?.damageEntry || { base_damage: 10 },
        multiplier: this.#config?.multiplier || 1,
        entityId: this.#config?.entityId || '',
      });

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
    this.#view.updateProgress(this.#progress);
  }

  /**
   * Update the results display
   * @private
   * @param {SimulationResult} results - Simulation results
   */
  #updateResultsDisplay(results) {
    this.#assertInvariant(
      results.hitsExecuted >= 1,
      `hitsExecuted must be >= 1, got ${results.hitsExecuted}`
    );
    this.#view.updateResults(results);
  }

  /**
   * Update controls enabled/disabled state based on running status
   * @private
   */
  #updateControlsState() {
    this.#view.updateControlsState(this.#stateMachine.isActive);
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
        this.#assertInvariant(
          this.#delayTimeout === null && this.#delayResolve === null,
          'delayTimeout and delayResolve must both be null after cleanup'
        );
        resolve();
      }, ms);
    });
  }

  /**
   * Assert invariants in non-production environments.
   * @private
   * @param {boolean} condition - Condition that must hold
   * @param {string} message - Invariant description
   */
  #assertInvariant(condition, message) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    console.assert(condition, `Invariant violation: ${message}`);
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

    if (this.#stateMachine.isActive) {
      throw new Error('Cannot configure while simulation is active');
    }

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

    if (!this.#stateMachine.isConfigured) {
      this.#stateMachine.transition(SimulationState.CONFIGURED);
    }
  }

  /**
   * Update the focus part dropdown with available parts
   * @private
   */
  #updateFocusPartOptions() {
    this.#view.updateFocusPartOptions(this.#targetableParts);
  }
}

export default MultiHitSimulator;
