# Conclusions Engine

Below is a programmable “Conclusions engine” spec you can drive entirely from the data you already generate (domain summaries + per-variable coverage). It’s designed to output a Conclusions section that reads like an expert’s instant take—without naming any specific emotion.

## Inputs the engine assumes
DomainSummary (per domain)

domain: string (e.g., emotions, moodAxes, previousEmotions…)

variables: int

rangeCoverage: float in [0,1]

binCoverage: float in [0,1] (10 equal-width bins)

tailLow: float in [0,1] (share in bottom tailPct)

tailHigh: float in [0,1] (share in top tailPct)

rating: enum (good/partial/poor/unknown) — optional, can be computed

VariableCoverage (per variable)

name: string (you will not print this unless you want a “watchlist” subsection)

domain: string

rangeCoverage, binCoverage, tailLow, tailHigh, rating

Global

tailPct: float (defaults to 0.10 if not specified)

Optional but strongly recommended:

sampleCount: int (lets you scale confidence)

## Derived features (compute once)

Let:

expectedTail = tailPct

tailLowRatio = tailLow / expectedTail

tailHighRatio = tailHigh / expectedTail

tailMinRatio = min(tailLowRatio, tailHighRatio)

tailMaxRatio = max(tailLowRatio, tailHighRatio)

tailAsymmetry = tailMaxRatio / max(tailMinRatio, 1e-9) (big means lopsided)

tailStarvedSide = "high" if tailHighRatio < tailLowRatio else "low"

Also compute “coverage class” per metric:

Range coverage class

>= 0.90 → full

0.80–0.90 → mostly

0.65–0.80 → partial

< 0.65 → poor

Bin coverage class

>= 0.90 → well-spread

0.75–0.90 → ok

< 0.75 → clumped

Tail health class (compared to expectedTail)

tailRatio >= 0.7 → healthy

0.2–0.7 → thin

0.05–0.2 → starved

< 0.05 → near-zero

## Output structure (what the report should generate)
Conclusions

Global sampling reliability (one paragraph)

Per-domain conclusions (bulleted, ordered by severity)

Variable watchlist summary (optional: top N worst, without naming them unless user opts in)

Implications for expression feasibility interpretation (generic rules, no specific variables)

Action suggestions (optional but valuable: “what to change”)

You can output (1)–(4) even if you omit suggestions.

## Rule set: automatic conclusions (domain-level)

Each rule emits:

severity: info | warn | critical

title: short label

text: templated narrative

appliesTo: domain or global

evidence: metric snippets to print (numbers)

### Rule D1 — High-end starvation (critical)

Condition

tailHighRatio < 0.05 (i.e., top tail has <5% of the expected mass)
Emit

Severity: critical

Text template:

“This domain almost never reaches the upper tail (top {tailPct:%}). Feasibility estimates for any prerequisites needing high values are unreliable; ‘rare/impossible’ may reflect sampling starvation rather than logic.”

Evidence to print

tailHigh, tailPct, optionally tailHighRatio

### Rule D2 — Low-end starvation (critical)

Same as D1 but for low tail.
Condition

tailLowRatio < 0.05
Text template

“This domain almost never reaches the lower tail …”

### Rule D3 — Strong skew / lopsided tails (warn/critical)

Condition

tailAsymmetry >= 6 → warn

tailAsymmetry >= 20 → critical
Emit

“Tail coverage is strongly lopsided (one side of the distribution dominates). Interpret threshold-driven conclusions asymmetrically: one extreme is well tested; the other is effectively untested.”

Include which side is starved:

If tailStarvedSide == "high": “…upper extreme is effectively untested.”

Else: “…lower extreme is effectively untested.”

### Rule D4 — Range truncation (warn/critical)

Condition

rangeCoverage < 0.80 → warn

rangeCoverage < 0.65 → critical
Emit

“Observed values do not span the domain’s full range. This indicates hard ceilings/floors, gating, or a narrow sampler prior. Any conclusions depending on the missing range are low-confidence.”

### Rule D5 — Clumping / poor exploration (warn)

Condition

binCoverage < 0.75
Emit

“Samples cluster into a subset of bins rather than exploring the space smoothly. Feasibility rates may be dominated by a few common regimes, masking edge cases.”

### Rule D6 — “Looks good” sanity stamp (info)

Condition

rangeCoverage >= 0.90 AND binCoverage >= 0.90 AND both tailLowRatio and tailHighRatio >= 0.7
Emit

“Coverage is broadly healthy: full range, well-spread bins, and both tails represented. Threshold-based feasibility results in this domain are likely meaningful.”

Rule set: automatic conclusions (variable-level, without naming variables)

You can summarize variable-level issues without printing names by counting how many variables fall into each issue bucket.

### Rule V1 — Upper-tail missing variables (warn/critical)

Condition

Count variables where tailHighRatio < 0.05
Emit

If count > 0:

“{count} variables effectively never hit the upper tail. Any prerequisites requiring those variables to be high cannot be validated under current sampling.”

Severity:

warn if count is small relative to domain size (<10%)

critical if large (>=25%)

### Rule V2 — Lower-tail missing variables (warn/critical)

Same pattern for tailLowRatio < 0.05.

### Rule V3 — Variables with truncated range (warn)

Condition

Count vars with rangeCoverage < 0.80
Emit

“{count} variables show truncated range coverage, consistent with ceilings/floors or gating.”

## Optional “Watchlist” subsection (still expression-agnostic)

Instead of naming variables, you can print:

“Worst range coverage: min={minRangeCoverage:.0%}”

“Worst upper-tail coverage: min tailHigh={minTailHigh:.4%}”

“Worst lower-tail dominance: max tailLow={maxTailLow:.2%}”

If you do allow naming, this becomes a “Variables to inspect” list (but your prompt says don’t—so keep it numeric).

## Rule set: implications for interpreting feasibility (generic, no specific variables)

These are the “what a pro would conclude” statements that connect sampling health to expression feasibility without knowing expressions.

### Rule I1 — High-threshold feasibility is untrustworthy if the high tail is starved (critical)

Condition

Any domain has tailHighRatio < 0.2 (thin/starved)
Emit

“Do not trust feasibility estimates for prerequisites that target the upper end of this domain; the sampler is not generating those states often enough to test them.”

### Rule I2 — Low-threshold feasibility is untrustworthy if the low tail is starved (critical)
 
Mirror of I1.

### Rule I3 — Delta/crossing gates can be falsely “impossible” if previous-state tails are missing (warn/critical)

Condition

any previous* domain has starved tail(s)
Emit

“Change-gated prerequisites (spikes/crossings) may be under-tested if prior-state extremes are missing. Apparent impossibility may reflect missing prior conditions, not faulty logic.”

### Rule I4 — If mood/axis domains are healthy, axis failures are probably real (info/warn)

Condition

a domain is D6 healthy
Emit

“Because this domain is well covered, repeated failures involving it likely indicate strict thresholds or over-constrained logic rather than sampling gaps.”

### Rule I5 — If bins are clumped, feasibility can be biased toward common regimes (warn)

Condition

binCoverage < 0.75
Emit

“Feasibility rates may be biased by overrepresented regimes; edge-case prerequisites may be incorrectly labeled rare/impossible.”

## Severity ranking & de-duplication

Emit critical first, then warn, then info.

Don’t spam. If D1 triggers for a domain, you can suppress weaker tail-related rules for that domain (D3), unless you want a short supporting clause.

Cap conclusions:

global: max 2–3 bullets

per domain: max 2 bullets

variable summary: max 2 bullets
Total: ~6–10 bullets max.

## Text templates (drop-in strings)

Use these exact “expert voice” templates with numbers inserted:

Global header template

“Coverage diagnostics indicate whether feasibility results reflect real prerequisite constraints or simply missing parts of the sampled state space.”

Domain bullet templates

Upper tail near-zero (critical):

“{domain}: upper tail is effectively untested (top {tailPct:%} has {tailHigh:.4%} of samples). High-threshold feasibility results are not trustworthy here.”

Lower tail near-zero (critical):

“{domain}: lower tail is effectively untested (bottom {tailPct:%} has {tailLow:.2%} of samples). Low-threshold feasibility results are not trustworthy here.”

Range truncated (warn/critical):

“{domain}: observed range spans only {rangeCoverage:.0%} of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.”

Bins clumped (warn):

“{domain}: bin coverage is {binCoverage:.0%}, indicating clumping. Rates may be biased toward a few common regimes.”

Healthy (info):

“{domain}: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.”

Variable summary templates

“Across variables: {countUpperStarved} show near-zero upper-tail coverage; {countRangeTruncated} show truncated range. Those regions are effectively unvalidated by current sampling.”

## Optional: a single computed “Reliability score” (so conclusions can be shorter)

Per domain:

score = 0
score += 40 * clamp01((rangeCoverage - 0.65) / 0.35)
score += 30 * clamp01((binCoverage - 0.70) / 0.30)
score += 15 * clamp01(min(tailLowRatio, 1))          # capped at expected
score += 15 * clamp01(min(tailHighRatio, 1))


Then map:

>= 80: reliable

60–79: mostly reliable

40–59: questionable

< 40: unreliable

Conclusion template:

“{domain} reliability: {bucket}. Tail coverage is the dominant limiting factor when low.”

## What this buys you

With this spec, your report can automatically say things like:

“Upper extremes are untested → don’t trust ‘impossible’ for high thresholds.”

“Axis coverage is healthy → axis failures are probably real.”

“Range is truncated → there are ceilings/floors or gating.”

“Clumping → feasibility is regime-biased.”

No emotion names. No expression knowledge required. Just disciplined inference from the coverage metrics.