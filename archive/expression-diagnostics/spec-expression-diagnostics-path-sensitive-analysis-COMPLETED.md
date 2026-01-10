# Specification: Path-Sensitive OR-Branch Analysis for Expression Diagnostics

## Status: ✅ COMPLETED (All Tickets Implemented)

This specification has been fully implemented through the following tickets:

| Ticket | Title | Status |
|--------|-------|--------|
| EXPDIAPATSENANA-001 | Analysis Branch Model | ✅ Completed |
| EXPDIAPATSENANA-002 | Knife-Edge Model | ✅ Completed |
| EXPDIAPATSENANA-003 | Branch Reachability Model | ✅ Completed |
| EXPDIAPATSENANA-004 | Path-Sensitive Result Model | ✅ Completed |
| EXPDIAPATSENANA-005 | Path-Sensitive Analyzer - Branch Enumeration | ✅ Completed |
| EXPDIAPATSENANA-006 | Path-Sensitive Analyzer - Constraint Analysis | ✅ Completed |
| EXPDIAPATSENANA-007 | Integration Test - Flow Absorption | ✅ Completed |
| EXPDIAPATSENANA-008 | UI Integration - Branch Display | ✅ Completed |
| EXPDIAPATSENANA-009 | Feasibility Volume Calculation | ✅ Completed |

---

## Problem Statement

The current expression diagnostics system produces **false unreachable-threshold warnings** when analyzing expressions containing OR branches. The `GateConstraintAnalyzer` treats OR blocks as if all branches must be satisfied simultaneously (AND semantics), merging all gates from every branch.

### Originating Issue: `flow_absorption.expression.json`

The diagnostics reported:
```
Found 0 gate conflict(s) and 1 unreachable threshold(s).

Unreachable Thresholds
Prototype    Type    Required    Max Possible    Gap
flow    emotion    0.85    0.77    0.08
```

**Root Cause Analysis:**

The expression requires:
```json
{
  "and": [
    { ">=": [{"var": "emotions.flow"}, 0.70] },
    { "or": [
        { ">=": [{"var": "emotions.interest"}, 0.45] },
        { ">=": [{"var": "emotions.fascination"}, 0.45] },
        { ">=": [{"var": "emotions.entrancement"}, 0.40] }
    ]},
    // ... other conditions
    { ">=": [{"var": "emotions.flow"}, 0.85] }  // In second prerequisite
  ]
}
```

The analyzer merged ALL gates from `flow`, `interest`, `fascination`, AND `entrancement`:

| Emotion | Gate | Effect |
|---------|------|--------|
| flow | `engagement >= 0.40` | engagement ∈ [0.40, 1.0] |
| flow | `agency_control >= 0.10` | agency_control ∈ [0.10, 1.0] |
| interest | `engagement >= 0.20` | (redundant) |
| fascination | `engagement >= 0.35` | (tightens engagement) |
| fascination | `arousal >= 0.25` | arousal ∈ [0.25, 1.0] |
| entrancement | `engagement >= 0.45` | engagement ∈ [0.45, 1.0] |
| entrancement | `arousal >= 0.10, <= 0.60` | arousal ∈ [0.25, 0.60] |
| entrancement | `agency_control <= 0.10` | **agency_control ∈ [0.10, 0.10]** ← KNIFE-EDGE |

When all gates are merged, `agency_control` is forced to exactly **0.10** (from flow's `>= 0.10` AND entrancement's `<= 0.10`), and `arousal` is capped at **0.60**.

**Flow prototype weights:**
- engagement: 1.0, arousal: 0.5, valence: 0.5, agency_control: 0.4
- Sum of absolute weights: 2.4

**Calculation:**
```
maxRawSum = (1.0 × 1.0) + (0.5 × 0.60) + (0.5 × 1.0) + (0.4 × 0.10)
          = 1.0 + 0.30 + 0.50 + 0.04 = 1.84

max flow = 1.84 / 2.4 = 0.7666... (23/30)
```

