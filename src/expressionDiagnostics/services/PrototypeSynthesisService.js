/**
 * @file PrototypeSynthesisService.js
 * @description Deterministic prototype synthesis and predicted fit evaluation.
 *
 * Implements the prototype synthesis algorithm from the spec:
 * 1. Build target vector from targetSignature
 * 2. Normalize to unit vector
 * 3. Blend: w = w0 + 0.70 * v_norm
 * 4. Apply regime conflict clamps
 * 5. Clamp weights to [-1, 1]
 * 6. Sparsify: top 6 by abs(weight), min 3 non-zero
 * 7. Generate gates from anchor + regime-derived
 * 8. Generate deterministic name
 * @see prototype-create-suggestion-recommendation.md - Canonical specification
 * @see PrototypeFitRankingService.js - Evaluation semantics reference
 */

import GateConstraint from '../models/GateConstraint.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
} from '../utils/axisNormalizationUtils.js';
import { generatePrototypeName } from '../utils/prototypeNameGenerator.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** Blend factor for target signature. Per spec: 0.70. */
const BLEND_FACTOR = 0.7;

/** Maximum non-zero weights after sparsification. */
const MAX_WEIGHTS = 6;

/** Minimum non-zero weights required. */
const MIN_WEIGHTS = 3;

/** Minimum importance threshold for regime-derived gates. */
const GATE_IMPORTANCE_THRESHOLD = 0.45;

/** Maximum regime-derived gates to add. */
const MAX_REGIME_GATES = 3;

/** Regime conflict threshold (low max or high min). */
const REGIME_CONFLICT_LOW_THRESHOLD = 0.1;

/** Weight threshold for triggering conflict clamp. */
const WEIGHT_CONFLICT_THRESHOLD = 0.25;

/** Clamped weight value when conflict detected. */
const CONFLICT_CLAMP_VALUE = 0.1;

/**
 * @typedef {object} SynthesisParams
 * @property {Map<string, {direction: number, importance: number, tightness?: number}> | object} targetSignature
 * @property {Map<string, {min?: number, max?: number}> | object} regimeBounds
 * @property {Array<object>} storedMoodRegimeContexts
 * @property {{id: string, weights: Record<string, number>, gates: string[]}|null} anchorPrototype
 * @property {number} threshold - t* threshold value
 * @property {Set<string>|Array<string>} [existingNames]
 */

/**
 * @typedef {object} SynthesisResult
 * @property {Record<string, number>} weights - Axis weights in [-1, 1]
 * @property {string[]} gates - Gate conditions
 * @property {string} name - Deterministic unique name
 * @property {object} predictedFit - Evaluation metrics
 * @property {number} predictedFit.gatePassRate - P(gates pass)
 * @property {number} predictedFit.mean - Mean intensity
 * @property {number} predictedFit.p95 - 95th percentile intensity
 * @property {Array<{t: number, p: number}>} predictedFit.pAtLeastT - P(I >= t) for multiple thresholds
 */

/**
 * Service for deterministic prototype synthesis with predicted fit evaluation.
 */
