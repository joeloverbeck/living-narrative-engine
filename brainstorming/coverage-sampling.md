# Coverage Sampling

We want to add coverage sampling to our Monte Carlo implementation (code behind the 'Run Simulation' button) in expression-diagnostics.md .

## Why coverage sampling fits your pipeline

Coverage sampling directly answers the practical question:

“In the region of state space my expression is probing, do any prototypes actually activate and produce the required intensities?”

Because you already generate witness states in Monte Carlo, you can compute coverage almost for free:

Define the region of interest R
For an expression, R should usually be: samples where all non-problem clauses pass (or pass except the one you’re diagnosing), so you’re not mixing “prototype gap” with unrelated blockers.

For each witness state in R, compute prototype outputs exactly as the engine does:

check gates

compute intensity formula

gate-fail ⇒ intensity = 0

Declare “covered” if at least one prototype (or a small set) reaches a meaningful intensity threshold τ for the variables the expression depends on.

Report:

coverage_rate = covered_count / |R|

“uncovered mass” examples (the witness states where you expected something to light up but nothing does)

which gate clauses are failing most in the uncovered set (this often reveals “gate walls”)

This is not flaky — it’s aligned with how your engine actually behaves.

## The one caveat (and how to handle it)

Coverage sampling depends on your sampling distribution. But since you’re already running Monte Carlo “under the regime,” that’s a feature: you’re measuring practical reachability. If you want robustness, you can add:

conditional / targeted sampling around the expression’s boundary (so you don’t miss rare but important regions),

or stratified sampling (ensure you hit threat near gate thresholds, etc.).

Bottom line

If your goal is: “does my system actually produce the emotional/sexual values my expression prereqs demand, given gates?” → coverage sampling is the better primary method.

## Metrics and UI panels

I’ll propose a concrete set of coverage-sampling metrics and UI panels that plug directly into your existing Monte Carlo “witness states + blockers” workflow, without adding any convex-hull machinery.

Here’s what I’d ship as coverage-sampling output (report + optional UI), assuming you already have:

lots of Monte Carlo witness states

per-clause failure rates / “Top blockers”

ability to evaluate prototypes (weights + gates) on a state

I’m only using coverage sampling; no convex hull, no fancy geometry.

### 1) Coverage Summary (top of report)

A compact block that answers: “is the prototype library actually lighting up where this expression lives?”

Fields

Region definition (R): what subset of witness states are we evaluating coverage on?

default: R = states where all expression prerequisites pass

if expression is “Impossible/Very Rare”: fall back to R = states where all prerequisites except the top blocker pass (or “pass >= k of n”)

|R|: how many witness states in region

Coverage rate @ τ: percent of R where at least one relevant prototype activates above threshold τ

show for τ in [0.2, 0.4, 0.6] (three numbers)

Top covering prototypes: top 5 prototypes by “wins” (how often each is the best active prototype in R)

Uncovered rate: 1 - coverage_rate (for each τ)

Why this matters
This tells you immediately if you have a “dead zone” (gates hard-zero everything) in the region the expression tries to use.

### 2) Variable Coverage (because expressions care about specific vars)

Expressions don’t need “some prototype”; they need specific variables to take plausible values (emotions + sexualStates + moodAxes checks).

So: compute coverage per target variable the expression references.

For each variable V referenced in the expression prereqs (e.g. emotions.relief, sexualStates.sexual_confidence, moodAxes.engagement):

Observed range in R: min/median/p90 (from witness states)

Model-implied support:

Activation rate: how often V’s prototype(s) are active (gates pass)

Intensity distribution: median/p90 intensity for that variable (after gates)

Ceiling estimate: p99 intensity in R (practical max under regime)

Requirement pressure:

if expression demands V >= t: report gap margin = t - p99(V) (if positive)

This is the killer line item:

“Expression demands relief >= 0.55, but p99(relief) in R = 0.21 → impossible without changing prototypes/gates or regime.”

### 3) Uncovered Mass Diagnostics (why nothing activates)

When coverage fails, you want to know which gates are responsible.

For witness states in R that are uncovered (no relevant prototype ≥ τ):

Gate failure leaderboard

show top 10 failing gates across all relevant prototypes

include: failure rate within uncovered set, and “closest margin” stats (how far from threshold)

Prototype near-miss list

prototypes that would have been active except for 1 gate (or the smallest margin gate)

show “nearest gate” per prototype: e.g. threat <= 0.20 violated by +0.07

This turns “gap” into actionable choices:

loosen a gate

adjust weights

add a new prototype

change regime distribution

### 4) Coverage Map by “Regime Axes” (small but high value)

A simple 2D binning view over your mood axes space.

Pick the 2–3 axes most involved in the expression prereqs (or most variable):

e.g. threat vs agency_control (or arousal vs engagement)

For each bin:

number of samples in R

coverage rate in that bin (≥ τ)

optional: most common best prototype in that bin

In UI this is a heatmap; in report it can be a small table summary:

“Worst 5 bins by uncovered mass” + example witness state ids.

This finds “gate walls” visually:

“Everything with threat 0.25–0.40 is uncovered because all calm/relief/confidence gates require threat <= 0.20.”

### 5) Representative Witness Examples (curated, not spam)

You already have witness states; use them.

Provide 3–5 examples for each:

Covered (prototype active and matching)

Uncovered (no prototype activates enough)

Each example should show:

the state (or a compact projection: relevant variables + key axes)

which prototypes were active, their intensities

for uncovered: top 3 nearest-gate misses

This makes the report legible to humans and debuggable.

### 6) A single “Coverage Verdict” line (for the browser page)

A simple label for fast iteration:

✅ Well-covered: coverage@0.4 ≥ 90% and no required-threshold gaps

⚠️ Partially-covered: coverage@0.4 between 50–90% or mild threshold gaps

❌ Dead zone: coverage@0.4 < 50% or any “required threshold > p99” gaps

This gives you a one-glance call.

### “Non-report output” (browser page UI modules)

If I were designing the page, I’d add these panels:

Coverage Summary Card (τ toggles: 0.2/0.4/0.6)

Variable Coverage Table (sortable by “gap margin”)

Gate Wall Panel (top gate failures in uncovered mass; click → shows witness examples)

2D Coverage Heatmap (axis dropdowns)

Example Drawer (covered/uncovered examples with near-miss gates)

That’s it. No fluff.

### Implementation note (so you don’t overbuild)

You can compute all of this from your existing Monte Carlo run if you store, per witness:

state vector (or at least the variables used)

which prerequisites passed/failed (you already do)

prototype evaluation results (active? intensity? nearest gate margin)

Everything above is just aggregation + presentation.