**The semantic error:** The OR block only requires ONE of `interest`, `fascination`, OR `entrancement` to be high—not all three. If the user's character has high `interest` (without `entrancement`), then `agency_control` is NOT constrained to 0.10, `arousal` is NOT capped at 0.60, and `flow >= 0.85` IS reachable.

---

## Goal

Implement **path-sensitive static analysis** that correctly handles OR branches by:
1. Analyzing each OR branch independently
2. Reporting per-branch reachability rather than collapsed "impossible" warnings
3. Detecting knife-edge constraints that are technically satisfiable but brittle
4. Optionally computing "feasibility volume" to identify unlikely-to-trigger expressions

---

## Design

### 1. Core Concept: Path-Sensitive Constraint Propagation

Instead of merging all gates from an OR block into a single interval set, we will:

1. **Enumerate OR branches** at each OR node in the JSON Logic tree
2. **Fork the analysis context** for each branch
3. **Propagate constraints independently** down each path
4. **Aggregate results** to produce per-branch reachability reports

### 2. Data Models

#### 2.1 `AnalysisBranch` Model

```javascript
/**
 * Represents a single path through OR branches with its constraint state.
 */
class AnalysisBranch {
  /** @type {string} Unique branch identifier (e.g., "0.1.0" for nested paths) */
  branchId;

  /** @type {string} Human-readable description (e.g., "entrancement branch") */
  description;

  /** @type {Map<string, AxisInterval>} Axis intervals for this branch */
  axisIntervals;

  /** @type {string[]} Prototype IDs included in this branch */
  requiredPrototypes;

  /** @type {boolean} True if any axis interval is empty */
  isInfeasible;

  /** @type {GateConflict[]} Conflicts detected in this branch */
  conflicts;
}
```

#### 2.2 `BranchReachability` Model

```javascript
/**
 * Threshold reachability result for a specific branch.
 */
class BranchReachability {
  /** @type {string} Branch identifier */
  branchId;

  /** @type {string} Branch description */
  branchDescription;

  /** @type {string} Prototype ID being tested */
  prototypeId;

  /** @type {string} 'emotion' or 'sexual' */
  type;

  /** @type {number} Required threshold */
  threshold;

  /** @type {number} Maximum achievable in this branch */
  maxPossible;

  /** @type {boolean} True if threshold is reachable in this branch */
  isReachable;

  /** @type {number} Gap if unreachable (threshold - maxPossible) */
  gap;

  /** @type {KnifeEdge[]} Knife-edge constraints in this branch */
  knifeEdges;
}
```

#### 2.3 `KnifeEdge` Model

```javascript
/**
 * Describes a brittle constraint where the feasible interval is very narrow.
 */
class KnifeEdge {
  /** @type {string} Axis name */
  axis;

  /** @type {number} Interval minimum */
  min;

  /** @type {number} Interval maximum */
  max;

  /** @type {number} Width of the interval (max - min) */
  width;

  /** @type {string[]} Prototypes contributing to this knife-edge */
  contributingPrototypes;

  /** @type {string[]} Gate strings that created this knife-edge */
  contributingGates;
}
```

#### 2.4 `PathSensitiveResult` Model

```javascript
/**
 * Complete result of path-sensitive analysis.
 */
class PathSensitiveResult {
  /** @type {string} Expression ID */
  expressionId;

  /** @type {AnalysisBranch[]} All analyzed branches */
  branches;

  /** @type {number} Total number of branches analyzed */
  branchCount;

  /** @type {number} Number of feasible branches (no infeasibility) */
  feasibleBranchCount;

  /** @type {BranchReachability[]} Per-branch reachability for all thresholds */
  reachabilityByBranch;

  /** @type {boolean} True if ANY branch satisfies ALL thresholds */
  hasFullyReachableBranch;

  /** @type {string[]} Branch IDs where all thresholds are reachable */
  fullyReachableBranchIds;

  /** @type {KnifeEdge[]} All knife-edge constraints across all branches */
  allKnifeEdges;

  /** @type {number?} Overall feasibility volume (optional) */
  feasibilityVolume;
}
```

### 3. Service Architecture

#### 3.1 `PathSensitiveAnalyzer` Service

**File:** `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js`

