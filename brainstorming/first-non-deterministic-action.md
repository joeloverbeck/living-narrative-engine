# Requisites for implementing first non-deterministic action

Until now, every one of the existing actions in the mod structure ( data/mods/ ) is fully deterministic: if it's available, when executed, it will succeed. However, we are going to implement combat, and we want combat actions, such as cutting someone with a longsword, to be non-deterministic: based on skills of both the acting actor and the target. That means that the templates shown to the users won't be 'slash at chicken with longsword', but something like 'slash at chicken with longsword (55% chance)'

## Defining Skills and Attributes for an Immersive Sim

In an immersive sim or RPG, deciding what skills/attributes to model is a crucial first step. Many games fall back on the classic D&D-style attributes like Strength, Dexterity, Intelligence, etc., because they cover broad aspects of capability and are familiar.

However, you don’t have to stick strictly to those clichés if they don’t fit your simulation. Immersive sims often benefit from a more granular skill-based approach. Instead of just raw Strength or Agility, you might have specific skills or proficiencies that directly tie to game actions. For example, rather than a generic “Strength” stat governing all physical feats, you could have a “Swordsmanship” skill for melee combat, a “Marksmanship” skill for ranged weapons, a “Athletics” or “Climbing” skill for movement, etc. This way, a character’s unique training and talents are explicitly represented.

In practice, a hybrid approach often works well: define a few core attributes to represent innate capabilities (body, reflexes, perception, etc.), and have a list of skills that represent learned abilities or specific proficiencies. Core attributes can act as a base or modifier for related skills (as in many RPGs where, say, Agility might contribute to Stealth skill), but the skills themselves differentiate what the character is actually good at. This avoids oversimplifying everything to 3–4 stats, while still preventing an overwhelming list of hundreds of micro-skills. The key is to include whatever stats/skills correspond to actions that frequently come up in your setting. For instance, if lock-picking, sword-fighting, and persuasion are common actions, ensure you have a stat or skill for each.

The goal is to capture the uniqueness of characters in the areas that matter for your game. A physically strong brawler and a nimble thief should feel different to the player/LLM, and your stat design should reflect that.

## Environmental Modifiers and Action Difficulty

Realistic, immersive gameplay means that context matters. The same action can be easier or harder depending on conditions and specific intent. Your system should incorporate environmental factors and situational modifiers that affect the chance of success. For example, fighting in darkness or on slippery ground should make it harder to land a hit. You could model this as a flat penalty to the attacker’s skill (e.g. “-20% chance in darkness”), or by applying a disadvantage mechanic (more on that below). Either way, these factors ensure that players must consider the environment, not just their character’s stats, when deciding on an action.

Likewise, the difficulty of the action itself should be modeled. You already gave a great example: a generic swing of a sword versus a precise targeted strike (like “slash Emily’s head with longsword”). The targeted head strike is a more difficult maneuver – a smaller target, higher risk – so it should carry a lower chance of success compared to a standard slash. In design terms, you might assign each action a difficulty modifier. A mundane attack might have no penalty, while a called shot to the head imposes, say, a -30% penalty to hit. The UI could show this by listing the adjusted chance (e.g. “slash Emily’s head (30% chance)” vs “slash Emily (60% chance)” if the headshot is much harder).

This concept is similar to how many RPGs handle “called shots” or tricky maneuvers. In D&D 5e, for instance, there isn’t a called shot by default, but the DM could rule a higher difficulty class or disadvantage on the attack. Other games explicitly let you trade accuracy for effect. Burning Wheel (a tabletop RPG) provides a narrative example: if your intent makes a task harder (picking a lock quietly or quickly versus just picking it normally), the GM increases the obstacle difficulty. The same idea applies here – more ambitious or precise intentions reduce the base success chance.

