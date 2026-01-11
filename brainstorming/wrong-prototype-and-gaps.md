# Feature: adding to Monte Carlo analysis an analysis of whether the wrong prototype was picked or if there's a missing prototype gap

## Can you depict “maybe you picked the wrong prototype” / “there’s a missing prototype gap” mathematically?

Yes — and you can do it in a way that makes the report feel like a diagnostic instrument rather than a pile of stats.

Add a “Prototype Fit & Substitution” section (this eliminates the need to dump full prototype JSON)

Goal: Given the expression’s mood constraints (and optional exclusions), rank all emotion prototypes by how well they “fit” the regime and satisfy the prerequisite intent.

For every emotion prototype E in core:emotion_prototypes, precompute these under the expression’s mood regime:

### Gate pass rate

P(gates_E pass | mood_regime)

and its complement mass P(gates_E fail | mood_regime) (this is often the whole story)

### Intensity distribution (conditional on gates passing)

quantiles: P50 / P90 / P95

P(intensity_E >= t | mood_regime) for relevant thresholds t (use your current threshold and a few candidates)

### “Conflicts with the regime” score
This is huge and very compact:

For each constrained axis, compare constraint direction with prototype weight sign.

Example rule: if constraint wants affiliation high but prototype weight for affiliation is negative, that’s a conflict.

Summarize as:

#conflicting_axes / #constrained_axes

plus an overall “conflict magnitude” like Σ |weight_axis| over conflicting axes

### “Compatibility with exclusions”
If your expression caps other emotions (contempt/disgust/hatred/etc), compute:

P(all exclusion caps pass | mood_regime AND intensity_E >= t)
This answers: “If we use prototype E as the main signal, do we accidentally drag in contempt/hatred/etc?”

### Ranked leaderboard
Output top 10 prototypes by a composite score (all computed, no LLM needed for math), e.g.:

High P(intensity_E >= t | mood_regime)

High P(gates pass | mood_regime)

Low conflicts

High compatibility-with-exclusions

This directly enables: “You used anger, but protest_anger fits the regime 8× better” without reading full JSON.

## Add a “Implied Prototype from the Prereqs” section (turn your prereqs into a target vector)

Right now, prototype selection is guessy. You can make it numeric:

### Convert the expression’s constraints into a target “mood signature”:

A vector over axes with desired direction and relative importance:

e.g., high affiliation, low valence, low self_eval, moderate threat, high engagement, moderate arousal

You can set importance weights from:

clause tightness (narrow ranges tighter = more important)

last-mile counts (clauses that matter most get higher weight)

### Convert each prototype’s weight vector into the same axis space.

### Compute cosine similarity (or correlation) between:

target signature vector vs prototype weight vector

### Combine with gate pass rate under mood regime:

similarity alone is not enough if gates almost never pass.

Output:

- top prototypes by similarity
- top prototypes by gate pass
- top prototypes by “both”

This is the mathematical version of “maybe anger is the wrong prototype.”

## Gap detection: detect “missing prototype” as a coverage problem

Treat each prototype as a point in “prototype space”:

- Weights vector (continuous)
- Gate vector (direction + thresholds per axis)

Now define the expression’s desired point (from the target signature above, plus implied gates from constraints).

Then compute:

- distance to nearest prototype (weights distance + gate distance)
- if nearest distance is large AND no prototype has decent P(intensity >= t | mood_regime), you flag a prototype gap.

Report output:

- “Nearest prototypes” (kNN list) with distances
- “Coverage warning: no prototype within radius R”
- “Suggested new prototype (auto-synthesized)”:
-- weights = weighted average of nearest neighbors (or fit directly from your sampled mood regime via regression)
-- gates = derived from quantiles of mood regime that best separate high-intensity from low-intensity

This is how you make “gap detection” objective.
