# Monte Carlo Simulation Advanced Metrics

## Goal

Enhance the Monte Carlo simulation output in `expression-diagnostics.html` with advanced per-clause metrics that directly inform prerequisite threshold tuning. The current output shows failure rate and average violation, but lacks the diagnostic depth needed to determine *whether* threshold adjustments will help and *which* clauses are the true blockers.

## Motivation

When tuning expression prerequisites, content creators need answers to:
1. **Magnitude confidence**: Is the average violation representative, or are there outliers skewing it?
2. **Tuning viability**: Will lowering a threshold actually help, or are values nowhere near it?
3. **True blockers**: Which clause is the *final* obstacle when everything else passes?
4. **Attainability**: Can the required value ever be reached in practice?

Current metrics only partially answer these. This spec adds four targeted metrics to complete the picture.

## Current Implementation (Reference)

### Key Files
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` - Core simulation logic
- `src/expressionDiagnostics/models/HierarchicalClauseNode.js` - Per-clause tracking tree
- `src/expressionDiagnostics/services/FailureExplainer.js` - Human-readable explanations
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` - UI orchestration

### Current Per-Clause Metrics
```javascript
{
  clauseDescription: string,     // Human-readable condition
  clauseIndex: number,           // Position in prerequisites array
  failureCount: number,          // Raw failure count
  failureRate: number,           // failureCount / sampleCount
  averageViolation: number,      // mean(violation) among failures
  hierarchicalBreakdown: object  // Tree structure for compound clauses
}
```

### Current Tracking (HierarchicalClauseNode)
- `#failureCount` - Number of failed evaluations
- `#violationSum` - Sum of violations (for mean calculation)
- `#evaluationCount` - Total evaluations

## Proposed Metrics

### 1. Violation Percentiles (p50, p90)

**What**: Median and 90th percentile of violation magnitude among failed samples.

**Why**: Mean violation is misleading when failures are heavy-tailed. A few large violations can inflate the mean while most failures are minor. Percentiles reveal the *typical* shortfall (p50) and the *worst-case* shortfall (p90).

**Display Format**:
```
Δ: mean 0.08 | p50 0.02 | p90 0.21
```

**Interpretation**:
- `p50 << mean`: Outliers are skewing the mean; most failures are minor
- `p50 ≈ mean`: Violations are normally distributed; mean is trustworthy
- `p90 >> mean`: Heavy tail; some samples fail badly

**Implementation**:
- Track violation values in an array instead of just summing
- Compute percentiles at finalization time
- Memory: ~8 bytes × failureCount (acceptable for 10k-100k samples)

### 2. Near-Miss Rate

**What**: Percentage of samples within ε of the threshold (both passing and failing sides).

**Why**: Answers "will lowering this threshold help?" If many samples are barely failing, a small threshold adjustment yields large trigger rate gains. If samples are nowhere near the threshold, tuning won't help—you need upstream changes (prototypes, gates).

**Display Format**:
```
near-miss(ε=0.05): 14.6%
```

**Epsilon Selection**:
- For emotion thresholds [0, 1]: ε = 0.05 (5% of range)
- For mood axes [-100, 100]: ε = 5 (2.5% of range)
- Could be configurable per domain or auto-detected from threshold scale

**Interpretation**:
- High near-miss rate (>10%): Threshold tweaks are effective
- Low near-miss rate (<2%): Values are far from threshold; tweak prototypes/gates instead

**Implementation**:
- During evaluation, track |actual - threshold| for each sample
- Count samples where |actual - threshold| < ε
- Requires access to raw values, not just pass/fail

### 3. Last-Mile Blocker Rate

**What**: Failure rate of this clause *among samples where all other clauses pass*.

**Why**: A clause may have high overall failure rate but be irrelevant because other clauses fail first. Conversely, a clause with low overall failure rate could be the "final boss" blocking most near-triggers. This is the most actionable metric for prioritization.

**Display Format**:
```
fail_all: 47%
fail_when_others_pass: 82% ← tune this first
```

**Interpretation**:
- `fail_when_others_pass >> fail_all`: This clause is the decisive blocker
- `fail_when_others_pass << fail_all`: Other clauses are masking this one
- `fail_when_others_pass ≈ 0`: This clause never blocks alone (redundant?)

**Implementation**:
- Track "other clauses all passed" flag during evaluation
- Increment `lastMileFailCount` when this clause fails AND others passed
- Count `othersPassedCount` (samples where all clauses except this one passed or where this is the only clause)
- `lastMileRate = lastMileFailCount / othersPassedCount`

