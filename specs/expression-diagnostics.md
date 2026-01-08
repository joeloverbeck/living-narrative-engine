# Specification: Expression Diagnostics System

## Goal

Create a comprehensive Expression Diagnostics page that allows content authors to:

1. **Detect impossible expressions** - Where prerequisites can never be satisfied due to gate conflicts, unreachable intensity thresholds, or mutually exclusive conditions
2. **Estimate trigger probability** - How often expressions might fire under different mood/sexual state distributions
3. **Explain failures** - Which prerequisites block triggers and why, with per-clause failure frequency
4. **Find witness states** - Concrete mood/sexual configurations that trigger an expression
5. **Suggest fixes** - Threshold adjustments that would improve trigger rates

## Context

### Current Expression System

Expressions fire when emotional/sexual intensity conditions are met. Each intensity is derived from:
- **7 mood axes** (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation) - range [-100, 100]
- **Sexual state** (sex_excitation, sex_inhibition, baseline_libido) with derived sexual_arousal - range [0, 100]
- **80+ emotion prototypes** with gates and weights
- **15 sexual state prototypes** similarly structured

### Problem Statement

Expressions can become impossible to trigger if they demand conflicting combinations:
- Gate conflicts (e.g., one emotion requires `threat <= 0.20`, another requires `threat >= 0.30`)
- Unreachable thresholds (e.g., requiring `emotions.X >= 0.80` when max possible intensity is 0.65)
- Anti-correlated emotions (weight vectors in opposite directions)
- Impossible delta requirements (e.g., requiring large jumps in already-saturated emotions)

Currently, there is no tooling to detect these issues. Content authors write expressions that never fire, wasting narrative effort.

### Key Files

| File | Purpose |
|------|---------|
| `src/emotions/emotionCalculatorService.js` | Gate parsing, intensity calculation |
| `src/expressions/expressionEvaluatorService.js` | Prerequisite evaluation |
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | Emotion prototype definitions |
| `data/mods/core/lookups/sexual_prototypes.lookup.json` | Sexual prototype definitions |
| `src/domUI/expressions-simulator/ExpressionsSimulatorController.js` | UI pattern reference |

---

## Diagnostic Layers

### Layer A: Static Constraint Analysis (Fast, Deterministic)

#### A.1 Gate Conflict Detection

Parse all required emotion/sexual prototypes from expression prerequisites. For each prototype, extract gate constraints and build per-axis intervals. Check if any axis interval becomes empty (min > max).

**Algorithm:**
```javascript
function detectGateConflicts(expression, emotionPrototypes, sexualPrototypes) {
  // 1. Extract required prototypes from prerequisites
  //    (emotions/sexualStates with >= threshold conditions)
  const requiredPrototypes = extractRequiredPrototypes(expression.prerequisites);

  // 2. Build consolidated intervals per axis
  const axisIntervals = {};  // axis -> { min, max }

  for (const proto of requiredPrototypes) {
    for (const gate of proto.gates) {
      const { axis, operator, value } = parseGate(gate);

      if (!axisIntervals[axis]) {
        axisIntervals[axis] = getDefaultAxisBounds(axis);
      }

      // Tighten interval based on gate
      if (operator === '<=') axisIntervals[axis].max = Math.min(axisIntervals[axis].max, value);
      if (operator === '>=') axisIntervals[axis].min = Math.max(axisIntervals[axis].min, value);
      // Similar for <, >, ==
    }
  }

  // 3. Check for empty intervals
  const conflicts = [];
  for (const [axis, interval] of Object.entries(axisIntervals)) {
    if (interval.min > interval.max) {
      conflicts.push({ axis, required: interval, prototypes: findConflictingSources(axis, requiredPrototypes) });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}
```

**Default axis bounds:**
- Mood axes: [-1, 1] (normalized)
- Sexual axes: [0, 1]
- sexual_arousal: [0, 1]

#### A.2 Threshold Reachability Bounds

Calculate the maximum/minimum possible intensity for each prototype, given gate constraints already satisfied.

**Algorithm:**
```javascript
function calculateIntensityBounds(prototype, axisConstraints) {
  const weights = prototype.weights;
  const sumAbsWeights = Object.values(weights).reduce((s, w) => s + Math.abs(w), 0);

  if (sumAbsWeights === 0) return { min: 0, max: 0 };

  let maxRawSum = 0, minRawSum = 0;

  for (const [axis, weight] of Object.entries(weights)) {
    const bounds = axisConstraints[axis] || getDefaultAxisBounds(axis);

    if (weight > 0) {
      maxRawSum += weight * bounds.max;
      minRawSum += weight * bounds.min;
    } else {
      maxRawSum += weight * bounds.min;  // negative weight, min value maximizes
      minRawSum += weight * bounds.max;
    }
  }

  return {
    max: clamp01(maxRawSum / sumAbsWeights),
    min: clamp01(minRawSum / sumAbsWeights)
  };
}
```

