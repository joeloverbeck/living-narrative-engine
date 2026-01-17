# Fixing Prototype Fix Blockers Confusion

## What’s wrong today (precise diagnosis)
Your Monte Carlo reports from expression-diagnostics.html currently mix two different things without saying so:

- Prototype Fit is computed from the mood-regime signature (axis constraints only).
- Blockers / pass-rate are computed from full prerequisites (axes + emotions/sexual state + deltas, evaluated on final gated values).

That’s why “fit looks clean” can coexist with “AND-block impossible.”

This isn’t a math contradiction; it’s an information-output bug: the report doesn’t label scope and doesn’t surface “non-axis clause is impossible in-regime” as a first-class, explainable artifact.

## Corrections to implement (exact report changes)

1) Add explicit scope metadata to every analysis section

### Add fields (report JSON or internal object):

section.scope ∈ { "axis_only", "full_prereqs" }

section.population ∈ { "global", "in_regime" }

section.signal ∈ { "raw", "final", "delta" } (where applicable)

### Apply immediately to:

#### Prototype Fit section

scope="axis_only"

population="in_regime" (or “regime-derived”)

signal="axis_signature" (or keep as a string you already use)

#### Any pass-rate / feasibility section

scope="full_prereqs"

population="global" and population="in_regime" where you already split them

### UI impact: show a one-line banner at the top of each section:

“Computed from mood-regime axis constraints only (emotion clauses not enforced).”

This single line kills the confusion.

## Add a new section: “Non-axis clause feasibility in mood-regime”
This is the missing bridge: for every prerequisite clause that is not a mood-axis constraint, compute whether it is achievable within the mood-regime population, using the same signal the engine uses (typically final gated values).

### Clause types to include
emotions.* comparisons (>=, >, <=, <)

sexualState.* comparisons (same)

“previous-state” clauses (previous.*)

delta gates (any pattern equivalent to current - previous >= delta)

### For each atomic clause, compute (in-regime)
Minimum required fields:

{
  clauseId,                 // stable deterministic id (see below)
  sourcePath,               // pointer back into prerequisites tree
  varPath,                  // e.g. "emotions.confusion"
  operator, threshold,
  signal: "final" | "raw" | "delta",
  population: "in_regime",

  passRate,                 // passCount / inRegimeCount
  maxValue,                 // max(LHS) over in-regime samples
  p95Value,                 // from stored contexts or reservoir (optional but valuable)
  marginMax: maxValue - threshold,

  classification: "IMPOSSIBLE" | "RARE" | "OK",
  evidence: {
    bestSampleRef,          // sample/context id for maxValue
    note                    // short textual explanation
  }
}
### How to compute quickly (no heavy storage):

You already cap stored contexts (10k). Use that for percentiles.

For maxValue and passRate, do streaming counters across all in-regime samples.

### Classification rules (deterministic)
Let eps = 1e-6 (or your float tolerance):

IMPOSSIBLE if passRate == 0 and maxValue < threshold - eps

RARE if passRate > 0 and passRate < rareThreshold (pick something like 0.001 or align with your existing “rare” semantics)

OK otherwise

## 3) Add “Fit vs Feasibility conflict” warnings (first-class)
New report section: Conflicts

Emit fit_vs_clause_impossible when:

Prototype Fit top-N score exceeds a threshold (or simply always compute top prototypes), and

At least one non-axis clause is IMPOSSIBLE in-regime.

Minimum conflict object:

{
  type: "fit_vs_clause_impossible",
  topPrototypes: [...],         // whatever you already output
  impossibleClauses: [clauseId],
  explanation: "Mood signature matches X, but clause Y cannot be satisfied in-regime on final values.",
  suggestedFixes: [
    "Move confusion requirement to previous-state or delta gate",
    "Lower threshold or remove clause",
    "Rework prototype gate for confusion"
  ]
}
This makes the report “authoritative” instead of forcing you to infer the mismatch.

## 4) Make clause IDs stable (so UI/tests don’t churn)
Define clauseId as a stable hash of:

expression id

normalized atomic clause (varPath, operator, threshold, signal, stateScope)

plus an ordered index if duplicates exist

This avoids brittle snapshot tests when prerequisite ordering changes.

## “Exact things to modify” (by responsibility)
You’ll map this to your real files, but these are the required touch points:

A) Prerequisite extraction
Modify: the code that currently extracts mood-regime constraints (AND-only mood axes).

