# MOVMODMIG-007: Update Cross-Mod References

## Overview
Update all references to movement components in other mods, particularly in the core and positioning mods, to use the new movement namespace.

## Current State
- **Core Mod**: `follow.action.json` references `core:actor-can-move`
- **Positioning Mod**:
  - `turn_around.action.json` references `core:actor-can-move`
  - `get_close.action.json` references `core:actor-can-move`
- **Compatibility Layer**: Not yet implemented

## Objectives
1. Update all cross-mod references to movement components
2. Implement compatibility layer for smooth transition
3. Test cross-mod communication
4. Update mod dependencies
5. Document breaking changes

## Technical Requirements

### Reference Updates

#### Core Mod - follow.action.json
```json
{
  "prerequisite": {
    "condition": "movement:actor-can-move"  // Update from core:
  }
}
```

#### Positioning Mod - turn_around.action.json
```json
{
  "prerequisite": {
    "condition": "movement:actor-can-move"  // Update from core:
  }
}
```

#### Positioning Mod - get_close.action.json
```json
{
  "prerequisite": {
    "condition": "movement:actor-can-move"  // Update from core:
  }
}
```

### Compatibility Layer Implementation
```json
// Location: data/mods/core/compatibility/movement-aliases.json
{
  "version": "1.0.0",
  "aliases": {
    "movement:go": "movement:go",
    "core:actor-can-move": "movement:actor-can-move",
    "core:exit-is-unblocked": "movement:exit-is-unblocked",
    "core:clear_directions": "movement:clear_directions",
    "core:event-is-action-go": "movement:event-is-action-go"
  },
  "deprecationWarnings": true,
  "removeInVersion": "2.0.0"
}
```

## Implementation Steps

### Step 1: Update Core Mod References
```javascript
const updateCoreReferences = () => {
  const followAction = 'data/mods/core/actions/follow.action.json';
  updateReference(followAction, 'core:actor-can-move', 'movement:actor-can-move');
};
```

### Step 2: Update Positioning Mod References
```javascript
const updatePositioningReferences = () => {
  const files = [
    'data/mods/positioning/actions/turn_around.action.json',
    'data/mods/positioning/actions/get_close.action.json'
  ];

  files.forEach(file => {
    updateReference(file, 'core:actor-can-move', 'movement:actor-can-move');
  });
};
```

### Step 3: Implement Compatibility Layer
```javascript
class CompatibilityResolver {
  resolve(reference) {
    const alias = this.aliases.get(reference);
    if (alias) {
      if (this.deprecationWarnings) {
        console.warn(`Deprecated: ${reference} is now ${alias}`);
      }
      return alias;
    }
    return reference;
  }
}
```

### Step 4: Update Mod Dependencies
```json
// positioning/mod-manifest.json
{
  "dependencies": ["core", "movement"]  // Add movement dependency
}
```

## Validation Criteria
- [ ] All cross-mod references updated
- [ ] Compatibility layer functional
- [ ] Deprecation warnings logged
- [ ] Mod dependencies correct
- [ ] No broken references

## Testing Requirements
```javascript
describe('Cross-Mod References', () => {
  it('should resolve movement dependencies from other mods', () => {
    const followAction = loadAction('core:follow');
    const condition = loadCondition(followAction.prerequisite.condition);
    expect(condition).toBeDefined();
    expect(condition.id).toBe('movement:actor-can-move');
  });

  it('should handle compatibility aliases', () => {
    const resolved = compatibilityResolver.resolve('core:actor-can-move');
    expect(resolved).toBe('movement:actor-can-move');
  });
});
```

## Risk Assessment

### Risks
1. **Breaking Changes**: Mods might break if compatibility layer fails
2. **Version Conflicts**: Different mod versions might be incompatible
3. **Runtime Errors**: References might not resolve at runtime

### Mitigation
1. Thorough testing of compatibility layer
2. Version constraints in manifests
3. Graceful error handling for missing references

## Dependencies
- **Requires**: MOVMODMIG-004, MOVMODMIG-005, MOVMODMIG-006
- **Blocks**: MOVMODMIG-009

## Estimated Effort
**Story Points**: 5
**Time Estimate**: 3-4 hours

## Acceptance Criteria
- [ ] All references updated successfully
- [ ] Compatibility layer works
- [ ] Cross-mod communication functional
- [ ] Tests pass
- [ ] No runtime errors
- [ ] Deprecation warnings logged correctly