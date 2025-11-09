# GOAP Player Implementation Design

## Executive Summary

This document explores the implementation of Goal-Oriented Action Planning (GOAP) for non-sentient AI agents in the Living Narrative Engine. GOAP provides a strategic, goal-driven approach for creatures that don't warrant LLM-based decision making (cats, monsters, goblins, etc.), enabling them to plan sequences of actions to achieve specific world states.

**Current Status:** Placeholder implementation exists (`GoapDecisionProvider`) that selects the first available action.

**Primary Goal:** Implement full GOAP system with backward-chaining A* planner, effects-based action modeling for world-state-changing actions only, and goal-driven decision making.

**Important Scope Clarifications:**
- **Target Audience:** Non-sentient creatures only (cats, monsters, goblins). Sentient NPCs use LLM-based decision making.
- **Effects Scope:** Only actions that change world state (add/remove/modify components, create/destroy entities). Not all ~1000+ actions need effects.
- **Effects Purpose:** Used ONLY for planning (future world state for A*), NOT for actual execution. Once GOAP selects an action, it executes normally through existing action/rule system.
- **Action Validation:** Already handled by existing forbidden_components, required_components, and prerequisites system. GOAP doesn't need separate precondition validation.

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

1. **Action Effects Definitions**: State-changing actions (~100-200, not all ~1000+) don't declare their effects for planning
2. **GOAP Planner**: No backward-chaining planner implementation
3. **Effects DSL**: No DSL for expressing planning-only effects (world state changes, not execution logic)
4. **Heuristic Functions**: No cost estimation for A* search
5. **Plan Management**: No system to cache and validate multi-step plans

**Important Note on Scope:**
- Effects only needed for actions that change world state: add/remove/modify components, create/destroy entities
- Excludes narrative actions (speech, thought), perceptual actions (look, listen), and non-state-changing actions
- Estimated ~100-200 actions need effects, not all ~1000+
- Effects are planning metadata, not execution code (no duplication with rules)

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

**Use Case:** Non-sentient creatures in scenarios where LLMs are inappropriate or wasteful.

**Example Scenarios:**
- Dungeon runs where every goblin needs tactical AI
- Cat NPCs pursuing simple goals (find food, sleep, play)
- Monster behavior in combat scenarios
- Wildlife and creature encounters

**Advantages for Non-Sentient Creatures:**
- Deterministic, predictable behavior suitable for simple creatures
- Faster execution (no API calls)
- Clear goal-directed behavior without narrative overhead
- Lower cost (no LLM tokens)
- Strategic planning for tactical scenarios

**Why Not LLM for These Creatures:**
- Overkill for non-sentient behavior
- Expensive for large numbers (e.g., 20 goblins in dungeon)
- Don't need narrative nuance or creativity
- Predictable behavior is actually desirable

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
   ├─> Action Discovery: Get available actions
   │   - Existing system handles forbidden_components, required_components, prerequisites
   │   - Filter to only actions with effects (state-changing actions)
   │   - GOAP doesn't need separate validation (already handled)
   │
   ├─> GOAP Planner: Find action sequence to achieve goal
   │   - A* backward chaining from goalState using effects
   │   - Effects used ONLY for planning, not execution
   │   - Build hypothetical future world states
   │
   ├─> Plan Validation: Check if plan is still valid
   │   - Verify current state matches plan assumptions
   │   - Replan if world state changed
   │
   └─> Action Execution: Execute first action in plan
       - Uses NORMAL action/rule system (not effects)
       - Rule operations execute as usual
       - Effects were only for planning, not execution
       - Store remaining plan for next turn
```

**Key Distinction:** Effects describe state changes for planning purposes only. Actual execution uses the existing action → rule → operation handlers flow. This prevents duplication and ensures consistency.

---

## Effects DSL Design

### Design Principles

1. **Planning Metadata Only**: Effects describe state changes for planner, not execution logic
2. **Reuse Existing Validation**: Leverage forbidden_components, required_components, prerequisites (no duplicate preconditions)
3. **World State Changes Only**: Only component and entity changes (no events, no perceptual side effects)
4. **Similar to Operation Handlers**: Map cleanly to existing operations (ADD_COMPONENT, REMOVE_COMPONENT, etc.)
5. **Declarative**: Describe what changes in world state, not how or why
6. **Analyzable**: Planner can reason about effects statically to build hypothetical future states

### Proposed Syntax

#### Option A: Imperative DSL (Closer to ScopeDSL)

```
// File: data/mods/positioning/effects/sit_down.effects

