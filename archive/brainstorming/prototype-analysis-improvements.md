# Prototype Redundancy Analyzer v2 — Specifications

## Goals

1. Stop confusing “same direction” with “same behavior.”
High Pearson correlation (computed only on co-gated samples) is useful, but it misses:

gate nesting (A implies B) and

practical indistinguishability (A and B both exceed expression thresholds together).

2. Detect and label “nested siblings” explicitly.
Examples: interest→curiosity, embarrassment→humiliation, frustration→confusion, contentment→relief.

3. Detect true redundancy even when correlation isn’t 0.98.
Example: numbness↔apathy should be called merge-worthy under sane criteria.

4. Generate actionable recommendations that the analyzer can output:

MERGE: consolidate prototypes

KEEP_DISTINCT: keep both

NESTED_SIBLINGS: keep, but treat as hierarchical or separate with gates

CONVERT_TO_EXPRESSION (optional): when something looks state-encoded but is semantically change-based

## Non-Goals

No changes to the prototype intensity formula (calculator stays as-is).

No changes to expression rendering/UI are required (but the analyzer output shape will include richer fields).

No deep NLP semantics; any name-based heuristics must be optional + configurable.

## Part A — New Metrics

You already compute:

gateOverlapRatio = onBothRate / onEitherRate (Jaccard on gate passing)

pearsonCorrelation over intensities computed only when passA && passB

### A1) Add pass rates and conditional pass probabilities

From existing counters:

passACount = onBothCount + pOnlyCount

passBCount = onBothCount + qOnlyCount

Add:

passARate = passACount / N

passBRate = passBCount / N

pA_given_B = passBCount > 0 ? onBothCount / passBCount : NaN

pB_given_A = passACount > 0 ? onBothCount / passACount : NaN

Why: This is the clean, programmable way to detect nestedness:

if pB_given_A ≈ 1, then A implies B (behaviorally, by gates).

### A2) Add co-pass sample count + guardrails

Add:

coPassCount = onBothCount

If coPassCount < minCoPassSamples, then:

pearsonCorrelation = NaN

all co-pass intensity metrics below must be NaN

classifier must not attempt MERGE or SUBSUMED based on correlation

### A3) Add co-pass intensity similarity metrics

While you currently store arrays and compute Pearson, also compute:

meanAbsDiff = mean(|IA - IB|) over co-pass samples

rmse = sqrt(mean((IA - IB)^2)) over co-pass samples

pctWithinEps = P(|IA - IB| <= eps) over co-pass samples

Config:

epsForNearEqualIntensity default ~ 0.05 (tune for your intensity range)

Why: Two prototypes can be highly correlated but still meaningfully different in magnitude (or vice versa). These numbers let you call merges correctly for numbness↔apathy and avoid false merges for “same direction but different levels.”

### A4) Add expression-threshold co-activation metrics

Expressions typically threshold emotions, so compute for a list of thresholds T = [0.4, 0.6, 0.75] (configurable):

For each t:

pHighA(t) = P(IA >= t) over all samples (with gated intensity, so fails are 0)

pHighB(t) = P(IB >= t) over all samples

pHighBoth(t) = P(IA >= t AND IB >= t) over all samples

highJaccard(t) = pHighBoth(t) / P(IA>=t OR IB>=t) (if denom>0)

highAgreement(t) = P( (IA>=t) == (IB>=t) )

Implementation detail: this requires having IA and IB available even when only one passes gates. You don’t need to store arrays—just compute intensities on demand whenever passA || passB and update running counters.

Why: This is the most “practical redundancy” signal: if two prototypes exceed 0.6 together almost always, they’ll behave as one in your expression layer.

## Part B — Gate Structure Analysis (Deterministic Nesting)

Behavioral nesting is great, but you can also compute deterministic nesting evidence by parsing gate strings.

### B1) Gate parsing into per-axis intervals

Create GateConstraintExtractor that parses each gate string of form:

<axis> <op> <number> where op ∈ {>=, >, <=, <}

Normalize strict inequalities into inclusive bounds with a configurable strictEpsilon (default 1e-6) OR preserve strictness in the model; inclusive-with-epsilon is simpler.

Aggregate into axis intervals:

lowerBound[axis] (default -∞)

upperBound[axis] (default +∞)

Example:

arousal <= 0.35 sets upper bound 0.35

arousal >= -0.30 sets lower bound -0.30

