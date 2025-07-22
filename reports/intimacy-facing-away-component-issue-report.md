# Intimacy Facing Away Component Issue Report

## Executive Summary

There is a critical issue in the intimacy mod where actions that require face-to-face interaction (such as kissing and face-touching actions) are incorrectly available when the target actor has their back turned to the current actor. This occurs because the scope conditions only check if the **actor** is facing away from the **target**, but fail to check if the **target** is facing away from the **actor**.

## Problem Description

### Current Behavior

When Actor B has the `intimacy:facing_away` component with Actor A in their `facing_away_from` array:

- Actor A can still perform face-to-face actions on Actor B
- These actions include: `lean_in_for_deep_kiss`, `lick_lips`, `peck_on_lips`, `thumb_wipe_cheek`
- This allows illogical scenarios where someone can kiss or touch the face of someone whose back is turned

### Expected Behavior

Face-to-face actions should only be available when **both** actors are facing each other, meaning:

- The actor is NOT facing away from the target
- The target is NOT facing away from the actor

## Technical Analysis

### Root Cause

The issue lies in the scope definitions and their underlying conditions. Currently:

1. **`intimacy:close_actors_facing_forward`** scope uses the condition `intimacy:entity-not-in-facing-away`
2. This condition only checks: "Is the entity NOT in the actor's facing_away list?"
3. It fails to check: "Is the actor NOT in the entity's facing_away list?"

This creates a unidirectional check when a bidirectional check is required.

### Affected Scopes

All "facing_forward" scopes suffer from this issue:

- `intimacy:close_actors_facing_forward`
- `intimacy:actors_with_mouth_facing_forward`
- `intimacy:actors_with_arms_facing_forward`
- `intimacy:actors_with_ass_cheeks_facing_forward`
- `intimacy:close_actors_facing_forward_with_torso_clothing`

### Existing Infrastructure

The mod already has the necessary condition to check the reverse direction:

- `intimacy:actor-in-entity-facing-away` - Checks if actor is in entity's facing_away list

What's missing is:

- `intimacy:actor-not-in-entity-facing-away` - To check if actor is NOT in entity's facing_away list

## Solution Design

### Approach 1: Create New Bidirectional Condition (Recommended)

Create a new condition that checks both directions:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "intimacy:both-actors-facing-each-other",
  "description": "Checks if both actors are facing each other (neither is facing away from the other).",
  "logic": {
    "and": [
      {
        "not": {
          "in": [
            { "var": "entity.id" },
            { "var": "actor.components.intimacy:facing_away.facing_away_from" }
          ]
        }
      },
      {
        "not": {
          "in": [
            { "var": "actor.id" },
            { "var": "entity.components.intimacy:facing_away.facing_away_from" }
          ]
        }
      }
    ]
  }
}
```

### Approach 2: Create Missing Condition and Update Scopes

1. Create `intimacy:actor-not-in-entity-facing-away` condition:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "intimacy:actor-not-in-entity-facing-away",
  "description": "Checks if the actor is NOT in the entity's facing_away_from array (i.e., the entity is not facing away from the actor).",
  "logic": {
    "not": {
      "in": [
        { "var": "actor.id" },
        { "var": "entity.components.intimacy:facing_away.facing_away_from" }
      ]
    }
  }
}
```

2. Update all facing_forward scopes to use both conditions:

```dsl
intimacy:close_actors_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"condition_ref": "intimacy:entity-not-in-facing-away"},
    {"condition_ref": "intimacy:actor-not-in-entity-facing-away"}
  ]
}]
```

## Files Requiring Modification

### New Files to Create

1. **Option 1 (Recommended)**:
   - `/data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json`

2. **Option 2**:
   - `/data/mods/intimacy/conditions/actor-not-in-entity-facing-away.condition.json`

### Files to Modify

All facing_forward scope files need to be updated to use the bidirectional check:

1. `/data/mods/intimacy/scopes/close_actors_facing_forward.scope`
2. `/data/mods/intimacy/scopes/actors_with_mouth_facing_forward.scope`
3. `/data/mods/intimacy/scopes/actors_with_arms_facing_forward.scope`
4. `/data/mods/intimacy/scopes/actors_with_ass_cheeks_facing_forward.scope`
5. `/data/mods/intimacy/scopes/close_actors_facing_forward_with_torso_clothing.scope`

### Mod Manifest Update

The `mod-manifest.json` file needs to be updated to include the new condition file.

## Implementation Steps

1. **Create the new condition file** (either `both-actors-facing-each-other` or `actor-not-in-entity-facing-away`)

2. **Update mod manifest** to register the new condition

3. **Update all facing_forward scopes** to use the bidirectional check

4. **Test the changes** to ensure:
   - Face-to-face actions are unavailable when either actor is facing away
   - Face-to-face actions remain available when both actors face each other
   - Back-facing actions (like `massage_back`) continue to work correctly

## Impact Analysis

### Positive Impact

- Logical consistency in intimate interactions
- Prevention of unrealistic scenarios
- Better player immersion

### Potential Side Effects

- None expected - this change makes the system more restrictive in a logical way
- Existing saves should continue to work normally

## Testing Checklist

After implementation, verify:

- [ ] Actor A cannot kiss Actor B when B is facing away
- [ ] Actor B cannot kiss Actor A when A is facing away
- [ ] Both actors can kiss when facing each other
- [ ] Back massage still works when target is facing away
- [ ] Turn around actions continue to work correctly
- [ ] Component state management remains intact

## Conclusion

This issue represents a logical oversight in the facing system implementation. The fix is straightforward and leverages existing patterns in the codebase. The recommended approach (creating a single bidirectional condition) is cleaner and more maintainable than updating each scope with multiple conditions.