sit_down(actor, target) := {
  // NOTE: No preconditions here - already handled by:
  // - Action forbidden_components (positioning:sitting_on, positioning:lying_down)
  // - Action required_components (target: positioning:allows_sitting)
  // - Action prerequisites (availableSpot check via JSON Logic)

  // Effects (for planner to reason backward about future world state)
  effects {
    // World state changes only
    addComponent(actor, "positioning:sitting_on", {
      furniture_id: target.id,
      spot_index: allocateSpot(target)  // Hypothetical allocation for planning
    });

    // Movement lock is a component change
    addComponent(actor, "positioning:movement_locked");

    // Conditional effect based on world state
    if adjacentActors(actor, target).length > 0 {
      addComponent(actor, "positioning:sitting_close_to", {
        target_id: target.id
      });
    }
  }

  // Cost for A* heuristic (optional, defaults to 1.0)
  cost: 1.0;
}
```

**Note on Execution:** When GOAP selects this action, the actual execution uses the existing rule:
- Rule matches on action event
- Operations execute (ADD_COMPONENT, ESTABLISH_SITTING_CLOSENESS, etc.)
- Events dispatch normally (ACTOR_SAT_DOWN, etc.)
- Effects above are ONLY for planning, not execution

#### Option B: Declarative JSON-Like DSL

```
// File: data/mods/positioning/effects/sit_down.effects

