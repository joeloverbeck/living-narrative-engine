/**
 * @file ConstructiveWitnessSearcher - Finds nearest-feasible state for zero-trigger expressions
 * @see specs/monte-carlo-actionability-improvements.md
 * @see tickets/MONCARACTIMP-006-constructive-witness-searcher.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').WitnessSearchResult} WitnessSearchResult */
/** @typedef {import('../config/actionabilityConfig.js').BlockingClauseInfo} BlockingClauseInfo */
/** @typedef {import('../config/actionabilityConfig.js').ThresholdAdjustment} ThresholdAdjustment */

/**
 * Performs optimization search to find the nearest-feasible state when an expression
 * has zero triggers. Identifies blocking clauses and minimal threshold adjustments.
 *
 * Algorithm:
 * 1. Seeding: Sample N random states, score each by AND block satisfaction
 * 2. Hill Climbing: From top M seeds, perturb variables to improve score
 * 3. Analysis: Identify blocking clauses and calculate minimal adjustments
 */
class ConstructiveWitnessSearcher {
  #config;
  #logger;
  #stateGenerator;
  #expressionEvaluator;

  /**
   * @param {object} deps
   * @param {object} deps.logger - Logger instance implementing ILogger
   * @param {object} deps.stateGenerator - RandomStateGenerator instance
   * @param {object} deps.expressionEvaluator - ExpressionEvaluator instance
   * @param {object} [deps.config] - Optional config override
   */
  constructor({
    logger,
    stateGenerator,
    expressionEvaluator,
    config = actionabilityConfig.witnessSearch,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(stateGenerator, 'IRandomStateGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(expressionEvaluator, 'IExpressionEvaluator', logger, {
      requiredMethods: ['evaluatePrerequisite'],
    });

    this.#logger = logger;
    this.#stateGenerator = stateGenerator;
    this.#expressionEvaluator = expressionEvaluator;
    this.#config = config;
  }

  /**
   * Search for the nearest state to triggering an expression.
   *
   * @param {object} expression - The expression to analyze (must have prerequisites array)
   * @param {object} [_moodRegimeConstraints] - Optional constraints (not used due to API limitations)
   * @param {object} [options] - Optional overrides
   * @param {number} [options.timeoutMs] - Timeout in milliseconds
   * @param {number} [options.maxSamples] - Maximum samples to evaluate
   * @returns {Promise<WitnessSearchResult>}
   */
  async search(expression, _moodRegimeConstraints = null, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeoutMs ?? this.#config.timeoutMs;
    const maxSamples = options.maxSamples ?? this.#config.maxSamples;

    this.#logger.debug(
      `ConstructiveWitnessSearcher: Starting search with ${maxSamples} samples, ${timeout}ms timeout`
    );

    try {
      // Validate expression has prerequisites
      const prereqs = expression?.prerequisites ?? [];
      if (prereqs.length === 0) {
        this.#logger.debug(
          'ConstructiveWitnessSearcher: No prerequisites found'
        );
        return this.#buildEmptyResult(startTime, 'No prerequisites to analyze');
      }

