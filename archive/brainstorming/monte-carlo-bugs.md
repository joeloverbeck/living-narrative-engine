# Errors that look like reporting/logic bugs (not “Monte Carlo is wrong”)

Most of your core Monte Carlo outputs look internally consistent (witnesses exist, the probability funnel multiplies out correctly, and the in-regime vs global counts line up). The stuff that looks wrong is mainly the “sanity check” math/labels.

## A. The “Expected Trigger Rate Sanity Check” is objectively broken

It says:

Naive expected hits: 19,771.77

Actual hits: 66

then “✅ Normal: Actual hits align with expected”

That’s a contradiction. 66 is not “aligned” with ~19.8k.

Even worse: your own report prints P(0 hits | expected=19771.77) = 0, which (correctly) screams “this expectation is nonsense,” and then it still green-checks it.

What’s happening: your “naive probability” is not actually “product of pass rates” in any interpretable way because…

## B. “Clause Pass Rate Factors” contains impossible “pass rates”

You have:

OR Block (0.8) | 443.37%

OR Block (1) | 1728.16%

A pass rate cannot exceed 100%. Those numbers are some kind of multiplier (and based on your own naive probability calculation, they’re being multiplied in). They’re just mislabeled as pass rates.

✅ Fix: rename these to what they are (e.g. OR_inflation_factor or OR_adjustment_multiplier) and show the actual OR union pass rate (e.g. P(OR#1 pass | mood) = 37.32%, P(OR#2 pass | mood) = 95.22%), which you already compute elsewhere.

## C. Conditioning is unclear/misleading in the sanity check

In that same table, your mood-axis clauses are shown as 100% pass rate:

moodAxes.engagement >= 20 | 100%
…but later you show the same clause as failing globally ~60%.

That can be true only if the “pass rate factors” table is conditional on mood regime already passing (or uses the regime definition itself). If so, the table must say that explicitly and then the naive expectation must multiply by P(mood-regime pass) (3.47%) at minimum.

Right now it reads like an unconditional calculation and it’s not.

## D. Counting/structure confusion: “AND of 14 conditions”

You describe:

“AND of 14 conditions”
but then show:

13 required conditions + OR block with 2 leaves = 15 leaf checks

This is probably “14 top-level conjuncts, one is an OR.” That’s fine, but the phrasing confuses readers.

✅ Fix: print both numbers clearly:

Top-level conjuncts: 14 (includes 1 OR block)

Leaf clauses evaluated: 15

## E. One more subtle “looks wrong” thing: the sanity check is conceptually invalid for your system

Even if you fix the OR math, any independence-based expected-hits estimate is not a sanity check for your system because emotions are derived from the same axes, so clause truth values are correlated by construction.

So: mismatch between “naive expected” and “actual” is not evidence the Monte Carlo sampler is wrong. It’s evidence the “naive expected” model is wrong.

✅ Fix: reframe that section as Dependence Diagnostic, not “sanity check”.