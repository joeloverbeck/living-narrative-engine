# New Feature - Dead Branch Detection

## What to implement, and what existing data is involved
### New concept: “Alternative” objects for OR blocks
You already treat OR blocks specially (you output OR Block #k, alternative coverage, overlap). Formalize each OR block into:

#### OrBlock

id (stable path / node id)

population (e.g. mood-regime, global, stored-mood-regime)

support = N samples evaluated for the OR block in that population

alternatives[] = list of Alternative

#### Alternative

id (stable: derived from clause refs, order-independent hash)

kind: "leaf" or "and_group"

clauses[]: list of leaf clause refs (for leaf alt, length=1)

passCount, passRate within the population

status: "ACTIVE" | "RARE" | "DEAD_BRANCH" | "UNOBSERVED"

deadEvidence[] (when DEAD_BRANCH)

limitingConstraints[] (human explanation)

### Existing data you already have (from the report)
You already compute most of what’s needed:

A) Alternative pass rates in mood regime

Today: you output union pass in mood regime and leaf clause pass rates; but you don’t always emit per-alternative pass in mood regime.

Implement: while you evaluate the expression tree per sample, also track each alternative truth value for OR nodes. That’s one boolean per alternative per sample (cheap).

B) “Max observed in-regime” for the key leaf clause(s)
You already compute, somewhere, these per-variable stats in-regime:

For emotion threshold clauses (e.g. emotions.rage >= 0.45), your “Prototype Math Analysis” shows:

observedMaxInMoodRegime for final (and raw)

gatePassRateInMoodRegime and clamp rate

For moodAxes and other scalar variables, your coverage stats include min/max or can be exposed similarly.

C) Prototype + regime binding explanations
You already compute “Binding Axes (Structural Conflicts)” for an emotion in a regime:

examples: positive_weight_low_max (arousal weight positive but regime caps arousal)

negative_weight_high_min (weight negative but regime forces min positive)

You also already list the mood-regime constraints explicitly (the “Population: stored-mood-regime … constraints: …” section). That’s the mapping key to turn “arousal max=0.45” into “moodAxes.arousal <= 45”.

## DEAD_BRANCH detection algorithm
### Trigger condition (exact)
For a given OR block, population = mood-regime:

An alternative is DEAD_BRANCH iff:

passCount == 0 in this population, AND

there exists at least one structural impossibility inside that alternative under this population:

i.e. at least one leaf clause has a ceiling (or floor) in-regime that makes it unsatisfiable.

This avoids false positives where you merely didn’t sample the rare region.

### Structural impossibility for a leaf clause
Define isStructurallyImpossible(clause, populationStats):

For var >= threshold
compute maxObserved(population, var) (or for emotions: maxObservedFinal(population, emotion))

if maxObserved < threshold - eps ⇒ CEILING ⇒ impossible

For var > threshold
same check, use threshold + eps semantics (or treat as >= threshold + eps)

For var <= threshold
compute minObserved(population, var)

if minObserved > threshold + eps ⇒ FLOOR ⇒ impossible

For var < threshold
same check, use threshold - eps

### For emotion-threshold clauses (special handling)
A clause like emotions.rage >= 0.45 has two “impossibility modes”:

Clamp-impossible: if gatePassRate == 0 in population ⇒ final is always 0 ⇒ impossible for any >= t > 0

Ceiling-impossible: if maxFinalInPopulation < threshold - eps

You already compute both in your prototype math tables.

### eps (deterministic)
For normalized floats in [0,1]: eps = 1e-6 (float safety only)

For integer-effective mood axes thresholds: eps = 0 (since you collapse to integers anyway)

## Limiting constraint extraction (the “why dead?” payload)
When you mark DEAD_BRANCH, you must also explain it.

### For an alternative that is dead because of an emotion threshold clause
Return:

the dead leaf clause ref (e.g. emotions.rage >= 0.45)

maxFinalInRegime, threshold, gap = threshold - maxFinalInRegime

the binding axes from your existing prototype math analysis (e.g. arousal is positive_weight_low_max)

map each binding axis to the corresponding mood-regime constraint clause(s)

### Mapping rule
Given binding axis info like:

axis = arousal, type = positive_weight_low_max, and regime says arousal <= 0.45
Map to the original prerequisite clause that created it:

moodAxes.arousal <= 45

Similarly:

negative_weight_high_min on inhibitory_control maps to moodAxes.inhibitory_control >= 20

### Output structure
limitingConstraints[] entries should look like:

constraintClauseRef (e.g. moodAxes.arousal <= 45)

axis, prototypeWeight, regimeBound, neededDirection

a one-line explanation

Example (for your rage path):

moodAxes.arousal <= 45 + rage weight +0.95 ⇒ capped arousal prevents rage reaching 0.45 (max=0.26)

### For non-emotion clauses
Keep it simpler:

identify the leaf clause(s) that have CEILING/FLOOR

show min/max observed, threshold, gap

if it’s a derived delta (e.g. (a-b) >= 0.12) and you already compute max/min for that expression, show it; otherwise treat as “needs derived-stat exposure”.

## Where this plugs in (minimal touching)
You likely already have:

a tree evaluator

per-node pass/fail counters

report renderer

RecommendationEngine

Add one small analysis stage after blocker analysis:

DeadBranchDetector.detect(orBlocks, clauseStats, prototypeMathByEmotion, regimeConstraints) -> deadBranchFindings

Then:

attach findings onto the OR block object (so the renderer can display them)

optionally emit a recommendation item of type dead_branch

