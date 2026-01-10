# Specification: Expression Diagnostics System - COMPLETED

## Status: COMPLETED

**Completion Date:** 2025-01-09

**Implementation Summary:**

This specification drove the successful implementation of the Expression Diagnostics system. The following layers were implemented:

| Layer | Status | Notes |
|-------|--------|-------|
| **Layer A: Static Constraint Analysis** | ✅ Completed | GateConstraintAnalyzer, IntensityBoundsCalculator |
| **Layer B: Formal Verification (SMT)** | ❌ Rejected | EXPDIA-013/014 - Z3 WASM bundle size (~5MB) and complexity not justified |
| **Layer C: Monte Carlo Simulation** | ✅ Completed | MonteCarloSimulator with distributions, clause tracking |
| **Layer D: Witness State Finding** | ✅ Completed | WitnessStateFinder with simulated annealing |
| **Layer E: Threshold Suggestions** | ⚠️ Partial | Basic suggestions in FailureExplainer; EXPDIA-015 (advanced counterfactual) rejected |
| **Path-Sensitive Analysis** | ✅ Completed | PathSensitiveAnalyzer for branch-aware reachability (additional capability beyond spec) |

**Rejected Features:**
- SMT Solver integration (EXPDIA-013/014) - Complexity vs value tradeoff
- ThresholdSuggester service (EXPDIA-015) - Existing FailureExplainer provides adequate guidance
- Dynamics Mode (EXPDIA-016) - Game-specific assumptions, static analysis already catches real problems

---

## Original Specification (Preserved for Reference)

### Goal

Create a comprehensive Expression Diagnostics page that allows content authors to:

1. **Detect impossible expressions** - Where prerequisites can never be satisfied due to gate conflicts, unreachable intensity thresholds, or mutually exclusive conditions
2. **Estimate trigger probability** - How often expressions might fire under different mood/sexual state distributions
3. **Explain failures** - Which prerequisites block triggers and why, with per-clause failure frequency
4. **Find witness states** - Concrete mood/sexual configurations that trigger an expression
5. **Suggest fixes** - Threshold adjustments that would improve trigger rates

### Context

#### Current Expression System

Expressions fire when emotional/sexual intensity conditions are met. Each intensity is derived from:
- **7 mood axes** (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation) - range [-100, 100]
- **Sexual state** (sex_excitation, sex_inhibition, baseline_libido) with derived sexual_arousal - range [0, 100]
- **80+ emotion prototypes** with gates and weights
- **15 sexual state prototypes** similarly structured

#### Problem Statement

Expressions can become impossible to trigger if they demand conflicting combinations:
- Gate conflicts (e.g., one emotion requires `threat <= 0.20`, another requires `threat >= 0.30`)
- Unreachable thresholds (e.g., requiring `emotions.X >= 0.80` when max possible intensity is 0.65)
- Anti-correlated emotions (weight vectors in opposite directions)
- Impossible delta requirements (e.g., requiring large jumps in already-saturated emotions)

Currently, there is no tooling to detect these issues. Content authors write expressions that never fire, wasting narrative effort.

---

## Diagnostic Layers

### Layer A: Static Constraint Analysis (Fast, Deterministic) ✅ IMPLEMENTED

#### A.1 Gate Conflict Detection
Parse all required emotion/sexual prototypes from expression prerequisites. For each prototype, extract gate constraints and build per-axis intervals. Check if any axis interval becomes empty (min > max).

#### A.2 Threshold Reachability Bounds
Calculate the maximum/minimum possible intensity for each prototype, given gate constraints already satisfied.

#### A.3 Pairwise Opposition Heuristic
Compute compatibility score between required high-threshold emotions using normalized weight vector dot product. Strong opposition (dot < -0.6) indicates likely rarity.

#### A.4 Delta Prerequisite Checks
Flag expressions with saturation impossibility scenarios.

---

### Layer B: Formal Verification (SMT Solver) ❌ REJECTED

#### Decision: Not Implemented

The SMT solver integration (Z3 WASM) was rejected because:
1. Bundle size impact (~5MB) for the z3-solver package
2. Implementation complexity
3. The combination of static analysis + Monte Carlo + witness finding provides adequate diagnostic capability
4. Most "impossible" expressions are caught by static gate conflict detection

---

