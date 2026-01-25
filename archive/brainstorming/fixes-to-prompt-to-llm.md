# Fixes to Prompt to LLM - Mood Axes Updates

This is regarding the code behind the 'Prompt to LLM' button in game.html . You can see how the prompt to update mood axes is built. I fed the prompt to ChatGPT so that it could determine if there were things that could be improved about it.

## ChatGPT's response

You’re right to be worried: the prompt will sometimes “forget” to move coupled axes together, and it has avoidable redundancy + a few internal tensions that can confuse even a good model.

Below are the biggest issues, and the cleanest way to fix them.

### The main redundancy problem: “axis defs” + “default heuristics” are both doing the same job

You already have canonical axis meanings in your schema definitions (and they match your current axis list) 

mood.component

. Repeating long definitions and then listing dozens of micro-heuristics creates:

duplicated guidance (e.g., temporal_orientation vs rumination vs engagement shows up in multiple places)

“checklist behavior” (model tries to obey every bullet rather than doing appraisal)

higher chance of omissions (it picks one bullet and forgets the natural “axis bundle” that should also move)

#### Fix

Keep short axis reminders (1-liners) and move all situation→axes guidance into a single, non-overlapping “event archetype library.”

### The realism issue you flagged is real: many heuristics only move 1–2 axes, but real appraisals move “bundles”

Example: “Being attacked/threatened: Threat up, Arousal up, Valence down” is fine, but missing common secondaries like:

agency_control often down (unless she fights back successfully)

inhibitory_control often up (white-knuckling) or down (impulsive reaction), depending on coping style

uncertainty often up if it’s confusing/novel

rumination often up afterward if she’s that kind of mind

Same with “public humiliation”: it’s rarely just self_evaluation + threat. It’s also usually evaluation_pressure up, often affiliation down, sometimes inhibitory_control up (masking), and rumination up afterward.

#### Fix

Represent each archetype as a primary bundle + common secondaries (optional, conditional), so the model doesn’t under-update.

### “BE Alicia Western” vs “Respond with ONLY JSON”

Most models will comply, but you’re inviting occasional leakage (first-person voice, rationale, etc.). The prompt screams two incompatible “formats.”

#### Fix: add a single hard line near the end:

“You may think in first-person, but you MUST output ONLY the JSON object.”

…and remove the rest of the portrayal rules for this numeric update step. Keep persona + current state; drop the “you are not an AI assistant” stuff here. It’s irrelevant and increases format break risk.

### You’re missing an explicit “blending” rule (multi-trigger situations)

Right now you say “Identify 1–3 salient triggers,” but you never say how to combine them. Models then “average vaguely” or overfit one trigger.

#### Fix

Add an explicit blend mechanic:

choose up to 2 archetypes

apply the stronger at 100%, the weaker at 40–60%

if archetypes conflict on an axis, the stronger wins unless the weaker is “extreme”

This makes outputs more stable and less random.

### Concrete rewrite: replace the long micro-heuristics with a compact archetype library

Here’s a structure that’s less redundant, more realistic, and harder to misread.

A) Keep your inertia/saturation rules (good), but make them executable

Add one deterministic step:

clamp deltas by magnitude bucket (mild/strong/extreme)

then apply saturation scaling: scaled_delta = delta * (1 - abs(current)/120) (simple, stable)

(You don’t need to show the formula; telling the model to “scale deltas down as abs(value) grows” is enough—just don’t repeat it in 3 places.)

B) Replace DEFAULT UPDATE HEURISTICS with this (single source of truth):

Note by reviewer (me): this should be styled in a better way that fits the rest of the prompt.


"Example archetypes (short, bundled, non-overlapping):

# Acute threat / attack

primary: threat↑, arousal↑, valence↓

common: agency_control↓ (if outmatched), inhibitory_control↑ (if containing reaction), uncertainty↑ (if novel/unclear)

# Competence win / leverage gained

primary: agency_control↑, valence↑, threat↓

common: self_evaluation↑, uncertainty↓, rumination↓

# Loss / grief / abandonment cue

primary: valence↓, future_expectancy↓, arousal↓

common: rumination↑, temporal_orientation↓, affiliation↓ (if it signals isolation)

# Social-evaluative exposure (judged, watched)

primary: evaluation_pressure↑, threat↑

common: self_evaluation↓ (if she buys the judgment), inhibitory_control↑ (masking), rumination↑ afterward

# Disgust / contamination cue

primary: contamination_salience↑, valence↓

common: threat↑ (if “dangerous filth”), sex_inhibition↑ (often), affiliation↓ (if source is a person)

# Ambiguity / cognitive mismatch

primary: uncertainty↑

common: threat↑ (if stakes), rumination↑ (if unresolved), engagement↓ (if overload) or engagement↑ (if intellectually hooked)

# Flow / absorbed present-moment

primary: engagement↑, temporal_orientation→0, rumination↓

common: threat↓, inhibitory_control→0 (less white-knuckle)

# Warm connection / acceptance

primary: affiliation↑, valence↑, threat↓

common: future_expectancy↑, evaluation_pressure↓

# Rejection / betrayal

primary: affiliation↓, valence↓, threat↑

common: rumination↑, self_evaluation↓ (if internalized), inhibitory_control↑ (if she contains it)"

That’s it. Nine archetypes cover almost everything without repeating yourself.

### Sex variables: tighten and de-redundantize

Your sex section is good, but it repeats “inhibition up for threat/shame/disgust” in multiple phrasings.

#### Fix

Make it one rule + two modifiers:

"- Treat sex changes as highly character-specific.

- Infer the character's sexual profile from persona and current sexual_state labels.

- Base rule: sex_inhibition tracks threat + shame + disgust + coercion/boundary violation cues.

- Gate: sex_excitation can only rise if threat is not high and there is trust/consent cue (and when not contradicted by persona/current state).

- State modifier: if sex_inhibition already ≥80, cap excitation increases to mild (≤5) unless there is strong safety/intimacy."

That removes the “hair-trigger” paragraph entirely.