### 4. Max Observed Value

**What**: Maximum value observed for the clause's primary variable across all samples.

**Why**: Static analysis (`IntensityBoundsCalculator`) already detects theoretically unreachable thresholds. This empirical metric confirms whether values *actually* approach the threshold in simulated conditions. If `max_observed < threshold`, the threshold is effectively unreachable.

**Display Format**:
```
observed: max 0.52 | p99 0.48 | threshold 0.55 → ceiling effect detected
```

**Interpretation**:
- `max >= threshold`: Threshold is attainable (at least in extreme cases)
- `max < threshold` with small gap: Near-misses possible, may need prototype tuning
- `max << threshold`: Threshold is unreachable; redesign required

**Implementation**:
- Track max value per clause during evaluation
- Optionally track p99 for robust ceiling estimate
- Compare against clause threshold at finalization

## Data Model Changes

### HierarchicalClauseNode (Enhanced)

```javascript
class HierarchicalClauseNode {
  // Existing fields
  #failureCount;
  #violationSum;
  #evaluationCount;

  // New fields
  #violationValues = [];        // Array for percentile calculation
  #nearMissCount = 0;           // Samples within ε of threshold
  #lastMileFailCount = 0;       // Failures when others passed
  #othersPassedCount = 0;       // Samples where all other clauses passed
  #maxObservedValue = -Infinity; // Maximum value seen
  #p99ObservedValue = null;     // 99th percentile (computed at finalization)
  #thresholdValue = null;       // Extracted threshold for comparison
}
```

### ClauseResult (Enhanced Output)

```javascript
{
  clauseDescription: string,
  clauseIndex: number,
  failureCount: number,
  failureRate: number,

  // Existing
  averageViolation: number,

  // NEW: Violation percentiles
  violationP50: number,         // Median violation
  violationP90: number,         // 90th percentile violation

  // NEW: Near-miss analysis
  nearMissRate: number,         // Samples within ε of threshold
  nearMissEpsilon: number,      // The ε value used

  // NEW: Last-mile analysis
  lastMileFailRate: number,     // Failure rate when others pass
  lastMileContext: {
    othersPassedCount: number,  // Samples where other clauses passed
    lastMileFailCount: number   // Failures among those samples
  },

  // NEW: Ceiling analysis
  maxObserved: number,          // Maximum value seen
  p99Observed: number,          // 99th percentile value
  thresholdValue: number,       // The threshold being compared against
  ceilingGap: number,           // threshold - maxObserved (negative = attainable)

  hierarchicalBreakdown: object
}
```

## Implementation Plan

### Phase 1: Core Data Collection

1. **Modify HierarchicalClauseNode**
   - Add new tracking fields
   - Extend `recordEvaluation()` to accept raw value
   - Add methods: `recordNearMiss()`, `recordLastMileFail()`, `recordObservedValue()`
   - Add finalization methods for percentile calculation

2. **Modify MonteCarloSimulator**
   - Extract threshold values from clause logic during tree building
   - Pass raw values to tracking methods during evaluation
   - Track "others passed" state for last-mile calculation
   - Calculate epsilon per clause based on domain/scale

3. **Modify #estimateViolation / #evaluateLeafCondition**
   - Return both pass/fail AND the raw actual value
   - Extract threshold value for comparison

### Phase 2: Calculation Logic

1. **Percentile Calculation**
   - Implement efficient percentile algorithm (quickselect or sorted array)
   - Handle edge cases: no failures, single failure
   - Memory optimization: consider sampling for very high failure counts (>100k)

2. **Near-Miss Calculation**
   - Define domain-specific epsilon values (configurable)
   - Count samples within ε zone
   - Handle compound clauses (use leaf-level analysis)

3. **Last-Mile Calculation**
   - Track per-sample "all others passed" state
   - Handle single-clause prerequisites (100% last-mile by definition)
   - Handle hierarchical AND/OR structures appropriately

### Phase 3: Output Integration

1. **Extend #finalizeClauseResults**
   - Compute all new metrics at finalization
   - Include new fields in output object

2. **Extend FailureExplainer**
   - Use new metrics in explanation generation
   - Prioritize clauses by `lastMileFailRate` for "tune this first" recommendations
   - Add ceiling detection warnings

3. **Update UI Display**
   - Add columns/sections for new metrics in blockers table
   - Add visual indicators (color coding for near-miss, ceiling warnings)
   - Consider collapsible "advanced metrics" section

