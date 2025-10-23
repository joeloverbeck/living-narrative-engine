# Player Type System and Simple AI Integration Analysis

**Date:** 2025-10-23
**Focus:** Architecture analysis for `core:player_type` usage and simple AI integration
**Purpose:** Evaluate system architecture for integrating passive/scripted entities into the turn system

---

## Executive Summary

This analysis examines the Living Narrative Engine's player type system and evaluates the feasibility of introducing a "simple AI" type for entities that output scripted narrative content (e.g., a TV playing a movie).

### Key Findings

1. **Player Type Detection:** The system uses a three-tiered detection approach via the `core:player_type` component with fallback to legacy properties
2. **Current Support:** Three player types are supported: `human`, `llm`, and `goap`
3. **Affected Systems:** Player type influences 6 major subsystems: turn management, decision providers, UI indicators, event payloads, action selection, and output routing
4. **Integration Feasibility:** Adding a simple AI type is feasible but requires modifications across 7+ files
5. **Architecture Limitations:** The current design assumes all actors participate in action selection, which doesn't fit passive/scripted behavior patterns

### Recommendations

- **Short-term:** Add `simple_ai` type to enum with dedicated decision provider
- **Medium-term:** Implement behavior component system to decouple turn behavior from player type
- **Long-term:** Refactor to strategy pattern allowing mods to register custom behavior types without core code changes

---

## 1. Current Architecture Analysis

### 1.1 Player Type Component Schema

**Location:** `data/mods/core/components/player_type.component.json`

```json
{
  "id": "core:player_type",
  "dataSchema": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "enum": ["human", "llm", "goap"]
      }
    }
  }
}
```

**Design Notes:**
- Uses JSON Schema enum for strict type validation
- Requires schema update to add new types
- No extensibility mechanism for mods to add custom types

### 1.2 Player Type Detection Mechanisms

The system uses multiple detection points with fallback logic:

#### Detection Point 1: ActorAwareStrategyFactory
**Location:** `src/turns/factories/actorAwareStrategyFactory.js:50-76`

```javascript
providerResolver = (actor) => {
  // 1. Check new player_type component via Entity API
  if (actor && typeof actor.getComponentData === 'function') {
    const playerTypeData = actor.getComponentData('core:player_type');
    if (playerTypeData?.type) {
      return playerTypeData.type;
    }
  }

  // 2. Fallback: Check components property (old style)
  if (actor?.components?.['core:player_type']) {
    return actor.components['core:player_type'].type;
  }

  // 3. Check legacy aiType or ai component
  const type = actor?.aiType ?? actor?.components?.ai?.type;
  if (typeof type === 'string') return type.toLowerCase();

  // 4. Check legacy isAi property
  if (actor?.isAi === true) return 'llm';

  // 5. Default to human
  return 'human';
}
```

**Design Pattern:** Defensive programming with graceful degradation

#### Detection Point 2: Actor Type Utils
**Location:** `src/utils/actorTypeUtils.js`

Two utility functions provide player type information:

```javascript
// Returns 'human' or 'ai' (backward compatible)
function determineActorType(actor) {
  // Checks player_type component first
  // Maps non-human types to 'ai' for compatibility
}

// Returns specific type: 'human', 'llm', 'goap'
function determineSpecificPlayerType(actor) {
  // Returns exact player_type value
  // Falls back to legacy detection
}
```

**Usage:** Event payload construction, UI logic, logging

#### Detection Point 3: Turn Manager
**Location:** `src/turns/turnManager.js:363-373`

```javascript
// Determine entity type using player_type component
let entityType = 'ai'; // default
if (this.#currentActor.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
  const playerTypeData = this.#currentActor.getComponentData(
    PLAYER_TYPE_COMPONENT_ID
  );
  entityType = playerTypeData?.type === 'human' ? 'player' : 'ai';
} else if (this.#currentActor.hasComponent(PLAYER_COMPONENT_ID)) {
  entityType = 'player'; // Fallback to legacy player component
}
```

**Note:** Maps to binary classification ('player' vs 'ai') for event payloads

### 1.3 Affected System Components

| Component | Impact | Files |
|-----------|--------|-------|
| **Turn Management** | Determines turn order and event payloads | `turnManager.js`, `roundManager.js` |
| **Decision Providers** | Routes to appropriate decision logic | `actorAwareStrategyFactory.js`, `*DecisionProvider.js` |
| **UI Indicators** | Shows processing state by type | `processingIndicatorController.js` |
| **Event System** | Includes actor type in turn events | `turnManager.js`, event handlers |
| **Action Selection** | Type-specific action filtering (potential) | `choicePipeline.js` |
| **Utility Functions** | Type checking across codebase | `actorTypeUtils.js` |

