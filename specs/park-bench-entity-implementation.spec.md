# Park Bench Entity Implementation Specification

## Overview

This specification defines the implementation of a park bench entity with dual seating capabilities for the Living Narrative Engine. The bench will be integrated into the p_erotica mod and utilize the existing `positioning:allows_sitting` component to provide two distinct seating locations for characters.

## Context Analysis

### Existing System Components

**allows_sitting Component Structure:**

- **Location**: `data/mods/positioning/components/allows_sitting.component.json`
- **ID**: `positioning:allows_sitting`
- **Schema**: Array of 1-10 spots where `null` = empty, `entityId` = occupied
- **Usage**: Sequential spot allocation (0→1→2) with atomic operations

**Current Park Location Reference:**

- **Location**: `.private/data/mods/p_erotica/entities/definitions/park.location.json`
- **Description**: References "a weathered bench whose wooden slats are silvered by years of rain and sun" but no actual bench entity exists
- **Context**: Literary style with detailed environmental descriptions

**Sitting Mechanics:**

- **Rules**: `handle_sit_down.rule.json` and `handle_get_up_from_furniture.rule.json`
- **Logic**: Atomic spot claiming with sequential fallback
- **Components**: Adds `positioning:sitting_on` with furniture_id and spot_index
- **Movement**: Locks actor movement while sitting

## Requirements

### Functional Requirements

1. **Entity Definition**: Create `p_erotica:park_bench` entity that:
   - Follows entity-definition schema structure
   - Uses proper namespaced ID format
   - Includes all required core components
   - Integrates seamlessly with existing park location

2. **Seating Configuration**: Implement dual seating using `positioning:allows_sitting`:
   - Exactly 2 seating spots: `[null, null]`
   - Compatible with existing atomic spot allocation
   - Supports concurrent occupancy by two actors
   - Properly handles sit/stand state transitions

3. **Visual Design**: Provide rich descriptive content:
   - Descriptive name matching literary style
   - Detailed description consistent with park aesthetic
   - Portrait integration following existing patterns
   - Consistent visual theming with park environment

4. **System Integration**: Ensure full compatibility:
   - Works with existing positioning rules
   - Proper event dispatching for perceptible actions
   - Correct spot management and cleanup
   - Integration with movement locking system

### Non-Functional Requirements

1. **Performance**: Minimal impact on existing systems
2. **Maintainability**: Clear, well-documented code structure
3. **Extensibility**: Design allows for future furniture additions
4. **Consistency**: Follows all established project patterns

## Implementation Details

