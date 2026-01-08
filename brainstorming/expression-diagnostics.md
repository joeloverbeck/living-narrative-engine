# Expression Diagnostics Brainstorming

We've created an in-depth emotions and expressions system. The main data files involved are:

data/mods/emotions-*/expressions/
mood.component.json
sexual_state.component.json
data/schemas/*expression*
data/mods/core/lookups/

Expression files are complicated systems intended to automatically output narrative beats based on changing emotional states (including sexual states, mood axes).

However, currently it's easy to design prerequisites for an expression that will cause it to fire very rarely, or worse yet, never fire. We want to create a new page for our app that focuses on comprehensive expression diagnostics.

It will have a button on index.html , in the 'Emotions' section, to the right of 'Expressions Simulator'.

## Problem Overview

Expressions in the engine fire when certain emotional/sexual intensity conditions are met. Each intensity (e.g. emotions.curiosity, emotions.fear, sexualStates.sexual_lust, etc.) is derived from underlying mood axes and sexual values via prototype weights and gating rules. An expression’s prerequisites can become impossible to satisfy if they demand conflicting or unattainable combinations of these intensities. For example, if one condition requires an emotion that only occurs with low threat while another requires an emotion that only occurs with high threat, no single state can meet both. We need ways to programmatically detect such issues.

### Approach 1: Formal Feasibility Analysis (Constraint Solving)

- Reference mood-and-sexual-arousal-system.md

We can treat each expression’s prerequisite as a system of constraints on the underlying mood/sexual axes. The intensity calculation is essentially linear given the gating rules:

- Gating conditions: Each emotion has prerequisite “gates” on axes that must all pass; otherwise the intensity is forced to 0. For example, confidence requires threat <= 0.20 and agency_control >= 0.10, whereas fear requires threat >= 0.30. These are inherently contradictory – an expression needing high confidence and high fear simultaneously could never trigger, since no threat value can satisfy both gates at once.

- Linear intensity formula: If all gates pass, an emotion’s intensity is the weighted sum of normalized axes divided by the sum of weight magnitudes (ensuring a 0–1 range). For instance, joy has weights on positive valence, arousal, and future_expectancy; it also gates on valence >= 0.35. Sadness has opposite valence weighting and gates on valence <= -0.20. Requiring joy ≥ 0.6 and sadness ≥ 0.6 in one expression would be impossible because the valence axis cannot be both high positive and high negative at the same time.

Solution: We can use a constraint solver or linear programming approach to check each expression:

Translate prerequisites to inequalities on axes: For each condition like emotions.X >= t, include X’s gate constraints and linear inequality Σ(w_i * axis_i) ≥ t * Σ|w_i| (ensuring intensity ≥ t). For conditions emotions.Y <= u, ensure Σ(w_i * axis_i) ≤ u * Σ|w_i| if the emotion’s gates are hypothetically satisfied. (In practice, an expression can always satisfy a “<=” by having that emotion gated off or low, so these are less restrictive – but we include them to avoid accidental violations.) Similarly translate conditions on raw axes (e.g. moodAxes.engagement >= 10 becomes engagement ≥ 10).

Check feasibility: Use a solver to find any solution for the axes (valence, arousal, etc. in range [-100,100] and sexual values in [0,100]) that satisfies all inequalities.

If a solution exists, the expression is theoretically triggerable.

If no solution exists, the prerequisites are contradictory – meaning the expression as defined can never fire under any conditions. This is a red flag to fix those prerequisite rules.

Implement in the app: We could integrate a simplified MILP (Mixed Integer Linear Programming) solver or use an SMT (Satisfiability Modulo Theories) solver to automate this check for all expressions. This would deterministically catch impossible triggers. For example, the solver would catch that an expression demanding high confidence (needs low threat) and high fear (needs high threat) has no solution. It would similarly flag any expression requiring mutually exclusive emotional states (like high joy and high sadness simultaneously).

Edge cases: Some expressions include change over time conditions (using previousEmotions deltas). These can also be analyzed – e.g. a condition like “emotion X increased by ≥0.12” cannot trigger if X is already near its maximum 1.0 intensity (since there isn’t room to increase by 0.12). The solver can incorporate such bounds (if previous value was 0.95, current can max at 1.0, giving Δ=0.05 <0.12). Expressions requiring an unrealistically large jump in an already-saturated emotion would be flagged as effectively impossible.

### Approach 2: Monte Carlo Simulation & Statistical Analysis

A more empirical method is to simulate a wide range of mood/sexual states and observe which expressions ever trigger. This can be done offline or in a diagnostic mode:

Random Sampling: Randomly generate thousands (or more) of states across the full range of mood axes and sexual values. For each state, compute all emotion and sexual intensities using the engine’s prototype formulas. Then check which expressions’ prerequisites are satisfied. (Because intensities and gates are computed as described, this is straightforward to automate for each sample state.)

Identify Non-firing Expressions: If an expression never triggers in this large random sample, it’s likely unreachable. We can compute an estimated trigger probability for each expression as the fraction of random states in which it would fire. Extremely low probabilities (or zero occurrences) point to potential issues. For example, if out of 100,000 random states an expression’s conditions never all hold true, that expression might be over-constrained.

Focused Search: To complement random sampling, use guided search for each expression:

Start from conditions: e.g. if an expression needs curiosity ≥0.6, bias the random generation or use optimization to increase curiosity (high engagement, moderate arousal, low threat in this case). Then test the other conditions (low fear, low suspicion, etc. as in the curious_lean_in example).

One could use a simple genetic algorithm or hill-climber that tries to maximize an “expression activation score” (increasing relevant emotions, decreasing others) for each expression to see if it can be satisfied. If the algorithm cannot find a state that meets all prerequisites after extensive search, that’s a strong indicator of an impossible trigger.

Statistical Outputs: This approach can produce a report like: Expression A: triggered in 0.00% of random states (Impossible?); Expression B: 0.05% (Extremely rare); Expression C: 5% (Occasional); Expression D: 20% (Easy to trigger). This gives designers insight into whether an expression’s conditions are too strict. We might discover, for instance, that an expression intended to represent a nuanced state never actually fires because its required combination of high/low emotions occurs in virtually zero scenarios without manual tweaking.

Correlations Analysis: By analyzing the simulation data, we can also compute correlations between emotions. If two emotions required by an expression are strongly negatively correlated across all possible states, requiring both to be high at once is inherently unlikely. For example, if whenever valence is very high (joy, contentment, etc.), sadness is necessarily very low (since valence is negative for sadness), those intensities will seldom coincide. High anti-correlation suggests an expression combining those is effectively dead content. This method might highlight less obvious conflicts where it’s not a hard gate contradiction but a soft one (e.g. one emotion’s weights counteract another’s). We could flag expressions that involve pairs of emotions with correlation below some threshold as potentially problematic for co-occurrence.

### Approach 3: Heuristic and Analytical Checks

Beyond brute-force methods, we can encode some business rules to catch likely issues:

Gate Conflict Detection: Parse each expression’s JSON logic for any pair of conditions that directly conflict. We’ve already mentioned threat in confidence vs fear. More generally, if Expression X requires Emotion A and Emotion B both above thresholds, check A’s prototype gates vs B’s gates:

If any axis gate of A contradicts a gate of B (one needs axis ≥ m, other needs the same axis ≤ n, with m > n), mark as impossible. The code can systematically compare all gate pairs for such overlaps.

Similarly, check if one condition demands an axis high while another demands it low. For example an expression with moodAxes.valence >= 30 and also requiring a high-intensity negative emotion (which would need valence low) is suspect.

Weight Sign Oppositions: Even if not explicit in gates, weight configurations can oppose each other. For instance, anger and trust might not have directly conflicting gates, but anger’s prototype favors negative valence and high arousal, whereas trust favors positive valence and low threat. If an expression wanted both anger and trust strong, it’s practically infeasible. A script could check each pair of required emotions for weight vectors that point in opposite directions (e.g. dot product significantly negative), indicating that increasing one will inherently decrease the other. This finds cases where the engine’s math inherently makes those emotions inversely related.

Delta Prerequisite Checks: For any prerequisite that involves a change (e.g. "var": "emotions.X" - "previousEmotions.X" >= Δ), ensure that Δ is actually reachable within the [0,1] intensity range. If Δ is too large to achieve given typical dynamics, flag it. Also, if an expression requires an emotion both to be high and to have jumped by a large amount, consider whether that can happen (an emotion already near its high value can’t jump much higher due to the clamp at 1.0). These logical checks can catch overly stringent change requirements that might never be met in practice.

Logging & Live Tuning: Another pragmatic check is to instrument the game to log whenever an expression’s first condition group (static prerequisites) is satisfied, even if the whole expression doesn’t fire due to missing delta conditions. If even the static conditions rarely or never align during actual gameplay, that’s an issue. We could build a debug UI panel listing expressions and a count of how often their conditions have been close to triggering. If some expressions remain at 0 counts over long play sessions, they likely need adjustment.

### Summary of Recommended Techniques

By combining formal methods and statistical analysis, we can automatically detect problematic expressions:

- Use a solver to deterministically find contradictions in prerequisite logic (e.g. mutually exclusive gates or axis requirements). This gives a yes/no answer on reachability for each expression, catching the truly impossible cases.

- Use Monte Carlo simulation or exhaustive sampling (at a coarse grid of axis values) to estimate trigger likelihood. This helps find expressions that are not outright impossible but so unlikely as to never appear without extreme conditions. It provides a quantitative basis (trigger % or frequency) to decide if an expression should be tweaked.

- Implement heuristic checks for known anti-patterns (like demanding opposite emotions, or requiring excessive jumps in intensities) to flag potential issues even without full simulation. These can run as part of a content validation script whenever new expressions are added or prototypes are changed.

Using these methods in tandem will let us flag expressions with impossible or overly narrow prerequisites. We can then revise those expressions (adjust thresholds, remove conflicting conditions, or relax gates) so that every narrative expression corresponds to a reachable emotional/sexual state in the engine. This ensures that the effort put into writing those expressions isn’t wasted on conditions that never occur, and it keeps the narrative output rich and attainable under the emotional model’s mathematics.


## What the Expression Diagnostics page will offer

It will allow the user to select one among the loaded expressions, relying on the code to load mod expressions that expressions-simulator.html already uses.

## 0) Goal
You want a deterministic + statistical way to answer:

1) **Is an expression impossible to trigger?**  
   Meaning: there is **no** combination of `moodAxes` and `core:sexual_state` that can make its prerequisites pass, given the current emotion/sexual prototypes, gates, and intensity formula.

2) **If not impossible, how likely is it to trigger?**  
   Meaning: estimate an expression’s **trigger probability** (or “rarity”) under an assumed distribution over possible actor states.

3) **What exactly is wrong / fragile?**  
   Meaning: highlight which prerequisite(s) are contradictory, overly narrow, or require rare co-occurrence.

This report proposes a diagnostics module you can run from a page in your app:
- **Static (deterministic) analysis:** find contradictions and unreachable constraints
- **Statistical analysis:** estimate trigger frequency + near-miss reasons
- **Hybrid search:** actively try to “solve” for a trigger state and produce a concrete counterexample when possible

## 1) What makes expressions “impossible” in this system?

### 1.1 Prototype gates can be mutually exclusive
Because each emotion/state has **AND gates** on axes, some pairs can never both be “on”.

Example pattern:
- Emotion A gate requires `threat <= 0.20`
- Emotion B gate requires `threat >= 0.30`

Then any expression requiring both `emotions.A >= tA` and `emotions.B >= tB` is **impossible**, because there is no threat value that passes both gates simultaneously.

This is the single biggest source of truly dead expressions.

### 1.2 Intensity is a clamped normalized weighted sum
When gates pass:
intensity = clamp01( rawSum / sumAbsWeights )
rawSum = Σ(w_i * axis_i)

Mood axes are in [-1, +1], sexual axes in [0, 1] (sexual_arousal derived from the dual-control formula and clamped).

This has two important consequences:

- **Upper bounds exist**: Even if gates pass, the maximum achievable intensity may be < your threshold because some weights are negative and/or axes are bounded.
- **Anti-correlated prototypes**: Two emotions can be mathematically “opposed” (weight vectors point in opposite directions), so requiring both to be high may be practically infeasible even without hard gate conflicts.

### 1.3 Delta prerequisites can be impossible due to saturation
Expressions often require change detection:
(emotions.X - previousEmotions.X) >= Δ

But `emotions.X` is clamped to [0,1], so:
- if `previousEmotions.X` is already high, there may be no room to increase by Δ
- if your game state transitions can’t produce jumps that large in one tick, a Δ may be effectively impossible

So you can have “possible in theory” but “impossible in your tick dynamics”.

You told me: no external runtime data; that means we can still detect *mathematical impossibility*, and estimate *plausibility* under assumed distributions, but not perfectly model tick-to-tick deltas unless you define a transition model.

## 2) Recommended Diagnostics Architecture
Make a developer-facing page: **Expression Diagnostics**.

It runs 4 layers:

1) **Parsing & normalization**
2) **Static contradiction checks**
3) **Feasibility solving (deterministic search)**
4) **Monte Carlo & sensitivity analysis (probabilistic)**

Outputs per expression:
- **Status:** Impossible / Extremely rare / Rare / Normal / Frequent
- **Estimated trigger rate** under chosen prior distribution(s)
- **Most-likely failure reasons** (what clause fails most often)
- **Witness state** (a concrete mood/sexual config that triggers it, if found)
- **Suggested fixes** (tight thresholds, conflicting gates, etc.)

## 3) Layer A — Static Checks (Fast, deterministic red flags)

### 3.1 Gate intersection check (hard impossibility)
For each expression, collect all emotions / sexualStates it requires to be **≥ threshold** (and optionally those used in OR branches).

For each required prototype `P`:
- collect its gate constraints like `axis <= c`, `axis >= c`
- treat each axis separately as an interval
  - mood axes in [-1, +1]
  - sex_excitation, sex_inhibition in [0, 1]
  - sexual_arousal in [0, 1]

Intersect all required prototypes’ gate intervals axis-by-axis.

If any axis interval becomes empty → **impossible**.

**Example**:  
If one required emotion has `threat <= 0.20` and another has `threat >= 0.30`, the threat interval becomes empty.

> This catches the most common “dead content” immediately.

### 3.2 Threshold reachability bounds (still deterministic)
Even if gates are consistent, an expression may demand a threshold an emotion can never reach.

For a given prototype with gates already assumed satisfied:
- compute the maximum possible `rawSum` over axis ranges:
  - for each term `w_i * a_i`, choose `a_i` at its max or min depending on sign of `w_i`
- then:

maxIntensity = clamp01( maxRawSum / sumAbsWeights )
minIntensity = clamp01( minRawSum / sumAbsWeights )

If expression requires `emotions.X >= t` and `maxIntensity < t` → **impossible**.

This is fast and does not require a solver.

### 3.3 Pairwise “opposition” heuristic (likely rarity)
Compute a “compatibility score” between any two required high-threshold emotions:

- Use normalized weight vectors over the common axis set
- Dot product < -0.6 → strong opposition
- Dot product > +0.6 → strong alignment

If an expression requires multiple “opposed” emotions simultaneously, flag it as **likely rare**, even if not impossible.

This won’t prove impossibility, but it’s a great authoring-time warning.

### 3.4 Clause sanity checks
Flag:
- `emotions.X >= 0.95` AND `(emotions.X - prevX) >= 0.12`  
(likely impossible due to clamp saturation, unless prevX is low)
- long chains of AND constraints mixing:
- many `>= 0.7` emotions
- plus multiple `<= 0.2` suppressors
- plus raw axis constraints

Mark as “high-conjunction risk”: these are often “mathematically possible but astronomically rare”.

## 4) Layer B — Deterministic Feasibility Solving (Find a witness or prove no witness)

Static checks can declare some things impossible quickly, but the most powerful tool is:
- **“Find me a state that triggers this expression.”**

### 4.1 Two feasible solver routes
**Route 1: SMT / MILP approach (most rigorous)**
Model variables:
- mood axes: 7 variables in [-1,1] (or raw [-100,100])
- sex_excitation, sex_inhibition in [0,1] (or raw [0,100])
- baseline_libido in [-0.5, 0.5] (raw [-50,50])
- sexual_arousal defined as clamp01((exc - inh + base))

Gates become linear constraints.
Intensity inequality becomes linear.

Complication: clamp01 and “emotion can be 0 if gate fails”.
Practical approach:
- For each required emotion in a conjunction, **assume gates are true** (otherwise it can’t be ≥ threshold anyway)
- Then solve linear constraints for those assumed-true prototypes

For OR branches, you can:
- solve each branch independently and accept first that’s satisfiable
- or encode disjunction in SMT

If satisfiable → output the witness state.

If unsatisfiable → expression is mathematically impossible (given those required constraints).

**Route 2: Guided numeric search (easy to implement, still deterministic in practice)**
If you don’t want an SMT dependency, implement a multi-start optimizer:

- Objective: minimize `penalty(expressionPrereqs(state))`
- penalty sums positive violations:
- for `x >= t`: `max(0, t - x)`
- for `x <= t`: `max(0, x - t)`
- for `and`: sum
- for `or`: min across branches
- run:
- random restarts (e.g. 200–2000)
- simulated annealing / CMA-ES / differential evolution
- then local refinement

If penalty reaches ~0 → you found a witness state that triggers.

If after many restarts penalty never reaches 0, likely impossible or extremely narrow.

This approach also outputs “closest” states and tells you which clauses block it.

### 4.2 Handling previousEmotions deltas
Without a transition model, treat previous values as independent variables in [0,1] with constraints:
- `prevX` in [0,1]
- optionally limit `|currentX - prevX| <= maxDeltaPerTick` if you define one

Then delta constraints become satisfiable checks too.

Even with no transition model, you can still detect pure math contradictions:
- if requires `currentX >= 0.95` and `currentX - prevX >= 0.12`,
then prevX must be <= 0.83. That is fine mathematically, but if your runtime never drops prevX that low in a single tick, it’s a dynamics problem.

So: include two modes:
- **Math mode:** prevX unconstrained in [0,1]
- **Dynamics mode (optional):** constrain per-tick deltas

## 5) Layer C — Statistical Trigger Likelihood (Monte Carlo + coverage)
Even if something is possible, it might be so rare it never appears in gameplay.

So you want:
- `P(expression triggers)` under a distribution over states.

### 5.1 Choose distributions (critical!)
Trigger probability depends on how you sample states.

Offer several built-in priors:
1) **Uniform axes**: each mood axis uniform in [-100,100], sex vars uniform
 - good for raw feasibility/coverage
 - not psychologically realistic
2) **Gaussian axes**: centered near 0 with tuned std-dev (e.g. 20–35)
 - more realistic: extremes are rarer
3) **Empirical**: sample from actual recorded gameplay state logs (best)
 - if you add logging, this becomes gold

Let the diagnostics UI select a distribution.

### 5.2 Monte Carlo procedure
For each sample:
- draw raw mood axes in [-100,100]
- draw sex_excitation/inhibition in [0,100], baseline_libido in [-50,50]
- compute sexual_arousal
- compute all emotions and sexualStates via gates + weighted sum
- evaluate expression prerequisites (JSON Logic)
- track:
- did it trigger?
- which clause(s) failed?

After N samples:
- `triggerRate = triggers / N`
- per-clause failure frequency
- near-miss analysis: average violation magnitude

### 5.3 Rarity scoring + actionable categories
Define thresholds:
- **Impossible:** proven unsat by solver OR 0 hits across huge N + static contradictions
- **Extremely rare:** < 0.001%
- **Rare:** 0.001%–0.05%
- **Normal:** 0.05%–2%
- **Frequent:** > 2%

The exact numbers can be tuned, but you need stable categories for content authors.

### 5.4 Coverage maps
For each expression, build a “heatmap” of which axes ranges are involved:
- bin key axes (valence, arousal, threat, engagement, self_eval) into buckets
- show which bins contain triggers
- if triggers only occur in tiny corner → narrow, fragile design

This is a killer visualization in the diagnostics page.


---

## 6) Layer D — Automated “What’s wrong?” Explanations
Raw “0 triggers” isn’t enough; you need the system to explain why.

### 6.1 Minimal Unsat Core (for deterministic contradictions)
If you use SMT, ask it for an **unsat core**: the smallest subset of constraints that makes it impossible.

Then report:
- “Unreachable because: fear requires threat >= 0.30 but confidence requires threat <= 0.20”
- “Unreachable because: sadness gates valence <= -0.20 but joy gates valence >= 0.35”

If you don’t use SMT, approximate:
- remove clauses one by one and see if feasibility returns (delta debugging).

### 6.2 Empirical “failure drivers”
From Monte Carlo runs, compute:
- which prerequisite fails most often
- which has the highest average violation margin
- which suppressor clause (e.g. `fear <= 0.40`) blocks most frequently

Example output:
- “Blocked 72% of the time by `emotions.suspicion <= 0.55`”
- “Blocked 58% by delta requirement `curiosity - prevCuriosity >= 0.12`”
- “Blocked 41% by engagement >= 10”

This tells authors exactly what to loosen.

### 6.3 Suggested auto-fixes (safe, conservative)
The tool can offer suggestions like:
- “Lower threshold `curiosity >= 0.60` → 0.55 would raise trigger rate from 0.002% to 0.05%”
- “Replace `fear <= 0.40` with `fear <= 0.55` to reduce suppression”
- “Reduce delta threshold 0.12 → 0.08”

These are computed by “counterfactual simulation”: rerun evaluation with adjusted threshold(s) and compare trigger rate.

You can present this as suggestions, not auto-edits.


---

## 7) Implementation Plan (what to build)

### 7.1 Core reusable modules
1) **Gate parser**: parse gate strings into constraints
2) **Prototype evaluator**: already exists (emotion/sexual intensity computation)
3) **Expression evaluator**: already exists (JSON Logic)
4) **Diagnostics engine**:
 - static checks
 - feasibility solver (SMT or guided search)
 - Monte Carlo runner
 - reporting + visualization dataset builder

### 7.2 Minimal viable “Expression Diagnostics” page
Per expression:
- Buttons:
- “Run static checks”
- “Search for witness”
- “Estimate trigger rate (N samples)”
- Outputs:
- status + reason
- witness mood/sexual state (copyable JSON)
- top failure clauses
- trigger distribution stats
- optional heatmap for key axes

### 7.3 Practical solver choice
If you want rigor:
- Use an SMT solver (Z3) in a node environment (WASM builds exist) or run it server-side.

If you want simplicity:
- Use guided search + Monte Carlo. In practice this catches almost all real-world dead/rare expressions quickly, and gives author-friendly outputs.

My strong opinion:
- **Build Monte Carlo + guided search first.**
- Add SMT later if you hit ambiguous cases and want “proof”.

The reason: you will get 90% of value quickly, and your content authors will benefit more from “what to change” than from formal proofs.


---

## 8) Recommended UI outputs (what authors actually need)
For each expression:

### 8.1 Headline
- **Triggerability:** Possible / Impossible
- **Estimated rarity:** e.g. “0.004% under Gaussian prior”
- **Confidence:** based on sample size + solver results

### 8.2 Witness state (if possible)
Provide a state in raw component form:

```json
{
"core:mood": { "valence": 42, "arousal": 18, ... },
"core:sexual_state": { "sex_excitation": 63, "sex_inhibition": 14, "baseline_libido": 8 },
"previousEmotions": { "curiosity": 0.42, ... }
}
```

### 8.3 “Top blockers”

Clause A fails in 71% of samples (avg violation 0.09)

Clause B fails in 44% (avg violation 0.05)

etc.

### 8.4 Suggested threshold tweaks

Offer 1–3 minimal changes that push it into a desired rarity band.

## 9) Edge Cases & Pitfalls
### 9.1 OR logic

A naive static analysis over AND constraints can over-report impossibility if it doesn’t respect OR branches.
Solution:

Evaluate each OR branch independently in feasibility mode.

In reporting, show which branches are reachable.

### 9.2 “<=” constraints on emotions

Because emotions can be 0 when gated off, emotions.X <= t is usually easy to satisfy.
But if your prerequisites also require gates that make X nonzero, it becomes meaningful.
So in static checks, treat “<=” constraints as soft unless X is also constrained to be “on”.

### 9.3 Equality checks

Your == uses epsilon comparison in gates.
In feasibility solving, treat equality constraints with tolerance bands.

### 9.4 Distribution sensitivity

Trigger probability depends heavily on your prior.
So always show:

trigger rate under multiple priors (Uniform + Gaussian at least)

and optionally empirical logs

## 10) Deliverables Checklist
### Deterministic

 Gate conflict detection (interval intersection)

 Max/min reachable intensity bounds per prototype

 Feasibility search (guided optimizer) producing witness or near-miss report

 Optional SMT-based proof + unsat core

### Statistical

 Monte Carlo trigger probability estimator under selectable priors

 Per-clause failure frequency + violation magnitude

 Coverage maps / heatmaps for key axes

 Counterfactual tuning suggestions (“what threshold change yields target rarity?”)

### UX

 Expression Diagnostics page

 Copyable witness states + reason summaries

 “Top blockers” + “Suggested fixes” panels

## Notes

Monte Carlo will observe impossibility (it’ll never see a trigger), but it can’t prove impossibility without essentially becoming an exhaustive search — and exhaustive search explodes in your state space.

Why Monte Carlo can’t replace a solver

If an expression triggers with probability p under whatever distribution you sample from, the chance you see zero triggers after N samples is:

𝑃
(
0 hits
)
=
(
1
−
𝑝
)
𝑁
P(0 hits)=(1−p)
N

So “0 hits” only tells you: either impossible (p=0), or just very rare (p>0 but small).
You can turn “0 hits” into an upper bound on p, but not a proof of p=0.

A handy approximation: if you see 0 hits, then with ~95% confidence

𝑝
≲
3
𝑁
p≲
N
3
	​


If N = 100,000, then 0 hits only implies p < ~3e-5 (≈0.003%) — that’s “rare”, not “impossible”.

If you want to distinguish p=0 from p=1e-9, you’d need billions of samples. That’s not happening interactively.

And it gets worse because the probability depends on the distribution you chose. If your Monte Carlo prior doesn’t put mass where the trigger region lives (e.g., extreme shame + arousal + threat corner), you’ll see zero hits even if it’s possible.

High-dimensional spaces make “rare” look like “impossible”

You effectively have ~10 continuous-ish inputs:

7 mood axes

sex_excitation, sex_inhibition, baseline_libido (and derived sexual_arousal)

Even if each axis only needed, say, a 10% “sweet spot,” a conjunction across 6–8 conditions can easily land in the p ~ 1e-6 to 1e-10 zone. Monte Carlo will call that “never happens” unless you run huge N or use targeted sampling.

What the solver gives you that Monte Carlo never will

A solver (or even a lighter constraint-based check) can:

Prove impossibility (no satisfying assignment exists), not just “didn’t see it”.

Produce a minimal unsat core: which exact gates/inequalities conflict (this is gold for fixing content).

Produce a witness state when it’s possible (a concrete mood/sexual config that triggers), even if it’s astronomically rare.

Catch hard contradictions instantly, e.g.:

one required emotion gate needs threat <= 0.20

another required emotion gate needs threat >= 0.30
→ impossible, and the solver can explain that cleanly.

Monte Carlo can’t tell you why it’s failing unless you build extra instrumentation (which you should), and even then it can’t say “this is mathematically impossible”.

The right way to combine them (best of both worlds)

Think of them as answering different questions:

Solver / constraint checks: “Can this ever trigger?” (reachability / contradictions)

Monte Carlo: “How often will it trigger under realistic play?” (rarity / tuning)

Guided search (optimizer): “Find me a trigger state if one exists.” (practical witness-finder)

A pragmatic pipeline that’s fast and effective:

Static gate-conflict + max-reachability bounds (super cheap, catches tons)

Monte Carlo (gives rarity + blocker stats)

If Monte Carlo shows 0 hits or extremely low, run solver/guided-search to decide:

truly impossible vs just extremely rare

and generate an explanation/witness

So: is the solver “unnecessary”?

If you’re okay with: “we didn’t see it in 1M samples, so it’s probably dead,” then sure, you can skip it.

But if you want deterministic guarantees (“this expression is impossible”) and actionable proofs (exact conflicting gates), Monte Carlo alone won’t get you there without absurd sample sizes or a distribution that perfectly covers every corner.

My take: keep the solver layer, but only invoke it selectively:

run it for expressions with 0 hits / ultra-low rate

run it for expressions you’re about to ship and want to be sure aren’t dead

That keeps complexity manageable and gives you certainty where it matters.