**Responsibilities:**
- Parse JSON Logic tree and identify OR nodes
- Enumerate all execution paths through OR branches
- Fork constraint context at OR nodes
- Delegate constraint calculation to existing services
- Aggregate branch results

**Interface:**
```javascript
class PathSensitiveAnalyzer {
  /**
   * Analyze expression with path-sensitive OR handling.
   *
   * @param {object} expression - Expression with prerequisites
   * @param {object} options - Analysis options
   * @param {number} [options.maxBranches=100] - Limit for branch explosion
   * @param {number} [options.knifeEdgeThreshold=0.02] - Width below which an interval is "knife-edge"
   * @returns {PathSensitiveResult}
   */
  analyze(expression, options = {}) { /* ... */ }
}
```

**Algorithm:**

```javascript
analyze(expression, options = {}) {
  const { maxBranches = 100, knifeEdgeThreshold = 0.02 } = options;

  // 1. Extract all prototype requirements from prerequisites
  const allRequirements = this.#extractAllRequirements(expression.prerequisites);

  // 2. Build branch tree by traversing logic and forking at OR nodes
  const branchTree = this.#buildBranchTree(expression.prerequisites);

  // 3. Enumerate all paths (with explosion protection)
  const branches = this.#enumerateBranches(branchTree, maxBranches);

  // 4. For each branch, compute axis intervals using existing GateConstraintAnalyzer logic
  for (const branch of branches) {
    branch.axisIntervals = this.#computeBranchIntervals(branch.requiredPrototypes);
    branch.conflicts = this.#detectBranchConflicts(branch.axisIntervals);
    branch.isInfeasible = branch.conflicts.length > 0;
    branch.knifeEdges = this.#detectKnifeEdges(branch.axisIntervals, knifeEdgeThreshold);
  }

  // 5. For each threshold requirement, check reachability per branch
  const reachabilityByBranch = this.#computeReachabilityByBranch(branches, allRequirements);

  // 6. Aggregate results
  return new PathSensitiveResult({
    expressionId: expression.id,
    branches,
    branchCount: branches.length,
    feasibleBranchCount: branches.filter(b => !b.isInfeasible).length,
    reachabilityByBranch,
    hasFullyReachableBranch: this.#hasFullyReachableBranch(branches, reachabilityByBranch),
    fullyReachableBranchIds: this.#getFullyReachableBranchIds(branches, reachabilityByBranch),
    allKnifeEdges: branches.flatMap(b => b.knifeEdges),
    feasibilityVolume: options.computeVolume ? this.#computeFeasibilityVolume(branches) : null,
  });
}
```

#### 3.2 Modifications to Existing Services

**GateConstraintAnalyzer:**
- Add `analyzePrototypeSet(prototypeIds, type)` method that computes intervals for a specific set of prototypes
- Current `analyze(expression)` becomes a wrapper that uses path-insensitive (AND-all) semantics for backward compatibility

**IntensityBoundsCalculator:**
- No changes needed; already accepts `axisConstraints` parameter

**ExpressionDiagnosticsController:**
- Add UI for path-sensitive analysis results
- Display per-branch reachability table
- Highlight knife-edge warnings

### 4. Branch Enumeration Algorithm

