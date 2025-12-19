# Positioning Action Validation Patterns

## Overview

This document describes the validation patterns used in the positioning mod for the Living Narrative Engine. The key principle is that **most positioning restrictions should apply to the actor performing the action, not the target**.

## Available Positioning Components

### Actor State Components

- **`positioning:kneeling_before`** - Actor is kneeling before someone
  - Data: `{ entityId: "target:entity_id" }`
- **`positioning:sitting_on`** - Actor is sitting on furniture
  - Data: `{ furniture_id: "furniture:id", spot_index: 0 }`
- **`positioning:bending_over`** - Actor is bending over a surface
  - Data: `{ surface_id: "surface:id", spot_index: 0 }`
- **`positioning:facing_away`** - Actor is facing away from someone
  - Data: `{ entityId: "target:entity_id" }`
- **`positioning:closeness`** - Actor is close to someone
  - Data: `{ entityId: "target:entity_id" }`

### Furniture/Object Components

- **`sitting:allows_sitting`** - Object can be sat on
- **`positioning:allows_bending_over`** - Object can be bent over

## Validation Principles

### 1. Actor Validation (Primary Focus)

Most positioning restrictions should apply to the actor performing the action. This prevents physically impossible or conflicting states.

**Common Actor Forbidden Components:**

- `positioning:kneeling_before` - Prevents kneeling while already kneeling
- `positioning:sitting_on` - Prevents actions incompatible with sitting
- `positioning:bending_over` - Prevents actions incompatible with bending over
- `positioning:closeness` - Prevents getting close when already close (for `get_close` action)

### 2. Target Validation (Minimal)

Target restrictions should be minimal and only applied when physically impossible or narratively nonsensical.

**Valid Scenarios to Preserve:**

- ✅ **Kneeling before someone sitting** - Throne room scenarios, formal ceremonies
- ✅ **Kneeling before someone kneeling** - Chains of reverence, religious ceremonies
- ✅ **Getting close to anyone** - Regardless of their position (standing, sitting, kneeling)
- ✅ **Turning to face someone** - Works with any target position

**Invalid Scenarios (Physically Awkward):**

- ❌ **Kneeling before someone bending over** - Physically awkward positioning
- ❌ **Getting close when already close** - Actor restriction, not target

## Implementation Examples

### kneel_before Action

```json
{
  "forbidden_components": {
    "actor": [
      "positioning:kneeling_before", // Can't kneel while kneeling
      "positioning:sitting_on", // Can't kneel while sitting
      "positioning:bending_over" // Can't kneel while bending over
    ],
    "primary": [
      "positioning:bending_over" // Only restrict bending targets
    ]
  }
}
```

### get_close Action

```json
{
  "forbidden_components": {
    "actor": [
      "positioning:closeness" // Can't get close if already close
    ]
    // No target restrictions - can get close to anyone
  }
}
```

### turn_around_to_face Action

```json
{
  "required_components": {
    "actor": [
      "positioning:closeness", // Must be close
      "positioning:facing_away" // Must be facing away
    ]
  }
  // No target restrictions needed
}
```

### sit_down_at_distance Action (Distance-Based Positioning)

**Multi-Target Action with Secondary Scope:**

```json
{
  "id": "positioning:sit_down_at_distance",
  "targets": {
    "primary": {
      "scope": "positioning:available_furniture",
      "description": "Furniture with open seats"
    },
    "secondary": {
      "scope": "positioning:actors_sitting_with_space_to_right",
      "contextFrom": "primary",
      "description": "Occupant to maintain distance from"
    }
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:kneeling_before",
      "positioning:bending_over"
    ]
  }
}
```

**Key Validation Points:**

- Secondary scope must filter based on primary target (furniture) using `contextFrom`
- Rule must validate both buffer seat (occupant + 1) and target seat (occupant + 2) are empty
- Atomic operations ensure race condition safety with batch component additions
- Scope DSL syntax: `furniture.occupants[].actor` to traverse from furniture to occupants

**Testing Considerations:**

