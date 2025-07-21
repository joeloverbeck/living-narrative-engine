# Anatomy Socket Coverage for Intimate Actions Specification

## Overview

This specification outlines the implementation requirements for integrating the anatomy socket coverage system with intimate actions in the Living Narrative Engine. The goal is to ensure that certain intimate actions (specifically `fondle_breasts` and `fondle_penis`) are only available when the relevant anatomy sockets are not covered by clothing.

## Background

The Living Narrative Engine recently implemented a `slot_metadata` component system that tracks which clothing slots cover which anatomy sockets. This metadata is derived from the anatomy blueprint and provides a dynamic mapping between clothing equipment slots and the body parts they cover.

## Current System Analysis

### isSocketCovered Operator

The `isSocketCovered` JSON Logic operator (located in `src/logic/operators/isSocketCoveredOperator.js`) checks whether a specific anatomical socket is covered by any equipped clothing. It works by:

1. Retrieving the entity's `clothing:equipment` component
2. Looking up the socket-to-slot mapping from the `clothing:slot_metadata` component
3. Checking if any of the mapped slots have equipped items
4. Returning `true` if the socket is covered, `false` if uncovered

Usage example:

```json
{ "isSocketCovered": ["actor", "penis"] }
```

### Slot Metadata Component

The `clothing:slot_metadata` component contains a `slotMappings` object that maps clothing slot IDs to their coverage metadata:

```json
{
  "slotMappings": {
    "torso_upper": {
      "coveredSockets": ["left_chest", "right_chest", "chest_center"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "torso_lower": {
      "coveredSockets": ["penis", "vagina", "left_hip", "right_hip"],
      "allowedLayers": ["underwear", "base", "outer"]
    }
  }
}
```

### Current Action Definitions

#### fondle_breasts.action.json

```json
{
  "id": "sex:fondle_breasts",
  "name": "Fondle Breasts",
  "description": "Gently fondle the target's breasts.",
  "scope": "sex:actors_with_breasts_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  }
}
```

#### fondle_penis.action.json

```json
{
  "id": "sex:fondle_penis",
  "name": "Fondle Penis",
  "description": "Gently fondle the target's penis.",
  "scope": "sex:actors_with_penis_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  }
}
```

## Implementation Requirements

### 1. Scope Modifications

The existing scopes need to be modified to include socket coverage checks:

#### Modified actors_with_breasts_facing_forward.scope

```
// Scope for actors in closeness who have breasts that are uncovered and are facing forward
// Used by actions that require exposed breast anatomy and face-to-face interaction
sex:actors_with_breasts_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "breast"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"},
    {
      "or": [
        {"not": {"isSocketCovered": [".", "left_chest"]}},
        {"not": {"isSocketCovered": [".", "right_chest"]}}
      ]
    }
  ]
}]
```

#### Modified actors_with_penis_facing_forward.scope

```
// Scope for actors in closeness who have an uncovered penis and are facing forward
// Used by actions that require exposed penis anatomy and face-to-face interaction
sex:actors_with_penis_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"},
    {"not": {"isSocketCovered": [".", "penis"]}}
  ]
}]
```

### 2. Key Socket Identifiers

Based on the anatomy system analysis, the relevant socket identifiers are:

- **Breasts**: `left_chest`, `right_chest`
- **Penis**: `penis`

### 3. Coverage Logic

- **Breasts**: The action should be available if EITHER `left_chest` OR `right_chest` is uncovered
- **Penis**: The action should be available only if the `penis` socket is uncovered

## Test Requirements

### Integration Test Modifications

Both `fondle_breasts_action.test.js` and `fondle_penis_action.test.js` need comprehensive test coverage for socket coverage scenarios.

#### Test Scenarios for fondle_breasts

1. **Both breasts uncovered** - Action should be available
2. **One breast covered, one uncovered** - Action should be available
3. **Both breasts covered** - Action should NOT be available
4. **No clothing equipment component** - Action should be available (default uncovered)
5. **No slot metadata component** - Action should be available (default uncovered)

#### Test Scenarios for fondle_penis

1. **Penis uncovered** - Action should be available
2. **Penis covered** - Action should NOT be available
3. **No clothing equipment component** - Action should be available (default uncovered)
4. **No slot metadata component** - Action should be available (default uncovered)

### Test Setup Requirements

Each test should:

1. Create entities with proper anatomy structure (body parts with correct subtypes)
2. Set up `clothing:equipment` component with equipped items in relevant slots
3. Set up `clothing:slot_metadata` component with proper socket-to-slot mappings
4. Verify action availability through the scope resolution system

Example test entity setup:

```javascript
{
  id: 'testEntity',
  components: {
    'anatomy:body': { /* body structure */ },
    'clothing:equipment': {
      'torso_upper': {
        items: ['shirt1'],
        layers: { base: 'shirt1' }
      }
    },
    'clothing:slot_metadata': {
      slotMappings: {
        'torso_upper': {
          coveredSockets: ['left_chest', 'right_chest'],
          allowedLayers: ['base', 'outer']
        }
      }
    }
  }
}
```

## Technical Considerations

### Performance

- The `isSocketCovered` operator includes caching to avoid repeated lookups
- Cache should be cleared when clothing equipment changes

### Error Handling

- Gracefully handle missing components (default to uncovered)
- Log warnings for invalid socket IDs or malformed data

### Extensibility

- The system should be easily extensible to other anatomy sockets
- Consider creating reusable scope patterns for socket coverage checks

## Implementation Steps

1. Modify the scope files as specified above
2. Create comprehensive integration tests for both actions
3. Verify existing tests still pass
4. Test with various clothing configurations in-game
5. Document any edge cases discovered during testing

## Success Criteria

- Actions are only available when relevant anatomy sockets are uncovered
- All test scenarios pass
- No regression in existing functionality
- Clear error messages for edge cases
- Performance remains acceptable (no noticeable lag in action discovery)