```javascript
/**
 * Build a tree structure representing the OR/AND logic.
 */
#buildBranchTree(prerequisites) {
  const tree = { type: 'root', children: [] };

  for (const prereq of prerequisites) {
    tree.children.push(this.#parseLogicNode(prereq.logic));
  }

  return tree;
}

#parseLogicNode(logic) {
  if (!logic || typeof logic !== 'object') return { type: 'leaf', logic };

  if (logic.and) {
    return {
      type: 'and',
      children: logic.and.map(child => this.#parseLogicNode(child)),
    };
  }

  if (logic.or) {
    return {
      type: 'or',
      children: logic.or.map(child => this.#parseLogicNode(child)),
    };
  }

  // Leaf node (comparison, etc.)
  return { type: 'leaf', logic };
}

/**
 * Enumerate all paths through the logic tree.
 * At each OR node, create a separate branch for each child.
 */
#enumerateBranches(tree, maxBranches) {
  const branches = [];

  function enumerate(node, currentPath, branchIdPrefix) {
    if (branches.length >= maxBranches) return;

    if (node.type === 'leaf') {
      // Extract prototypes from this leaf
      const protos = extractPrototypesFromLeaf(node.logic);
      currentPath.push(...protos);
      return;
    }

    if (node.type === 'and' || node.type === 'root') {
      // AND: all children contribute to the same branch
      for (const child of node.children) {
        enumerate(child, currentPath, branchIdPrefix);
      }
      return;
    }

    if (node.type === 'or') {
      // OR: fork into separate branches
      for (let i = 0; i < node.children.length; i++) {
        if (branches.length >= maxBranches) return;

        const forkPath = [...currentPath];
        enumerate(node.children[i], forkPath, `${branchIdPrefix}.${i}`);

        branches.push(new AnalysisBranch({
          branchId: `${branchIdPrefix}.${i}`,
          description: generateBranchDescription(node.children[i]),
          requiredPrototypes: forkPath,
        }));
      }
      return;
    }
  }

  enumerate(tree, [], '0');

  // If no OR nodes, there's exactly one branch with all prototypes
  if (branches.length === 0) {
    const allProtos = [];
    enumerate(tree, allProtos, '0');
    branches.push(new AnalysisBranch({
      branchId: '0',
      description: 'Single path (no OR branches)',
      requiredPrototypes: allProtos,
    }));
  }

  return branches;
}
```

### 5. Knife-Edge Detection

```javascript
/**
 * Detect intervals that are technically satisfiable but extremely narrow.
 *
 * @param {Map<string, AxisInterval>} axisIntervals
 * @param {number} threshold - Width below which to warn (default: 0.02)
 * @returns {KnifeEdge[]}
 */
#detectKnifeEdges(axisIntervals, threshold = 0.02) {
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
        width,
        contributingPrototypes: this.#findContributingPrototypes(axis, interval),
        contributingGates: this.#findContributingGates(axis, interval),
      }));
    }
  }

  return knifeEdges;
}
```

### 6. Feasibility Volume (Optional Enhancement)

```javascript
/**
 * Compute a crude "feasible volume" measure as the product of interval widths.
 *
 * A volume of 0 means impossible.
 * A very small volume means technically possible but extremely unlikely.
 *
 * @param {AnalysisBranch[]} branches
 * @returns {number} Maximum volume across all feasible branches (0-1 normalized)
 */
#computeFeasibilityVolume(branches) {
  let maxVolume = 0;

  for (const branch of branches) {
    if (branch.isInfeasible) continue;

    let volume = 1;
    for (const [axis, interval] of branch.axisIntervals) {
      const width = interval.max - interval.min;
      const normalizedWidth = width / this.#getAxisRange(axis); // Normalize by axis total range
      volume *= normalizedWidth;
    }

    // Normalize to account for unconstrained axes (assume width = 1)
    maxVolume = Math.max(maxVolume, volume);
  }

  return maxVolume;
}
```

---

## UI Updates

### Enhanced Threshold Results Display

Replace the current single-table display with a per-branch breakdown:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Threshold Reachability Analysis                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Analyzing 3 OR branches...                                                   │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Branch 1: interest path                                          ✅     │ │
│ │ Required prototypes: flow, interest                                     │ │
│ │ All thresholds reachable                                                │ │
│ │ No knife-edge constraints                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Branch 2: fascination path                                       ✅     │ │
│ │ Required prototypes: flow, fascination                                  │ │
│ │ All thresholds reachable                                                │ │
│ │ No knife-edge constraints                                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Branch 3: entrancement path                                      ⚠️     │ │
│ │ Required prototypes: flow, entrancement                                 │ │
│ │ ┌───────────────────────────────────────────────────────────────────┐   │ │
│ │ │ Unreachable Thresholds                                            │   │ │
│ │ │ Prototype │ Required │ Max Possible │ Gap                         │   │ │
│ │ │ flow      │ 0.85     │ 0.77         │ 0.08                        │   │ │
│ │ └───────────────────────────────────────────────────────────────────┘   │ │
│ │ ┌───────────────────────────────────────────────────────────────────┐   │ │
│ │ │ ⚠️ Knife-Edge Constraints                                         │   │ │
│ │ │ Axis           │ Interval      │ Width │ Cause                    │   │ │
│ │ │ agency_control │ [0.10, 0.10]  │ 0.00  │ flow ≥ 0.10 ∧ entr ≤ 0.10│   │ │
│ │ │ arousal        │ [0.25, 0.60]  │ 0.35  │ fascination ∧ entrancement│   │ │
│ │ └───────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ Summary: 2 of 3 branches are fully reachable                          🟢    │
│ Expression CAN trigger via interest or fascination paths                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## DI Registration

