# MOVMODMIG-006: Migrate Movement Scopes

## Overview
Migrate the clear_directions scope from core mod to movement mod, updating namespace references and ensuring proper scope resolution for direction availability.

## Current State
- **File**: `data/mods/core/scopes/clear_directions.scope`
- **ID**: `core:clear_directions`
- **References**: `core:exit-is-unblocked` condition

## Objectives
1. Migrate clear_directions.scope to movement mod
2. Update scope identifier to movement namespace
3. Update condition references within scope
4. Validate scope syntax and resolution
5. Update movement mod manifest

## Technical Requirements

### Scope Migration
```
// From: data/mods/core/scopes/clear_directions.scope
// To: data/mods/movement/scopes/clear_directions.scope

# Current format
core:clear_directions = actor.location.exits[{"==": [{"var": "blocked"}, false]}]

# Updated format
movement:clear_directions = actor.location.exits[{"condition": "movement:exit-is-unblocked"}]
```

## Implementation Steps

### Step 1: Copy Scope File
```bash
cp data/mods/core/scopes/clear_directions.scope data/mods/movement/scopes/
```

### Step 2: Update Scope Definition
```javascript
const updateScope = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Update scope identifier
  content = content.replace('core:clear_directions', 'movement:clear_directions');

  // Update condition references
  content = content.replace('core:exit-is-unblocked', 'movement:exit-is-unblocked');

  fs.writeFileSync(filePath, content);
};
```

### Step 3: Validate Scope Syntax
```bash
npm run scope:lint data/mods/movement/scopes/clear_directions.scope
```

### Step 4: Update Manifest
```json
{
  "content": {
    "scopes": ["movement:clear_directions"]
  }
}
```

## Validation Criteria
- [ ] Scope file exists in movement/scopes/
- [ ] Namespace updated to movement:
- [ ] Condition references updated
- [ ] Scope syntax validates
- [ ] Scope resolution works correctly

## Testing Requirements
```javascript
describe('Movement Scope', () => {
  it('should resolve clear directions correctly', () => {
    const scope = loadScope('movement:clear_directions');
    const result = resolveScope(scope, context);
    expect(result).toContainValidDirections();
  });
});
```

## Dependencies
- **Requires**: MOVMODMIG-001, MOVMODMIG-005
- **Blocks**: MOVMODMIG-007, MOVMODMIG-008

## Estimated Effort
**Story Points**: 2
**Time Estimate**: 1-2 hours

## Acceptance Criteria
- [ ] Scope migrated successfully
- [ ] Namespace references consistent
- [ ] Scope resolution functional
- [ ] Tests pass
- [ ] No errors in scope evaluation