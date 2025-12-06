# Component Invalidation System - Brainstorming Document

**Date**: 2025-11-08
**Context**: Discovered scenario where actor A has illogical action options when actor B has incompatible component states
**Status**: Analysis & Design Exploration

---

## 🎯 Problem Statement

### The Discovered Scenario

While playtesting in `game.html`, the following situation revealed a gap in the component management system:

**Setup**:

- Actor A is standing behind Actor B
- Actor B has two components:
  - `facing_away.component.json` (facing away from Actor A)
  - `bending_over.component.json` (bent over)

**Problem**:
Actor A sees these available actions:

- `bend_over.action.json` ❌ (illogical - Actor B is already bending over in front of them)
- `lie_down.action.json` ❌ (illogical - Actor B is bending over, this breaks the spatial context)
- `step_back.action.json` ✅ (this makes sense)

**Root Cause**:
These actions don't have a `target` parameter, so they cannot check target state. The system allows Actor A to choose actions that don't make sense given Actor B's current state.

**Key Insight**:
When Actor B straightens up or changes position, the `facing_away` component becomes contextually invalid but remains on the entity. This creates a desynchronization between actual game state and component state.

---

## 🏗️ Current Architecture Analysis

### Component Lifecycle System

The Living Narrative Engine uses a centralized **ComponentMutationService** for all component operations:

**Adding Components**:

```javascript
addComponent(instanceId, componentTypeId, componentData)
  → Validates against schema
  → Adds to entity
  → Updates component index
  → Dispatches 'core:component_added' event
```

**Removing Components**:

```javascript
removeComponent(instanceId, componentTypeId)
  → Validates entity exists
  → Captures oldComponentData
  → Removes component
  → Updates component index
  → Dispatches 'core:component_removed' event
```

**Key Feature**: The `core:component_removed` event includes the full `oldComponentData`, providing complete context about what was removed.

### Event-Driven Architecture

The **EventBus** is the central communication hub:

- Subscribers can listen to component lifecycle events
- Multiple systems already use this pattern:
  - `SpatialIndexSynchronizer`: Updates spatial index on component changes
  - `AnatomyCacheCoordinator`: Invalidates caches when components change
  - `EntityLifecycleMonitor`: UI monitoring

**Event Flow Pattern**:

```
Action → REMOVE_COMPONENT operation →
ComponentMutationService.removeComponent() →
EventBus.dispatch('core:component_removed') →
All Subscribers React
```

### Component Relationship Examples

**facing_away Component** (`positioning:facing_away`):

```json
{
  "facing_away_from": ["entity_id_1", "entity_id_2"],
  "description": "Array of entity IDs this actor is facing away from"
}
```

**bending_over Component** (`positioning:bending_over`):

```json
{
  "surface_id": "entity_id",
  "activityMetadata": {
    "template": "{actor} is bending over {target}",
    "priority": 68
  }
}
```

### Action Discovery & Filtering

The **ActionPipelineOrchestrator** coordinates action discovery through stages:

1. **Target Resolution**: Resolves scope queries for targets
2. **Component Validation**: Checks `required_components` and `forbidden_components`
3. **Prerequisite Evaluation**: Evaluates JSON Logic conditions
4. **Multi-Target Support**: Handles batch operations

**Current Prevention Pattern**:

```json
{
  "required_components": {
    "actor": ["positioning:bending_over"]
  },
  "forbidden_components": {
    "actor": ["positioning:sitting_on", "positioning:kneeling_before"]
  }
}
```

---

## 💡 Proposed Solutions

### Solution A: Event-Driven Component Invalidation (Recommended)

**Core Concept**: Use the existing event system to automatically clean up components that become invalid when other components are removed.

#### How It Works

1. Create invalidation rules that subscribe to `core:component_removed` events
2. When a component is removed, check if other components should be invalidated
3. Remove invalidated components, triggering cascading events
4. EventBus recursion protection prevents infinite loops

#### Example Rule Structure

```json
{
  "rule_id": "positioning:invalidate_facing_away_on_state_change",
  "event_type": "core:component_removed",
  "condition": {
    "or": [
      {
        "==": [
          { "var": "event.payload.componentTypeId" },
          "positioning:bending_over"
        ]
      },
      {
        "==": [
          { "var": "event.payload.componentTypeId" },
          "positioning:lying_down"
        ]
      }
    ]
  },
  "actions": [
    {
      "comment": "When someone stops bending over or lying down, others facing away from them should have that state invalidated",
      "type": "INVALIDATE_FACING_AWAY_REFERENCES",
      "parameters": {
        "entity_id": { "var": "event.payload.entity.id" },
        "removed_component": { "var": "event.payload.componentTypeId" }
      }
    }
  ]
}
```

