# Prototype Create Suggestion Recommendation

We want to add a new recommendation type to our Monte Carlo simulation implementation in expression-diagnostics.html .

## 1.1 Goal

Emit a recommendation when no existing prototype adequately represents what the expression wants, and provide a concrete new prototype proposal (name + weights + gates) with predicted fit metrics in the expression’s mood regime.

## 1.2 Inputs
### Required report inputs

expressionId

moodRegime (AND-only mood constraints extracted from prerequisites, in normalized space [-1,1])

For each axis a: regime[a] = {min?: number, max?: number} if constrained

storedMoodRegimeContexts (N contexts; use existing stored-mood-regime sample set)

allPrototypes (emotion prototypes; weights + gates)

prototypeFitTable (already computed or computable)

per prototype p:

gatePassRate(p) in stored-mood-regime

pIntensityStats(p) in stored-mood-regime (mean, p50, p90, p95)

pAtLeastT(p, t) for one or more thresholds t

conflictRate(p) and/or axis conflicts (optional but recommended)

combinedScore(p) if you already compute it (or compute a new one)

targetSignature (your “Implied Prototype from Prerequisites” vector)

list of (axis, direction, importance) where direction ∈ {↑, ↓} and importance ∈ [0,1]

prototypeGapMetrics (your existing “Prototype Gap Detection”)

nearestDistance, nearestDistancePercentile (or z), kNearest list

### Optional inputs (improves relevance)

anchorPrototypeName (derived from decisive prototype-linked clause, e.g. emotions.gratitude >= 0.55)

if multiple, choose the most decisive/high-impact emotion-threshold clause

## 1.3 Outputs (new recommendation object)

Add a recommendation with:

pseudocode

type PrototypeCreateSuggestionRecommendation = {
  type: "prototype_create_suggestion";
  severity: "low" | "medium" | "high" | "critical";
  confidence: "low" | "medium" | "high";
  impact_pp?: number; // optional: estimated trigger-rate lift in percentage points
  why: string;        // short paragraph
  evidence: EvidenceEntry[]; // structured, deterministic
  proposedPrototype: {
    name: string;     // deterministic
    weights: Record<AxisName, number>;
    gates: string[];  // deterministic, satisfiable
    derivedFrom?: {
      anchorPrototype?: string;
      targetSignature?: Array<{axis: AxisName; dir: "up"|"down"; importance: number;}>;
      regimeBounds?: Record<AxisName, {min?: number; max?: number;}>;
    };
  };
  predictedFit: {
    population: "stored-mood-regime";
    N: number;
    gatePassRate: number;
    mean: number;
    p95: number;
    pAtLeastT: Array<{t: number; p: number}>;
    conflicts?: Array<{axis: AxisName; kind: string}>;
    comparison: {
      bestExistingPrototype: string;
      bestExisting: {gatePassRate: number; mean: number; p95: number; pAtLeastT: Array<{t:number; p:number}>;};
      delta: {gatePassRate: number; mean: number; p95: number; pAtLeastT: Array<{t:number; dp:number}>;};
    };
  };
  relatedClauses: string[]; // clause anchors like you already do
};

## 1.4 Detection logic (when to emit)

A prototype_create_suggestion is emitted if (A AND B) or C are true:

A) “No usable existing prototype” functional test

Consider the candidate set CAND = top K prototypes by either:

existing combinedScore (preferred), or

cosine similarity to targetSignature, or

lowest distance in gap detection (k-nearest)

Use K = 10 (deterministic).

Define usable(p) in stored-mood-regime:

gatePassRate(p) >= G_MIN

and pAtLeastT(p, t*) >= P_MIN

and conflictRate(p) <= CONFLICT_MAX (if conflictRate is available; otherwise ignore)

Where:

G_MIN = 0.30

P_MIN = 0.10

CONFLICT_MAX = 0.20

t* is the expression-implied intensity threshold:

If an anchor clause exists (e.g. gratitude >= 0.55), set t* = that clause threshold.

Else set t* = 0.55 default (or your global “meaningful” threshold).

If no p ∈ CAND satisfies usable(p), then A is true.

B) “Proposed prototype materially improves fit”

You only suggest creation if your synthesized prototype p_new is predicted to outperform the best existing by a minimum margin:

Let best = argmax_p score(p) where score is lexicographic:

pAtLeastT(p, t*)

then gatePassRate(p)

then p95(p)

Require:

pAtLeastT(p_new, t*) - pAtLeastT(best, t*) >= DP_MIN

DP_MIN = 0.15 (15 percentage points absolute in the regime)
OR, if both are tiny (<0.05), require:

