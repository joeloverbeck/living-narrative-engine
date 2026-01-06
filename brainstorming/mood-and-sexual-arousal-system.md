# Mood and Sexual Arousal System

Our app is mature and it has proven that LLM-based characters, who receive a prompt through the play in game.html (you can check out the process of creating that prompt through the code behind the button 'Prompt to LLM'), realistically create thoughts, potential speech, one chosen action among those available, and possible notes. The roleplaying of the LLM-based characters is extremely compelling, but we've noticed that it very often lacks the emotional angle: the LLMs more often than not react logically, without spontaneously producing emotional changes. That's expected given that they're LLMs, so we intend to model a comprehensive emotional system to track mood changes, feed calculated emotions and sexual states to the LLM through the prompt as textual "translations" of numerical values, and ask the LLM to update the emotional axes and sexual values according to the current context for the character.


## Mood tracking

We need a new component to track the axes of mood. The component should likely be in data/mods/core/components/ .

It will track the following:

### Valence (pleasant ↔ unpleasant)

#### Domain

Overall pleasantness vs aversiveness of the character’s current experience (how good or bad it feels right now).

#### Increase (toward pleasant / +):

The character’s goals are met, pain is reduced, safety/comfort increases.

They receive good news, support, praise, affection, humor, beauty, satisfying progress.

They feel understood, validated, or connected.

#### Decrease (toward unpleasant / -):

Harm, loss, disgust, humiliation, injustice, failure, frustration, betrayal.

Physical pain, deprivation, exhaustion, nausea, foul sights/smells.

Anything that feels aversive, violating, or heartbreaking.

### Arousal (energized ↔ depleted)

#### Domain

Overall activation/energy level of mind and body (revved-up vs slowed-down), independent of pleasantness.

#### Increase (toward energized / +):

Sudden events, danger, conflict, urgency, chase, surprises, high stakes.

Excitement, strong emotions (anger, fear, elation), stimulants, adrenaline.

Competitive pressure, time limits, intense focus.

#### Decrease (toward depleted / -):

Safety + stillness, routine, boredom, waiting, sedation, illness.

Emotional shutdown, prolonged stress “crash,” grief heaviness, burnout.

Sleepiness, hunger, long physical exertion without recovery.

(Reminder for the LLM: arousal is “revved up vs slowed down,” not “good vs bad.”)

### Agency/Control (dominant ↔ helpless)

#### Domain

Felt power and ability to influence outcomes (in control vs at the mercy of events).

#### Increase (toward dominant/in-control / +):

The character gains tools, leverage, information, allies, authority, options.

They successfully act and see results; they set boundaries and are respected.

Clear plans, competence, resources, training, terrain advantage.

#### Decrease (toward helpless / -):

They’re restrained, outmatched, cornered, trapped, manipulated, or ignored.

Uncertainty + no options; repeated failure; overwhelming forces; coercion.

Fatigue/illness reduces capability; social powerlessness (no one listens).

(Rule: “Can I influence what happens next?” If yes → Agency/Control up. If no → Agency/Control down.)

### Threat (safe ↔ endangered)

#### Domain

Perceived immediate danger/risk of harm (physical or social): how unsafe it feels.

#### Increase (toward endangered / +):

Direct danger: attack, pursuit, weapons, violence, falling, fire, corruption, predators.

Strong social danger: mob hostility, credible threats, exposure to punishment.

Unfamiliar ominous environments, signs of impending harm, being outnumbered.

#### Decrease (toward safe / -):

Danger removed: retreat to shelter, allies arrive, threat neutralized, barrier secured.

Reliable protection: locked doors, distance, authority protection, medical stabilization.

Clear confirmation “this can’t hurt me” / situation under control.

(Rule: “How likely is harm in the immediate future?”)

### Engagement (absorbed ↔ indifferent)

#### Domain

How captured and invested attention is (care/interest vs checked-out detachment).

#### Increase (toward absorbed / +):

Novelty, mystery, puzzles, personal relevance, meaningful stakes, fascination.

A task requires attention and the character cares about outcome.

Social connection: a person they care about speaks/acts; emotionally charged dialogue.

#### Decrease (toward indifferent / -):

