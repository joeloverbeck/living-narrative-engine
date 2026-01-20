# New Prototype Analysis page

We want to create a new page in our app, accessible from the section 'Emotions' of index.html , solely to produce analysis of existing prototypes (those prototypes are currently those in the lookup files of data/mods/core/lookups/ ). We want for now to dedicate the new prototype analysis page to a programmatic determination of whether some of the existing prototypes overlap in a way that would need to be consolidated or some of them removed.

Two prototypes can share the same sign pattern and still be meaningfully different because of:

weight magnitudes (one is “mostly engagement”, another is “engagement + agency_control hard”)

gates (they carve different regions of state space)

axis mix (one uses threat as a brake, another uses it as a driver)

output shaping (whatever rectification/normalization you do after the dot product)

What you actually want is a functional overlap metric: “Do these two prototypes behave the same across the contexts my engine actually produces?”

Below is a programmable approach that’s fast, explainable, and actionable.

## Goal

Add an analysis pass that can say, with evidence:

“Prototype A and Prototype B are effectively duplicates; merge/alias one.”

“Prototype A is mostly a subset of Prototype B; remove or tighten one.”

“These prototypes look structurally similar, but are not redundant (keep both).”

(Optional) “This cluster of 3+ prototypes crowds the same region; consider consolidation.”

This must be deterministic, explainable, and grounded in actual prototype behavior, not just sign patterns.

## Definitions
### Prototype

A prototype is:

weights: map axis -> coefficient

optional gates: array of string constraints (AND)

### Prototype evaluator (existing)

There must be a single “source of truth” function used by the analyzer:

evaluatePrototype(prototypeId, context) -> intensityNumber

Where:

intensity is already “gated to zero” when gates fail (same behavior as engine).

normalization/scaling matches production (moodAxes -100..100 normalized to whatever your prototype system expects).

If you don’t currently have a stable exported evaluator, you must create one and reuse it here.

### Feature Output
New Recommendation Types
1) prototype_merge_suggestion

Emitted when two prototypes are near-duplicates.

2) prototype_subsumption_suggestion

Emitted when one prototype is essentially a subset of the other.

3) prototype_overlap_cluster_suggestion (optional)

Emitted when 3+ prototypes form a tight overlap cluster.

4) prototype_overlap_info (optional)

Emitted when a pair looks structurally similar but is clearly not redundant (useful for explainability, but can be suppressed by default).

## Algorithm Overview (Two-Stage)
### Stage A: Candidate Pair Discovery (cheap filter)

Purpose: avoid expensive evaluation on every pair.

For each prototype:

1. Build a dense weight vector over canonical axis order:

Include every axis your prototypes can reference (mood axes + traits + sexual axes used in that prototype family).

Missing axis weight counts as 0.

2. Compute “active axes”:

An axis is “active” if absolute weight >= config.activeAxisEpsilon (default 0.08)

3. Record sign pattern for active axes:

sign is + or - (zero excluded)

For each pair (p, q) in the same family (emotion with emotion, sexual with sexual):
- Compute:

activeAxisOverlap: Jaccard overlap of active axis sets

signAgreement: fraction of shared active axes that have same sign

weightCosineSimilarity: cosine similarity of dense weight vectors (ignore gates)

- Candidate rule (defaults; configurable):

activeAxisOverlap >= 0.60

signAgreement >= 0.80

weightCosineSimilarity >= 0.85

Only candidate pairs proceed to Stage B.

### Notes

This stage is where your “same direction signature” idea belongs: as a fast bucket/filter, not as the final merge decision.

### Stage B: Functional Overlap Scoring (behavioral proof)

For each candidate pair (p, q), estimate overlap by sampling contexts and evaluating intensities.

#### Populations to sample (must support at least one)

global_uniform (required)

mood_regime (optional): contexts that satisfy an “AND-only mood constraint” extracted from expression prerequisites

empirical_logged (optional): contexts pulled from logs (if you have them)

You can implement global_uniform first and add others later.

#### Context sampling (global_uniform)

Produce contexts with axis values covering the valid domain your evaluator expects:

mood axes: sample in full range your evaluator uses

If evaluator expects normalized [-1..1], sample [-1..1]

If evaluator expects raw [-100..100], sample [-100..100]

The analyzer must NOT invent its own normalization. It must match evaluator.

traits: sample in valid range (usually 0..1 or 0..100, matching evaluator)

sexual axes: sample in valid range (usually 0..1)

#### For each sampled context:

Compute:

fp = evaluatePrototype(p, context)

fq = evaluatePrototype(q, context)

Also derive:

onP = fp > 0

onQ = fq > 0

