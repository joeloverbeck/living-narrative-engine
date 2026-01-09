# EXPDIAPATSENANA-006: PathSensitiveAnalyzer Service - Constraint Analysis

## Summary

Extend the `PathSensitiveAnalyzer` service to compute per-branch constraint intervals, detect conflicts, identify knife-edge constraints, and calculate threshold reachability for each branch.

## Priority: High | Effort: Medium

## Rationale

Branch enumeration (EXPDIAPATSENANA-005) identifies the paths through OR branches. This ticket implements the analysis that makes path-sensitive reasoning valuable:
1. Compute axis intervals independently for each branch
2. Detect conflicts within each branch
3. Identify knife-edge (brittle) constraints
4. Calculate max achievable values per branch
5. Determine threshold reachability per branch

## Dependencies

- **EXPDIAPATSENANA-005** (PathSensitiveAnalyzer with branch enumeration)
- **EXPDIAPATSENANA-002** (KnifeEdge model)
- **EXPDIAPATSENANA-003** (BranchReachability model)
- Existing `GateConstraintAnalyzer` service (for constraint calculation logic)
- Existing `IntensityBoundsCalculator` service (for max value calculation)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` | **Modify** (add constraint analysis) |
| `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` | **Modify** (add constraint tests) |

## Out of Scope

- **DO NOT** implement feasibility volume calculation - that's EXPDIAPATSENANA-009
- **DO NOT** modify existing GateConstraintAnalyzer or IntensityBoundsCalculator
- **DO NOT** create UI components - that's EXPDIAPATSENANA-008
- **DO NOT** create integration tests - that's EXPDIAPATSENANA-007
- **DO NOT** modify the data models created in tickets 001-004

## Implementation Details

### Extended PathSensitiveAnalyzer Methods

Add the following private methods to `PathSensitiveAnalyzer.js`:

```javascript
/**
 * Compute axis intervals for a specific set of prototypes.
 * @private
 * @param {string[]} prototypeIds
 * @param {'emotion'|'sexual'} type
 * @returns {Map<string, AxisInterval>}
 */
#computeIntervalsForPrototypes(prototypeIds, type) {
  // Use existing GateConstraintAnalyzer logic but only for specified prototypes
  const lookupKey = type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
  const lookup = this.#dataRegistry.getLookupData(lookupKey);

  if (!lookup?.entries) {
    return new Map();
  }

  // Start with full intervals for all axes
  const intervals = this.#initializeAxisIntervals(type);

  // Apply gates only from the specified prototypes
  for (const prototypeId of prototypeIds) {
    const prototype = lookup.entries[prototypeId];
    if (!prototype?.gates) continue;

    for (const gateStr of prototype.gates) {
      const constraint = GateConstraint.parse(gateStr);
      if (constraint) {
        const axis = constraint.axis;
        if (intervals.has(axis)) {
          const newInterval = intervals.get(axis).applyConstraint(constraint);
          intervals.set(axis, newInterval);
        }
      }
    }
  }

  return intervals;
}

/**
 * Initialize axis intervals with full range.
 * @private
 * @param {'emotion'|'sexual'} type
 * @returns {Map<string, AxisInterval>}
 */
#initializeAxisIntervals(type) {
  const intervals = new Map();

  if (type === 'emotion') {
    // Mood axes: normalized to [0, 1] internally
    for (const axis of ['valence', 'energy', 'dominance', 'novelty', 'threat', 'engagement', 'arousal', 'agency_control']) {
      intervals.set(axis, AxisInterval.forMoodAxis(axis));
    }
  } else {
    // Sexual axes
    for (const axis of ['sex_excitation', 'sex_inhibition', 'baseline_libido']) {
      intervals.set(axis, AxisInterval.forSexualAxis(axis));
    }
  }

  return intervals;
}

