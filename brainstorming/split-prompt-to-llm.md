# Splitting from to LLM to isolate mood and sexual state updates

Please investigate the code behind the 'Prompt to LLM' button in game.html . That shows a preview of the prompt that will be generated for that character. Also analyze the code that handles the response from the LLM, particularly the parts that processes the returned moodUpdate and sexualStateUpdate.

The problem is the following: a prompt to the LLM, intended for the LLM to act as the character, is told to update the mood and sexual state values based on recent events, the character's persona, etc. And in the same vein, it's told to produce thoughts, speech, notes, and choose an action. However, this breaks how people actually work: first they have an emotional reaction to events. Then, they start thinking, planning, deciding. Our system breaks that reality by actually passing the previous turns' emotional state even though this current prompt has reference to events that have happened after the last turn. This causes issues like: the character was happily watching TV at home. Then, after that turn, a rock crashes through the wall. Then, then prompt to the LLM in the actor's next turn receives the mental state when the actor was happily watching TV, and it's told to base their update to the moods and sexual states, as well as produce the thoughts, speech, notes, and choose an action, colored by the emotional state provided. But the emotional state was the one in which the rock crash hadn't happened.

Our solution is to extract the parts of the prompt that instruct how to produce the mood axes and sexual state updates into a new prompt, that will be sent to the LLM before the prompt that produces speech, thoughts, etc.

So we will have this:

1) an LLM-based actor starts its turn.
2) a prompt gets sent with basically the same inputs as the current prompt, but it only has instructions and output schema to produce the mood updates and sexual state updates.
3) the response from the LLM gets processed. The mood updates and sexual state updates get processed as they currently are. The 'EMOTION STATE' and 'SEXUAL STATE' panels in game.html are updated. Expressions are evaluated and triggered as they currently are.
4) the prompt to the LLM that produces speech, thoughts, notes, and chooses an action gets sent. It no longer contains instructions to update mood nor sexual states, and the output schema is updated to not require mood updates and sexual state updates. Important: given that we've already updated the mood axes and sexual states, the mental state included in the prompt will now be accurate.
5) process the response from the LLM. We haven't returned mood updates nor sexual state updates, so that code should be removed. Also, no expression gets evaluated, as they have already been evaluated.
6) Proceed turn as normal (choosing action)

The new code should reuse as much of the existing code as possible. If there are opportunities for refactoring, refactor. These changes and implementations should be thoroughly tested.

Naturally, the new prompt to the LLM to produce mood axes and sexual status updates will be extremely similar to the original prompt. Copy as much of the text as it makes sense, but remove all instructions regarding speech, thought, notes, and actions (when it comes to producing them).