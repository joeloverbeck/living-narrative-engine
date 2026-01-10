/**
 * @file PathSensitiveAnalyzer - Path-sensitive static analysis for OR branches
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 *
 * This service provides:
 * - Branch enumeration logic for path-sensitive analysis (EXPDIAPATSENANA-005)
 * - Per-branch constraint calculation and reachability analysis (EXPDIAPATSENANA-006)
 *
 * It parses JSON Logic trees, identifies OR nodes, enumerates all execution
 * paths through OR branches, and computes axis intervals, conflicts, knife-edges,
 * and threshold reachability for each branch.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import AnalysisBranch from '../models/AnalysisBranch.js';
import PathSensitiveResult from '../models/PathSensitiveResult.js';
import GateConstraint from '../models/GateConstraint.js';
import AxisInterval from '../models/AxisInterval.js';
import KnifeEdge from '../models/KnifeEdge.js';
import BranchReachability from '../models/BranchReachability.js';

/**
 * Default options for path-sensitive analysis
 */
const DEFAULT_OPTIONS = Object.freeze({
  maxBranches: 100,
  knifeEdgeThreshold: 0.02,
  computeVolume: false,
});

class PathSensitiveAnalyzer {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.gateConstraintAnalyzer - IGateConstraintAnalyzer
   * @param {object} deps.intensityBoundsCalculator - IIntensityBoundsCalculator
   * @param {object} deps.logger - ILogger
   */
  constructor({
    dataRegistry,
    gateConstraintAnalyzer,
    intensityBoundsCalculator,
    logger,
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData'],
    });
    validateDependency(gateConstraintAnalyzer, 'IGateConstraintAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(
      intensityBoundsCalculator,
      'IIntensityBoundsCalculator',
      logger,
      {
        requiredMethods: ['analyzeExpression'],
      }
    );
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Analyze expression with path-sensitive OR handling.
   *
   * @param {object} expression - Expression with prerequisites
   * @param {object} [options] - Analysis options
   * @param {number} [options.maxBranches=100] - Limit for branch explosion
   * @param {number} [options.knifeEdgeThreshold=0.02] - Width below which interval is "knife-edge"
   * @param {boolean} [options.computeVolume=false] - Whether to compute feasibility volume
   * @returns {PathSensitiveResult}
   */
  analyze(expression, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!expression?.id) {
      throw new Error('PathSensitiveAnalyzer requires expression with id');
    }

    this.#logger.debug(`PathSensitiveAnalyzer: Analyzing ${expression.id}`);

    // 1. Build branch tree by traversing logic and forking at OR nodes
    const branchTree = this.#buildBranchTree(expression.prerequisites || []);

    // 2. Enumerate all paths (with explosion protection)
    let branches = this.#enumerateBranches(branchTree, opts.maxBranches);