      // Phase 1: Generate seed candidates
      const seeds = await this.#generateSeeds(
        expression,
        maxSamples,
        startTime,
        timeout
      );

      if (seeds.length === 0) {
        return this.#buildEmptyResult(startTime, 'No valid seeds generated');
      }

      // Check timeout after seeding
      if (Date.now() - startTime > timeout) {
        this.#logger.debug(
          'ConstructiveWitnessSearcher: Timeout after seeding phase'
        );
        return this.#buildTimeoutResult(seeds[0], startTime);
      }

      // Phase 2: Hill climb from best seeds
      const topSeeds = seeds.slice(0, this.#config.hillClimbSeeds);
      const remainingTime = timeout - (Date.now() - startTime);

      const climbedResults = [];
      for (const seed of topSeeds) {
        if (Date.now() - startTime > timeout) break;

        const timeForThisClimb = Math.max(100, remainingTime / topSeeds.length);
        const climbed = await this.#hillClimb(
          seed,
          expression,
          timeForThisClimb
        );
        climbedResults.push(climbed);
      }

      if (climbedResults.length === 0) {
        return this.#buildTimeoutResult(seeds[0], startTime);
      }

      // Phase 3: Select best and analyze
      const best = this.#selectBest(climbedResults);
      const analysis = this.#analyzeBlockers(best, expression);

      const result = {
        found: best.score >= this.#config.minAndBlockScore,
        bestCandidateState: best.state,
        andBlockScore: best.score,
        blockingClauses: analysis.blockingClauses,
        minimalAdjustments: analysis.adjustments,
        searchStats: {
          samplesEvaluated: seeds.length,
          hillClimbIterations:
            this.#config.hillClimbIterations * climbedResults.length,
          timeMs: Date.now() - startTime,
        },
      };

      this.#logger.debug(
        `ConstructiveWitnessSearcher: Search complete. Score=${best.score.toFixed(3)}, ` +
          `blocking=${analysis.blockingClauses.length}, time=${result.searchStats.timeMs}ms`
      );

      return result;
    } catch (err) {
      this.#logger.error('ConstructiveWitnessSearcher: Search failed', err);
      return this.#buildEmptyResult(startTime, err.message);
    }
  }

  /**
   * Generate seed candidates by sampling random states.
   *
   * @param {object} expression - Expression to evaluate
   * @param {number} maxSamples - Maximum samples to generate
   * @param {number} startTime - Start timestamp for timeout tracking
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Array<{state: object, score: number}>>}
   */
  async #generateSeeds(expression, maxSamples, startTime, timeout) {
    const samples = [];
    const batchSize = 100;

    for (let i = 0; i < maxSamples; i += batchSize) {
      // Use at most half the timeout for seeding
      if (Date.now() - startTime > timeout * 0.5) {
        break;
      }

      const batchEnd = Math.min(i + batchSize, maxSamples);
      for (let j = i; j < batchEnd; j++) {
        try {
          // Use standard generate() - no generateInRegime() available
          const state = this.#stateGenerator.generate('uniform', 'static');
          const score = this.#scoreState(state, expression);
          samples.push({ state, score });
        } catch {
          // Skip invalid state generation
        }
      }
    }

    // Sort by score descending
    return samples.sort((a, b) => b.score - a.score);
  }

  /**
   * Score state by fraction of prerequisites passing.
   *
   * @param {object} state - State to score
   * @param {object} expression - Expression with prerequisites
   * @returns {number} Score in [0, 1]
   */
  #scoreState(state, expression) {
    const prereqs = expression?.prerequisites ?? [];
    if (prereqs.length === 0) return 0;

    try {
      const passing = prereqs.filter((prereq) =>
        this.#expressionEvaluator.evaluatePrerequisite(prereq, state)
      ).length;
      return passing / prereqs.length;
    } catch {
      return 0;
    }
  }

  /**
   * Perform hill climbing from a seed state to improve score.
   *
   * @param {{state: object, score: number}} seed - Starting seed
   * @param {object} expression - Expression to optimize for
   * @param {number} remainingTime - Time budget in milliseconds
   * @returns {Promise<{state: object, score: number}>}
   */
  async #hillClimb(seed, expression, remainingTime) {
    let current = { state: this.#deepCopy(seed.state), score: seed.score };
    const deadline = Date.now() + remainingTime;
    const iterations = this.#config.hillClimbIterations;

    for (let i = 0; i < iterations; i++) {
      if (Date.now() > deadline) break;

      // Already found perfect state
      if (current.score >= 1.0) break;

      const neighbor = this.#perturbState(current.state);
      const neighborScore = this.#scoreState(neighbor, expression);

      if (neighborScore > current.score) {
        current = { state: neighbor, score: neighborScore };
      }
    }

    return current;
  }

  /**
   * Create a perturbed copy of a state.
   *
   * @param {object} state - State to perturb
   * @returns {object} Perturbed copy
   */
  #perturbState(state) {
    const perturbed = this.#deepCopy(state);
    const numericPaths = this.#getNumericPaths(perturbed);

    if (numericPaths.length === 0) return perturbed;

    // Perturb random numeric field
    const pathToPerturb =
      numericPaths[Math.floor(Math.random() * numericPaths.length)];
    const delta =
      (Math.random() - 0.5) * 2 * this.#config.perturbationDelta * 100;

    this.#applyPerturbation(perturbed, pathToPerturb, delta);
    return perturbed;
  }

  /**
   * Get all paths to numeric values in state.
   *
   * @param {object} obj - Object to traverse
   * @param {string} prefix - Current path prefix
   * @returns {string[]} Array of dot-separated paths
   */
  #getNumericPaths(obj, prefix = '') {
    const paths = [];

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number') {
        paths.push(path);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.#getNumericPaths(value, path));
      }
    }

    return paths;
  }

  /**
   * Apply perturbation to a numeric value at a path.
   *
   * @param {object} obj - Object to modify
   * @param {string} path - Dot-separated path
   * @param {number} delta - Value to add
   */
  #applyPerturbation(obj, path, delta) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
      if (!current) return;
    }

    const lastKey = parts[parts.length - 1];
    const oldValue = current[lastKey];

    if (typeof oldValue !== 'number') return;

    let newValue = oldValue + delta;

    // Apply domain bounds based on path context
    if (path.includes('affectTraits')) {
      // Affect traits: 0-100
      newValue = Math.max(0, Math.min(100, newValue));
    } else if (path.includes('baseline_libido')) {
      // Baseline libido: -50 to 50
      newValue = Math.max(-50, Math.min(50, newValue));
    } else if (
      path.includes('sex_excitation') ||
      path.includes('sex_inhibition')
    ) {
      // Sexual axes: 0-100
      newValue = Math.max(0, Math.min(100, newValue));
    } else if (path.includes('mood')) {
      // Mood axes: -100 to 100
      newValue = Math.max(-100, Math.min(100, newValue));
    }

    current[lastKey] = Math.round(newValue);
  }

  /**
   * Select the best candidate from hill climb results.
   *
   * @param {Array<{state: object, score: number}>} candidates - Candidates to choose from
   * @returns {{state: object, score: number}} Best candidate
   */
  #selectBest(candidates) {
    return candidates.reduce(
      (best, c) => (c.score > best.score ? c : best),
      { state: null, score: -1 }
    );
  }

  /**
   * Analyze blocking clauses in the best state.
   *
   * @param {{state: object, score: number}} best - Best state found
   * @param {object} expression - Expression being analyzed
   * @returns {{blockingClauses: BlockingClauseInfo[], adjustments: ThresholdAdjustment[]}}
   */
  #analyzeBlockers(best, expression) {
    if (!best.state) {
      return { blockingClauses: [], adjustments: [] };
    }

    const prereqs = expression?.prerequisites ?? [];
    const blocking = [];

    for (let i = 0; i < prereqs.length; i++) {
      const prereq = prereqs[i];
      const passed = this.#expressionEvaluator.evaluatePrerequisite(
        prereq,
        best.state
      );

      if (!passed) {
        const info = this.#extractBlockingInfo(prereq, best.state, i);
        blocking.push(info);
      }
    }

    const adjustments = blocking.map((b) => ({
      clauseId: b.clauseId,
      currentThreshold: b.threshold,
      suggestedThreshold: b.observedValue,
      delta: b.observedValue - b.threshold,
      confidence:
        Math.abs(b.gap) < 0.05
          ? 'high'
          : Math.abs(b.gap) < 0.15
            ? 'medium'
            : 'low',
    }));

    // Sort by smallest absolute delta first
    adjustments.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

    return { blockingClauses: blocking, adjustments };
  }

  /**
   * Extract blocking clause information from a prerequisite.
   *
   * @param {object} prereq - The failing prerequisite
   * @param {object} state - The state it was evaluated against
   * @param {number} index - Index in prerequisites array
   * @returns {BlockingClauseInfo}
   */
  #extractBlockingInfo(prereq, state, index) {
    const clauseId = prereq.id ?? `prereq_${index}`;
    const clauseDescription = this.#describePrereq(prereq);

    // Attempt to extract threshold and observed value from logic
    const { threshold, observedValue } = this.#extractComparisonValues(
      prereq.logic,
      state
    );

    return {
      clauseId,
      clauseDescription,
      observedValue,
      threshold,
      gap: threshold - observedValue,
    };
  }

  /**
   * Generate a human-readable description of a prerequisite.
   *
   * @param {object} prereq - Prerequisite to describe
   * @returns {string}
   */
  #describePrereq(prereq) {
    if (prereq.description) return prereq.description;
    if (prereq.clauseDescription) return prereq.clauseDescription;

    // Try to describe the logic structure
    const logic = prereq.logic;
    if (!logic) return 'Unknown clause';

    // Handle common patterns
    const ops = ['>=', '<=', '>', '<', '=='];
    for (const op of ops) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const leftStr = this.#describeOperand(left);
        const rightStr = this.#describeOperand(right);
        return `${leftStr} ${op} ${rightStr}`;
      }
    }

    return JSON.stringify(logic).substring(0, 100);
  }

  /**
   * Describe an operand in a comparison.
   *
   * @param {*} operand - Operand to describe
   * @returns {string}
   */
  #describeOperand(operand) {
    if (typeof operand === 'number') return String(operand);
    if (typeof operand === 'string') return operand;
    if (operand?.var) return operand.var;
    return JSON.stringify(operand);
  }

  /**
   * Extract threshold and observed value from comparison logic.
   *
   * @param {object} logic - JSON Logic expression
   * @param {object} state - State to extract values from
   * @returns {{threshold: number, observedValue: number}}
   */
  #extractComparisonValues(logic, state) {
    if (!logic) return { threshold: 0, observedValue: 0 };

    const ops = ['>=', '<=', '>', '<', '=='];
    for (const op of ops) {
      if (logic[op]) {
        const [left, right] = logic[op];

        // Determine which side is the variable and which is the threshold
        const leftValue = this.#resolveValue(left, state);
        const rightValue = this.#resolveValue(right, state);

        // If left is a var reference and right is constant
        if (left?.var && typeof rightValue === 'number') {
          return { threshold: rightValue, observedValue: leftValue };
        }
        // If right is a var reference and left is constant
        if (right?.var && typeof leftValue === 'number') {
          return { threshold: leftValue, observedValue: rightValue };
        }

        // Fallback: treat right as threshold
        return {
          threshold: typeof rightValue === 'number' ? rightValue : 0,
          observedValue: typeof leftValue === 'number' ? leftValue : 0,
        };
      }
    }

    return { threshold: 0, observedValue: 0 };
  }

  /**
   * Resolve a value from logic expression against state.
   *
   * @param {*} value - Value or var reference
   * @param {object} state - State to resolve from
   * @returns {*}
   */
  #resolveValue(value, state) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (value?.var) {
      return this.#getNestedValue(state, value.var);
    }
    return value;
  }

  /**
   * Get a nested value from an object using dot notation.
   *
   * @param {object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {*}
   */
  #getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Create a deep copy of an object.
   *
   * @param {object} obj - Object to copy
   * @returns {object}
   */
  #deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Build an empty result structure.
   *
   * @param {number} startTime - Start timestamp
   * @param {string} reason - Reason for empty result
   * @returns {WitnessSearchResult}
   */
  #buildEmptyResult(startTime, reason) {
    this.#logger.debug(`ConstructiveWitnessSearcher: Empty result - ${reason}`);
    return {
      found: false,
      bestCandidateState: null,
      andBlockScore: 0,
      blockingClauses: [],
      minimalAdjustments: [],
      searchStats: {
        samplesEvaluated: 0,
        hillClimbIterations: 0,
        timeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Build a result when timeout occurred.
   *
   * @param {{state: object, score: number}} best - Best state found so far
   * @param {number} startTime - Start timestamp
   * @returns {WitnessSearchResult}
   */
  #buildTimeoutResult(best, startTime) {
    this.#logger.debug('ConstructiveWitnessSearcher: Returning timeout result');
    return {
      found: best && best.score >= this.#config.minAndBlockScore,
      bestCandidateState: best?.state ?? null,
      andBlockScore: best?.score ?? 0,
      blockingClauses: [],
      minimalAdjustments: [],
      searchStats: {
        samplesEvaluated: 0,
        hillClimbIterations: 0,
        timeMs: Date.now() - startTime,
      },
    };
  }
}

export default ConstructiveWitnessSearcher;
