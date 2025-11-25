# Enhance Action Information for LLMs

These are the requisites for an enhancement to the way available actions are displayed for LLMs in the prompt that gets sent through game.html (the one that requires the LLM to return thoughts, a chosen action, as well as possible speech and notes.)

## Proposed format

We want the new version of the available_actions section to look similar to this:

<available_actions>
  <!-- Consider your character's emotional state, goals, and recent events when selecting. -->

    ## POSITIONING ACTIONS (10 actions)
    **Purpose:** Spatial relationships and body positioning relative to others or furniture.
    **Consider when:** Proximity matters for interaction, relationship dynamics, tactical positioning.

    [Index: 4] Command: "get close to Registrar Copperplate" - Move closer to someone
    [Index: 5] Command: "step back from Registrar Copperplate" - Create distance from someone
    [Index: 6] Command: "sit down on bench" - Take a seat on available furniture
    ...

    ## INTERACTION ACTIONS (25 actions)
    **Purpose:** Object manipulation, giving, taking, examining items.
    **Consider when:** Items are relevant to goals, need to inspect or exchange objects.

    [Index: 15] Command: "pick up book" - Take an item from location
    [Index: 16] Command: "give book to Registrar Copperplate" - Hand something to someone
    [Index: 17] Command: "drop book" - Put down an item
    ...

    ## SOCIAL ACTIONS (18 actions)
    **Purpose:** Interpersonal communication and relationship building.
    **Consider when:** Building rapport, expressing emotions, social maneuvering.

    [Index: 42] Command: "compliment Registrar Copperplate" - Express positive regard
    [Index: 43] Command: "flirt with Registrar Copperplate" - Show romantic/sexual interest
    ...

  <selection_guidance>
    **Decision Process:**
    1. What does my character want right now? (Check current_goals)
    2. What just happened? (Review perception_log)
    3. What's my emotional state? (Consider internal tensions)
    4. Which category serves my current needs?
    5. Which specific action within that category fits best?
  </selection_guidance>
</available_actions>

I think we mostly have all the information needed to produce this, except for the 'Purpose' and 'Consider when' for each mod actions. This information shouldn't be present in each action (as they're relevant to the mod's entire set of actions, and it would be extremely redundant to add it to each action), so I think we need two new properties to the mod-manifest of mods (such as the mod manifest at data/mods/affection/ ). One of the properties will be a text about the purpose of the actions contained therein (e.g. 'Spatial relationships and body positioning relative to others or furniture'), and the other property will be about when those actions should be considered (e.g. 'Proximity matters for interaction, relationship dynamics, tactical positioning.')

These properties should be optional, but used in the prompt to the LLM when present in the mod manifest of that mod.

In addition as part of the implementation of this feature, you should go to the existing mods at data/mods/ , determine the commonalities of actions for each mod (if any action is present, which isn't the case in all mods), and add to the corresponding mod manifests those texts.

I'm not sure if the data of the mod manifest for each mod is available to the code that produces the prompt to the LLM, but if not, this data will need to be made available.

These enhancements should be tested thoroughly.