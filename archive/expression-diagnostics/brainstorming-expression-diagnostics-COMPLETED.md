# Expression Diagnostics Brainstorming - COMPLETED

## Status: COMPLETED

**Completion Date:** 2025-01-09

**Summary:**

This brainstorming document captured the initial requirements exploration and design thinking for the Expression Diagnostics system. The system has been successfully implemented with the following outcomes:

| Proposed Approach | Implementation Status |
|-------------------|----------------------|
| Formal Feasibility Analysis (Constraint Solving) | ✅ Static analysis implemented (GateConstraintAnalyzer, IntensityBoundsCalculator) |
| SMT/MILP Solver | ❌ Rejected (Z3 WASM bundle size ~5MB not justified) |
| Monte Carlo Simulation | ✅ Fully implemented (MonteCarloSimulator) |
| Guided Search (Witness Finding) | ✅ Fully implemented (WitnessStateFinder) |
| Per-Clause Failure Analysis | ✅ Fully implemented (FailureExplainer) |
| Threshold Suggestions | ⚠️ Basic implementation in FailureExplainer; advanced counterfactual rejected |
| Path-Sensitive Analysis | ✅ Additional capability implemented (PathSensitiveAnalyzer) |

**Key Design Decisions Made:**
1. Monte Carlo + Guided Search prioritized over SMT solver (simpler, 90% of value)
2. Static gate conflict detection catches most truly impossible cases
3. Dynamics mode deemed unnecessary (static analysis catches real problems)
4. Advanced threshold suggestions rejected (manual iteration is natural workflow)

---

## Original Brainstorming Content (Preserved for Reference)

We've created an in-depth emotions and expressions system. The main data files involved are:

data/mods/emotions-*/expressions/
mood.component.json
sexual_state.component.json
data/schemas/*expression*
data/mods/core/lookups/

Expression files are complicated systems intended to automatically output narrative beats based on changing emotional states (including sexual states, mood axes).

However, currently it's easy to design prerequisites for an expression that will cause it to fire very rarely, or worse yet, never fire. We want to create a new page for our app that focuses on comprehensive expression diagnostics.

It will have a button on index.html , in the 'Emotions' section, to the right of 'Expressions Simulator'.

## Problem Overview

Expressions in the engine fire when certain emotional/sexual intensity conditions are met. Each intensity (e.g. emotions.curiosity, emotions.fear, sexualStates.sexual_lust, etc.) is derived from underlying mood axes and sexual values via prototype weights and gating rules. An expression's prerequisites can become impossible to satisfy if they demand conflicting or unattainable combinations of these intensities. For example, if one condition requires an emotion that only occurs with low threat while another requires an emotion that only occurs with high threat, no single state can meet both. We need ways to programmatically detect such issues.

### Approach 1: Formal Feasibility Analysis (Constraint Solving) ✅ IMPLEMENTED

- Reference mood-and-sexual-arousal-system.md

We can treat each expression's prerequisite as a system of constraints on the underlying mood/sexual axes. The intensity calculation is essentially linear given the gating rules:

- Gating conditions: Each emotion has prerequisite "gates" on axes that must all pass; otherwise the intensity is forced to 0. For example, confidence requires threat <= 0.20 and agency_control >= 0.10, whereas fear requires threat >= 0.30. These are inherently contradictory – an expression needing high confidence and high fear simultaneously could never trigger, since no threat value can satisfy both gates at once.

- Linear intensity formula: If all gates pass, an emotion's intensity is the weighted sum of normalized axes divided by the sum of weight magnitudes (ensuring a 0–1 range).

**Implementation:** GateConstraintAnalyzer and IntensityBoundsCalculator services

### Approach 2: Monte Carlo Simulation & Statistical Analysis ✅ IMPLEMENTED

A more empirical method is to simulate a wide range of mood/sexual states and observe which expressions ever trigger.

**Implementation:** MonteCarloSimulator service with:
- Uniform and Gaussian distributions
- Configurable sample counts
- Per-clause failure tracking
- Confidence interval calculation

### Approach 3: Heuristic and Analytical Checks ✅ IMPLEMENTED

Beyond brute-force methods, we can encode some business rules to catch likely issues:

- Gate Conflict Detection
- Weight Sign Oppositions
- Delta Prerequisite Checks

**Implementation:** Static analysis in GateConstraintAnalyzer, PathSensitiveAnalyzer

---

## What the Expression Diagnostics page will offer ✅ IMPLEMENTED

It will allow the user to select one among the loaded expressions, relying on the code to load mod expressions that expressions-simulator.html already uses.

**Implemented Features:**
- Expression selection with status indicators
- Problematic expressions quick-access panel
- Static analysis with gate conflicts and unreachable thresholds
- Path-sensitive analysis with branch enumeration
- Monte Carlo simulation with trigger rate estimation
- Witness state finding with simulated annealing
- Per-clause blocker analysis with severity ratings
- Knife-edge constraint detection

---

## Recommended Diagnostics Architecture ✅ IMPLEMENTED

4 layers implemented:

1) **Parsing & normalization** ✅
2) **Static contradiction checks** ✅
3) **Feasibility solving** ✅ (guided search, not SMT)
4) **Monte Carlo & sensitivity analysis** ✅

---

## Key Insights from Brainstorming

### Why Monte Carlo can't replace a solver

Monte Carlo can observe rarity but can't prove impossibility. The system needed static analysis for deterministic contradiction detection.

**Resolution:** Combination approach - static analysis proves impossibility, Monte Carlo estimates rarity, guided search finds witnesses.

### Distribution sensitivity

Trigger probability depends heavily on the prior distribution.

**Resolution:** MonteCarloSimulator supports both Uniform and Gaussian distributions with configurable parameters.

### The right combination

- **Solver / constraint checks:** "Can this ever trigger?" (reachability / contradictions)
- **Monte Carlo:** "How often will it trigger under realistic play?" (rarity / tuning)
- **Guided search:** "Find me a trigger state if one exists." (practical witness-finder)

This combination was successfully implemented without requiring SMT solver complexity.