#### Specific Scenario Resolution

For the discovered scenario:

1. Actor B straightens up: `REMOVE_COMPONENT(actor_b, "positioning:bending_over")`
2. Event dispatched: `core:component_removed` with `oldComponentData`
3. Invalidation rule triggers
4. Checks all entities with `facing_away` components referencing Actor B
5. Removes `facing_away` components that referenced Actor B during bending

#### Architectural Alignment

✅ **Strong Alignment**:

- Uses existing event infrastructure
- Follows pattern of `SpatialIndexSynchronizer` and `AnatomyCacheCoordinator`
- Maintains ECS principles (decoupled, event-driven)
- Declarative relationship definitions

✅ **Advantages**:

- **Separation of Concerns**: Component relationships separate from actions
- **Maintainability**: Add rules without modifying actions
- **Reusability**: Works for any component removal scenario
- **Automatic**: No manual intervention required
- **Testable**: Rules can be tested independently
- **Performance**: EventBus already optimized with batching

⚠️ **Considerations**:

- Need `REMOVE_COMPONENT_IF_EXISTS` operation (idempotent version)
- EventBus has recursion depth limits (configurable, currently robust)
- Component dependency relationships need documentation
- Cascading removals need careful testing

---

### Solution B: Prerequisite-Based Prevention

**Core Concept**: Use action prerequisites to prevent actions when component states conflict.

#### How It Works

1. Add prerequisites to actions that check for incompatible component states
2. When prerequisites fail, actions become unavailable
3. Provide clear error messages to guide user
4. User must manually resolve conflicts

#### Example Implementation

```json
{
  "id": "positioning:bend_over",
  "prerequisites": [
    {
      "condition": {
        "none": {
          "filter": [
            { "var": "context.nearby_actors" },
            {
              "and": [
                {
                  "in": [
                    { "var": "id" },
                    { "var": "context.actor.facing_away_from" }
                  ]
                },
                { "has": [{ "var": "" }, "positioning:bending_over"] }
              ]
            }
          ]
        }
      },
      "errorMessage": "Cannot bend over when someone you're facing away from is already bending over."
    }
  ]
}
```

#### Architectural Alignment

⚠️ **Partial Alignment**:

- Uses existing prerequisite system
- Doesn't leverage event-driven architecture for cleanup
- Requires modifying every potentially conflicting action

❌ **Disadvantages**:

- **Manual Intervention**: User must explicitly fix conflicts
- **Repetitive**: Must add to every relevant action
- **Fragile**: Easy to miss action combinations
- **Maintenance Burden**: New components require updating many actions
- **User Experience**: Blocked actions without automatic resolution

✅ **Advantages**:

- **Explicit Feedback**: User knows why actions are blocked
- **Predictable**: No automatic state changes
- **No Cascading**: Simpler reasoning about state

---

### Solution C: Hybrid Approach (Most Comprehensive)

**Core Concept**: Combine event-driven invalidation with prerequisite blocking for a layered defense.

#### Three-Tier Strategy

**Tier 1: Automatic Invalidation** (Event-Driven)

- For logically incompatible components that should never coexist
- Example: `facing_away` from someone who is `bending_over`
- Implementation: Event-driven rules with `core:component_removed`

**Tier 2: Prerequisite Blocking** (Action-Level)

- For contextual restrictions requiring user awareness
- Example: Cannot start bending over if already sitting
- Implementation: `forbidden_components` with clear error messages

**Tier 3: Explicit Cleanup** (Rule-Level)

- For intentional state transitions
- Example: `straighten_up` explicitly removes `bending_over`
- Implementation: Current pattern with `REMOVE_COMPONENT` in rules

#### Example Architecture

```
Component Removal → Event → Invalidation Rules → Cascade Cleanup
                                                         ↓
Action Discovery → Prerequisites Check → Available Actions
                                               ↓
User Selection → Rule Execution → Explicit Cleanup → New State
```

#### Benefits

- **Defense in Depth**: Multiple layers prevent invalid states
- **User Agency**: Clear why actions are blocked
- **Automatic Cleanup**: System maintains consistency
- **Flexible**: Can tune which tier handles each scenario

