# Improving our recommendations section of our Monte Carlo implementation

We've added a 'Recommendations' section to our Monte Carlo simulation output in expression-diagnostics.html . This final section offers specific recommendations about how to improve the trigger rate of the involved expression. These recommendations should be authoritative (not vibe-based), and based on hard-data. Basically what we want to build is a rule-driven diagnosis engine that only speaks when the data clears explicit thresholds, and always prints the evidence/denominators.

For now we only have two recommendations. Our goal now is to add a new one:

## A recommendation for “You allow mood states where X is gate-clamped to zero”

This is basically a gate mismatch, but framed as “expression regime is too permissive”.

### Emit when:

gateClampRate >= 0.20

AND the expression mood-regime does not constrain the gate axis enough (or at all)

AND adding a constraint would preserve enough of the mood-regime

### You can compute an actionable suggestion:

For each failing gate axis >= g, compute within mood-regime:

fractionBelowG

propose moodAxes.axis >= g' where g' is:

either the gate value,

or a slightly lower percentile if you want “soft alignment”

### Also include a regime shrink estimate:

newRegimeSize / oldRegimeSize

This makes the recommendation “authoritative” and not hand-wavy.

## ChatGPT's contribution

I asked ChatGPT what would be necessary to implement that new recommendation to our system. It's response:

### Where in the code to implement it

You’ll touch 5 logical areas (whatever your filenames are):

#### Expression analysis plan / dependency scan

You need a pre-pass that answers:

Which leaf clauses are emotion-threshold clauses (emotions.X >= t / <= t)?

For each such clause, what are the prototype gate predicates that can clamp it to 0?

Which gate axes (moodAxes., sexualArousal, affectTraits.) appear in those gate predicates?

Output: an AnalysisPlan that includes trackedGateAxes and emotionClauseGateMap.

#### Sampler / evaluator

You already compute:

moodPass (in-regime)

gatePass vs gateClamp per emotion clause (you show it in the table)

You now also need to collect axis distributions inside the mood regime, but only for the axes you care about (from the analysis plan).

#### Stats collector

Add a “mood-regime axis histogram” collector:

For mood axes: exact discrete counts for integers [-100..100] is trivial and better than percentiles.

For sexual/traits: counts for [0..100].

Also add per-gate-axis “fails gate” counters inside mood-regime, if you want quick summaries.

#### Recommendation engine

New recommender: gate_clamp_regime_permissive (name it whatever).

It runs after you have:

mood-regime bounds

per-clause gateClampRate

gate predicates per clause

mood-regime axis histograms (or a reservoir of mood-regime samples)

#### Report renderer

A new recommendation card with:

What is clamped, how often, which gate(s) are mismatched

Proposed constraint(s) (copy-paste JSON-Logic snippet)

Regime shrink estimate

Predicted clamp reduction (and ideally predicted clause pass improvement)

### The recommendation: exact emission logic
Emit when (per emotion-threshold clause)

You specified:

gateClampRate >= 0.20
Use the mood-regime clamp rate:
gateClampRate = gateClampCount_inMood / moodRegimeCount

AND

The mood-regime does not constrain the gate axis “enough (or at all)”

Formalize this via implication between regime bounds and gate predicates (details below).

AND

Adding a constraint would “preserve enough” of the mood-regime

Formalize as: keepRatio >= MIN_KEEP (pick a constant; see below),

and require newRegimeCount >= MIN_NEW_N for confidence.

“Does not constrain enough”: implication check (authoritative)

Represent your mood-regime as per-axis bounds:

type Bounds = { lo: number; hi: number } // raw units, inclusive
moodBounds: Record<string /* moodAxes.axis */, Bounds>


For each gate predicate like moodAxes.arousal >= 10 (raw) or arousal >= 0.10 (normalized):

Convert gate threshold into the same raw scale your constraints use (moodAxes raw [-100..100], etc.)

Then check if regime bounds imply the gate:

function impliedByRegime(bounds: Bounds | undefined, op: ">="|"<="|">"|"<", t: number): boolean {
  if (!bounds) return false
  if (op === ">=") return bounds.lo >= t
  if (op === ">")  return bounds.lo >  t
  if (op === "<=") return bounds.hi <= t
  if (op === "<")  return bounds.hi <  t
}


If a gate predicate is implied, it cannot explain clamping in the mood regime (and shouldn’t be recommended).
If none of the gate predicates are non-implied, do not emit (and consider it a bug if clampRate is still high).

This implication rule is what makes the recommendation “authoritative”: you’re proving the regime admits gate-failing states.