---

## 2. Turn System Processing Flow

### 2.1 Actor Registration Flow

```
EntityManager.entities (all entities)
         ↓
RoundManager.startRound()
         ↓
Filter: entity.hasComponent('core:actor')
         ↓
TurnOrderService.startNewRound(actors, strategy)
         ↓
Round-robin or Initiative queue
```

**Key Code:** `src/turns/roundManager.js:23-26`

```javascript
const allEntities = Array.from(this.#entityManager.entities);
const actors = allEntities.filter((e) =>
  e.hasComponent(ACTOR_COMPONENT_ID)
);
```

**Design Implication:** Any entity with `core:actor` component participates in turn order, regardless of player type.

### 2.2 Turn Execution Flow

```
TurnManager.advanceTurn()
         ↓
TurnCycle.nextActor() → TurnOrderService.getNextEntity()
         ↓
TurnHandlerResolver.resolveHandler(actor) → GenericTurnHandler
         ↓
GenericTurnHandler.startTurn(actor)
         ↓
ActorAwareStrategyFactory.create(actorId) → GenericTurnStrategy
         ↓
GenericTurnStrategy.decideAction(context)
         ↓
[Decision Provider selected based on player type]
         ↓
HumanDecisionProvider | LLMDecisionProvider | GoapDecisionProvider
         ↓
Decision Result → TurnAction
         ↓
Action Execution via Rule System
         ↓
Dispatch: core:turn_ended
```

### 2.3 Decision Provider Architecture

**Interface:** `ITurnDecisionProvider`

```javascript
class DecisionProvider {
  async decide(actor, context, actions, abortSignal) {
    // Returns: { chosenIndex, speech, thoughts, notes }
  }
}
```

**Implementations:**

1. **HumanDecisionProvider** (`src/turns/providers/humanDecisionProvider.js`)
   - Delegates to `PromptCoordinator.prompt()`
   - Waits for user input through UI
   - Returns user-selected action index

2. **LLMDecisionProvider** (`src/turns/providers/llmDecisionProvider.js`)
   - Delegates to `LLMChooser.choose()`
   - AI analyzes actions and selects one
   - Generates speech, thoughts, notes

3. **GoapDecisionProvider** (`src/turns/providers/goapDecisionProvider.js`)
   - **Current Implementation:** Minimal placeholder that always selects first action (index: 1)
   - **Future Vision:** Goal-oriented action planning with action evaluation against goals
   - **Note:** Registered as a player type but awaiting full GOAP implementation
   - Output structure compatible with other providers

**Common Pattern:** All providers return choice from available actions list

### 2.4 Output Mechanism: Perceptible Events