    this.#logger.debug(
      `PathSensitiveAnalyzer: Enumerated ${branches.length} branches`
    );

    // 3. Extract all threshold requirements from prerequisites
    const requirements = this.#extractThresholdRequirements(
      expression.prerequisites
    );

    // 3.5. Partition prototypes by direction - only HIGH prototypes have gates enforced
    const { highPrototypes, lowPrototypes } =
      this.#partitionPrototypesByDirection(requirements);

    this.#logger.debug(
      `PathSensitiveAnalyzer: HIGH prototypes (gates enforced): ${[...highPrototypes].join(', ') || 'none'}`
    );
    this.#logger.debug(
      `PathSensitiveAnalyzer: LOW prototypes (gates ignored): ${[...lowPrototypes].join(', ') || 'none'}`
    );

    // 4. For each branch, compute axis intervals and detect issues
    // CRITICAL: Only compute intervals for HIGH-threshold prototypes
    // LOW-threshold prototypes are expected to be inactive (gated), so their gates don't apply
    branches = branches.map((branch) => {
      // Filter to only prototypes that are both in this branch AND have HIGH threshold
      const activePrototypesInBranch = branch.requiredPrototypes.filter((p) =>
        highPrototypes.has(p)
      );
      const inactivePrototypesInBranch = branch.requiredPrototypes.filter((p) =>
        lowPrototypes.has(p)
      );

      // Compute intervals ONLY for active (HIGH-threshold) prototypes
      const intervals = this.#computeIntervalsForPrototypes(
        activePrototypesInBranch,
        'emotion'
      );

      // Detect conflicts
      const conflicts = this.#detectConflicts(intervals);

      // Detect knife-edges (only for active prototypes)
      const knifeEdges = this.#detectKnifeEdges(
        intervals,
        activePrototypesInBranch,
        opts.knifeEdgeThreshold
      );

      // Update branch with computed data and prototype partitioning
      return branch
        .withPrototypePartitioning(
          activePrototypesInBranch,
          inactivePrototypesInBranch
        )
        .withAxisIntervals(intervals)
        .withConflicts(conflicts)
        .withKnifeEdges(knifeEdges);
    });

    // 5. Compute reachability for all branches
    const reachabilityByBranch = this.#computeReachabilityByBranch(
      branches,
      requirements,
      opts.knifeEdgeThreshold
    );

    this.#logger.debug(
      `PathSensitiveAnalyzer: ${branches.length} branches, ${reachabilityByBranch.length} reachability checks`
    );

    // Compute feasibility volume if requested (EXPDIAPATSENANA-009)
    const feasibilityVolume = opts.computeVolume
      ? this.#computeFeasibilityVolume(branches)
      : null;

    return new PathSensitiveResult({
      expressionId: expression.id,
      branches,
      reachabilityByBranch,
      feasibilityVolume,
    });
  }

  // =====================================================================
  // FEASIBILITY VOLUME METHODS (EXPDIAPATSENANA-009)
  // =====================================================================

  /**
   * Compute feasibility volume as the product of normalized interval widths.
   *
   * A volume of 0 means at least one axis is impossible.
   * A very small volume means technically possible but extremely unlikely.
   * Volume of 1 would mean no constraints at all.
   *
   * @private
   * @param {AnalysisBranch[]} branches
   * @returns {number} Maximum volume across all feasible branches (0-1 normalized)
   */
  #computeFeasibilityVolume(branches) {
    let maxVolume = 0;

    for (const branch of branches) {
      if (branch.isInfeasible) continue;

      const volume = this.#computeBranchVolume(branch);
      maxVolume = Math.max(maxVolume, volume);
    }

    return maxVolume;
  }

  /**
   * Compute volume for a single branch.
   * @private
   * @param {AnalysisBranch} branch
   * @returns {number}
   */
  #computeBranchVolume(branch) {
    const intervals = branch.axisIntervals;

    if (!intervals || intervals.size === 0) {
      return 1; // No constraints = full volume
    }

    let volume = 1;
    let constrainedAxes = 0;

    for (const [axis, interval] of intervals) {
      const width = interval.max - interval.min;

      // Skip if impossible (should already be flagged as infeasible)
      if (width < 0) return 0;

      // Normalize by axis total range
      const axisRange = this.#getAxisRange(axis);
      const normalizedWidth = width / axisRange;

      // Only count axes that are actually constrained (not full range)
      if (normalizedWidth < 0.99) {
        volume *= normalizedWidth;
        constrainedAxes++;
      }
    }

    // If no axes were actually constrained, full volume
    if (constrainedAxes === 0) {
      return 1;
    }

    return volume;
  }

  /**
   * Get the total range for an axis (for normalization).
   * Mood and sexual axes are normalized to [0, 1] internally.
   * @private
   * @param {string} axis
   * @returns {number}
   */
  // eslint-disable-next-line no-unused-vars
  #getAxisRange(axis) {
    // Could be extended to support different ranges per axis
    return 1.0;
  }

  /**
   * Interpret volume as a human-readable category.
   * @param {number} volume
   * @returns {{category: string, description: string, emoji: string}}
   */
  static interpretVolume(volume) {
    if (volume === 0) {
      return {
        category: 'impossible',
        description: 'Cannot trigger - constraints are contradictory',
        emoji: '🔴',
      };
    }

    if (volume < 0.001) {
      return {
        category: 'extremely_unlikely',
        description: 'Extremely unlikely to trigger naturally (<0.1% of state space)',
        emoji: '🟠',
      };
    }

    if (volume < 0.01) {
      return {
        category: 'very_unlikely',
        description: 'Very unlikely to trigger naturally (0.1-1% of state space)',
        emoji: '🟡',
      };
    }

    if (volume < 0.1) {
      return {
        category: 'unlikely',
        description: 'Unlikely to trigger naturally (1-10% of state space)',
        emoji: '🟡',
      };
    }

    if (volume < 0.5) {
      return {
        category: 'moderate',
        description: 'Moderate trigger likelihood (10-50% of state space)',
        emoji: '🟢',
      };
    }

    return {
      category: 'likely',
      description: 'Likely to trigger naturally (>50% of state space)',
      emoji: '🟢',
    };
  }

  /**
   * Build a tree structure representing the OR/AND logic.
   * @private
   * @param {Array} prerequisites
   * @returns {Object}
   */
  #buildBranchTree(prerequisites) {
    const tree = { type: 'root', children: [] };

    for (const prereq of prerequisites) {
      if (prereq?.logic) {
        tree.children.push(this.#parseLogicNode(prereq.logic));
      }
    }

    return tree;
  }

  /**
   * Parse a JSON Logic node into a tree structure.
   * @private
   * @param {*} logic
   * @returns {Object}
   */
  #parseLogicNode(logic) {
    if (!logic || typeof logic !== 'object') {
      return { type: 'leaf', logic, prototypes: [] };
    }

    if (logic.and) {
      return {
        type: 'and',
        children: logic.and.map((child) => this.#parseLogicNode(child)),
      };
    }

    if (logic.or) {
      return {
        type: 'or',
        children: logic.or.map((child) => this.#parseLogicNode(child)),
      };
    }

    // Leaf node (comparison, etc.) - extract prototype references
    const prototypes = this.#extractPrototypesFromLeaf(logic);
    return { type: 'leaf', logic, prototypes };
  }

  /**
   * Extract prototype IDs from a leaf node.
   * @private
   * @param {Object} logic
   * @returns {string[]}
   */
  #extractPrototypesFromLeaf(logic) {
    const prototypes = [];

    // Look for patterns like {"var": "emotions.flow"} or {"var": "sexualStates.aroused"}
    const varPath = this.#findVarPath(logic);
    if (varPath) {
      const parts = varPath.split('.');
      if (parts.length >= 2) {
        // emotions.flow -> flow, sexualStates.aroused -> aroused
        prototypes.push(parts[1]);
      }
    }

    return prototypes;
  }

  /**
   * Recursively find {"var": "..."} paths in logic.
   * @private
   * @param {*} obj
   * @returns {string|null}
   */
  #findVarPath(obj) {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.var && typeof obj.var === 'string') {
      return obj.var;
    }

    // Search in arrays and nested objects
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = this.#findVarPath(item);
          if (result) return result;
        }
      } else if (typeof value === 'object') {
        const result = this.#findVarPath(value);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Enumerate all paths through the logic tree.
   * At each OR node, create a separate branch for each child.
   * @private
   * @param {Object} tree
   * @param {number} maxBranches
   * @returns {AnalysisBranch[]}
   */
  #enumerateBranches(tree, maxBranches) {
    const branches = [];
    let branchCounter = 0;

    /**
     * Recursive enumeration helper - enumerates ALL paths without counting.
     * Limit enforcement happens AFTER enumeration to count actual final paths.
     * @param {Object} node
     * @param {string[]} currentPrototypes - Prototypes accumulated so far
     * @param {string} pathPrefix - Path identifier prefix
     * @param {string[]} pathDescriptors - Human-readable path descriptions
     * @returns {Array<{prototypes: string[], descriptors: string[]}>}
     */
    const enumeratePaths = (
      node,
      currentPrototypes,
      pathPrefix,
      pathDescriptors
    ) => {
      if (node.type === 'leaf') {
        // Leaf: add its prototypes to current path
        const newPrototypes = [...currentPrototypes, ...node.prototypes];
        return [{ prototypes: newPrototypes, descriptors: pathDescriptors }];
      }

      if (node.type === 'and' || node.type === 'root') {
        // AND/root: all children contribute to the same path
        let paths = [
          { prototypes: [...currentPrototypes], descriptors: [...pathDescriptors] },
        ];

        for (const child of node.children) {
          const newPaths = [];
          for (const path of paths) {
            const childResults = enumeratePaths(
              child,
              path.prototypes,
              pathPrefix,
              path.descriptors
            );
            newPaths.push(...childResults);
          }
          paths = newPaths;
        }

        return paths;
      }

      if (node.type === 'or') {
        // OR: fork into separate paths for each child
        const allPaths = [];

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          const childDescriptor = this.#generateBranchDescription(child);
          const newDescriptors = [...pathDescriptors, childDescriptor];

          const childPaths = enumeratePaths(
            child,
            [...currentPrototypes],
            `${pathPrefix}.${i}`,
            newDescriptors
          );

          allPaths.push(...childPaths);
        }

        return allPaths;
      }

      return [];
    };

    // Start enumeration - enumerate ALL paths first
    const paths = enumeratePaths(tree, [], '0', []);

    // Apply limit check AFTER enumeration against actual path count
    if (paths.length > maxBranches) {
      this.#logger.warn(
        `PathSensitiveAnalyzer: Branch limit (${maxBranches}) reached, ${paths.length} paths found`
      );
    }

    // Convert paths to AnalysisBranch instances
    for (const path of paths) {
      if (branches.length >= maxBranches) break;

      const description =
        path.descriptors.length > 0
          ? path.descriptors.join(' \u2192 ')
          : 'Single path (no OR branches)';

      // Deduplicate prototypes
      const uniquePrototypes = [...new Set(path.prototypes)];

      branches.push(
        new AnalysisBranch({
          branchId: `branch_${branchCounter++}`,
          description,
          requiredPrototypes: uniquePrototypes,
        })
      );
    }

    // If no branches were created (no OR nodes), create single branch with all prototypes
    if (branches.length === 0) {
      const allPrototypes = this.#collectAllPrototypes(tree);
      branches.push(
        new AnalysisBranch({
          branchId: 'branch_0',
          description: 'Single path (no OR branches)',
          requiredPrototypes: [...new Set(allPrototypes)],
        })
      );
    }

    return branches;
  }

  /**
   * Generate human-readable description for a branch node.
   * @private
   * @param {Object} node
   * @returns {string}
   */
  #generateBranchDescription(node) {
    if (node.type === 'leaf') {
      const prototypes = node.prototypes;
      if (prototypes.length > 0) {
        return `${prototypes.join('/')} path`;
      }
      return 'condition';
    }

    if (node.type === 'and') {
      const leafPrototypes = this.#collectAllPrototypes(node);
      if (leafPrototypes.length > 0) {
        return `${leafPrototypes.slice(0, 2).join('+')}${leafPrototypes.length > 2 ? '+...' : ''} path`;
      }
      return 'AND block';
    }

    if (node.type === 'or') {
      return 'nested OR';
    }

    return 'branch';
  }

  /**
   * Collect all prototypes from a subtree.
   * @private
   * @param {Object} node
   * @returns {string[]}
   */
  #collectAllPrototypes(node) {
    const prototypes = [];

    const collect = (n) => {
      if (n.type === 'leaf') {
        prototypes.push(...(n.prototypes || []));
      } else if (n.children) {
        for (const child of n.children) {
          collect(child);
        }
      }
    };

    collect(node);
    return prototypes;
  }

  // =====================================================================
  // CONSTRAINT ANALYSIS METHODS (EXPDIAPATSENANA-006)
  // =====================================================================

  /**
   * Compute axis intervals for a specific set of prototypes.
   * @private
   * @param {string[]} prototypeIds
   * @param {'emotion'|'sexual'} type
   * @returns {Map<string, AxisInterval>}
   */
  #computeIntervalsForPrototypes(prototypeIds, type) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    if (!lookup?.entries) {
      return new Map();
    }

    // Intervals are initialized on-demand as we encounter axes
    const intervals = new Map();

    // Apply gates only from the specified prototypes
    for (const prototypeId of prototypeIds) {
      const prototype = lookup.entries[prototypeId];
      if (!prototype?.gates) continue;

      for (const gateStr of prototype.gates) {
        try {
          const constraint = GateConstraint.parse(gateStr);
          const axis = constraint.axis;

          // Initialize interval for this axis if not present
          if (!intervals.has(axis)) {
            intervals.set(
              axis,
              type === 'emotion'
                ? AxisInterval.forMoodAxis()
                : AxisInterval.forSexualAxis()
            );
          }

          // Apply constraint using the GateConstraint API
          const currentInterval = intervals.get(axis);
          const newInterval = constraint.applyTo(currentInterval);
          intervals.set(axis, newInterval);
        } catch {
          // Skip malformed gate strings
          continue;
        }
      }
    }

    return intervals;
  }

  /**
   * Detect conflicts (empty intervals) in axis intervals.
   * @private
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {Array<{axis: string, message: string}>}
   */
  #detectConflicts(axisIntervals) {
    const conflicts = [];

    for (const [axis, interval] of axisIntervals) {
      if (interval.isEmpty()) {
        conflicts.push({
          axis,
          message: `Impossible constraint: ${axis} requires [${interval.min.toFixed(2)}, ${interval.max.toFixed(2)}]`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect knife-edge constraints (very narrow intervals).
   * @private
   * @param {Map<string, AxisInterval>} axisIntervals
   * @param {string[]} prototypeIds
   * @param {number} threshold
   * @returns {KnifeEdge[]}
   */
  #detectKnifeEdges(axisIntervals, prototypeIds, threshold) {
    const knifeEdges = [];

    for (const [axis, interval] of axisIntervals) {
      const width = interval.max - interval.min;

      // Skip empty intervals (already reported as conflicts)
      if (width < 0) continue;

      // Check for knife-edge (very narrow but not empty)
      if (width <= threshold && width >= 0) {
        knifeEdges.push(
          new KnifeEdge({
            axis,
            min: interval.min,
            max: interval.max,
            contributingPrototypes: this.#findContributingPrototypes(
              axis,
              prototypeIds
            ),
            contributingGates: this.#findContributingGates(axis, prototypeIds),
          })
        );
      }
    }

    return knifeEdges;
  }

  /**
   * Find prototypes that contribute constraints to an axis.
   * @private
   * @param {string} axis
   * @param {string[]} prototypeIds
   * @returns {string[]}
   */
  #findContributingPrototypes(axis, prototypeIds) {
    const contributors = [];
    const lookup = this.#dataRegistry.getLookupData('core:emotion_prototypes');

    if (!lookup?.entries) return contributors;

    for (const prototypeId of prototypeIds) {
      const prototype = lookup.entries[prototypeId];
      if (!prototype?.gates) continue;

      for (const gateStr of prototype.gates) {
        if (gateStr.includes(axis)) {
          contributors.push(prototypeId);
          break;
        }
      }
    }

    return contributors;
  }

  /**
   * Find gate strings that constrain an axis.
   * @private
   * @param {string} axis
   * @param {string[]} prototypeIds
   * @returns {string[]}
   */
  #findContributingGates(axis, prototypeIds) {
    const gates = [];
    const lookup = this.#dataRegistry.getLookupData('core:emotion_prototypes');

    if (!lookup?.entries) return gates;

    for (const prototypeId of prototypeIds) {
      const prototype = lookup.entries[prototypeId];
      if (!prototype?.gates) continue;

      for (const gateStr of prototype.gates) {
        if (gateStr.includes(axis)) {
          gates.push(`${prototypeId}: ${gateStr}`);
        }
      }
    }

    return gates;
  }

  /**
   * Calculate maximum achievable intensity for a prototype given axis intervals.
   * @private
   * @param {string} prototypeId
   * @param {'emotion'|'sexual'} type
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {number}
   */
  #calculateMaxIntensity(prototypeId, type, axisIntervals) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    if (!lookup?.entries?.[prototypeId]?.weights) {
      return 1.0; // No weights = unconstrained
    }

    const weights = lookup.entries[prototypeId].weights;
    let maxRawSum = 0;
    let weightSum = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const interval = axisIntervals.get(axis);
      const absWeight = Math.abs(weight);
      weightSum += absWeight;

      if (!interval) {
        // No constraint on this axis - assume best case for max intensity
        // For positive weight: best case is axis=1, contribution = w * 1 = |w| * 1
        // For negative weight: best case is axis=-1, contribution = w * (-1) = |w| * 1
        // Either way, best case contributes |w| * 1.0
        maxRawSum += absWeight * 1.0;
        continue;
      }

      // For positive weights, max axis value gives max contribution
      // For negative weights, min axis value gives max contribution
      // Note: Mood axes range [-1, 1], not [0, 1]
      if (weight > 0) {
        maxRawSum += absWeight * interval.max;
      } else {
        // For negative weight w (where w < 0):
        // contribution = w * axisValue
        // To maximize: choose minimum axisValue (most negative)
        // contribution = w * interval.min = -|w| * interval.min
        // We want to add the positive contribution: |w| * (-interval.min)
        maxRawSum += absWeight * -interval.min;
      }
    }

    if (weightSum === 0) return 1.0;
    return Math.min(1.0, Math.max(0, maxRawSum / weightSum));
  }

  /**
   * Calculate minimum achievable intensity for a prototype given axis intervals.
   * Used for LOW direction threshold checks - if minPossible >= threshold,
   * the LOW constraint is unreachable.
   * @private
   * @param {string} prototypeId
   * @param {'emotion'|'sexual'} type
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {number}
   */
  #calculateMinIntensity(prototypeId, type, axisIntervals) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    if (!lookup?.entries?.[prototypeId]?.weights) {
      return 0.0; // No weights = can go to 0
    }

    const weights = lookup.entries[prototypeId].weights;
    let minRawSum = 0;
    let weightSum = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const interval = axisIntervals.get(axis);
      const absWeight = Math.abs(weight);
      weightSum += absWeight;

      if (!interval) {
        // No constraint on this axis - assume worst case for min intensity
        // For positive weight: worst case is axis=-1, contribution = w * (-1) = -|w|
        // For negative weight: worst case is axis=1, contribution = w * 1 = -|w|
        // Either way, worst case contributes -|w|, but we track as 0 since intensity is clamped
        // Actually, for min calculation, worst case axis value gives minimum contribution
        // Positive: axis=-1 → contribution = |w| * (-1) (negative, clamped to 0)
        // Negative: axis=1 → contribution = -|w| * 1 (negative, clamped to 0)
        // So unconstrained axes contribute 0 to minRawSum (worst case = 0 contribution)
        continue;
      }

      // For positive weights, min axis value gives min contribution
      // For negative weights, max axis value gives min contribution
      // Note: Mood axes range [-1, 1], not [0, 1]
      if (weight > 0) {
        minRawSum += absWeight * interval.min;
      } else {
        // For negative weight w (where w < 0):
        // contribution = w * axisValue
        // To minimize: choose maximum axisValue (most positive)
        // contribution = w * interval.max = -|w| * interval.max
        // We add: |w| * (-interval.max)
        minRawSum += absWeight * -interval.max;
      }
    }

    if (weightSum === 0) return 0.0;
    return Math.min(1.0, Math.max(0, minRawSum / weightSum));
  }

  /**
   * Extract all threshold requirements from expression prerequisites.
   * @private
   * @param {Array} prerequisites
   * @returns {Array<{prototypeId: string, type: string, threshold: number}>}
   */
  #extractThresholdRequirements(prerequisites) {
    const requirements = [];

    for (const prereq of prerequisites || []) {
      this.#extractThresholdsFromLogic(prereq?.logic, requirements);
    }

    return requirements;
  }

  /**
   * Recursively extract threshold requirements from JSON Logic.
   * Now captures direction: 'high' for >= or >, 'low' for <= or <.
   * This is critical for correct gate filtering - prototypes with low thresholds
   * are expected to be inactive (gated), so their gates shouldn't constrain the axis space.
   *
   * @private
   * @param {*} logic
   * @param {Array<{prototypeId: string, type: string, threshold: number, direction: 'high'|'low'}>} requirements
   */
  #extractThresholdsFromLogic(logic, requirements) {
    if (!logic || typeof logic !== 'object') return;

    // Check for >= or > comparison with emotions/sexualStates (HIGH direction)
    if (logic['>='] || logic['>']) {
      const operator = logic['>='] ? '>=' : '>';
      const [left, right] = logic[operator] || logic['>'];
      if (left?.var && typeof right === 'number') {
        const varPath = left.var;
        const parts = varPath.split('.');

        if (parts.length >= 2) {
          const category = parts[0];
          const prototypeId = parts[1];

          if (category === 'emotions') {
            requirements.push({
              prototypeId,
              type: 'emotion',
              threshold: right,
              direction: 'high',
            });
          } else if (category === 'sexualStates') {
            requirements.push({
              prototypeId,
              type: 'sexual',
              threshold: right,
              direction: 'high',
            });
          }
        }
      }
    }

    // Check for <= or < comparison with emotions/sexualStates (LOW direction)
    if (logic['<='] || logic['<']) {
      const operator = logic['<='] ? '<=' : '<';
      const [left, right] = logic[operator] || logic['<'];
      if (left?.var && typeof right === 'number') {
        const varPath = left.var;
        const parts = varPath.split('.');

        if (parts.length >= 2) {
          const category = parts[0];
          const prototypeId = parts[1];

          if (category === 'emotions') {
            requirements.push({
              prototypeId,
              type: 'emotion',
              threshold: right,
              direction: 'low',
            });
          } else if (category === 'sexualStates') {
            requirements.push({
              prototypeId,
              type: 'sexual',
              threshold: right,
              direction: 'low',
            });
          }
        }
      }
    }

    // Recurse into and/or
    if (logic.and) {
      for (const clause of logic.and) {
        this.#extractThresholdsFromLogic(clause, requirements);
      }
    }

    if (logic.or) {
      for (const clause of logic.or) {
        this.#extractThresholdsFromLogic(clause, requirements);
      }
    }
  }

  /**
   * Check if a prototype can be INACTIVE (gates not satisfied) within given intervals.
   *
   * A prototype is inactive when any of its gates are not satisfied.
   * This method checks if the constrained intervals allow for at least one gate to fail.
   *
   * For example, if freeze has gate "threat >= 0.35" and the interval is [0.20, 1.0],
   * then threat can be 0.20 which violates the gate, making freeze inactive.
   *
   * @private
   * @param {string} prototypeId
   * @param {'emotion'|'sexual'} type
   * @param {Map<string, AxisInterval>} axisIntervals
   * @returns {boolean} True if the prototype can be inactive within the constraints
   */
  #canPrototypeBeInactive(prototypeId, type, axisIntervals) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);

    const prototype = lookup?.entries?.[prototypeId];
    if (!prototype?.gates || prototype.gates.length === 0) {
      // No gates = always active, cannot be inactive
      return false;
    }

    // Check each gate - if ANY gate can be violated within the intervals, prototype can be inactive
    for (const gateStr of prototype.gates) {
      try {
        const constraint = GateConstraint.parse(gateStr);
        const axis = constraint.axis;

        // Get the interval for this axis (default to full range if not constrained)
        let interval = axisIntervals.get(axis);
        if (!interval) {
          interval =
            type === 'emotion'
              ? AxisInterval.forMoodAxis()
              : AxisInterval.forSexualAxis();
        }

        // Check if this gate can be violated within the interval
        // Gate format: "axis >= value" or "axis <= value"
        const gateCanBeViolated = this.#canGateBeViolated(
          constraint,
          interval
        );

        if (gateCanBeViolated) {
          // At least one gate can be violated, so prototype can be inactive
          return true;
        }
      } catch {
        // Skip malformed gate strings
        continue;
      }
    }

    // All gates must be satisfied within the intervals - prototype must be active
    return false;
  }

  /**
   * Check if a gate constraint can be violated within an interval.
   *
   * @private
   * @param {GateConstraint} constraint
   * @param {AxisInterval} interval
   * @returns {boolean} True if the gate can be violated
   */
  #canGateBeViolated(constraint, interval) {
    const { operator, value } = constraint;

    // For ">=" gates: violated when axis < value
    // Can be violated if interval.min < value
    if (operator === '>=') {
      return interval.min < value;
    }

    // For "<=" gates: violated when axis > value
    // Can be violated if interval.max > value
    if (operator === '<=') {
      return interval.max > value;
    }

    // For ">" gates: violated when axis <= value
    // Can be violated if interval.min <= value
    if (operator === '>') {
      return interval.min <= value;
    }

    // For "<" gates: violated when axis >= value
    // Can be violated if interval.max >= value
    if (operator === '<') {
      return interval.max >= value;
    }

    // Unknown operator, assume can't be violated
    return false;
  }

  /**
   * Partition prototype IDs by their threshold direction.
   * Prototypes with HIGH direction (>= or >) have their gates enforced.
   * Prototypes with LOW direction (<= or <) have their gates ignored
   * because they're expected to be inactive/gated.
   *
   * @private
   * @param {Array<{prototypeId: string, direction: 'high'|'low'}>} requirements
   * @returns {{highPrototypes: Set<string>, lowPrototypes: Set<string>}}
   */
  #partitionPrototypesByDirection(requirements) {
    const highPrototypes = new Set();
    const lowPrototypes = new Set();

    for (const req of requirements) {
      if (req.direction === 'high') {
        highPrototypes.add(req.prototypeId);
      } else {
        lowPrototypes.add(req.prototypeId);
      }
    }

    return { highPrototypes, lowPrototypes };
  }

  /**
   * Compute reachability for all branches.
   * @private
   * @param {AnalysisBranch[]} branches
   * @param {Array} requirements
   * @param {number} knifeEdgeThreshold
   * @returns {BranchReachability[]}
   */
  #computeReachabilityByBranch(branches, requirements, knifeEdgeThreshold) {
    const results = [];

    for (const branch of branches) {
      if (branch.isInfeasible) {
        // Infeasible branches have all thresholds unreachable
        for (const req of requirements) {
          results.push(
            new BranchReachability({
              branchId: branch.branchId,
              branchDescription: branch.description,
              prototypeId: req.prototypeId,
              type: req.type,
              direction: req.direction,
              threshold: req.threshold,
              maxPossible: 0,
              minPossible: 1, // Worst case for infeasible branch
              knifeEdges: [],
            })
          );
        }
        continue;
      }

      // Get axis intervals for this branch (from HIGH prototypes only)
      const baseIntervals = branch.axisIntervals;

      for (const req of requirements) {
        const intervals = baseIntervals;

        // For LOW-direction prototypes, check if the prototype can be INACTIVE
        // (gates unsatisfied) within the current interval constraints.
        // If the prototype can be inactive, minPossible = 0, making the path reachable.
        let canBeInactive = false;
        if (req.direction === 'low') {
          canBeInactive = this.#canPrototypeBeInactive(
            req.prototypeId,
            req.type,
            baseIntervals
          );
        }

        // Calculate max and min achievable for this prototype in this branch
        const maxPossible = this.#calculateMaxIntensity(
          req.prototypeId,
          req.type,
          intervals
        );

        // For LOW prototypes, if they can be inactive (gates unsatisfied),
        // their minimum possible intensity is 0 (inactive emotion)
        let minPossible;
        if (canBeInactive) {
          minPossible = 0;
        } else {
          minPossible = this.#calculateMinIntensity(
            req.prototypeId,
            req.type,
            intervals
          );
        }

        // Find knife-edges relevant to this prototype
        const relevantKnifeEdges = branch.knifeEdges.filter((ke) => {
          // Check if this knife-edge affects the prototype's calculation
          const lookup = this.#dataRegistry.getLookupData(
            req.type === 'emotion'
              ? 'core:emotion_prototypes'
              : 'core:sexual_prototypes'
          );
          const weights = lookup?.entries?.[req.prototypeId]?.weights || {};
          return ke.axis in weights;
        });

        results.push(
          new BranchReachability({
            branchId: branch.branchId,
            branchDescription: branch.description,
            prototypeId: req.prototypeId,
            type: req.type,
            direction: req.direction,
            threshold: req.threshold,
            maxPossible,
            minPossible,
            knifeEdges: relevantKnifeEdges,
          })
        );
      }
    }

    return results;
  }
}

// Export default options for testing
PathSensitiveAnalyzer.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

export default PathSensitiveAnalyzer;
