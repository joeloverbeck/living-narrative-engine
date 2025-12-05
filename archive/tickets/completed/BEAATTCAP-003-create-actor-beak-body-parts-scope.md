# BEAATTCAP-003: Create actor_beak_body_parts Scope with Body Part Resolution

## Status: ✅ COMPLETED

## Summary

Create a new scope `violence:actor_beak_body_parts` that returns the actor's body part entities where the `subType` contains "beak". This requires extending the scope DSL to support body part entity resolution.

## Motivation

The peck action needs to select which beak to attack with (for creatures with multiple beaks or to validate the actor has a beak). Existing scopes cannot return body part entities - they can only check for existence via operators.

## Critical Discovery

**⚠️ NEW CAPABILITY REQUIRED**: The current scope DSL does not support accessing body parts as resolvable entities. Existing operators (`hasPartOfType`, etc.) return boolean values, not entity collections. This ticket requires **extending the scope system** to support body part iteration.

## Implementation Summary

**Approach Used**: Option B - BodyPartStepResolver (dedicated resolver following ClothingStepResolver pattern)

The implementation extends the ScopeDSL system with:
1. A new `BodyPartStepResolver` that intercepts `body_parts` and `all_body_parts` field accesses
2. Returns access objects that `ArrayIterationResolver` recognizes and processes via `BodyGraphService`
3. Standard JSON Logic filtering with `{"in": [...]}` for substring matching

## Files Modified/Created

| File | Change Type | Description |
|------|-------------|-------------|
| `src/scopeDsl/nodes/bodyPartStepResolver.js` | **Created** | New resolver following ClothingStepResolver pattern |
| `src/scopeDsl/engine.js` | Modified | Registered resolver, passed BodyGraphService to ArrayIterationResolver |
| `src/scopeDsl/nodes/arrayIterationResolver.js` | Modified | Added handling for body part access objects |
| `data/mods/violence/scopes/actor_beak_body_parts.scope` | **Created** | Scope file with JSON Logic filter |
| `data/mods/violence/mod-manifest.json` | Modified | Added scopes array |
| `tests/unit/scopeDsl/nodes/bodyPartStepResolver.test.js` | **Created** | 29 unit tests |
| `tests/integration/scopes/violence/actorBeakBodyParts.integration.test.js` | **Created** | 10 integration tests |

## Out of Scope

- **DO NOT** modify existing scopes
- **DO NOT** change the JSON Logic operator implementations
- **DO NOT** alter body graph service logic
- **DO NOT** create additional scope types beyond what's needed for body parts

## Implementation Details

### Approach Chosen: BodyPartStepResolver (Option B - Recommended)

Following the established `ClothingStepResolver` pattern, a dedicated resolver was created that:
1. Intercepts `body_parts` field access on Step nodes
2. Returns body part access objects with `__isBodyPartAccessObject: true` marker
3. `ArrayIterationResolver` recognizes these objects and calls `BodyGraphService.getAllParts()`
4. Standard JSON Logic filtering applies to the resolved body part entity IDs

**Architecture Flow**:
```
actor.body_parts[]                      Resolution Flow:
     ↓                                  1. BodyPartStepResolver intercepts "body_parts"
[{ filter logic }]                      2. Returns body part access object
                                        3. ArrayIterationResolver recognizes object
                                        4. Calls BodyGraphService.getAllParts()
                                        5. Returns body part entity IDs as Set
                                        6. FilterResolver applies JSON Logic filter
```

### Syntax Correction

**Original Option A was incorrect** - `stringContains` operator does not exist. Standard JSON Logic uses `{"in": [substring, string]}` for substring matching.

**Correct Syntax**:
```
violence:actor_beak_body_parts := actor.body_parts[][{
  "and": [
    {"in": ["beak", {"var": "entity.components.anatomy:part.subType"}]},
    {"!=": [{"var": "entity.components.damage-types:damage_capabilities"}, null]}
  ]
}]
```

### Scope File Structure

```
data/mods/violence/scopes/
└── actor_beak_body_parts.scope
```

### Scope File Content (Final)

**File**: `data/mods/violence/scopes/actor_beak_body_parts.scope`