If an expression requires `emotions.X >= t` and `maxIntensity < t`, the expression is **impossible**.

#### A.3 Pairwise Opposition Heuristic

Compute compatibility score between required high-threshold emotions using normalized weight vector dot product. Strong opposition (dot < -0.6) indicates likely rarity.

#### A.4 Delta Prerequisite Checks

Flag expressions with:
- `emotions.X >= 0.95` AND `(emotions.X - previousEmotions.X) >= 0.12` → saturation impossibility
- Large delta requirements that exceed per-tick feasibility

---

### Layer B: Formal Verification (SMT Solver)

#### B.1 Z3 WASM Integration

Use the `z3-solver` npm package (WASM build) for rigorous satisfiability checking.

**Model Variables:**
- 7 mood axes as Real variables in [-1, 1]
- sex_excitation, sex_inhibition in [0, 1]
- baseline_libido in [-0.5, 0.5]
- sexual_arousal defined as `clamp01(sex_excitation - sex_inhibition + baseline_libido)`

**Constraint Translation:**
- Gates become linear constraints (e.g., `threat <= 0.20` → `And(threat_var <= 0.20)`)
- Intensity thresholds become linear inequalities on weighted sums
- For required emotions, assume gates are satisfied (otherwise intensity = 0)

**Capabilities:**
- **SAT** → Expression is mathematically possible, extract witness model
- **UNSAT** → Expression is impossible, extract unsat core (minimal conflicting constraints)

#### B.2 Unsat Core Reporting

When SMT proves impossibility, report the minimal subset of constraints that conflict:
```
"Unreachable because: fear requires threat >= 0.30 but confidence requires threat <= 0.20"
```

#### B.3 Delta Constraints (Dynamics Mode)

**Math mode (default):** `previousEmotions.*` treated as independent variables in [0, 1]

**Dynamics mode:** Add constraint `|currentEmotion - previousEmotion| <= maxDeltaPerTick`
- Default `maxDeltaPerTick`: 0.3
- Configurable per-analysis

---

### Layer C: Monte Carlo Simulation (Statistical)

#### C.1 Random State Generation

**Distributions:**
- **Uniform:** Each mood axis uniform in [-100, 100], sexual vars uniform in [0, 100]
- **Gaussian:** Centered at 0, σ = 30 for mood axes; centered at 50, σ = 25 for sexual vars

#### C.2 Simulation Loop

```javascript
async function runMonteCarloSimulation(expression, options = {}) {
  const { sampleCount = 10000, distribution = 'gaussian', dynamicsMode = false } = options;

  let triggerCount = 0;
  const clauseFailures = new Map();  // clauseKey -> { count, totalViolation }

  for (let i = 0; i < sampleCount; i++) {
    // Generate random state
    const state = generateRandomState(distribution, dynamicsMode);

    // Build context
    const context = buildContext(state);

    // Evaluate with clause tracking
    const { passed, clauseResults } = evaluateWithClauseTracking(expression, context);

    if (passed) {
      triggerCount++;
    } else {
      for (const result of clauseResults.filter(r => !r.passed)) {
        trackClauseFailure(clauseFailures, result);
      }
    }
  }

  return {
    triggerRate: triggerCount / sampleCount,
    sampleCount,
    clauseFailures: formatClauseFailures(clauseFailures, sampleCount),
    confidenceInterval: calculateConfidenceInterval(triggerCount, sampleCount)
  };
}
```

#### C.3 Per-Clause Failure Analysis

Track:
- **Failure rate:** % of samples where clause failed
- **Average violation:** How far from passing (e.g., required >= 0.60, actual average 0.45 → violation 0.15)
- **Clause description:** Human-readable summary

---

### Layer D: Witness State Finding (Guided Search)

#### D.1 Simulated Annealing Algorithm