### Data you must compute (minimal, sufficient)

You asked for:

fractionBelowG

suggested g' (gate value or soft alignment)

newRegimeSize / oldRegimeSize

1) fractionBelowG inside the mood regime

For each non-implied gate axis predicate:

If gate is axis >= g
fractionBelowG = P(axis < g | moodRegime)

If gate is axis <= g
fractionBelowG = P(axis > g | moodRegime)
(same concept: “fraction that would fail the gate”)

With discrete histograms this is exact:

fractionBelowG = count(axisValue < g) / moodRegimeCount
fractionAboveG = count(axisValue > g) / moodRegimeCount

2) propose g' (hard vs soft)

You wanted:

either g' = gateThreshold

or a “slightly lower percentile” for soft alignment

Define constants:

MIN_KEEP (how much mood-regime must remain): e.g. 0.60 (my strong opinion: below 0.5 it’s usually not “preserving enough”, it’s a redesign)

SOFT_TARGET_KEEP: same as MIN_KEEP, or slightly higher like 0.70

Hard alignment candidate

g' = gateThreshold (in raw units)

Compute keep ratio:

For axis >= g': keepRatio = P(axis >= g' | moodRegime) = 1 - fractionBelowG'

For axis <= g': keepRatio = P(axis <= g' | moodRegime)

If keepRatio >= MIN_KEEP, this is acceptable.

Soft alignment candidate
Only used if hard alignment shrinks too much.

Pick g' as a quantile of the mood-regime distribution to preserve SOFT_TARGET_KEEP:

For axis >= g gates:

choose g' such that P(axis >= g') = SOFT_TARGET_KEEP

g' = quantile(axis, 1 - SOFT_TARGET_KEEP)

and clamp: g' = min(g, g') so you don’t go stricter than the gate

For axis <= g gates:

choose g' such that P(axis <= g') = SOFT_TARGET_KEEP

g' = quantile(axis, SOFT_TARGET_KEEP)

clamp: g' = max(g, g')

With histograms, quantiles are exact.

3) regime shrink estimate

This is just:

shrink = newRegimeCount / oldRegimeCount = keepRatio

…but only if the new constraint is on a single axis.

If you propose multiple constraints (often correct), compute shrink using either:

exact sample replay on the mood-regime sample set, or

histogram-based approximation (not recommended; correlations matter).

Best approach (cheap, accurate):

Keep a reservoir (or full list if small) of mood-regime samples with their axis values.

Then you can simulate any candidate constraint set exactly.

### Make it actually useful: predict impact, not just shrink

Your current spec stops at “preserve enough.” To avoid hand-waviness, you should also compute:

Predicted clamp reduction (per clause)

Given candidate constraint(s) C:

predClampRate = P(gateFails | moodRegime ∩ C)

You can compute this exactly by replaying mood-regime samples:

- Filter to those satisfying C

- Evaluate the gate predicate(s) for the prototype

- Count failures

This is the number that makes the recommendation feel “real”.

Predicted clause pass improvement (optional but great)

For a threshold clause like emotions.anger >= 0.4, you can also predict:

predPassRate = P(finalIntensity >= t | moodRegime ∩ C)

Same replay, but evaluate the full emotion pipeline (or reuse cached evaluations).

### Choosing the “best” suggestion when there are multiple gate predicates

Many prototypes have multiple gate predicates (ANDed). Clamping happens if any fails.

Do this:

Build candidate constraints per gate predicate:

hard and maybe soft

Evaluate combinations up to size K (K=2 or 3 is plenty; gates are usually small):

For each combination, compute:

keepRatio

predClampRate

predPassRate (optional)

Keep only those with keepRatio >= MIN_KEEP and newN >= MIN_NEW_N

Score them:

A simple, robust scoring function:

score = (clampRate - predClampRate) * keepRatio

Pick max score, but also show the runner-up if it’s close.

This prevents recommending something that “fixes clamp” by deleting 95% of the regime.

### Invariants that must pass (this is your “don’t lie to me” layer)

These are non-negotiable; add assertions and/or unit tests.

#### Gate accounting invariants

For each emotion clause, within mood-regime:

gatePassCount + gateClampCount == moodRegimeCount_forClause
(if you define “clamp” as “gate failed”, there’s no third state)

gateClampRate == 1 - gatePassRate (within epsilon for floats)

If the regime bounds imply all gate predicates, then:

gateClampRate must be ~0
If not, you have a scale mismatch (raw vs normalized) or the implication logic is wrong.

