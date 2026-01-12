# ChatGPT recommended updates to the prototype discovery section of expression-diagnostics.html

I asked ChatGPT whether our 'Prototype Fit Analysis' section is good as desirable. ChatGPT answered:

### How to mathematically depict “maybe you picked the wrong prototype” and “prototype gap exists”

You’re already halfway there with:

Implied Prototype from Prerequisites (signature + cosine similarity)

Prototype Fit Analysis (gate pass + intensity quantiles)

Prototype Gap Detection (kNN distances)

To make this mathematically decisive (and LLM-friendly without external prototype dumps), add these precomputed artifacts to the report.

4.1 Prototype replacement should be a scored, testable hypothesis — not a vibe

For each candidate prototype P that could replace an emotion condition in the expression (e.g., replace anger with protest_anger), include:

A) Constraint-overlap probability

P(gates_P pass | mood-regime)

P(intensity_P >= t | mood-regime AND gates_P pass)

and thus P(intensity_P >= t | mood-regime).

B) Expression-level counterfactual trigger rate
You already try this with “Global Expression Sensitivity,” but you need it in a form that works when baseline triggers are ~0.

Do it as:

importance sampling / conditional resampling restricted to “near-feasible” regions, and report the effective sample size.

Or: compute counterfactual trigger rate conditioned on all non-target clauses passing:

P(expression triggers | all other clauses pass, prototype swapped)
This is exactly the “last-mile” concept, but applied to swap experiments.

C) “Why” in numbers
For the candidate prototype, show:

top 3 axis contribution deltas vs the current prototype under the mood regime
(e.g., “affiliation flips from negative weight to positive weight” is a numerical reason).

This lets an LLM say “swap anger→protest_anger” without seeing the whole prototype JSON.

### 4.2 “Prototype gap” detection should be based on coverage geometry, not just nearest neighbor distance

Your current “Nearest Distance: 0.13” is useful, but it doesn’t tell you if that’s normal or a hole.

Add these:

A) Distance calibration
Compute the distribution of nearest-neighbor distances among your prototypes themselves in the same space.

Then report:

gap_z = (dist_to_nearest - mean_nn_dist) / std_nn_dist

and percentiles: “this implied point is farther than 95% of prototype-to-prototype nearest distances”.

If implied point sits in the extreme tail → strong evidence of a gap.

B) Local density / kNN radius
Report:

mean distance to k=5 nearest prototypes

density estimate like 1 / (ε + mean_kNN_dist)

Low density region → gap candidate.

C) “Suggested new prototype” as a projection
This is the killer feature.

Let the implied signature be a vector v (weights + gate thresholds encoded). Find the closest point p* in the convex hull (or constrained simplex) of existing prototypes, or the closest point on a manifold fit (PCA/UMAP).

Then output:

v - p* as a “missing direction” vector

and a concrete proposed weight/gate deltas (already normalized)

That gives you a mathematically grounded “you’re missing a prototype like X” without showing all prototypes.

### 4.3 Make “implied prototype from prerequisites” unambiguous and reproducible

Right now you list axis directions + importance. Great.

To make it airtight, define a standardized mapping:

From each prerequisite clause on a mood axis, derive:

target direction (↑/↓),

strength = normalized tightness (how restrictive the threshold is relative to full axis range),

plus optional “softness” if it’s an OR alternative.

Then the implied vector is literally computed, not handcrafted.

Also: encode OR blocks properly:

For OR blocks, compute an expected signature as a weighted mixture based on observed OR-branch success frequencies (you already compute those).
That makes the implied prototype reflect what the expression actually uses to pass, not what it theoretically allows.