sit_down(actor, target) := {
  // No preconditions section - reuse existing action validation

  effects: [
    add component(actor, "positioning:sitting_on") {
      furniture_id: target.id,
      spot_index: allocateSpot(target)
    },

    add component(actor, "positioning:movement_locked"),

    when adjacentActors(actor, target).length > 0:
      add component(actor, "positioning:sitting_close_to") {
        target_id: target.id
      }
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
  "forbidden_components": ["positioning:sitting_on", "positioning:lying_down"],
  "required_components": { "target": ["positioning:allows_sitting"] },
  "prerequisites": { /* existing JSON Logic for availableSpot */ },

  // NEW: Effects definition for GOAP planning only
  "planningEffects": {
    "effects": [
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:sitting_on",
        "data": {
          "furniture_id": { "ref": "target.id" },
          "spot_index": { "hypothetical": "allocateSpot" }
        }
      },
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:movement_locked"
      },
      {
        "operation": "CONDITIONAL",
        "condition": { ">": [{ "fn": "adjacentActors.length", "args": ["actor", "target"] }, 0] },
        "then": [
          {
            "operation": "ADD_COMPONENT",
            "entity": "actor",
            "component": "positioning:sitting_close_to",
            "data": { "target_id": { "ref": "target.id" } }
          }
        ]
      }
    ],
    "cost": 1.0
  }
}
```

**Note:** `planningEffects` is separate from action validation and rule execution. It's metadata for GOAP planner to simulate future world states.

### DSL Features Breakdown

#### 1. No Separate Preconditions

**Important:** Effects DSL doesn't need preconditions because existing action system already handles validation:

- **forbidden_components**: List of components that prevent action execution
- **required_components**: Components required on actor/target for action to be available
- **prerequisites**: JSON Logic conditions that must be true

The planner can read these existing fields to determine action applicability. No duplication needed.

#### 2. Effects (World State Changes Only)

Describe state changes for planning (NOT execution):

```
effects {
  // Component manipulation (world state changes)
  addComponent(actor, "positioning:sitting_on", { ... });
  removeComponent(actor, "positioning:standing");
  modifyComponent(actor, "core:stats", { energy: -10 });

  // Component-based operations (translate to component changes)
  addComponent(actor, "positioning:movement_locked");  // Instead of lockMovement()
  addComponent(actor, "positioning:sitting_close_to", { target_id: target.id });  // Instead of establishCloseness()
  // Item transfer = remove from actor inventory, add to target inventory

  // Conditionals (for state-dependent effects)
  if condition {
    ...effects
  }

  // Loops (for bulk state changes)
  forEach actor in actors_nearby {
    addComponent(actor, "positioning:proximity", { ... });
  }
}
```

**What NOT to include:**
- Events (DISPATCH_EVENT, DISPATCH_PERCEPTIBLE_EVENT) - execution concern, not planning
- Narrative effects (speech, thoughts) - not world state changes
- Side effects (logging, notifications) - execution concerns

Maps to: Component changes that operation handlers will execute via rules

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

2. **Creature-Specific Action Sets** (1-2 weeks)
   - Define action sets for creature types:
     - Cat: move_to, jump_on, scratch, eat, sleep, play
     - Goblin: move, attack, flee, hide, pick_up_weapon, flank
     - Monster: move, attack, roar, chase, patrol
   - ~20-30 core actions per creature type
   - Focus on state-changing tactical actions

3. **Debugging and Visualization** (1 week)
   - Plan visualization in dev console
   - Planner diagnostics (why this plan?)
   - Goal/action logging
   - State diff visualization

4. **Documentation** (1 week)
   - Effects auto-generation guide
   - GOAP system overview
   - Goal creation guide for creatures
   - Examples and patterns

#### Deliverables:
- Full GOAP system integrated
- Creature-specific action sets with auto-generated effects
- Developer documentation
- Example goals for cats, goblins, monsters

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
- Effects only needed for world-state-changing actions (~100-200, not all ~1000+)
- Non-state actions (speech, thought, perception) automatically filtered
- Clear distinction between planning metadata and execution logic
- Effects never execute - only used by planner to simulate future states

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

#### 4. **Additional Metadata Requirement** ⚠️
- Actions need planning effects in addition to rules
- Effects must accurately reflect rule operations (but don't execute)
- Risk of desync if rule changes but effects don't update
- Additional work for modders (~100-200 actions need effects)
- Mitigated by: Effects are simpler than rules (only component changes), validation tools can check consistency

#### 5. **Action Coverage Scope** ⚠️
- Need effects for ~100-200 state-changing actions (not all ~1000+)
- Only world-state changes need effects (component/entity operations)
- Narrative actions (fondle, caress, etc.) excluded - GOAP creatures don't need these
- Challenge: Identifying which actions non-sentient creatures actually need

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

### Alternative 1: Utility-Based AI (NOT Recommended for This Project)

**Concept:** Instead of full GOAP, use utility-based selection.

#### Why NOT Recommended:

The existing action validation system (forbidden_components, required_components, prerequisites) already filters out invalid actions. Utility-based AI typically adds preconditions like "only consider if character is standing" to limit the action space, but this project already has that filtering built-in.

**Challenges:**
- Utility scores would need preconditions that duplicate existing validation
- Existing system already provides pre-filtered valid actions to decision provider
- Adding utility scores doesn't solve the multi-step planning problem
- For non-sentient creatures (cats, goblins), reactive selection isn't strategic enough

#### How it would work (if implemented):
```javascript
// Each action has a utility function
{
  "id": "positioning:sit_down",
  "utility": {
    "base": 10,
    "factors": [
      { "condition": "actor.energy < 50", "score": 20 },
      // But this requires checking if standing, which existing validation already does
    ]
  }
}

// At decision time:
1. Get available actions (already filtered by existing system)
2. Calculate utility score for remaining actions
3. Pick highest scoring action
4. Execute immediately (no planning)
```

#### Why GOAP is better for this project:
- Existing validation handles action filtering automatically
- GOAP provides multi-step planning for strategic behavior (goblins, monsters)
- No duplicate precondition logic needed
- More appropriate for tactical scenarios (dungeon runs)

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

### Challenge 1: Effects vs. Rules Consistency

**Problem:** Effects (planning metadata) must accurately reflect what rules do, but they're defined separately.

**Important Context:**
- Effects are NOT execution code - they're planning metadata
- Rules remain the single source of truth for execution
- Effects describe what the planner should expect, not how to execute
- Desync means planner makes bad plans, not execution errors

**Solutions:**

#### Option A: Auto-Generate Effects from Rules (Recommended)
```javascript
// Analyze rule operations, extract state-changing effects automatically
function extractEffects(rule) {
  const effects = [];
  for (const operation of rule.operations) {
    if (isWorldStateChanging(operation)) {
      // Map operation to planning effect
      effects.push(operationToEffect(operation));
    }
  }
  return effects;
}