---

## 🔍 Implementation Considerations

### Required Changes

#### 1. New Operation: REMOVE_COMPONENT_IF_EXISTS

**Purpose**: Idempotent component removal for cleanup scenarios

**Behavior**:

- Remove component if it exists
- No warnings/errors if component doesn't exist
- Still dispatches `core:component_removed` event if removed
- Useful for cleanup rules where component may already be gone

**Handler**: `src/logic/operationHandlers/removeComponentIfExistsHandler.js`

```javascript
class RemoveComponentIfExistsHandler extends BaseOperationHandler {
  async execute(context) {
    const { entity_ref, component_type } = this.parameters;
    const entity = this.#resolveEntity(context, entity_ref);

    if (entity.components[component_type]) {
      await this.#componentMutationService.removeComponent(
        entity.id,
        component_type
      );
    }
    // Silent if component doesn't exist
  }
}
```

#### 2. Invalidation Rule Structure

**Location**: `data/mods/positioning/rules/component_invalidation.rule.json`

**Pattern**:

```json
{
  "rule_id": "positioning:component_invalidation",
  "event_type": "core:component_removed",
  "condition": {
    "in": [
      { "var": "event.payload.componentTypeId" },
      [
        "positioning:bending_over",
        "positioning:lying_down",
        "positioning:sitting_on"
      ]
    ]
  },
  "actions": [
    {
      "type": "INVALIDATE_DEPENDENT_COMPONENTS",
      "parameters": {
        "entity_id": { "var": "event.payload.entity.id" },
        "removed_component": { "var": "event.payload.componentTypeId" },
        "invalidation_rules": {
          "positioning:bending_over": {
            "remove_from_others": [
              {
                "component": "positioning:facing_away",
                "where": {
                  "contains": ["facing_away_from", { "var": "entity_id" }]
                }
              }
            ]
          }
        }
      }
    }
  ]
}
```

#### 3. Component Dependency Documentation

**Location**: `docs/architecture/component-dependencies.md`

**Content**:

- Graph of component relationships
- Which components invalidate others
- Rationale for each invalidation
- Expected cascading behavior
- Edge cases and special handling

### Recursion Protection

**Already Exists**: EventBus has built-in recursion detection

- Maximum depth: Configurable (default handles complex scenarios)
- Cycle detection: Prevents infinite loops
- Batch processing: Optimizes event dispatching

**Testing Strategy**:

- Test single-level invalidation
- Test cascading chains (A → B → C)
- Test circular dependencies (should be blocked by design)
- Verify recursion limits work correctly

### Performance Considerations

**Event Dispatching**:

- Already optimized with batching
- Component removal is infrequent (not a hot path)
- Invalidation adds negligible overhead

**Component Queries**:

- Need efficient lookup of entities with specific components
- Component index already supports this
- May need optimization for large entity counts

---

## 📊 Solution Comparison Matrix

| Criteria                      | Event-Driven (A) | Prerequisites (B) | Hybrid (C)   |
| ----------------------------- | ---------------- | ----------------- | ------------ |
| **Architecture Alignment**    | ✅ Excellent     | ⚠️ Partial        | ✅ Excellent |
| **Maintenance**               | ✅ Low           | ❌ High           | ⚠️ Medium    |
| **User Experience**           | ✅ Automatic     | ❌ Manual         | ✅ Balanced  |
| **Implementation Complexity** | ⚠️ Medium        | ✅ Low            | ❌ High      |
| **Flexibility**               | ✅ High          | ⚠️ Medium         | ✅ Very High |
| **Testability**               | ✅ Excellent     | ✅ Good           | ✅ Excellent |
| **Performance**               | ✅ Good          | ✅ Excellent      | ✅ Good      |
| **Predictability**            | ⚠️ Cascading     | ✅ Explicit       | ⚠️ Layered   |

---

## 🎯 Recommended Approach

### Primary Recommendation: Solution A (Event-Driven)

**Why**:

1. **Best Architectural Fit**: Leverages existing event system patterns
2. **Maintenance**: Add rules without touching actions
3. **User Experience**: Automatic cleanup, no manual intervention
4. **Extensibility**: Easy to add new component relationships

**Implementation Path**:

1. Create `REMOVE_COMPONENT_IF_EXISTS` operation
2. Define component dependency rules
3. Implement invalidation logic in rules
4. Add comprehensive tests
5. Document component relationships