#### Histogram invariants

For each tracked axis histogram:

sumBins == moodRegimeCount
(or == number of mood-regime samples you actually recorded)

Quantile monotonicity:

quantile(p1) <= quantile(p2) for p1 < p2

#### Recommendation invariants

Only emit if:

clampRate threshold met

at least one gate predicate is not implied

and your proposed constraint improves clamp meaningfully:

predClampRate < clampRate - MIN_DELTA (pick e.g. 0.05)

Never emit a constraint that is already present or weaker than an existing regime bound.

Example: if regime already has arousal >= 15, don’t propose >= 10.

If you emit “hard alignment” (g' = gate), then after applying the constraint:

predClampRate should drop close to 0 for that gate axis, though other gates may still fail.

If it doesn’t, you’re not aligning the same axis/scale you think you are.

### Tests that should pass
#### Unit tests (fast, surgical)

Implication logic

regime arousal >= -5 does NOT imply gate arousal >= 10

regime valence <= -20 implies gate valence <= -15

fractionBelowG from histogram

build a tiny histogram and verify exact fractions

Quantile selection

verify that soft g' preserves the target keep ratio (within 1 bin)

Single-gate prediction replay

create 20 mood-regime samples with known arousal values

gate is arousal >= 10

verify predClampRate and keepRatio exactly

Multi-gate combination search

two gates on two axes with correlation

ensure combination scoring picks the expected set (requires replay, not histogram approximation)

#### Integration tests (end-to-end on a toy expression)

Emits when it should

craft expression mood regime that allows arousal below gate

ensure recommendation appears with correct axis, g, fractionBelowG, keepRatio

Does not emit when it shouldn’t

clampRate just below 0.20

or regime already implies gate

or MIN_KEEP fails

Report snapshot stability

golden snapshot (or structured JSON output) for recommendation payload:

type, clause link, axis, suggested constraints, keepRatio, predClampRate

#### Property-based tests (worth it if you already have infra)

For random discrete mood-regime samples:

If you set g' = gateThreshold for a gate axis >= g, then

fractionBelowG' inside new regime should be 0

This catches off-by-one bin boundaries and integer/float mismatch.

### How to present it so it’s useful, not confusing

A recommendation card should answer 5 questions immediately:

What got clamped?
“emotions.anger is clamped to 0 in 26.1% of mood-regime states.”

Which gate caused it? (show the gate predicates)

“Gate requires: arousal >= 10, valence <= -15”

“Mood regime allows: arousal >= -5, valence <= -10”

How permissive is the regime relative to the gate?
Show fractionBelowG per mismatched gate axis:

“Within mood regime: P(arousal < 10) = 0.31”

“Within mood regime: P(valence > -15) = 0.22”
(choose the correct direction per operator)

What should we change? (copy/paste)
Provide JSON-Logic snippets, in raw units, and clearly label “adds/tightens mood constraint”:

{
  "and": [
    { ">=": [ { "var": "moodAxes.arousal" }, 10 ] },
    { "<=": [ { "var": "moodAxes.valence" }, -15 ] }
  ]
}


If you choose soft alignment, label it explicitly:

“Soft alignment (preserve ≥70%): moodAxes.arousal >= 6 (instead of 10)”

What will it cost / what will it buy? (the killer feature)

“Regime preserved: 0.68 (232 / 341)”

“Predicted clamp rate after change: 0.04 (was 0.26)”

Optional: “Predicted clause pass rate: 0.19 (was 0.11)”

Avoid the #1 confusion source: denominators

Always print denominators:

clampRate is within mood-regime: gateClampCount / moodRegimeCount

fractionBelowG is within mood-regime too

shrink is relative to mood-regime, not global

If mood-regime N is small, slap a badge:

“Low confidence (N=30 stored, N=341 full)”
…and compute using full mood-regime samples whenever possible.

### TL;DR implementation checklist

 Pre-scan expression → find emotion clauses → pull prototype gates → list gate axes

 During simulation, for mood-regime samples, collect axis histograms (exact discrete)

 For each emotion clause: if clampRate ≥ 0.20, find gate predicates not implied by regime

 For each mismatched gate axis: compute fraction failing gate, propose hard/soft g'

 Replay mood-regime samples to compute keepRatio + predClampRate for candidate constraint sets

 Emit only if keepRatio ≥ MIN_KEEP and predClampRate improves materially

 Render card with: clamp %, gate vs regime mismatch, fractionBelowG, copy/paste constraints, shrink, predicted clamp reduction