### 1. Entity File: `data/mods/p_erotica/entities/definitions/park_bench.entity.json`

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "p_erotica:park_bench",
  "description": "A weathered park bench with two seating positions, worn smooth by years of use",
  "components": {
    "core:name": {
      "text": "weathered park bench"
    },
    "core:description": {
      "text": "This wooden bench bears the gentle marks of countless seasons and stories. Its slats, once golden oak, now wear the silvered patina of rain and sun, each board worn smooth by hands and bodies seeking rest. The wrought-iron frame curves in patient arcs at each end, painted black but showing hints of rust at the joints where moisture collects. Two distinct seating areas are separated by a subtle depression in the center plank, each spot worn to a comfortable hollow by years of use. The bench sits solidly on four legs, stable and welcoming, positioned to catch the filtered light that falls through the overhead canopy."
    },
    "core:portrait": {
      "imagePath": "portraits/park_bench.png",
      "altText": "A weathered wooden park bench with wrought-iron frame and two distinct seating areas"
    },
    "positioning:allows_sitting": {
      "spots": [null, null]
    }
  }
}
```

### 2. Integration Considerations

**Mod Manifest Updates:**

- Entity must be added to the `content.entities.definitions` array in mod-manifest.json
- Add "park_bench.entity.json" to the definitions list
- Follows established entity naming conventions

**Location Integration:**

- Bench entity can be placed in park location through instances
- Description complements existing park location narrative
- Maintains literary consistency with established style

**Rule Compatibility:**

- Existing `handle_sit_down.rule.json` supports 2-spot configuration
- Atomic operations work correctly with dual occupancy
- `handle_get_up_from_furniture.rule.json` properly clears spots
- No rule modifications required

### 3. Testing Strategy

**Unit Tests:**

```javascript
// Test entity structure validation
describe('Park Bench Entity', () => {
  it('should validate against entity-definition schema', () => {
    const entity = loadEntity('p_erotica:park_bench');
    expect(validateEntitySchema(entity)).toBe(true);
  });

  it('should have exactly 2 seating spots configured', () => {
    const entity = loadEntity('p_erotica:park_bench');
    const sittingComponent = entity.components['positioning:allows_sitting'];
    expect(sittingComponent.spots).toEqual([null, null]);
  });
});
```

**Integration Tests:**

```javascript
// Test dual occupancy scenarios
describe('Park Bench Seating Integration', () => {
  it('should allow two actors to sit simultaneously', async () => {
    const bench = createEntity('p_erotica:park_bench');
    const actor1 = createTestActor('actor1');
    const actor2 = createTestActor('actor2');

    // First actor sits
    await processAction('positioning:sit_down', actor1.id, bench.id);
    expect(bench.components['positioning:allows_sitting'].spots[0]).toBe(
      actor1.id
    );

    // Second actor sits
    await processAction('positioning:sit_down', actor2.id, bench.id);
    expect(bench.components['positioning:allows_sitting'].spots[1]).toBe(
      actor2.id
    );
  });

  it('should prevent third actor from sitting when full', async () => {
    const bench = createEntity('p_erotica:park_bench');
    // ... fill both spots ...
    const actor3 = createTestActor('actor3');

    const result = await processAction(
      'positioning:sit_down',
      actor3.id,
      bench.id
    );
    expect(result.success).toBe(false);
  });

  it('should properly clean up spots when actors stand', async () => {
    // ... test spot cleanup on stand up ...
  });
});
```

**User Experience Tests:**

- Verify bench appears in appropriate contexts
- Test narrative flow with dual occupancy
- Validate descriptive text rendering
- Ensure portrait displays correctly

### 4. File Structure

```
data/mods/p_erotica/
├── entities/
│   └── definitions/
│       ├── park.location.json           # existing
│       ├── park_bench.entity.json       # new
│       └── ...                          # other entities
├── portraits/
│   ├── park_bench.png                   # new portrait image
│   └── ...                              # other portraits
└── mod-manifest.json                    # existing, no changes needed
```

## Validation Criteria

### Acceptance Tests

1. **Entity Loading**:
   - ✅ Entity loads without schema validation errors
   - ✅ All required components are properly structured
   - ✅ Namespaced ID follows project conventions

2. **Seating Functionality**:
   - ✅ Two actors can sit simultaneously on the bench
   - ✅ Third actor cannot sit when bench is full
   - ✅ Actors can stand up and free their spots
   - ✅ Spot allocation follows sequential logic (0 then 1, with system supporting up to spot 2)

3. **System Integration**:
   - ✅ Works with existing positioning rules without modification
   - ✅ Movement locking functions correctly while sitting
   - ✅ Perceptible events are dispatched properly
   - ✅ Entity appears in game contexts appropriately

4. **Content Quality**:
   - ✅ Descriptions match established literary style
   - ✅ Visual elements integrate with park aesthetic
   - ✅ Naming conventions follow project standards
   - ✅ Portrait displays correctly in UI

### Success Metrics

- **Compatibility**: 100% compatibility with existing positioning system
- **Coverage**: Complete dual-occupancy test coverage
- **Performance**: No measurable impact on game performance
- **Maintainability**: Code follows all established project patterns

## Implementation Timeline

1. **Phase 1**: Entity structure definition and validation
2. **Phase 2**: Integration testing and rule compatibility verification
3. **Phase 3**: Portrait creation and visual integration
4. **Phase 4**: User acceptance testing and documentation

## Risk Assessment

**Low Risk Items**:

- Entity definition (follows established patterns)
- Component integration (uses existing allows_sitting)
- Rule compatibility (no modifications required)

**Medium Risk Items**:

- Portrait creation and integration
- Narrative consistency with existing content
- Edge cases in dual occupancy scenarios

**Mitigation Strategies**:

- Comprehensive integration testing
- Code review focusing on existing pattern compliance
- Staged deployment with validation at each step

## Conclusion

This specification provides a complete blueprint for implementing a park bench entity with dual seating capabilities. The design leverages existing system components and follows established patterns to ensure seamless integration while providing rich, immersive content that enhances the game experience.

The implementation requires minimal system changes while delivering significant gameplay value through the introduction of shared seating spaces that can facilitate character interactions and narrative opportunities.