Your system can handle this in a data-driven way: Each action (or each contextual variant of an action) could carry tags or properties for environmental modifiers and inherent difficulty. For example, an action might have "base_chance": X plus adjustments like "precision_penalty": 20% or "darkness_penalty": 15% that the engine applies if relevant. Since your architecture already checks “gate” components (like is_vampire enabling vampire actions), you can similarly include checks for environment state (e.g. a dark_area component on the location could auto-impose the darkness penalty on relevant actions).

The goal is to give a realistic and transparent impact of conditions. The player (or AI) should be told something like “[In darkness] Slash Emily with longsword – 40% chance” so they understand the risk. This clarity lets them make informed decisions – maybe they’ll decide to lure Emily into a lit area first, or choose a different strategy if the odds are too low. Designers note that the most interesting decisions happen when success odds are neither trivial nor hopeless; typically somewhere in the 30%–90% range is the “fun” zone. Environmental and difficulty modifiers help push attempts into that range. For instance, a player might normally have an 80% chance to hit an enemy, but darkness drops it to 50% – now it’s a risky proposition, and therefore a more engaging choice.

## Balancing Skill and Chance: Probability Mechanics

We want to introduce a chance of failure so that skills and circumstances matter, but avoid the outcome feeling like a coin flip chaos. In other words, competence should matter more than luck, yet luck should still play a role.

A bell curve (e.g. rolling 3d6 and summing) produces more moderate outcomes most of the time, with extremes being rarer. The practical effect: with a bell curve, characters with high skill (i.e. needing only an average roll to succeed) will succeed very consistently, and only rarely flub with an extreme low roll. High or low scores become more decisive because luck is less swingy.

For your system, since you plan to display an explicit percentage chance (e.g. 55% chance), you don’t necessarily have to literally roll multiple dice – you can simulate the effect with math. One simple and effective approach is to use a formula based on the attacker’s skill vs. defender’s skill (or difficulty) to derive success probability. For example, many games use a ratio or logistic formula:

Ratio formula: Chance to hit = AttackerSkill / (AttackerSkill + DefenderSkill).

If my sword skill is 8 and Emily’s defense skill is 8, that’s 8/(8+8) = 0.50 = 50% chance. If I’m much better – say 12 vs her 8 – then chance = 12/(12+8) = 0.60 = 60%. If I’m much worse (5 vs 10) then 5/(15) ≈ 33%. This formula has some nice properties: it naturally caps out near 100% as the attacker’s skill grows huge relative to the opponent, and bottoms out near 0% if the attacker is vastly inferior, but it never absolutely reaches 0 or 100 until one side is effectively infinitely better. It’s also symmetrical (if A has X% to beat B, then B has 100–X% to beat A in that contest).

Recommendation: Given your desire for a bell-curve-like reliability, one elegant solution is to treat the outcome as a contest of skills with a curved probability distribution. You could implement this by conceptually rolling dice for both attacker and defender (or attacker vs a difficulty) where multiple dice are involved. For example, roll 3d6 + AttackSkill vs 3d6 + DefenseSkill – but instead of actually rolling, calculate the win probability. This calculation can be done behind the scenes or approximated.

The takeaway: favor the skilled side heavily, so that an expert versus a novice isn’t a toss-up. Using multiple dice or a logistic formula will naturally do this. A logistic curve could be tuned so that at a certain skill difference (say +10) the success probability is, for example, ~90%, but not outright 100%.

## Showing Chances and “Dice Feel”

Since you plan to display the probability to the user (e.g. in the action text), the exact method under the hood can be somewhat abstracted – players will reason in terms of the percentage. It might still be worthwhile to have the system internally simulate a die roll for narration or consistency. For example, you might generate a random number 1–100 and compare to the success chance. If you want a “bell curve” feel, you could generate three 1–100 rolls and take the average, or two 1–100 rolls and average them, to bias outcomes toward the middle. But this is likely overkill – a single random check using the calculated probability is sufficient, because the calculation itself can embody the distribution effects.

## Advantage/Disadvantage and Modifiers