class PrototypeSynthesisService {
  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * Creates a new PrototypeSynthesisService.
   *
   * @param {object} deps - Dependencies
   * @param {import('../../interfaces/ILogger.js').ILogger} deps.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    Object.freeze(this);
  }

  /**
   * Synthesize a proposed prototype from target signature and evaluate its fit.
   *
   * @param {SynthesisParams} params
   * @returns {SynthesisResult}
   */
  synthesize({
    targetSignature,
    regimeBounds,
    storedMoodRegimeContexts,
    anchorPrototype = null,
    threshold = 0.55,
    existingNames = new Set(),
  }) {
    this.#logger.debug('PrototypeSynthesisService.synthesize: starting', {
      hasAnchor: !!anchorPrototype,
      targetAxes: this.#getKeys(targetSignature).length,
      contextCount: storedMoodRegimeContexts?.length ?? 0,
    });

    // Step 1-2: Build and normalize target vector
    const targetVector = this.#buildTargetVector(targetSignature);
    const normalizedVector = this.#normalizeVector(targetVector);

    // Step 3: Blend with anchor weights
    const anchorWeights = anchorPrototype?.weights ?? {};
    const blendedWeights = this.#blendWeights(anchorWeights, normalizedVector);

    // Step 4: Apply regime conflict clamps
    const clampedWeights = this.#applyRegimeConflictClamps(
      blendedWeights,
      regimeBounds,
      targetSignature
    );

    // Step 5: Clamp to [-1, 1]
    const boundedWeights = this.#clampWeightsToRange(clampedWeights);

    // Step 6: Sparsify
    const sparseWeights = this.#sparsifyWeights(boundedWeights);

    // Step 7: Generate gates
    const gates = this.#synthesizeGates(
      anchorPrototype?.gates ?? [],
      regimeBounds,
      targetSignature
    );

    // Step 8: Generate name
    const name = generatePrototypeName(
      targetSignature,
      anchorPrototype?.id ?? null,
      existingNames
    );

    // Evaluate predicted fit
    const predictedFit = this.#evaluatePredictedFit(
      sparseWeights,
      gates,
      storedMoodRegimeContexts,
      threshold
    );

    this.#logger.debug('PrototypeSynthesisService.synthesize: complete', {
      name,
      weightCount: Object.keys(sparseWeights).length,
      gateCount: gates.length,
      gatePassRate: predictedFit.gatePassRate,
    });

    return {
      weights: sparseWeights,
      gates,
      name,
      predictedFit,
    };
  }

  /**
   * Build target vector from targetSignature.
   * v[axis] = direction * importance
   *
   * @param {Map | object} targetSignature
   * @returns {Record<string, number>}
   */
  #buildTargetVector(targetSignature) {
    const vector = {};
    const entries = this.#getEntries(targetSignature);

    for (const [axis, entry] of entries) {
      const direction = entry?.direction ?? 0;
      const importance = entry?.importance ?? 0;
      vector[axis] = direction * importance;
    }

    return vector;
  }

  /**
   * Normalize vector to unit length.
   *
   * @param {Record<string, number>} vector
   * @returns {Record<string, number>}
   */
  #normalizeVector(vector) {
    const magnitude = Math.sqrt(
      Object.values(vector).reduce((sum, v) => sum + v * v, 0)
    );

    if (magnitude === 0) {
      return { ...vector };
    }

    const normalized = {};
    for (const [axis, value] of Object.entries(vector)) {
      normalized[axis] = value / magnitude;
    }
    return normalized;
  }

  /**
   * Blend anchor weights with normalized target vector.
   * w = w0 + BLEND_FACTOR * v_norm
   *
   * @param {Record<string, number>} anchorWeights
   * @param {Record<string, number>} normalizedVector
   * @returns {Record<string, number>}
   */
  #blendWeights(anchorWeights, normalizedVector) {
    const blended = { ...anchorWeights };

    for (const [axis, value] of Object.entries(normalizedVector)) {
      blended[axis] = (blended[axis] ?? 0) + BLEND_FACTOR * value;
    }

    return blended;
  }

  /**
   * Apply regime conflict resolution clamps per spec.
   *
   * Rules:
   * - If regime max <= 0.10 and w[a] > 0.25: clamp to 0
   *   (or +0.10 if target signature wants positive)
   * - If regime min >= -0.10 and w[a] < -0.25: clamp to 0
   *   (or -0.10 if target signature wants negative)
   *
   * @param {Record<string, number>} weights
   * @param {Map | object} regimeBounds
   * @param {Map | object} targetSignature
   * @returns {Record<string, number>}
   */
  #applyRegimeConflictClamps(weights, regimeBounds, targetSignature) {
    const clamped = { ...weights };

    for (const [axis, weight] of Object.entries(weights)) {
      const bounds = this.#getBounds(regimeBounds, axis);
      const targetEntry = this.#getTargetEntry(targetSignature, axis);
      const targetDirection = targetEntry?.direction ?? 0;

      // Case 1: Very low max and positive weight
      if (
        bounds.max !== undefined &&
        bounds.max <= REGIME_CONFLICT_LOW_THRESHOLD &&
        weight > WEIGHT_CONFLICT_THRESHOLD
      ) {
        clamped[axis] =
          targetDirection > 0 ? CONFLICT_CLAMP_VALUE : 0;
      }

      // Case 2: Very high min (near 0) and negative weight
      if (
        bounds.min !== undefined &&
        bounds.min >= -REGIME_CONFLICT_LOW_THRESHOLD &&
        weight < -WEIGHT_CONFLICT_THRESHOLD
      ) {
        clamped[axis] =
          targetDirection < 0 ? -CONFLICT_CLAMP_VALUE : 0;
      }
    }

    return clamped;
  }

  /**
   * Clamp all weights to [-1, 1].
   *
   * @param {Record<string, number>} weights
   * @returns {Record<string, number>}
   */
  #clampWeightsToRange(weights) {
    const clamped = {};
    for (const [axis, weight] of Object.entries(weights)) {
      clamped[axis] = Math.max(-1, Math.min(1, weight));
    }
    return clamped;
  }

  /**
   * Sparsify weights: keep top MAX_WEIGHTS by abs(weight), ensure MIN_WEIGHTS non-zero.
   *
   * @param {Record<string, number>} weights
   * @returns {Record<string, number>}
   */
  #sparsifyWeights(weights) {
    // Sort by abs weight descending, then by axis name for determinism
    const entries = Object.entries(weights)
      .filter(([, w]) => w !== 0)
      .sort((a, b) => {
        const absA = Math.abs(a[1]);
        const absB = Math.abs(b[1]);
        if (absB !== absA) return absB - absA;
        return a[0].localeCompare(b[0]);
      });

    // Keep top MAX_WEIGHTS
    const kept = entries.slice(0, MAX_WEIGHTS);

    // Ensure MIN_WEIGHTS non-zero
    // If we have fewer than MIN_WEIGHTS, the result is valid but may indicate
    // a weak target signature - we still return what we have
    if (kept.length < MIN_WEIGHTS) {
      this.#logger.warn(
        `PrototypeSynthesisService: Only ${kept.length} non-zero weights (min ${MIN_WEIGHTS})`
      );
    }

    return Object.fromEntries(kept);
  }

  /**
   * Synthesize gates from anchor and regime-derived constraints.
   *
   * Rules per spec:
   * 1. Start with anchor gates in original order
   * 2. Add up to MAX_REGIME_GATES for axes with importance >= GATE_IMPORTANCE_THRESHOLD
   *    - dir up and regime has min -> axis >= min
   *    - dir down and regime has max -> axis <= max
   * 3. Drop unsatisfiable gates
   * 4. Append added gates sorted by importance desc, then axis name
   *
   * @param {string[]} anchorGates
   * @param {Map | object} regimeBounds
   * @param {Map | object} targetSignature
   * @returns {string[]}
   */
  #synthesizeGates(anchorGates, regimeBounds, targetSignature) {
    // Start with anchor gates that are satisfiable
    const baseGates = [];
    for (const gate of anchorGates) {
      if (this.#isGateSatisfiable(gate, regimeBounds)) {
        baseGates.push(gate);
      }
    }

    // Collect candidate regime-derived gates
    const candidates = [];
    const entries = this.#getEntries(targetSignature);

    for (const [axis, entry] of entries) {
      const importance = entry?.importance ?? 0;
      const direction = entry?.direction ?? 0;

      if (importance < GATE_IMPORTANCE_THRESHOLD) continue;

      const bounds = this.#getBounds(regimeBounds, axis);

      if (direction > 0 && bounds.min !== undefined && bounds.min > -1) {
        // dir up and regime has min -> axis >= min
        candidates.push({
          gate: `${axis} >= ${bounds.min.toFixed(2)}`,
          importance,
          axis,
        });
      } else if (direction < 0 && bounds.max !== undefined && bounds.max < 1) {
        // dir down and regime has max -> axis <= max
        candidates.push({
          gate: `${axis} <= ${bounds.max.toFixed(2)}`,
          importance,
          axis,
        });
      }
    }

    // Sort by importance desc, then axis name
    candidates.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return a.axis.localeCompare(b.axis);
    });

    // Add up to MAX_REGIME_GATES satisfiable gates
    const addedGates = [];
    for (const { gate } of candidates) {
      if (addedGates.length >= MAX_REGIME_GATES) break;
      if (this.#isGateSatisfiable(gate, regimeBounds)) {
        addedGates.push(gate);
      }
    }

    return [...baseGates, ...addedGates];
  }

  /**
   * Check if a gate is satisfiable under regime bounds.
   *
   * @param {string} gateStr
   * @param {Map | object} regimeBounds
   * @returns {boolean}
   */
  #isGateSatisfiable(gateStr, regimeBounds) {
    let parsed;
    try {
      parsed = GateConstraint.parse(gateStr);
    } catch {
      return false;
    }

    const bounds = this.#getBounds(regimeBounds, parsed.axis);

    switch (parsed.operator) {
      case '>=':
      case '>':
        // Gate requires axis >= value, check if bounds.max allows this
        return bounds.max === undefined || bounds.max >= parsed.value;
      case '<=':
      case '<':
        // Gate requires axis <= value, check if bounds.min allows this
        return bounds.min === undefined || bounds.min <= parsed.value;
      case '==':
        // Gate requires exact value, check if it's within bounds
        return (
          (bounds.min === undefined || bounds.min <= parsed.value) &&
          (bounds.max === undefined || bounds.max >= parsed.value)
        );
      default:
        return true;
    }
  }

  /**
   * Evaluate predicted fit metrics for synthesized prototype.
   *
   * @param {Record<string, number>} weights
   * @param {string[]} gates
   * @param {Array<object>} contexts
   * @param {number} threshold
   * @returns {object}
   */
  #evaluatePredictedFit(weights, gates, contexts, threshold) {
    if (!contexts || contexts.length === 0) {
      return {
        gatePassRate: 0,
        mean: 0,
        p95: 0,
        pAtLeastT: [
          { t: Math.max(0, threshold - 0.1), p: 0 },
          { t: threshold, p: 0 },
          { t: Math.min(1, threshold + 0.1), p: 0 },
        ],
      };
    }

    // Compute gate pass rate
    let passCount = 0;
    const gatePassContexts = [];

    for (const ctx of contexts) {
      if (this.#checkAllGatesPass(gates, ctx)) {
        passCount++;
        gatePassContexts.push(ctx);
      }
    }

    const gatePassRate = passCount / contexts.length;

    // Compute intensity distribution for contexts where gates pass
    if (gatePassContexts.length === 0) {
      return {
        gatePassRate,
        mean: 0,
        p95: 0,
        pAtLeastT: [
          { t: Math.max(0, threshold - 0.1), p: 0 },
          { t: threshold, p: 0 },
          { t: Math.min(1, threshold + 0.1), p: 0 },
        ],
      };
    }

    const intensities = gatePassContexts
      .map((ctx) => this.#computeIntensity(weights, ctx))
      .sort((a, b) => a - b);

    const mean =
      intensities.reduce((sum, i) => sum + i, 0) / intensities.length;
    const p95 = this.#percentile(intensities, 0.95);

    // Compute pAtLeastT for three thresholds
    const thresholds = [
      Math.max(0, threshold - 0.1),
      threshold,
      Math.min(1, threshold + 0.1),
    ];

    const pAtLeastT = thresholds.map((t) => ({
      t,
      p: intensities.filter((i) => i >= t).length / intensities.length,
    }));

    return {
      gatePassRate,
      mean,
      p95,
      pAtLeastT,
    };
  }

  /**
   * Check if all gates pass for a context.
   *
   * @param {string[]} gates
   * @param {object} ctx
   * @returns {boolean}
   */
  #checkAllGatesPass(gates, ctx) {
    const normalized = this.#getNormalizedAxes(ctx);

    for (const gateStr of gates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const value = resolveAxisValue(
        parsed.axis,
        normalized.moodAxes,
        normalized.sexualAxes,
        normalized.traitAxes
      );

      if (!parsed.isSatisfiedBy(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compute intensity from weights and context.
   *
   * @param {Record<string, number>} weights
   * @param {object} ctx
   * @returns {number}
   */
  #computeIntensity(weights, ctx) {
    const normalized = this.#getNormalizedAxes(ctx);
    let rawSum = 0;
    let sumAbsWeights = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const value = resolveAxisValue(
        axis,
        normalized.moodAxes,
        normalized.sexualAxes,
        normalized.traitAxes
      );
      rawSum += weight * value;
      sumAbsWeights += Math.abs(weight);
    }

    if (sumAbsWeights === 0) return 0;
    return Math.max(0, Math.min(1, rawSum / sumAbsWeights));
  }

  /**
   * Get normalized axes from context.
   *
   * @param {object} ctx
   * @returns {{moodAxes: object, sexualAxes: object, traitAxes: object}}
   */
  #getNormalizedAxes(ctx) {
    const moodSource = ctx?.moodAxes ?? ctx?.mood ?? null;
    const sexualSource = ctx?.sexualAxes ?? ctx?.sexual ?? null;

    return {
      moodAxes: normalizeMoodAxes(moodSource),
      sexualAxes: normalizeSexualAxes(sexualSource, ctx?.sexualArousal ?? null),
      traitAxes: normalizeAffectTraits(ctx?.affectTraits ?? null),
    };
  }

  /**
   * Compute percentile of sorted array.
   *
   * @param {number[]} sortedArr
   * @param {number} p
   * @returns {number}
   */
  #percentile(sortedArr, p) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.floor(p * (sortedArr.length - 1));
    return sortedArr[idx];
  }

  // --- Helper methods for Map/Object compatibility ---

  /**
   * Get entries from Map or Object.
   *
   * @param {Map | object} mapOrObj
   * @returns {Array<[string, any]>}
   */
  #getEntries(mapOrObj) {
    if (mapOrObj instanceof Map) {
      return Array.from(mapOrObj.entries());
    }
    return Object.entries(mapOrObj || {});
  }

  /**
   * Get keys from Map or Object.
   *
   * @param {Map | object} mapOrObj
   * @returns {string[]}
   */
  #getKeys(mapOrObj) {
    if (mapOrObj instanceof Map) {
      return Array.from(mapOrObj.keys());
    }
    return Object.keys(mapOrObj || {});
  }

  /**
   * Get bounds for an axis from regimeBounds.
   *
   * @param {Map | object} regimeBounds
   * @param {string} axis
   * @returns {{min?: number, max?: number}}
   */
  #getBounds(regimeBounds, axis) {
    if (regimeBounds instanceof Map) {
      return regimeBounds.get(axis) ?? {};
    }
    return regimeBounds?.[axis] ?? {};
  }

  /**
   * Get target signature entry for an axis.
   *
   * @param {Map | object} targetSignature
   * @param {string} axis
   * @returns {{direction?: number, importance?: number}|undefined}
   */
  #getTargetEntry(targetSignature, axis) {
    if (targetSignature instanceof Map) {
      return targetSignature.get(axis);
    }
    return targetSignature?.[axis];
  }
}

export default PrototypeSynthesisService;
