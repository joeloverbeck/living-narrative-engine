# Confusing Parts From Monte Carlo Implementation

## A. “unobserved” vs “impossible” vs “sometimes” needs stricter, explicit definitions

Right now, the report says:

Executive summary: “unobserved … not logically impossible”

Later: emotions.confusion >= 0.620 → ⛔ IMPOSSIBLE

At minimum you need three separate labels:

- Theoretically impossible (math says no solution given bounds/gates)

- Empirically unreachable (in this run) (observed max < threshold, but theory might allow it)

- Unobserved (0 hits overall expression, but no single clause has an empirical or theoretical ceiling)

…and the report must never mix them.

Wording I’d use

- “Empirical ceiling in sampled mood-regime: max(final)=0.608 < 0.620 by 0.012 (no passes observed).”

- Only say “IMPOSSIBLE” when you can prove it from constraints math, not from finite sampling.

## B. “Axis sign conflict” is a jargon label; say what it means

Instead of:

“positive_weight_low_max … lostRawSum … lostIntensity…”

Add a plain-English one-liner right there:

“This mood regime caps engagement/arousal below the levels this prototype relies on to get high intensity.”

Also: your evidence says lostIntensity is 0.06 + 0.04, while mean is 0.17 and threshold 0.62 — so even fixing that doesn’t remotely bridge the gap. The recommendation reads overstated.

Fix: show “distance-to-threshold” decomposition:

threshold - P95

threshold - max

“how much intensity you could recover if axis caps were removed”
So a consumer can see if the recommendation is actually material.

## C. The sensitivity tables are currently not useful when baseline hits are zero

You already warn “low confidence”, but the table still looks authoritative.

A better pattern for zero-hit cases is:

“We found 0 witnesses. Sensitivity sweeps on stored contexts cannot estimate expression trigger rate.”

Then show two alternative outputs that are actually actionable:

Clause quantiles in-regime (P50/P90/P95/max) + “suggest threshold to hit 1%, 5%, 10% pass”

A constructed witness attempt (see improvements below)

## D. Percent-change columns explode and mislead on tiny baselines

Example:

“+5700%” clause pass rate change (because baseline was 0.02%)

That’s mathematically fine and practically useless.

Fix: show absolute deltas primarily:

0.02% → 1.16% (+1.14 pp)
Keep percent-change as a small secondary note, or drop it.