### Layer C: Monte Carlo Simulation (Statistical) ✅ IMPLEMENTED

#### C.1 Random State Generation

**Distributions:**
- **Uniform:** Each mood axis uniform in [-100, 100], sexual vars uniform in [0, 100]
- **Gaussian:** Centered at 0, σ = 30 for mood axes; centered at 50, σ = 25 for sexual vars

#### C.2 Simulation Loop
Implemented with:
- Configurable sample counts (1K, 10K, 100K)
- Per-clause failure tracking
- Confidence interval calculation

#### C.3 Per-Clause Failure Analysis
Track:
- **Failure rate:** % of samples where clause failed
- **Average violation:** How far from passing
- **Clause description:** Human-readable summary

---

### Layer D: Witness State Finding (Guided Search) ✅ IMPLEMENTED

#### D.1 Simulated Annealing Algorithm
Implemented with multi-restart optimization to find concrete triggering states or nearest-miss states.

#### D.2 Penalty Function
Sum of violations across all prerequisites with clause-level tracking.

---

### Layer E: Threshold Suggestions ⚠️ PARTIAL

#### Basic Implementation (FailureExplainer)
- Provides heuristic suggestions based on average violations
- Human-readable guidance for threshold adjustments

#### Advanced Implementation (ThresholdSuggester) ❌ REJECTED
- Counterfactual simulation with verified improvement percentages
- Rejected: Manual iteration is natural workflow; existing guidance sufficient

---

## Rarity Categories ✅ IMPLEMENTED

| Category | Trigger Rate | Status Indicator |
|----------|--------------|------------------|
| **Impossible** | 0% (proven by static analysis) | 🔴 Red |
| **Extremely Rare** | < 0.001% | 🟠 Orange |
| **Rare** | 0.001% - 0.05% | 🟡 Yellow |
| **Normal** | 0.05% - 2% | 🟢 Green |
| **Frequent** | > 2% | 🔵 Blue |

---

## Architecture ✅ IMPLEMENTED

### Directory Structure

```
src/expressionDiagnostics/
├── services/
│   ├── GateConstraintAnalyzer.js      ✅
│   ├── IntensityBoundsCalculator.js   ✅
│   ├── MonteCarloSimulator.js         ✅
│   ├── WitnessStateFinder.js          ✅
│   ├── FailureExplainer.js            ✅
│   ├── PathSensitiveAnalyzer.js       ✅ (additional)
│   ├── ExpressionStatusService.js     ✅ (additional)
│   └── index.js
├── models/
│   ├── AxisInterval.js                ✅
│   ├── GateConstraint.js              ✅
│   ├── DiagnosticResult.js            ✅
│   ├── WitnessState.js                ✅
│   ├── AnalysisBranch.js              ✅ (additional)
│   ├── BranchReachability.js          ✅ (additional)
│   ├── KnifeEdge.js                   ✅ (additional)
│   ├── PathSensitiveResult.js         ✅ (additional)
│   └── index.js
└── statusTheme.js                     ✅ (additional)

src/domUI/expression-diagnostics/
├── ExpressionDiagnosticsController.js ✅
└── components/
    └── StatusSelectDropdown.js        ✅ (additional)
```

---

## Implementation Phases - Final Status

### Phase 1: Foundation (MVP) ✅ COMPLETED
- GateConstraintAnalyzer service
- IntensityBoundsCalculator service
- Basic UI (expression selector, Run Static Analysis, results panel)

### Phase 2: Monte Carlo Analysis ✅ COMPLETED
- MonteCarloSimulator service
- FailureExplainer service
- Extended UI (sample count, distribution, trigger rate, top blockers)

### Phase 3: Witness Finding ✅ COMPLETED
- WitnessStateFinder service
- Extended UI (Find Witness button, witness state display, copy button)

### Phase 4: SMT Solver ❌ REJECTED
- Z3 WASM integration rejected due to bundle size and complexity

### Phase 5: Dynamics Mode & Suggestions ❌ REJECTED
- ThresholdSuggester service rejected (EXPDIA-015)
- Dynamics mode rejected (EXPDIA-016)

### Additional: Path-Sensitive Analysis ✅ COMPLETED (Beyond Original Spec)
- PathSensitiveAnalyzer for branch-aware reachability
- Knife-edge detection
- Feasibility volume calculation
- Branch enumeration and visualization
