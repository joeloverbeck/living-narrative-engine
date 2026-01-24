# Changes to Action Prompt

This is related to the prompt sent to the LLM so that it will generate speech, thoughts, notes, and a chosen action. The code can be accessed in game.html , behind the button 'Prompt to LLM'. The response schema for that prompt should also be found, as well as the code that handles the response.

## Issues

While the prompt sent to the LLM so that it will generate coherent, in-context thoughts, speech, notes, and a chosen action, generally works well, we've had regular issues with the LLM recapping previous points in a way that humans don't do, but recently we had a worse issue: a matter that was clearly settled from the context of the conversation was repeatedly mulled over by an actor to the extent of derailing the actual conversation. We want to make changes to the prompt to fix this.

## Reduce number of thoughts

The prompt incorporates a section like this:

"<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):"

I believe it builds into the prompt the latest 4-5 thoughts from the 'core:thoughts' component of the current actor. We want to reduce that number to 1; realistically, in the moment, a human being maybe holds in a detailed manner in their mind the specificities of their latest "block" of thought, not the previous ones, that have already been rendered into notes if they were meaningful enough. All related tests must be updated.

## There’s no explicit concept of “settled vs open.”

Humans stop re-litigating because we carry an internal ledger: this is settled, this is open. Your prompt has no hard mechanism like that, so the model treats everything as perpetually eligible for re-analysis.

### What actually works: a “Cognitive Ledger” + a “No Re-derivation Gate”

Add a small, hard-constraint block that (a) lists Settled Conclusions and Open Questions, and (b) forbids re-deriving settled items unless new evidence arrives.

Pasteable prompt text (drop it right before the <thoughts> section):

<cognitive_ledger>
SETTLED CONCLUSIONS (treat as already integrated; do not re-argue unless NEW evidence appears):
- [SETTLED_CONCLUSION_1]
- [SETTLED_CONCLUSION_2]
- [SETTLED_CONCLUSION_3]

OPEN QUESTIONS (allowed to think about now):
- [OPEN_QUESTION_1]
- [OPEN_QUESTION_2]
- [OPEN_QUESTION_3]

NO RE-DERIVATION RULE (HARD):
- THOUGHTS may reference a settled conclusion only as a short tag.
- If you feel compelled to re-derive a settled point, convert that impulse into an in-character loop-break and move on.
</cognitive_ledger>

This does two big things:

It gives the model a permission structure to stop (“already proven”) without losing coherence.

It redirects “confusion/hypervigilance” away from “rehash the letter” and toward “what can I verify next / what’s the constraint.”

The issue now is that we need a way for the prompt and its response schema to register the need for the LLM to return these settled conclusions and open questions.

Notes are “memory of facts,” not “memory of epistemic status.” Without some explicit status channel, you can’t reliably derive “settled vs open” programmatically—because the same factual sentence can be either:

a settled belief (“the paper is aged”), or

a live hypothesis (“the paper seems aged but could be staged”).

So yes: if you want SETTLED/OPEN to be robust, you need metadata somewhere. But you don’t have to contaminate Notes to get it.

We need to add a cognitive ledger component among the core components at data/mods/core/components/ . It just contains an array of settled_conclusions and an array of open_questions . We'll need to include in the prompt instructions about how to generate these. Max 3 array entries for each. The response schema should be modified to include as required these arrays of settled_conclusions and open_questions. The code that handles the response from the LLM should overwrite the actor's cognitive_ledger component each time (we don't want to add to existing arrays).

If the actor doesn't have a cognitive_ledger component in its entity definition (may happen in the first turn), then the whole <cognitive_ledger> section isn't rendered in the prompt.

#### The killer rule to prevent churn

Add this constraint to the instructions section for what to include in the cognitive_ledger response:

"Ledger Update Rule (HARD):

You may move one item from OPEN → SETTLED only if new evidence appeared in the perception log this turn.

You may move SETTLED → OPEN only if new conflicting evidence appeared this turn.

Otherwise, keep the ledger unchanged."

That stops the model from “reopening” closed items just because confusion is high.

## Inner state integration changes

There's a section in the prompt like this:

"CONFLICT RULE (persona vs state): If persona would hide vulnerability, show that as deflection (brittle humor, contempt, procedural thinking, silence, refusal), not as neat self-awareness. The emotion still leaks; it just leaks in-character.

</inner_state_integration>"

We want to add a new rule before </inner_state_integration> that says:

"CONFUSION TARGET RULE: Confusion must attach to open questions only, not to re-evaluating settled conclusions."

Update any related tests if necessary.

## Changing the prompt that updates mood axes

We have a prompt to update mood axes. It's not the same as the prompt that requests generating thoughts, speech, etc. In that prompt for mood axes, we need to ensure that there are instructions regarding the "uncertainty" mood axis that indicates that once a conclusion is reached, the uncertainty should lower. Perhaps this is already modelled, and the prompt is already doing all it can regarding these issue of repeating settled matters.