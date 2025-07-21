# Kissing System Implementation Specification

## Overview

This specification documents the complete implementation of a state-based kissing system for the Living Narrative Engine, extending the existing intimacy mod with progressive kiss interactions. The system follows the framework defined in `lean-in-for-deep-kiss-spec.md` and integrates seamlessly with existing intimacy mechanics.

## Architecture Summary

The kissing system introduces a mutual state component (`intimacy:kissing`) that creates exclusive kissing relationships between characters. The system enables context-aware actions that are only available during kissing states and provides clean entry/exit mechanisms.

### Key Design Principles

1. **Mutual State Management**: Both participants share identical kissing components with partner references
2. **Exclusive Relationships**: Each character can only kiss one partner at a time
3. **Clean State Transitions**: Proper component lifecycle management for entry and exit
4. **Schema Integration**: Leverages `forbidden_components` for performance-optimized filtering
5. **Anatomical Awareness**: Requires mouth anatomy for kiss initiation

## Implemented Components

### Core Component

#### intimacy:kissing

```json
{
  "id": "intimacy:kissing",
  "description": "Tracks an active kissing interaction between two characters",
  "dataSchema": {
    "type": "object",
    "required": ["partner", "initiator"],
    "properties": {
      "partner": {
        "description": "The entity ID of the character being kissed",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "initiator": {
        "type": "boolean",
        "description": "Whether this character initiated the kiss",
        "default": false
      }
    }
  }
}
```

**Purpose**: Establishes mutual kissing state between partners with initiator tracking for future narrative variations.

### Scope Definitions

#### actors_with_mouth_facing_forward

