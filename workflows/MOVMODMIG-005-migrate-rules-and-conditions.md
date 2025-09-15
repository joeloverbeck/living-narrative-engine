# MOVMODMIG-005: Migrate Rules and Conditions

## Overview
Migrate movement rules and conditions from core mod to movement mod, updating all namespace references and ensuring proper event handling.

## Current State
- **Rule**: `data/mods/core/rules/go.rule.json`
- **Conditions**: 
  - `data/mods/core/conditions/event-is-action-go.condition.json`
  - `data/mods/core/conditions/actor-can-move.condition.json`
  - `data/mods/core/conditions/exit-is-unblocked.condition.json`

## Objectives
1. Migrate go.rule.json to movement mod
2. Migrate all 3 condition files to movement mod
3. Update all namespace references from `core:` to `movement:`
4. Validate against schemas
5. Update movement mod manifest

## Technical Requirements

### Rule Migration
```json
// From: data/mods/core/rules/go.rule.json
// To: data/mods/movement/rules/go.rule.json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "handle_go_action",
  "name": "Handle Go Action",
  "condition_ref": "movement:event-is-action-go",  // Update reference
  "operations": [
    {
      "type": "move_entity",
      "entity": "{{actor}}",
      "to": "{{target}}"
    },
    {
      "type": "dispatch_event",
      "event": "entity_moved"
    }
  ]
}
```

### Condition Migrations

#### event-is-action-go.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "movement:event-is-action-go",  // Update from core:
  "logic": {
    "==": [
      {"var": "event.action"},
      "movement:go"  // Update reference
    ]
  }
}
```

#### actor-can-move.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "movement:actor-can-move",  // Update from core:
  "logic": {
    "and": [
      {"!=": [{"var": "actor.anatomy.legs"}, null]},
      {"==": [{"var": "actor.status.paralyzed"}, false]}
    ]
  }
}
```

#### exit-is-unblocked.condition.json
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "movement:exit-is-unblocked",  // Update from core:
  "logic": {
    "!=": [
      {"var": "exit.blocked"},
      true
    ]
  }
}
```

## Implementation Steps

### Step 1: Copy Rule File
```bash
cp data/mods/core/rules/go.rule.json data/mods/movement/rules/
```

### Step 2: Copy Condition Files
```bash
cp data/mods/core/conditions/event-is-action-go.condition.json data/mods/movement/conditions/
cp data/mods/core/conditions/actor-can-move.condition.json data/mods/movement/conditions/
cp data/mods/core/conditions/exit-is-unblocked.condition.json data/mods/movement/conditions/
```

### Step 3: Update Namespace References
```javascript
// Update script for rules and conditions
const updateNamespaces = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  // Update IDs
  if (data.id && data.id.startsWith('core:')) {
    data.id = data.id.replace('core:', 'movement:');
  }
  
  // Update condition references
  if (data.condition_ref && data.condition_ref.startsWith('core:')) {
    data.condition_ref = data.condition_ref.replace('core:', 'movement:');
  }
  
  // Update logic references
  const jsonStr = JSON.stringify(data, null, 2);
  const updated = jsonStr.replace(/"core:go"/g, '"movement:go"')
                         .replace(/"core:event-is-action-go"/g, '"movement:event-is-action-go"');
  
  fs.writeFileSync(filePath, updated);
};
```

### Step 4: Add Migration Metadata
```javascript
const addMetadata = (filePath, originalId) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.metadata = {
    migratedFrom: originalId,
    migrationDate: new Date().toISOString(),
    migrationTicket: "MOVMODMIG-005"
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};
```

### Step 5: Update Movement Mod Manifest
```json
{
  "content": {
    "actions": ["movement:go"],
    "rules": ["handle_go_action"],
    "conditions": [
      "movement:event-is-action-go",
      "movement:actor-can-move",
      "movement:exit-is-unblocked"
    ],
    "scopes": []
  }
}
```

## Validation Criteria
- [ ] All 4 files copied to movement mod
- [ ] Namespace references updated correctly
- [ ] Files validate against schemas
- [ ] Migration metadata added
- [ ] Movement mod manifest updated
- [ ] No broken references

## Testing Requirements

### Unit Tests
```javascript
describe('Movement Rules and Conditions', () => {
  it('should have movement namespace in all conditions', () => {
    const conditions = [
      'movement:event-is-action-go',
      'movement:actor-can-move',
      'movement:exit-is-unblocked'
    ];
    
    conditions.forEach(id => {
      const condition = loadCondition(id);
      expect(condition.id).toStartWith('movement:');
    });
  });
  
  it('should reference movement action in rule', () => {
    const rule = loadRule('handle_go_action');
    expect(rule.condition_ref).toBe('movement:event-is-action-go');
  });
});
```

### Integration Tests
```javascript
describe('Movement Rule Processing', () => {
  it('should trigger on movement:go action', () => {
    const event = { action: 'movement:go', actor: 'player', target: 'room2' };
    const rule = loadRule('handle_go_action');
    const result = processRule(rule, event);
    expect(result.success).toBe(true);
  });
});
```

## Risk Assessment

### Risks
1. **Event Processing**: Rules might not trigger with new namespace
2. **Condition Evaluation**: Logic might break with namespace changes
3. **Loading Order**: Dependencies might not resolve

### Mitigation
1. Test event flow thoroughly
2. Validate all JSON Logic expressions
3. Ensure proper manifest ordering

## Dependencies
- **Requires**: MOVMODMIG-001, MOVMODMIG-003, MOVMODMIG-004
- **Blocks**: MOVMODMIG-007, MOVMODMIG-008

## Estimated Effort
**Story Points**: 3
**Time Estimate**: 2-3 hours

## Acceptance Criteria
- [ ] Rule successfully migrated and functional
- [ ] All 3 conditions migrated and functional
- [ ] Namespace references consistent
- [ ] Schema validation passes
- [ ] Unit and integration tests pass
- [ ] Movement mod loads without errors
- [ ] Event processing works correctly

## Notes
- The actor-can-move condition is widely referenced - ensure compatibility
- Test rule processing with actual game events
- Consider logging when conditions are evaluated for debugging