**File:** `src/dependencyInjection/tokens/tokens-diagnostics.js`

Add:
```javascript
IPathSensitiveAnalyzer: 'IPathSensitiveAnalyzer',
```

**File:** `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

Add:
```javascript
import PathSensitiveAnalyzer from '../../expressionDiagnostics/services/PathSensitiveAnalyzer.js';

container.register(
  diagnosticsTokens.IPathSensitiveAnalyzer,
  (c) => new PathSensitiveAnalyzer({
    dataRegistry: c.resolve(tokens.IDataRegistry),
    gateConstraintAnalyzer: c.resolve(diagnosticsTokens.IGateConstraintAnalyzer),
    intensityBoundsCalculator: c.resolve(diagnosticsTokens.IIntensityBoundsCalculator),
    logger: c.resolve(tokens.ILogger),
  })
);
```

---

## Testing Requirements

### 1. Unit Tests

**File:** `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js`

```javascript
describe('PathSensitiveAnalyzer', () => {
  describe('Branch enumeration', () => {
    it('should enumerate single branch when no OR nodes present');
    it('should enumerate N branches for single OR with N children');
    it('should enumerate N*M branches for nested ORs');
    it('should respect maxBranches limit');
    it('should generate meaningful branch descriptions');
  });

  describe('Per-branch constraint calculation', () => {
    it('should compute independent intervals for each branch');
    it('should not merge constraints across OR branches');
    it('should correctly merge constraints within AND blocks');
  });

  describe('Reachability by branch', () => {
    it('should report reachable in branch with compatible gates');
    it('should report unreachable in branch with conflicting gates');
    it('should identify fully reachable branches');
  });

  describe('Knife-edge detection', () => {
    it('should detect zero-width intervals');
    it('should detect narrow intervals below threshold');
    it('should not flag intervals above threshold');
    it('should track contributing prototypes and gates');
  });

  describe('Feasibility volume', () => {
    it('should return 0 for infeasible branches');
    it('should return smaller values for tighter constraints');
    it('should return larger values for looser constraints');
  });
});
```

### 2. Integration Test for Originating Issue

**File:** `tests/integration/expressionDiagnostics/flowAbsorptionAnalysis.integration.test.js`

```javascript
describe('flow_absorption.expression.json path-sensitive analysis', () => {
  /**
   * This test validates the fix for the false-positive unreachable threshold warning.
   *
   * The expression requires:
   *   - flow >= 0.70 (always)
   *   - (interest >= 0.45 OR fascination >= 0.45 OR entrancement >= 0.40)
   *   - flow >= 0.85 (in second prerequisite OR block)
   *
   * Old behavior: Merged all OR branch gates, incorrectly reporting flow max = 0.7666...
   * New behavior: Analyzes each branch independently, correctly identifying:
   *   - interest branch: flow >= 0.85 IS reachable
   *   - fascination branch: flow >= 0.85 IS reachable
   *   - entrancement branch: flow >= 0.85 is NOT reachable (knife-edge on agency_control)
   */
  it('should correctly identify that flow >= 0.85 IS reachable via interest/fascination branches', async () => {
    const container = await setupTestContainer();
    const analyzer = container.resolve(diagnosticsTokens.IPathSensitiveAnalyzer);
    const expressionRegistry = container.resolve(tokens.IExpressionRegistry);

    const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');
    const result = analyzer.analyze(expression);

    // The expression should have reachable branches
    expect(result.hasFullyReachableBranch).toBe(true);
    expect(result.fullyReachableBranchIds.length).toBeGreaterThanOrEqual(2);

    // Find the entrancement branch
    const entrancementBranch = result.branches.find(b =>
      b.requiredPrototypes.includes('entrancement')
    );

    // Entrancement branch should show flow >= 0.85 as unreachable
    const entrancementReachability = result.reachabilityByBranch.find(r =>
      r.branchId === entrancementBranch.branchId &&
      r.prototypeId === 'flow' &&
      r.threshold === 0.85
    );
    expect(entrancementReachability.isReachable).toBe(false);
    expect(entrancementReachability.maxPossible).toBeCloseTo(0.7666, 2);

    // Entrancement branch should have knife-edge on agency_control
    expect(entrancementBranch.knifeEdges.some(ke =>
      ke.axis === 'agency_control' && ke.width === 0
    )).toBe(true);

    // Interest and fascination branches should show flow >= 0.85 as reachable
    const interestBranch = result.branches.find(b =>
      b.requiredPrototypes.includes('interest') &&
      !b.requiredPrototypes.includes('entrancement')
    );
    const interestReachability = result.reachabilityByBranch.find(r =>
      r.branchId === interestBranch.branchId &&
      r.prototypeId === 'flow' &&
      r.threshold === 0.85
    );
    expect(interestReachability.isReachable).toBe(true);
  });

  it('should produce different results than path-insensitive analysis', async () => {
    const container = await setupTestContainer();
    const pathSensitiveAnalyzer = container.resolve(diagnosticsTokens.IPathSensitiveAnalyzer);
    const gateAnalyzer = container.resolve(diagnosticsTokens.IGateConstraintAnalyzer);
    const boundsCalculator = container.resolve(diagnosticsTokens.IIntensityBoundsCalculator);
    const expressionRegistry = container.resolve(tokens.IExpressionRegistry);

    const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

    // Path-insensitive analysis (current behavior)
    const gateResult = gateAnalyzer.analyze(expression);
    const pathInsensitiveIssues = boundsCalculator.analyzeExpression(
      expression,
      gateResult.axisIntervals
    );

    // Path-sensitive analysis (new behavior)
    const pathSensitiveResult = pathSensitiveAnalyzer.analyze(expression);

    // Path-insensitive incorrectly reports flow >= 0.85 as unreachable
    expect(pathInsensitiveIssues.some(i =>
      i.prototypeId === 'flow' &&
      i.threshold === 0.85 &&
      !i.isReachable
    )).toBe(true);

    // Path-sensitive correctly identifies it IS reachable via some branches
    expect(pathSensitiveResult.hasFullyReachableBranch).toBe(true);
  });
});
```

### 3. Additional Test Fixtures

**File:** `tests/fixtures/expressionDiagnostics/pathSensitive/`

```
orBranchAllReachable.expression.json
  - OR with 3 branches, all thresholds reachable in all branches

