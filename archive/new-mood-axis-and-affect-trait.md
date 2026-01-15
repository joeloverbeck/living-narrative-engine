# Implement new mood axis and affect trait

## Inhibitory control mood axis

We've realized we need to add a inhibitory_control mood axis to the existing mood.component.json , to make our emotions and expressions system more psychologically realistic.

define it like (stateful, -100..100):

+100 = tightly restrained / suppressing impulses (“white-knuckling it”)

0 = baseline

-100 = disinhibited / impulsive (“letting it fly”)

That axis plugs the exact hole a Monte Carlo report screamed about: you can’t currently represent “anger high but expression inhibited” as a stable region. So you’re forced to fake it with agency/threat/arousal combos, and you get rarity cliffs. (That’s not an “anger prototype gap”; it’s a regulation dimension gap.)

## Self control trait

What you’ve put into core:affect_traits so far are enduring capacities (empathy, harm aversion). A stable self-control / impulsivity trait sits naturally alongside those as an enduring individual-difference dimension (psych uses many trait models here; impulsivity is routinely treated as multi-faceted, but a single “self-control” dial is a valid first cut).

Where the trait really pays off is that it gives you a clean two-level story:

Trait (self_control) = baseline temperament / regulatory capacity

State axis (inhibitory_control) = situational restraint right now

That matches how psychologists separate enduring individual differences from momentary regulatory state much better than trying to cram everything into mood axes alone.

Practical modeling benefit (and why it helps “suppressed rage” specifically)
“Suppressed rage” is basically:

action tendency: high anger

regulatory clamp: high inhibition/restraint

Without the clamp dimension, you’re trying to infer “clamp” from things like threat/agency/self-eval — which sometimes correlates, but isn’t the same thing. That’s why the Monte Carlo distribution becomes brittle and context-dependent.

## What you actually lack (as illustrated by the expression + Monte Carlo)

Not an emotion prototype.

You lack a control-of-expression / impulse-restraint signal that can be:

high while anger is high (suppressed rage)

low while anger is high (explosive rage)

independent-ish from threat/agency/arousal so it doesn’t collapse into weird rarity regimes

And psychologically, that missing signal is much closer to inhibitory control/effortful control than to BIS or BI temperament — so treat it that way and rename it accordingly.

## Names that won’t fight psychology or your own sexual model
Mood axis (state): inhibitory_control
Meaning: momentary ability/willingness to clamp impulses (including anger expression).

Trait (stable): self_control
Meaning: baseline regulatory capacity (temperament), which biases but does not dictate the state.


This avoids the “behavioral inhibition” naming collision (BIS / Kagan BI) and avoids confusion with your sexual inhibition variables.

Changes to mood.component.json

{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:mood",
  "description": "Tracks the mood axes that define a character's current affective/regulatory state. Each axis ranges from -100 to +100.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "valence": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pleasant (+) to unpleasant (-). Overall hedonic tone."
      },
      "arousal": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Energized (+) to depleted (-). Activation level."
      },
      "agency_control": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Dominant/in-control (+) to helpless (-). Felt power."
      },
      "threat": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Endangered (+) to safe (-). Perceived danger."
      },
      "engagement": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Absorbed (+) to indifferent (-). Attentional capture."
      },
      "future_expectancy": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Hopeful (+) to hopeless (-). Belief in positive outcomes."
      },
      "self_evaluation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pride (+) to shame (-). Momentary self-worth."
      },
      "affiliation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Social warmth and connectedness. (-100=cold/detached/hostile, 0=neutral, +100=warm/connected/affiliative)"
      },
      "inhibitory_control": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Momentary restraint/response inhibition. +100=tightly restrained/white-knuckling; 0=baseline; -100=disinhibited/impulsive."
      }
    },
    "required": [
      "valence",
      "arousal",
      "agency_control",
      "threat",
      "engagement",
      "future_expectancy",
      "self_evaluation",
      "affiliation",
      "inhibitory_control"
    ],
    "additionalProperties": false
  }
}

Changes to affect traits:

{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:affect_traits",
  "description": "Stable personality traits affecting empathy, harm aversion, and regulatory capacity. Unlike mood (transient states), these traits rarely change and represent enduring character attributes.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "affective_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Capacity to feel what others feel. (0=absent, 50=average, 100=hyper-empathic)"
      },
      "cognitive_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Ability to understand others' perspectives intellectually. (0=none, 50=average, 100=exceptional)"
      },
      "harm_aversion": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Aversion to causing harm to others. Modulates guilt and inhibits cruelty. (0=enjoys harm, 50=normal, 100=extreme)"
      },
      "self_control": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Baseline impulse control / self-regulation capacity. Biases inhibitory_control and dampens disinhibition under arousal/threat. (0=highly impulsive, 50=average, 100=highly self-controlled)"
      }
    },
    "required": [
      "affective_empathy",
      "cognitive_empathy",
      "harm_aversion",
      "self_control"
    ],
    "additionalProperties": false
  }
}

## Monte Carlo: what you must change so the report stops lying to you
If your Monte Carlo sampler currently only samples the 8 axes, you must:

Include inhibitory_control in the sampled mood vector.

Normalize it exactly like the others (÷100).

Ensure prototype-gated sampling still works when a new axis exists (it should, as long as unknown axis weights default to 0).


If you don’t do this, the simulator will under-explore the very dimension you’re introducing, and you’ll get misleading rarity.

## Widespread changes

Adding a new mood axis and a new affect trait will affect many parts of the code. All references to 'mood' or 'moodAxis' should be researched so that they take into account the new 'inhibitory_control' as necessary. All references to 'affect' or 'affectTraits' should be researched to determine if they need to take into account the new 'self_control' if necessary. Tests would be beneficial to prove the modified parts take into account the new mood axis and new affect trait.

In addition, in game.html , we have an 'EMOTIONAL STATE' section that shows the mood axes. We need to include the UI slider for the new 'inhibitory_control' mood axis. The color scheme for all mood axes should be reassessed, to ensure that the new 'inhibitory_control' mood axis uses fitting yet distinct colors. In expressions-simulator.html , we have the 'Mood Axes' section that has sliders and functionality for all existing mood axes from mood.component.json . The UI and behavior for the new 'inhibitory_control' should be implemented. In the 'Affect Traits', the UI slider and functionality for the new affect trait 'self_control' should be implemented.