## Invariants that must pass
### 2.1 Correctness invariants
Order-invariance: Reordering OR alternatives must not change detection or explanation.

Alternative ids must be hash-based on clause refs, not array position.

Population correctness: DEAD_BRANCH is evaluated per population (global vs mood-regime can differ).

A branch may be alive globally but dead in mood-regime; that’s valid.

No “dead” without structural proof:
If passCount == 0 but no CEILING/FLOOR/clamp-impossibility exists ⇒ must not label dead.

Label "UNOBSERVED" (or "RARE") instead.

No “dead” if it passed at least once:
If passCount > 0 ⇒ status cannot be DEAD_BRANCH.

Emotion clamp rule:
If gatePassRate == 0 in population and clause is emotions.X >= t with t > 0, it is structurally impossible.

Explainability completeness:
Every DEAD_BRANCH must include:

the leaf clause(s) that prove impossibility

the numeric gap evidence

and at least one limiting constraint pointer if it’s emotion-driven and regime constraints are known.

### 2.2 Safety / UX invariants
No spam: Only flag dead branches inside OR blocks (not whole-expression), and only when it changes understanding (i.e. a branch exists but can never fire).

Stable wording: Explanations must be generated deterministically from the evidence fields.

## Tests that must pass
Below are concrete unit + integration tests (with fixtures). Use your existing report fixtures style (JSON snapshots) and assert the emitted findings.

3.1 Unit: rage path is DEAD_BRANCH in mood-regime
Given

OR block alternative = AND(emotions.rage >= 0.45, moodAxes.affiliation >= 10)

mood-regime population support N=452

alternative passCount=0

prototype math for rage in mood-regime: maxFinal = 0.26

threshold=0.45

Expect

alternative status = DEAD_BRANCH

deadEvidence contains CEILING for emotions.rage >= 0.45 with gap ≈ 0.19

limitingConstraints includes moodAxes.arousal <= 45 with prototype weight +0.95

(optionally) includes other binding constraints (inhibitory_control >= 20, affiliation >= 5) if you surface them

3.2 Unit: moral_outrage path is NOT dead (even if rare)
Given

alternative = emotions.moral_outrage >= 0.6

passCount in mood-regime = 6 (from your report)

maxFinal in mood-regime = 0.60

Expect

status != DEAD_BRANCH (likely "RARE" or "ACTIVE" depending on your thresholds)

no deadEvidence

3.3 Unit: passCount=0 but maxObserved >= threshold ⇒ UNOBSERVED, not dead
Given

alternative passCount=0

leaf maxObserved in mood-regime = 0.90

threshold = 0.85

Expect

status = "UNOBSERVED" (or "RARE")

deadEvidence empty

This prevents “dead” from becoming “we didn’t sample it”.

3.4 Unit: clamp-impossible emotion clause becomes DEAD_BRANCH
Given

alternative = emotions.X >= 0.3

gatePassRate in mood-regime = 0

passCount=0

Expect

status = DEAD_BRANCH

deadEvidence includes ALWAYS_CLAMPED (or GATE_NEVER_PASSES) with gatePassRate=0

3.5 Unit: <= floor-impossible becomes DEAD_BRANCH
Given

alternative = moodAxes.threat <= 10

minObserved in mood-regime = 30

passCount=0

Expect

DEAD_BRANCH with FLOOR evidence (minObserved > threshold)

3.6 Integration: report rendering includes the label + explanation
Snapshot test the rendered markdown (or structured report JSON) contains:

OR Block section shows alternative marked DEAD_BRANCH

explanation includes numeric evidence + constraint pointer(s)

3.7 Order invariance test
Same OR block alternatives in different order produce identical DEAD_BRANCH outputs (ids, evidence, constraints), except for display ordering if you sort.

## UI output improvements
### 4.1 In the OR block display: show alternative “liveness” at a glance
In each OR block section (both global and mood-regime views), add a small table:

Alternative	Pass | mood	Status	Why
emotions.moral_outrage >= 0.6	1.33% (6/452)	RARE	gate clamp 89% + threshold tail
(emotions.rage >= 0.45 AND moodAxes.affiliation >= 10)	0.00% (0/452)	DEAD_BRANCH	rage max=0.26 < 0.45 due to moodAxes.arousal<=45
That instantly communicates “this OR is effectively not an OR.”

### 4.2 Add an expandable “Dead branch evidence” block
When status is DEAD_BRANCH, include:

Proof: maxFinalInRegime=0.26 < threshold=0.45 (gap=0.19)

Limiting constraints:

moodAxes.arousal <= 45 (rage arousal weight +0.95; capped)

(optional) moodAxes.inhibitory_control >= 20 (rage inhibitory_control weight -0.75; forced min)

This is the exact kind of explainability you wanted.

### 4.3 Add a recommendation type: dead_branch
In the Recommendations section:

Type: dead_branch

Severity: usually low (it doesn’t change trigger rate) but high if the OR block is intended as meaningful coverage

Actions:

remove dead alternative (simplify logic), or

change regime constraints, or

swap to a prototype whose feasible range matches the regime (e.g. protest_anger instead of rage), or

lower threshold

### 4.4 Optional: “effective OR complexity” metric
For each OR block, show:

effectiveAlternatives = count(status != DEAD_BRANCH)

If it collapses to 1, annotate: “OR collapses to single path in this regime.”

## Extra

If you want this to be extremely robust, the one extra piece I’d expose (if it’s not already) is min/max observed per clause per population for derived expressions (deltas). But for your motivating case (rage path), you already have everything needed today: alternative pass counts + maxFinal in mood-regime + binding-axis → regime-constraint mapping.
