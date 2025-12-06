# Requirements for a hunger system

We're progressing in our implementation of the GOAP (Goal-Oriented Action Planning) system. We're beginning to use real files for integration tests, and I realized that although the most logical basic integration test for GOAP involved a hungry actor generating a plan to get a nourishing item entity and consuming it, we haven't implemented an actual hunger system yet. This brainstorming document proposes the necessary improvements.

Given the high granularity of the existing mods (separating 'hand-holding' from 'caressing', for instance), we should not try to jam a complex hunger system entirely into 'Anatomy' or 'Exercise'. Those mods describe structure and action, whereas hunger is a process.

First of all, we want to tie hunger to actually having an organ that can digest. That means revisiting the anatomy recipes at data/mods/anatomy/recipes/ , the related blueprints, etc. so that a new body part entity (along the lines of those in data/mods/anatomy/entities/definitions/ ) that is a 'stomach' or something similar for non-human creatures that should be able to digest. Given that different creatures could have things that aren't a 'stomach' body part (meaning that we could have different types of organs performing the same function), we should think in terms of affordances: body part entities that have a component like allows_digestion.component.json. A body part that allows digestion (this should likely be in the component itself) have properties like 'stomach_value' and 'calorie_store'. Separately, we would have some code that calculates the conversion of food into energy over time, and a burn rate would calculate resting energy expenditure.

We would need a new mod named 'metabolism'. It would its own mod structure inside the data/mods/ structure. The 'metabolism' mod should be dependent on the 'anatomy' mod.

We likely would need a new operation handler (as those in src/logic/operationHandlers/ ) that calculates burn rate. This operation handler would optionally be used in actions that would burn calories at higher rate than normal (e.g. the rules of the actions in the mods data/mods/movement/ , data/mods/ballet/ , data/mods/gymnastics/ , the sex mods, etc.). For example, walking would burn X calories, or ballet would burn X \* 3 calories. For future work, having low energy as reported by the metabolism mod could prevent some exercise actions from being available.

## The Digestion Buffer system

In most games, eating an apple instantly heals you or refills the hunger bar. In reality, you have to digest food to get energy.

### The Mechanic:

You have two values: Stomach Content and Energy Reserve.

When you eat, food goes into Stomach Content. This has a "Fullness" cap.

Over time, the Stomach slowly converts into Energy Reserve (the actual bar that keeps you alive).

### The Immersive Sim Twist:

Metabolism: If you are sprinting or fighting, the conversion rate speeds up, but so does the burn rate.
Overeating: You cannot just spam 50 wheels of cheese to heal. If your Stomach Content hits 100%, you cannot eat more (or you vomit/get a "Sluggish" debuff).

### Why it’s better

It forces the player to plan meals before an encounter, rather than using food as instant potions during combat.

## Volume vs. Density (Satiety vs. Calories)

### The Mechanic:

Every food item has two stats: Volume and Calories.
Volume: Reduces the "Hunger" status (stops stomach rumbling, removes distraction penalties).
Calories: Refills your "Stamina/Long-term Health" pool.

### The Gameplay Scenarios:

Scenario A: You eat a bag of raw spinach. Your Volume is full (you feel full), but your Calories are low. You won't starve, but you will be weak and have low stamina.
Scenario B: You eat a stick of butter or an energy bar. Your Volume is low (you still feel hungry/empty), but your Calories are high. You have energy, but your character complains of hunger pangs.

### Why it’s better

It makes the type of food matter. Survival food (roots, berries) fills the belly but doesn't power the engine. Luxury food (stew, meat) does both.

## The "Three-Tier" Threshold System

Instead of a number, use States of Being. In Immersive Sims, fuzzy logic often feels more realistic than spreadsheet math.

### The Mechanic:

Hidden behind the scenes is a 0-100 counter, but the player never sees it. They only see/feel the Thresholds:
Gluttonous (100%+): You overate. Stamina regenerates slower. You make more noise when moving (heavy breathing/footsteps).
Satiated (75-100%): Ideally fed. Bonus to health regeneration and focus.
Neutral (30-75%): Normal gameplay. No buffs or debuffs.
Hungry (10-30%): Stomach rumbles (audible noise enemies can hear). Slight screen shake when aiming.
Starving (0-10%): You lose health over time. Your carrying capacity drops significantly.

