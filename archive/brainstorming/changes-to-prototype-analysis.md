# Changes to Prototype Analysis

We fed ChatGPT with the following reports:

reports/prototype-analysis-system.md
reports/prototype-analysis-results.md

Among other things, it suggested the following overhaul.

## What I would change so you can reliably decide: keep vs merge vs modify vs expression

### A) Stop doing Monte Carlo per pair; do it per prototype (biggest leverage improvement)

Right now you sample per pair (20k/pair).
Instead:

- Draw a shared set of contexts C once (or several stratified pools).

- Evaluate every prototype on C → produce an output vector per prototype.

- Pairwise similarity becomes cheap vector math and far more stable.

This changes complexity from roughly O(pairs × samples) to O(prototypes × samples) + O(pairs × cheap-math). It also makes comparisons consistent.

### B) Replace Pearson-as-gatekeeper with agreement metrics + confidence intervals

For each pair compute, at minimum, on the same context pool:

- MAE / RMSE on co-pass (primary)

- MAE / RMSE globally with gated zeros (secondary)

- Activation Jaccard (you already have gateOverlapRatio)

- Conditional inclusion P(B|A), P(A|B) with Wilson/Beta CI (your nesting logic is built on these)

- Correlation only as a diagnostic (and handle constant-vector cases explicitly)

Then define:

- MERGE if global-agreement is extremely high and activation regions coincide (high overlap) and both are non-dead.

- SUBSUME / PARENT-CHILD if P(B|A) is high with CI and the narrower one rarely adds exclusive activation.

- NEEDS SEPARATION if overlap high but MAE high.

- CONVERT TO EXPRESSION if narrower prototype differs from parent by “small sparse delta” in weights/gates and has small activation volume.

### C) Add “prototype generality” and “prototype sparsity” as first-class signals

You want to prevent prototype proliferation. A very effective guardrail is:

- Gate volume estimate: how often it can activate under broad sampling (you already have onEitherRate-ish stats).

- Weight entropy / concentration: is it basically a single-axis tweak?

- Delta-from-nearest-cluster-center: is it just “anger but slightly more threat”?

Prototypes that are:

- low-volume (rare),

- low-novelty (small delta),

- and explainable as “base + modifier”
are prime expression candidates.

### D) Fix gate parsing / implication by reusing your real gate evaluator (or a canonical AST)

Your deterministic nesting depends on “complete parse” and implication checks.
If your parse is incomplete for any real-world gate string, deterministic nesting becomes unreliable, and you fall back to Monte Carlo inference.

Fix direction: represent gates in one canonical form (AST / JSON-Logic-like), and use the same compiled evaluator everywhere (runtime + analysis). If you keep a human-readable string, generate it from the AST, not the other way around.

### E) Make “Actionable Insight” suggestions data-driven (decision stump / tiny tree) + validated

Instead of hand-wavy thresholds:

1. Collect samples where (A passes xor B passes) or where |A-B| is high.

2. Fit a single split (axis + threshold + direction) that best separates those sets.

3. Propose the split only if it meaningfully reduces overlap and doesn’t crater the desired activation rate.

4. Clamp thresholds to legal axis ranges and print in the correct units.

Right now the suggestions are not safe to apply because of apparent unit/direction issues.

## Interpreting your current report (why it feels “off”)

You filtered 4095 pairs down to 193 candidates.

You then labeled 123 as nested, yet 0 merge / 0 subsumed.

That combination usually means:

the system is very willing to say “one implies the other” via conditional probs,

but your merge/subsume thresholds are so correlation-dependent that they never fire,

and the composite score is over-rewarding gate overlap, so “closest pair” ≠ “mergeable pair”.