**Incremental Rollout**:

- Phase 1: Handle `facing_away` + `bending_over` scenario
- Phase 2: Add other positioning component relationships
- Phase 3: Extend to other mod categories
- Phase 4: Generalize pattern for all mods

### Alternative: Solution C (Hybrid)

**When to use**: If you want maximum control and explicit user feedback

**Trade-off**: More complex implementation but more predictable behavior

---

## 🔬 Concrete Example: Resolving the Discovered Scenario

### Current State (Problem)

```
Actor A (standing, behind Actor B)
Actor B:
  - positioning:facing_away (facing away from Actor A)
  - positioning:bending_over (bending over something)

Actor A's Available Actions:
  ❌ bend_over (illogical)
  ❌ lie_down (illogical)
  ✅ step_back (makes sense)
```

### Solution A: Event-Driven Resolution

**Step 1**: Actor B straightens up

```javascript
// User selects "straighten_up" action for Actor B
executeAction("positioning:straighten_up", actor_b_id)
  → Rule executes REMOVE_COMPONENT(actor_b, "positioning:bending_over")
  → EventBus.dispatch("core:component_removed", {
      entity: actor_b,
      componentTypeId: "positioning:bending_over",
      oldComponentData: { surface_id: "...", activityMetadata: {...} }
    })
```

**Step 2**: Invalidation rule triggers

```javascript
// Rule: positioning:component_invalidation
// Condition: event.payload.componentTypeId == "positioning:bending_over"
// Action: INVALIDATE_FACING_AWAY_REFERENCES

→ Query all entities with "positioning:facing_away"
→ Filter to those with actor_b in "facing_away_from" array
→ Remove "positioning:facing_away" from Actor A
→ EventBus.dispatch("core:component_removed", {
    entity: actor_a,
    componentTypeId: "positioning:facing_away",
    oldComponentData: { facing_away_from: [actor_b_id] }
  })
```

**Step 3**: Final state

```
Actor A (standing, no facing_away component)
Actor B (standing, no bending_over component)

Actor A's Available Actions:
  ✅ bend_over (now logical)
  ✅ lie_down (now logical)
  ✅ step_back (still makes sense)
  ✅ turn_to_face (now available)
```

### Solution B: Prerequisite Resolution

**Step 1**: Add prerequisites to prevent illogical actions

```json
{
  "id": "positioning:bend_over",
  "prerequisites": [
    {
      "condition": {
        "none": {
          "filter": [
            { "var": "nearby_actors" },
            {
              "and": [
                {
                  "in": [{ "var": "id" }, { "var": "actor.facing_away_from" }]
                },
                { "has": [{ "var": "" }, "positioning:bending_over"] }
              ]
            }
          ]
        }
      },
      "errorMessage": "Cannot bend over while facing away from someone who is bending over."
    }
  ]
}
```

**Step 2**: User sees blocked actions

```
Actor A's Available Actions:
  ❌ bend_over (blocked: "Cannot bend over while facing away...")
  ❌ lie_down (blocked: "Cannot lie down while facing away...")
  ✅ step_back
  ✅ turn_to_face
```

**Step 3**: User must manually resolve

```
User must:
1. Select "turn_to_face" to remove facing_away
   OR
2. Wait for Actor B to straighten up
   OR
3. Select "step_back" to change position

Then bend_over becomes available
```

---

## 🚀 Next Steps & Open Questions

### Questions for Decision-Making

1. **Philosophy**: Should the system automatically fix invalid states, or require user intervention?
   - Auto-fix: Better UX, less predictable
   - User intervention: More control, more friction

2. **Scope**: Which component relationships need invalidation?
   - Start with positioning only?
   - Extend to all mods?
   - Define dependency graph first?

3. **Implementation**: Incremental or comprehensive?
   - Start with one scenario and learn?
   - Design full system upfront?

4. **Performance**: What's the max acceptable invalidation chain depth?
   - Single level (A → B)?
   - Multiple levels (A → B → C)?
   - Need recursion limits?

### Proposed Implementation Sequence

**Phase 1: Foundation** (1-2 days)

- [ ] Create `REMOVE_COMPONENT_IF_EXISTS` operation
- [ ] Add operation to DI system
- [ ] Write unit tests for operation
- [ ] Write integration tests

**Phase 2: First Invalidation Rule** (2-3 days)