- Test with furniture at various capacity levels
- Verify behavior when no valid occupants exist (action should not appear)
- Confirm one-seat buffer is maintained, not direct adjacency
- Validate multiple actors can sit at distance from same occupant simultaneously

## Best Practices

### 1. Prioritize Actor Validation

Always consider actor restrictions first. Most physical impossibilities come from the actor's current state, not the target's.

### 2. Use Scopes for Complex Filtering

For furniture and object validation, use scopes like `positioning:available_furniture` rather than forbidden components:

```json
{
  "targets": {
    "primary": {
      "scope": "positioning:available_furniture",
      "description": "Furniture that can be sat on"
    }
  }
}
```

### 3. Document Validation Reasons

Always include clear descriptions explaining why certain components are forbidden:

```json
{
  "description": "Kneel before another actor. Cannot be performed while sitting, kneeling, or bending over."
}
```

### 4. Test Realistic Scenarios

Always test with narrative-appropriate scenarios:

- Throne rooms (kneeling before seated royalty)
- Religious ceremonies (chains of kneeling)
- Combat situations (positioning behind enemies)
- Social interactions (getting close for conversation)

### 5. Maintain Gameplay Flexibility

Don't over-restrict. Many seemingly unusual positioning combinations are valid in narrative contexts:

- Knights kneeling before a seated king
- Chains of people kneeling (each before the next)
- Multiple people close to the same person
- Complex multi-actor positioning scenarios

## Testing Validation

### Integration Test Structure

```javascript
describe('valid scenarios', () => {
  it('should allow kneeling before standing target');
  it('should allow kneeling before sitting target (throne)');
  it('should allow kneeling before kneeling target (chain)');
});

describe('invalid scenarios', () => {
  it('should prevent kneeling before bending target');
  it('should prevent kneeling while already kneeling');
  it('should prevent kneeling while sitting');
});
```

### Key Test Scenarios

1. **Throne Room**: Knight kneeling before seated king
2. **Chain of Reverence**: Multiple actors kneeling in sequence
3. **Mixed States**: Actors with various positioning states in same location
4. **State Transitions**: Valid changes between positioning states
5. **AI Behavior**: LLM-controlled characters respecting validation

## Common Patterns

### State Exclusivity

Some states are mutually exclusive on the actor:

- Can't be `kneeling_before` AND `sitting_on`
- Can't be `kneeling_before` AND `bending_over`
- Can't be `sitting_on` AND `bending_over`

### State Compatibility

Some states can coexist:

- Can be `closeness` AND `facing_away` (close but turned away)
- Can be `closeness` AND `kneeling_before` (kneeling close to someone)

### Target Flexibility

Most targets should accept actors in any state:

- Can kneel before someone standing, sitting, or kneeling
- Can get close to someone in any position
- Can turn to face someone regardless of their state

## Debugging Validation Issues

### Common Problems and Solutions

**Problem**: Action not appearing in available actions
**Solution**: Check `forbidden_components` on actor - likely has conflicting state

**Problem**: Action appears but fails prerequisite
**Solution**: Check `prerequisites` conditions - may need specific components

**Problem**: Overly restrictive gameplay
**Solution**: Review target `forbidden_components` - remove unnecessary restrictions

**Problem**: Physically impossible states allowed
**Solution**: Add appropriate actor `forbidden_components` to prevent conflicts

## Future Considerations

### Potential Enhancements

- Distance-based validation (near/far positioning)
- Group positioning actions (everyone kneel)
- Sequential positioning (form a line)
- Environmental constraints (walls, obstacles)

### Maintain Backward Compatibility

When adding new validation:

1. Default to permissive (allow unless impossible)
2. Test with existing content
3. Document changes clearly
4. Provide migration path if needed

## Summary

The positioning validation system prioritizes:

1. **Actor restrictions** over target restrictions
2. **Physical possibility** over arbitrary rules
3. **Narrative flexibility** over rigid constraints
4. **Clear documentation** over implicit behavior

By following these patterns, the positioning mod maintains both physical realism and narrative flexibility, allowing for rich storytelling possibilities while preventing impossible states.