## Edge Cases

### Single-Clause Prerequisites
- Last-mile rate = failure rate (the clause is always the "last mile")
- Display differently to avoid confusion

### Compound Clauses (AND/OR)
- Report metrics at leaf level where thresholds exist
- Aggregate metrics for parent nodes may be less meaningful

### Zero Failures
- All percentiles = 0 or N/A
- Near-miss rate still meaningful (shows how close passing samples were)
- Max observed still valuable for ceiling analysis

### Very High Failure Counts (>100k)
- Consider reservoir sampling for violation array
- Use approximate percentile algorithms (t-digest)
- Memory/performance tradeoffs

### Non-Numeric Comparisons
- Boolean conditions (has_component, is_state) don't have violation magnitude
- Skip violation percentiles, near-miss for these
- Last-mile rate still applicable

## Testing Strategy

### Unit Tests
- `HierarchicalClauseNode` percentile calculation
- Epsilon selection logic
- Last-mile tracking accuracy
- Edge cases (zero failures, single clause, etc.)

### Integration Tests
- Full simulation with known expressions
- Verify metrics accuracy against hand-calculated expectations
- Compare with existing metrics (should be unchanged)

### Performance Tests
- Memory usage at 100k samples
- Finalization time with large violation arrays
- Verify no significant slowdown in simulation loop

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ BLOCKERS                                                          [Expand] │
├─────┬──────────────────────┬────────┬──────────────────┬───────────────────┤
│ Rank│ Clause               │ Fail % │ Violation        │ Last-Mile │ Status │
├─────┼──────────────────────┼────────┼──────────────────┼───────────┼────────┤
│  1  │ emotions.joy >= 0.55 │ 47.2%  │ μ:0.08 p50:0.02  │ 82.1% ⚠️  │ TUNE   │
│     │                      │        │ p90:0.21         │           │ FIRST  │
│     │                      │        │ near-miss: 14.6% │           │        │
│     │                      │        │ max: 0.52        │           │        │
├─────┼──────────────────────┼────────┼──────────────────┼───────────┼────────┤
│  2  │ arousal >= 0.40      │ 31.5%  │ μ:0.12 p50:0.10  │  5.2%     │ LOW    │
│     │                      │        │ near-miss: 2.1%  │           │ IMPACT │
└─────┴──────────────────────┴────────┴──────────────────┴───────────┴────────┘

Legend:
- Last-Mile: Failure rate when ALL other clauses pass (tune these first)
- near-miss: Samples within 5% of threshold (high = threshold tweaks help)
- max: Maximum observed value (if < threshold = ceiling effect)
```

## Configuration Options

```javascript
const advancedMetricsConfig = {
  // Enable/disable advanced metrics (for performance)
  enabled: true,

  // Epsilon values for near-miss calculation by domain
  nearMissEpsilon: {
    emotions: 0.05,      // [0, 1] range
    moodAxes: 5,         // [-100, 100] range
    sexualStates: 5,     // [0, 100] range
    default: 0.05        // Fallback
  },

  // Memory optimization for very large simulations
  maxViolationsSampled: 10000,  // Use reservoir sampling above this

  // Include in output
  includePercentiles: true,
  includeNearMiss: true,
  includeLastMile: true,
  includeMaxObserved: true
};
```

## Success Criteria

1. **Functional**: All four new metrics computed correctly for all expression types
2. **Performance**: < 5% increase in simulation time, < 2x memory usage
3. **Usability**: Content creators can identify "tune this first" clauses at a glance
4. **Robustness**: Graceful handling of edge cases (zero failures, single clause, etc.)

## Open Questions

1. **Epsilon auto-detection**: Should epsilon be derived from the threshold value itself (e.g., 10% of threshold)?

2. **Hierarchical last-mile**: For compound clauses, should last-mile rate be computed at the top-level prerequisite or at leaf clauses?

3. **UI density**: Are all metrics shown by default, or should some be in an "advanced" toggle?

4. **Existing IntensityBoundsCalculator integration**: Should max observed be compared against theoretical bounds for hybrid analysis?

## Deferred Features (Future Consideration)

- **Marginal gain estimate**: Expensive counterfactual analysis; near-miss rate is a cheaper proxy
- **Redundancy detection**: "Decisive blocker rate" requires re-evaluation with clause toggled
- **Delta distribution for temporal clauses**: Specialized metric for `(x - prevX) >= d` patterns
