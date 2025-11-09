# GOAP Player Implementation Design

## Executive Summary

This document explores the implementation of Goal-Oriented Action Planning (GOAP) for AI agents in the Living Narrative Engine. GOAP provides a more strategic, goal-driven approach to AI decision-making compared to the current LLM-based system, enabling agents to plan sequences of actions to achieve specific world states.

**Current Status:** Placeholder implementation exists (`GoapDecisionProvider`) that selects the first available action.

**Primary Goal:** Implement full GOAP system with backward-chaining A* planner, effects-based action modeling, and goal-driven decision making.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [GOAP Fundamentals](#goap-fundamentals)
3. [Proposed Architecture](#proposed-architecture)
4. [Effects DSL Design](#effects-dsl-design)
5. [Implementation Phases](#implementation-phases)
6. [Pros and Cons Analysis](#pros-and-cons-analysis)
7. [Alternative Approaches](#alternative-approaches)
8. [Technical Challenges](#technical-challenges)
9. [Integration Points](#integration-points)
10. [Performance Considerations](#performance-considerations)
11. [Recommendations](#recommendations)

---

## Current State Analysis

### Existing Infrastructure

#### 1. Player Type System
```javascript
// Three player types supported: 'human', 'llm', 'goap'
// Located in: src/utils/actorTypeUtils.js
function determineSpecificPlayerType(actor) {
  // Checks core:player_type component
  // Returns: 'human', 'llm', or 'goap'
}
```

#### 2. Decision Provider Architecture
```javascript
// Current placeholder: src/turns/providers/goapDecisionProvider.js
class GoapDecisionProvider extends DelegatingDecisionProvider {
  // Currently just picks first action
  // Returns: { index: resolvedIndex }
}
```

#### 3. Goal Loading System
```javascript
// Goal loader exists: src/loaders/goalLoader.js
// Loads goal definitions from data/mods/*/goals/
// Schema: data/schemas/goal.schema.json
```

#### 4. Goal Schema Structure
```json
{
  "id": "modId:goalId",
  "priority": 100,
  "relevance": { /* JSON Logic condition */ },
  "goalState": { /* JSON Logic condition */ }
}
```

#### 5. Action Discovery System
The engine has a sophisticated action discovery system:
- **Scopes**: Target selection using ScopeDSL
- **Prerequisites**: JSON Logic conditions
- **Required/Forbidden Components**: State validation
- **~1000+ actions** across mods

#### 6. Operation Handlers
~60 operation handlers in `src/logic/operationHandlers/`:
- `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`
- `LOCK_MOVEMENT`, `UNLOCK_MOVEMENT`
- `ESTABLISH_SITTING_CLOSENESS`, `BREAK_CLOSENESS`
- `TRANSFER_ITEM`, `DROP_ITEM`, `PICK_UP_ITEM`
- `DISPATCH_EVENT`, `DISPATCH_PERCEPTIBLE_EVENT`
- And many more...

### What's Missing

1. **Action Effects Definitions**: Actions don't declare their state-changing effects
2. **GOAP Planner**: No backward-chaining planner implementation
3. **Effects DSL**: No DSL for expressing action effects
4. **Heuristic Functions**: No cost estimation for A* search
5. **Plan Execution**: No system to execute multi-step plans

---

## GOAP Fundamentals

### Core Concept

GOAP (Goal-Oriented Action Planning) is an AI planning technique where:

1. **Goals** define desired world states
2. **Actions** have **preconditions** and **effects**
3. A **planner** uses backward chaining (A* search) to find action sequences
4. The agent executes the first action in the plan, then replans

### Example Planning Flow

```
Current State:
  - actor.position = "bedroom"
  - actor.clothing.torso_lower = "pants"
  - target.clothing.torso_lower = "pants"
  - target.components = []

Goal State:
  - target.components.includes("fucking_vaginally")

Planner (backward chain from goal):
  1. Need: fucking_vaginally component on target
     Action: "insert_penis_into_vagina"
     Requires: penis_exposed, vagina_exposed, close_proximity, lying_down

  2. Need: vagina_exposed
     Action: "remove_others_clothing" (target's pants)
     Requires: close_proximity, hands_free

  3. Need: penis_exposed
     Action: "remove_clothing" (own pants)
     Requires: hands_free, standing

  4. Need: lying_down
     Action: "lie_down_on_bed"
     Requires: bed_available, not_sitting

Final Plan: [lie_down, remove_own_pants, remove_target_pants, insert_penis]
Execute: First action (lie_down)
```

### Why GOAP?

**Advantages over LLM:**
- Deterministic, predictable behavior
- Faster execution (no API calls)
- Clear goal-directed behavior
- Lower cost (no LLM tokens)
- Better for simple NPCs (guards, vendors, workers)

**Disadvantages:**
- Less creative/emergent behavior
- Requires manual effect definitions
- Limited to predefined goals
- Can't handle narrative nuance

---

## Proposed Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    GOAP Decision System                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐ │
│  │ Goal Manager │ ───> │ GOAP Planner │ ───> │ Executor │ │
│  └──────────────┘      └──────────────┘      └──────────┘ │
│         │                      │                           │
│         ▼                      ▼                           │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │ Goals Config │      │ Effects DSL  │                   │
│  │ (JSON Logic) │      │   Engine     │                   │
│  └──────────────┘      └──────────────┘                   │
│                                │                           │
│                                ▼                           │
│                        ┌──────────────┐                   │
│                        │  Operation   │                   │
│                        │  Handlers    │                   │
│                        └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
         │                      │                     │
         ▼                      ▼                     ▼
  Action Discovery      World State Query     Action Execution
```

### Data Flow

```
1. Turn Start (GOAP Agent)
   │
   ├─> Goal Manager: Select highest-priority relevant goal
   │   - Evaluate all goals' relevance conditions
   │   - Pick highest priority where relevance = true
   │
   ├─> GOAP Planner: Find action sequence to achieve goal
   │   - A* backward chaining from goalState
   │   - Filter actions with effects (state-changing only)
   │   - Build plan using action effects/preconditions
   │
   ├─> Plan Validation: Check if plan is still valid
   │   - Verify current state matches plan assumptions
   │   - Replan if world state changed
   │
   └─> Action Execution: Execute first action in plan
       - Standard action pipeline
       - Store remaining plan for next turn
```

---

## Effects DSL Design

### Design Principles

1. **Reuse Existing Infrastructure**: Build on operation handlers, not replace them
2. **Similar to ScopeDSL**: Familiar syntax for modders
3. **Declarative**: Describe what changes, not how
4. **Composable**: Support sequences, conditionals, loops
5. **Analyzable**: Planner can reason about effects statically

### Proposed Syntax

#### Option A: Imperative DSL (Closer to ScopeDSL)

```
// File: data/mods/positioning/effects/sit_down.effects

sit_down(actor, target) := {
  // Preconditions (for planner)
  requires {
    not hasComponent(actor, "positioning:sitting_on");
    not hasComponent(actor, "positioning:lying_down");
    hasComponent(target, "positioning:allows_sitting");
    hasAvailableSpot(target);
  }

  // Effects (for planner to reason backward)
  effects {
    addComponent(actor, "positioning:sitting_on", {
      furniture_id: target.id,
      spot_index: allocateSpot(target)
    });

    lockMovement(actor);

    // Conditional effect
    if adjacentActors(actor, target).length > 0 {
      establishSittingCloseness(actor, target);
    }
  }

  // Cost for A* heuristic (optional, defaults to 1.0)
  cost: 1.0;
}
```

#### Option B: Declarative JSON-Like DSL

```
// File: data/mods/positioning/effects/sit_down.effects

sit_down(actor, target) := {
  preconditions: [
    not component(actor, "positioning:sitting_on"),
    not component(actor, "positioning:lying_down"),
    component(target, "positioning:allows_sitting"),
    availableSpot(target)
  ],

  effects: [
    add component(actor, "positioning:sitting_on") {
      furniture_id: target.id,
      spot_index: allocateSpot(target)
    },

    lock movement(actor),

    when adjacentActors(actor, target).length > 0:
      establish closeness(actor, target, "sitting")
  ],

  cost: 1.0
}
```

#### Option C: Extended JSON (Most Conservative)

```json
// File: data/mods/positioning/actions/sit_down.action.json
{
  "id": "positioning:sit_down",
  "name": "Sit down",
  "targets": "positioning:available_furniture",

  // NEW: Effects definition
  "effects": {
    "preconditions": [
      { "not": [{ "hasComponent": ["actor", "positioning:sitting_on"] }] },
      { "not": [{ "hasComponent": ["actor", "positioning:lying_down"] }] },
      { "hasComponent": ["target", "positioning:allows_sitting"] },
      { "availableSpot": ["target"] }
    ],
    "effects": [
      {
        "operation": "ADD_COMPONENT",
        "params": {
          "entity": "actor",
          "component": "positioning:sitting_on",
          "data": {
            "furniture_id": { "ref": "target.id" },
            "spot_index": { "fn": "allocateSpot", "args": ["target"] }
          }
        }
      },
      {
        "operation": "LOCK_MOVEMENT",
        "params": { "entity": "actor" }
      },
      {
        "operation": "CONDITIONAL",
        "condition": { ">": [{ "fn": "adjacentActors.length", "args": ["actor", "target"] }, 0] },
        "then": [
          {
            "operation": "ESTABLISH_SITTING_CLOSENESS",
            "params": { "actor": "actor", "target": "target" }
          }
        ]
      }
    ],
    "cost": 1.0
  }
}
```

### DSL Features Breakdown

#### 1. Preconditions

Express what must be true before action can execute:

```
requires {
  not hasComponent(actor, "positioning:sitting_on");
  component(target, "positioning:allows_sitting").spots.some(spot => spot == null);
  actor.position.locationId == target.position.locationId;
}
```

Maps to existing: Action `prerequisites` + `required_components` + `forbidden_components`

#### 2. Effects

Describe state changes:

```
effects {
  // Component manipulation
  addComponent(actor, "positioning:sitting_on", { ... });
  removeComponent(actor, "positioning:standing");
  modifyComponent(actor, "core:stats", { energy: -10 });

  // Complex operations
  lockMovement(actor);
  establishCloseness(actor, target, "sitting");
  transferItem(actor, target, item);

  // Events
  dispatchEvent("ACTOR_SAT_DOWN", { actor, furniture: target });

  // Conditionals
  if condition {
    ...effects
  }

  // Loops
  forEach actor in actors_nearby {
    establishCloseness(self, actor, "proximity");
  }
}
```

Maps to: Operation handlers in `src/logic/operationHandlers/`

#### 3. Special Functions

Functions the planner can reason about:

```
// Query functions (read-only, for preconditions)
hasComponent(entity, componentId): boolean
getComponent(entity, componentId): object
entitiesWithComponent(componentId): entity[]
isAtLocation(entity, locationId): boolean
distance(entity1, entity2): number

// Allocation functions (stateful, for effects)
allocateSpot(furniture): number
claimResource(resource): boolean

// Utility functions
adjacentActors(actor, furniture): entity[]
availableSpot(furniture): boolean
```

#### 4. Cost Model

For A* heuristic:

```
// Static cost
cost: 1.0

// Dynamic cost (computed at planning time)
cost: {
  base: 1.0,

  // Additional costs based on world state
  factors: [
    distance(actor.position, target.position) * 0.1,
    hasComponent(actor, "core:injured") ? 2.0 : 0.0
  ]
}
```

---

## Implementation Phases

### Phase 1: Effects DSL Foundation (4-6 weeks)

**Goal:** Basic effects DSL with static analysis

#### Tasks:
1. **Design and finalize DSL syntax** (1 week)
   - Choose Option A, B, or C
   - Define complete grammar
   - Create syntax examples for 10 representative actions

2. **Parser implementation** (2 weeks)
   - Lexer/tokenizer
   - Parser with error recovery
   - AST generation
   - Syntax validation

3. **Effects schema and validation** (1 week)
   - JSON schema for effects files
   - Validation during mod loading
   - Error reporting

4. **Effects compiler** (1-2 weeks)
   - Compile effects DSL to intermediate representation
   - Map DSL operations to operation handlers
   - Type checking and validation
   - Generate execution plan

#### Deliverables:
- Effects DSL parser
- Effects file format and schema
- Compiler from DSL to operation handler calls
- 10 example actions with effects definitions

### Phase 2: GOAP Planner Core (6-8 weeks)

**Goal:** Working A* planner with backward chaining

#### Tasks:
1. **World State Representation** (1 week)
   - Define state representation format
   - Implement state comparison
   - State hashing for visited set

2. **Action Model** (1 week)
   - Action representation with preconditions/effects
   - Action applicability checking
   - Effect application (forward and backward)

3. **A* Planner** (2-3 weeks)
   - Priority queue implementation
   - A* search with backward chaining
   - Heuristic function (relaxed planning graph)
   - Plan reconstruction

4. **Goal System** (1 week)
   - Goal selection based on priority and relevance
   - Goal state evaluation
   - Goal caching and invalidation

5. **Integration with Action Discovery** (1-2 weeks)
   - Filter actions with effects
   - Build action graph
   - Cache action effects

6. **Testing and Optimization** (1-2 weeks)
   - Unit tests for planner
   - Performance profiling
   - Optimization (caching, pruning)

#### Deliverables:
- Working GOAP planner
- Goal selection system
- Action filtering for GOAP
- Test suite with 20+ planning scenarios

### Phase 3: Integration and Polish (3-4 weeks)

**Goal:** Full integration with turn system

#### Tasks:
1. **GoapDecisionProvider Implementation** (1 week)
   - Replace placeholder
   - Integrate with planner
   - Plan caching and revalidation

2. **Effects for Core Actions** (1-2 weeks)
   - Define effects for ~50 core actions:
     - Movement: go, teleport
     - Positioning: sit_down, stand_up, lie_down, get_up
     - Items: pick_up, drop, give, take
     - Clothing: remove_clothing, remove_others_clothing
     - Intimacy: kiss, hug, touch
     - Combat: attack, defend

3. **Debugging and Visualization** (1 week)
   - Plan visualization in dev console
   - Planner diagnostics
   - Goal/action logging

4. **Documentation** (1 week)
   - Effects DSL guide
   - GOAP system overview
   - Goal creation guide
   - Examples and patterns

#### Deliverables:
- Full GOAP system integrated
- 50+ actions with effects
- Developer documentation
- Example goals and NPCs

### Phase 4: Advanced Features (4-6 weeks, Optional)

**Goal:** Advanced GOAP capabilities

#### Tasks:
1. **Hierarchical Planning** (2 weeks)
   - Abstract actions
   - Multi-level planning
   - Plan refinement

2. **Dynamic Goals** (1 week)
   - Runtime goal generation
   - Context-dependent goals
   - Goal composition

3. **Plan Repair** (1 week)
   - Detect plan failures
   - Partial replanning
   - Plan adaptation

4. **Multi-Agent Coordination** (1-2 weeks)
   - Shared resources
   - Cooperative goals
   - Conflict resolution

5. **Emotion/Mood Integration** (1 week)
   - Goal priority modulation by mood
   - Action filtering by emotion
   - Emotional effects in planning

#### Deliverables:
- Advanced GOAP features
- Complex multi-agent scenarios
- Enhanced goal system

---

## Pros and Cons Analysis

### Proposed Approach Pros

#### 1. **Reuses Existing Infrastructure** ✅
- Operation handlers already implement all state changes
- No need to duplicate logic
- Consistent behavior between rules and effects
- Less code to maintain

#### 2. **Leverages Action Discovery** ✅
- ~1000+ actions already defined
- Scopes handle target selection
- Prerequisites already exist (can map to preconditions)
- Just need to add effects

#### 3. **Clean Separation** ✅
- Effects only needed for state-changing actions
- Non-state actions (speech, thought) automatically filtered
- Clear distinction between narrative and mechanical actions

#### 4. **Familiar Patterns** ✅
- Similar to ScopeDSL (modders already know it)
- JSON-based option available for conservative approach
- Consistent with engine's data-driven philosophy

#### 5. **Incremental Adoption** ✅
- Can add effects to actions gradually
- GOAP agents coexist with LLM agents
- Backward compatible (actions without effects ignored by GOAP)

#### 6. **Performance** ✅
- Planning happens locally (no API calls)
- Can be cached and reused
- Faster than LLM for simple NPCs

### Proposed Approach Cons

#### 1. **High Implementation Complexity** ❌
- DSL parser/compiler (2-3 months work)
- A* planner with backward chaining (1-2 months)
- Effects for actions (1-2 months)
- Testing and debugging (1 month)
- **Total: 5-8 months minimum**

#### 2. **Maintenance Burden** ❌
- New system to maintain
- DSL bugs affect entire system
- Effects must be kept in sync with rules
- Version compatibility issues

#### 3. **Limited Expressiveness vs. LLM** ❌
- Can't handle narrative nuance
- No creativity or emergence
- Limited to predefined goals
- Mechanical behavior vs. character-driven

#### 4. **Dual Definition Problem** ⚠️
- Actions defined in two places:
  - Rules (actual execution)
  - Effects (planner's model)
- Risk of desync
- Double the work for modders

#### 5. **Action Coverage Challenge** ⚠️
- Need effects for hundreds of actions
- Not all actions map cleanly to state changes
- Complex actions (e.g., "fondle breasts") hard to model
- What about emergent/narrative actions?

#### 6. **Goal Definition Complexity** ⚠️
- Goals need careful design
- Too specific = inflexible
- Too general = bad plans
- Balancing priorities is hard

### Risk Assessment

#### High Risks

1. **Scope Creep**: GOAP is complex, easy to over-engineer
2. **Desync**: Effects drift from actual rule behavior
3. **Adoption**: Modders may not want to define effects
4. **Performance**: A* can be slow with many actions

#### Medium Risks

1. **Incomplete Coverage**: Not all actions get effects
2. **Plan Quality**: Plans may be suboptimal or weird
3. **Integration**: Hard to integrate with existing systems
4. **Testing**: Hard to test all planning scenarios

#### Low Risks

1. **Technical Feasibility**: GOAP is proven technology
2. **Coexistence**: Can run alongside LLM agents
3. **Backward Compatibility**: Doesn't break existing system

---

## Alternative Approaches

### Alternative 1: Simplified Utility-Based AI (Recommended)

**Concept:** Instead of full GOAP, use utility-based selection.

#### How it works:
```javascript
// Each action has a utility function
{
  "id": "positioning:sit_down",
  "utility": {
    // Higher score = more likely to pick
    "base": 10,
    "factors": [
      { "condition": "actor.energy < 50", "score": 20 },
      { "condition": "furniture_available", "score": 10 },
      { "condition": "actor.standing", "score": 5 }
    ]
  }
}

// At decision time:
1. Filter available actions (prerequisites, components)
2. Calculate utility score for each
3. Pick highest scoring action (with randomness)
4. Execute immediately
```

#### Pros:
- **Much simpler** than GOAP (1-2 months vs 5-8 months)
- **No DSL needed** (just JSON utility scores)
- **No planning** (immediate action selection)
- **Easier to tune** (adjust scores)
- **Still goal-directed** (utility reflects goals)

#### Cons:
- **No multi-step planning**
- **Reactive, not proactive**
- **Can't solve complex puzzles**
- **May get stuck in local maxima**

#### When to use:
- Simple NPCs (guards, vendors, workers)
- Background characters
- Reactive AI
- Budget/time constrained

### Alternative 2: Behavior Trees

**Concept:** Hierarchical behavior selection.

```javascript
// Behavior tree for "Seduction NPC"
ROOT: Selector
├─ Sequence: "Seduce Target"
│  ├─ Condition: "Target nearby"
│  ├─ Condition: "Not already seducing"
│  └─ Selector: "Seduction Actions"
│     ├─ Action: "Touch suggestively"
│     ├─ Action: "Whisper in ear"
│     └─ Action: "Make eye contact"
│
├─ Sequence: "Approach Target"
│  ├─ Condition: "Target in location"
│  └─ Action: "Move to target"
│
└─ Action: "Wait"
```

#### Pros:
- **Visual editing** (tree structure)
- **Modular** (reusable subtrees)
- **Proven for games**
- **Easier to understand** than GOAP

#### Cons:
- **Manual authoring** (no automatic planning)
- **Rigid** (predefined behaviors)
- **Doesn't scale** to many situations

### Alternative 3: HTN (Hierarchical Task Network) Planning

**Concept:** Planning with high-level tasks that decompose.

```javascript
// High-level task: "Seduce Target"
Task: Seduce(target)
  Methods:
    - If target.relationship > 50: DirectSeduction(target)
    - Else: BuildRapport(target), Then Seduce(target)

Task: DirectSeduction(target)
  Decompose:
    1. GetClose(target)
    2. TouchSuggestively(target)
    3. Kiss(target)

Task: GetClose(target)
  Decompose:
    If actor.position != target.position:
      MoveTo(target.position)
    If not sitting_close:
      SitNear(target)
```

#### Pros:
- **More intuitive** than GOAP
- **Handles complex tasks** naturally
- **Hierarchical** (easier to author)
- **Efficient** (less search)

#### Cons:
- **Still requires planning** (similar complexity to GOAP)
- **Method authoring** (manual work)
- **Less flexible** than GOAP

### Alternative 4: Hybrid LLM + Simple GOAP

**Concept:** Use LLM for goal selection, simple GOAP for execution.

```javascript
// LLM generates goal in natural language
LLM: "I want to seduce the target"
  ↓
// Map to predefined goal
Goal: { "goalState": { "relationship": { ">=": 50 } } }
  ↓
// Simple GOAP finds action sequence
Plan: [sit_near, touch_hand, compliment, kiss]
  ↓
// Execute plan
Action: sit_near
```

#### Pros:
- **Best of both worlds**
- **Creative goals** (LLM) + **efficient execution** (GOAP)
- **Natural behavior** with deterministic planning
- **Cost-effective** (one LLM call for goal, rest is GOAP)

#### Cons:
- **Two systems** to maintain
- **Complex integration**
- **LLM still needed** (cost/latency)

### Alternative 5: Pattern-Based AI

**Concept:** Predefined action patterns for situations.

```javascript
// Define patterns for situations
Pattern: "Sitting near attractive person"
  Sequence: [
    { action: "make_eye_contact", probability: 0.7 },
    { action: "smile", probability: 0.8 },
    { action: "start_conversation", probability: 0.5 },
    { action: "touch_hand", probability: 0.3 }
  ]

// At decision time:
1. Identify situation (pattern matching)
2. Pick pattern
3. Select action from pattern (probabilistic)
```

#### Pros:
- **Very simple** (1 month implementation)
- **No planning** needed
- **Emergent variety** (randomness)
- **Easy to author**

#### Cons:
- **Limited situations**
- **No goal-directed behavior**
- **Can feel random**
- **Doesn't adapt**

---

## Technical Challenges

### Challenge 1: Effects vs. Rules Synchronization

**Problem:** Actions defined in two places (rules + effects) can desync.

**Solutions:**

#### Option A: Generate Effects from Rules
```javascript
// Analyze rule JSON, extract effects automatically
function extractEffects(rule) {
  const effects = [];
  for (const operation of rule.actions) {
    if (isStateChanging(operation)) {
      effects.push(operationToEffect(operation));
    }
  }
  return effects;
}
```

**Pros:** Single source of truth
**Cons:** Complex analysis, may miss conditional effects

#### Option B: Generate Rules from Effects
```javascript
// Effects are canonical, rules generated
const rule = compileEffects(effectsDSL);
```

**Pros:** Clean, declarative
**Cons:** Loss of rule flexibility, complex compiler

#### Option C: Validation Tool
```javascript
// Tool to detect desync
npm run validate:effects
// Checks: Do effects match rule operations?
// Warns if discrepancies found
```

**Pros:** Keeps both, catches errors
**Cons:** Manual sync still required

**Recommendation:** Start with Option C (validation), move to Option B (effects canonical) long-term.

### Challenge 2: Action State Space Explosion

**Problem:** With 1000+ actions, A* search is slow.

**Solutions:**

#### 1. Action Filtering
```javascript
// Only consider relevant actions
function filterActions(currentState, goal) {
  return actions.filter(action => {
    // Must have effects
    if (!action.effects) return false;

    // Must be applicable (preconditions might be satisfiable)
    if (!couldEverApply(action, goal)) return false;

    // Must contribute to goal
    if (!effectsProgressTowardGoal(action, goal)) return false;

    return true;
  });
}
```

#### 2. Action Abstraction
```javascript
// Group similar actions
AbstractAction: "remove_clothing"
  Concrete: ["remove_shirt", "remove_pants", "remove_shoes"]

// Plan with abstract actions, refine at execution
```

#### 3. Caching
```javascript
// Cache plans for common goal+state pairs
const planCache = new Map();
const cacheKey = `${goalId}:${stateHash}`;
if (planCache.has(cacheKey)) {
  return planCache.get(cacheKey);
}
```

#### 4. Hierarchical Planning
```javascript
// First plan with high-level actions, then refine
HighLevel: "get_intimate" → "touch_suggestively" → ...
LowLevel: "touch_suggestively" → ["run_thumb_across_lips", "caress_cheek", ...]
```

### Challenge 3: Partial Observability

**Problem:** Agent doesn't know all world state (what's in target's inventory, etc.)

**Solutions:**

#### 1. Optimistic Planning
```javascript
// Assume unknown state is favorable
precondition: target_has_item("key")
// If unknown: assume true
// If plan fails: replan with updated knowledge
```

#### 2. Information Gathering Actions
```javascript
action: "examine_target"
  effects: {
    knowledge(actor, target.inventory) = true
  }
```

#### 3. Conditional Plans
```javascript
plan: [
  examine_target,
  if target_has_key: {
    take_key
  } else: {
    find_key
  },
  use_key
]
```

### Challenge 4: Dynamic World

**Problem:** World state changes during plan execution (other agents act).

**Solutions:**

#### 1. Plan Validation
```javascript
beforeEachAction() {
  if (!currentPlan.isValid()) {
    replan();
  }
}
```

#### 2. Replanning Triggers
```javascript
// Replan on significant world changes
eventBus.on('ENTITY_MOVED', (entity) => {
  if (currentPlan.involvedEntities.includes(entity)) {
    invalidatePlan();
  }
});
```

#### 3. Opportunistic Replanning
```javascript
// Replan if better opportunity arises
if (newGoalPriority > currentGoalPriority) {
  replan();
}
```

### Challenge 5: Debugging Plans

**Problem:** Hard to debug why planner chose a plan.

**Solutions:**

#### 1. Plan Explanation
```javascript
plan.explain()
// Output:
// Goal: seduce_target
// Step 1: sit_near (cost: 1.0)
//   - Satisfies: close_proximity
//   - Required by: touch_hand (step 2)
// Step 2: touch_hand (cost: 1.5)
//   - Satisfies: physical_contact
//   - Required by: kiss (step 3)
// ...
```

#### 2. Search Visualization
```javascript
// Visualize A* search tree
planner.visualize()
// Shows: expanded nodes, heuristic values, chosen path
```

#### 3. Replay Tool
```javascript
// Replay plan execution step-by-step
npm run replay-plan --plan=plan-id-123
```

---

## Integration Points

### 1. Turn System Integration

```javascript
// src/turns/states/workflows/actionDecisionWorkflow.js

async function decideAction(actor, context) {
  const playerType = determineSpecificPlayerType(actor);

  if (playerType === 'goap') {
    // Use GOAP planner
    return await goapDecisionProvider.decideAction(actor, context);
  } else if (playerType === 'llm') {
    // Use LLM
    return await llmDecisionProvider.decideAction(actor, context);
  } else {
    // Human player
    return await humanDecisionProvider.decideAction(actor, context);
  }
}
```

### 2. Action Discovery Integration

```javascript
// src/data/providers/availableActionsProvider.js

async function getAvailableActions(actor) {
  const allActions = await actionDiscovery.discover(actor);

  const playerType = determineSpecificPlayerType(actor);

  if (playerType === 'goap') {
    // Filter to only actions with effects
    return allActions.filter(action => action.effects);
  }

  return allActions;
}
```

### 3. Goal Loading Integration

```javascript
// src/loaders/modsLoader.js

async function loadMods(modList) {
  // ... existing loaders

  await goalLoader.load(modList);

  // ... continue
}
```

### 4. Effects DSL Integration

```javascript
// src/goap/effectsCompiler.js

class EffectsCompiler {
  compile(effectsDSL) {
    const ast = this.parser.parse(effectsDSL);
    const preconditions = this.extractPreconditions(ast);
    const effects = this.extractEffects(ast);
    const cost = this.extractCost(ast);

    return {
      preconditions,
      effects,
      cost,
      executor: this.generateExecutor(ast)
    };
  }
}
```

### 5. Planner Integration

```javascript
// src/goap/goapPlanner.js

class GoapPlanner {
  async findPlan(currentState, goal, availableActions) {
    const actionModels = this.buildActionModels(availableActions);
    const plan = this.aStarSearch(currentState, goal, actionModels);
    return plan;
  }

  aStarSearch(start, goal, actions) {
    // A* backward chaining implementation
    // ...
  }
}
```

---

## Performance Considerations

### Planning Performance

**Target Metrics:**
- Simple plan (1-3 actions): < 50ms
- Medium plan (4-7 actions): < 200ms
- Complex plan (8-15 actions): < 1000ms
- Replan frequency: < once per 5 turns

**Optimization Strategies:**

#### 1. Action Filtering
```javascript
// Reduce search space by 90%
const relevantActions = actions.filter(a =>
  a.effects &&
  contributesToGoal(a, goal) &&
  possiblyApplicable(a, currentState)
);
```

#### 2. Heuristic Quality
```javascript
// Better heuristic = less search
heuristic(state, goal) {
  // Relaxed planning graph distance
  // Fast to compute, admissible
  return relaxedPlanDistance(state, goal);
}
```

#### 3. Plan Caching
```javascript
// Cache common plans
const cache = new LRUCache({ max: 1000 });
const key = `${goalId}:${stateHash}`;
```

#### 4. Incremental Planning
```javascript
// Reuse parts of old plan
if (oldPlan.prefixStillValid(currentState)) {
  return oldPlan.suffix();
}
```

#### 5. Timeout and Fallback
```javascript
// If planning takes too long, fall back
const plan = await planWithTimeout(1000); // 1 second max
if (!plan) {
  // Fallback: pick best immediate action
  return greedyAction();
}
```

### Memory Usage

**Estimated Memory per GOAP Agent:**
- Goal definitions: 1-5 KB
- Action models: 50-500 KB (depends on action count)
- Current plan: 1-10 KB
- Plan cache: 100 KB - 1 MB
- **Total: ~150 KB - 2 MB per agent**

**For 100 GOAP agents: ~15-200 MB**

**Optimization:**
- Share action models across agents
- Lazy-load effects
- Compact state representation

---

## Recommendations

### Tier 1: Do This (High Value, Lower Cost)

#### 1. **Start with Utility-Based AI** (Alternative 1)

**Why:** 10x simpler than GOAP, delivers 80% of value.

**Implementation (1-2 months):**
1. Add `utility` field to action schema
2. Implement utility calculator
3. Implement utility-based decision provider
4. Define utilities for 50 core actions

**Example:**
```json
{
  "id": "positioning:sit_down",
  "utility": {
    "base": 10,
    "modifiers": [
      { "if": { "<": ["actor.energy", 50] }, "add": 20 },
      { "if": { "hasComponent": ["actor", "positioning:standing"] }, "add": 5 }
    ]
  }
}
```

**Benefits:**
- Quick to implement
- Easy to tune
- No DSL needed
- Good for 80% of NPCs

#### 2. **Goal System without Planning**

**Why:** Goals are useful even without planning.

**Implementation (2-3 weeks):**
1. Use existing goal loader
2. Implement goal selection (priority + relevance)
3. Goals influence utility scores
4. No planning, just goal-directed utility

**Example:**
```javascript
// Goal: "be_well_rested"
goal: {
  priority: 80,
  relevance: { "<": ["actor.energy", 70] },
  goalState: { ">=": ["actor.energy", 90] }
}

// Actions that progress toward goal get utility boost
action: "sit_down"
  utility: base + (contributes_to_goal ? 15 : 0)
```

#### 3. **Effects as Documentation Only**

**Why:** Document action effects for future planning.

**Implementation (1 month):**
1. Define effects DSL (simple JSON format)
2. Add effects to 50 core actions
3. Don't use for planning yet, just documentation
4. Validate that effects match rules

**Benefits:**
- Prepares for future GOAP
- Improves action understanding
- Validates consistency
- Low risk

### Tier 2: Consider This (Medium Value, Medium Cost)

#### 4. **Simplified GOAP for Specific Domains**

**Why:** Full GOAP is overkill, but domain-specific planning is useful.

**Implementation (2-3 months):**
1. Pick one domain (e.g., "intimacy" or "items")
2. Implement mini-GOAP for that domain only
3. Limited action set (~20 actions)
4. Simple preconditions/effects
5. Learn lessons before expanding

**Example Domain: "Intimacy"**
- Goal: "fucking_vaginally"
- Actions: remove_clothing, lie_down, move_close, touch, insert
- ~10 actions, ~5 goals
- Manageable scope

#### 5. **Hybrid LLM + Utility**

**Why:** Best of both worlds.

**Implementation (2 months):**
1. LLM generates high-level goal/intention
2. Utility-based AI picks action to advance goal
3. Combine creativity with efficiency

**Example:**
```javascript
// LLM call (once per 5-10 turns)
goal = await llm.generateGoal(actor, context);
// "I want to get closer to Sarah"

// Map to utility boost
utilitiesBoost = {
  "move_closer_to_sarah": +20,
  "sit_near_sarah": +15,
  "make_eye_contact_sarah": +10
};

// Pick action with boosted utilities (no LLM call)
action = pickByUtility(actions, utilitiesBoost);
```

### Tier 3: Future Consideration (High Value, High Cost)

#### 6. **Full GOAP System**

**Why:** Maximum flexibility, true goal-directed planning.

**When:** After Tier 1 & 2 prove insufficient.

**Implementation (5-8 months):**
- Full effects DSL
- A* planner with backward chaining
- Effects for 200+ actions
- Goal library
- Debugging tools

**Prerequisites:**
1. Tier 1 (Utility AI) implemented and working
2. Clear use cases where utility AI fails
3. 6+ months development time available
4. Dedicated developer for GOAP

**Red Flags (Don't Do It If):**
- You don't have 6 months
- Utility AI is "good enough"
- Limited modder adoption expected
- Performance is critical

### Tier 4: Don't Do This (Low Value or Too High Cost)

#### 7. **Behavior Trees**

**Why:** Worse than utility AI for your use case (less flexible, more authoring).

#### 8. **HTN Planning**

**Why:** Similar complexity to GOAP, less flexible.

#### 9. **Effects DSL with Custom Syntax**

**Why:** Prefer JSON-based effects (easier tooling, familiar).

---

## Recommended Implementation Roadmap

### Phase 1: Utility-Based AI (Month 1-2)

```
Week 1-2: Design & Schema
  - Design utility system
  - Update action schema with utility field
  - Create utility calculator design

Week 3-4: Implementation
  - Implement utility calculator
  - Implement UtilityDecisionProvider
  - Integration with turn system

Week 5-6: Content & Testing
  - Define utilities for 50 core actions
  - Testing and tuning
  - Performance profiling

Week 7-8: Documentation & Polish
  - Modder documentation
  - Examples and patterns
  - Bug fixes
```

**Deliverables:**
- Utility-based AI system
- 50 actions with utilities
- Documentation
- Working GOAP agents (using utility AI)

### Phase 2: Goal System (Month 3)

```
Week 9-10: Goal Integration
  - Implement goal selection
  - Goal-influenced utilities
  - Goal system testing

Week 11-12: Goal Content
  - Define 10 core goals
  - Test with different agent personalities
  - Tune goal priorities
```

**Deliverables:**
- Goal system working
- 10 example goals
- Goal → utility influence

### Phase 3: Effects Documentation (Month 4)

```
Week 13-14: Effects Schema
  - Design simple JSON effects format
  - Create effects schema
  - Validation system

Week 15-16: Effects Content
  - Document effects for 50 actions
  - Validation tool to check effects vs rules
  - Fix any inconsistencies found
```

**Deliverables:**
- Effects format defined
- 50 actions documented
- Validation tool

### Phase 4: Evaluation (Month 5)

```
Week 17-18: Testing & Feedback
  - Real-world testing with GOAP agents
  - Gather modder feedback
  - Performance analysis

Week 19-20: Decision Point
  - Does utility AI meet needs? → Ship it!
  - Need real planning? → Start GOAP Phase 5
  - Hybrid approach? → Implement Tier 2 options
```

**Decision Criteria:**
- ✅ Ship utility AI if: Agents behave well enough, modders happy, performance good
- ⚠️ Consider GOAP if: Agents get stuck, can't achieve complex goals, behavior too random
- 🔄 Hybrid if: Need creativity + planning, LLM + utility isn't enough

### Optional Phase 5: Full GOAP (Month 6-12, if needed)

```
Month 6-7: Effects DSL & Compiler
Month 8-9: GOAP Planner Core
Month 10-11: Integration & Content
Month 12: Polish & Optimization
```

---

## Conclusion

### Summary of Analysis

The proposed GOAP implementation would provide true goal-directed planning for AI agents, but at significant cost (5-8 months development). The core idea of using effects DSL + backward-chaining planner is sound and builds well on existing infrastructure.

### Key Insights

1. **Your existing action discovery is excellent** - This is a huge advantage
2. **Operation handlers are perfect for effects** - Reuse them, don't duplicate
3. **GOAP is probably overkill** - Utility-based AI delivers most value for less cost
4. **Incremental approach is best** - Start simple, add complexity if needed
5. **Effects as documentation is valuable** - Even without planning

### Final Recommendation

**Implement utility-based AI first (Tier 1), then reassess.**

**Why:**
- 10x faster to implement (1-2 months vs 5-8 months)
- 80% of the value
- Lower risk
- Easier to maintain
- Can always add GOAP later if needed

**Path Forward:**

```
1. Month 1-2: Implement utility-based AI
2. Month 3: Add goal system (utility modulation)
3. Month 4: Document effects (for future)
4. Month 5: Evaluate and decide next steps
   ├─ Utility AI sufficient? → Ship it!
   ├─ Need planning? → Implement simplified GOAP for one domain
   └─ Need creativity? → Add LLM hybrid
```

**Only implement full GOAP if:**
- Utility AI proves insufficient (test it first!)
- You have 6+ months to invest
- You have concrete use cases requiring multi-step planning
- You're prepared for the maintenance burden

### My Preference

If I were implementing this, I would:

1. **Immediate:** Utility-based AI with goals (2-3 months)
2. **Next:** Hybrid LLM + utility for interesting NPCs (1 month)
3. **Future:** Simplified domain-specific GOAP for items/positioning (2-3 months)
4. **Maybe:** Full GOAP only if clear need emerges (6 months)

This approach delivers value quickly, reduces risk, and keeps options open for future expansion.

---

## Appendices

### Appendix A: Effects DSL Complete Grammar

```
// Top-level effect definition
EffectDefinition := ActionId "(" Params ")" ":=" "{" EffectBody "}"

// Effect body sections
EffectBody := [Preconditions] [Effects] [Cost]

// Preconditions section
Preconditions := "requires" "{" ConditionList "}"
ConditionList := Condition (";" Condition)*

Condition :=
  | "not" Condition
  | "hasComponent" "(" Entity "," ComponentId ")"
  | "component" "(" Entity "," ComponentId ")" ComparisonOp Value
  | Entity "." Path ComparisonOp Value
  | FunctionCall

// Effects section
Effects := "effects" "{" EffectList "}"
EffectList := Effect (";" Effect)*

Effect :=
  | "addComponent" "(" Entity "," ComponentId "," Data ")"
  | "removeComponent" "(" Entity "," ComponentId ")"
  | "modifyComponent" "(" Entity "," ComponentId "," Updates ")"
  | OperationCall
  | "if" Condition "{" EffectList "}"
  | "forEach" Var "in" Collection "{" EffectList "}"

// Cost section
Cost := "cost" ":" Number | "cost" ":" "{" CostExpression "}"

// Primitives
Entity := "actor" | "target" | Var | EntityRef
ComponentId := Identifier ":" Identifier
Path := Identifier ("." Identifier)*
Value := Number | String | Boolean | Object | Array
```

### Appendix B: Example Action Effects

#### Example 1: Simple Action (sit_down)

```
sit_down(actor, target) := {
  requires {
    not hasComponent(actor, "positioning:sitting_on");
    hasComponent(target, "positioning:allows_sitting");
    availableSpot(target);
  }

  effects {
    addComponent(actor, "positioning:sitting_on", {
      furniture_id: target.id,
      spot_index: allocateSpot(target)
    });
    lockMovement(actor);
  }

  cost: 1.0;
}
```

#### Example 2: Complex Action (remove_others_clothing)

```
remove_others_clothing(actor, target, clothing) := {
  requires {
    hasComponent(target, "clothing:wearing_clothing");
    target.clothing.items.includes(clothing);
    closeness(actor, target) == "close";
    not hasComponent(actor, "positioning:hands_restrained");
  }

  effects {
    removeComponent(target, clothing);
    addComponent(target, "core:recent_clothing_removal", {
      clothing_id: clothing.id,
      removed_by: actor.id,
      timestamp: now()
    });

    // Conditional effect
    if clothing.layer == "underwear" {
      addComponent(target, "intimacy:feeling_exposed");
    }

    // Event
    dispatchEvent("CLOTHING_REMOVED", {
      actor: actor.id,
      target: target.id,
      clothing: clothing.id
    });
  }

  cost: 1.5;
}
```

#### Example 3: Multi-Target Action (give_item)

```
give_item(actor, target, item) := {
  requires {
    hasComponent(actor, "core:inventory");
    actor.inventory.items.includes(item);
    not hasComponent(item, "items:equipped");
    hasComponent(target, "core:inventory");
    target.inventory.capacity > target.inventory.items.length;
    closeness(actor, target) == "close";
  }

  effects {
    // Remove from actor
    removeComponent(actor, item);
    modifyComponent(actor, "core:inventory", {
      items: actor.inventory.items.filter(i => i != item)
    });

    // Add to target
    addComponent(target, item);
    modifyComponent(target, "core:inventory", {
      items: [...target.inventory.items, item]
    });

    // Relationship boost
    modifyComponent(target, "relationships:affection", {
      [actor.id]: target.relationships[actor.id] + 5
    });
  }

  cost: 1.0;
}
```

### Appendix C: Comparison Table

| Feature | Full GOAP | Utility AI | Behavior Trees | HTN | LLM-Based |
|---------|-----------|------------|----------------|-----|-----------|
| **Complexity** | Very High | Low | Medium | High | Low |
| **Implementation Time** | 5-8 months | 1-2 months | 2-3 months | 4-6 months | 1 month |
| **Flexibility** | Very High | Medium | Low | High | Very High |
| **Performance** | Medium | Very High | High | Medium | Low |
| **Determinism** | High | Medium | High | High | Low |
| **Authoring Burden** | High | Low | High | Very High | Very Low |
| **Goal-Directed** | Yes | Partial | No | Yes | Yes |
| **Multi-Step Planning** | Yes | No | No | Yes | Yes |
| **Maintenance** | High | Low | Medium | High | Low |
| **Cost (Runtime)** | Low | Low | Low | Low | High |
| **Emergent Behavior** | Medium | Low | Low | Medium | Very High |
| **Best For** | Complex NPCs | Simple NPCs | State Machines | Hierarchical Tasks | Creative NPCs |

### Appendix D: Resource Estimates

#### Full GOAP Implementation

**Development Time:**
- Effects DSL: 6-8 weeks
- GOAP Planner: 6-8 weeks
- Integration: 3-4 weeks
- Content (effects): 4-6 weeks
- Testing: 2-3 weeks
- Documentation: 1-2 weeks
- **Total: 22-31 weeks (5-8 months)**

**Team:**
- 1 senior developer (full-time)
- 1 junior developer (part-time, testing/content)

**Cost (if hiring):**
- Senior dev: $120k/year → $40-80k for 4-8 months
- Junior dev: $60k/year → $10-20k for 4-8 months
- **Total: $50-100k**

#### Utility-Based AI Implementation

**Development Time:**
- System design: 1 week
- Implementation: 2-3 weeks
- Content (utilities): 2-3 weeks
- Testing: 1-2 weeks
- Documentation: 1 week
- **Total: 7-10 weeks (2-3 months)**

**Team:**
- 1 developer (full-time)

**Cost (if hiring):**
- Developer: $100k/year → $15-25k for 2-3 months
- **Total: $15-25k**

**ROI Comparison:**
- GOAP: $50-100k, 5-8 months, high risk
- Utility: $15-25k, 2-3 months, low risk
- **Utility AI delivers faster, cheaper, lower risk**

---

**Document Version:** 1.0
**Created:** 2025-01-09
**Author:** Claude (Anthropic)
**Status:** Brainstorming / Design Proposal
**Next Steps:** Review with team, decide on Tier 1 vs. full GOAP implementation