orBranchNoneReachable.expression.json
  - OR with 3 branches, NO thresholds reachable in any branch

orBranchMixedReachable.expression.json
  - OR with 3 branches, some reachable, some not (like flow_absorption)

nestedOrBranches.expression.json
  - Nested OR blocks to test branch explosion handling

knifeEdgeOnly.expression.json
  - Gates that create knife-edge but not impossibility

branchExplosion.expression.json
  - Many nested ORs to test maxBranches limit
```

### 4. UI Component Tests

**File:** `tests/unit/domUI/expression-diagnostics/branchReachabilityDisplay.test.js`

```javascript
describe('Branch Reachability Display', () => {
  it('should render branch cards for each analyzed branch');
  it('should show green checkmark for fully reachable branches');
  it('should show warning icon for branches with unreachable thresholds');
  it('should display knife-edge warnings with contributing gates');
  it('should show summary count of reachable branches');
});
```

---

## Implementation Phases

### Phase 1: Core Path-Sensitive Analyzer (MVP)

1. Create `AnalysisBranch`, `BranchReachability`, `KnifeEdge`, `PathSensitiveResult` models
2. Implement `PathSensitiveAnalyzer.analyze()` with branch enumeration
3. Implement knife-edge detection
4. Add DI registration
5. Write unit tests for branch enumeration and constraint calculation
6. Write integration test for `flow_absorption.expression.json`

**Deliverable:** Path-sensitive analysis correctly identifies reachable branches.

### Phase 2: UI Integration

7. Update `ExpressionDiagnosticsController` to use `PathSensitiveAnalyzer`
8. Create branch card UI components
9. Add knife-edge warning display
10. Maintain backward compatibility (show old-style results too, for comparison)

**Deliverable:** Users can see per-branch reachability in the diagnostics UI.

### Phase 3: Feasibility Volume (Optional)

11. Implement `#computeFeasibilityVolume()` method
12. Add volume indicator to UI (e.g., "Branch has very small feasibility volume")
13. Write tests for volume calculation