These thresholds could be used as gates for action availability (for example, preventing eating actions when already satiated.)

## How it could work in practice

The player has a Stomach (0/100).

They eat a steak (Volume: 40, Digestion Time: Slow).

The Stomach fills to 40.

Over the next 10 minutes, that 40 ticks down, filling an invisible "Calorie Store."

Hypotheticals for future synergies:

If the Calorie Store is high, they get the "Well Fed" buff (High stamina regen).

If the Stomach is empty for too long, they get the "Hungry" debuff (Stomach growls, alerting enemies).

This creates a system where food is a strategic resource rather than a chore, fitting perfectly into the Immersive Sim philosophy.

## Hooks for the turn system

We currently have a hook in the turn system (somewhere inside src/turns/ ) that every time a turn starts, the core:known_to components get updated with the visible entities. We could have data-driven hooks for stuff that should execute every time a turn starts, and therefore time passes. That would reduce the stomach content in a fixed amount and fill the calorie store.

## The "AI Overeating" Problem (GOAP Integration)

### The Issue:

Standard GOAP planners work on the principle of Current State -> Action -> Immediate Result.
If an AI is "Hungry" and eats an apple, but the apple goes into the Digestion Buffer and takes 10 turns to convert to energy, the AI will check its state on the very next turn, see it is still "Hungry" (low energy), and plan to eat another apple. The AI will loop until its stomach explodes.

### The Solution: "Predicted Satiety" State

Simulation Layer: You need a variable representing ProjectedEnergy = CurrentEnergy + TotalCaloriesInStomach.

Planner Logic: The GOAP precondition should not be has_energy, but is_satiated.

### The Fix: When the AI eats, the StomachContent goes up immediately. The AI planner must check: "Is my current energy low?" AND "Is my stomach empty?"

If Energy is Low + Stomach is Full = State: Digesting (Do not eat, maybe rest).
If Energy is Low + Stomach is Empty = State: Hungry (Find food).

This could be handled with a custom operator or operators for Json Logic (such as the ones in src/logic/operators/ ).

## Calculations

Burn Rate: BaseMetabolicRate _ ActivityMultiplier _ time_delta
Digestion: DigestionRate \* time_delta

## Abstracting "Food" and "Stomach"

Perhaps we should go even further, given that in the future we may want to have things like robots that also could need refueling, and could use the same abstract system:

### The Solution: Generic Fuel Providers & Converters

Instead of hardcoding "Stomach" and "Food," use abstract component definitions:

### The Container: Component: FuelConverter.

Properties: capacity, conversion_rate, accepted_fuel_tags (e.g., "organic", "blood", "electricity").

### The Item: Component: FuelSource.

Properties: potential_energy (Calories), bulk (Volume), fuel_tags.

### Robustness: This allows you to swap the FuelConverter component.

Human: Accepts "organic", medium capacity, slow conversion.
Vampire: Accepts "blood", low capacity, instant conversion (high conversion_rate).
Steam Engine: Accepts "coal", high capacity, burns fast.

This solves your "Anatomy" requirement: The "Stomach" entity is just the physical container for the FuelConverter component.

## Summary of Proposed Architecture Changes

### Entities: Stomach entity (in Anatomy) holds the FuelConverter component.

### Components:

FuelSource (on items): energy_density, bulk, type.
FuelConverter (on body part): buffer_storage, conversion_rate, efficiency.
MetabolicStore (on root actor): current_energy, max_energy.

### Systems:

TurnHook: calculates burn based on fixed delta time.
Individual rules for actions that produce exertion would use a new operation handler that passes an exertion multiplier. The operation handler calculates burn, and moves buffer to store.

AI:
GOAP Goal: Maintain Energy
Heuristic: Cost reduces based on MetabolicStore + FuelConverter.buffer (Predicted Energy).
