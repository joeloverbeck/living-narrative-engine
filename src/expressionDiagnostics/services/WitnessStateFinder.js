/**
 * @file WitnessStateFinder - Guided search for satisfying states
 * @description Uses simulated annealing to find mood/sexual states that trigger expressions.
 * Returns either an exact witness or the "nearest miss" for debugging impossible expressions.
 * @see specs/expression-diagnostics.md Layer D
 */

import WitnessState from '../models/WitnessState.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import jsonLogic from 'json-logic-js';

/**
 * Configuration for the search algorithm.
 *
 * @typedef {object} SearchConfig
 * @property {number} maxIterations - Maximum search iterations (default 10000)
 * @property {number} initialTemperature - Starting temperature for annealing (default 1.0)
 * @property {number} coolingRate - Temperature reduction per iteration (default 0.9997)
 * @property {number} restartThreshold - Iterations without improvement before restart (default 1000)
 * @property {boolean} useDynamicsConstraints - Constrain to realistic deltas (default false)
 * @property {(completed: number, total: number) => void} [onProgress] - Progress callback
 */

/** @type {number} Chunk size for yielding to browser */
const CHUNK_SIZE = 100;

/**
 * Result of a witness search.
 *
 * @typedef {object} SearchResult
 * @property {boolean} found - True if exact witness found
 * @property {WitnessState|null} witness - The satisfying state (if found)
 * @property {WitnessState} nearestMiss - Best state found (always present)
 * @property {number} bestFitness - Fitness of best state (1 = perfect)
 * @property {number} iterationsUsed - Number of iterations performed
 * @property {string[]} violatedClauses - Clauses that failed in nearestMiss
 */

/**
 * Guided search service using simulated annealing to find satisfying states
 * (witnesses) for expressions. When a witness cannot be found, returns the
 * "nearest miss" - the state that came closest to satisfying all prerequisites.
 */
