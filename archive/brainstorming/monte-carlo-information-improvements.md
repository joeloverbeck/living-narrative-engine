# Monte Carlo Information Improvements

## A. The Probability Funnel is mixing up “gate pass” with “threshold pass”

Example:

“Gate pass | mood-pass (emotions.disgust >= 0.45): 100%”

That reads like the clause passes, but it actually means the disgust prototype gates passed, not that disgust ≥ 0.45 is true. The clause itself passes only 1.35% in mood regime.

Better:

“Prototype gate pass rate (disgust), within mood regime: 100%”

“Threshold pass rate (disgust ≥ 0.45), within mood regime: 1.35%”

Or show both on one line:

disgust: gate-pass 100% → threshold-pass|gate 1.35% → threshold-pass|mood 1.35%

## B. “AND of 10 conditions” is technically true but cognitively wrong

Because 3 of those conditions are defining the mood regime and are marked redundant, the effective difficulty isn’t “10 independent walls,” it’s more like:

“Mood regime (3 axis constraints) + 5 hard emotion thresholds + 2 OR blocks”

Better headline:

“No samples satisfy the full conjunction. Effective bottlenecks: disgust≥0.45 + remorse≥0.65 + OR#1 (future_expectancy/despair)”

## C. Stored contexts vs full-sample is still too easy to misread

You do warn about it, but it’s not “felt” while reading.

Right now, a reader can easily compare:

a full-sample bound/max with

a stored-sample bound/max
and think the simulator is inconsistent.

Better:
Put a bold tag on every table header:

Population: full (100k) vs Population: stored (10k) vs Population: stored-mood-regime (362)

…and for any statistic like “Bound,” append the population:

Bound(full)=0.76 vs Bound(stored)=0.67

## D. “Prototype structurally mismatched” is too vague

Your evidence is solid (“mean|gate is far below threshold”), but the label doesn’t tell a reader what to do.

Better label variants:

“Prototype underproduces target intensity in regime”

“Threshold too high for observed distribution (in regime)”

“Regime/weights mismatch suppresses intensity”