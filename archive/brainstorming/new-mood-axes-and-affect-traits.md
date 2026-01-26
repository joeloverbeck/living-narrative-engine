# New Mood Axes and Affect Traits

We recently had to add a couple of mood axes to mood.component.json . That led us to consider what other gaps we had in both mood axes and affect traits (affect_traits.component.json)

We've identified some, so we'll have to implement them. It's vital to fill these gaps early on, as that causes cascade changes to prototypes (they need to be reassessed, as they're composed of mood axes, affect traits, and sexual variables), and even down the line, into expressions (which mostly rely on emotions and sexual states, but also incorporate raw mood axes).

## Add a mood axis: contamination_salience (strongest case)

Right now your only “disgust-ish” state, disgust, is being expressed mainly as valence− + affiliation− (and a bit of arousal/threat). 

emotion_prototypes.lookup


That works for “I want distance from you,” but it’s a conceptual mismatch for core disgust, which is primarily “this is contaminating / revolting / purity-violating,” and only sometimes social. (Contempt and hatred being affiliation-driven is fine; disgust being affiliation-driven is the odd one out.) 

emotion_prototypes.lookup

### Why this is a real missing dimension (not axis-bloat):

You can have high threat without disgust (predator, violence). 

mood.component

You can have high disgust without threat (gross-but-safe smell, rotten food in a bin). 

mood.component

You can have high disgust without social disconnection (nausea at blood while still caring deeply about the injured person). 

mood.component


So it’s distinct from threat, valence, and affiliation. 

mood.component

### Definition (fits your existing mood schema style):

contamination_salience: -100 = “nothing feels contaminating/gross”, 0 = neutral, +100 = “strong contamination/repulsion salience (pathogen/purity/visceral revulsion)”.
This is “what the body is reacting to,” not “do I like it” (valence) and not “am I connected to you” (affiliation). 

mood.component

### Concrete payoff immediately:

You stop using affiliation as a proxy in disgust (and you can optionally let sexual_repulsion lean on contamination too if you want). 

emotion_prototypes.lookup
 
sexual_prototypes.lookup

Downstream expressions become cleaner: recoil, gag, “won’t touch it,” moral-purity recoil, etc., without faking it as “social coldness.”

### Schema addition

"contamination_salience": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Non-contaminating/neutral (-) to highly contaminating/revolting (+). Visceral repulsion / pathogen-purity salience; distinct from danger (threat) and from social distance (affiliation)."
}

## Add an affect trait: disgust_sensitivity

If you add contamination_salience, the trait that actually makes it sing is: “how easily / intensely does that axis spike for this character.”

This is distinct from your existing traits:

Not harm_aversion (moral inhibition). 

affect_traits.component

Not empathy. 

affect_traits.component

Not self-control. 

affect_traits.component

Trait meaning: 0 = iron-stomach, 50 = average, 100 = highly squeamish / contamination-reactive.

If you don’t want a new trait, you can still do this as a per-character tuning constant elsewhere. But as an “affect trait,” it’s one of the rare additions that’s both psychologically real and mechanically useful.

### Schema addition

"disgust_sensitivity": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 50,
  "description": "How easily/intensely contamination_salience spikes. 0=iron stomach, 50=average, 100=highly squeamish/contamination-reactive."
}

## Rumination / sticky replay

Right now, the closest “rumination-ish” cluster is basically:

nostalgia / grief / resentment leaning on temporal_orientation− + engagement+ (plus valence stuff). 

emotion_prototypes.lookup

 

mood.component

That’s not wrong, but it’s also not the same thing as perseveration/replay. engagement is “attentional capture,” not “can’t disengage / repeats the same thought.” 

mood.component

If you add prototypes like brooding, obsessive_review, intrusive_replay, compulsive_checking, you’ll quickly end up hacking rumination out of some brittle combo like (engagement high) AND (inhibitory_control weird) AND (uncertainty high)—and that is the kind of “proxy axis” mistake you’re trying to avoid.

Form I’d choose:

Mood axis: rumination (−100 = mentally flexible / easy disengagement, +100 = sticky repetitive replay).

## Ruminative tendency

A new affect trait: ruminative_tendency (how easily the new rumination axis spikes).

## Social-evaluative exposure / being judged

Verdict: the most likely of the three to become a genuine gap—but only if you want social modeling to be specific.

Your shame/embarrassment/humiliation family currently works via self_evaluation− + threat(+ arousal). 

emotion_prototypes.lookup


And your sexual set already encodes “performance anxiety” as threat + uncertainty + self_evaluation≤0. 

sexual_prototypes.lookup

That’s coherent if you’re willing to treat threat as “danger broadly construed,” including social danger. 

mood.component

### Where it breaks (the true gap): when you want states like:

stage fright / being watched without self_evaluation being negative (confident person still feels scrutinized),

“evaluation pressure” as a context driver for expressions (masking, impression management, fawning, performative confidence),

social exposure effects that are not well-described as “danger” and not reducible to shame.

If you move into that territory, you’ll start forcing threat and self_evaluation to do jobs they weren’t built for. That’s exactly your “axis hack” smell.

So:

If social context + impression-management expressions are a major pillar: yes, you’ll want a mood axis like evaluation_pressure / social_exposure_salience.

### Evaluation sensitivity trait

New affect trait: evaluation_sensitivity (stable proneness for the new axis of evaluation_pressure / social_exposure_salience (whatever we call it) to spike).

## Widespread changes to the code

Mood axes and affect traits affect many places.

- We need a codebase search for mood , moodAxis, moodAxes, affect, affectTraits, and update them with the new values. Update any related tests, and if you believe it necessary, create new tests to cover new behavior.

- expression-simulator.html : the sections 'Mood Axes' and 'Affect Traits' will need sliders and UI components for the new mood axes and affect traits. Ensure the functionality works. Update any related tests, and create new tests to cover new behavior if necessary.

- expression-diagnostics.html : the buttons 'Run Static Analysis' and 'Run Simulation' may handle mood axes and affect traits in peculiar ways that may need to be handled to ensure it takes into account the new mood axes and affect traits. Update any related tests, and create new tests to cover new behavior if necessary.

- prototype-analysis.html . The code behind the button 'Run Analysis' may also handle mood axes and affect traits in unique ways, for example for sampling. We have to ensure that the new mood axes and affect traits are handled. Update any related tests, and create new tests if necessary.

- game.html : the section 'EMOTION STATE' (I think that it's called like that) has UI sliders to depict mood axes. New entries must be added for the new mood axes. Color schemes will need to be determined: they need to be distinct and fitting to the mood axes and their polarization.

- game.html . The code behind the 'Prompt to LLM' button shows the code that builds the prompt sent to the LLM so that it will update mood axes. It has instructions for when to lower or increase mood axis values. We need instructions for the new mood axes. The LLM response schema should be modified to handle the new mood axes, and the code that receives the response should make sure to update those mood axes.

## Refactoring

If throughout your analysis of things to modify you see opportunity to refactor things related to handling mood axes and affect traits, to reduce duplication to a minimum and maximize code reuse, then propose refactorings, but ensure first that those parts of the code to refactor are covered thoroughly by integration tests (tests/integration/ ). If those tests don't already exist, they'll need to be created.

## No modifying prototypes

Do not modify any of the prototypes from data/mods/core/lookups/ . I will later commission deep research to ChatGPT to determine how these should be modified.