class WitnessStateFinder {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /** @type {SearchConfig} */
  #defaultConfig = {
    maxIterations: 10000,
    initialTemperature: 1.0,
    coolingRate: 0.9997,
    restartThreshold: 1000,
    useDynamicsConstraints: false,
  };

  /**
   * Creates a new WitnessStateFinder instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger for debug/error output
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Find a witness state for an expression using simulated annealing.
   * Uses chunked async execution to avoid blocking the main thread.
   *
   * @param {object} expression - Expression to find witness for
   * @param {Partial<SearchConfig>} [config] - Optional configuration overrides
   * @returns {Promise<SearchResult>} Search result with witness or nearest miss
   */
  async findWitness(expression, config = {}) {
    const cfg = { ...this.#defaultConfig, ...config };
    const { onProgress } = cfg;

    this.#logger.debug(
      `WitnessStateFinder: Starting search for ${expression?.id || 'unknown'} (max ${cfg.maxIterations} iterations)`
    );

    let currentState = WitnessState.createRandom();
    let currentFitness = this.#calculateFitness(expression, currentState);

    let bestState = currentState;
    let bestFitness = currentFitness;

    let temperature = cfg.initialTemperature;
    let iterationsWithoutImprovement = 0;

    // Process iterations in chunks to avoid blocking the main thread
    for (let processed = 0; processed < cfg.maxIterations; ) {
      // Check if we found a perfect witness before processing chunk
      if (bestFitness === 1) {
        return this.#createResult(
          true,
          bestState,
          bestFitness,
          processed,
          expression
        );
      }

      const chunkEnd = Math.min(processed + CHUNK_SIZE, cfg.maxIterations);

      // Process one chunk synchronously
      for (let i = processed; i < chunkEnd; i++) {
        // Check if we found a perfect witness
        if (bestFitness === 1) {
          return this.#createResult(
            true,
            bestState,
            bestFitness,
            i,
            expression
          );
        }

        // Generate neighbor state
        const neighbor = this.#generateNeighbor(currentState, temperature, cfg);
        const neighborFitness = this.#calculateFitness(expression, neighbor);

        // Simulated annealing acceptance
        if (this.#shouldAccept(currentFitness, neighborFitness, temperature)) {
          currentState = neighbor;
          currentFitness = neighborFitness;

          if (neighborFitness > bestFitness) {
            bestState = neighbor;
            bestFitness = neighborFitness;
            iterationsWithoutImprovement = 0;
          } else {
            iterationsWithoutImprovement++;
          }
        } else {
          iterationsWithoutImprovement++;
        }

        // Random restart if stuck
        if (iterationsWithoutImprovement >= cfg.restartThreshold) {
          currentState = WitnessState.createRandom();
          currentFitness = this.#calculateFitness(expression, currentState);
          iterationsWithoutImprovement = 0;
          temperature = cfg.initialTemperature * 0.5; // Partial reset
        }

        // Cool down
        temperature *= cfg.coolingRate;
      }

      processed = chunkEnd;

      // Yield to browser and report progress between chunks
      if (processed < cfg.maxIterations && bestFitness < 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        onProgress?.(processed, cfg.maxIterations);
      }
    }

    // Return best found (may be imperfect)
    return this.#createResult(
      bestFitness === 1,
      bestFitness === 1 ? bestState : null,
      bestFitness,
      cfg.maxIterations,
      expression,
      bestState
    );
  }

  /**
   * Calculate fitness (0 = all fail, 1 = all pass).
   *
   * @param {object} expression - Expression to evaluate
   * @param {WitnessState} state - State to test
   * @returns {number} Fitness score in [0, 1]
   * @private
   */
  #calculateFitness(expression, state) {
    if (!expression?.prerequisites || expression.prerequisites.length === 0) {
      return 1; // No prerequisites = always passes
    }

    const context = this.#buildContext(state);
    let passedCount = 0;
    let totalPenalty = 0;

    for (const prereq of expression.prerequisites) {
      const { passed, penalty } = this.#evaluatePrerequisite(prereq, context);
      if (passed) {
        passedCount++;
      } else {
        totalPenalty += penalty;
      }
    }

    const passRatio = passedCount / expression.prerequisites.length;

    // Blend pass ratio with penalty to guide optimization
    // Higher fitness = more clauses passed, lower penalty
    const penaltyFactor = Math.exp(-totalPenalty * 0.1);
    return passRatio * 0.7 + penaltyFactor * 0.3;
  }

  /**
   * Evaluate prerequisite and calculate penalty.
   *
   * @param {object} prereq - Prerequisite to evaluate
   * @param {object} context - Evaluation context
   * @returns {{ passed: boolean, penalty: number }} Evaluation result
   * @private
   */
  #evaluatePrerequisite(prereq, context) {
    try {
      const passed = jsonLogic.apply(prereq.logic, context);

      if (passed) {
        return { passed: true, penalty: 0 };
      }

      // Calculate how far from passing
      const penalty = this.#calculatePenalty(prereq.logic, context);
      return { passed: false, penalty };
    } catch {
      return { passed: false, penalty: 1 };
    }
  }

  /**
   * Calculate penalty for failed prerequisite.
   *
   * @param {object} logic - JSON Logic expression
   * @param {object} context - Evaluation context
   * @returns {number} Penalty value
   * @private
   */
  #calculatePenalty(logic, context) {
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, actual - right);
        }
      }
    }

    // Recurse into and/or
    if (logic.and) {
      return logic.and.reduce(
        (sum, clause) => sum + this.#calculatePenalty(clause, context),
        0
      );
    }

    if (logic.or) {
      // For OR, take minimum penalty (easiest to satisfy)
      const penalties = logic.or.map((clause) =>
        this.#calculatePenalty(clause, context)
      );
      return Math.min(...penalties);
    }

    return 0.5; // Default penalty for unknown logic
  }

  /**
   * Generate neighbor state with perturbation.
   *
   * @param {WitnessState} state - Current state
   * @param {number} temperature - Current temperature
   * @param {SearchConfig} config - Search configuration
   * @returns {WitnessState} New neighbor state
   * @private
   */
  #generateNeighbor(state, temperature, config) {
    const mood = { ...state.mood };
    const sexual = { ...state.sexual };
    const affectTraits = { ...state.affectTraits };

    // Perturbation magnitude based on temperature
    const magnitude = temperature * (config.useDynamicsConstraints ? 10 : 50);

    // Perturb a random subset of mood axes
    for (const axis of WitnessState.MOOD_AXES) {
      if (Math.random() < 0.5) {
        const delta = (Math.random() - 0.5) * 2 * magnitude;
        const rawValue = mood[axis] + delta;
        // Round to integer and clamp to valid range
        mood[axis] = Math.round(
          Math.max(
            WitnessState.MOOD_RANGE.min,
            Math.min(WitnessState.MOOD_RANGE.max, rawValue)
          )
        );
      }
    }

    // Perturb a random subset of sexual axes
    for (const axis of WitnessState.SEXUAL_AXES) {
      if (Math.random() < 0.5) {
        const range = WitnessState.SEXUAL_RANGES[axis];
        const delta = (Math.random() - 0.5) * 2 * magnitude;
        const rawValue = sexual[axis] + delta;
        // Round to integer and clamp to valid range
        sexual[axis] = Math.round(
          Math.max(range.min, Math.min(range.max, rawValue))
        );
      }
    }

    // Perturb a random subset of affect trait axes
    for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
      if (Math.random() < 0.5) {
        const delta = (Math.random() - 0.5) * 2 * magnitude;
        const rawValue = affectTraits[axis] + delta;
        // Round to integer and clamp to valid range [0, 100]
        affectTraits[axis] = Math.round(
          Math.max(
            WitnessState.TRAIT_RANGE.min,
            Math.min(WitnessState.TRAIT_RANGE.max, rawValue)
          )
        );
      }
    }

    return new WitnessState({
      mood,
      sexual,
      affectTraits,
      fitness: 0,
      isExact: false,
    });
  }

  /**
   * Simulated annealing acceptance criterion.
   *
   * @param {number} currentFitness - Current state fitness
   * @param {number} newFitness - Proposed new state fitness
   * @param {number} temperature - Current temperature
   * @returns {boolean} Whether to accept the new state
   * @private
   */
  #shouldAccept(currentFitness, newFitness, temperature) {
    if (newFitness >= currentFitness) {
      return true; // Always accept improvements
    }

    // Probabilistic acceptance for worse solutions
    const delta = newFitness - currentFitness;
    const probability = Math.exp(delta / temperature);
    return Math.random() < probability;
  }

  /**
   * Build evaluation context from witness state.
   *
   * @param {WitnessState} state - Witness state to convert
   * @returns {object} Evaluation context
   * @private
   */
  #buildContext(state) {
    // Convert mood to normalized form [-1, 1] for emotion calculations
    const normalizedMood = {};
    for (const axis of WitnessState.MOOD_AXES) {
      normalizedMood[axis] = state.mood[axis] / 100;
    }

    // Normalize affect traits from [0, 100] to [0, 1]
    const normalizedTraits = {};
    for (const axis of WitnessState.AFFECT_TRAIT_AXES) {
      normalizedTraits[axis] = state.affectTraits[axis] / 100;
    }

    // Calculate emotions from mood with trait support for gates and weights
    const emotions = this.#calculateEmotions(normalizedMood, normalizedTraits);

    // Calculate sexualArousal from raw sexual state (derived value)
    const sexualArousal = this.#calculateSexualArousal(state.sexual);

    // Calculate sexual states, passing the derived sexualArousal for prototype weights
    const sexualStates = this.#calculateSexualStates(state.sexual, sexualArousal);

    return {
      mood: state.mood,
      moodAxes: state.mood, // Alias for expressions that check moodAxes.*
      emotions,
      sexualStates,
      sexualArousal,
      // Include affect traits for trait-based expression prerequisites
      affectTraits: state.affectTraits,
    };
  }

  /**
   * Calculate emotion intensities from mood with trait support.
   *
   * @param {object} normalizedMood - Normalized mood axes [-1, 1]
   * @param {object} [normalizedTraits] - Normalized affect traits [0, 1]
   * @returns {object} Emotion intensities
   * @private
   */
  #calculateEmotions(normalizedMood, normalizedTraits = {}) {
    const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
    if (!lookup?.entries) return {};

    // Combine normalized axes for gate checking and weight calculation
    const allNormalizedAxes = { ...normalizedMood, ...normalizedTraits };

    const emotions = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      // Check gates first - emotion intensity is 0 if any gate fails
      // Gates can now reference trait axes (e.g., "affective_empathy >= 0.25")
      if (!this.#checkGates(prototype.gates, allNormalizedAxes)) {
        emotions[id] = 0;
        continue;
      }

      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          // Check both mood axes and trait axes
          if (allNormalizedAxes[axis] !== undefined) {
            sum += allNormalizedAxes[axis] * weight;
            weightSum += Math.abs(weight);
          }
        }
        emotions[id] =
          weightSum > 0 ? Math.max(0, Math.min(1, sum / weightSum)) : 0;
      }
    }
    return emotions;
  }

  /**
   * Calculate sexual arousal from raw sexual state.
   *
   * @param {object} sexual - Sexual state
   * @returns {number} Sexual arousal [0, 1]
   * @private
   */
  #calculateSexualArousal(sexual) {
    // sexualArousal = clamp01(sex_excitation/100 - sex_inhibition/100 + baseline_libido/100)
    const excitation = sexual.sex_excitation / 100;
    const inhibition = sexual.sex_inhibition / 100;
    const baseline = sexual.baseline_libido / 100;
    return Math.max(0, Math.min(1, excitation - inhibition + baseline));
  }

  /**
   * Calculate sexual state intensities.
   *
   * @param {object} sexual - Sexual state
   * @param {number} sexualArousal - Derived sexual arousal
   * @returns {object} Sexual state intensities
   * @private
   */
  #calculateSexualStates(sexual, sexualArousal) {
    const lookup = this.#dataRegistry.get('lookups', 'core:sexual_prototypes');
    if (!lookup?.entries) return {};

    // Normalize sexual values for prototype calculations
    const normalizedSexual = {
      sex_excitation: sexual.sex_excitation / 100,
      sex_inhibition: sexual.sex_inhibition / 100,
      baseline_libido: sexual.baseline_libido / 100,
      sexual_arousal: sexualArousal,
    };

    const states = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          if (normalizedSexual[axis] !== undefined) {
            sum += normalizedSexual[axis] * weight;
            weightSum += Math.abs(weight);
          }
        }
        states[id] =
          weightSum > 0 ? Math.max(0, Math.min(1, sum / weightSum)) : 0;
      }
    }
    return states;
  }

  /**
   * Get nested value from object.
   *
   * @param {object} obj - Object to search
   * @param {string} path - Dot-separated path
   * @returns {unknown} Value at path
   * @private
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Parse a gate string into its components.
   * Gate format: "axis operator value" (e.g., "affective_empathy >= 0.25")
   *
   * @private
   * @param {string} gate - Gate string to parse
   * @returns {{axis: string, operator: string, value: number} | null} Parsed gate object or null if invalid
   */
  #parseGate(gate) {
    const match = gate.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d+\.?\d*)$/);
    if (!match) return null;
    return { axis: match[1], operator: match[2], value: parseFloat(match[3]) };
  }

  /**
   * Check if all gates pass for a prototype.
   * Gates must ALL pass for the emotion to be calculated; otherwise intensity = 0.
   * This matches EmotionCalculatorService.#checkGates() behavior.
   *
   * @private
   * @param {string[] | undefined} gates - Array of gate strings
   * @param {object} normalizedAxes - Normalized axis values (in [-1, 1] or [0, 1] range)
   * @returns {boolean} - True if all gates pass or no gates defined
   */
  #checkGates(gates, normalizedAxes) {
    if (!gates || !Array.isArray(gates) || gates.length === 0) return true;

    for (const gate of gates) {
      const parsed = this.#parseGate(gate);
      if (!parsed) continue;

      const { axis, operator, value } = parsed;
      const axisValue = normalizedAxes[axis];
      if (axisValue === undefined) continue;

      let passes;
      switch (operator) {
        case '>=':
          passes = axisValue >= value;
          break;
        case '<=':
          passes = axisValue <= value;
          break;
        case '>':
          passes = axisValue > value;
          break;
        case '<':
          passes = axisValue < value;
          break;
        case '==':
          passes = Math.abs(axisValue - value) < 0.0001;
          break;
        default:
          passes = true;
      }
      if (!passes) return false;
    }
    return true;
  }

  /**
   * Create search result object.
   *
   * @param {boolean} found - Whether witness was found
   * @param {WitnessState|null} witness - Witness state if found
   * @param {number} fitness - Best fitness achieved
   * @param {number} iterations - Iterations used
   * @param {object} expression - Expression being analyzed
   * @param {WitnessState|null} [nearestMiss] - Nearest miss state
   * @returns {SearchResult} Search result
   * @private
   */
  #createResult(
    found,
    witness,
    fitness,
    iterations,
    expression,
    nearestMiss = null
  ) {
    const bestState = witness || nearestMiss;
    const violatedClauses = found
      ? []
      : this.#getViolatedClauses(expression, bestState);

    return {
      found,
      witness: found
        ? bestState.withChanges({ isExact: true, fitness: 1 })
        : null,
      nearestMiss: bestState.withChanges({ fitness, isExact: false }),
      bestFitness: fitness,
      iterationsUsed: iterations,
      violatedClauses,
    };
  }

  /**
   * Get list of violated clauses for a state.
   *
   * @param {object} expression - Expression being analyzed
   * @param {WitnessState} state - State to check
   * @returns {string[]} List of violated clause descriptions
   * @private
   */
  #getViolatedClauses(expression, state) {
    if (!expression?.prerequisites) return [];

    const context = this.#buildContext(state);
    const violated = [];

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      if (!prereq?.logic) continue; // Skip prerequisites without logic
      const { passed } = this.#evaluatePrerequisite(prereq, context);
      if (!passed) {
        const logicStr = JSON.stringify(prereq.logic) || 'unknown';
        violated.push(`Clause ${i + 1}: ${logicStr.substring(0, 50)}`);
      }
    }

    return violated;
  }
}

export default WitnessStateFinder;
