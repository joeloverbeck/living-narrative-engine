# Specifications for the GOAP system

We have had to remove our first naïve approach to a GOAP system. The flaws we detected were that we conflated execution-time actions (like the actions in data/mods/affection/actions/ ) and planning-time actions, trying to rely on automatic planningEffects generation from existing execution-time actions. That also led to the realization that the way we correctly filter out actions that aren't logical at execution time (for example, not allowing someone to grab a book from a bookcase if the actor is sitting down, meaning that the actor would need to use a standing up action before using a grab book action) prevented any actual planning, as the planner didn't see the 'grab book from bookcase' action because the actor was currently sitting down.

UI / LLM want concrete actions:

eat apple, drink water, pick up medikit.

GOAP is much happier planning with abstract intentions:

consume_nourishing_item, restore_health, find_shelter.

The planner must know:

When a task is applicable (preconditions in state space).

What a task does to the world (effects in state space).

Otherwise it can’t reason correctly about whether a plan actually achieves a goal.

## Planning-State View Contract

Every planner/heuristic/operator now consumes the same dual-format snapshot via `createPlanningStateView(state)` in `src/goap/planner/planningStateView.js`. The helper:

- Exposes the raw flat hash (`'actor_id:core:needs'`) alongside nested `actor.components.core:needs` and flattened `actor.components.core_needs` aliases so JSON Logic rules can reference either `actor.*` or `state.actor.*` paths.
- Provides `hasComponent()` and `assertPath()` helpers that emit `goap:state_miss` events whenever a component/path cannot be resolved. Setting `GOAP_STATE_ASSERT=1` during tests turns those warnings into hard failures.
- Supplies `registerPlanningStateSnapshot(state)` (see `tests/integration/goap/testFixtures/goapTestSetup.js`) so integration suites can sync `SimpleEntityManager` and the symbolic planning state without bespoke helpers.

When you write new goals or tasks, prefer the `actor.components.core_stats.health` style paths; `PlanningStateView` automatically maps those to the colonized component IDs stored inside the planner. Never access `context.state` manually—ask the helper instead so diagnostics stay accurate.

### Stale snapshot diagnostics

- Every `PlanningStateView.hasComponent()` miss triggers `recordPlanningStateMiss`, which dispatches `GOAP_EVENTS.STATE_MISS` with `{ actorId, entityId, componentId, origin, reason }`. Treat that emission as authoritative evidence the symbolic snapshot is stale.
- Turning on `GOAP_STATE_ASSERT=1` (unit or integration harnesses) escalates the miss into a thrown error so CI catches divergence before runtime fallbacks hide it.
- `HasComponentOperator` must never fall back to the runtime `EntityManager` whenever `context.state` exists; refresh or rebuild the planning snapshot instead of bypassing the diagnostics pipeline.

## Planner Interface Contract

`GoapController` validates the planner against a shared contract defined in `src/goap/planner/goapPlannerContractDefinition.js`. Every runtime implementation and test double must expose the following API:

| Method | Signature | Notes |
| --- | --- | --- |
| `plan` | `plan(actorId, goal, initialState, options)` | Returns `{ tasks: [...] }` when a plan exists, or `null` after recording a failure snapshot. The GOAP debugger surfaces this metadata in the **Dependency Contracts** section. |
| `getLastFailure` | `getLastFailure()` | Returns `{ code, reason, details? }` describing the last `plan()` attempt, or `null` if none. Always returns a shallow copy so callers can mutate without affecting cached diagnostics. |

Tests should import `createGoapPlannerMock` + `expectGoapPlannerMock` from `tests/common/mocks/` to stay aligned with this table.

### Debug Diagnostics Contract

`GoapController` exposes `getDiagnosticsContractVersion()` so `GOAPDebugger` can enforce the shared diagnostics contract described in `docs/goap/debugging-tools.md#diagnostics-contract`. Any time you add or remove diagnostics sections (task library, planning state, future additions), bump the contract version and update the debugger/GoapController tests to acknowledge the change. This keeps instrumentation in lockstep with the runtime planner API and prevents silent drift.

## Clean split: planning-tasks vs primitive-actions

### A. Primitive / executable actions (what we have now)

Examples:

world:move_to_location

items:pick_up_item

items:consume_item

