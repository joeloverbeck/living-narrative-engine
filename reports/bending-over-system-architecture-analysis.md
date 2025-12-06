# Bending Over System Architecture Analysis

## Executive Summary

This report provides a comprehensive analysis of the existing sitting system in the `positioning` mod and proposes a parallel system for implementing "bending over" functionality. The proposed system will allow actors to bend over surface entities (counters, sofas, tables, etc.) following the same architectural patterns established by the sitting system.

## 1. Existing Sitting System Analysis

### 1.1 System Architecture Overview

The sitting system implements a complete action-component-rule flow:

```
Actor → Action (sit_down) → Target (furniture) → Rule Processing → State Update
```

### 1.2 Core Components

#### 1.2.1 allows_sitting Component

- **Purpose**: Marks furniture as sittable and tracks occupancy
- **Key Design**: Uses a `spots` array where each index represents a seating position
- **State Management**: `null` = empty spot, entity ID = occupied spot
- **Capacity**: Supports 1-10 spots (configurable)

#### 1.2.2 sitting_on Component

- **Purpose**: Tracks actor's current sitting state
- **Key Fields**:
  - `furniture_id`: Reference to the furniture entity
  - `spot_index`: Which spot in the furniture's array the actor occupies
- **Relationship**: Creates bidirectional link between actor and furniture

### 1.3 Actions

#### 1.3.1 sit_down Action

- **Targets**: `positioning:available_furniture` scope
- **Prerequisites**: Actor must NOT have `sitting_on` or `kneeling_before` components
- **Effect**: Initiates sitting process

#### 1.3.2 get_up_from_furniture Action

- **Targets**: `positioning:furniture_im_sitting_on` scope
- **Prerequisites**: Actor MUST have `sitting_on` component
- **Effect**: Removes sitting state

### 1.4 Scope Definitions

#### 1.4.1 available_furniture Scope

```
entities(positioning:allows_sitting)[][{
  "and": [
    // Same location as actor
    {"==": [locationId check]},
    // Has at least one empty spot
    {"some": [spots array, null check]}
  ]
}]
```

#### 1.4.2 furniture_im_sitting_on Scope

```
entities(positioning:allows_sitting)[][{
  "==": [entity.id, actor's furniture_id]
}]
```

### 1.5 Rule Processing

#### 1.5.1 handle_sit_down Rule

**Key Operations**:

1. Sequential spot allocation (tries spots 0, 1, 2 using atomic operations)
2. If successful:
   - Adds `sitting_on` component to actor
   - Updates furniture's spot array
   - Locks movement
   - Establishes automatic closeness with adjacent sitters
   - Logs success and ends turn

#### 1.5.2 handle_get_up_from_furniture Rule

**Key Operations**:

1. Removes automatic closeness relationships
2. Clears the occupied spot in furniture
3. Removes `sitting_on` component from actor
4. Unlocks movement
5. Logs success and ends turn

### 1.6 Design Patterns Observed

1. **Bidirectional State Tracking**: Both actor and furniture maintain state
2. **Atomic Operations**: Uses `ATOMIC_MODIFY_COMPONENT` for race condition prevention
3. **Movement Locking**: Sitting restricts movement capabilities
4. **Automatic Relationships**: Establishes closeness between adjacent actors
5. **Sequential Spot Allocation**: First-come-first-served spot assignment
6. **Validation Through Components**: Presence/absence of components controls action availability

## 2. Proposed Bending Over System Design

### 2.1 System Requirements

The bending over system should support:

- Actors bending over surfaces (counters, sofas, tables, desks)
- Unlimited actors bending over the same surface (no position tracking)
- Movement restriction while bent over
- Automatic closeness with other actors at the same surface
- Compatible with existing positioning mechanics

### 2.2 Component Specifications

#### 2.2.1 allows_bending_over Component