It may be simplest to stick to additive modifiers to the skill or directly to the chance. For instance, darkness could effectively reduce the attacker’s skill or increase the defender’s skill in the formula. A “hard” called shot might impose, say, a -30 skill penalty on the attacker for that attack. These penalties could even push the success chance below 5% for extremely hard attempts – at which point you might simply display something like “(5% very unlikely)” if you impose a floor, or let it go to 1% if you want that hail-mary chance. Conversely, positive circumstances (surprise attack, high ground, etc.) could grant bonuses.

To keep things user-friendly, consider communicating the factors in a concise way. For example: “slash Emily (55% chance — in dark)” might hint that darkness is why it’s not higher. If the UI can’t show text, you might incorporate icons or color-coding for advantage/disadvantage.

The bottom line: Choose a probability calculation method that emphasizes skill differences, use it to compute a percentage, and be transparent about that percentage to the user. A method that produces a bell-curve-like probability (such as opposed checks with success levels, or a logistic formula) will ensure that skilled characters succeed far more often than unskilled ones, without making outcomes completely deterministic. This aligns with your goal that a competent character “reliably succeeds under the same conditions” most of the time, yet always with that slim chance of a fluke failure (and vice versa for a less skilled character).

## Degrees of Success and Failure

Beyond a binary success/failure, it’s often fun and dramatic to have graded outcomes. You mentioned ideas like a “hard failure” causing the actor’s weapon to break or be dropped, which is a great example of a critical failure. Similarly, you might allow extraordinary successes (critical hits) to have special effects (extra damage, or achieving more than intended).

Many systems implement this by looking at the margin or natural roll. For instance, in a percentile system, a roll way under the needed number could be a critical success, and a roll that’s a very high number (close to 100) could be a fumble. Chaosium BRP explicitly defines: a roll ≤ 1/5 of your skill is a Special Success, and ≤ 1/20 of your skill is a Critical Success. On the flip side, rolling 99–00 (i.e. 99 or 100 on d100) is usually a Fumble, which means “the worst possible result” – something bad happens beyond just a miss.

Translating this to your system, you could implement tiers like:

Critical Success: e.g. succeed by a wide margin or by an extremely lucky roll. Outcome: not only do you succeed, but with extra effect. In combat, this could mean double damage or a decisive hit (perhaps a chance to decapitate if that’s in scope!). In non-combat, it could mean succeeding and gaining some bonus (you picked the lock silently and in record time).

Normal Success: The action succeeds as expected.

Normal Failure: The action fails, but nothing dramatically bad happens – you just don’t achieve your goal.

Critical Failure (Fumble): fail and suffer a downside. For an attack, this might mean you slip and drop your weapon, or the weapon breaks – a common trope is weapon breaking on a fumbled attack.

Crucially, these ranges can scale with skill if you want skilled characters to also have higher chance of critical success. (In BRP, someone with 80% skill has a 4% crit chance (1/20 of 80) whereas someone with 20% skill has only a 1% crit chance. High skill also reduces your fumble chances since you’re less likely to fail in the first place.) Or you can make criticals a flat percentage (like “natural 20” in D&D is ~5% for everyone). The former approach further rewards skill – experts not only succeed more, they critically succeed more and fumble less. This might fit your goal of highlighting character uniqueness and ability.

Implementing degrees in code could be as simple as generating a second random roll or checking the first roll’s value relative to thresholds. For instance, if using a 100-scale roll:

If roll ≤ 5 (out of 100) maybe call it a crit success (or ≤ skill/5 if scaling by skill).

If roll ≥ 96, call it a fumble (assuming 100 is mapped to 0-99 or 1-100, etc., you decide exact range).

You’ll also want to define the narrative and mechanical effects of these outcomes. Perhaps:

Critical success on an attack: the target is severely wounded or an immediate follow-up is allowed.

Critical failure on an attack: as said, weapon breaks or you hit an ally, etc., depending on how punishing you want it.

Critical success on a non-combat action: you not only succeed but get additional benefits (e.g. crafting yields a higher-quality item, persuading an NPC yields more influence than expected).