```
intimacy:actors_with_mouth_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "mouth"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Purpose**: Targets partners with mouth anatomy who are facing the actor for kiss initiation.

#### current_kissing_partner

```
intimacy:current_kissing_partner := entities(intimacy:kissing)[][{
  "and": [
    {"==": [{"var": "entity.id"}, {"var": "actor.components.intimacy:kissing.partner"}]},
    {"condition_ref": "core:entity-has-actor-component"}
  ]
}]
```

**Purpose**: Identifies the current kissing partner for exit actions.

### Condition Definitions

#### Utility Conditions

- **target-is-kissing-partner**: Validates target is actor's current kissing partner

#### Event Conditions

- **event-is-action-lean-in-for-deep-kiss**: Entry action event detection
- **event-is-action-break-kiss-gently**: Gentle exit action event
- **event-is-action-pull-back-breathlessly**: Passionate exit action event
- **event-is-action-pull-back-in-revulsion**: Negative reaction exit action event

### Action Definitions

#### Entry Action

**lean_in_for_deep_kiss**

```json
{
  "id": "intimacy:lean_in_for_deep_kiss",
  "name": "Lean in for a deep kiss",
  "scope": "intimacy:actors_with_mouth_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "lean in to kiss {target} deeply"
}
```

**Key Features**:

- Uses `forbidden_components` for efficient pre-filtering
- Requires closeness relationship
- Targets partners with mouth anatomy facing forward

#### Exit Actions

**break_kiss_gently**

```json
{
  "id": "intimacy:break_kiss_gently",
  "name": "Break the kiss gently",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "gently break the kiss with {target}"
}
```

**pull_back_breathlessly**

```json
{
  "id": "intimacy:pull_back_breathlessly",
  "name": "Pull back breathlessly",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "pull back from {target}'s kiss breathlessly"
}
```

**pull_back_in_revulsion**

```json
{
  "id": "intimacy:pull_back_in_revulsion",
  "name": "Pull back in revulsion",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "pull back from {target}'s kiss in revulsion"
}
```

**Common Features**:

- All require existing kissing component
- Target current kissing partner only
- Provide different emotional tones for variety

### Rule Implementation

#### Entry Rule: lean_in_for_deep_kiss

**State Management**:

1. Adds `intimacy:kissing` component to actor with `initiator: true`
2. Adds `intimacy:kissing` component to target with `initiator: false`
3. Both components reference their respective partners

**Narrative**: "leans in close and slides their tongue into {target}'s mouth, initiating a deep, passionate kiss"

#### Exit Rules

**break_kiss_gently**:

- Removes kissing components from both participants
- Narrative: "slowly and gently breaks the kiss with {target}, pulling back with a soft smile"

**pull_back_breathlessly**:

- Removes kissing components from both participants
- Narrative: "pulls back from {target}'s kiss breathlessly, chest heaving with passion and desire"

**pull_back_in_revulsion**:

- Removes kissing components from both participants
- Narrative: "pulls back from {target}'s kiss in revulsion, clearly disturbed by the intimate contact"

**Common Pattern**:

- All rules follow standard intimacy mod structure
- Include perception system integration
- Use `core:logSuccessAndEndTurn` macro
- Maintain closeness state after kissing ends

## Integration Points

### With Existing Intimacy System

- **Requires closeness**: All kissing actions require existing `intimacy:closeness` component
- **Respects positioning**: Uses `intimacy:facing_away` for directional awareness
- **Compatible actions**: Kissing coexists with other intimacy actions

### With Anatomy System

- **Mouth requirement**: Entry action requires mouth anatomy on target
- **Extensible**: Pattern supports future anatomy-specific kiss variations

### With Perception System

- **Standard integration**: All actions dispatch `action_target_general` perception events
- **Location awareness**: Perception events include proper location context

## Performance Optimizations

### Schema-Based Filtering

- Uses `forbidden_components` instead of prerequisites for better performance
- Leverages action indexing system for efficient discovery
- Minimizes JSON Logic evaluations through component pre-filtering

### Scope Efficiency

- Specific scopes reduce unnecessary evaluations
- Anatomy filtering at scope level prevents invalid targeting
- Partner reference lookups avoid broad entity queries

## State Management Guarantees

### Mutual Consistency

- Both participants always have synchronized kissing components
- Partner references are bidirectional and consistent
- State cleanup affects both participants simultaneously

### Exclusive Relationships

- `forbidden_components` prevents multiple concurrent kisses
- Component presence/absence provides clear state boundaries
- No orphaned kissing states possible

### Clean Transitions

- Entry actions establish complete bilateral state
- Exit actions perform complete bilateral cleanup
- Closeness state preserved across kiss lifecycle

## Future Extension Points

### Component Extensions

- Kiss quality/intensity tracking
- Emotional response modifiers
- Skill/experience factors

### Action Variations

- Cultural/style-specific kiss types
- Skill-based kiss actions
- Contextual kiss interruptions

### State Enhancements

- Multi-character kiss scenarios
- Kiss duration tracking
- Environmental interaction effects

## Testing Considerations

### State Validation

- Verify mutual component creation/removal
- Test exclusive relationship enforcement
- Validate scope targeting accuracy

### Edge Cases

- Closeness removal during kissing
- Rapid action cycling
- Invalid target handling

### Integration Testing

- Compatibility with existing intimacy actions
- Perception system event generation
- Turn system integration

## Files Created

### Components (1 file)

- `intimacy/components/kissing.component.json`

### Scopes (2 files)

- `intimacy/scopes/actors_with_mouth_facing_forward.scope`
- `intimacy/scopes/current_kissing_partner.scope`

### Conditions (5 files)

- `intimacy/conditions/target-is-kissing-partner.condition.json`
- `intimacy/conditions/event-is-action-lean-in-for-deep-kiss.condition.json`
- `intimacy/conditions/event-is-action-break-kiss-gently.condition.json`
- `intimacy/conditions/event-is-action-pull-back-breathlessly.condition.json`
- `intimacy/conditions/event-is-action-pull-back-in-revulsion.condition.json`

### Actions (4 files)

- `intimacy/actions/lean_in_for_deep_kiss.action.json`
- `intimacy/actions/break_kiss_gently.action.json`
- `intimacy/actions/pull_back_breathlessly.action.json`
- `intimacy/actions/pull_back_in_revulsion.action.json`

### Rules (4 files)

- `intimacy/rules/lean_in_for_deep_kiss.rule.json`
- `intimacy/rules/break_kiss_gently.rule.json`
- `intimacy/rules/pull_back_breathlessly.rule.json`
- `intimacy/rules/pull_back_in_revulsion.rule.json`

### Integration

- Updated `intimacy/mod-manifest.json` with all new content references

## Implementation Status

✅ **Complete**: All components implemented according to specification
✅ **Tested**: Schema validation and pattern consistency verified  
✅ **Integrated**: Mod manifest updated with all new content
✅ **Compatible**: Follows existing intimacy mod patterns exactly

This implementation provides a solid foundation for the kissing system while maintaining full compatibility with existing game mechanics and preparing for future extensibility.