- [ ] Implement `facing_away` invalidation for positioning mod
- [ ] Test with discovered scenario
- [ ] Document invalidation behavior
- [ ] Add to mod testing suite

**Phase 3: Generalization** (3-5 days)

- [ ] Define component dependency schema
- [ ] Create invalidation rule DSL
- [ ] Implement generic invalidation handler
- [ ] Add comprehensive test coverage

**Phase 4: Documentation & Rollout** (1-2 days)

- [ ] Document component dependencies
- [ ] Create mod development guide for invalidation
- [ ] Update architecture docs
- [ ] Add examples to mod templates

### Risk Mitigation

**Risk**: Cascading removals cause performance issues

- **Mitigation**: Add depth limits, comprehensive testing

**Risk**: Unexpected component removals confuse users

- **Mitigation**: Add logging, clear activity descriptions

**Risk**: Circular dependencies cause infinite loops

- **Mitigation**: EventBus recursion protection, validation

**Risk**: Hard to debug invalidation chains

- **Mitigation**: Detailed event logging, visualization tools

---

## 📚 References

### Existing Patterns to Study

1. **SpatialIndexSynchronizer** (`src/spatial/spatialIndexSynchronizer.js`)
   - Event-driven location tracking
   - Subscribes to `core:component_removed`
   - Pattern for cleanup on component removal

2. **AnatomyCacheCoordinator** (`src/anatomy/anatomyCacheCoordinator.js`)
   - Cache invalidation on component changes
   - Subscribes to both `component_added` and `component_removed`
   - Pattern for dependent state management

3. **straighten_up Rule** (`data/mods/positioning/rules/handle_straighten_up.rule.json`)
   - Explicit component removal in action rules
   - Pattern for intentional state transitions

### Related Issues

- Component dependency graph visualization needed
- Better mod development tools for debugging component states
- Action discovery performance with complex prerequisites
- UI feedback for automatic state changes

---

## 🎨 Visual Architecture

### Event-Driven Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Action                               │
│                  (e.g., "straighten_up")                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Rule Execution                                 │
│          REMOVE_COMPONENT(actor_b, "bending_over")              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              ComponentMutationService                            │
│                  removeComponent()                               │
│         • Captures oldComponentData                              │
│         • Removes from entity                                    │
│         • Updates index                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EventBus                                    │
│     dispatch("core:component_removed", payload)                 │
└─────────┬───────────────────────────────────────────┬───────────┘
          │                                             │
          ▼                                             ▼
┌───────────────────────┐                    ┌──────────────────────┐
│  Invalidation Rule    │                    │  Other Subscribers   │
│  Triggers             │                    │  (UI, Cache, etc.)   │
└──────────┬────────────┘                    └──────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│             INVALIDATE_DEPENDENT_COMPONENTS                      │
│  • Query entities with "facing_away"                            │
│  • Filter to those referencing actor_b                          │
│  • REMOVE_COMPONENT_IF_EXISTS(actor_a, "facing_away")          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EventBus (Recursive)                            │
│     dispatch("core:component_removed", payload)                 │
│              • Recursion protection active                       │
│              • Depth limit enforced                              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Dependency Graph Example

```
positioning:bending_over
  ↓ invalidates
  positioning:facing_away (from others)

positioning:sitting_on
  ↓ invalidates
  positioning:bending_over
  positioning:lying_down

positioning:lying_down
  ↓ invalidates
  positioning:bending_over
  positioning:sitting_on
  positioning:kneeling_before

positioning:kneeling_before
  ↓ invalidates
  positioning:lying_down
  positioning:sitting_on
```

---

## 📝 Conclusion

The component invalidation system is needed to maintain consistency between game state and component state. The event-driven approach (Solution A) offers the best architectural alignment with the Living Narrative Engine's ECS and event-driven design.

**Key Takeaway**: This isn't just about fixing one scenario - it's about creating a robust, extensible system for managing component dependencies that will scale as the game grows.

**Decision Point**: Choose between:

1. **Pure Event-Driven** (A): Automatic, maintainable, aligned with architecture
2. **Pure Prerequisites** (B): Explicit, predictable, more user friction
3. **Hybrid** (C): Maximum control, more complex implementation

**Recommended**: Start with Solution A for the `facing_away` + `bending_over` scenario, then evaluate if hybrid approach is needed for other cases.

---

**Ready for Discussion**: This document provides the foundation for deciding how to implement component invalidation. Next step is to choose an approach and begin Phase 1 implementation.
