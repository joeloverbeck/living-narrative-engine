# MOVLOCK-006: Update Stand Up Rule

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-004  
**Estimated Effort**: 0.5 hours

## Context

The `stand_up` action needs to unlock movement when an actor stands from a kneeling position. This is accomplished by adding an UNLOCK_MOVEMENT operation to the rule that processes the stand up action. The operation must be placed after the kneeling component is removed.

## Implementation Steps

### 1. Locate and Open Rule File

**File**: `data/mods/positioning/rules/stand_up.rule.json`

### 2. Identify Insertion Point

Find the REMOVE_COMPONENT operation that removes the kneeling component. It should look similar to:

```json
{
  "type": "REMOVE_COMPONENT",
  "comment": "Remove kneeling component from actor",
  "parameters": {
    "entity_id": "{event.payload.actorId}",
    "component_id": "positioning:kneeling"
  }
}
```

### 3. Add Unlock Movement Operation

Insert the following operation immediately AFTER the REMOVE_COMPONENT operation (around line 26):

```json
{
  "type": "UNLOCK_MOVEMENT",
  "comment": "Unlock movement after standing (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
```

**Important**:

- Add a comma after the closing brace of the REMOVE_COMPONENT operation
- Ensure proper JSON formatting and indentation
- The parameter name must be `actor_id` (matching what the handler expects)

### 4. Complete JSON Structure

The operations array should look like this after modification:

```json
"operations": [
  // ... other operations before ...
  {
    "type": "REMOVE_COMPONENT",
    "comment": "Remove kneeling component from actor",
    "parameters": {
      "entity_id": "{event.payload.actorId}",
      "component_id": "positioning:kneeling"
    }
  },
  {
    "type": "UNLOCK_MOVEMENT",
    "comment": "Unlock movement after standing (handles both legacy and anatomy entities)",
    "parameters": {
      "actor_id": "{event.payload.actorId}"
    }
  },
  // ... other operations after (if any) ...
]
```

### 5. Implementation Checklist

- [ ] Open `data/mods/positioning/rules/stand_up.rule.json`
- [ ] Locate the REMOVE_COMPONENT operation for positioning:kneeling
- [ ] Add comma after the REMOVE_COMPONENT operation's closing brace
- [ ] Insert UNLOCK_MOVEMENT operation with proper indentation
- [ ] Verify parameter is named `actor_id`
- [ ] Verify parameter value is `"{event.payload.actorId}"`
- [ ] Add descriptive comment
- [ ] Ensure JSON remains valid

## Validation Criteria

1. **Valid JSON**: File must parse as valid JSON
2. **Operation placement**: UNLOCK_MOVEMENT comes after REMOVE_COMPONENT
3. **Parameter name**: Uses `actor_id` not `entity_id`
4. **Parameter value**: References `{event.payload.actorId}`
5. **Comment present**: Explains the operation's purpose
6. **Comma placement**: Proper comma separation between operations

## Testing Requirements

After implementation:

1. Validate JSON syntax: Use a JSON validator or `npm run build`
2. Check rule loading: Start the application and check for rule parsing errors
3. Manual test sequence:
   - Have an actor kneel before another
   - Verify movement is locked (from MOVLOCK-005)
   - Have the actor stand up
   - Attempt to move the actor
   - Movement should now be allowed

## JSON Formatting Guidelines

- Use 2-space indentation
- Keep consistent with existing file formatting
- Place commas at the end of objects/arrays (except last item)
- Use descriptive comments for operations

## Error Prevention

1. **Invalid JSON**: Use a JSON validator before saving
2. **Wrong parameter name**: Must be `actor_id`, not `entity_id`
3. **Missing comma**: Add comma after previous operation
4. **Extra comma**: Don't add comma if this is the last operation
5. **Wrong event path**: Use `event.payload.actorId` with proper casing

## Special Considerations

- The unlock operation should be idempotent (safe to call multiple times)
- If an actor stands without having knelt, the operation should not error
- The handler will gracefully handle entities that don't have movement components

## Notes

- The UNLOCK_MOVEMENT operation will be processed by the UnlockMovementHandler
- The handler uses updateMovementLock utility with `false` parameter to unlock
- This completes the movement lock cycle: kneel locks, stand unlocks
- The operation handles both legacy and anatomy-based entities automatically

## References

- Rule file: `data/mods/positioning/rules/stand_up.rule.json`
- Handler implementation: MOVLOCK-002
- Operation registration: MOVLOCK-004
- Related action: `data/mods/positioning/actions/stand_up.action.json`
- Paired rule update: MOVLOCK-005 (kneel_before.rule.json)