// State-changing operations:
// ADD_COMPONENT, REMOVE_COMPONENT, MODIFY_COMPONENT,
// CREATE_ENTITY, DESTROY_ENTITY
// Skip: DISPATCH_EVENT, DISPATCH_PERCEPTIBLE_EVENT (not world state)
```

**Pros:**
- Single source of truth (rules)
- No desync possible
- Automatic updates when rules change
- Less work for modders

**Cons:**
- Complex analysis for conditional operations
- May need manual overrides for complex effects

#### Option B: Manual Effects with Validation
```javascript
// Tool to detect desync between effects and rules
npm run validate:effects
// Checks: Do effects accurately reflect rule operations?
// Compares component changes in rules vs. declared effects
// Warns if discrepancies found
```

**Pros:**
- Full control over effects
- Can optimize planning representation

**Cons:**
- Manual sync required
- Risk of desync

**Recommendation:** Option A (auto-generation) for most actions, Option B (manual) for complex cases with validation tool.

### Challenge 2: Action State Space Management

**Problem:** Even with ~100-200 state-changing actions, A* search can be slow without filtering.

**Important Context:**
- Only ~100-200 actions need effects (state-changing only)
- Existing action discovery already filters by forbidden_components, required_components, prerequisites
- GOAP planner receives pre-filtered valid actions (major optimization)

**Solutions:**

#### 1. Leverage Existing Action Filtering
```javascript
// Get actions already filtered by action discovery system
const validActions = await actionDiscovery.getAvailableActions(actor);

// Further filter to only state-changing actions (those with effects)
const plannable = validActions.filter(action => action.effects);

// Already filtered by:
// - forbidden_components (can't have)
// - required_components (must have)
// - prerequisites (JSON Logic conditions)
// - target availability (scope queries)