If a gate fails parsing, record unparsedGates[] and mark parseStatus = PARTIAL.

### B2) Gate implication check (interval subset)

Create GateImplicationEvaluator:

implies(A, B) iff for every axis:

A.lower >= B.lower AND A.upper <= B.upper
(remember: tighter interval implies looser interval)

Return:

A_implies_B: boolean

B_implies_A: boolean

counterExampleAxes[] (axes where implication fails)

evidence: a small structured list like:

{axis, A:[low,high], B:[low,high], relation:"wider"/"narrower"/"disjoint"}

Why: This catches “nested siblings” even if Monte Carlo sampling is weird.

## Part C — New Classifications & Recommendation Types

Extend OverlapClassifier to emit one of:

MERGE_RECOMMENDED

SUBSUMED_RECOMMENDED (existing, but improved evidence)

NESTED_SIBLINGS (new)

NEEDS_SEPARATION (new)

KEEP_DISTINCT

CONVERT_TO_EXPRESSION (new)

### C1) Definitions (configurable thresholds)

Add to prototypeOverlapConfig.js:

{
  minCoPassSamples: 200,
  nestedConditionalThreshold: 0.97,         // for pB_given_A or pA_given_B
  strongGateOverlapRatio: 0.80,
  strongCorrelationForMerge: 0.97,          // you can lower from 0.98 safely once using new metrics
  maxMeanAbsDiffForMerge: 0.05,
  minPctWithinEpsForMerge: 0.85,
  intensityEps: 0.05,
  highThresholds: [0.4, 0.6, 0.75],
  minHighJaccardForMergeAtT: { "0.6": 0.75 },  // optional keyed thresholds
  // optional name hints for change-emotions:
  changeEmotionNameHints: ["relief", "surprise_startle", "release"],
  enableConvertToExpression: true
}

### C2) MERGE_RECOMMENDED

Require all:

onEitherRate >= minOnEitherRateForMerge (existing)

gateOverlapRatio >= strongGateOverlapRatio

coPassCount >= minCoPassSamples

pearsonCorrelation >= strongCorrelationForMerge

meanAbsDiff <= maxMeanAbsDiffForMerge

pctWithinEps >= minPctWithinEpsForMerge

Optional extra strong signal:

at t=0.6: highJaccard(t) >= minHighJaccardForMergeAtT[0.6]

This is what makes numbness↔apathy programmatically merge-worthy.

### C3) SUBSUMED_RECOMMENDED (A subsumed by B)

If either deterministic gate implication OR behavioral conditional implies nesting:

Let A⊂B if:

(GateImplication: A_implies_B == true AND B_implies_A == false) OR

(pB_given_A >= nestedConditionalThreshold AND pA_given_B < 0.995) (directional)

Then if additionally:

coPassCount >= minCoPassSamples

pearsonCorrelation >= minCorrelationForSubsumption (existing threshold)

plus exclusive rate for the broader one is not tiny (so the broader actually adds coverage):

if A implies B, then B is broader; require qOnlyRate (B-only) >= minExclusiveForBroader (new, default e.g. 0.01)

Emit: “A is subsumed by B” with evidence:

implication direction + conditional probabilities

key gate differences (see recommendation generator)

### C4) NESTED_SIBLINGS

Trigger when:

nesting exists (deterministic or behavioral), but MERGE is not satisfied (usually because intensity difference is meaningful OR you want to keep tiers)

Formally:

(A_implies_B XOR B_implies_A) OR (pB_given_A >= nestedConditionalThreshold XOR pA_given_B >= nestedConditionalThreshold)
AND

NOT MERGE_RECOMMENDED

This is what your analyzer should output for:

interest↔curiosity

embarrassment↔humiliation

frustration↔confusion

contentment↔relief (at least)

Recommendation text should include:

“These form a hierarchy / tier. Either embrace hierarchy (suppress lower-tier when higher-tier is active) OR separate regimes using gate banding.”

### C5) NEEDS_SEPARATION

Trigger when:

gateOverlapRatio is high (e.g. >= 0.70)

and they are not nested (no implication both ways)

but correlation is high enough that they behave similarly in the same gate region

and meanAbsDiff is not tiny (so MERGE is wrong)

This is the “too similar but not identical” bucket.

### C6) KEEP_DISTINCT

Default when:

gateOverlapRatio low (e.g. < 0.25) OR

coPassCount < minCoPassSamples OR