pAtLeastT(p_new, t*) >= 0.10 (it reaches “non-hopeless”)

C) Prototype space hole (geometry gap) strong signal

If gap metrics indicate a hole:

nearestDistance > D_CREATE OR nearestDistancePercentile >= 95

Where D_CREATE = 0.45 (calibrate later, but pick something firm to start).

If C is true, you can emit even if B is weaker, but still require p_new to pass basic sanity:

gatePassRate(p_new) >= 0.20 and not all-zero weights.

Severity / confidence

Confidence high if (A && B) or (C && B)

Confidence medium if C true but B only barely passes sanity thresholds

Severity:

high if the linked clause is [DECISIVE] in blocker analysis and this recommendation targets that clause’s prototype

else medium if clause is top-3 impact

else low

## 1.5 Prototype synthesis algorithm (deterministic)
1.5.1 Build target vector v

Initialize v[axis]=0 for all axes.
For each target signature entry:

if dir ↑: v[axis] = +importance

if dir ↓: v[axis] = -importance

Normalize:

v_norm = v / max(ε, ||v||2) with ε = 1e-9

1.5.2 Choose anchor weights/gates

If anchorPrototypeName exists and is in prototypes:

w0 = weights(anchor)

g0 = gates(anchor) (or empty array if none)
Else:

w0 = 0 vector

g0 = []

1.5.3 Blend + resolve conflicts

Compute preliminary weights:

w = w0 + λ * v_norm

λ default 0.70 (constant)

Conflict resolution against regime bounds:
For each axis a that has a regime bound, enforce:

If regime effectively caps axis to ≤ small max (e.g. max <= 0.10) and w[a] > 0.25, then:

set w[a] = 0 (conservative) unless the target signature wants it positive (v[a] > 0), in which case clamp to +0.10.

If regime effectively floors axis to ≥ large min (e.g. min >= -0.10) and w[a] < -0.25, then:

set w[a] = 0 unless v[a] < 0, else clamp to -0.10.

(Those thresholds keep it deterministic; you can tune later.)

Then clamp each weight to [-1,1].

Sparsify:

Keep top N_KEEP = 6 axes by absolute |w[a]|

Set others to 0

Ensure at least 3 non-zero axes; if fewer, keep more until 3.

1.5.4 Generate gates

Start with gates = [...g0].

Add regime-derived gates only for axes with importance ≥ I_GATE = 0.45, max 3 additions:

If dir ↓ and regime has max: add axis <= regime.max

If dir ↑ and regime has min: add axis >= regime.min

Convert bounds to your gate string format (normalized values, like threat <= 0.25).

Gate pruning rule (must be satisfiable):

If any generated gate is impossible given regime bounds (e.g. adds axis >= 0.3 but regime.max=0.25), drop it.

Final gate list order:

anchor gates (original order)

added gates sorted by descending importance, then axis name for determinism

1.5.5 Name synthesis (deterministic)

If anchor exists:

base = anchorPrototypeName
Else:

base = top axis direction pattern name (optional)

Modifiers derived from strongest negative/positive axes in target signature:

if self_evaluation is ↓ with importance ≥ 0.45 and affiliation ↑ ≥0.45: add “indebted”

if agency_control ↓ ≥0.45: add “surrender” (optional)
You can start simple:

name = inferredModifier + "_" + base

Ensure uniqueness: if name already exists, append _v2, _v3 deterministically.

1.5.6 Predicted fit computation

Evaluate p_new over stored-mood-regime contexts exactly as you do for existing prototypes:

gate pass rate

intensity distribution stats

pAtLeastT for t* and maybe (t* - 0.1, t*, t* + 0.1)

Then compute comparison vs best existing in CAND.

1.6 Evidence entries required

Your report should include at minimum these evidence items:

Gap evidence (if C triggered): nearestDistance + percentile

Best existing prototype fit: gatePassRate + P(I≥t*)

New prototype fit: gatePassRate + P(I≥t*)

Delta: improvement in P(I≥t*)

Show the target signature vector (axes + importance + direction)

Show anchor prototype used (if any)

All numeric evidence must be deterministic and reproducible.

## 2) Invariants (must always hold)
Determinism & stability

Deterministic output: same inputs → byte-identical recommendation payload (ordering included).

No randomness in synthesis or selection (no sampling beyond already-fixed stored contexts).

Safety / non-destructive

Recommendation must never modify existing prototypes; only proposes a new entry.

Proposal must not include invalid axes; weights subset must be from known axis enums.

Validity of proposed prototype

All proposed weights must be in [-1.0, 1.0].

Proposed weights must have ≥ 3 non-zero entries (to avoid degenerate “one-axis” prototypes).

