# Speech Patterns Rework requirements

We want to rework how speech patterns used by character definitions through speech_patterns.component.json , how they are depicted in the prompt sent to the LLM through the game.html page so that the LLM produces thoughts, one action, as well as possible speech and notes, and also how those speech patters are generated in the page speech-patterns-generator.html .

## Likely files to modify (among others)

1. **`src/prompting/templates/characterPromptTemplate.js`**
2. **`data/prompts/corePromptText.json`**

## Changing the structure of speech patterns in speech_patterns.component.json

Currently, characters, such as vespera_nightwhisper.character.json from the 'fantasy' mod ( data/mods/fantasy/ ) store speech patterns as a simple array of strings. That forces the users to write speech patterns in the format [ "([SPEECH_PATTERN_TYPE] '[SPEECH_PATTERN_EXAMPLE]')" ] .

We want to allow in speech_patterns.component.json , in addition to the current structure so that the additions are backwards compatible, a structure like the following:

  **Feline Verbal Tics**
     Casual context: "meow", "mrow", "mmh" integrated naturally into speech
     Manipulative context: Intensified cuteness ("meow-y goodness~") when deceiving
     Vulnerable context: Complete absence of cat-sounds when genuinely upset

     Examples:
     - "Mrrrow... I could play the ballad about the duke's wife... or mmh... maybe something newer?"
     - "Met this merchant—boring as hell, meow, but he knew stories from the Brass Islands."
     - "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
     - "Oh meow-y stars, you have NO idea what I can do~" (deception)
     - "Don't. Don't you dare." (vulnerability - no cat-sounds)

We would likely need an array of objects, each with: 1. general type of the speech patterns contained . 2. an array of contexts where these speech patterns would be applicable . 3. an array of examples.

## Proposed changes for the prompt sent to the LLM

We want the code that builds the prompt for the LLM in game.html to detect if the speech_patterns.component.json of the actor has the new structure (array of objects instead of array of strings). In that case, the structure of the speech patterns section in the prompt should change to something like:

```xml
<speech_patterns>
  <!-- Use naturally, not mechanically. Examples show tendencies, not rules. -->

  1. **Feline Verbal Tics**
     Casual context: "meow", "mrow", "mmh" integrated naturally into speech
     Manipulative context: Intensified cuteness ("meow-y goodness~") when deceiving
     Vulnerable context: Complete absence of cat-sounds when genuinely upset

     Examples:
     - "Mrrrow... I could play the ballad about the duke's wife... or mmh... maybe something newer?"
     - "Met this merchant—boring as hell, meow, but he knew stories from the Brass Islands."
     - "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
     - "Oh meow-y stars, you have NO idea what I can do~" (deception)
     - "Don't. Don't you dare." (vulnerability - no cat-sounds)

  2. **Narrativization Bleeding**
     Compulsively processes events as art material mid-conversation
     Refers to people and situations in narrative/compositional terms

     Examples:
     - "Gods, the way the light hit the blood—no, wait, shit, someone's dying—minor seventh, definitely minor seventh for this moment..."
     - "That blacksmith would make a perfect tragic figure. The hands, the regret..."
     - *smoothing tail fur* "Mrrrow, I should write this down before I forget the composition"

  3. **Tonal Shifts**
     Abrupt transitions from flirtation to cold analysis without warning
     Deflects genuine compliments with aggressive flirtation or mockery
     Rare moments of genuine vulnerability followed by immediate deflection

     Examples:
     - "You have gorgeous eyes, truly mesmerizing~ Your pupil dilation suggests arousal but your breathing's defensive. Childhood trauma or recent betrayal?"
     - "Oh, you think I'm talented? How adorable. Want to fuck about it, or should we skip to the part where you're disappointed?"
     - "Sometimes I think I'm just empty inside, you know? Just performance all the way down. *laughs* Gods, how fucking melodramatic. Forget I said that."

  4. **Violence Casualization**
     Combat and death treated as mundane background events
     Combat language becomes tactical and detached during fights
     Trails off mid-sentence about violent experiences

     Examples:
     - "Killed three bandits before breakfast, mrow. You were saying?"
     - "Three on the left, two behind. The one with the axe moves like he's compensating—target him first. Beautiful formation, really. Shall we?"
     - "I think... no, I'm sure I... after that fight I wrote the best verse I've—sorry, what?"

  5. **Deflection & Exposure Patterns**
     Rare moments of confessional self-examination
     Alcohol/substances referenced casually as thinking aids
     Trailing off when approaching emotional honesty

     Examples:
     - "Why do I keep doing this? No, seriously—is it the adrenaline or am I just... mmh... Do you think people can be addicted to feeling anything at all?"
     - "I think better with wine, meow. Or whiskey. Something to... clarify things, you know?"
     - "I'm not actually... I mean, the performance is just... Fuck. Never mind."

  6. **Fragmented Memory & Possession**
     Casually admits to violence gaps and dissociation
     Possessive language about her instrument, where her capacity for devotion lies
     Acknowledges combat-induced fugue states matter-of-factly

     Examples:
     - "After that fight, I wrote my best piece. Can't remember... mmh... how long I kept swinging, actually. But the composition was crystalline."
     - "Don't touch her, she's perfectly tuned. And unlike people, my instrument is irreplaceable."
</speech_patterns>

<usage_guidance>
Use these patterns NATURALLY when appropriate to situation and emotion.
DO NOT cycle through patterns mechanically.
Absence of patterns is also authentic—not every line needs special features.
</usage_guidance>
```

It's possible that the way we use <usage_guidance> here would need to be uniform for cases where the speech_patterns structure is the array of strings one, meaning that the only thing that would change would be the content between <speech_patterns> and </speech_patterns>

## Modify Vespera Nightwhisper's speech patterns

Once you modify speech_patterns.component.json , the character definition of vespera_nightwhisper.character.json in data/mods/fantasy/entities/definitions/ should be modified to contain the data shown in the '## Proposed changes for the prompt sent to the LLM' section.

## Change the code and prompt of speech-patterns-generator.html

Study the code behind speech-patterns-generator.html and modify both the prompt, the schema for the response, and the code so that the speech patterns returned are in the 'array of objects' format we've added to speech_patterns.component.json , so that all future characters take advantage of these better organized speech patterns.

It's possible that the export feature would also need to be fixed. Just in case, analyze the way the speech patterns get displayed on the page, as in the past we've had issues with the animation causing the speech patterns to disappear the moment they're shown on the page.