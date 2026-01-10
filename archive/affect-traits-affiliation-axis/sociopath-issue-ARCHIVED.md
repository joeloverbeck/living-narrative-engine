# A sociopathic character has revealed issues with our emotion transform system

## Status: ✅ ARCHIVED - Issue Resolved

This brainstorming document led to the successful implementation of the Affect Traits system. The sociopath problem has been solved.

---

## References

Please read the document emotion-intensity-calibration.md to know how emotions are transformed in our system.

Also analyze the existing prototype sets for emotions and sexual states in data/mods/core/lookups/

Analyze mood.component.json and sexual_state.component.json

## The sociopath problem

We have a character that starts with this combination: "core:mood":

 "core:mood": {
            "valence": 15,
            "arousal": 45,
            "agency_control": 75,
            "threat": 20,
            "engagement": 80,
            "future_expectancy": 10,
            "self_evaluation": 90
        },
        "core:sexual_state": {
            "sex_excitation": 70,
            "sex_inhibition": 35,
            "baseline_libido": 40
        }

It translates to these emotions: pride: intense, interest: strong, flow: strong, fascination: strong, compassion: moderate, admiration: moderate, curiosity: moderate. That seems perfectly reasonable for a normal person, it just happens that the person in question with the emotions is a sociopath, so that 'compassion:moderate' is wrong, and will trigger expressions (narrative beats dependent on emotions) that don't fit her.

Clearly we're missing a mechanic that optionally, per character, applies some kind of extra weight or bias to specific prototypes. But I'm not sure what the best way to do that would be without wrecking the calculations.

## Possible solutions

I asked ChatGPT for the best possible solutions that make the most psychological sense.

Here's its response:

### Why your system gives her "compassion: moderate"

With your starting mood:

valence 15 → 0.15

arousal 45 → 0.45

agency_control 75 → 0.75

threat 20 → 0.20

engagement 80 → 0.80

future_expectancy 10 → 0.10

self_evaluation 90 → 0.90

Your compassion prototype is:

weights: valence 0.15, engagement 0.85, self_evaluation 0.25, threat -0.35, agency_control 0.10

gates: engagement >= 0.30, valence in [-0.20, 0.35], threat <= 0.50 (all pass)

So the math is basically dominated by engagement (0.85 × 0.80 = 0.68) plus self_evaluation (0.25 × 0.90 = 0.225). That alone gets you a pretty chunky rawSum. In other words:

your compassion prototype currently reads like "prosocial attentiveness / engaged warmth," not "capacity for empathic concern."
A sociopath can absolutely be highly engaged and socially "warm-performing" without compassion. So you're missing a trait/capacity dimension, not just a tuning knob.

### Possible solution

Add a trait axis (the "correct" fix): empathic concern / callousness

This is the real missing mechanic: capacity traits that are stable-ish per character and should influence only specific emotions.

Add a component like:

"core:affect_traits": {
  "empathic_concern": 0.05,     // [0..1]
  "callousness": 0.85,          // [0..1]
  "perspective_taking": 0.70    // optional, cognitive empathy
}


Then update relevant prototypes to include these axes.

For compassion, add:

empathic_concern with positive weight

callousness with negative weight (high callousness drags it down)

Example tweak:

"compassion": {
  "weights": {
    "valence": 0.15,
    "engagement": 0.85,
    "self_evaluation": 0.25,
    "threat": -0.35,
    "agency_control": 0.10,
    "empathic_concern": 1.0,
    "callousness": -0.8
  },
  "gates": [
    "engagement >= 0.30",
    "valence >= -0.20",
    "valence <= 0.35",
    "threat <= 0.50",
    "empathic_concern >= 0.15"
  ]
}


Pros

Psychologically correct: separates engagement from empathic capacity.

Preserves your math model (still "weighted prototype matching + gates").

Generalizes beautifully: guilt, empathic_distress, shame, remorse, attachment emotions, etc.

Cons

Requires engine + schema support for trait axes (and analyzer support).

You'll want to audit which emotions should depend on these traits.

If you care about long-term sanity, this is the best foundation.

Why: your current "compassion" is mathematically wired to fire for high engagement in a safe-ish context. That's not compassion; that's attentional/prosocial orientation. Without an empathy/callousness dimension, you'll keep whack-a-moling this in other places (empathic distress, guilt, remorse, tenderness, attachment beats).

### Mood axis vs trait (the core distinction)

Your 7 axes are all fast-moving state/appraisal variables: they can plausibly swing a lot from events minute-to-minute.