Proposed gates must be satisfiable under the mood regime:

For each gate axis >= x, must have regime.max undefined or ≥ x

For each gate axis <= x, must have regime.min undefined or ≤ x

Proposed gates must be parseable by your gate parser (same grammar as existing gates).

Proposed prototype evaluation must not produce NaN/Infinity; intensity must remain in [0,1].

Emission criteria correctness

If emitted, at least one trigger condition must hold:

(A && B) OR C (per spec)

If not emitted, at least one of:

usable prototype exists in top K OR

synthesized prototype fails improvement thresholds OR

gap is below thresholds

Evidence consistency

Evidence numbers must match metrics shown elsewhere in the report for the same population.

Linked clauses must exist and be the ones used to define t*/anchor.

## 3) Tests (must pass)

I’ll describe these as unit tests (fast) + integration tests (using your existing fixture-style reports). You can implement in tests/unit/expressionDiagnostics/services/recommendationEngine.test.js and a new file for synthesis if needed.

3.1 Unit tests: detection logic
Test: emits when no usable prototype and synthesized improves (A && B)

Fixture:

Provide a targetSignature and regime.

Provide prototypeFitTable for 10 prototypes where all fail usable:

gatePassRate < 0.30 OR P(I≥t*) < 0.10

Provide synthesized prototype eval returning:

gatePassRate >= 0.30

P(I≥t*) >= 0.25

Expect:

recommendation list includes exactly one prototype_create_suggestion

confidence = high

evidence includes bestExisting + proposed + delta

proposedPrototype present with valid weights/gates

relatedClauses includes anchor clause id

Test: does NOT emit if a usable prototype exists (A fails)

Make one prototype have:

gatePassRate 0.6

P(I≥t*) 0.2

Even if synthesized would improve, spec says A must hold unless C triggers.

Expect: no prototype_create_suggestion unless C is forced true.

Test: does NOT emit if synthesized doesn’t materially improve (B fails)

All prototypes unusable; synthesized exists but:

delta P(I≥t*) < DP_MIN

and P(I≥t*) < 0.10

Expect: no emission.

Test: emits on geometry gap (C true) with basic sanity

Set nearestDistance = 0.55 percentile 98

synthesized has gatePassRate 0.25 and non-zero weights

Expect: emits with confidence medium/high depending on B

Test: severity assignment

Provide blocker metadata:

anchor clause flagged [DECISIVE]

Expect severity high (or per your mapping) and explainable “Why”.

3.2 Unit tests: synthesis algorithm
Test: deterministic name/weights/gates

Run synthesis twice with same inputs

Expect deep equality (including order of gates and weight keys if you standardize ordering)

Test: weight bounds and sparsity

Use a signature that would create >6 non-zero weights

Expect:

only top 6 are non-zero

all in [-1,1]

at least 3 non-zero

Test: conflict resolution clamps weights

Provide regime max for axis very low (e.g. max=0.05) and preliminary w[a]=0.6

Expect w[a] becomes 0 or 0.10 (per rule) deterministically

Test: gate generation respects satisfiability

Provide regime where threat.max=0.25 but target signature wants threat ↑ and would generate threat >= 0.3

Expect that gate is dropped

Test: gate order stable

Anchor gates must come first in original order

Added gates sorted by importance desc then axis name

3.3 Integration tests: end-to-end recommendation output
Test: full RecommendationEngine output includes new type and schema-valid payload

Use a report fixture similar to yours (stored-mood-regime contexts + prototypes)

Force conditions to trigger and check:

output JSON is schema-valid

all evidence references populations/clauses that exist

no NaNs / undefined fields

Test: regression guard — no emission on “good coverage + good fit”

Use a fixture where:

nearestDistance <= 0.30

best existing usable prototype exists

Expect: no prototype_create_suggestion

Test: stable sorting with multiple recommendations

If your engine outputs multiple recommendations, ensure the ordering is stable:

by severity desc, then type name, then related clause id

Ensures deterministic diffs in report outputs.

3.4 Property-based “invariants as tests” (cheap, high value)

Even without full property-based infra, add a looped test over a few randomized-but-seeded synthetic signatures:

For 20 generated signatures (seeded):

run synthesis

assert invariants 5–9 (bounds, satisfiable gates, non-zero weights)

Seeded randomness is fine inside tests as long as deterministic.

## Practical calibration note (so this doesn’t spam)

Start with conservative thresholds (as in spec). Then add a single global “spam brake”:

Do not emit if nearestDistance <= 0.35 and bestExisting.pAtLeastT >= 0.15

even if A is barely true from conflictRate weirdness

This keeps it from recommending new prototypes when existing ones are “fine”.