music:play_note, music:swell_music_on_instrument, etc.

These:

Have your current targets.scope = concrete bindings like items:examinable_items_here.

Are what the engine actually runs.

Are what humans/LLMs see as verbs: "pick up apple", "eat bread".

### B. Planning tasks (what we're proposing)

Examples:

task:consume_nourishing_item

task:heal_self

task:secure_shelter

task:arm_self

task:find_instrument_and_play

These:

Are not directly executable. They are abstract steps GOAP reasons about.

Have:

structural_gates (is this task even meaningful for this actor/scenario?),

planning preconditions (in terms of facts, not specific entities),

planning effects (again in terms of facts: hunger reduced, health restored, etc.).

At execution time they are refined into primitive actions.

## Refinement to executable actions

When you actually reach a task:consume_nourishing_item step in the plan, you run a refinement / concretization step that turns it into primitive actions, for example:

If actor already has a nourishing item in inventory:

items:consume_item(target=item_in_inventory)

Else:

world:move_to_location(location_of_food)

items:pick_up_item(target=item)

items:consume_item(target=item)

This refinement logic can be:

A mini-HTN-style method defined alongside the task, or

A bit of hand-authored code that knows how to realize each planning task.

Note: I'd prefer to keep this refinement / concretization fully data-driven. No Javascript code should know specific steps of how to refine / concretize specific tasks, as they're included in mods.

If refinement fails ("no reachable nourishing_item anymore"), you invalidate the plan and replan.

GOAP works on intent-level steps: consume_nourishing_item, secure_shelter, arm_self.

Refinement handles the micro-detail.

You basically end up with:

GOAP at the "task" level,
primitive actions as execution layer,
a simple decomposition bridge between them.

## Tasks

They should be loaded via mods, in a 'tasks/' folder (alongside existing folders like 'actions/'). This will require a new loader as the ones in src/loaders/ .

A task would be like:

task:consume_nourishing_item(item)

Where 'item' is a bound target chosen from a planning scope like items:known_nourishing_items_anywhere

The planner binds item = medikit_23 or item = bread_7 during search.

The planning effect can use that concrete entity:

"planning_effects": [
  {
    "op": "decrease",
    "path": "actor.state.hunger",
    "amount": {
      "var": "item.components.food:nutrition_value"
    }
  }
]

structural_gates: to decide if this task belongs in the actor's task library at all (musician, biology:can_eat, knows instruments exist, etc.). Structural gates are a coarse "is this action even relevant in principle?" It's different from the prerequisites, forbidden_components and required_components of executable-time actions, which only filter by what is possible right then and there. The structural level needs knowledge-based existence queries that say: "Is it even possible to resolve a valid target for this action at some point, given what this actor knows?"

planning_preconditions / planning_effects: for GOAP state search.

The tasks should be parametric; meaning that they retain information of the scope targets. For example, a consume_nourishing_item task would retain the identifier of the apple entity the scope resolved (potentially many target entities).

Planning scope: a regular scopeDsl file, like the ones used extensively in execution-time actions, but whose scope is the entire game world. I think the scopeDsl is currently limited for this, as it assumes all targets will be in the same location ( docs/scopeDsl/ ). A planning_scope should be used to bind abstract parameters to known entities, but it should be knowledge-limited.

## Preventing omniscience