correlation low / evidence shows real separation

This catches:

freeze↔submission

stress_acute↔fear

anxiety↔panic

curiosity↔fascination, etc.

### C7) CONVERT_TO_EXPRESSION (optional but recommended)

This is how you can make the analyzer produce the “relief should be an expression (change-gated)” recommendation.

Trigger when all:

classification is NESTED_SIBLINGS or SUBSUMED_RECOMMENDED

AND the “candidate” prototype name matches changeEmotionNameHints OR it matches a purely structural heuristic:

gates strongly enforce a “low threat” steady state (e.g., threat <= 0.20 or <=0.25)

weights strongly negative on threat (e.g. threat <= -0.8)

and it is nested under another low-threat positive-ish state

Then emit:

“Consider converting <name> into an expression with a delta gate on <axis> (e.g., threat drop).”

This is configurable and can be turned off if you dislike name-based hints.

## Part D — Recommendation Generation (Actionable “what to do”)

The analyzer should output structured recommendations, not just labels.

### D1) Evidence payload shape (backward compatible)

Extend existing result object per pair with:

{
  pearsonCorrelation,
  gateOverlap: { onEitherRate, onBothRate, pOnlyRate, qOnlyRate, gateOverlapRatio },
  passRates: { passARate, passBRate, pA_given_B, pB_given_A, coPassCount },
  intensitySimilarity: { meanAbsDiff, rmse, pctWithinEps },
  highCoactivation: {
    thresholds: [
      { t: 0.4, pHighA, pHighB, pHighBoth, highJaccard, highAgreement },
      ...
    ]
  },
  gateImplication: { A_implies_B, B_implies_A, evidence, unparsedGates },
  classification,
  recommendations: [
    { type, message, suggestedActions: [...], evidenceRefs: [...] }
  ]
}

### D2) Gate banding suggestion generator (for NESTED_SIBLINGS / NEEDS_SEPARATION)

Given gate intervals for A and B:

Identify axes where one is strictly tighter (A interval ⊂ B interval).

For the broader proto, suggest adding a constraint that excludes the tighter proto’s core region by adding the opposite bound with a margin.

Example rule (configurable margin bandMargin = 0.05):

If tighter has valence <= -0.10, suggest broader add valence >= -0.05

If tighter has threat <= 0.20, suggest broader add threat >= 0.25

If tighter has arousal >= 0.55, suggest broader add arousal <= 0.50

Clamp bounds to [-1, 1].

Also suggest “expression-level suppression”:

“When higher-tier active, cap the lower-tier to 0” (your collision-resolution pattern)

This is exactly how you programmatically reproduce my advice for:

frustration/confusion (add valence band + engagement floor to confusion)

embarrassment/humiliation (band embarrassment, deepen humiliation)

interest/curiosity (separate by arousal/control bands)

contentment/relief (convert relief or band it harshly)

## Part E — Required Invariants

These must always hold; failing them is a bug.

### E1) Count arithmetic invariants

For every pair:

onEitherCount == onBothCount + pOnlyCount + qOnlyCount

passACount == onBothCount + pOnlyCount

passBCount == onBothCount + qOnlyCount

Rates are counts / N

### E2) Probability bounds

All rates in [0, 1]

gateOverlapRatio in [0, 1] when onEitherRate > 0, else 0

pearsonCorrelation in [-1, 1] or NaN

pA_given_B, pB_given_A in [0, 1] or NaN when denom=0

### E3) Co-pass metric validity

If coPassCount < minCoPassSamples:

intensitySimilarity fields are NaN

classification must not be MERGE or SUBSUMED due to intensity/correlation signals alone

### E4) Gate parsing invariants

For each axis interval: lower <= upper else mark prototype’s gate set as unsatisfiable (optional “DEAD_GATESET” classification)

If any gate unparsed, parseStatus must reflect PARTIAL and implication must fall back to behavioral conditionals

### E5) Determinism invariant for tests

Behavioral evaluator must support deterministic evaluation by:

accepting an injected contexts[], OR

using a seeded RNG supplied via config

Without this, your tests will be flaky.

## Part F — Test Plan

Assuming Jest. You’ll want both unit tests and classifier integration tests.

### F1) Unit tests — GateConstraintExtractor

File: tests/unit/prototypeOverlap/gateConstraintExtractor.test.js

Cases:

Parses simple bounds:

"threat <= 0.20" → upper=0.20

