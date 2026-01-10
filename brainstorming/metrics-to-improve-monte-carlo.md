# Possible metrics to add to improve Monte Carlo simulation output

We use the outputs for Monte Carlo simulations in expression-diagnostics.html a lot to tweak prerequisites and know why they fail. I asked ChatGPT if there would be vital information we could display in the output that would help us fix prerequisite issues.

## ChatGPT's answer

I’ll propose a small set of extra per-clause metrics that actually change how you tune thresholds (vs “nice but noisy”), plus how to compute them cheaply from your Monte Carlo traces.

Yes. Δ + failure rate is a good start, but it’s missing the “why should I care?” knobs: how often it blocks among near-miss states, how sensitive the trigger rate is to nudging this threshold, and whether you’re fighting a ceiling effect.

Here’s the handful I’d add that actually helps you tweak prerequisites faster.

1) “Support” (fail count)

What: N_fail and N_total (or % of samples failing you already show, but raw counts matter).
Why: A clause with 0.3% failure rate might be based on 30 failures vs 3 failures depending on sample size; that changes confidence.

Show: fails: 312 / 100,000

2) Percentiles of violation, not just the mean

What: Δ_p50, Δ_p90 (median and 90th percentile of violation among failures).
Why: Mean Δ lies to you when failures are heavy-tailed (rare huge overshoots). Median tells you typical “nudge size.”

Example display: Δ: mean 0.08 | p50 0.02 | p90 0.21

3) “Near-miss rate” (within epsilon of passing)

What: share of samples within a small band of the threshold (both sides).

For x >= T: P(T - x ∈ [0, ε]) (just-barely failing) and P(x - T ∈ [0, ε]) (just-barely passing)
Why: If many samples are barely failing, lowering T a hair will buy you a lot. If almost none are near, threshold tweaks won’t help; you need upstream prototype/gates.

Show: near-miss(ε=0.02): 14.6% (choose ε per variable scale)

4) “Marginal gain” estimate for threshold tweaks (sensitivity)

What: estimated dP(trigger)/dT (or discrete: expected trigger-rate change if you relax this threshold by δ).
Why: This is the most actionable stat: it answers “If I change this from 0.55 to 0.50, what happens?”

Easy approximation:
Recompute pass/fail for just that clause at T±δ on the same samples and estimate new trigger rate assuming independence is false but useful. Better: do a one-step re-eval of the full prerequisite with only that clause toggled (still cheap).

Show: ΔP@-0.05: +0.18% (or whatever unit you use)

5) Correlation with “almost triggers” (importance among contenders)

What: compare clause failure rate among:

all samples vs

samples where all other clauses pass (“last-mile blockers”)

This is huge.

Why: A clause can have a scary overall failure rate but be irrelevant because other clauses almost never pass. Conversely, a clause with small overall failure rate can be the final boss when everything else is satisfied.

Show:

fail_all: 47%

fail_when_others_pass: 82% ← this is the one you tune first

6) Ceiling / attainability signal (max reachable, or empirical max)

What: for any emotion threshold, show:

max_observed (and p99) over samples

optionally theoretical_max if you can compute it from prototype weights and axis bounds

Why: This instantly tells you when a threshold is just impossible-ish because the variable rarely reaches it.

Show: x: p99 0.41 | max 0.52 | threshold 0.55 (above max) → stop tweaking, fix prototype/gates.

7) For delta/crossing gates: distribution of the delta itself

For clauses like (x - prevX) >= d:

show meanΔ, p90Δ of (x - prevX) (not the violation)

and P(delta > 0)

Why: If deltas are centered near 0 because your temporal model is smooth, those gates will murder triggers unless you design spikes.

Show: delta: mean 0.01 | p90 0.05 | P>0: 53%

8) Redundancy / dominance flags

What: detect clauses that are almost always implied by others (or never the decisive blocker).
Why: Prereqs bloat; redundant clauses make tuning harder and create accidental impossibilities.

Heuristic: track “decisive blocker rate” = fraction of failing samples where flipping just this clause would make the whole prereq pass.

Show: decisive: 3.1% (low → maybe redundant)

### If you only add 3 things, add these

fail_when_others_pass (last-mile blocker rate)

near-miss rate (within ε of threshold)

p50/p90 violation (robust magnitude)