```
// Returns the actor's body part entities where subType contains "beak" and has damage capabilities
//
// BEHAVIOR: Iterates through all body parts in the actor's anatomy:body component
// and filters for those with:
// 1. subType containing "beak" (case-sensitive substring match)
// 2. A damage-types:damage_capabilities component (required for dealing damage)
//
// Example: For a creature with chicken_beak in their body graph, returns
// the entity ID of the beak body part so it can be used as an attack source.
//
// Usage: Primary target scope for peck_target action
violence:actor_beak_body_parts := actor.body_parts[][{
  "and": [
    {"in": ["beak", {"var": "entity.components.anatomy:part.subType"}]},
    {"!=": [{"var": "entity.components.damage-types:damage_capabilities"}, null]}
  ]
}]
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test for Resolver** (if using Option B/C):
   ```javascript
   describe('BodyPartsResolver or resolveBeakParts', () => {
     it('should return beak entity ID when actor has beak body part', () => {});
     it('should return chicken_beak entity ID when actor has chicken beak', () => {});
     it('should return tortoise_beak entity ID when actor has tortoise beak', () => {});
     it('should return empty array when actor has no beak', () => {});
     it('should filter out beaks without damage_capabilities', () => {});
     it('should return multiple beaks for multi-headed creatures', () => {});
   });
   ```

2. **Integration Test**:
   ```javascript
   describe('violence:actor_beak_body_parts scope', () => {
     it('should resolve to beak entity for kraken', async () => {
       // Create actor with beak in body graph
       // Resolve scope
       // Assert returns beak entity ID
     });

     it('should resolve to empty for human (no beak)', async () => {});
   });
   ```

3. **Scope Lint**: `npm run scope:lint` must pass

### Invariants That Must Remain True

1. **Existing Scopes Unchanged**: All existing scope resolutions continue to work
2. **Body Graph Integrity**: Body graph traversal logic remains correct
3. **Entity Manager Contract**: Entity lookups use standard patterns
4. **Performance**: Scope resolution doesn't significantly degrade action discovery performance

## Verification Commands

```bash
# Validate scope file syntax
npm run scope:lint

# Run scope-related unit tests
npm run test:unit -- --testPathPattern="scopeDsl" --silent

# Run integration tests
npm run test:integration -- --testPathPattern="actorBeakBodyParts" --verbose
```

## Dependencies

- BEAATTCAP-001 (beaks must have damage_capabilities)
- BEAATTCAP-002 (may need the operator for filtering)

## Blocked By

- None, but may require architectural consultation

## Blocks

- BEAATTCAP-004 (action needs this scope)

## Open Questions (from Spec) - ANSWERED

1. **Which approach is best?**
   - **Answer**: Option B (BodyPartStepResolver) - follows the established ClothingStepResolver pattern, is generalizable for future body-part-based scopes, and integrates cleanly with existing infrastructure.

2. **Does JSON Logic `in` support string substring matching?**
   - **Answer**: Yes! Standard JSON Logic `{"in": [substring, string]}` works for substring matching. The order matters: `{"in": ["beak", "chicken_beak"]}` returns true because "beak" is contained in "chicken_beak".

3. **Performance implications** of body graph traversal in scope resolution?
   - **Answer**: Acceptable. `BodyGraphService` already has internal caching. The resolver only retrieves body parts on demand when the `body_parts` field is accessed. For actors without the `anatomy:body` component, the resolver returns an empty set immediately.

## Notes

This implementation establishes a **pattern for future body-part-based scopes**:
- Use `actor.body_parts[]` to iterate over all body parts
- Apply JSON Logic filters with `entity.components.*` access pattern
- Substring matching uses `{"in": [substring, {"var": "path.to.string"}]}`
- Component existence checks use `{"!=": [{"var": "component.path"}, null]}`

**Key Files for Reference**:
- Pattern reference: `src/scopeDsl/nodes/clothingStepResolver.js`
- New resolver: `src/scopeDsl/nodes/bodyPartStepResolver.js`
- Integration: `src/scopeDsl/engine.js` (resolver registration)
- Array handling: `src/scopeDsl/nodes/arrayIterationResolver.js`
