/**
 * @file MonteCarloSimulator - Statistical trigger probability estimation
 * @see specs/expression-diagnostics.md Layer C
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import jsonLogic from 'json-logic-js';
import HierarchicalClauseNode from '../models/HierarchicalClauseNode.js';
import { collectVarPaths } from '../../utils/jsonLogicVarExtractor.js';

/**
 * @typedef {'uniform' | 'gaussian'} DistributionType
 */

/**
 * @typedef {object} SimulationConfig
 * @property {number} sampleCount - Number of samples (default 10000)
 * @property {DistributionType} distribution - Distribution type
 * @property {boolean} trackClauses - Track per-clause failures
 * @property {number} confidenceLevel - CI level (default 0.95)
 * @property {(completed: number, total: number) => void} [onProgress] - Progress callback
 * @property {boolean} [validateVarPaths=true] - Enable pre-simulation var path validation
 * @property {boolean} [failOnUnseededVars=false] - Throw error if unseeded vars found
 */

/**
 * @typedef {object} UnseededVarWarning
 * @property {string} path - The problematic variable path
 * @property {'unknown_root' | 'unknown_nested_key' | 'invalid_nesting'} reason - Category of issue
 * @property {string} suggestion - Human-readable explanation
 */

/**
 * @typedef {object} ClauseResult
 * @property {string} clauseDescription
 * @property {number} failureCount
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {number} clauseIndex
 * @property {object | null} [hierarchicalBreakdown] - Tree structure for compound clauses
 */

/**
 * @typedef {object} SimulationResult
 * @property {number} triggerRate - Probability of triggering [0, 1]
 * @property {number} triggerCount - Number of successful triggers
 * @property {number} sampleCount - Total samples evaluated
 * @property {{ low: number, high: number }} confidenceInterval
 * @property {ClauseResult[]} clauseFailures - Per-clause failure data
 * @property {DistributionType} distribution
 * @property {UnseededVarWarning[]} unseededVarWarnings - Warnings for unseeded variable paths
 */

/**
 * Monte Carlo simulator for expression trigger probability estimation.
 * Samples random mood/sexual states, evaluates expressions, and calculates
 * trigger rates with confidence intervals and per-clause failure tracking.
 */
class MonteCarloSimulator {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.logger - ILogger
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
   * Run Monte Carlo simulation for an expression
   *
   * @param {object} expression - Expression to evaluate
   * @param {SimulationConfig} [config]
   * @returns {SimulationResult}
   */
  /**
   * Run Monte Carlo simulation for an expression
   *
   * @param {object} expression - Expression to evaluate
   * @param {SimulationConfig} [config]
   * @returns {Promise<SimulationResult>}
   */
  async simulate(expression, config = {}) {
    const {
      sampleCount = 10000,
      distribution = 'uniform',
      trackClauses = true,
      confidenceLevel = 0.95,
      onProgress,
      validateVarPaths = true,
      failOnUnseededVars = false,
    } = config;

    // Pre-simulation variable path validation
    let unseededVarWarnings = [];
    if (validateVarPaths) {
      const validation = this.#validateExpressionVarPaths(expression);
      unseededVarWarnings = validation.warnings;

      if (unseededVarWarnings.length > 0) {
        // Log warnings
        for (const warning of unseededVarWarnings) {
          this.#logger.warn(
            `MonteCarloSimulator: Unseeded var "${warning.path}" (${warning.reason}): ${warning.suggestion}`
          );
        }

        // Fail-fast if configured
        if (failOnUnseededVars) {
          const pathList = unseededVarWarnings.map((w) => w.path).join(', ');
          throw new Error(
            `MonteCarloSimulator: Expression "${expression?.id ?? 'unknown'}" uses unseeded variables: ${pathList}`
          );
        }
      }
    }

    const CHUNK_SIZE = 1000;
    let triggerCount = 0;
    const clauseTracking = trackClauses
      ? this.#initClauseTracking(expression)
      : null;

