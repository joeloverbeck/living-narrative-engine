Currently, the prompt to the LLM produces thought sections like these:

"INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects.

<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):

-----
Generate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you're thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.
</thoughts>"

We realized that the text that comes after '-----' is redundant with the INNER VOICE GUIDANCE section, and we want to reword the texts better, so the code needs to be modified so that it produces text like the following:

"<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):

-----
INNER VOICE GUIDANCE: Generate thoughts in your character's authentic mental voice (their habits of mind, personality patterns, and inner speech style). Build on your current mental state with a fresh thought that does not repeat or barely rephrase the "Recent thoughts" above.

TIMING: The thought must occur in the instant IMMEDIATELY BEFORE you perform your chosen action.

ANTICIPATION (ALLOWED): You may anticipate likely outcomes, risks, fears, hopes, and contingencies as possibilities (this is normal human/character planning).

EPISTEMIC RULE (CRITICAL): You do NOT yet know the result of your action. Do not describe outcomes, reactions, success/failure, or consequences as facts or as already happened.

STYLE RULE: Use intent- and possibility-language ("I'm going to...", "I want to...", "maybe...", "might...", "if...", "hopefully..."). Avoid past-tense or certainty about effects ("That hurt them." "They fall." "It worked.").
</thoughts>
"