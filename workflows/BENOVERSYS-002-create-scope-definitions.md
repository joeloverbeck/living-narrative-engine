# BENOVERSYS-002: Create Scope Definitions

## Overview
Create two scope definitions that enable the bending over system to identify valid targets: `available_surfaces` for finding bendable surfaces in the actor's location, and `surface_im_bending_over` for identifying the surface an actor is currently bent over.

## Prerequisites
- BENOVERSYS-001 completed (component definitions exist)
- Understanding of Scope DSL syntax
- Familiarity with JSON Logic operators

## Acceptance Criteria
1. `available_surfaces` scope correctly filters surfaces in actor's location
2. `surface_im_bending_over` scope correctly identifies current surface
3. Both scopes follow established naming conventions
4. Scopes validate against Scope DSL syntax
5. Integration with existing positioning scopes verified

## Implementation Steps

### Step 1: Create available_surfaces Scope
Create `data/mods/positioning/scopes/available_surfaces.scope`:

```
positioning:available_surfaces := entities(positioning:allows_bending_over)[][{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

**Breakdown:**
- `entities(positioning:allows_bending_over)` - Find all entities with the allows_bending_over component
- `[][]` - Array iteration operators (process all matching entities)
- JSON Logic filter ensures entity is in same location as actor
- Simpler than `available_furniture` - no spot availability check needed

### Step 2: Create surface_im_bending_over Scope
Create `data/mods/positioning/scopes/surface_im_bending_over.scope`:

```
positioning:surface_im_bending_over := entities(positioning:allows_bending_over)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:bending_over.surface_id"}
  ]
}]
```

**Breakdown:**
- `entities(positioning:allows_bending_over)` - Start with all bendable surfaces
- Filter to find the one matching the actor's current surface_id
- Used by the straighten_up action to identify target
- Returns empty if actor isn't bending over anything

### Step 3: Validate Scope Syntax
Run scope linting to ensure proper syntax:

```bash
# Validate all scope files in positioning mod
npm run scope:lint data/mods/positioning/scopes/

# Or validate individually
npm run scope:lint data/mods/positioning/scopes/available_surfaces.scope
npm run scope:lint data/mods/positioning/scopes/surface_im_bending_over.scope
```

### Step 4: Add Scopes to Mod Registry
Ensure scopes are registered in the scope loader configuration (if applicable):

```javascript
// In scope loader or manifest
{
  "scopes": [
    // ... existing scopes
    "positioning:available_surfaces",
    "positioning:surface_im_bending_over"
  ]
}
```

## Testing Requirements

### Unit Tests

1. **available_surfaces Scope Tests**:
```javascript
describe('available_surfaces scope', () => {
  it('should return surfaces in actor location', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'core:position': { locationId: 'kitchen:room' }
      }
    };

    const counter = {
      id: 'kitchen:counter',
      components: {
        'positioning:allows_bending_over': {},
        'core:position': { locationId: 'kitchen:room' }
      }
    };

    const tableElsewhere = {
      id: 'dining:table',
      components: {
        'positioning:allows_bending_over': {},
        'core:position': { locationId: 'dining:room' }
      }
    };

    const result = evaluateScope('positioning:available_surfaces', actor);
    expect(result).toContain(counter);
    expect(result).not.toContain(tableElsewhere);
  });

  it('should return empty array if no surfaces in location', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'core:position': { locationId: 'empty:room' }
      }
    };

    const result = evaluateScope('positioning:available_surfaces', actor);
    expect(result).toEqual([]);
  });
});
```

2. **surface_im_bending_over Scope Tests**:
```javascript
describe('surface_im_bending_over scope', () => {
  it('should return current surface when bending', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'positioning:bending_over': { surface_id: 'kitchen:counter' }
      }
    };

    const counter = {
      id: 'kitchen:counter',
      components: {
        'positioning:allows_bending_over': {}
      }
    };

    const result = evaluateScope('positioning:surface_im_bending_over', actor);
    expect(result).toEqual([counter]);
  });

  it('should return empty when not bending', () => {
    const actor = {
      id: 'test:actor',
      components: {}
    };

    const result = evaluateScope('positioning:surface_im_bending_over', actor);
    expect(result).toEqual([]);
  });
});
```

### Integration Tests

1. **Cross-Scope Compatibility**:
   - Verify scopes don't conflict with existing positioning scopes
   - Test that furniture can be both sittable and bendable
   - Ensure proper scope resolution in action target calculation

2. **Performance Tests**:
   - Measure scope evaluation time with many entities
   - Verify efficient filtering (early exit when possible)
   - Test with complex location hierarchies

## Code Examples

### Example Usage in Action Context
```javascript
// Finding available surfaces for bend_over action
const availableSurfaces = await scopeEngine.evaluate(
  'positioning:available_surfaces',
  actor,
  context
);

if (availableSurfaces.length === 0) {
  // No surfaces to bend over in this location
  return [];
}

// Each surface becomes a potential action target
return availableSurfaces.map(surface => ({
  actionId: 'positioning:bend_over',
  targetId: surface.id,
  targetName: surface.components['core:name']?.value || 'surface'
}));
```

### Example Scope Composition
```javascript
// Future enhancement: surfaces not occupied by sitting actors
positioning:unoccupied_surfaces := positioning:available_surfaces[{
  "none": [
    {"var": "entity.components.positioning:allows_sitting.spots"},
    {"!=": [{"var": ""}, null]}
  ]
}]
```

## Notes
- Scopes are simpler than sitting equivalents due to no position tracking
- JSON Logic filters ensure proper entity selection
- Scope names follow established pattern: available_X, X_im_Y_on/over
- Future scopes could add capacity limits or other constraints

## Dependencies
- Blocks: BENOVERSYS-003, BENOVERSYS-005, BENOVERSYS-006 (actions and rules need scopes)
- Blocked by: BENOVERSYS-001 (requires component definitions)

## Estimated Effort
- 30 minutes implementation
- 45 minutes testing and validation

## Risk Assessment
- **Low Risk**: Scopes are isolated and don't affect existing functionality
- **Mitigation**: Thorough testing with various entity configurations
- **Recovery**: Simple file deletion/modification if issues arise

## Success Metrics
- Both scope files created with correct syntax
- Scope DSL validation passes
- Scope evaluation returns expected entities
- Integration with action system confirmed