Critical failure on non-combat: a disastrous outcome (the lockpick snaps inside the lock, making it even harder to open now).

## Summary of the recommended system:

### Skill Model: Use a set of attributes/skills that make sense for your game’s actions (don’t be afraid to include the classics like Strength or Dexterity under whatever names, but ensure you have specific skills for combat, magic, stealth, etc., as needed). Allow these to improve over time with training or experience.

### Success Chance Calculation

When an action is attempted, calculate success probability based on the actor’s relevant skill vs. the target’s opposing skill or a difficulty rating. A formula that emphasizes the difference (such as a logistic curve or opposed roll calculation) will ensure skilled characters have a high edge. For simplicity, you might implement this as:

EffectiveSkill = ActorSkill + modifiers (environment, difficulty of action)

EffectiveDefense = TargetSkill/Defense + modifiers,

then Chance = EffectiveSkill / (EffectiveSkill + EffectiveDefense) (or another chosen formula giving similar outcomes).

This yields a percentage to display.

### Incorporate Modifiers

Apply environmental and situational modifiers before computing the chance. Darkness might reduce EffectiveSkill, a called shot might increase EffectiveDefense or otherwise penalize the attempt. Clearly reflect these in the outcome chances.

### Random Resolution

Execute the action by rolling a random outcome against the computed chance. To avoid overly swingy results, you can simulate a bell curve by the way you compute chance (the heavy math done upfront) rather than how you generate the random number. Thus one random check (0–100) against the chance is fine for determining success/failure.

### Degrees of Outcome

Determine if the result is a critical/fumble. You can do this by checking how much the random roll was under or over the threshold, or by separate thresholds. Then handle the effects accordingly (extra damage, narrative flourish on success; mishaps on failure). As an example from BRP-derived systems: a fumble “usually means that the opposite of the desired result has been achieved… or even puts the character at a disadvantage” – in combat that could mean you hurt yourself or lose your weapon.

By implementing all the above, you’ll achieve a system where:

The player can see their chances and make an informed risk-vs-reward decision.

Skill truly matters: a highly skilled character will see much higher percentages in their favor, especially against less skilled opponents, reflecting their expertise. They will still occasionally fail – those moments will be surprising (hopefully in a fun way) because they’re rare. Likewise, a low-skill character will usually fail but every now and then get a lucky break.

Environmental and situational factors keep the game dynamic: even a master swordsman might think twice about attacking in pitch darkness with a slippery floor, because their displayed chance will drop, encouraging them to change the situation.

Critical successes and failures add spice to the narrative. They create memorable moments (the sword that spectacularly shatters on a bad swing, or the miraculous one-hit takedown of an enemy on a crit) that enhance the emergent storytelling – something an immersive sim thrives on.

## First non-deterministic action:

- We would like to add a can_cut.component.json , as a gate-like component to indicate that a weapon can cut. We likely will need to put these in a new mod (maybe 'damage-types'), because some regular items could also cut (imagine thrown kitchen knives).

- Create in the 'weapons' mod ( data/mods/weapons/ ) a new action with a template like 'swing {weapon} at {target} (chance X%)', that requires the {weapon} to have the can_cut.component.json . There's currently no code for calculating those percentage changes, nor for adding them to the templates.

- In the corresponding rule for this action, if the calculated resolution is a success, then a perceptible event message and successful action message should be like '{actor} swings their {weapon} at {target}, cutting their flesh.' If the calculated resolution is a failure, thena perceptible event message and failure action message should be like '{actor} swings their {weapon} at {target}, but the swing fails to connect.'

Currently we won't actually damage body parts; a whole new health and damage system is future work.

- In order to determine the calculation of the outcome, we would need a skill, likely in a new 'skills' mod, that would be like melee_skill.component.json . We would also need a defense_skill.component.json which the target actor would have. The absence of either would mean a value of zero (e. g., if the attacker does have a melee_skill.component.json but the target doesn't have a defense_skill.component.json , then their defense value is considered to be 0).