/**
 * Detect conflicts (empty intervals) in axis intervals.
 * @private
 * @param {Map<string, AxisInterval>} axisIntervals
 * @returns {GateConflict[]}
 */
#detectConflicts(axisIntervals) {
  const conflicts = [];

  for (const [axis, interval] of axisIntervals) {
    if (interval.isEmpty) {
      conflicts.push({
        axis,
        message: `Impossible constraint: ${axis} requires [${interval.min}, ${interval.max}]`
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
      knifeEdges.push(new KnifeEdge({
        axis,
        min: interval.min,
        max: interval.max,
        contributingPrototypes: this.#findContributingPrototypes(axis, prototypeIds),
        contributingGates: this.#findContributingGates(axis, prototypeIds)
      }));
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
  const lookupKey = type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
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
      // No constraint on this axis - assume best case
      maxRawSum += absWeight * (weight > 0 ? 1.0 : 0.0);
      continue;
    }

    // For positive weights, max value gives max contribution
    // For negative weights, min value gives max contribution
    if (weight > 0) {
      maxRawSum += absWeight * interval.max;
    } else {
      maxRawSum += absWeight * (1 - interval.min); // Inverted contribution
    }
  }

  if (weightSum === 0) return 1.0;
  return Math.min(1.0, Math.max(0, maxRawSum / weightSum));
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
    this.#extractThresholdsFromLogic(prereq.logic, requirements);
  }

  return requirements;
}

/**
 * Recursively extract threshold requirements from JSON Logic.
 * @private
 * @param {*} logic
 * @param {Array} requirements
 */