"arousal >= -0.30" → lower=-0.30

Combines bounds on same axis:

["arousal >= -0.30", "arousal <= 0.35"] → interval [-0.30, 0.35]

Handles strict inequality:

"valence > 0.10" → lower=0.10+eps (or strict preserved)

Unparsed gate captured:

"weird gate" ends in unparsedGates[], parseStatus=PARTIAL

### F2) Unit tests — GateImplicationEvaluator

File: tests/unit/prototypeOverlap/gateImplicationEvaluator.test.js

Use your actual definitions:

frustration gates: engagement >= 0.10, agency_control <= 0.10, valence <= -0.10

confusion gates: agency_control <= 0.20

Assert:

frustration_implies_confusion == true

confusion_implies_frustration == false

Similarly:

contentment_implies_relief == true (given your gates)

humiliation_implies_embarrassment == true

### F3) Unit tests — BehavioralOverlapEvaluator new metrics

File: tests/unit/prototypeOverlap/behavioralOverlapEvaluator.metrics.test.js

You must be able to inject deterministic contexts.

Add test contexts where you can predict pass/fail:

Example makeContext(overrides) defaulting missing axes to 0.

Construct 10 contexts where:

4 pass both

3 pass A only

2 pass B only

1 passes neither

Assert all count/rate invariants:

conditional probabilities match expected ratios

gateOverlapRatio matches onBoth / onEither

coPassCount correct

Also test pctWithinEps by making IA and IB identical in co-pass contexts.

### F4) Integration tests — OverlapClassifier new classes

File: tests/unit/prototypeOverlap/overlapClassifier.v2.test.js

#### Test: MERGE_RECOMMENDED (numbness vs apathy)

Create contexts that:

satisfy both gates frequently (low arousal, low engagement)

produce near-equal intensities (because weights similar)

Assert:

classification is MERGE_RECOMMENDED

recommendation includes merge rationale + evidence fields non-NaN

#### Test: NESTED_SIBLINGS (interest vs curiosity)

Create contexts where:

engagement >=0.2 always

threat varies above/below 0.40 so curiosity sometimes fails while interest passes
Assert:

interest does not imply curiosity

curiosity implies interest (behavioral conditional near 1)

classification NESTED_SIBLINGS

#### Test: KEEP_DISTINCT (freeze vs submission)

Construct contexts where each gate region is mostly disjoint.
Assert:

low gateOverlapRatio

classification KEEP_DISTINCT

#### Test: CONVERT_TO_EXPRESSION (contentment vs relief) (feature-flagged)

With enableConvertToExpression=true and changeEmotionNameHints containing "relief",
Assert:

classification at least NESTED_SIBLINGS

recommendations include CONVERT_TO_EXPRESSION with suggested delta-axis hint (threat drop)

### F5) Snapshot tests — output shape stability

File: tests/unit/prototypeOverlap/outputShape.snapshot.test.js

For one pair, snapshot the full result object to ensure future edits don’t break the UI/consumer.

## Part G — What this makes your analyzer say for your “top 10”

Once implemented, you should see these outcomes without hardcoding pairs:

numbness ↔ apathy → MERGE_RECOMMENDED
(high overlap + high similarity + low meanAbsDiff)

interest ↔ curiosity → NESTED_SIBLINGS
(curiosity implies interest; recommend hierarchy handling or gate banding)

embarrassment ↔ humiliation → NESTED_SIBLINGS
(humiliation implies embarrassment; recommend banding embarrassment, deepen humiliation gates)

frustration ↔ confusion → NESTED_SIBLINGS
(frustration implies confusion; recommend making confusion neutral-valence / higher inhibitory_control regime)

contentment ↔ relief → NESTED_SIBLINGS + optionally CONVERT_TO_EXPRESSION
(nested + low-threat steady-state pattern; optionally name-hinted)

Everything with tiny overlap (freeze↔submission, anxiety↔panic, stress_acute↔fear) will reliably fall into KEEP_DISTINCT, even if correlation is moderately high when both happen to co-pass.

## One brutal opinion (because it matters)

Your previous merge threshold of 0.98 on correlation was compensating for missing metrics. After you add meanAbsDiff/pctWithinEps + conditional pass probabilities + high-threshold coactivation, you can safely lower correlation requirements and still avoid false merges. The analyzer will become meaningfully aligned with “would these collapse my expression layer in practice?”