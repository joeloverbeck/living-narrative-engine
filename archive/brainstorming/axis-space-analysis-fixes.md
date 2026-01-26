# Axis Space Analysis Fixes

This is relating to the reports:

reports/axis-space-analysis-technical-report.md
reports/axis-space-analysis.md

I provided those to ChatGPT to determine if there were bugs or possible improvements to be made.

## ChatGPT's response

Here’s what jumps out after reading your results and the technical report, plus what I’d change to make “axis-gap detection” actually dependable.

1) Your PCA is not measuring what you think it’s measuring (and the numbers prove it)

Your report says:

Explained by top 4 PCs: 49.1%

Residual variance: 30.3%

80% variance needs 10 components; 90% needs 13 

axis-space-analysis

Those figures match PCA on column-standardized (z-scored) axis weights (i.e., a correlation-matrix PCA), not “rows normalized to unit vectors” as the technical report claims. 

axis-space-analysis-technical-r…

That’s not just documentation drift: it changes what gets flagged. With z-scoring, rarely-used axes get exaggerated, and prototypes that touch them look “weird” by construction.

### The bigger problem: your “expected axis count” is effectively 7

From the same numbers, your PCA residual (30.3%) corresponds to “variance not explained by the first 7 components.” That means your pipeline is implicitly treating the world as “we expect 7 dimensions,” while your prototype vectors live in 23 axes (mood + traits + sexual). 

axis-space-analysis

So your PCA is basically saying:

“Your 23-axis world can’t be compressed into 7 PCs without losing 30% variance.”

That’s… unsurprising, and it’s not the same thing as:

“You’re missing an axis, you’re hacking.”

2) Reconstruction error is currently a “uses non-core axes” detector

Your “poorly fitting prototypes” are:

sympathy (RMSE 1.366)

sexual_indifference (1.291)

empathic_distress (1.062)

nostalgia (0.918)

lonely_yearning (0.884) 

axis-space-analysis

Look at their “Top Axes by Weight” in the report: empathy axes, sex_inhibition, temporal_orientation, affiliation… 

axis-space-analysis

Given you’re reconstructing from a small PC set (“expected axes”), RMSE is guaranteed to spike for prototypes that depend on specialized trait/sexual axes. That’s not necessarily a “gap”; it can just mean “this prototype correctly uses specialized dimensions.”

Also: you compute RMSE in the standardized space (effectively), so again rare axes dominate error.

3) Multi-axis conflict detection is very likely polluted by sparsity (tons of false positives)

You flag 7 “Multi-Axis Conflicts,” each with 11–13 active axes and “sign balance” values like 9%, 33%, 45%, 85%. 

axis-space-analysis

Your described method uses an IQR rule per axis:

threshold = Q3 + IQR * 1.5

“high on 2+ axes simultaneously” + sign-balance rule 

axis-space-analysis-technical-r…

This blows up in sparse axes because for many axes Q3=0 and IQR=0, making the threshold 0. Then any non-zero weight becomes “high.” Result: “multi-axis conflict” degenerates into “prototype uses many niche axes.”

That’s exactly the opposite of what you want (you want “unusually strong on multiple axes,” not “non-zero on multiple axes”).

4) There are real implementation/reporting inconsistencies you should fix immediately

These are straightforward “bugs / footguns”:

Threshold mismatch (>= vs >) between signal counting and verdict logic at exactly 0.15 residual variance. 

axis-space-analysis-technical-r…

Two threshold names for the same PCA residual threshold (pcaResidualVarianceThreshold vs residualVarianceThreshold). 

axis-space-analysis-technical-r…

The UI shows “Dimensions Used: --” (looks like you’re not plumbing a key metric through). 

axis-space-analysis

Recommendation naming inconsistency (NEW_AXIS vs ADD_AXIS) is confusing in the report snippet vs notes.

Technical report says “normalized to unit vectors,” but the observed spectrum matches z-scoring; either the report is wrong or the code changed.