#extractThresholdsFromLogic(logic, requirements) {
  if (!logic || typeof logic !== 'object') return;

  // Check for >= comparison with emotions/sexualStates
  if (logic['>=']) {
    const [left, right] = logic['>='];
    if (left?.var && typeof right === 'number') {
      const varPath = left.var;
      const parts = varPath.split('.');

      if (parts.length >= 2) {
        const category = parts[0];
        const prototypeId = parts[1];

        if (category === 'emotions') {
          requirements.push({ prototypeId, type: 'emotion', threshold: right });
        } else if (category === 'sexualStates') {
          requirements.push({ prototypeId, type: 'sexual', threshold: right });
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
        results.push(new BranchReachability({
          branchId: branch.branchId,
          branchDescription: branch.description,
          prototypeId: req.prototypeId,
          type: req.type,
          threshold: req.threshold,
          maxPossible: 0,
          knifeEdges: []
        }));
      }
      continue;
    }

    // Get axis intervals for this branch
    const intervals = branch.axisIntervals;

    for (const req of requirements) {
      // Calculate max achievable for this prototype in this branch
      const maxPossible = this.#calculateMaxIntensity(req.prototypeId, req.type, intervals);

      // Find knife-edges relevant to this prototype
      const relevantKnifeEdges = branch.knifeEdges.filter(ke => {
        // Check if this knife-edge affects the prototype's calculation
        const lookup = this.#dataRegistry.getLookupData(
          req.type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes'
        );
        const weights = lookup?.entries?.[req.prototypeId]?.weights || {};
        return ke.axis in weights;
      });

      results.push(new BranchReachability({
        branchId: branch.branchId,
        branchDescription: branch.description,
        prototypeId: req.prototypeId,
        type: req.type,
        threshold: req.threshold,
        maxPossible,
        knifeEdges: relevantKnifeEdges
      }));
    }
  }

  return results;
}
```

### Updated analyze() Method

Update the `analyze()` method to call the constraint analysis:

```javascript
analyze(expression, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!expression?.id) {
    throw new Error('PathSensitiveAnalyzer requires expression with id');
  }

  this.#logger.debug(`PathSensitiveAnalyzer: Analyzing ${expression.id}`);

  // 1. Build branch tree
  const branchTree = this.#buildBranchTree(expression.prerequisites || []);

  // 2. Enumerate branches
  const branches = this.#enumerateBranches(branchTree, opts.maxBranches);

  // 3. Extract all threshold requirements
  const requirements = this.#extractThresholdRequirements(expression.prerequisites);

  // 4. For each branch, compute axis intervals and detect issues
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];

    // Compute intervals for this branch's prototypes
    const intervals = this.#computeIntervalsForPrototypes(branch.requiredPrototypes, 'emotion');

    // Detect conflicts
    const conflicts = this.#detectConflicts(intervals);

    // Detect knife-edges
    const knifeEdges = this.#detectKnifeEdges(intervals, branch.requiredPrototypes, opts.knifeEdgeThreshold);

    // Update branch with computed data
    branches[i] = branch
      .withAxisIntervals(intervals)
      .withConflicts(conflicts)
      .withKnifeEdges(knifeEdges);
  }

  // 5. Compute reachability for all branches
  const reachabilityByBranch = this.#computeReachabilityByBranch(branches, requirements, opts.knifeEdgeThreshold);

  this.#logger.debug(`PathSensitiveAnalyzer: ${branches.length} branches, ${reachabilityByBranch.length} reachability checks`);

  return new PathSensitiveResult({
    expressionId: expression.id,
    branches,
    reachabilityByBranch,
    feasibilityVolume: null // Computed by EXPDIAPATSENANA-009
  });
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose
```

### Unit Test Coverage Requirements

**pathSensitiveAnalyzer.test.js (Constraint Analysis - new tests):**
- `#computeIntervalsForPrototypes()` returns intervals for specified prototypes only
- `#computeIntervalsForPrototypes()` does not include gates from other prototypes
- `#detectConflicts()` returns empty array when no conflicts
- `#detectConflicts()` detects empty intervals
- `#detectKnifeEdges()` returns empty array when no narrow intervals
- `#detectKnifeEdges()` detects intervals at threshold boundary
- `#detectKnifeEdges()` detects zero-width intervals
- `#detectKnifeEdges()` includes contributing prototypes and gates
- `#calculateMaxIntensity()` returns correct max for unconstrained axes
- `#calculateMaxIntensity()` returns reduced max for constrained axes
- `#extractThresholdRequirements()` extracts from nested AND blocks
- `#extractThresholdRequirements()` extracts from nested OR blocks
- `#extractThresholdRequirements()` handles emotion and sexual types
- Full analysis populates branch.axisIntervals
- Full analysis populates branch.conflicts
- Full analysis populates branch.knifeEdges
- Full analysis populates reachabilityByBranch
- Branch with conflicts has isInfeasible = true
- Reachability correctly calculates isReachable
- Reachability correctly calculates gap

### Invariants That Must Remain True

1. **Per-branch isolation** - Constraints from one branch don't affect another
2. **Knife-edge threshold respected** - Only intervals <= threshold flagged
3. **Max intensity in [0, 1]** - Always properly bounded
4. **Infeasible branches have empty reachability** - No false positives
5. **Original GateConstraintAnalyzer unchanged** - No modifications to existing service

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose

# Type checking
npm run typecheck

# Quick manual verification
node -e "
import('./src/expressionDiagnostics/services/PathSensitiveAnalyzer.js').then(PSA => {
  console.log('PathSensitiveAnalyzer loaded, methods:', Object.getOwnPropertyNames(PSA.default.prototype));
});
"
```

## Definition of Done

- [ ] Constraint analysis methods added to PathSensitiveAnalyzer
- [ ] `analyze()` method updated to perform full analysis
- [ ] Per-branch axis intervals computed correctly
- [ ] Conflict detection working
- [ ] Knife-edge detection working with configurable threshold
- [ ] Reachability calculated per branch
- [ ] Unit tests cover all new methods
- [ ] Tests verify isolation between branches
- [ ] All tests pass
- [ ] No modifications to existing GateConstraintAnalyzer or IntensityBoundsCalculator