```javascript
function findWitnessState(expression, options = {}) {
  const { maxIterations = 2000, restarts = 50, dynamicsMode = false } = options;

  let bestState = null, bestPenalty = Infinity;

  for (let restart = 0; restart < restarts; restart++) {
    let state = generateRandomState();
    let penalty = calculateViolationPenalty(expression, state);
    let temperature = 1.0;
    const coolingRate = 0.995;

    for (let iter = 0; iter < maxIterations / restarts; iter++) {
      const neighbor = perturbState(state, temperature);
      const neighborPenalty = calculateViolationPenalty(expression, neighbor);

      // Accept with Metropolis criterion
      if (neighborPenalty < penalty ||
          Math.random() < Math.exp((penalty - neighborPenalty) / temperature)) {
        state = neighbor;
        penalty = neighborPenalty;
      }

      temperature *= coolingRate;

      if (penalty < 0.0001) {
        return { found: true, witnessState: formatWitnessState(state), penalty: 0 };
      }
    }

    if (penalty < bestPenalty) {
      bestState = state;
      bestPenalty = penalty;
    }
  }

  return {
    found: bestPenalty < 0.0001,
    witnessState: formatWitnessState(bestState),
    penalty: bestPenalty,
    nearestMiss: bestPenalty > 0 ? describeNearestMiss(expression, bestState) : null
  };
}
```

#### D.2 Penalty Function

```javascript
function calculateViolationPenalty(expression, state) {
  let totalPenalty = 0;
  const context = buildContext(state);

  for (const prereq of expression.prerequisites) {
    const violations = evaluateWithViolations(prereq.logic, context);
    // violations: array of { clauseType, required, actual, violation }
    totalPenalty += violations.reduce((sum, v) => sum + Math.max(0, v.violation), 0);
  }

  return totalPenalty;
}
```

---

### Layer E: Threshold Suggestions

#### E.1 Counterfactual Simulation

For each threshold clause in a failing expression:
1. Adjust threshold by small amounts (-0.05, -0.10, -0.15)
2. Re-run Monte Carlo with adjusted threshold
3. Compare trigger rates

#### E.2 Minimal Fix Suggestions

```javascript
function suggestThresholdFixes(expression, monteCarloResult, targetRate = 0.01) {
  const suggestions = [];

  for (const blocker of monteCarloResult.clauseFailures.slice(0, 5)) {
    const originalThreshold = blocker.threshold;

    for (const delta of [-0.05, -0.10, -0.15]) {
      const adjustedExpression = adjustThreshold(expression, blocker.clauseIndex, delta);
      const adjustedResult = runQuickMonteCarlo(adjustedExpression, 1000);

      if (adjustedResult.triggerRate >= targetRate) {
        suggestions.push({
          clause: blocker.clauseDescription,
          original: originalThreshold,
          suggested: originalThreshold + delta,
          expectedTriggerRate: adjustedResult.triggerRate
        });
        break;
      }
    }
  }

  return suggestions;
}
```

---

## Rarity Categories

| Category | Trigger Rate | Status Indicator |
|----------|--------------|------------------|
| **Impossible** | 0% (proven by SMT or static analysis) | 🔴 Red |
| **Extremely Rare** | < 0.001% | 🟠 Orange |
| **Rare** | 0.001% - 0.05% | 🟡 Yellow |
| **Normal** | 0.05% - 2% | 🟢 Green |
| **Frequent** | > 2% | 🔵 Blue |

---

## UI Design

### Page Structure

