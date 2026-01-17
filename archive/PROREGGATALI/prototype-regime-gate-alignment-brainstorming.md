# New Feature - Prototype-Regime Gate Alignment

In the page expression-diagnostics.html , for our Monte Carlo simulator that runs through the 'Run Simulation' button, we want the following:

## Diagnostic: Prototype–Regime Gate Alignment
What it detects
For every emotion referenced in the expression prerequisites (e.g. emotions.quiet_absorption >= 0.55), check whether the expression’s AND-only mood regime makes any of that emotion prototype’s gates impossible.

If yes → that emotion is structurally unreachable under prototype-gated sampling (and likely in the live engine too, if emotions are derived from those same axes).

This is different from “axis sign conflict”:

- Gate contradiction is a hard impossibility (emotion clamped to 0).
- Axis sign conflict is a soft feasibility loss (emotion gets weaker).

## Computation (deterministic, explainable)
Inputs you already have
- Extracted mood regime bounds from prerequisites (you’re already doing this for “in-regime” sampling).
- The emotion prototypes table (weights + gates strings like "agency_control <= 0.10").
- A consistent axis normalization (whatever your emotion derivation uses).

Do not hardcode /100; call the same normalizer you use when computing prototypes.

### Step 1: Build regime intervals per axis
From the AND-only mood constraints, build per-axis intervals:

regimeBounds = {
  threat: { min: -Infinity, max: 0.20 },      // normalized
  agency_control: { min: 0.15, max: Infinity },
  arousal: { min: -0.30, max: 0.35 },
  ...
}
If an axis isn’t constrained by the regime, leave it unbounded.

### Step 2: Parse each prototype gate into an interval constraint
For each gate string "axis op value" produce a gate interval:

axis <= v → (-∞, v]

axis < v → (-∞, v)

axis >= v → [v, +∞)

axis > v → (v, +∞)

### Step 3: Intersect regime interval with gate interval
Let:

R = [rMin, rMax] from regime

G = [gMin, gMax] from gate

Compute I = R ∩ G.

If I is empty → CONTRADICTION (gate can never pass in-regime)

Else → OK

### Step 4: Produce “distance to feasibility” evidence (super helpful)
When contradictory, compute the smallest adjustment required to make it feasible:

For regime.min > gate.max: distance = regime.min - gate.max

For regime.max < gate.min: distance = gate.min - regime.max

Example (your case):

regime says agency_control >= 0.15

gate says agency_control <= 0.10

distance = 0.15 - 0.10 = 0.05

That gives you a concrete explanation and a concrete fix target.

## Severity scoring (keep it tiny)
You only need 2 levels:

- critical: contradiction on any gate for an emotion that the expression threshold-requires (emotions.X >= t where t > 0)
- info: contradiction on an emotion not threshold-required (rare, but possible if it appears only as a cap/exclusion)

Optionally (still small): add warn if intersection exists but is razor-thin:

overlapWidth / regimeWidth < 0.10 (only if regimeWidth is finite)

## Report UI (minimal but punchy)
Add a section near “Top Blockers” / “Recommendations”:

Prototype gate alignment
A small table:

Emotion	Prototype gate	Regime bounds (axis)	Status	Distance
quiet_absorption	agency_control <= 0.10	agency_control >= 0.15	CONTRADICTION	0.05
quiet_absorption	threat <= 0.35	threat <= 0.20	OK	—
Then a one-liner recommendation per contradiction:

Unreachable emotion under regime: emotions.quiet_absorption is always 0 in-regime because prototype gate agency_control <= 0.10 contradicts regime agency_control >= 0.15.
Fix: relax regime on agency_control, loosen the prototype gate, or replace/create a prototype (e.g. focused_absorption).

That’s it. No graphs required.

## Where to implement (small footprint)
Wherever you build the report object (or recommendations):

Add PrototypeGateAlignmentAnalyzer that takes:

regimeBoundsNormalized

emotionPrototypes

referencedEmotions (from prerequisites AST)

requiredEmotionThresholds (only those with >=/> and a positive threshold)

Return:

{
  "prototypeGateAlignment": {
    "contradictions": [
      {
        "emotion": "quiet_absorption",
        "gate": "agency_control <= 0.10",
        "axis": "agency_control",
        "regime": { "min": 0.15, "max": null },
        "gateInterval": { "min": null, "max": 0.10 },
        "distance": 0.05,
        "severity": "critical"
      }
    ],
    "tightPassages": []
  }
}


## Invariants
If contradictions contains any entry with severity=critical, then (in prototype-gated HARD mode) the report must surface:
“Emotion unreachable under regime (clamped to 0)” for that emotion.

A contradiction must only be emitted when:

The regime is AND-only extractable, and

The axis is present in the gate, and

The regime bounds for that axis are known (finite on the relevant side)

Use the same axis normalization the emotion derivation uses. Otherwise you will generate false contradictions.



## Tests (unit-level, fast)
Detect contradiction

Regime: agency_control >= 0.15

Gate: agency_control <= 0.10

Expect: one contradiction, distance 0.05, severity critical if emotion threshold-required.

No contradiction when overlapping

Regime: threat <= 0.20

Gate: threat <= 0.35

Expect: no contradiction.

Strict inequality edge

Regime: arousal >= 0.10

Gate: arousal < 0.10

Expect: contradiction (empty intersection).

Unbounded regime axis

Regime: no constraint on valence

Gate: valence >= 0.15

Expect: no contradiction emitted (insufficient regime info).

## Implementation guidelines

Follow the single responsibility principle whenever possible. If the code you have to implement will interact with existing code, determine if that part of the code should be refactored. If so, ensure that that part of the code is covered by integration tests (either because the integration tests already exist on tests/integration/ , or else create those integration tests).