**Handler:** `DispatchPerceptibleEventHandler`
**Location:** `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

```javascript
// Dispatches event and optionally logs to perception_log components
await handler.execute({
  location_id: "room_1",
  description_text: "The movie starts with a fade to black...",
  perception_type: "visual",
  actor_id: "tv_entity_1",
  log_entry: true  // Adds to perception_log components
});
```

**Perception Log Component:**
**Location:** `data/mods/core/components/perception_log.component.json`

```json
{
  "id": "core:perception_log",
  "dataSchema": {
    "properties": {
      "maxEntries": { "type": "integer", "default": 50 },
      "logEntries": {
        "type": "array",
        "items": {
          "properties": {
            "descriptionText": { "type": "string" },
            "timestamp": { "type": "string", "format": "date-time" },
            "perceptionType": { "type": "string" },
            "actorId": { "type": "string" },
            "targetId": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Flow for Actor Perception:**
1. Action executes → triggers `DISPATCH_PERCEPTIBLE_EVENT` operation
2. Handler dispatches `core:perceptible_event` to event bus
3. If `log_entry: true`, calls `AddPerceptionLogEntryHandler`
4. Handler adds entry to `perception_log` components of:
   - Actors in same location (default)
   - Explicit recipient IDs (if specified)
   - All actors except excluded IDs (if specified)

---

## 3. Simple AI Integration Analysis

### 3.1 Requirements Breakdown

**Use Case:** TV Entity Playing Movie

1. **Trigger:** Actor performs "play movie on TV" action
2. **Registration:** TV entity gets added to turn order as simple AI
3. **Turn Behavior:** Each turn, TV outputs next movie narrative segment
4. **Output Target:** Perception logs of actors in same location
5. **Content Source:** Pre-defined movie script component (e.g., `movie_playback`)

**Key Characteristics:**
- No action selection needed (single predetermined behavior)
- Scripted output sequence (not AI-generated)
- Passive entity (doesn't interact, just outputs)
- Turn-synchronized (outputs once per turn)

### 3.2 Integration Approaches

#### Approach 1: Minimal Changes (Quick Integration)

**Add `simple_ai` to Player Type Enum**

**Changes Required:**
1. Update `player_type.component.json`: Add "simple_ai" to enum
2. Create `SimpleAIDecisionProvider`:
   ```javascript
   class SimpleAIDecisionProvider {
     async decide(actor, context, actions, abortSignal) {
       // Read from scripted_behavior component
       const behavior = actor.getComponentData('scripted_behavior');
       const currentEntry = behavior.entries[behavior.current_index];

       // Return special "output" action
       return {
         chosenIndex: 1, // Always first action (scripted output)
         speech: currentEntry.text,
         thoughts: null,
         notes: null
       };
     }
   }
   ```
3. Register in `ActorAwareStrategyFactory`
4. Update `actorTypeUtils.js` to handle 'simple_ai'
5. Update `turnManager.js` event type mapping

**Pros:**
- Minimal code changes
- Follows existing patterns
- Quick to implement

**Cons:**
- Still forces through action selection pipeline
- Requires special "output" action definition
- Not flexible for other passive behavior types
- Mixes concerns (player type vs behavior type)

#### Approach 2: Behavior Component System (Recommended)

**Decouple Behavior from Player Type**

**New Component:** `scripted_behavior.component.json`

```json
{
  "id": "core:scripted_behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entries": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "text": { "type": "string" },
            "perceptionType": { "type": "string", "default": "visual" },
            "duration": { "type": "integer", "default": 1 }
          }
        }
      },
      "current_index": { "type": "integer", "default": 0 },
      "loop": { "type": "boolean", "default": false },
      "auto_advance": { "type": "boolean", "default": true }
    }
  }
}
```

**Modified Decision Flow:**

```javascript
// In GenericTurnStrategy or ActorAwareStrategyFactory
async decideAction(context) {
  const actor = context.getActor();

  // Check for behavior component first
  if (actor.hasComponent('core:scripted_behavior')) {
    return this.#executeScriptedBehavior(actor, context);
  }

  // Fall back to existing action selection
  const actions = await this.choicePipeline.buildChoices(actor, context);
  // ... existing logic
}

#executeScriptedBehavior(actor, context) {
  const behavior = actor.getComponentData('core:scripted_behavior');
  const entry = behavior.entries[behavior.current_index];

  // Dispatch perceptible event directly
  await context.executeOperation('DISPATCH_PERCEPTIBLE_EVENT', {
    location_id: actor.getComponentData('core:location').locationId,
    description_text: entry.text,
    perception_type: entry.perceptionType,
    actor_id: actor.id,
    log_entry: true
  });

  // Advance index
  if (behavior.auto_advance) {
    const newIndex = (behavior.current_index + 1) % behavior.entries.length;
    actor.mutateComponent('core:scripted_behavior', {
      current_index: behavior.loop ? newIndex :
        Math.min(behavior.current_index + 1, behavior.entries.length - 1)
    });
  }

  // Return no-op action result
  return { kind: 'scripted', action: null, extractedData: {} };
}
```

**Pros:**
- Clean separation of concerns
- No need to add player types for behavior variants
- Reusable for any scripted entity (NPCs, environmental objects)
- Mods can add new behavior components
- Player type remains for UI/reporting

**Cons:**
- More significant architectural change
- Requires refactoring GenericTurnStrategy
- Need new component definitions

#### Approach 3: Event-Driven Narrative (Alternative)

**Remove TV from Turn Order**

Instead of making TV an actor:
1. "Play movie" action adds listener to turn system
2. Listener triggers on `TURN_STARTED` events
3. Outputs narrative segment as perceptible event
4. "Stop movie" action removes listener

**Pros:**
- No turn system modifications
- Event-driven design
- TV doesn't need to be an actor

**Cons:**
- Listener management complexity
- Less visible in turn order
- Harder to coordinate with other actions
- Doesn't generalize to other use cases

#### Approach 4: Passive Actor Type

**Hybrid of Approaches 1 & 2**

Add `passive` player type + behavior components:
- `passive` type indicates non-interactive actor
- Behavior component determines specific behavior
- Decision provider checks for behavior component
- Falls back to skip turn if no behavior

**Pros:**
- Clear semantic meaning (passive vs active)
- Extensible via behavior components
- Player type still meaningful for filtering/UI

**Cons:**
- Still requires player type enum update
- Adds another player type (enum grows)

### 3.3 Recommended Approach

**Hybrid: Approach 2 + Minimal Approach 1**

**Phase 1 (Immediate):**
- Add `simple_ai` to player_type enum for semantic clarity
- Create SimpleAIDecisionProvider that checks for behavior components
- If no behavior component, skip turn or execute default output

**Phase 2 (Refactoring):**
- Implement behavior component system
- Refactor GenericTurnStrategy to check behavior components
- Migrate simple AI to use behavior components
- Keep `simple_ai` type for UI/filtering purposes

**Rationale:**
- Phase 1 gets functionality working quickly
- Phase 2 makes architecture more maintainable
- Incremental approach reduces risk
- Backward compatible

---

## 4. Integration Pain Points and Challenges

### 4.1 Tight Coupling: Player Type → Decision Provider

**Issue:** Adding new player type requires changes in multiple locations

**Affected Files:**
1. `data/mods/core/components/player_type.component.json` - Schema enum
2. `src/turns/factories/actorAwareStrategyFactory.js` - Provider resolver
3. `src/utils/actorTypeUtils.js` - Type detection utilities
4. `src/turns/turnManager.js` - Event type mapping
5. `src/domUI/processingIndicatorController.js` - UI logic
6. `src/dependencyInjection/registrations/*.js` - Provider registration
7. Test files across unit/integration/e2e

**Impact:** High maintenance burden, poor extensibility

**Root Cause:** Direct coupling instead of configuration-driven selection

### 4.2 Action Selection Assumption

**Issue:** All decision providers assume action selection model

**Current Flow:**
```
GenericTurnStrategy.decideAction()
    ↓
choicePipeline.buildChoices() → [action1, action2, ...]
    ↓
decisionProvider.decide() → { chosenIndex: N }
    ↓
turnActionFactory.create(actions[N-1])
```

**Problem for Simple AI:**
- TV doesn't need action choices
- Scripted output doesn't fit selection model
- Forces creation of dummy actions
- Adds unnecessary complexity

**Workarounds:**
1. Create single "output" action for simple AI
2. Hardcode chosenIndex: 1 in SimpleAIDecisionProvider
3. Skip action validation/execution

**Better Solution:** Support multiple turn execution paths

### 4.3 Hardcoded Type Enumeration

**Issue:** JSON Schema enum requires modification for new types

**Current:**
```json
"enum": ["human", "llm", "goap"]
```

**Problems:**
- Can't add types without schema change
- Mods can't extend player types
- Validation fails for unknown types
- No dynamic registration

**Alternative Approaches:**
1. **String type without enum** - Loses validation
2. **anyOf with additional types** - Complex but extensible
3. **Separate behavior component** - Types as configuration

### 4.4 No Passive Behavior Support

**Issue:** System assumes all actors make decisions

**Current Design:**
- All actors must participate in action selection
- No concept of "skip turn" or "automatic behavior"
- Passive outputs must masquerade as actions

**Use Cases Blocked:**
- Environmental entities (weather, time passage)
- Scripted NPCs with predetermined behavior
- Status effect entities (ongoing damage, buffs)
- Ambient storytelling entities (TV, radio, background events)

**Requirements for Support:**
1. Decision providers that skip action selection
2. Direct perceptible event dispatch
3. Component-driven behavior specification
4. Turn completion without action execution

### 4.5 Multiple Modification Points

**Issue:** Adding player type requires coordinated changes

**Modification Map:**
```
Schema → Factory → Utils → Manager → UI → DI → Tests
   ↓        ↓        ↓        ↓       ↓     ↓      ↓
  [1]      [2]      [3]      [4]    [5]   [6]   [7+]
```

**Risk Factors:**
- Easy to miss modification points
- Inconsistent behavior if any point skipped
- High testing burden (regression across all systems)
- Merge conflicts in multi-developer scenarios

**Mitigation Strategies:**
1. Checklist documentation
2. Code generation for boilerplate
3. Centralized configuration
4. Convention over configuration

---

## 5. Refactoring Recommendations

### 5.1 Decouple Behavior from Player Type

**Current:** Player type determines decision provider selection

**Recommended:** Behavior component determines turn behavior

**Implementation:**

```json
// core:turn_behavior.component.json
{
  "id": "core:turn_behavior",
  "dataSchema": {
    "type": "object",
    "properties": {
      "type": {
        "type": "string",
        "enum": ["action_selection", "scripted", "passive", "event_driven"]
      },
      "config": {
        "type": "object",
        "description": "Behavior-specific configuration"
      }
    }
  }
}
```

**Decision Flow:**
```javascript
// Modified ActorAwareStrategyFactory
create(actorId) {
  const actor = this.#actorLookup(actorId);

  // 1. Check for behavior component
  if (actor.hasComponent('core:turn_behavior')) {
    const behavior = actor.getComponentData('core:turn_behavior');
    return this.#behaviorFactory.create(behavior.type, behavior.config);
  }

  // 2. Fall back to player type
  const playerType = this.#providerResolver(actor);
  return this.#providers[playerType];
}
```

**Benefits:**
- Player type remains for UI/filtering
- Behavior is configurable per-entity
- No hardcoded coupling
- Extensible by mods

### 5.2 Strategy Pattern for Turn Behavior

**Current:** Single GenericTurnStrategy for all actors

**Recommended:** ITurnBehavior interface with multiple implementations

**Interface Definition:**
```javascript
/**
 * @interface ITurnBehavior
 */
class ITurnBehavior {
  /**
   * Execute turn behavior for actor
   * @param {Entity} actor
   * @param {ITurnContext} context
   * @returns {Promise<ITurnResult>}
   */
  async executeTurn(actor, context) {}
}
```

**Implementations:**

1. **ActionSelectionBehavior** - Current logic
   ```javascript
   class ActionSelectionBehavior {
     async executeTurn(actor, context) {
       const actions = await this.#choicePipeline.buildChoices(actor, context);
       const meta = await this.#decisionProvider.decide(actor, context, actions);
       return this.#createTurnAction(actions[meta.chosenIndex - 1], meta);
     }
   }
   ```

2. **ScriptedBehavior** - Simple AI
   ```javascript
   class ScriptedBehavior {
     async executeTurn(actor, context) {
       const script = actor.getComponentData('core:scripted_behavior');
       const entry = script.entries[script.current_index];

       await context.dispatchPerceptibleEvent({
         description: entry.text,
         type: entry.perceptionType
       });

       this.#advanceScript(actor, script);
       return { kind: 'scripted', completed: true };
     }
   }
   ```

3. **PassiveBehavior** - No action
   ```javascript
   class PassiveBehavior {
     async executeTurn(actor, context) {
       // Skip turn, no output
       return { kind: 'passive', completed: true };
     }
   }
   ```

**Modified GenericTurnStrategy:**
```javascript
class GenericTurnStrategy {
  async decideAction(context) {
    const actor = context.getActor();
    const behavior = this.#resolveBehavior(actor);
    return await behavior.executeTurn(actor, context);
  }

  #resolveBehavior(actor) {
    if (actor.hasComponent('core:turn_behavior')) {
      return this.#behaviorFactory.create(
        actor.getComponentData('core:turn_behavior')
      );
    }
    return this.#defaultBehavior; // Action selection
  }
}
```

**Benefits:**
- Open/Closed Principle (open for extension)
- Single Responsibility (each behavior isolated)
- Easy to test behaviors independently
- Mods can add custom behaviors

### 5.3 Component-Based Behavior Configuration

**Current:** Hardcoded player type enum

**Recommended:** Flexible behavior configuration via components

**Example Configurations:**

```javascript
// Human actor with action selection
{
  "core:player_type": { "type": "human" },
  "core:turn_behavior": {
    "type": "action_selection",
    "config": {
      "provider": "prompt_coordinator",
      "timeout": 0  // No timeout for humans
    }
  }
}

// LLM actor with AI decision
{
  "core:player_type": { "type": "llm" },
  "core:turn_behavior": {
    "type": "action_selection",
    "config": {
      "provider": "llm_chooser",
      "timeout": 30000
    }
  }
}

// TV with scripted behavior
{
  "core:player_type": { "type": "simple_ai" },
  "core:turn_behavior": {
    "type": "scripted",
    "config": {
      "source_component": "movie_playback",
      "output_target": "perception_log",
      "auto_advance": true,
      "loop": false
    }
  },
  "movie_playback": {
    "entries": [
      { "text": "The movie starts...", "perceptionType": "visual" },
      { "text": "Two leads drive...", "perceptionType": "visual" }
    ],
    "current_index": 0
  }
}
```

**Benefits:**
- Data-driven configuration
- No code changes for new behavior types
- Easy to serialize/deserialize
- Mod-friendly

### 5.4 Factory Pattern for Decision Providers

**Current:** Manual provider registration in DI container

**Recommended:** Auto-registration via factory pattern

**Implementation:**

```javascript
/**
 * Registry for turn behavior implementations
 */
class TurnBehaviorRegistry {
  #behaviors = new Map();

  register(type, behaviorClass) {
    this.#behaviors.set(type, behaviorClass);
  }

  create(type, config) {
    const BehaviorClass = this.#behaviors.get(type);
    if (!BehaviorClass) {
      throw new Error(`Unknown behavior type: ${type}`);
    }
    return new BehaviorClass(config);
  }

  getSupportedTypes() {
    return Array.from(this.#behaviors.keys());
  }
}

// In mod initialization
registry.register('action_selection', ActionSelectionBehavior);
registry.register('scripted', ScriptedBehavior);
registry.register('passive', PassiveBehavior);

// Mods can add their own
registry.register('reactive', ReactiveNPCBehavior);  // Custom mod behavior
```

**Benefits:**
- Dynamic behavior registration
- Mods can extend without core changes
- Discoverable (list available types)
- Dependency injection friendly

### 5.5 Abstract Action Concepts

**Current:** Actions are always user-selectable choices

**Recommended:** Support automatic/passive actions

**Action Types:**

1. **Selectable Actions** - Current behavior
   ```json
   {
     "id": "core:attack",
     "selectable": true,
     "requires_choice": true
   }
   ```

2. **Automatic Actions** - No selection needed
   ```json
   {
     "id": "core:scripted_output",
     "selectable": false,
     "requires_choice": false,
     "auto_execute": true
   }
   ```

3. **Passive Outputs** - Not actions, just events
   ```json
   {
     "id": "core:ambient_event",
     "is_action": false,
     "dispatch_only": true
   }
   ```

**Modified Action Execution:**
```javascript
if (action.auto_execute) {
  // Skip decision, execute directly
  await this.#executeAction(action, context);
} else if (action.dispatch_only) {
  // Skip action system, dispatch event
  await this.#dispatchEvent(action, context);
} else {
  // Normal action selection
  const choice = await this.#decisionProvider.decide(...);
  await this.#executeAction(actions[choice], context);
}
```

### 5.6 Backward Compatibility Strategy

**Maintain Legacy Support While Refactoring:**

1. **Phase 1: Add new system alongside old**
   - Implement behavior component system
   - Keep player_type logic intact
   - New logic checks behavior component first, falls back to player_type

2. **Phase 2: Migration period**
   - Deprecate player_type-based routing (warnings in logs)
   - Provide migration tools/scripts
   - Update documentation with migration guide

3. **Phase 3: Remove legacy**
   - After 2-3 release cycles, remove player_type routing
   - Keep player_type component for UI/filtering only
   - Clean up deprecated code

**Migration Helper:**
```javascript
function migratePlayerTypeToBehavior(entity) {
  if (entity.hasComponent('core:turn_behavior')) {
    return; // Already migrated
  }

  const playerType = entity.getComponentData('core:player_type')?.type;
  const behaviorConfig = {
    'human': { type: 'action_selection', config: { provider: 'human' } },
    'llm': { type: 'action_selection', config: { provider: 'llm' } },
    'goap': { type: 'action_selection', config: { provider: 'goap' } },
    'simple_ai': { type: 'scripted', config: { /* ... */ } }
  }[playerType];

  entity.addComponent('core:turn_behavior', behaviorConfig);
}
```

---

## 6. Implementation Roadmap

### Phase 1: Minimal Integration (1-2 days)

**Goal:** Get simple AI working with minimal changes

**Tasks:**
1. Update `player_type.component.json` - Add "simple_ai" to enum
2. Create `src/turns/providers/simpleAIDecisionProvider.js`
3. Create `data/mods/core/components/scripted_behavior.component.json`
4. Register SimpleAIDecisionProvider in `actorAwareStrategyFactory.js`
5. Update `actorTypeUtils.js` - Handle 'simple_ai' type
6. Update `turnManager.js` - Event type mapping
7. Create unit tests for SimpleAIDecisionProvider
8. Create integration test for TV use case

**Deliverables:**
- Working simple AI implementation
- TV can output scripted movie narrative
- Tests pass with new type

**Risks:**
- Still uses action selection pipeline (workaround needed)
- Not extensible for other behavior types

### Phase 2: Behavior Component Architecture (1 week)

**Goal:** Implement flexible behavior system

**Tasks:**
1. Design `turn_behavior.component.json` schema
2. Create `ITurnBehavior` interface
3. Implement behavior classes:
   - ActionSelectionBehavior
   - ScriptedBehavior
   - PassiveBehavior
4. Create `TurnBehaviorRegistry` and factory
5. Refactor `GenericTurnStrategy` to use behaviors
6. Migrate SimpleAIDecisionProvider to ScriptedBehavior
7. Update tests to cover new architecture
8. Write migration guide for existing actors

**Deliverables:**
- Behavior component system operational
- Simple AI uses scripted behavior (not decision provider hack)
- Documentation for adding custom behaviors

**Risks:**
- Larger refactoring may introduce regressions
- Need comprehensive testing

### Phase 3: Full Decoupling and Extensibility (2 weeks)

**Goal:** Make system truly extensible for mods

**Tasks:**
1. Implement dynamic behavior registration
2. Add mod hook for behavior registration
3. Create behavior configuration validator
4. Refactor player_type to UI-only concern
5. Update all affected systems to use behaviors
6. Deprecate old player_type routing (with warnings)
7. Create comprehensive test suite
8. Update documentation with architectural diagrams
9. Create example mods demonstrating custom behaviors

**Deliverables:**
- Fully decoupled architecture
- Mods can add behaviors without core changes
- Deprecated legacy system with migration path
- Complete documentation

**Risks:**
- Backward compatibility concerns
- Community adoption of new patterns

### Testing Strategy

**Phase 1 Tests:**
- Unit: SimpleAIDecisionProvider logic
- Integration: TV entity in turn system
- E2E: Full movie playback scenario

**Phase 2 Tests:**
- Unit: Each behavior class independently
- Integration: Behavior selection and execution
- Integration: Migration from Phase 1 to Phase 2
- Regression: Existing player types still work

**Phase 3 Tests:**
- Unit: Behavior registry and factory
- Integration: Mod-added custom behaviors
- Integration: Dynamic behavior registration
- Performance: Overhead of new architecture
- E2E: Complex multi-behavior scenarios

---

## 7. Conclusion

### Summary of Analysis

The Living Narrative Engine's player type system is functional but tightly coupled, making it challenging to add new actor behaviors without extensive code modifications. The current architecture assumes all actors participate in action selection, which doesn't fit passive or scripted entities like the proposed TV use case.

### Integration Feasibility

Adding a simple AI type is **highly feasible** but requires careful architectural consideration:

- **Short-term:** Add `simple_ai` to enum with dedicated provider (~2 days)
- **Medium-term:** Implement behavior component system (~1 week)
- **Long-term:** Full architectural decoupling (~2 weeks)

### Key Recommendations

1. **Immediate:** Implement Phase 1 (minimal integration) to unblock TV functionality
2. **Strategic:** Commit to Phase 2 (behavior architecture) for long-term maintainability
3. **Aspirational:** Plan Phase 3 (full extensibility) for mod ecosystem growth

### Expected Outcomes

**After Phase 1:**
- TV entities can output scripted movie narratives
- System works but is not elegant

**After Phase 2:**
- Clean separation of behavior from player type
- Easy to add new behavior types
- Reduced code coupling

**After Phase 3:**
- Mods can add custom behaviors without core changes
- Player type becomes UI/filtering concern only
- Highly maintainable and extensible architecture

### Final Thoughts

The proposed refactoring aligns with SOLID principles and the "modding-first" philosophy of the Living Narrative Engine. While the immediate need (TV entity) can be satisfied with minimal changes, investing in the architectural improvements will pay dividends as the project grows and the modding community expands.

The behavior component system represents a paradigm shift from "type-based routing" to "behavior-based execution," making the engine more flexible and powerful for game designers and mod creators.

---

## Appendix A: Files Requiring Modification

### For Phase 1 (Minimal Integration)

1. `data/mods/core/components/player_type.component.json` - Add enum value
2. `src/turns/providers/simpleAIDecisionProvider.js` - NEW FILE
3. `data/mods/core/components/scripted_behavior.component.json` - NEW FILE
4. `src/turns/factories/actorAwareStrategyFactory.js` - Add provider
5. `src/utils/actorTypeUtils.js` - Handle new type
6. `src/turns/turnManager.js` - Event mapping
7. `src/dependencyInjection/registrations/turnLifecycleRegistrations.js` - Register provider
8. `tests/unit/turns/providers/simpleAIDecisionProvider.test.js` - NEW FILE
9. `tests/integration/turns/simpleAITurnExecution.test.js` - NEW FILE

### For Phase 2 (Behavior Architecture)

10. `data/mods/core/components/turn_behavior.component.json` - NEW FILE
11. `src/turns/interfaces/ITurnBehavior.js` - NEW FILE
12. `src/turns/behaviors/actionSelectionBehavior.js` - NEW FILE
13. `src/turns/behaviors/scriptedBehavior.js` - NEW FILE
14. `src/turns/behaviors/passiveBehavior.js` - NEW FILE
15. `src/turns/factories/turnBehaviorFactory.js` - NEW FILE
16. `src/turns/strategies/genericTurnStrategy.js` - REFACTOR
17. Multiple test files for new behaviors

### For Phase 3 (Full Decoupling)

18. `src/turns/registry/turnBehaviorRegistry.js` - NEW FILE
19. `src/modding/hooks/behaviorRegistrationHook.js` - NEW FILE
20. Migration scripts and documentation
21. Comprehensive test updates

---

## Appendix B: Code Examples

### Example 1: Simple AI Provider (Phase 1)

```javascript
// src/turns/providers/simpleAIDecisionProvider.js

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

export class SimpleAIDecisionProvider extends DelegatingDecisionProvider {
  constructor({ logger, safeEventDispatcher, operationInterpreter }) {
    validateDependency(operationInterpreter, 'operationInterpreter', logger, {
      requiredMethods: ['execute']
    });

    const delegate = async (actor, context, actions, abortSignal) => {
      // Check for scripted behavior component
      if (!actor.hasComponent('core:scripted_behavior')) {
        throw new Error(`Simple AI actor ${actor.id} missing scripted_behavior component`);
      }

      const script = actor.getComponentData('core:scripted_behavior');
      const entry = script.entries[script.current_index];

      if (!entry) {
        // Script exhausted, skip turn
        return { index: 0, speech: null, thoughts: null, notes: null };
      }

      // Dispatch perceptible event
      await operationInterpreter.execute('DISPATCH_PERCEPTIBLE_EVENT', {
        location_id: actor.getComponentData('core:location').locationId,
        description_text: entry.text,
        perception_type: entry.perceptionType || 'visual',
        actor_id: actor.id,
        log_entry: true
      });

      // Advance script index
      if (script.auto_advance !== false) {
        const newIndex = script.loop
          ? (script.current_index + 1) % script.entries.length
          : Math.min(script.current_index + 1, script.entries.length - 1);

        actor.mutateComponent('core:scripted_behavior', {
          current_index: newIndex
        });
      }

      // Return dummy choice (no actual action selection)
      return {
        index: 1,
        speech: null,
        thoughts: null,
        notes: null
      };
    };

    super({ delegate, logger, safeEventDispatcher });
  }
}
```

### Example 2: Scripted Behavior (Phase 2)

```javascript
// src/turns/behaviors/scriptedBehavior.js

export class ScriptedBehavior {
  #logger;
  #operationInterpreter;

  constructor({ logger, operationInterpreter }) {
    this.#logger = logger;
    this.#operationInterpreter = operationInterpreter;
  }

  async executeTurn(actor, context) {
    this.#logger.debug(`Executing scripted behavior for ${actor.id}`);

    const script = actor.getComponentData('core:scripted_behavior');
    if (!script || !script.entries || script.entries.length === 0) {
      this.#logger.warn(`Actor ${actor.id} has no script entries`);
      return { kind: 'scripted', completed: true, skipped: true };
    }

    const entry = script.entries[script.current_index];
    if (!entry) {
      this.#logger.warn(`Script index out of bounds for ${actor.id}`);
      return { kind: 'scripted', completed: true, exhausted: true };
    }

    // Output narrative
    await this.#operationInterpreter.execute('DISPATCH_PERCEPTIBLE_EVENT', {
      location_id: actor.getComponentData('core:location').locationId,
      description_text: entry.text,
      perception_type: entry.perceptionType || 'visual',
      actor_id: actor.id,
      log_entry: true
    });

    // Advance script
    this.#advanceScript(actor, script);

    return {
      kind: 'scripted',
      completed: true,
      output: entry.text
    };
  }

  #advanceScript(actor, script) {
    if (script.auto_advance === false) return;

    let newIndex;
    if (script.loop) {
      newIndex = (script.current_index + 1) % script.entries.length;
    } else {
      newIndex = Math.min(
        script.current_index + 1,
        script.entries.length - 1
      );
    }

    actor.mutateComponent('core:scripted_behavior', {
      current_index: newIndex
    });

    this.#logger.debug(
      `Advanced script for ${actor.id}: ${script.current_index} → ${newIndex}`
    );
  }
}
```

### Example 3: TV Entity Definition

```json
{
  "id": "living_room_tv",
  "components": {
    "core:actor": {},
    "core:player_type": {
      "type": "simple_ai"
    },
    "core:turn_behavior": {
      "type": "scripted",
      "config": {
        "source_component": "movie_playback",
        "output_target": "perception_log"
      }
    },
    "core:location": {
      "locationId": "living_room"
    },
    "core:scripted_behavior": {
      "entries": [
        {
          "text": "The movie starts with a fade to black and orchestral music swelling dramatically.",
          "perceptionType": "audiovisual",
          "duration": 1
        },
        {
          "text": "The two main leads are driving up a long, winding mountain road as sunset paints the sky orange.",
          "perceptionType": "visual",
          "duration": 1
        },
        {
          "text": "A tense conversation unfolds between the characters, revealing a dark secret from the past.",
          "perceptionType": "audiovisual",
          "duration": 1
        }
      ],
      "current_index": 0,
      "loop": false,
      "auto_advance": true
    }
  }
}
```

---

**End of Analysis Report**