**Deliverable:** Users get warnings about technically-possible-but-unlikely expressions.

---

## Backward Compatibility

The existing `GateConstraintAnalyzer` and `IntensityBoundsCalculator` services will remain unchanged. The new `PathSensitiveAnalyzer` will be an additional analysis layer that provides more accurate results for expressions with OR branches.

The UI will show:
1. **Path-sensitive results** (new, primary)
2. **Path-insensitive results** (legacy, collapsed/secondary, for comparison)

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/expressionDiagnostics/models/AnalysisBranch.js` | Branch constraint state model |
| `src/expressionDiagnostics/models/BranchReachability.js` | Per-branch reachability result |
| `src/expressionDiagnostics/models/KnifeEdge.js` | Narrow interval warning model |
| `src/expressionDiagnostics/models/PathSensitiveResult.js` | Complete analysis result |
| `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` | Core path-sensitive analysis |
| `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` | Unit tests |
| `tests/unit/expressionDiagnostics/models/AnalysisBranch.test.js` | Model tests |
| `tests/unit/expressionDiagnostics/models/BranchReachability.test.js` | Model tests |
| `tests/unit/expressionDiagnostics/models/KnifeEdge.test.js` | Model tests |
| `tests/unit/expressionDiagnostics/models/PathSensitiveResult.test.js` | Model tests |
| `tests/integration/expressionDiagnostics/flowAbsorptionAnalysis.integration.test.js` | Originating issue test |
| `tests/fixtures/expressionDiagnostics/pathSensitive/*.expression.json` | Test fixtures |

### Modified Files

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/models/index.js` | Export new models |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Add `IPathSensitiveAnalyzer` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Register new service |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Use path-sensitive analyzer |
| `expression-diagnostics.html` | Add UI for branch display |
| `css/expression-diagnostics.css` | Style branch cards |

---

## Verification Checklist

After implementation, verify:

- [x] `npm run build` succeeds with no errors
- [x] `npm run typecheck` passes
- [x] `npm run test:unit` - all new tests pass
- [x] `npm run test:integration` - `flowAbsorptionAnalysis.integration.test.js` passes
- [x] Manual: Analyze `flow_absorption.expression.json` → shows 2+ reachable branches, 1 with knife-edge
- [x] Manual: Entrancement branch shows `flow >= 0.85` as unreachable with max 0.77
- [x] Manual: Interest/fascination branches show `flow >= 0.85` as reachable
- [x] Manual: Knife-edge warning displayed for `agency_control` in entrancement branch
- [x] Manual: Summary shows "Expression CAN trigger" (not "Impossible")

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Branch explosion limit | 100 branches default | Prevents exponential blowup with deeply nested ORs; configurable for power users |
| Knife-edge threshold | 0.02 (normalized width) | ~2% of axis range; catches "technically possible but brittle" constraints |
| Backward compatibility | Keep old analyzers, add new one | Allows comparison; doesn't break existing behavior |
| Feasibility volume | Optional (Phase 3) | Useful but computationally expensive; defer to later phase |
| OR semantics | Only fork at OR nodes | AND nodes merge constraints as expected; matches JSON Logic semantics |
