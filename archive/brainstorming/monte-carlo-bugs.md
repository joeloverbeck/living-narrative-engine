# Possible errors that suggest the Monte Carlo implementation (or report generator) is wrong

## A. Definite reporting bug: delta clauses are mislabeled as absolute clauses

In Non-Axis Clause Feasibility, the last two rows are shown as:

emotions.remorse >= 0.120

emotions.guilt >= 0.120

But in your prerequisites those are clearly delta constraints inside OR Block #2:

(emotions.remorse - previousEmotions.remorse) >= 0.12

(emotions.guilt - previousEmotions.guilt) >= 0.12

The pass rates shown there (~47% and ~67%) line up with the delta clause rates, so it looks like the evaluator is correct but the label renderer dropped the previous* term. That’s the kind of bug that misleads both humans and LLMs.

Fix: anywhere you stringify a clause, ensure the full expression AST is preserved (including previous* vars), not “pretty-printed” from a partially-normalized node.

## B. “Impact +0.04 pp” is not credible given zero hits, unless it’s not trigger-rate impact

Your Recommendations claim:

Impact (full sample): +0.04 pp

If that means “+0.04 percentage points to expression trigger rate,” that would imply ~40 hits per 100k. But you observed 0/100k. That’s not impossible (variance exists), but it’s wildly inconsistent with everything else in the report (and would almost certainly produce some hits).

So one of these is true:

“Impact” is actually clause-level pass-rate impact (or “modeled uplift”), not expression trigger uplift, and it’s mislabeled, or

Your impact estimator is producing unanchored numbers in the zero-hit regime.

Fix: split this into two fields:

Diagnosis confidence (e.g., “axis sign conflict: high”)

Trigger-rate impact confidence (with automatic downgrade to “very low” when baseline hits < K, e.g., K=20)