5) The core conceptual mismatch: “missing axis” vs “latent direction”

In your system, prototypes are already representable in the current axis basis (you literally define them as weights over axes). So “missing axis” can’t mean “can’t represent the point.”

What you actually mean (and what “hacks” are) is closer to:

“Multiple prototypes are forced to use an awkward combination of existing axes to express one coherent factor.”

That’s a basis quality / interpretability problem, not a representational-capacity problem.

Your current PCA residual heuristic is a weak proxy for that.

6) Concrete upgrades that will make this robust
A) Split the analysis by axis family (or you’ll keep lying to yourself)

Run separate analyses for:

mood axes only

affect traits only

sexual axes only
…and optionally a combined view.

Right now, your PCA/RMSE is effectively penalizing prototypes for using traits/sexual axes when the “expected dimension count” is small. That guarantees noise.

Note by reviewer (me): We already offer the options in the UI to run the analysis by emotions, sexual states, or both. We intend to always run both, because perhaps the uses of mood axes and affect traits and sexual variables in the whole set of prototypes indicates cross-family gaps in mood axes, affect traits, etc.

B) Replace “residual variance > 15%” with “PC alignment” (this is the big one)

Instead of treating residual as “missing dimension,” compute:

For each top PC (especially beyond your “expected” cutoff), compute max cosine similarity to any single axis basis vector.

If a PC carries substantial variance and is poorly aligned with all existing axes, that’s a genuine “latent factor not captured cleanly by a single axis.”

Then, output the top axis loadings of that PC (interpretability). Right now you only list top prototypes (spellbound_absorption, nostalgia, etc.), which is much less actionable than “this component is basically {temporal_orientation + affiliation − self_evaluation …}”.

C) Fix multi-axis conflicts so sparsity can’t zero-threshold you

Do one of these (in order of sanity):

Define “high magnitude” deterministically: |w| >= 0.6 (or 0.5).
Your weights are bounded; pretending you need IQR to find “strong” is overengineering.

If you insist on per-axis distribution thresholds:

compute thresholds on non-zero weights only, and

use two-tailed detection: high positive (>= Q3+…) OR high negative (<= Q1-…).

For “active axes,” don’t count w != 0. Count |w| >= ε (like 0.05 or 0.1), otherwise microscopic “flavor weights” inflate “complexity” and ruin statistics.

D) Add an explicit “proxy/hack detector” (this is what you actually want)

Deterministic and very effective:

For each axis A:

collect prototypes where |w_A| >= t (say 0.5)

cluster those prototypes by their remaining weights (cosine distance)

if they split cleanly into 2+ clusters with different co-usage patterns, axis A is doing double duty.

That’s exactly how you would have caught “future_expectancy is secretly temporal focus” earlier.

E) Gate-aware analysis (optional but massively improves truthfulness)

Right now you analyze weights in a vacuum. But gates define the reachable region.
A prototype can look “complex” in weights but be extremely constrained by gates (or vice versa).

A deterministic compromise (no Monte Carlo required):

approximate each prototype’s “active-region centroid” by solving a constrained optimization (or sampling a fixed low-discrepancy grid if you want deterministic coverage)

run your gap/proxy detection on those effective vectors, not raw weights.

F) Tighten the verdict logic so “MAYBE” isn’t the default forever

Your current rule says high residual alone ⇒ MAYBE 

axis-space-analysis

.
Given the setup, that will fire constantly.

Make MAYBE require at least one structural corroborator, e.g.:

“poor PC alignment” (from B) and ≥N prototypes with high complexity sharing a direction, or

a proxy detector hit (from D), or

a real coverage gap cluster (but fix coverage first).

7) What your current run is really telling you (useful, but different)

This run is basically yelling:

“Some prototypes lean heavily on specialized trait/sexual/temporal axes and don’t compress into your ‘expected’ low-dimensional mood-core picture.”

That may still be valuable if your strategic goal is “keep the core small,” but it is not a reliable detector of “we need a brand-new axis because we’re hacking.”