```
expression-diagnostics.html

┌─────────────────────────────────────────────────────────────────┐
│ Header: Expression Diagnostics           [Back to Menu]         │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Expression Selection                                        │ │
│ │ [Dropdown: Select Expression ▼]                             │ │
│ │ Description: "Brief expression description here..."        │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Analysis Controls                                           │ │
│ │ [Run Static] [Run Monte Carlo] [Find Witness] [Run All]     │ │
│ │ Sample Count: [10000] Distribution: [Gaussian ▼]            │ │
│ │ [x] Dynamics Mode (constrain deltas)                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────┐  │
│ │ Status Summary       │ │ Trigger Rate                     │  │
│ │ ┌────┐               │ │ Rate: 0.034% (Rare)              │  │
│ │ │ 🟡 │ RARE          │ │ Confidence: ±0.003% (95%)        │  │
│ │ └────┘               │ │ Samples: 10,000 / Gaussian       │  │
│ │ "Triggerable but     │ └──────────────────────────────────┘  │
│ │  unlikely in normal  │                                       │
│ │  gameplay."          │                                       │
│ └──────────────────────┘                                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Witness State (if found)                                    │ │
│ │ {                                                           │ │
│ │   "moodAxes": { "valence": 42, "arousal": 18, ... },       │ │
│ │   "sexualState": { "sex_excitation": 63, ... }             │ │
│ │ }                                                           │ │
│ │ [Copy to Clipboard]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Top Blockers                                                │ │
│ │ ┌────────────────────┬──────────┬────────────┬───────────┐ │ │
│ │ │ Clause             │ Fail Rate│ Avg Viol.  │ Fix       │ │ │
│ │ ├────────────────────┼──────────┼────────────┼───────────┤ │ │
│ │ │ emotions.fear<=0.40│ 72%      │ 0.09       │ → 0.55    │ │ │
│ │ │ delta curiosity    │ 58%      │ 0.05       │ → 0.08    │ │ │
│ │ │ moodAxes.engage>=10│ 41%      │ 8.2        │           │ │ │
│ │ └────────────────────┴──────────┴────────────┴───────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Suggested Fixes                                             │ │
│ │ • Lower `emotions.fear <= 0.40` → 0.55 (est. 0.12% rate)   │ │
│ │ • Reduce delta threshold 0.12 → 0.08 (est. 0.08% rate)     │ │
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ▸ Static Analysis Details (collapsible)                         │
│   Gate Conflicts: None                                          │
│   Intensity Bounds: All reachable                               │
│   Required Prototypes: curiosity, engagement, ...               │
└─────────────────────────────────────────────────────────────────┘
```

### CSS Patterns

Follow `expressions-simulator.css` patterns:
- Grid-based panel layout
- CSS variables for colors, spacing
- Responsive design with auto-fit columns
- Status indicator color coding

---

## Architecture

### Directory Structure

```
src/expressionDiagnostics/
├── services/
│   ├── GateConstraintAnalyzer.js      # Static gate conflict detection
│   ├── IntensityBoundsCalculator.js   # Max/min intensity calculation
│   ├── MonteCarloSimulator.js         # Statistical trigger rate estimation
│   ├── WitnessStateFinder.js          # Guided search for satisfying states
│   ├── FailureExplainer.js            # Per-clause failure analysis
│   ├── ThresholdSuggester.js          # Counterfactual fix recommendations
│   └── SmtSolver.js                   # Z3 WASM integration
├── models/
│   ├── AxisInterval.js                # {min, max} constraint model
│   ├── GateConstraint.js              # Parsed gate constraint
│   ├── DiagnosticResult.js            # Full diagnostic report
│   └── WitnessState.js                # Satisfying state model
└── index.js                           # Barrel export

src/domUI/expression-diagnostics/
└── ExpressionDiagnosticsController.js

src/dependencyInjection/registrations/
└── expressionDiagnosticsRegistrations.js
```

### DI Tokens

Add to `tokens-core.js`:
```javascript
IGateConstraintAnalyzer: 'IGateConstraintAnalyzer',
IIntensityBoundsCalculator: 'IIntensityBoundsCalculator',
IMonteCarloSimulator: 'IMonteCarloSimulator',
IWitnessStateFinder: 'IWitnessStateFinder',
IFailureExplainer: 'IFailureExplainer',
IThresholdSuggester: 'IThresholdSuggester',
ISmtSolver: 'ISmtSolver',
```

### Service Dependencies