Add: extraction of atomic non-axis clauses into a list:

extractMoodRegimeAxisClauses(prereqs) -> axisClauses

extractAtomicNonAxisClauses(prereqs) -> atomicClauses

extractDeltaClauses(prereqs) -> deltaClauses (if deltas are not atomic already)

Invariant: extraction must be purely structural and deterministic (no sampling).


## B) Monte Carlo evaluation loop
Modify: the sampling loop to accumulate per-clause stats in-regime.

Add: a ClauseStatsAccumulator keyed by clauseId:

counts in-regime

pass counts

max LHS

best sample ref

optional reservoir of LHS for percentiles (use stored contexts if you already collect them)

Important: evaluate clause LHS using the same signal used by runtime:

emotions: final (post-prototype gate/hard clamp) by default

but also optionally record raw to explain “gate killed it”

If you can afford it, record both maxRaw and maxFinal for emotion/sexual variables; it’s insanely useful.


## C) Report assembly / renderer
### Modify:

Prototype Fit output to include scope="axis_only" and an explicit disclaimer line.

Add the new section “Non-axis clause feasibility in mood-regime”

Add Conflicts section emission

### UI output:

In the human-readable report, print IMPOSSIBLE clauses as a red-flag block with the key evidence:

confusion >= 0.25 but max(final)=0.23 in-regime (0% pass)

(optional) max(raw)=0.41 → “prototype gate clamps it to 0”


## Invariants that must pass
Scope truthfulness

If a section says scope="axis_only", it must not incorporate non-axis clause evaluation anywhere in its score/claims.

Impossible classification correctness

For every clause classified IMPOSSIBLE:
passRate == 0 and maxValue < threshold - eps.

No silent contradictions

If any clause is IMPOSSIBLE in-regime, the report must emit either:

a Conflicts entry, or

a clearly visible warning banner in the feasibility section header.

Determinism

Same seed + same inputs ⇒ identical:

clause IDs

classification labels

conflict emission

numeric aggregates within tolerance

Signal consistency

“final” values used for feasibility must match the exact gating pipeline used in the simulation’s pass/fail.



## Tests that must pass (concrete test matrix)
1) Unit: clause extraction
Given a prereq tree containing:

moodAxes constraints

emotions.confusion >= 0.25

a delta gate pattern

Assert:

mood-regime extractor returns only axis clauses

non-axis extractor returns the confusion clause

delta extractor returns delta clause

clauseId is stable across runs

2) Unit: classification logic
Feed synthetic stats:

passRate=0, maxValue=0.23, threshold=0.25 ⇒ IMPOSSIBLE

passRate=0.0005 (< rareThreshold) ⇒ RARE

passRate=0.02 ⇒ OK

3) Integration: the exact failure mode you described
Fixture expression:

axis constraints that yield strong flow-ish fit

plus emotions.confusion >= 0.25 that is impossible after gating in that regime

Assert report includes:

Prototype Fit with scope="axis_only" disclaimer

Feasibility entry for confusion with:

population="in_regime", signal="final", classification="IMPOSSIBLE"

passRate == 0

maxValue < threshold

Conflicts section contains fit_vs_clause_impossible

4) Integration: “raw possible, final impossible” explanation
Fixture where:

raw confusion can exceed threshold

final confusion is clamped by gate

Assert feasibility entry includes:

maxRaw >= threshold

maxFinal < threshold

UI string mentions gate/clamp (no hand-wavy language)

5) Snapshot/UI render tests
Snapshot the markdown/HTML for:

Prototype Fit header includes “axis-only” scope line

IMPOSSIBLE clause is rendered with evidence numbers

Conflicts section appears when expected

## UI improvements that actually matter (high signal)
### Scope badges (don’t bury it in prose)

[AXIS-ONLY FIT] for Prototype Fit

[FULL PREREQS] for pass-rate / blockers

[IN-REGIME] tag on feasibility tables

### Impossible clauses get a “one-line proof”

confusion >= 0.25 → max(final)=0.23, pass=0/1251 (0.00%)

### Show raw vs final when relevant

“Raw could reach 0.41 but gate clamps final to 0.23”

### Clickable jump links

From conflict warning → exact clause row → exact prereq JSON path

### Actionable “fix vectors”

If var is confusion/uncertainty and fit is flow-ish, suggest:

“Move confusion to previous-state or delta gate”

“Replace confusion with curiosity/interest in current state”

“Lower threshold to <= max(final) - margin”