"Callousness ↔ empathic concern" is not like that for most characters. In psych terms, what differentiates a sociopath here is mainly low affective empathy / callous-unemotional traits — comparatively stable, changing slowly (if at all). If you shove that into core:mood, you'll get weird outcomes like:

a single nice interaction "increasing empathy" by 30 points

panic/fear moments "reducing empathy" in a way that permanently changes the person

lots of prototype weights accidentally becoming "empathy-sensitive" just because it's now a mood axis

So: don't add an 8th mood axis unless you want "interpersonal stance" as a state dimension. Callousness itself should be a trait axis, not mood.

## Best solution: add a separate trait component (capacity axes)

Add something like:

{
  "id": "core:affect_traits",
  "affective_empathy": 10,      // 0..100 (capacity to feel others' pain/concern)
  "cognitive_empathy": 70,      // optional (perspective-taking; sociopaths can be high)
  "harm_aversion": 20           // optional (inhibits cruelty)
}


Normalize to [0..1] internally (just like you do mood axes).

Then fix compassion properly

Right now compassion is basically "engaged + non-hostile + decent self-regard." That's social attention, not empathic concern.

Make compassion require empathic capacity:

"compassion": {
  "weights": {
    "engagement": 0.75,
    "valence": 0.15,
    "threat": -0.25,
    "affective_empathy": 1.0
  },
  "gates": [
    "engagement >= 0.30",
    "affective_empathy >= 0.25",
    "threat <= 0.50"
  ]
}


Two important notes:

I would remove self_evaluation from compassion. Pride shouldn't create compassion.

Keep affective_empathy out of most emotions. Only wire it into the few that actually represent empathic concern (compassion, empathic_distress, guilt/remorse if you model it that way, maybe tenderness).

Why this doesn't wreck your system

Existing prototypes don't change unless you add the new weight/gate.

Sexual prototypes don't need to care unless you explicitly want them to.

Your analyzer remains sane: for a given character, affective_empathy is just another fixed axis value during bounds calculation.

### If you really want an 8th mood axis, make it this (not "callousness")

If you want a stateful interpersonal dimension that can swing with context, the psychologically defensible candidate is:

affiliation / communion (cold/detached ↔ warm/connected) in [-100..100]

This is basically the "communion" dimension from interpersonal models (orthogonal-ish to agency). You already have an agency axis; you don't have communion.

But: communion is still not empathy capacity. A sociopath can perform warmth and seek affiliation while lacking affective empathy. So if you add this mood axis, you still want the trait too.

The robust combo is:

Trait: affective_empathy (stable capacity)

Mood: affiliation (momentary connectedness/warmth)

Then compassion = needs both:

affective_empathy gate (can they feel it?)

affiliation / engagement gate (are they currently oriented toward others?)

### My recommendation

Do not add "callousness ↔ empathic concern" to core:mood.

Add a new trait component with at least affective_empathy (0..100).

Update only the handful of empathy-dependent emotions (starting with compassion) to use it.

Optionally later add a mood axis affiliation/communion if you want richer social-state dynamics.


## Adding Empathy/Callousness as Character Traits

Psychological research strongly supports modeling stable empathic traits separate from momentary mood. Sociopaths (and psychopathic personalities) are specifically characterized by callous–unemotional (CU) traits – a persistent disregard for others and lack of empathy. In other words, even if a sociopath is "engaged" (high on attention/interest), they won't generate genuine compassion if their affective empathy capacity is low. Empathy is typically split into cognitive empathy (perspective‐taking) and affective/emotional empathy (actually feeling what others feel). People with high cognitive empathy can still understand others' pain, but without affective empathy they remain unmoved by it.

To capture this, a separate trait component (e.g. core:affect_traits) is psychologically realistic. Key trait axes to include are:

Affective Empathy (Empathic Concern) – a stable capacity to feel and share others' emotions. High affective empathy leads to compassion and guilt; low affective empathy (callousness) means indifference. For example, "Emotional empathy is when you can feel another person's emotions…begin to feel sad too".

Cognitive Empathy / Perspective-Taking – the ability to intellectually understand another's viewpoint. Sociopaths often have normal or even heightened cognitive empathy (they "know" what others feel) while lacking emotional empathy. "Cognitive empathy means that you can understand another person's perspective…[it] is referred to as perspective-taking or putting yourself in someone else's shoes".

Callousness / Lack of Empathy – essentially the opposite of affective empathy, this trait measures cruelty or indifference. High callousness (or high CU traits) is directly tied to low compassion. (In practice, one can represent callousness by a negative weight on an empathy axis.)