    // Process samples in chunks to avoid blocking the main thread
    for (let processed = 0; processed < sampleCount; ) {
      const chunkEnd = Math.min(processed + CHUNK_SIZE, sampleCount);

      // Process chunk synchronously (fast enough not to block)
      for (let i = processed; i < chunkEnd; i++) {
        const state = this.#generateRandomState(distribution);
        const result = this.#evaluateWithTracking(
          expression,
          state,
          clauseTracking
        );

        if (result.triggered) {
          triggerCount++;
        }
      }

      processed = chunkEnd;

      // Yield to browser and report progress between chunks
      if (processed < sampleCount) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        onProgress?.(processed, sampleCount);
      }
    }

    // Report 100% completion
    onProgress?.(sampleCount, sampleCount);

    const triggerRate = triggerCount / sampleCount;
    const confidenceInterval = this.#calculateConfidenceInterval(
      triggerRate,
      sampleCount,
      confidenceLevel
    );

    this.#logger.debug(
      `MonteCarloSimulator: ${expression?.id ?? 'unknown'} ` +
        `triggerRate=${triggerRate.toFixed(4)} ` +
        `(${triggerCount}/${sampleCount}, ${distribution})`
    );

    return {
      triggerRate,
      triggerCount,
      sampleCount,
      confidenceInterval,
      clauseFailures: clauseTracking
        ? this.#finalizeClauseResults(clauseTracking, sampleCount)
        : [],
      distribution,
      unseededVarWarnings,
    };
  }

  /**
   * Generate random state based on distribution
   *
   * @private
   * @param {DistributionType} distribution
   * @returns {{mood: object, sexual: object}}
   */
  #generateRandomState(distribution) {
    const moodAxes = ['valence', 'arousal', 'agency_control', 'threat', 'engagement', 'future_expectancy', 'self_evaluation'];

    const mood = {};
    const sexual = {};

    // Mood axes use [-100, 100] integer scale (matching core:mood component schema)
    for (const axis of moodAxes) {
      mood[axis] = Math.round(this.#sampleValue(distribution, -100, 100));
    }

    // Sexual axes use integer scale matching core:sexual_state component schema
    // sex_excitation: [0, 100], sex_inhibition: [0, 100], baseline_libido: [-50, 50]
    sexual.sex_excitation = Math.round(this.#sampleValue(distribution, 0, 100));
    sexual.sex_inhibition = Math.round(this.#sampleValue(distribution, 0, 100));
    sexual.baseline_libido = Math.round(this.#sampleValue(distribution, -50, 50));

    return { mood, sexual };
  }

  /**
   * Sample a value from the specified distribution
   *
   * @private
   * @param {DistributionType} distribution
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  #sampleValue(distribution, min, max) {
    if (distribution === 'gaussian') {
      // Box-Muller transform, clamped to range
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mid = (min + max) / 2;
      const spread = (max - min) / 6; // 99.7% within range
      const value = mid + z * spread;
      return Math.max(min, Math.min(max, value));
    }

    // Uniform distribution
    return min + Math.random() * (max - min);
  }

  /**
   * Initialize clause tracking data structure with hierarchical breakdown
   *
   * @private
   * @param {object} expression
   * @returns {Array}
   */
  #initClauseTracking(expression) {
    const clauses = [];
    if (!expression?.prerequisites) return clauses;

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      clauses.push({
        clauseIndex: i,
        description: this.#describeClause(prereq),
        failureCount: 0,
        violationSum: 0,
        // Build hierarchical tree for compound clauses
        hierarchicalTree: this.#buildHierarchicalTree(prereq.logic, `${i}`),
      });
    }

    return clauses;
  }

  /**
   * Describe a clause in human-readable form
   *
   * @private
   * @param {object} prerequisite
   * @returns {string}
   */
  #describeClause(prerequisite) {
    const logic = prerequisite?.logic;
    if (!logic) return 'Unknown clause';

    // Simple description extraction
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} >= ${right}`;
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} <= ${right}`;
      }
    }

    if (logic.and || logic.or) {
      const op = logic.and ? 'AND' : 'OR';
      const count = (logic.and || logic.or).length;
      return `${op} of ${count} conditions`;
    }

    return JSON.stringify(logic).substring(0, 50);
  }

  /**
   * Evaluate expression with clause tracking (includes hierarchical breakdown)
   *
   * @private
   * @param {object} expression
   * @param {{mood: object, sexual: object}} state
   * @param {Array|null} clauseTracking
   * @returns {{triggered: boolean}}
   */
  #evaluateWithTracking(expression, state, clauseTracking) {
    // Build context from state
    const context = this.#buildContext(state);

    // Evaluate each prerequisite separately for tracking
    if (clauseTracking && expression?.prerequisites) {
      for (let i = 0; i < expression.prerequisites.length; i++) {
        const prereq = expression.prerequisites[i];
        const clause = clauseTracking[i];

        // Use hierarchical evaluation if tree exists
        if (clause.hierarchicalTree) {
          const passed = this.#evaluateHierarchicalNode(
            clause.hierarchicalTree,
            context
          );
          if (!passed) {
            clause.failureCount++;
            // Violation is tracked at leaf level in the tree
          }
        } else {
          // Fallback to atomic evaluation
          const passed = this.#evaluatePrerequisite(prereq, context);
          if (!passed) {
            clause.failureCount++;
            const violation = this.#estimateViolation(prereq, context);
            clause.violationSum += violation;
          }
        }
      }
    }

    // Full evaluation
    const triggered = this.#evaluateAllPrerequisites(expression, context);
    return { triggered };
  }

  /**
   * Build evaluation context from state
   *
   * @private
   * @param {{mood: object, sexual: object}} state
   * @returns {object}
   */
  #buildContext(state) {
    // Calculate emotions from mood using prototypes
    // Note: #calculateEmotions normalizes mood from [-100,100] to [-1,1] internally
    const emotions = this.#calculateEmotions(state.mood);

    // Calculate sexualArousal from raw sexual state (derived value)
    const sexualArousal = this.#calculateSexualArousal(state.sexual);

    // Calculate sexual states, passing the derived sexualArousal for prototype weights
    const sexualStates = this.#calculateSexualStates(state.sexual, sexualArousal);

    // Build previous states (zeroed for Monte Carlo - no temporal context)
    const previousEmotions = this.#createZeroedEmotions();
    const previousSexualStates = this.#createZeroedSexualStates();
    const previousMoodAxes = this.#createZeroedMoodAxes();

    return {
      mood: state.mood,
      moodAxes: state.mood, // Alias for expressions that check moodAxes.*
      emotions,
      sexualStates,
      sexualArousal, // Derived value available for expression evaluation
      previousEmotions,
      previousSexualStates,
      previousMoodAxes,
    };
  }

  /**
   * Calculate emotion intensities from mood axes
   *
   * @private
   * @param {object} mood - Mood axes in [-100, 100] scale
   * @returns {object}
   */
  #calculateEmotions(mood) {
    const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
    if (!lookup?.entries) return {};

    // Normalize mood from [-100, 100] to [-1, 1] for prototype calculations
    // (matching EmotionCalculatorService behavior)
    const normalizedMood = {};
    for (const [axis, value] of Object.entries(mood)) {
      normalizedMood[axis] = value / 100;
    }

    const emotions = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          if (normalizedMood[axis] !== undefined) {
            sum += normalizedMood[axis] * weight;
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
   * Calculate sexual arousal from sexual state properties.
   * Mirrors EmotionCalculatorService.calculateSexualArousal()
   *
   * @private
   * @param {object} sexual - Sexual state with sex_excitation, sex_inhibition, baseline_libido
   * @returns {number} - Arousal in [0, 1] range
   */
  #calculateSexualArousal(sexual) {
    const excitation =
      typeof sexual.sex_excitation === 'number' ? sexual.sex_excitation : 0;
    const inhibition =
      typeof sexual.sex_inhibition === 'number' ? sexual.sex_inhibition : 0;
    const baseline =
      typeof sexual.baseline_libido === 'number' ? sexual.baseline_libido : 0;

    // Formula: (excitation - inhibition + baseline) / 100, clamped to [0, 1]
    const rawValue = (excitation - inhibition + baseline) / 100;
    return Math.max(0, Math.min(1, rawValue));
  }

  /**
   * Calculate sexual state intensities
   *
   * @private
   * @param {object} sexual - Raw sexual state with sex_excitation, sex_inhibition, baseline_libido
   * @param {number} sexualArousal - Pre-calculated sexual arousal in [0, 1] range
   * @returns {object}
   */
  #calculateSexualStates(sexual, sexualArousal) {
    const lookup = this.#dataRegistry.get('lookups', 'core:sexual_prototypes');
    if (!lookup?.entries) return {};

    // Normalize raw values to [0, 1] for prototype weight calculations
    // and include the derived sexual_arousal axis
    const normalizedAxes = {
      sex_excitation: (sexual.sex_excitation || 0) / 100,
      sex_inhibition: (sexual.sex_inhibition || 0) / 100,
      // baseline_libido: [-50, 50] -> normalize to [0, 1]
      baseline_libido: ((sexual.baseline_libido || 0) + 50) / 100,
      // sexual_arousal is already in [0, 1] range
      sexual_arousal: sexualArousal,
    };

    const states = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          if (normalizedAxes[axis] !== undefined) {
            sum += normalizedAxes[axis] * weight;
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
   * Evaluate a single prerequisite
   *
   * @private
   * @param {object} prereq
   * @param {object} context
   * @returns {boolean}
   */
  #evaluatePrerequisite(prereq, context) {
    try {
      return jsonLogic.apply(prereq.logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate all prerequisites
   *
   * @private
   * @param {object} expression
   * @param {object} context
   * @returns {boolean}
   */
  #evaluateAllPrerequisites(expression, context) {
    if (!expression?.prerequisites) return true;

    for (const prereq of expression.prerequisites) {
      if (!this.#evaluatePrerequisite(prereq, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Estimate violation magnitude for a failed prerequisite
   *
   * @private
   * @param {object} prereq
   * @param {object} context
   * @returns {number}
   */
  #estimateViolation(prereq, context) {
    const logic = prereq?.logic;
    if (!logic) return 0;

    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    return 0.1; // Default small violation
  }

  /**
   * Get nested value from object using dot notation
   *
   * @private
   * @param {object} obj
   * @param {string} path
   * @returns {*}
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Finalize clause results with rates and hierarchical breakdown
   *
   * @private
   * @param {Array} clauseTracking
   * @param {number} sampleCount
   * @returns {ClauseResult[]}
   */
  #finalizeClauseResults(clauseTracking, sampleCount) {
    return clauseTracking
      .map((c) => ({
        clauseDescription: c.description,
        clauseIndex: c.clauseIndex,
        failureCount: c.failureCount,
        failureRate: c.failureCount / sampleCount,
        averageViolation:
          c.failureCount > 0 ? c.violationSum / c.failureCount : 0,
        // Include hierarchical breakdown if available
        hierarchicalBreakdown: c.hierarchicalTree?.toJSON() ?? null,
      }))
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate Wilson score confidence interval
   *
   * @private
   * @param {number} rate
   * @param {number} n
   * @param {number} level
   * @returns {{low: number, high: number}}
   */
  #calculateConfidenceInterval(rate, n, level) {
    // Wilson score interval for binomial proportion
    const z = this.#getZScore(level);
    const denominator = 1 + (z * z) / n;
    const center = rate + (z * z) / (2 * n);
    const margin =
      z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * n)) / n);

    return {
      low: Math.max(0, (center - margin) / denominator),
      high: Math.min(1, (center + margin) / denominator),
    };
  }

  /**
   * Get z-score for confidence level
   *
   * @private
   * @param {number} level
   * @returns {number}
   */
  #getZScore(level) {
    // Common z-scores
    if (level >= 0.99) return 2.576;
    if (level >= 0.95) return 1.96;
    if (level >= 0.9) return 1.645;
    return 1.96; // Default to 95%
  }

  /**
   * Create zeroed emotions object from prototypes
   *
   * @private
   * @returns {object}
   */
  #createZeroedEmotions() {
    const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
    if (!lookup?.entries) return {};
    return Object.fromEntries(Object.keys(lookup.entries).map((k) => [k, 0]));
  }

  /**
   * Create zeroed sexual states object from prototypes
   *
   * @private
   * @returns {object}
   */
  #createZeroedSexualStates() {
    const lookup = this.#dataRegistry.get('lookups', 'core:sexual_prototypes');
    if (!lookup?.entries) return {};
    return Object.fromEntries(Object.keys(lookup.entries).map((k) => [k, 0]));
  }

  /**
   * Create zeroed mood axes object
   *
   * @private
   * @returns {object}
   */
  #createZeroedMoodAxes() {
    return {
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 0,
      future_expectancy: 0,
      self_evaluation: 0,
    };
  }

  // ============================================================
  // Hierarchical Tree Building and Evaluation Methods
  // ============================================================

  /**
   * Build a hierarchical tracking tree from a JSON Logic expression.
   *
   * @private
   * @param {object} logic - The JSON Logic object
   * @param {string} pathPrefix - Path prefix for node IDs
   * @returns {HierarchicalClauseNode}
   */
  #buildHierarchicalTree(logic, pathPrefix = '0') {
    if (!logic || typeof logic !== 'object') {
      return new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'leaf',
        description: this.#describeLeafCondition(logic),
        logic,
      });
    }

    // Handle AND nodes
    if (logic.and && Array.isArray(logic.and)) {
      const children = logic.and.map((child, i) =>
        this.#buildHierarchicalTree(child, `${pathPrefix}.${i}`)
      );
      return new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'and',
        description: `AND of ${logic.and.length} conditions`,
        logic,
        children,
      });
    }

    // Handle OR nodes
    if (logic.or && Array.isArray(logic.or)) {
      const children = logic.or.map((child, i) =>
        this.#buildHierarchicalTree(child, `${pathPrefix}.${i}`)
      );
      return new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'or',
        description: `OR of ${logic.or.length} conditions`,
        logic,
        children,
      });
    }

    // Leaf node (comparison operator)
    return new HierarchicalClauseNode({
      id: pathPrefix,
      nodeType: 'leaf',
      description: this.#describeLeafCondition(logic),
      logic,
    });
  }

  /**
   * Describe a leaf condition in human-readable form.
   *
   * @private
   * @param {object} logic
   * @returns {string}
   */
  #describeLeafCondition(logic) {
    if (!logic || typeof logic !== 'object') return String(logic);

    const operators = ['>=', '<=', '>', '<', '==', '!='];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const leftStr = this.#describeOperand(left);
        const rightStr = this.#describeOperand(right);
        return `${leftStr} ${op} ${rightStr}`;
      }
    }

    // Handle other patterns - try to make them readable
    return JSON.stringify(logic).substring(0, 60);
  }

  /**
   * Describe an operand (left or right side of comparison).
   *
   * @private
   * @param {*} operand
   * @returns {string}
   */
  #describeOperand(operand) {
    if (operand === null || operand === undefined) return 'null';
    if (typeof operand === 'number') return String(operand);
    if (typeof operand === 'string') return `"${operand}"`;
    if (operand?.var) return operand.var;

    // Handle arithmetic expressions like { "-": [...] }
    if (operand['-']) {
      const [a, b] = operand['-'];
      return `(${this.#describeOperand(a)} - ${this.#describeOperand(b)})`;
    }
    if (operand['+']) {
      const [a, b] = operand['+'];
      return `(${this.#describeOperand(a)} + ${this.#describeOperand(b)})`;
    }
    if (operand['*']) {
      const [a, b] = operand['*'];
      return `(${this.#describeOperand(a)} * ${this.#describeOperand(b)})`;
    }
    if (operand['/']) {
      const [a, b] = operand['/'];
      return `(${this.#describeOperand(a)} / ${this.#describeOperand(b)})`;
    }

    return JSON.stringify(operand).substring(0, 30);
  }

  /**
   * Recursively evaluate a hierarchical tree node and update stats.
   * Evaluates ALL children (no short-circuit) to collect accurate stats.
   *
   * @private
   * @param {HierarchicalClauseNode} node
   * @param {object} context
   * @returns {boolean} - Whether the node evaluated to true
   */
  #evaluateHierarchicalNode(node, context) {
    if (node.nodeType === 'leaf') {
      const passed = this.#evaluateLeafCondition(node.logic, context);
      const violation = passed
        ? 0
        : this.#estimateLeafViolation(node.logic, context);
      node.recordEvaluation(passed, violation);
      return passed;
    }

    if (node.nodeType === 'and') {
      // For AND: all children must pass; evaluate ALL to track stats
      let allPassed = true;
      for (const child of node.children) {
        const childPassed = this.#evaluateHierarchicalNode(child, context);
        if (!childPassed) allPassed = false;
        // Continue evaluating other children to collect stats
      }
      node.recordEvaluation(allPassed);
      return allPassed;
    }

    if (node.nodeType === 'or') {
      // For OR: any child must pass; evaluate ALL to track stats
      let anyPassed = false;
      for (const child of node.children) {
        const childPassed = this.#evaluateHierarchicalNode(child, context);
        if (childPassed) anyPassed = true;
        // Continue evaluating other children to collect stats
      }
      node.recordEvaluation(anyPassed);
      return anyPassed;
    }

    // Unknown node type - use json-logic directly
    try {
      const passed = jsonLogic.apply(node.logic, context);
      node.recordEvaluation(passed);
      return passed;
    } catch {
      node.recordEvaluation(false);
      return false;
    }
  }

  /**
   * Evaluate a leaf condition directly.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {boolean}
   */
  #evaluateLeafCondition(logic, context) {
    try {
      return jsonLogic.apply(logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Estimate violation magnitude for a leaf condition.
   *
   * @private
   * @param {object} logic
   * @param {object} context
   * @returns {number}
   */
  #estimateLeafViolation(logic, context) {
    if (!logic) return 0;

    // Handle >= operator
    if (logic['>=']) {
      const [left, right] = logic['>='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, threshold - actual);
      }
    }

    // Handle <= operator
    if (logic['<=']) {
      const [left, right] = logic['<='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, actual - threshold);
      }
    }

    // Handle < operator
    if (logic['<']) {
      const [left, right] = logic['<'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual >= threshold ? actual - threshold + 0.01 : 0;
      }
    }

    // Handle > operator
    if (logic['>']) {
      const [left, right] = logic['>'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual <= threshold ? threshold - actual + 0.01 : 0;
      }
    }

    return 0.1; // Default small violation for unknown operators
  }

  /**
   * Resolve a value from context (handles {var: "path"}, literals, and expressions).
   *
   * @private
   * @param {*} expr
   * @param {object} context
   * @returns {*}
   */
  #resolveValue(expr, context) {
    if (expr?.var) {
      return this.#getNestedValue(context, expr.var);
    }
    if (typeof expr === 'number' || typeof expr === 'string') {
      return expr;
    }
    // Try evaluating as json-logic expression (e.g., arithmetic)
    try {
      return jsonLogic.apply(expr, context);
    } catch {
      return expr;
    }
  }

  // ============================================================
  // Unseeded Variable Detection Methods
  // ============================================================

  /**
   * Build the set of known context keys from static definitions and prototype registries.
   *
   * @private
   * @returns {{ topLevel: Set<string>, nestedKeys: Record<string, Set<string>>, scalarKeys: Set<string> }}
   */
  #buildKnownContextKeys() {
    // Static top-level keys that are always seeded
    const topLevel = new Set([
      'mood',
      'moodAxes',
      'emotions',
      'sexualStates',
      'sexualArousal',
      'previousEmotions',
      'previousSexualStates',
      'previousMoodAxes',
    ]);

    // Keys that are scalar (cannot have nested properties)
    const scalarKeys = new Set(['sexualArousal']);

    // Nested keys for each category (from prototypes + hardcoded mood axes)
    const nestedKeys = {
      mood: new Set([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
      ]),
      moodAxes: new Set([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
      ]),
      previousMoodAxes: new Set([
        'valence',
        'arousal',
        'agency_control',
        'threat',
        'engagement',
        'future_expectancy',
        'self_evaluation',
      ]),
    };

    // Get dynamic keys from emotion prototypes
    const emotionLookup = this.#dataRegistry.get(
      'lookups',
      'core:emotion_prototypes'
    );
    if (emotionLookup?.entries) {
      const emotionKeys = new Set(Object.keys(emotionLookup.entries));
      nestedKeys.emotions = emotionKeys;
      nestedKeys.previousEmotions = emotionKeys;
    } else {
      nestedKeys.emotions = new Set();
      nestedKeys.previousEmotions = new Set();
    }

    // Get dynamic keys from sexual prototypes
    const sexualLookup = this.#dataRegistry.get(
      'lookups',
      'core:sexual_prototypes'
    );
    if (sexualLookup?.entries) {
      const sexualKeys = new Set(Object.keys(sexualLookup.entries));
      nestedKeys.sexualStates = sexualKeys;
      nestedKeys.previousSexualStates = sexualKeys;
    } else {
      nestedKeys.sexualStates = new Set();
      nestedKeys.previousSexualStates = new Set();
    }

    return { topLevel, nestedKeys, scalarKeys };
  }

  /**
   * Validate a single variable path against known context keys.
   *
   * @private
   * @param {string} path - The variable path to validate (e.g., "emotions.joy")
   * @param {{ topLevel: Set<string>, nestedKeys: Record<string, Set<string>>, scalarKeys: Set<string> }} knownKeys
   * @returns {{ isValid: boolean, reason?: 'unknown_root' | 'unknown_nested_key' | 'invalid_nesting', suggestion?: string }}
   */
  #validateVarPath(path, knownKeys) {
    const parts = path.split('.');
    const root = parts[0];

    // Check if root is known
    if (!knownKeys.topLevel.has(root)) {
      return {
        isValid: false,
        reason: 'unknown_root',
        suggestion: `Unknown root variable "${root}". Valid roots: ${[...knownKeys.topLevel].sort().join(', ')}`,
      };
    }

    // Check if trying to nest on a scalar
    if (parts.length > 1 && knownKeys.scalarKeys.has(root)) {
      return {
        isValid: false,
        reason: 'invalid_nesting',
        suggestion: `"${root}" is a scalar value and cannot have nested properties like "${path}"`,
      };
    }

    // Check nested key validity (if applicable)
    if (parts.length > 1) {
      const nestedKey = parts[1];
      const validNestedKeys = knownKeys.nestedKeys[root];

      if (validNestedKeys && !validNestedKeys.has(nestedKey)) {
        const knownList =
          validNestedKeys.size > 0
            ? [...validNestedKeys].sort().slice(0, 5).join(', ') +
              (validNestedKeys.size > 5 ? '...' : '')
            : '(none available)';
        return {
          isValid: false,
          reason: 'unknown_nested_key',
          suggestion: `Unknown key "${nestedKey}" in "${root}". Known keys: ${knownList}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate all variable paths in an expression's prerequisites.
   *
   * @private
   * @param {object} expression - Expression with prerequisites array
   * @returns {{ warnings: UnseededVarWarning[] }}
   */
  #validateExpressionVarPaths(expression) {
    const warnings = [];
    const knownKeys = this.#buildKnownContextKeys();

    if (!expression?.prerequisites) {
      return { warnings };
    }

    // Collect all var paths from all prerequisites
    const allPaths = [];
    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        collectVarPaths(prereq.logic, allPaths);
      }
    }

    // Deduplicate paths for validation (but track all occurrences for warnings)
    const seenPaths = new Set();
    for (const path of allPaths) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);

      const result = this.#validateVarPath(path, knownKeys);
      if (!result.isValid) {
        warnings.push({
          path,
          reason: result.reason,
          suggestion: result.suggestion,
        });
      }
    }

    return { warnings };
  }
}

export default MonteCarloSimulator;