Monotony, repetition, waiting, low stakes, forced small talk, irrelevance.

Emotional withdrawal / dissociation / “shutting down.”

Overload leading to disengagement (“too much, can’t process”) can also reduce E.

(Rule: “Is the character mentally leaning in, or checking out?”)


### Future expectancy (hope ↔ hopeless)

#### Domain

Belief that the future contains viable positive outcomes and that actions can lead there (path forward vs closed future).

#### Increase (toward hopeful / +):

Credible evidence things can improve: new information, a plan, resources, help, a path.

Small wins that prove progress; reassurance from trusted sources; meaningful promise.

The character feels they can endure and it will matter.

#### Decrease (toward hopeless / -):

Credible evidence the future is closed: inevitable loss, repeated failure, no paths left.

Betrayal of core support, worsening prognosis, time running out, “nothing works.”

Social isolation + helplessness + ongoing pain (classic hopelessness cocktail).

(Rule: “Does the character believe there is a workable path forward?”)


### Self-evaluation (pride ↔ shame)

#### Domain

Moment-to-moment self-worth and felt social standing (dignity/validation vs defectiveness/exposure).

#### Increase (toward pride / +):

Competence recognized, moral integrity upheld, respected boundaries, success earned.

Validation, praise, gratitude; the character acts bravely or skillfully.

They align with their values and feel “I’m okay / I did right.”

#### Decrease (toward shame / -):

Public failure, humiliation, exposure, rejection, ridicule, moral violation.

They feel defective, unworthy, dirty, weak, or “seen in a bad way.”

Being powerless in front of others can drop S sharply.

(Rule: “How does the character feel about themselves in this moment—worthy or defective/exposed?”)

### Ranges

Each of these axes (valence, arousal, agency_control, etc.) are in the ranges [-100..100]


### General interpretation (use for all axes)

+100 / -100: extreme, dominating the character’s moment-to-moment experience.

+60 to +90 / -60 to -90: strong, clearly expressed in behavior, tone, and choices.

+30 to +60 / -30 to -60: moderate, noticeable but not overwhelming.

+10 to +30 / -10 to -30: mild background influence.

-10 to +10: neutral / baseline (not driving behavior).

## Arousal tracking

We need a new component to track sexual arousal-related values. The component should likely be in data/mods/core/components/ . The component should track:

- sex_excitation [0..100] (How strongly the character's sexual response system is being activated by cues (internal or external). This is the 'accelerator'. It can rise from attraction, intimacy, fantasy, novelty, or physiological readiness. High excitation (near 100): the body/mind is primed; sexual thoughts intrude easily; attention may drift toward sexual cues; desire is readily triggered. Low excitation (near 0): little to no sexual activation; sexual cues feel irrelevant; desire is difficult to spark.)
- sex_inhibition [0..100] (How strongly the character's sexual response system is being suppressed by risk, anxiety, shame, distraction, or negative consequences. This is the 'brake'. High inhibition (near 100): strong internal braking; desire is blocked; the character may avoid sexual thoughts/behavior; even if excitation exists, it feels 'shut down' or uncomfortable. Low inhibition (near 0): few internal brakes; the character can allow desire to build if excitation is present.)
- baseline_libido [-50..50]

sexual_arousal will be calculated dynamically (and used for later calculations).

The calculation could be the following (correct if it doesn't seem right)

sexual_arousal = clamp01((sex_excitation - sex_inhibition + baseline_libido) / 100)

It should produce a value in the range [0..1]

# Emotion prototypes (weights)

## Conventions (important)

Gates use normalized axis values in [-1..+1] for Valence, Arousal, Agency/Control, Threat, Engagement, Future Expectancy, Self-evaluation (same normalization you already do by dividing -100..100 by 100).

Gates use sexual_arousal in [0..1].

A gate like Valence >= 0.20 means "valence is at least moderately positive."

If gates are empty, the prototype is always eligible.

## JSON definition

This should maybe be stored as a lookup. Check out existing lookups in data/mods/*/lookups/ and how they're processed and referenced in the codebase.

Note: the purpose of the gates is to stop nonsense overlap in states (e.g. fear requires threat > 0). Likely, the use for the gates is to calculate the state at 0 unless the gate passes. So it acts as a sort of prerequisite.

{
  "calm": {
    "weights": {"valence": 0.2, "arousal": -1.0, "threat": -1.0},
    "gates": ["threat <= 0.20"]
  },
  "contentment": {
    "weights": {"valence": 0.9, "arousal": -0.6, "threat": -0.6, "agency_control": 0.2},
    "gates": ["valence >= 0.20", "threat <= 0.20"]
  },
  "relief": {
    "weights": {"valence": 0.8, "arousal": -0.4, "threat": -0.9},
    "gates": ["threat <= 0.20"]
  },
  "confidence": {
    "weights": {"valence": 0.4, "threat": -0.8, "agency_control": 0.8, "arousal": 0.2},
    "gates": ["threat <= 0.20", "agency_control >= 0.10"]
  },

  "joy": {
    "weights": {"valence": 1.0, "arousal": 0.5, "future_expectancy": 0.3},
    "gates": ["valence >= 0.35"]
  },
  "enthusiasm": {
    "weights": {"valence": 0.6, "arousal": 0.9, "engagement": 0.7, "future_expectancy": 0.3},
    "gates": ["valence >= 0.15", "arousal >= 0.20", "engagement >= 0.10"]
  },
  "amusement": {
    "weights": {"valence": 0.8, "arousal": 0.4, "threat": -0.2, "engagement": 0.3},
    "gates": ["valence >= 0.20"]
  },
  "awe": {
    "weights": {"valence": 0.4, "arousal": 0.9, "agency_control": -0.5, "engagement": 0.6},
    "gates": ["arousal >= 0.30", "engagement >= 0.20"]
  },
  "inspiration": {
    "weights": {"valence": 0.6, "arousal": 0.7, "engagement": 0.6, "future_expectancy": 0.6, "agency_control": 0.2},
    "gates": ["future_expectancy >= 0.15", "engagement >= 0.15"]
  },

  "interest": {
    "weights": {"engagement": 1.0, "arousal": 0.4, "valence": 0.2},
    "gates": ["engagement >= 0.20"]
  },
  "curiosity": {
    "weights": {"engagement": 1.0, "arousal": 0.6, "threat": -0.2, "valence": 0.2},
    "gates": ["engagement >= 0.20", "threat <= 0.40"]
  },
  "fascination": {
    "weights": {"engagement": 1.0, "arousal": 0.8, "valence": 0.3},
    "gates": ["engagement >= 0.35", "arousal >= 0.25"]
  },
  "flow": {
    "weights": {"engagement": 1.0, "arousal": 0.5, "valence": 0.5, "agency_control": 0.4},
    "gates": ["engagement >= 0.40", "agency_control >= 0.10"]
  },

  "hope": {
    "weights": {"future_expectancy": 1.0, "agency_control": 0.6, "valence": 0.3},
    "gates": ["future_expectancy >= 0.20"]
  },
  "optimism": {
    "weights": {"future_expectancy": 0.9, "valence": 0.7, "arousal": 0.2},
    "gates": ["future_expectancy >= 0.20", "valence >= 0.15"]
  },
  "determination": {
    "weights": {"agency_control": 1.0, "future_expectancy": 0.6, "arousal": 0.6, "valence": 0.1},
    "gates": ["agency_control >= 0.25", "arousal >= 0.10"]
  },
  "anticipation": {
    "weights": {"future_expectancy": 0.6, "arousal": 0.5, "engagement": 0.4, "valence": 0.2},
    "gates": ["engagement >= 0.10", "arousal >= 0.05"]
  },

  "sadness": {
    "weights": {"valence": -1.0, "arousal": -0.5, "agency_control": -0.3},
    "gates": ["valence <= -0.20", "arousal <= 0.20"]
  },
  "grief": {
    "weights": {"valence": -1.0, "arousal": -0.3, "engagement": 0.6, "agency_control": -0.4},
    "gates": ["valence <= -0.25", "engagement >= 0.10"]
  },
  "disappointment": {
    "weights": {"valence": -0.7, "future_expectancy": -0.6, "arousal": -0.1, "agency_control": -0.2},
    "gates": ["valence <= -0.10", "future_expectancy <= -0.10"]
  },
  "despair": {
    "weights": {"future_expectancy": -1.0, "agency_control": -0.7, "valence": -0.6, "arousal": -0.3},
    "gates": ["future_expectancy <= -0.25"]
  },
  "numbness": {
    "weights": {"valence": -0.2, "arousal": -1.0, "engagement": -0.6, "future_expectancy": -0.2},
    "gates": ["arousal <= -0.40", "engagement <= -0.15"]
  },
  "fatigue": {
    "weights": {"arousal": -1.0, "agency_control": -0.4, "valence": -0.3, "engagement": -0.2},
    "gates": ["arousal <= -0.35"]
  },
  "loneliness": {
    "weights": {"valence": -0.8, "engagement": -0.5, "future_expectancy": -0.3, "arousal": -0.2},
    "gates": ["valence <= -0.15", "engagement <= -0.10"]
  },

  "boredom": {
    "weights": {"engagement": -1.0, "arousal": -0.6, "valence": -0.2},
    "gates": ["engagement <= -0.25"]
  },
  "apathy": {
    "weights": {"engagement": -0.9, "arousal": -0.8, "valence": -0.4, "future_expectancy": -0.3},
    "gates": ["engagement <= -0.20", "arousal <= -0.20"]
  },

  "unease": {
    "weights": {"threat": 0.5, "arousal": 0.2, "valence": -0.3, "agency_control": -0.2},
    "gates": ["threat >= 0.10"]
  },
  "anxiety": {
    "weights": {"threat": 0.8, "future_expectancy": -0.6, "agency_control": -0.6, "arousal": 0.4, "valence": -0.4},
    "gates": ["threat >= 0.20", "agency_control <= 0.20"]
  },
  "fear": {
    "weights": {"threat": 1.0, "arousal": 0.8, "agency_control": -0.7, "valence": -0.6},
    "gates": ["threat >= 0.30"]
  },
  "terror": {
    "weights": {"threat": 1.0, "arousal": 1.0, "agency_control": -0.8, "valence": -0.6},
    "gates": ["threat >= 0.50", "arousal >= 0.30"]
  },
  "dread": {
    "weights": {"future_expectancy": -0.8, "threat": 0.7, "arousal": 0.3, "valence": -0.5, "agency_control": -0.2},
    "gates": ["future_expectancy <= -0.10", "threat >= 0.15"]
  },
  "hypervigilance": {
    "weights": {"threat": 0.9, "arousal": 0.8, "engagement": 0.5, "valence": -0.3},
    "gates": ["threat >= 0.30", "arousal >= 0.20"]
  },

  "irritation": {
    "weights": {"valence": -0.6, "arousal": 0.4, "agency_control": 0.2, "threat": 0.2},
    "gates": ["valence <= -0.10"]
  },
  "frustration": {
    "weights": {"engagement": 0.7, "agency_control": -0.7, "valence": -0.5, "arousal": 0.3},
    "gates": ["engagement >= 0.10", "agency_control <= 0.10", "valence <= -0.10"]
  },
  "anger": {
    "weights": {"valence": -0.8, "arousal": 0.8, "agency_control": 0.7, "threat": 0.3},
    "gates": ["valence <= -0.15", "arousal >= 0.10"]
  },
  "rage": {
    "weights": {"valence": -0.9, "arousal": 1.0, "agency_control": 0.8, "threat": 0.4},
    "gates": ["valence <= -0.25", "arousal >= 0.25"]
  },
  "resentment": {
    "weights": {"valence": -0.7, "arousal": 0.2, "agency_control": 0.5, "future_expectancy": -0.3, "self_evaluation": -0.2},
    "gates": ["valence <= -0.10", "agency_control >= 0.10"]
  },
  "contempt": {
    "weights": {"valence": -0.6, "agency_control": 0.8, "engagement": -0.2, "self_evaluation": 0.2},
    "gates": ["valence <= -0.10", "agency_control >= 0.20"]
  },
  "disgust": {
    "weights": {"valence": -0.9, "arousal": 0.4, "engagement": -0.3, "threat": 0.2},
    "gates": ["valence <= -0.25"]
  },

  "pride": {
    "weights": {"self_evaluation": 1.0, "agency_control": 0.4, "valence": 0.3},
    "gates": ["self_evaluation >= 0.25"]
  },
  "shame": {
    "weights": {"self_evaluation": -1.0, "agency_control": -0.5, "valence": -0.4, "threat": 0.2},
    "gates": ["self_evaluation <= -0.25"]
  },
  "embarrassment": {
    "weights": {"self_evaluation": -0.7, "arousal": 0.5, "threat": 0.6, "valence": -0.3},
    "gates": ["self_evaluation <= -0.10", "threat >= 0.20"]
  },
  "guilt": {
    "weights": {"self_evaluation": -0.7, "valence": -0.4, "agency_control": 0.2, "engagement": 0.2},
    "gates": ["self_evaluation <= -0.10", "valence <= -0.10"]
  },
  "humiliation": {
    "weights": {"self_evaluation": -1.0, "arousal": 0.7, "threat": 0.6, "agency_control": -0.4, "valence": -0.5},
    "gates": ["self_evaluation <= -0.25", "threat >= 0.30"]
  },

  "envy": {
    "weights": {"valence": -0.5, "arousal": 0.4, "agency_control": -0.2, "self_evaluation": -0.4, "engagement": 0.3},
    "gates": ["self_evaluation <= -0.05", "valence <= -0.05"]
  },
  "jealousy": {
    "weights": {"threat": 0.6, "arousal": 0.6, "valence": -0.6, "agency_control": -0.2, "engagement": 0.4},
    "gates": ["threat >= 0.20", "valence <= -0.05"]
  },

  "trust": {
    "weights": {"valence": 0.4, "threat": -0.5, "agency_control": 0.2, "engagement": 0.2},
    "gates": ["threat <= 0.40"]
  },
  "admiration": {
    "weights": {"valence": 0.6, "engagement": 0.5, "self_evaluation": 0.3, "arousal": 0.2},
    "gates": ["engagement >= 0.10", "valence >= 0.10"]
  },
  "gratitude": {
    "weights": {"valence": 0.8, "threat": -0.3, "self_evaluation": 0.2, "agency_control": 0.1},
    "gates": ["valence >= 0.20"]
  },

  "affection": {
    "weights": {"valence": 0.7, "arousal": 0.2, "threat": -0.4, "engagement": 0.3, "SA": 0.15},
    "gates": ["valence >= 0.10", "threat <= 0.40"]
  },
  "love_attachment": {
    "weights": {"valence": 0.6, "engagement": 0.6, "future_expectancy": 0.4, "threat": -0.2, "SA": 0.10},
    "gates": ["engagement >= 0.10", "threat <= 0.50"]
  },

  "hatred": {
    "weights": {"valence": -0.9, "arousal": 0.6, "agency_control": 0.6, "engagement": 0.3, "threat": 0.3},
    "gates": ["valence <= -0.25", "arousal >= 0.10"]
  },

  "surprise_startle": {
    "weights": {"arousal": 0.9, "threat": 0.3, "agency_control": -0.2, "engagement": 0.2},
    "gates": ["arousal >= 0.10"]
  },
  "confusion": {
    "weights": {"engagement": 0.3, "arousal": 0.2, "agency_control": -0.5, "valence": -0.2},
    "gates": ["agency_control <= 0.20"]
  },
  "alarm": {
    "weights": {"threat": 0.8, "arousal": 0.9, "agency_control": -0.4, "valence": -0.4},
    "gates": ["threat >= 0.30", "arousal >= 0.20"]
  }
}

## Sexual prototypes (weights)

We need a separate sexual prototype set. Reason: sexual arousal is a motivational/physio channel that can coexist with almost any emotion, and you want sexual states to be:

- interpretable,
- gated by safety/shame/threat,
- not accidentally "boosting" unrelated emotions.

These should be handled in a data-driven way, perhaps as lookups in the mod structure (check out other lookups in data/mods/*/lookups/ and how they're handled)

Same axes (valence, arousal, threat, self_evaluation, etc.) normalized to [-1..+1]
And sexual_arousal in [0..1]

{
  "sexual_lust": {
    "weights": {"sexual_arousal": 1.0, "valence": 0.3, "arousal": 0.3, "threat": -0.6, "self_evaluation": 0.2, "engagement": 0.2},
    "gates": ["sexual_arousal >= 0.35", "threat <= 0.30", "self_evaluation >= -0.40"]
  },
  "sexual_sensual_pleasure": {
    "weights": {"sexual_arousal": 1.0, "valence": 0.6, "arousal": 0.1, "threat": -0.6, "self_evaluation": 0.2},
    "gates": ["sexual_arousal >= 0.35", "threat <= 0.20"]
  },
  "sexual_playfulness": {
    "weights": {"sexual_arousal": 0.9, "valence": 0.5, "arousal": 0.5, "engagement": 0.4, "threat": -0.4, "self_evaluation": 0.2},
    "gates": ["sexual_arousal >= 0.40", "threat <= 0.20", "self_evaluation >= -0.20"]
  },
  "romantic_yearning": {
    "weights": {"sexual_arousal": 0.6, "engagement": 0.6, "future_expectancy": 0.5, "valence": 0.1, "arousal": 0.2, "threat": -0.2},
    "gates": ["engagement >= 0.10", "future_expectancy >= 0.10"]
  },
  "sexual_confident": {
    "weights": {"sexual_arousal": 0.8, "agency_control": 0.6, "valence": 0.2, "threat": -0.4, "self_evaluation": 0.2},
    "gates": ["sexual_arousal >= 0.35", "agency_control >= 0.10", "threat <= 0.30"]
  },

  "aroused_but_ashamed": {
    "weights": {"sexual_arousal": 1.0, "self_evaluation": -0.9, "valence": -0.3, "threat": 0.2, "agency_control": -0.2, "arousal": 0.2},
    "gates": ["sexual_arousal >= 0.35", "self_evaluation <= -0.20"]
  },
  "aroused_but_threatened": {
    "weights": {"sexual_arousal": 0.8, "threat": 0.9, "arousal": 0.6, "valence": -0.4, "agency_control": -0.3},
    "gates": ["sexual_arousal >= 0.35", "threat >= 0.30"]
  },
  "sexual_performance_anxiety": {
    "weights": {"sexual_arousal": 0.8, "threat": 0.6, "self_evaluation": -0.5, "agency_control": -0.5, "arousal": 0.5, "valence": -0.3},
    "gates": ["sexual_arousal >= 0.35", "threat >= 0.20", "agency_control <= 0.10"]
  },
  "sexual_frustration": {
    "weights": {"sexual_arousal": 0.7, "valence": -0.5, "arousal": 0.4, "engagement": 0.4, "agency_control": -0.4, "threat": 0.2},
    "gates": ["sexual_arousal >= 0.30", "valence <= -0.10"]
  },

  "afterglow": {
    "weights": {"sexual_arousal": 0.3, "valence": 0.7, "arousal": -0.3, "threat": -0.6, "self_evaluation": 0.2, "engagement": 0.2},
    "gates": ["valence >= 0.20", "threat <= 0.20"]
  },
  "sexual_disgust_conflict": {
    "weights": {"sexual_arousal": 0.7, "valence": -0.8, "self_evaluation": -0.3, "threat": 0.2, "arousal": 0.3},
    "gates": ["sexual_arousal >= 0.30", "valence <= -0.40"]
  }
}

## Calculating emotions and sexual states from their prototype weights and gates

Think of it like this:

- Your character has 7 sliders (mood axes), each from -100 to +100.

- Each named emotion (pride, shame, fear, etc.) is defined by a pattern of which sliders matter, and in what direction.

- The numbers like +1.0, -0.5, +0.3 are just “how much that slider contributes” to that emotion.

### What does this mean?

e.g.

"pride": {"self_evaluation": +1.0, "agency_control": +0.4, "valence": +0.3}

Read it as:

Pride increases when:

- (self-evaluation) is positive (pride side) — strongly (+1.0)

- (control/agency) is positive — moderately (+0.4)

- (pleasantness) is positive — a bit (+0.3)

### How do we turn that into a single intensity number?

#### Step A — Normalize your sliders to -1..+1

If your axis is in -100..100, divide by 100.

Example character state:

self_evaluation = +70 (leans proud)

agency_control = +20 (some control)

valence = +10 (slightly positive mood)

Normalized:

self_evaluation = 0.70

agency_control = 0.20

valence = 0.10

#### Step B — Multiply each axis by its weight and add them up

For pride:

self_evaluation: 0.70 * 1.0 = 0.70

agency_control: 0.20 * 0.4 = 0.08

valence: 0.10 * 0.3 = 0.03

Sum (raw score) = 0.70 + 0.08 + 0.03 = 0.81

So far, pride “matches” fairly well.

#### Step C — Divide by the maximum possible raw score (so it becomes 0..1)

The maximum raw score happens when every contributing axis is at its “best” direction (i.e. +1 for positive weights).

For pride, max raw = |1.0| + |0.4| + |0.3| = 1.7

Normalized intensity = 0.81 / 1.7 = 0.476

So pride intensity is about 0.48.

#### Step D — Clamp negatives to 0

If the sum is negative, it means the current state is the opposite of that emotion, so intensity becomes 0.


### The intuition (no math)

Each emotion definition is a stencil.

Your current 7-axis state is the paint.

Multiply-and-sum is just “how well does the paint match the stencil?”

Dividing by max converts it into a clean 0..1 match score.

The bucket labels are just “how strong is that match?”


## Update to prompt to reflect current emotions and sexual state

The prompt to the LLM should be updated to include, as useful information to the LLM in order to roleplay as the character, likely in the section about the character's own information (perhaps near the health), texts like the following:

Given any calculated emotion or sexual state (like "pride" or "sexual_frustration"):

0.00–0.15 = none
0.15–0.35 = low
0.35–0.60 = moderate
0.60–0.80 = high
0.80–1.00 = extreme

Ideally, though, we'd want double the granularity (meaning one from 0.00-0.10, another from 0.10-0.20)... it's just that I can't come up with the appropriate texts for that granularity at the moment. Please come up with the highest, most expressive granularity you can come up with that is still reasonable.

The LLM would receive, through the prompt, something like:

<emotional_state>
fear: high, anger: moderate, sadness: high, hope: rising, shame: none
</emotional_state>
<sexual_state>
sexual_lust: high, romantic_yearning: moderate, aroused_but_ashamed: moderate
</sexual_state>

Note: likely the "_" (underscores) should be replaced by spaces for better legibility for the LLM.

Given that we have lots of emotions and sexual states, likely only the 5-10 with the highest calculated values should be used for the texts sent to the LLM (this is to avoid having five or six meaningful emotions, and then 30 that say [emotion]: none).

## Prompt block to teach LLM how to update all 7 axes + sex excitation/inhibition

This prompt block is orientative. If the analysis of the prompt used (the code can be accessed through the 'Prompt to LLM' button in game.html) suggests modifications and improvements, then improve.

Prompt block:

EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)

You are updating the [CHARACTER_NAME]'s internal state after the latest events. 
Output ONLY the new absolute numeric values (not deltas). Follow the definitions below.

RANGES
- Axes Valence, Arousal, Agency/Control, Threat, Engagement, Future Expectancy, Self-evalution are integers in [-100..100]
- sex_excitation and sex_inhibition are integers in [0..100]

AXES (what each number means)
Valence: + = pleasant/rewarding, - = unpleasant/aversive
Arousal: + = energized/amped, - = depleted/slowed
Agency/Control: + = in control/assertive, - = helpless/powerless
Threat: + = endangered/alarmed, - = safe/relaxed
Engagement: + = absorbed/attentive, - = indifferent/checked out
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Self-evaluation: + = pride/dignity, - = shame/defect/exposed

SEX VARIABLES (absolute 0–100)
sex_excitation (accelerator): how activated sexual interest/readiness is by cues (attraction/intimacy/novelty)
sex_inhibition (brake): how much sexual response is suppressed by danger, shame, anxiety, disgust, consequences

UPDATE HEURISTICS (apply realistically; not all must change)
- Being attacked / threatened: Threat up, Arousal up, Valence down; Agency/Control down if outmatched or restrained; Engagement up if forced focus
- Succeeding / gaining leverage: Agency/Control up; Valence up; Threat down; Future Expectancy up
- Losing / trapped / repeated failure: Agency/Control down; Valence down; Future Expectancy down; Arousal may drop after initial spike
- Loss / grief: Valence down; Arousal often down; Engagement can rise (preoccupied) or fall (shutdown); Future Expectancy may drop
- Clear good news / credible rescue: Future Expectancy up; Valence up; Threat down; Arousal may rise (relief/excitement) or fall (calm)
- Public humiliation / harsh judgment: Self-evaluation down; Valence down; Threat (social) up; Arousal up (hot shame) or down (collapsed shame)
- Boredom/waiting: Engagement down; Arousal down; Valence slightly down or neutral
- Fascination/mystery: Engagement up; Arousal moderate up; Valence depends on tone; Threat may rise if ominous

SEX UPDATE HEURISTICS (keep separate from general emotions)
- Increase sex_inhibition when: Threat is high (danger), Self-evaluation is very negative (shame/exposure), Valence very negative (disgust/distress), high anxiety, severe exhaustion
- Decrease sex_inhibition when: Threat is low (safe/private), Self-evaluation improves (accepted/not judged), calm connection/trust, time pressure drops
- Increase sex_excitation when: attraction/intimacy cues are present and welcome; Valence is positive; Engagement is high; Threat is low; novelty/romance
- Decrease sex_excitation when: danger, disgust, shame, exhaustion, pain, emotional shutdown

CONSISTENCY RULES
- Keep values within their ranges; clamp if needed.
- Don't swing wildly without a strong reason. Typical changes per turn:
  * mild event: 5–15 points
  * strong event: 15–35 points
  * extreme event: 35–60 points
- Ensure the new values match [CHARACTER_NAME]'s likely felt reaction to the specific events (not just "logical" reasoning).

### Update the response schema to include the axes and the sexual values (sex_inhibition and sex_excitation)

Currently the response schema relied upon by the LLM to generate valid thoughts, speech, a chosen action, and notes, should be extended to incorporate the new chosen value for each of the seven axes (Valence, Arousal, Agency/Control, etc.) as well as the sex_inhibition and sex_excitation values, in their ranges (the axes are [-100..100] and the sexual values [0..100]). The code that processes the response of the LLM should update the appropriate components in the acting actor with the new values.

Note: we don't want to keep previous versions of the output schema. The new output schema should replace all previous ones (if more than one exists).

### Create emotional state panel in game.html

We want to create in game.html an emotional state panel styled similarly to the 'Physical Condition' and 'Perception Log' sections. It should be placed between 'Physical Condition' and the 'Perception Log' panels.

the emotional state panel should display the current values of each axis of the mood component, from -100 to 100 . Each end of the bar should be labeled. For example, for the Engagement axis, the -100 side should say indifferent, while the 100 should say absorbed.

Each bar should have a color that matches the axis.

Under the axes and their bars, the text regarding the calculated emotions should be shown. Use the same code that is used (or that will be used, when this brainstorming document gets implemented) to send to the LLM, via a prompt, text like 'fear: high, anger: moderate, sadness: high, hope: rising, shame: none'.

Note: it could be that the acting actor doesn't have a mood component. In that case, don't show the panel.

### Create sexual state panel in game.html

We want to create in game.html a sexual state panel styles similarly to the 'Physical Condition' and above 'Emotional State' panels. It should be placed under the new 'Emotional State' panel.

Note: it could be that the acting actor doesn't have a sexual state component. In that case, don't show the panel.

It should show three bars:

sex_excitation [0..100]
sex_inhibition [0..100]
sexual_arousal (which is calculated, I believe in the range [0..1]. Normalize it to [0..100] and display it like the other bars)

Each bar should be colored appropriately.

Also show the baseline_libido. It doesn't require a bar, as it's a simple value that shouldn't change (unless we create actions related to love potions or something like that.) baseline_libido is a simple number in the range [-50..50] (I believe; check if that range is correct as the baseline_libido is intended to be used in the calculations).

### Comprehensive tests

We need comprehensive tests to ensure the new system works properly. We're particularly interested in ensuring that the emtions and sexual states are correctly calculated from their prototype weights. We also need to test that the texts generated for the emotional states and sexual states, to be used for the prompts and for the UI, work properly, and that states currently gated don't show in the texts.