Prosocial/Moral Constraint (optional) – traits like harm aversion or guilt-proneness capture an individual's tendency to feel remorse or to avoid hurting others. For instance, low guilt-proneness is another feature of CU traits. This could influence emotions like guilt or shame.

Including these traits means that an otherwise empathetically capable mood will still fail to generate compassion, guilt, etc., if the character's trait value is low. In psychopathy research, for example, children high on CU traits score low on affective empathy and prosocial emotions regardless of context. Encoding these as separate "affect traits" preserves the existing intensity math (they simply add extra axes with fixed values per character) and cleanly distinguishes transient mood from stable interpersonal disposition.

## Adding an Affiliation/Communion Mood Axis

Psychology also recognizes interpersonal warmth (affiliation/communion) as a core affect dimension distinct from valence and arousal. The classic interpersonal circumplex model is defined by two orthogonal axes: agency (status, dominance/control) and communion (agreeableness, warmth, affiliation). In that model, agency is the vertical axis (we have this as "agency_control"), and communion (often termed affiliation, warmth, or friendliness) is the horizontal axis. Dominance/agency deals with power/control, whereas affiliation/communion captures social connectedness – e.g. the difference between acting cold/detached versus warm/connected.

Empirically, affiliation is viewed as a "social" affect dimension. For example, recent work on music and emotion had listeners rate affiliation as an emotion axis alongside dominance. The authors note: "Dominance relates to feelings of control, assertiveness, and influence, whereas affiliation refers to feelings of connection". In everyday terms, a high-affiliation mood would make someone feel sociable, friendly, connected, while low affiliation (cold/detached) is hostile or withdrawn.

We currently have axes like valence, arousal, agency, and more specialized ones (threat, engagement, etc.), but we lack any explicit "warmth" dimension. Adding a Communion/Affiliation axis (e.g. –100 = cold/detached, +100 = warm/connected) would align with well-established models of interpersonal affect. This gap is important: a sociopath might score high on our existing axes (engagement, agency, etc.) yet still not "feel for others" – precisely because that axis is missing. Having a communion axis ensures that some emotions (like compassion, trust, or friendliness) require both positive valence and a warm, affiliative state.

Beyond communion, most psychological models treat valence (pleasure–displeasure) and arousal as fundamental axes (we have these). Some include a third dimension like dominance (we cover this as agency_control). Other "axes" in our system (threat, self-evaluation, etc.) arise from specific appraisal theories and need no additional general axes. In summary, the main known gap is the social/warmth dimension. Including it (with well-chosen extremes, e.g. cold/uncaring ↔ warm/connected) would make the mood representation more psychologically complete.

## Integration with our existing systems

Uses of the current keys in mood.component.json across the codebase will need to be reviewed.

- The page expressions-simulator.html has sliders for each of the mood axes and sexual states. We will need to add a slider for the new dimension of the mood axes. In addition, given that it seems we're implementing a separate 'core:affect_traits' that will take part in the transformation of emotion and sexual state prototypes, the expressions-simulator.html page will also need a slider-based block that reflects the implemented 'core:affect_traits'.

- The page expression-diagnostics.html will need to be investigated to determine how this inclusion of a new dimension of mood axes , and the inclusion of affect_traits will require changes to the code. Investigate the code behind the buttons 'Run Static Analysis', 'Run Simulation', and 'Find Witness State'. Clearly the Monte Carlo simulator will need to seed the new mood axes dimension as well as the affect traits, and the Witness State Finder will need to have those in mind as well.

---

## Resolution

All recommendations from this brainstorming document were implemented:

1. ✅ Created `core:affect_traits` component with three axes:
   - `affective_empathy` (0-100)
   - `cognitive_empathy` (0-100)
   - `harm_aversion` (0-100)

2. ✅ Added `affiliation` mood axis to `core:mood` component

3. ✅ Updated emotion prototypes:
   - `compassion`: Added affective_empathy weight and gate
   - `empathic_distress`: Added affective_empathy weight and gate
   - `guilt`: Added affective_empathy and harm_aversion weights with gate

4. ✅ Updated EmotionCalculatorService to handle trait axes

5. ✅ Updated diagnostics tools:
   - WitnessState model
   - MonteCarloSimulator
   - WitnessStateFinder

6. ✅ Updated UI tools:
   - expressions-simulator.html
   - expression-diagnostics.html

7. ✅ Comprehensive test coverage:
   - Unit tests for all components
   - Integration tests for expression evaluation