Planning with scopes that encompass the entire game world would cause omniscience unless gated. For example, if a scope is items:nourishing_items_in_map, the scope would return nourishing items that the actor doesn't even know about. The solution for this is to implement a new 'core:known_to' component in core, as we as a 'core:visible' component in core. The idea is the following: when a turn starts with an actor in a location, we ensure that all visible entities other than the acting actor include the acting actor's id in their 'core:known_to' component array (and if the 'core:known_to' component doesn't exist on the entity, it should be added). The modders should be careful to add a 'core:visible' equals false to objects that start for example in closed containers. All planning scopes then should be gated by the entities that the acting actor knows, as in items:known_nourishing_items . The acting actor may remember an apple it saw somewhere, but not a pear it didn't see in another location.


### Two levels of target selection: planning vs execution

This is the key separation:

Planning-time target selection

"Which known entities in the world could this action ever target?"

Can (and often must) include entities outside the current location.

Must be knowledge-limited (no omniscience).

Execution-time target selection

"Which entities here and now are actually usable for this action?"

This is what we already have with items:examinable_items gated to same location.

## A translation step from tasks to executable actions

Let’s make that concrete; the pipeline is:

### Goal selection

e.g.: goal: reduce_hunger

### GOAP planning over planning_tasks

Finds a plan like:
[ task:acquire_nourishing_item, task:consume_nourishing_item ]

Or just [ task:consume_nourishing_item ] if it encodes "acquire if needed" in its preconditions/effects.

### Execution loop

Take the next planning-task in the plan: task:consume_nourishing_item.

Run its refinement logic based on current world state.

That refinement returns a sequence of primitive actions:

e.g. [ move_to(room_12), pick_up(item_7), consume(item_7) ]

Push that primitive sequence into the actor's action queue and start executing each step (with your normal executable gates).

### If refinement fails

Maybe the food was eaten by someone else.

You invalidate the remaining plan and ask GOAP to replan from current state.

That's the "translation" we're talking about. It's not magic; it's just a method table: planning-task → (world-aware) decomposition into primitives.

## GOAP planner's library for each actor

Each turn:

Evaluate structural_gates for all actions.

Build a per-actor task library.

Run GOAP using that library.

## Remaining pitfalls you still need to watch

### Plan invalidation

Even with filtered relevant actions:

Plans will become invalid mid-execution when:

another actor changes the world

an LLM/human does something unexpected

a required entity disappears / moves

So you should:

Re-check preconditions on each step of the plan before executing the task.

If some precondition fails → either:

replan from current state for the same goal, or

abort the plan and choose a new goal.

## planning_effects

To simulate state changes during planning, we should be able to rely on existing operation handlers from src/logic/operationHandlers/, which is what the rules for execution-time actions use. The effects would add/remove/modify components, but we also need to use query-like operation handlers and operate on the results of those queries.

## Goals

We currently have a data/schemas/goal.schema.json , which is a holdout from the previous implementation of the GOAP system that we removed. You'll need to figure out if this schema will need to change for the new GOAP system.

## Implementation of new GOAP system

Currently, the player_type 'goap' has an action decider that is a placeholder for when we finally implement this system properly, and that placeholder should connect properly with the rest of the app's system that executes actions.

## What makes something “GOAP” vs “HTN”?

### Where the design sits

The design has three clearly separated layers:

#### Primitive / executable actions (what you already have)

world:move_to_location

items:pick_up_item

items:consume_item

etc.

These have execution-time scopes and gates.

#### Planning tasks (new)

task:consume_nourishing_item(item)

task:heal_self

task:secure_shelter

etc.

Each has:

structural_gates

planning_preconditions

planning_effects

planning_scope → binds params like item.

##### Refinement / concretization

When you reach task:consume_nourishing_item(item) in the plan, you:

Check world state.

Decompose into primitives, e.g.:

[ move_to(room_12), pick_up(item_7), consume(item_7) ].

This refinement is data-driven, in mods, not in JavaScript.

### The key detail

Your GOAP planner will run only on planning-tasks:

The search graph is:

States: symbolic world facts (including knowledge-limited facts).

Operators: planning-tasks with preconditions/effects.

Result of GOAP:

A sequence of tasks:

[ task:acquire_nourishing_item(item_7), task:consume_nourishing_item(item_7) ]

or just [ task:consume_nourishing_item(item_7) ] if it bundles acquisition.

The decomposition into primitives happens after the GOAP search, as a post-process when executing each task.

That is not an HTN planner. It’s:

GOAP planning over abstract tasks

HTN-style methods used as an execution recipe.

The hierarchy is real, but the planner never reasons over the decomposition structure itself. It reasons only over state changes of abstract tasks.

So:

In HTN, reduce_hunger → [go_to_kitchen, pick_food, eat_food] is part of the planning search.

In this design, task:consume_nourishing_item(item) → [move_to, pick_up, consume] is a post-planning refinement step; the planner never branches over “which decomposition” to use for that task.

This is GOAP with macro operators, where each macro knows how to expand into a chain of primitives.

### Plan invalidation

The design:

GOAP produces a task-level plan.

At execution:

For each task:

Check preconditions again.

Try to refine to primitives.

If refinement fails or preconditions no longer hold → replan from current state.

This is “recalculate state-space plan when reality changes”, which fits GOAP very nicely.

### How I'd label what we've specced

GOAP with parametric tasks + data-driven HTN-style refinement , or A GOAP planner on abstract tasks, with a mini-HTN bridge to primitive actions.

Key reasons:

The planner:

Works on abstract tasks with preconditions/effects.

Does state-space search to reach goals.

Hierarchy is not part of the search:

Decomposition is not where branching happens.

Methods/refinement are just “how to turn this chosen operator into concrete engine actions.”

So if someone asks “are you doing GOAP or HTN now?”, the honest answer is:

At planning level: GOAP.

At execution level: HTN-flavored decomposition of high-level intentions into primitive actions.

And that's actually ideal for the engine:

GOAP gives you:

clean goal-based reasoning,

explicit planning_preconditions/planning_effects,

re-planning semantics that are easy to reason about.

The HTN-ish layer gives you:

fully data-driven, mod-defined “how to actually do it”,

no engine code hard-wiring “consume_nourishing_item” flows.

## What we actually want (reading between the lines)

Emergent behavior: unplanned combinations of actions that fall out of facts/effects.

Clean separation:

Planning-only “intent” tasks.

Concrete, here-and-now execution actions with tight gates.

Data-driven, mod-friendly:

Mods define tasks, scopes, and decompositions.

No JS code hard-wiring “how to eat food.”

Good with interruption/replanning:

Other actors / LLM / player can blow up the plan at any time.

Those are textbook GOAP strengths.

HTN gives you control and legibility of “what sequence this NPC runs,” but it does not naturally give you the kind of open-ended emergent recombination that GOAP is good at, unless you start building extra machinery.

Core:

States = symbolic facts about world/knowledge (hunger, injuries, has_weapon, world_has_power, knows_about_shelter_12, etc.).

Operators = planning-tasks with:

structural_gates

planning_preconditions

planning_effects

param binding via planning scopes.

Planner:

Searches state space, not method trees.

Sequence might be:

[task:find_shelter, task:arm_self, task:secure_shelter, task:reduce_hunger]

That ordering emerges from costs + preconditions/effects.

Refinement:

When you reach task:secure_shelter(shelter_12) you expand it into primitives:

[ move_to(shelter_12), close_door(door_3), lock_door(door_3) ]

That lives in data (mods), not hard-coded.

Pros:

Emergence is real:

New tasks with new effects automatically become options whenever their preconditions and costs make sense.

If a mod adds “turn on generator” → world_has_power, any existing tasks that require world_has_power will start using it without changing their HTN trees.

Nice separation:

Planning time: facts, knowledge, “could I eventually target this?”

Execution time: “can I do this here and now, in this posture, with these objects?”

Replanning is natural:

Something changes → re-run GOAP from current state.

No need to figure out how to salvage a partially decomposed task tree.

Cons / costs:

You must take explosion seriously:

Parametrized tasks like consume_nourishing_item(item) with large candidate sets.

Need aggressive scoping, knowledge limits, heuristics.

It’s harder to predict ahead of time exactly what sequences an NPC can produce. You’ll need good debugging tools (plan inspector, state diff viewer).

But those are solvable, and you already started solving them with structural_gates, knowledge-limited scopes, and planning vs execution target selection.

## Practical recommendations for the engine

Commit to GOAP at the planning level.

"Planning-task" = classic STRIPS-style operator.

Clear preconditions/effects, param binding from planning scopes, knowledge-limited.

Implement a data-driven refinement spec, but keep it execution-centric:

For each planning-task, define one or a handful of "recipes":

sequences of primitive actions,

maybe with simple branches ("if item not in inventory, prepend acquire sequence"),

all mod-defined.

The planner doesn’t see these; they’re opaque to GOAP.

Design the refinement format to be HTN-ready, in case future-you wants it:

Let refinement steps reference:

primitive actions, and

other planning-tasks as sub-steps.

For now, you only ever call it "top-down" from a chosen task with no branching.

Later, you can start interpreting that as an HTN method network if you want.

Invest in GOAP tooling:

A way to inspect:

task libraries per actor (after structural_gates),

the chosen plan and why (preconditions & costs),

simulated state changes under planning_effects.

Without this, both GOAP and HTN will feel opaque and "AI does weird shit".
