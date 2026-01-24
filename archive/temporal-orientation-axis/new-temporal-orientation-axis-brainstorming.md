# Need to add a temporal orientation mood axis

This is related to mood.component.json

We realized, regarding the "nostalgia" prototype from the emotion prototypes at data/mods/core/lookups/ , that we were trying to model a temporal focus (on the past in this case) through the future_expectancy mood axis, but future expectancy is about hopelessness or hope, not about whether you're focused on the past or future.

A temporal_orientation (or temporal_focus) axis is justified here, and it’s cleaner than continuing to “smuggle” time-direction through future_expectancy.

Right now you’re using future_expectancy (“Hopeful (+) to hopeless (-)”) as a proxy for past-pull in nostalgia (it has future_expectancy: -0.45), and similarly for regret (future_expectancy: -0.3). That’s a conceptual mismatch: nostalgia is fundamentally past-oriented mental time travel, and it’s often not “hopeless”; in fact, nostalgia is frequently described as bittersweet and can increase optimism/meaning/social connectedness rather than suppress it.

## Why temporal_orientation is a real axis-gap (not a “nice to have”)

Your current mood axes cover:

affect (valence/arousal),

control/power (agency_control),

danger (threat),

attention (engagement),

outlook (future_expectancy),

self-worth (self_evaluation),

social stance (affiliation),

regulation (inhibitory_control),

model clarity (uncertainty). 

What’s missing is “where the mind is pointed in time” (past ↔ present ↔ future). Psychology treats “temporal focus/time perspective” as separable from optimism/pessimism — you can be future-focused and pessimistic (dread), or past-focused and optimistic (warm nostalgia), etc.

Without a temporal axis, you either:

keep hacking via future_expectancy (and get realism bugs), or

add bespoke memory/perception variables everywhere (which is a different kind of “hack,” just moved elsewhere).

So if you want nostalgia/regret/anticipation to be representable as state, an axis is the right abstraction.

## Proposed axis semantics

Add:

temporal_orientation in [-100, +100]

+100 = strongly future-focused (planning, anticipation, “what’s next”)

0 = present-focused (flow, mindfulness, task immersion)

-100 = strongly past-focused (reminiscence, rumination, regret, nostalgia)

This keeps future_expectancy pure: evaluation of outcomes, not time direction.

## Necessary changes throughout the codebase and pages

Adding a new mood axis is a fundamental change. We need to study necessary changes across the codebase and some pages.

- Search every instance of mood and moodAxes and moodAxis . They probably need to account for the new temporal_orientation mood axis.

- In expressions-simulator.html , the section 'Mood Axes', we need a new section for the new temporal_orientation mood axis, and ensure the code behind it works.

- In expression-diagnostics.html , we need to analyze the code behind the buttons 'Run Static Analysis' and 'Run Simulation' to ensure that the new mood axis is correctly handled. When in doubt, create specific tests to prove that temporal_orientation is properly handled.

- In game.html , we have an 'EMOTION STATE' section which shows the current values of the current actor's mood axes. We'll need entries and a color scheme for the new temporal_orientation, a color scheme that is fitting and distinct.

- In prototype-analysis.html , the code behind the 'Run Analysis' button, we need to ensure that wherever mood axes are handled (for sampling, checking out mood axes gaps, etc.), we need to ensure that the new temporal_orientation mood axis is handled.

- In game.html , check out the code behind the button 'Prompt to LLM'. Particularly in the prompt sent to an LLM to update mood axes values, we need to account for the new temporal_orientation, giving instructions for when temporal_orientation should decrease or increase in value. Other possible adaptations for the prompt that generates thoughts, speech, notes, and a chosen action. Not sure if specific mentions of mood axes are done there. In addition, we need to check out the LLM response schemas: there's one specifically for the response to the prompt to update mood axis values. We need to ensure that the changes to temporal_orientation returned by the LLM are persisted.