```
GateConstraintAnalyzer
  ← IDataRegistry (for prototype lookups)
  ← ILogger

IntensityBoundsCalculator
  ← IDataRegistry
  ← ILogger

MonteCarloSimulator
  ← IEmotionCalculatorService
  ← IExpressionEvaluatorService
  ← ILogger

WitnessStateFinder
  ← IEmotionCalculatorService
  ← IExpressionEvaluatorService
  ← ILogger

SmtSolver
  ← IDataRegistry
  ← ILogger
  (+ z3-solver npm package)

FailureExplainer
  ← ILogger

ThresholdSuggester
  ← IMonteCarloSimulator
  ← ILogger
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** Static analysis with basic UI

1. Create `GateConstraintAnalyzer` service
2. Create `IntensityBoundsCalculator` service
3. Create basic UI (expression selector, Run Static Analysis, results panel)
4. Build integration (bundle, DI, index.html button)

**Deliverable:** Users can detect gate conflicts and unreachable thresholds.

### Phase 2: Monte Carlo Analysis

**Goal:** Statistical trigger probability estimation

5. Create `MonteCarloSimulator` service
6. Create `FailureExplainer` service
7. Extend UI (sample count, distribution, trigger rate, top blockers)

**Deliverable:** Users can estimate trigger rates and identify blocking clauses.

### Phase 3: Witness Finding

**Goal:** Find concrete triggering states

8. Create `WitnessStateFinder` service
9. Extend UI (Find Witness button, witness state display, copy button)

**Deliverable:** Users get concrete states that trigger any possible expression.

### Phase 4: SMT Solver

**Goal:** Formal verification with unsat core

10. Integrate Z3 WASM (`z3-solver` package)
11. Create `SmtSolver` service
12. Replace/augment guided search with SMT when available
13. Display unsat core for impossible expressions

**Deliverable:** Mathematical proofs of impossibility with minimal conflict explanation.

### Phase 5: Dynamics Mode & Suggestions

**Goal:** Realistic delta constraints and actionable recommendations

14. Implement dynamics mode in simulator and solver
15. Create `ThresholdSuggester` service
16. Extend UI (dynamics mode checkbox, suggested fixes panel)

**Deliverable:** Complete diagnostic system with actionable fix recommendations.

---

## Testing Strategy

### Unit Tests

```
tests/unit/expressionDiagnostics/services/
├── gateConstraintAnalyzer.test.js
│   - Gate parsing edge cases (negative values, ==, floating point)
│   - Interval intersection correctness
│   - Known conflict detection
├── intensityBoundsCalculator.test.js
│   - Bounds accuracy vs manual calculation
│   - Negative weight handling
│   - Edge cases (all weights zero, single weight)
├── monteCarloSimulator.test.js
│   - Rate convergence (known easy expression)
│   - Distribution correctness
│   - Clause failure tracking
├── witnessStateFinder.test.js
│   - Success on known-triggerable expressions
│   - Failure detection on impossible expressions
│   - Penalty function correctness
├── smtSolver.test.js
│   - Constraint translation accuracy
│   - SAT/UNSAT correctness on known expressions
│   - Unsat core extraction
└── thresholdSuggester.test.js
    - Suggestion generation
    - Rate improvement verification
```

### Integration Tests

```
tests/integration/expressionDiagnostics/
├── diagnosticsPipeline.integration.test.js
│   - Full analysis flow (static → monte carlo → witness → suggestions)
├── realExpressionAnalysis.integration.test.js
│   - Against actual mod expressions
│   - Verify known-impossible expressions flagged
├── smtIntegration.integration.test.js
│   - SMT + static analysis consistency
│   - Witness generation vs SMT model
```

### Test Fixtures

Create expressions with known properties:
```
tests/fixtures/expressionDiagnostics/
├── impossibleGateConflict.expression.json
│   - threat <= 0.20 AND threat >= 0.30
├── impossibleThreshold.expression.json
│   - emotions.X >= 0.95 when max possible is 0.70
├── rareExpression.expression.json
│   - Multiple tight constraints, ~0.01% rate
├── easyExpression.expression.json
│   - Loose constraints, ~5% rate
├── deltaImpossible.expression.json
│   - Unreachable delta + saturation
```

---

## Open Questions

1. **SMT solver bundle size:** Z3 WASM is ~5MB. Accept this cost, or make SMT optional/lazy-loaded?
   - **Recommendation:** Lazy-load SMT solver only when "Run SMT Analysis" clicked

2. **Worker thread for simulation:** Monte Carlo with 100K samples may block UI.
   - **Recommendation:** Use Web Worker for simulation, show progress indicator

3. **Persistence of analysis results:** Should results be exportable?
   - **Recommendation:** Phase 5 or future - add "Export Report" button generating JSON/Markdown

---

## Verification Checklist

After implementation, verify:

- [ ] `npm run build` succeeds with no errors
- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit` - all new tests pass
- [ ] `npm run test:integration` - diagnostic pipeline works
- [ ] Manual: Analyze expression with known gate conflict → shows "Impossible"
- [ ] Manual: Analyze easy expression → shows "Frequent" with witness state
- [ ] Manual: Top blockers table populated correctly
- [ ] Manual: Witness state copy-to-clipboard works
- [ ] Manual: SMT unsat core displayed for impossible expressions

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Solver approach | SMT (Z3 WASM) + Monte Carlo + Guided Search | User requested formal proofs; combination provides best of both worlds |
| Batch analysis | Single expression first | Simpler UI, faster iteration; batch can be added later |
| Delta handling | Include dynamics mode | User requested; important for realistic delta analysis |
| Rarity thresholds | Brainstorming defaults | Impossible: 0%, Extremely Rare: <0.001%, Rare: 0.001-0.05%, Normal: 0.05-2%, Frequent: >2% |