**File**: `data/mods/positioning/components/allows_bending_over.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:allows_bending_over",
  "description": "Indicates that this surface entity can be bent over by actors",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

#### 2.2.2 bending_over Component

**File**: `data/mods/positioning/components/bending_over.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:bending_over",
  "description": "Tracks which surface entity this actor is currently bending over",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["surface_id"],
    "properties": {
      "surface_id": {
        "description": "The surface entity being bent over",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      }
    }
  }
}
```

### 2.3 Action Specifications

#### 2.3.1 bend_over Action

**File**: `data/mods/positioning/actions/bend_over.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:bend_over",
  "name": "Bend over",
  "description": "Bend over an available surface",
  "targets": "positioning:available_surfaces",
  "required_components": {
    "actor": []
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:bending_over",
      "positioning:kneeling_before"
    ]
  },
  "template": "bend over {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ffffff"
  }
}
```

#### 2.3.2 straighten_up Action

**File**: `data/mods/positioning/actions/straighten_up.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straighten_up",
  "name": "Straighten up",
  "description": "Stop bending over the surface",
  "targets": "positioning:surface_im_bending_over",
  "required_components": {
    "actor": ["positioning:bending_over"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "straighten up from {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ffffff"
  }
}
```

### 2.4 Scope Specifications

#### 2.4.1 available_surfaces Scope

**File**: `data/mods/positioning/scopes/available_surfaces.scope`

```
positioning:available_surfaces := entities(positioning:allows_bending_over)[][{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

#### 2.4.2 surface_im_bending_over Scope

**File**: `data/mods/positioning/scopes/surface_im_bending_over.scope`

```
positioning:surface_im_bending_over := entities(positioning:allows_bending_over)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:bending_over.surface_id"}
  ]
}]
```

### 2.5 Condition Specifications

#### 2.5.1 event-is-action-bend-over Condition

**File**: `data/mods/positioning/conditions/event-is-action-bend-over.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-bend-over",
  "description": "Checks if the event is a bend_over action attempt",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "positioning:bend_over"]
  }
}
```

#### 2.5.2 event-is-action-straighten-up Condition

**File**: `data/mods/positioning/conditions/event-is-action-straighten-up.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straighten-up",
  "description": "Checks if the event is a straighten_up action attempt",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "positioning:straighten_up"]
  }
}
```

### 2.6 Rule Specifications

#### 2.6.1 handle_bend_over Rule

**File**: `data/mods/positioning/rules/handle_bend_over.rule.json`

This rule is simpler than `handle_sit_down` since it doesn't need position tracking:

- Verifies target has `positioning:allows_bending_over` component
- Adds `positioning:bending_over` component to actor with surface reference
- Custom log messages for bending over

**Key Operations**:

1. Verify target has `allows_bending_over` component
2. Add `bending_over` component to actor with surface_id
3. Lock movement (prevent actor from moving while bent over)
4. Establish automatic closeness with other actors at the same surface
5. Log success and end turn

#### 2.6.2 handle_straighten_up Rule

**File**: `data/mods/positioning/rules/handle_straighten_up.rule.json`

This rule is simpler than `handle_get_up_from_furniture` since there's no position to clear:

- Removes closeness relationships with other actors at the same surface
- Removes `bending_over` component from actor
- Unlocks movement
- Logs success and ends turn

## 3. Integration Considerations

### 3.1 Compatibility with Existing Systems

#### 3.1.1 Mutual Exclusivity

The system enforces that an actor cannot simultaneously:

- Sit AND bend over
- Kneel AND bend over
- Be in multiple positioning states

This is enforced through `forbidden_components` in action definitions.

#### 3.1.2 Movement System Integration

- Bending over locks movement (same as sitting)
- Movement is restored when straightening up
- Compatible with existing movement lock/unlock operations

#### 3.1.3 Closeness System

- Automatic closeness established between all actors bent over the same surface
- Uses existing `ESTABLISH_SITTING_CLOSENESS` operation (can be generalized)
- Since there are no specific positions, all actors at the surface are considered close to each other

### 3.2 Entity Examples

#### 3.2.1 Kitchen Counter Entity

```json
{
  "id": "kitchen:counter_01",
  "components": {
    "positioning:allows_bending_over": {}
  }
}
```

#### 3.2.2 Living Room Sofa Entity

```json
{
  "id": "living:sofa_01",
  "components": {
    "positioning:allows_sitting": {
      "spots": [null, null, null]
    },
    "positioning:allows_bending_over": {}
  }
}
```

Note: A sofa can support both sitting AND bending over, but an actor can only do one at a time.

## 4. Implementation Checklist

### 4.1 New Files to Create

**Components** (2 files):

- [ ] `data/mods/positioning/components/allows_bending_over.component.json`
- [ ] `data/mods/positioning/components/bending_over.component.json`

**Actions** (2 files):

- [ ] `data/mods/positioning/actions/bend_over.action.json`
- [ ] `data/mods/positioning/actions/straighten_up.action.json`

**Scopes** (2 files):

- [ ] `data/mods/positioning/scopes/available_surfaces.scope`
- [ ] `data/mods/positioning/scopes/surface_im_bending_over.scope`

**Conditions** (2 files):

- [ ] `data/mods/positioning/conditions/event-is-action-bend-over.condition.json`
- [ ] `data/mods/positioning/conditions/event-is-action-straighten-up.condition.json`

**Rules** (2 files):

- [ ] `data/mods/positioning/rules/handle_bend_over.rule.json`
- [ ] `data/mods/positioning/rules/handle_straighten_up.rule.json`

### 4.2 Existing Files to Modify

No existing files need modification. The system is fully additive.

### 4.3 Testing Considerations

1. **Unit Tests**: Test each component, action, and rule independently
2. **Integration Tests**: Test interaction with sitting/kneeling systems
3. **Edge Cases**:
   - Multiple actors bending over same surface simultaneously
   - Actor trying to sit while bent over
   - Closeness relationships between multiple actors at same surface
   - Movement restrictions while bent over

### 4.4 Future Enhancements

1. **Maximum Capacity**: Optionally limit how many actors can bend over a surface
2. **Animation Support**: Different animation states for bending over
3. **Interaction Modifiers**: Different interactions available while bent over
4. **Stamina System**: Bending over could consume/require stamina
5. **Social Rules**: Cultural/social implications of bending over

## 5. Conclusion

The proposed bending over system follows the established patterns of the sitting system while being simpler due to not tracking individual positions. The design is:

- **Consistent**: Uses same architectural patterns as existing positioning systems
- **Simplified**: No position tracking means less complexity and no race conditions
- **Extensible**: Supports future enhancements without breaking changes
- **Compatible**: Works alongside existing positioning mechanics
- **Complete**: Includes all necessary components for full functionality

The implementation requires creating 10 new files with no modifications to existing files, ensuring zero risk to current functionality while adding the requested feature.

## Appendix A: Key Design Decisions

### A.1 Why no position tracking?

Since bending over surfaces won't happen regularly with many actors, tracking individual positions adds unnecessary complexity. The simpler approach of allowing unlimited actors is more practical.

### A.2 Why reuse ESTABLISH_SITTING_CLOSENESS?

The operation is generic enough to handle any proximity-based closeness. Could be renamed to ESTABLISH_PROXIMITY_CLOSENESS in future refactoring.

### A.3 Why keep the component data schema empty?

The `allows_bending_over` component serves as a simple marker/flag. An empty schema is sufficient since the component's mere presence indicates the surface can be bent over.

## Appendix B: Rule Implementation Details

The complete rule implementations would be simpler than the sitting rules since there's no need for atomic position allocation. The bend_over rule simply adds the `bending_over` component to the actor, while the straighten_up rule removes it. This eliminates potential race conditions that the sitting system must handle with its position-based approach.

---

_Report Generated: [Current Date]_
_Author: System Architecture Analysis Tool_
_Version: 1.0_
