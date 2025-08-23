# MOVLOCK-005: Update Kneel Before Rule

**Status**: NOT_STARTED  
**Priority**: MEDIUM  
**Dependencies**: MOVLOCK-004  
**Estimated Effort**: 0.5 hours

## Context

The `kneel_before` action needs to lock movement when an actor kneels. This is accomplished by adding a LOCK_MOVEMENT operation to the rule that processes the kneel action. The operation must be placed after the kneeling component is added but within the same rule execution flow.

## Implementation Steps

### 1. Locate and Open Rule File

**File**: `data/mods/positioning/rules/kneel_before.rule.json`

### 2. Identify Insertion Point

Find the ADD_COMPONENT operation that adds the kneeling component. It should look similar to:

```json
{
  "type": "ADD_COMPONENT",
  "comment": "Add kneeling component to actor",
  "parameters": {
    "entity_id": "{event.payload.actorId}",
    "component_id": "positioning:kneeling",
    "data": {
      "target_id": "{event.payload.targetId}"
    }
  }
}
```

### 3. Add Lock Movement Operation

Insert the following operation immediately AFTER the ADD_COMPONENT operation (around line 33):

```json
{
  "type": "LOCK_MOVEMENT",
  "comment": "Lock movement while kneeling (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
```

**Important**:

- Add a comma after the closing brace of the ADD_COMPONENT operation
- Ensure proper JSON formatting and indentation
- The comment explains the operation's purpose
- The parameter name must be `actor_id` (matching what the handler expects)

### 4. Complete JSON Structure

The operations array should look like this after modification:

```json
"operations": [
  // ... other operations before ...
  {
    "type": "ADD_COMPONENT",
    "comment": "Add kneeling component to actor",
    "parameters": {
      "entity_id": "{event.payload.actorId}",
      "component_id": "positioning:kneeling",
      "data": {
        "target_id": "{event.payload.targetId}"
      }
    }
  },
  {
    "type": "LOCK_MOVEMENT",
    "comment": "Lock movement while kneeling (handles both legacy and anatomy entities)",
    "parameters": {
      "actor_id": "{event.payload.actorId}"
    }
  },
  // ... other operations after ...
]
```

### 5. Implementation Checklist

- [ ] Open `data/mods/positioning/rules/kneel_before.rule.json`
- [ ] Locate the ADD_COMPONENT operation for positioning:kneeling
- [ ] Add comma after the ADD_COMPONENT operation's closing brace
- [ ] Insert LOCK_MOVEMENT operation with proper indentation
- [ ] Verify parameter is named `actor_id`
- [ ] Verify parameter value is `"{event.payload.actorId}"`
- [ ] Add descriptive comment
- [ ] Ensure JSON remains valid (proper commas, braces)

## Validation Criteria

1. **Valid JSON**: File must parse as valid JSON
2. **Operation placement**: LOCK_MOVEMENT comes after ADD_COMPONENT
3. **Parameter name**: Uses `actor_id` not `entity_id`
4. **Parameter value**: References `{event.payload.actorId}`
5. **Comment present**: Explains the operation's purpose
6. **Comma placement**: Proper comma separation between operations

## Testing Requirements

After implementation:

1. Validate JSON syntax: Use a JSON validator or `npm run build`
2. Check rule loading: Start the application and check for rule parsing errors
3. Manual test:
   - Have an actor kneel before another
   - Attempt to move the kneeling actor
   - Movement should be blocked

## JSON Formatting Guidelines

- Use 2-space indentation
- Keep consistent with existing file formatting
- Place commas at the end of objects/arrays (except last item)
- Use descriptive comments for operations

## Error Prevention

1. **Invalid JSON**: Use a JSON validator before saving
2. **Wrong parameter name**: Must be `actor_id`, not `entity_id` or other variations
3. **Missing comma**: Add comma after previous operation
4. **Extra comma**: Don't add comma if this is the last operation
5. **Wrong event path**: Use `event.payload.actorId` with proper casing

## Notes

- The LOCK_MOVEMENT operation will be processed by the LockMovementHandler
- The handler uses updateMovementLock utility which handles both entity types automatically
- The rule engine will pass the actorId from the event payload to the handler
- This change only affects actors who kneel, not other positioning actions

## References

- Rule file: `data/mods/positioning/rules/kneel_before.rule.json`
- Handler implementation: MOVLOCK-001
- Operation registration: MOVLOCK-004
- Related action: `data/mods/positioning/actions/kneel_before.action.json`