Accumulate these stats:

#### Gate overlap stats (behavioral)

onEitherRate: percent where onP or onQ

onBothRate: percent where onP and onQ

pOnlyRate: percent where onP and not onQ

qOnlyRate: percent where onQ and not onP

These estimate how much their gates/regimes overlap in practice (without separately parsing gates).

#### Intensity similarity stats

Compute similarity only within a chosen conditioning set (configurable):

default conditioning: onEither (contexts where onP or onQ)

optional: onBoth (contexts where both are on)

Within that conditioning set, compute:

pearsonCorrelation between fp and fq

meanAbsDiff: average absolute difference |fp - fq|

dominanceP: fraction of conditioned samples where fp >= fq + dominanceDelta

dominanceQ: fraction where fq >= fp + dominanceDelta

Also collect “divergence examples”:

keep top K contexts by |fp - fq| (default K=5)

store context values and fp/fq for evidence

#### Final Pair Classification

Use thresholds (defaults; configurable):

##### Class: MERGE (near-duplicate)

Emit prototype_merge_suggestion when ALL are true:

onEitherRate >= minOnEitherRateForMerge (default 0.05)
(prevents declaring redundancy on dead prototypes)

onBothRate / onEitherRate >= minGateOverlapRatio (default 0.90)

pearsonCorrelation >= minCorrelationForMerge (default 0.98)

meanAbsDiff <= maxMeanAbsDiffForMerge (default 0.03)

neither dominance is overwhelming:

dominanceP < 0.95 AND dominanceQ < 0.95

Action suggestion:

Prefer keeping the prototype with:

higher downstream usage count (if you can compute it), else

fewer/cleaner gates, else

simpler axis set (fewer active axes)

##### Class: SUBSUMED (one is mostly subset of other)

Emit prototype_subsumption_suggestion when:

one-sided exclusivity is tiny:

pOnlyRate <= maxExclusiveRateForSubsumption (default 0.01) OR

qOnlyRate <= maxExclusiveRateForSubsumption (default 0.01)

correlation is still high in overlap region:

pearsonCorrelation >= 0.95

and dominance indicates one typically dominates:

dominanceP >= 0.95 OR dominanceQ >= 0.95

Action suggestion:

Remove/alias the subsumed one OR tighten its gates so it activates in a distinct region.

##### Class: NOT REDUNDANT

If candidate filter matched but merge/subsumption criteria fail:

Do not emit merge/subsumption.

Optionally emit prototype_overlap_info with evidence saying why (gate separation or intensity divergence).

## Recommendation Payload (Actionable Evidence)

Each emitted recommendation must include:

### Core fields

type: one of the new types

prototypeFamily: emotion or sexual

prototypes: { a: "id", b: "id" }

severity: 0..1 (see below)

confidence: 0..1 (derived from sample size + metric strength)

actions: array of concrete action strings (see below)

### Metrics block

candidateMetrics:

activeAxisOverlap

signAgreement

weightCosineSimilarity

behaviorMetrics:

onEitherRate

onBothRate

pOnlyRate

qOnlyRate

pearsonCorrelation

meanAbsDiff

dominanceP

dominanceQ

### Evidence block

sharedDrivers: top axes that contribute strongly in both prototypes

example item: { axis: "engagement", weightA: 1.0, weightB: 1.0 }

keyDifferentiators:

axes where one has strong weight and the other doesn’t

axes where sign differs

gateDiffSummary (optional):

if you can diff gates structurally (string diff is fine at first)

divergenceExamples: up to K contexts with:

context: the sampled axis values

intensityA

intensityB

absDiff

### Severity scoring (simple + explainable)

Severity must be deterministic and monotonic with redundancy.

Default:

For MERGE:

severity increases with correlation and gate overlap ratio

severity decreases with meanAbsDiff

For SUBSUMED:

severity increases with dominance and one-sided exclusivity

You can implement severity as a weighted average of normalized metrics; exact formula not important as long as:

0..1

deterministic

higher means “more urgent”

### Actions (examples)

For merge:

Replace all uses of prototype B with prototype A; keep B as alias for backward compatibility.

Delete prototype B after migration; update any expressions referencing it.

For subsumption:

Prototype B is subsumed by A in sampled regimes; consider removing B or tightening its gates to activate in a distinct region.

## Invariants (Must Always Hold)
### Determinism

With the same seed, same prototype set, same config:

emitted recommendations must be identical (order, metrics, examples).

With a different seed:

results may differ slightly in metrics, but classification should be stable for strong overlaps.

(Tested via tolerance bands; see tests.)

### Symmetry

Pairwise metrics must be symmetric where applicable:

candidate metrics symmetric (overlap/cosine/sign agreement)

behavioral metrics symmetric except for dominanceP/dominanceQ and pOnly/qOnly

If the analyzer reports (A,B), it must not also separately report (B,A).

### Metric validity

All rates must be in [0, 1]

correlation must be in [-1, 1]

meanAbsDiff must be >= 0

confidence and severity must be in [0, 1]

### No “merge” on dead prototypes

A merge/subsumption suggestion must not be emitted if onEitherRate is below the minimum threshold (default 0.05).

Dead/unreachable prototypes should be handled by a different recommendation type (you likely already have this concept).

### Evidence correctness

Every divergence example must satisfy:

absDiff equals |intensityA - intensityB|

context fields are within valid axis ranges

intensities match evaluator output for that context

### Performance safety

Analyzer must enforce a hard cap:

maximum candidate pairs processed

maximum samples per pair

must not block report generation unboundedly as prototype count grows

## Tests (Must Pass)
### Unit tests: Candidate stage

1. Active axis extraction

given weights with small magnitudes, ensure axes below epsilon are excluded

verify epsilon boundary behavior is deterministic

2. Sign agreement

verify sign agreement counts only shared active axes

verify correct handling when there are no shared active axes (should not be candidate)

3. Cosine similarity

identical vectors -> ~1

orthogonal vectors -> ~0

opposite vectors -> ~-1

missing axis weights treated as 0

4. Candidate gating

pairs that do not meet thresholds are not forwarded

pairs that meet thresholds are forwarded

### Unit tests: Behavioral stage (with stub evaluator)

Create a stub evaluatePrototype(id, context) that:

optionally gate-fails based on simple axis checks

returns deterministic dot product

Then test:

5. Gate overlap stats

build two prototypes with identical gates -> onBothRate == onEitherRate

build disjoint gates -> onBothRate == 0 and exclusivity matches expectations

6. Similarity metrics

identical prototypes -> correlation ~= 1 and meanAbsDiff ~= 0

scaled prototypes (same shape, different scale) -> correlation ~= 1 but meanAbsDiff > 0

verify classification is NOT “merge” unless meanAbsDiff threshold allows it

7. Dominance

create p always larger than q by delta when on -> dominanceP ~= 1

verify subsumption triggers when exclusivity also indicates subset

8. Divergence example selection

ensure it returns top K by abs difference

ensure examples are stable with same seed

### Unit tests: Classification logic

9. Merge classification

set up two prototypes that behave nearly identically across samples

assert prototype_merge_suggestion emitted with correct actions

10. Subsumption classification

set up p gates subset of q gates (or behavioral subset via on-rates)

set up dominance indicating one dominates

assert prototype_subsumption_suggestion emitted

11. Not redundant

set up candidates with similar weights but different gates so overlap ratio is low

assert no merge/subsumption emitted (optionally info emitted)

12. No duplicates

ensure analyzer emits only one recommendation per pair

### Determinism tests

13. Same seed deterministic

run analyzer twice with same seed

deep-equal output (including divergence examples)

14. Different seed stability (tolerance)

run analyzer with two seeds

for a strong duplicate pair, classification must remain “merge”

metrics may differ within small tolerance (configurable)

### Integration test: RecommendationEngine

15. RecommendationEngine emits and renders

given a known recommendation payload from analyzer, engine passes it through unchanged

verify type is included in report output’s recommendations section (if applicable)

## Configuration Defaults (Suggested)

Put these in PrototypeOverlapConfig.js:

activeAxisEpsilon: 0.08

candidateMinActiveAxisOverlap: 0.60

candidateMinSignAgreement: 0.80

candidateMinCosineSimilarity: 0.85

sampleCountPerPair: 8000 (global_uniform)

divergenceExamplesK: 5

dominanceDelta: 0.05

minOnEitherRateForMerge: 0.05

minGateOverlapRatio: 0.90

minCorrelationForMerge: 0.98

maxMeanAbsDiffForMerge: 0.03

maxExclusiveRateForSubsumption: 0.01

minCorrelationForSubsumption: 0.95

minDominanceForSubsumption: 0.95

maxCandidatePairs: 5000 (safety cap)

## Implementation Notes (Critical)

1. Do not parse gates if you don’t need to.
You can infer gate overlap behaviorally by using evaluator outputs (on/off), which automatically respects gates and any hidden normalization logic.

2. Use the real evaluator.
If overlap detection is based on a different interpretation of gates/normalization than production, it will lie.

3. Make population support extensible.
Even if you only implement global_uniform now, structure the code so you can add mood_regime and empirical_logged later without rewriting the core.