// Result: Small set of actually executable actions (~10-30 typically)
```

#### 2. Additional GOAP-Specific Filtering
```javascript
// Further filter by goal relevance
function filterByGoal(actions, currentState, goal) {
  return actions.filter(action => {
    // Must contribute to goal (effects move toward goal state)
    if (!effectsProgressTowardGoal(action.effects, goal)) return false;

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
  // Action discovery already filters by:
  // - forbidden_components
  // - required_components
  // - prerequisites
  // - target availability
  const validActions = await actionDiscovery.discover(actor);

  const playerType = determineSpecificPlayerType(actor);

  if (playerType === 'goap') {
    // Further filter to only state-changing actions (those with planning effects)
    // Effects are metadata for planning, not execution
    return validActions.filter(action => action.planningEffects);
  }

  return validActions;
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

### Tier 1: Incremental GOAP Implementation (Recommended)

#### 1. **Start with Effects Auto-Generation**

**Why:** Simplest way to create planning metadata without manual work.

**Implementation (1-2 months):**
1. Implement effects analyzer that reads rule operations
2. Auto-generate planning effects from state-changing operations
3. Focus on ~100-200 core state-changing actions
4. Validate generated effects

**Example:**
```javascript
// Rule has: ADD_COMPONENT, REMOVE_COMPONENT operations
// Auto-generate:
{
  "planningEffects": {
    "effects": [
      { "operation": "ADD_COMPONENT", ... },
      { "operation": "REMOVE_COMPONENT", ... }
    ]
  }
}
```

**Benefits:**
- No manual effect authoring needed
- Single source of truth (rules)
- Automatic updates when rules change
- Ensures consistency

#### 2. **Goal System with Action Selection**

**Why:** Goals direct behavior even without full planning initially.

**Implementation (2-3 weeks):**
1. Use existing goal loader
2. Implement goal selection (priority + relevance)
3. Simple greedy action selection toward goals
4. Foundation for full GOAP planner

**Example:**
```javascript
// Goal: "find_food"
goal: {
  priority: 80,
  relevance: { "<": ["actor.hunger", 30] },
  goalState: { "hasComponent": ["actor", "core:has_food"] }
}

// Pick action whose effects move closest to goal state
```

#### 3. **Simple GOAP Planner (One-Step)**

**Why:** Validate planning infrastructure before full A* implementation.

**Implementation (1 month):**
1. Implement single-step planner (no backward chaining yet)
2. Pick action whose effects best match goal
3. Test with simple goals (find item, move to location)
4. Validate effects system works

**Benefits:**
- Tests planning infrastructure
- Simpler than full A*
- Still useful for basic creatures
- Foundation for full planner

### Tier 2: Full Multi-Step GOAP Planner

#### 4. **A* Backward-Chaining Planner**

**Why:** Enables true multi-step planning for tactical scenarios.

**Implementation (2-3 months):**
1. Implement A* search with backward chaining
2. Use auto-generated effects from Tier 1
3. Heuristic function (relaxed planning graph)
4. Plan caching and validation

**Example:**
```javascript
// Goal: "has_food"
// Current: No food, in bedroom, kitchen has food

// Plan:
1. move_to(kitchen)  // Gets actor to kitchen
2. pick_up(food)     // Adds food to inventory
// Achieves goal: actor.inventory.includes(food)
```

**Benefits:**
- Multi-step strategic behavior
- Suitable for dungeon runs, combat scenarios
- Goblins, monsters can plan tactically

#### 5. **Domain-Specific Optimization**

**Why:** Optimize planning for specific creature types.

**Implementation (1-2 months):**
1. Creature-specific action sets (cat actions, goblin actions, monster actions)
2. Domain-specific heuristics
3. Goal templates per creature type

**Example:**
```javascript
// Cat creature: Limited to cat-appropriate actions
plannable_actions = [
  "move_to", "jump_on", "scratch", "meow",
  "eat_food", "sleep_on", "play_with"
];

// Goblin creature: Combat and tactical actions
plannable_actions = [
  "move_to", "attack", "flee", "hide", "pick_up_weapon",
  "call_for_help", "flank_target"
];
```

### Tier 3: Advanced Features (Optional)

#### 6. **Hierarchical Planning**

**Why:** Further optimization for complex multi-step plans.

**Implementation (2-3 months):**
- Abstract high-level actions
- Multi-level planning (strategic → tactical)
- Plan refinement

**Example:**
```javascript
// High-level: "acquire_weapon"
// Decomposes to: move_to(armory) → pick_up(sword)

// High-level: "defeat_enemy"
// Decomposes to: acquire_weapon → move_to(enemy) → attack(enemy)
```

#### 7. **Multi-Agent Coordination**

**Why:** Enable pack tactics for creatures.

**Implementation (2-3 months):**
- Shared goals for groups (pack of wolves, goblin squad)
- Resource coordination (don't all target same enemy)
- Cooperative planning

**Example:**
```javascript
// Goblin squad shares goal: "defeat_party"
// Planner assigns roles: flanker, tank, archer
// Coordinates to surround targets
```

### What NOT to Implement

#### ❌ **Utility-Based AI**
**Why:** Existing validation system already handles action filtering. Utility would duplicate preconditions that forbidden_components/required_components/prerequisites already provide. GOAP planning is better fit for non-sentient tactical behavior.

#### ❌ **Behavior Trees**
**Why:** Less flexible than GOAP, more manual authoring, doesn't provide planning capabilities.

#### ❌ **HTN Planning**
**Why:** Similar complexity to GOAP but less flexible, requires more manual task decomposition.

#### ❌ **Custom Effects DSL Syntax**
**Why:** JSON-based effects are simpler, more familiar to modders, better tooling support. Can use existing JSON schemas and validation.

---

## Recommended Implementation Roadmap

### Phase 1: Effects Auto-Generation (Month 1-2)

```
Week 1-2: Effects Analyzer Design
  - Design rule analyzer to extract state-changing operations
  - Identify operation types to convert (ADD/REMOVE/MODIFY_COMPONENT, etc.)
  - Plan effects schema format

Week 3-4: Implementation
  - Implement rule operation analyzer
  - Implement effects generator
  - Map operations to planning effects
  - Handle conditional operations

Week 5-6: Content Generation & Validation
  - Auto-generate effects for ~100-200 state-changing actions
  - Validate generated effects
  - Manual review and adjustments
  - Create validation tool

Week 7-8: Testing & Documentation
  - Test generated effects accuracy
  - Performance profiling
  - Documentation for modders
  - Examples
```

**Deliverables:**
- Effects auto-generation system
- ~100-200 actions with auto-generated planning effects
- Validation tool
- Documentation

### Phase 2: Goal System & Simple Planner (Month 3-4)

```
Week 9-10: Goal Integration
  - Implement goal selection (priority + relevance)
  - Goal state evaluation
  - Goal caching

Week 11-12: Simple One-Step Planner
  - Implement greedy action selection toward goals
  - Match action effects to goal state
  - Distance heuristic (how close effects move to goal)

Week 13-14: Testing
  - Test with simple goals (find_food, move_to_location)
  - Validate effects system works correctly
  - Test with cat/creature behaviors

Week 15-16: Content & Polish
  - Define 10 core goals for creatures
  - Creature-specific goal templates
  - Documentation
```

**Deliverables:**
- Goal selection system
- Simple one-step planner
- 10 example goals for non-sentient creatures
- Working GOAP agents with basic planning

### Phase 3: Full A* Planner (Month 5-7)

```
Week 17-18: A* Core Implementation
  - Implement A* search algorithm
  - Backward chaining from goals
  - Priority queue for open set

Week 19-20: Heuristic & State Management
  - Relaxed planning graph heuristic
  - World state representation
  - State hashing and comparison

Week 21-22: Plan Management
  - Plan caching
  - Plan validation (detect invalidation)
  - Replanning triggers

Week 23-24: Integration & Testing
  - Integrate with existing decision provider
  - Multi-step plan execution
  - Testing with complex scenarios

Week 25-28: Optimization & Polish
  - Performance optimization
  - Action filtering improvements
  - Domain-specific optimizations
  - Debugging tools and visualization
```

**Deliverables:**
- Full A* backward-chaining planner
- Plan caching and validation
- Multi-step plans working
- Performance optimized for real-time use

### Phase 4: Advanced Features (Month 8-10, Optional)

```
Month 8: Domain-Specific Optimization
  - Creature-type-specific action sets
  - Optimized heuristics per creature type
  - Goal templates

Month 9: Hierarchical Planning
  - Abstract high-level actions
  - Plan refinement
  - Multi-level planning

Month 10: Multi-Agent Coordination
  - Shared goals for groups
  - Cooperative planning
  - Pack tactics
```

**Deliverables:**
- Optimized for different creature types
- Advanced planning features
- Multi-agent coordination

---

## Conclusion

### Summary of Analysis

The proposed GOAP implementation would provide true goal-directed planning for non-sentient AI agents (cats, monsters, goblins). The implementation leverages existing infrastructure effectively and addresses the specific need for tactical, multi-step planning in scenarios like dungeon runs.

### Key Insights

1. **Existing action validation is a major advantage** - forbidden_components, required_components, and prerequisites already filter invalid actions, eliminating need for duplicate precondition logic
2. **Auto-generated effects from rules** - Single source of truth, no manual duplication, automatic consistency
3. **Effects are planning metadata only** - Never execute, only used by planner to simulate future world states
4. **Limited scope to world-state changes** - Only ~100-200 actions need effects (component/entity operations), not all ~1000+ actions
5. **GOAP is the right fit** - Non-sentient creatures need strategic planning for tactical scenarios, not reactive utility-based selection

### Final Recommendation

**Implement GOAP incrementally with auto-generated effects (Tier 1 → Tier 2 → Tier 3).**

**Why GOAP is Right for This Project:**
- Non-sentient creatures (goblins, monsters, cats) need strategic behavior
- Tactical scenarios (dungeon runs) require multi-step planning
- Existing validation system eliminates need for utility-based approach
- Auto-generation from rules ensures consistency without manual work

**Path Forward:**

```
1. Month 1-2: Auto-generate effects from rules
   - Analyze rule operations
   - Extract state-changing effects
   - Validate ~100-200 actions

2. Month 3-4: Goal system + simple one-step planner
   - Goal selection
   - Greedy action selection toward goals
   - Test with basic creature behaviors

3. Month 5-7: Full A* backward-chaining planner
   - Multi-step planning
   - Plan caching and validation
   - Tactical dungeon scenarios

4. Month 8-10: Advanced features (optional)
   - Domain-specific optimization
   - Hierarchical planning
   - Multi-agent coordination
```

**Why NOT Utility-Based AI:**
- Existing forbidden_components/required_components/prerequisites already filter actions
- Utility requires duplicate precondition logic that's already handled
- Doesn't provide multi-step planning needed for tactical scenarios
- Reactive selection insufficient for strategic creature behavior

### Implementation Priority

**High Priority (Core GOAP):**
1. Effects auto-generation from rules
2. Goal selection system
3. A* backward-chaining planner
4. Plan caching and validation

**Medium Priority (Optimization):**
5. Domain-specific creature action sets
6. Performance optimization
7. Debugging and visualization tools

**Low Priority (Advanced):**
8. Hierarchical planning
9. Multi-agent coordination
10. Advanced heuristics

### Success Criteria

GOAP implementation is successful if:
- ✅ Goblins in dungeon runs exhibit strategic, multi-step behavior
- ✅ Cats pursue goals naturally (find food, sleep, play)
- ✅ Monsters make tactical decisions in combat
- ✅ Planning completes within performance budget (< 200ms for medium plans)
- ✅ Effects accurately reflect rule behavior (validation passes)
- ✅ System scales to 20+ GOAP creatures simultaneously

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

### Appendix B: Example Action Effects (Auto-Generated from Rules)

#### Example 1: Simple Action (sit_down)

```json
// Auto-generated from rule operations
{
  "id": "positioning:sit_down",
  "planningEffects": {
    "effects": [
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:sitting_on",
        "data": {
          "furniture_id": { "ref": "target.id" },
          "spot_index": { "hypothetical": "allocateSpot" }
        }
      },
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:movement_locked"
      },
      {
        "operation": "CONDITIONAL",
        "condition": { ">": [{ "fn": "adjacentActors.length" }, 0] },
        "then": [
          {
            "operation": "ADD_COMPONENT",
            "entity": "actor",
            "component": "positioning:sitting_close_to",
            "data": { "target_id": { "ref": "target.id" } }
          }
        ]
      }
    ],
    "cost": 1.0
  }
}
```

**Note:** Preconditions come from action's forbidden_components, required_components, and prerequisites. Events (ACTOR_SAT_DOWN) are execution concerns, not planning, so excluded from effects.

#### Example 2: Item Transfer (pick_up_item)

```json
// Auto-generated from rule operations
{
  "id": "items:pick_up_item",
  "planningEffects": {
    "effects": [
      {
        "operation": "REMOVE_COMPONENT",
        "entity": "target",
        "component": "items:at_location"
      },
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "items:in_inventory",
        "data": {
          "item_id": { "ref": "target.id" }
        }
      },
      {
        "operation": "MODIFY_COMPONENT",
        "entity": "actor",
        "component": "core:inventory",
        "updates": {
          "weight": { "add": { "ref": "target.weight" } }
        }
      }
    ],
    "cost": 1.0
  }
}
```

**Note:** Effects describe world state changes only. Execution uses normal rule → operations flow, which includes event dispatching, validation, etc.

#### Example 3: Movement (move_to_location)

```json
// Auto-generated from rule operations
{
  "id": "movement:move_to",
  "planningEffects": {
    "effects": [
      {
        "operation": "MODIFY_COMPONENT",
        "entity": "actor",
        "component": "core:position",
        "updates": {
          "locationId": { "ref": "target.id" }
        }
      }
    ],
    "cost": {
      "base": 1.0,
      "factors": [
        {
          "fn": "distance",
          "args": ["actor.position", "target.position"],
          "multiplier": 0.1
        }
      ]
    }
  }
}
```

**Note:** Cost can be dynamic based on world state (distance in this case). Planner uses this to prefer shorter paths.

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
