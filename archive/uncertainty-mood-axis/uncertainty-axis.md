# Implementing an axis to represent uncertainty

In the emotion prototypes of data/mods/core/lookups/, we have a confusion emotion prototype. But as we analyzed its uses and its composition, we realized we were trying to encode an epistemic state (confusion) using axes that are mostly affective + motivational + regulatory. That mismatch is why “confusion” collapses into “frustration / stuck / low agency” in your current prototype set.

## What your current axes can already represent well

Your 9 mood axes (from the mood.component.json file) are excellent for:

Hedonics: valence

Energy/activation: arousal

Power/efficacy: agency_control

Safety appraisal: threat

Attentional capture: engagement

Outlook: future_expectancy

Self-worth: self_evaluation

Social orientation: affiliation

Response braking: inhibitory_control

Those cover most “classic” affective families (fear, sadness, anger, joy, attachment, etc.) and a lot of regulation flavor.

## What they don’t represent: the thing “confusion” actually is

Confusion (and its cousins: uncertainty, perplexity, doubt, cognitive dissonance) is primarily:

“My internal model doesn’t fit what I’m perceiving / I can’t integrate this / I don’t know what’s going on.”

That is not:

threat (you can be confused while perfectly safe),

agency_control (you can be confused while highly capable),

engagement (you can be confused while highly engaged),

inhibitory_control (often increases, but not always),

valence/arousal (can be neutral-to-negative, low-to-high).

So any “confusion prototype” you build without an epistemic dimension will be forced to piggyback on agency_control↓ and/or valence↓, which automatically drags it into the same basin as:

frustration (blocked goal pursuit),

anxiety (threat + low control),

dissociation (threat + low control + low engagement),

helpless sadness states.

That’s exactly the overlap your analyzer is catching.

## Do you “truly need” a new axis?

If you want “confusion” to be psychologically real as a distinct channel, yes — you need an epistemic signal somewhere.

Add one axis that measures model fit / certainty.

Two good names (pick the one whose polarity feels natural):

cognitive_clarity: -100 = totally confused, +100 = crystal clear

uncertainty: -100 = certain, +100 = uncertain

This single axis immediately lets you separate:

confusion: uncertainty↑, threat low-to-mid, valence near neutral/slightly negative, inhibitory_control often ↑

frustration: agency_control↓ + valence↓ + engagement↑ (uncertainty not necessarily high)

curiosity: uncertainty↑ + engagement↑ + threat low (valence slightly +)

suspicion: uncertainty↑ + threat↑ + affiliation↓

awe: uncertainty/novelty↑ + engagement↑ + agency_control↓ (sometimes) + valence mixed

Without that axis, those distinctions are mostly wishful labeling.

My blunt take: for your system (immersive sim/RPG), an epistemic axis is high ROI because NPCs constantly face incomplete information, ambiguous signals, and planning uncertainty.

## Why traits don’t solve this

Your affect traits (empathy, harm aversion, baseline self_control) are stable capacities. They can modulate how someone reacts to confusion (panic sooner, tolerate ambiguity, persist longer), but they don’t supply the missing state variable:

A person can have high cognitive_empathy and still be confused by a mechanical puzzle.

A person can have high self_control and still be confused; they’ll just mask it better.

So traits help expression and thresholds, not the fundamental separability problem.

## Solution

Add to mood.component.json

uncertainty (integer -100..100, default 0)
Description: “Confidence in one’s mental model / predictability of the situation. +100 = highly uncertain / cannot integrate; -100 = highly certain / coherent.”

## Affected systems

We need a codebase-wide search for mood and moodAxes. Wherever other mood axes are involved/referenced, we need to make sure that the new axis for uncertainty is also reflected. Important: if during this search we find opportunities for refactoring related code (code related to handling mood axes) to prevent any duplication, we should do so, but first we must ensure that that part of the code is covered either by existing integration suites from tests/integration/ , or creating new ones.

- In expression-simulator.html , inside the 'Mood Axes' section, we have sliders and behavior that involves each mood axis. We would need to add a new slider for the new uncertainty axis, and ensure that its functionality is as expected.
- In expression-diagnostics.html , we have very complicated code behind the 'Run Static Analysis' and 'Run Simulation'. We need to ensure that whenever mood axes are involved, the new uncertainty mood axis is used. When in doubt, update/create tests.
- In prototype-analysis.html , in the code behind the button 'Run Analysis', we need to ensure that whenever mood axes are involved, the new uncertainty mood axis is also reflected. When in doubt, update/create tests.

Search for the code involved in prerequisite evaluation (for the prerequisites of data/schemas/*expression* ). Ensure that the code handles the new uncertainty axis.