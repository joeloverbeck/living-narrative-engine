# Design Report: Peck on Lips Action Implementation

## Executive Summary

This report documents the design and implementation of a new intimate action "peck on lips" for the Living Narrative Engine's intimacy system. The action follows established patterns from the existing intimacy module and integrates seamlessly with the consent-based closeness system.

## Design Requirements

### User Specifications

- **Template**: "give {target} a peck on the lips"
- **Target Scope**: `intimacy:close_actors` (existing scope)
- **Module**: Intimacy module
- **Action Type**: Simple intimate gesture

### System Integration

- Must follow existing intimacy action patterns
- Requires mutual closeness relationship for consent
- Should use standard action execution sequence
- Must be registered in mod manifest

## Implementation Design

### 1. Action Definition (`peck_on_lips.action.json`)

```json
{
  "id": "intimacy:peck_on_lips",
  "commandVerb": "peck-on-lips",
  "name": "Give a peck on the lips",
  "description": "Give someone a quick, light kiss on the lips",
  "scope": "intimacy:close_actors",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "give {target} a peck on the lips"
}
```

**Design Decisions**:

- Used `peck-on-lips` as command verb following kebab-case convention
- Maintained consistency with other intimate actions (e.g., `kiss-cheek`)
- Required `intimacy:closeness` component for consent enforcement
- No anatomical requirements as lips are assumed to be present

### 2. Rule Implementation (`peck_on_lips.rule.json`)

The rule follows the standard intimate action execution pattern:

1. **Actor/Target Name Resolution**: Retrieves display names for narrative text
2. **Position Query**: Gets actor location for perception events
3. **Variable Setup**: Prepares event data, log messages, and perception information
4. **Execution**: Uses `core:logSuccessAndEndTurn` macro for consistency

**Key Variables**:

- `logMessage`: "gives {targetName} a quick, affectionate peck on the lips"
- `perceptionType`: `action_target_general` (standard for targeted intimate actions)
- `perceptionMessage`: Simplified version for observers

### 3. Condition Definition (`event-is-action-peck_on_lips.condition.json`)

```json
{
  "id": "intimacy:event-is-action-peck_on_lips",
  "name": "Event is Action: Peck on Lips",
  "description": "The event data contains an action with id 'intimacy:peck_on_lips'",
  "test": {
    "==": ["event.actionId", "intimacy:peck_on_lips"]
  }
}
```

Standard condition pattern that checks if the event matches our action ID.

### 4. Manifest Registration

Updated `mod-manifest.json` to include:

- `peck_on_lips.action.json` in actions array
- `peck_on_lips.rule.json` in rules array
- `event-is-action-peck_on_lips.condition.json` in conditions array

All entries maintain alphabetical ordering within their respective arrays.

## Design Rationale

### Consent Model

The action inherits the intimacy module's consent framework:

- Requires existing closeness relationship between actor and target
- Uses `intimacy:close_actors` scope to limit targeting
- Prevents non-consensual interactions through component requirements

### Narrative Design

- **Action Description**: "quick, affectionate peck" conveys light, brief contact
- **Differentiation**: Distinguished from `kiss_cheek` by location and intimacy level
- **Tone**: Maintains the module's simple, clear narrative style

### Technical Consistency

- Follows exact patterns from existing intimate actions
- Reuses existing scope (no new scope needed)
- Standard event flow ensures compatibility with perception system
- No special state changes or effects (consistent with module design)

## Integration Points

### Scope Reuse

Leverages existing `intimacy:close_actors` scope:

```
actor.components.intimacy:closeness.partners[]
```

This ensures only characters in mutual closeness can be targeted.

### Event System

Integrates with core event system:

- Triggers on `core:attempt_action` event
- Creates `action_target_general` perception events
- Logs success and ends turn atomically

### Component Dependencies

- **Required**: `intimacy:closeness` component on actor
- **Implicit**: Target must be in actor's closeness partners array
- **No Additional Components**: Unlike some actions, no anatomical checks needed

## Testing Considerations

### Test Scenarios

1. **Valid Execution**: Actor with closeness component targets partner
2. **Invalid Target**: Actor attempts to target non-close character (blocked by scope)
3. **Missing Component**: Actor without closeness component (blocked by requirements)
4. **Multiple Partners**: Action should work with any partner in closeness circle

### Expected Behaviors

- Action appears in UI only when valid targets exist
- Execution logs narrative message and ends turn
- Observers receive perception event with simplified message
- No state changes beyond turn progression

## Future Extensibility

### Potential Enhancements

1. **Emotional States**: Could check/modify mood or attraction levels
2. **Progression System**: Could unlock more intimate actions
3. **Response System**: Target could react based on relationship status
4. **Context Awareness**: Different messages based on location or situation

### Integration Opportunities

- Could trigger romance progression events
- Could influence future action availability
- Could modify closeness strength (if implemented)
- Could integrate with emotion/mood systems

## Conclusion

The "peck on lips" action successfully extends the intimacy module following established patterns and best practices. The implementation:

- Maintains consistency with existing intimate actions
- Respects the consent-based architecture
- Provides clear, appropriate narrative text
- Integrates seamlessly with the action/rule/scope system
- Requires no new scopes or complex logic

The action is ready for testing and integration into the Living Narrative Engine intimacy system.
