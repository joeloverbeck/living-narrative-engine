# Socket Extractor Entity Resolution Robustness Specification

## Context

### Location
- **Primary File**: `src/anatomy/validation/socketExtractor.js`
- **Key Function**: `resolveEntityId()` (lines 403-490)

### What the Module Does
The socket extractor is responsible for:
1. **Extracting hierarchical socket definitions** from anatomy blueprints during recipe validation
2. **Resolving entity references** when multiple candidate entities match a slot's `partType`
3. **Validating slot-socket relationships** to ensure child slots can attach to parent sockets

The `resolveEntityId()` function specifically handles the case where multiple entity definitions match a given `partType` (e.g., multiple "head" entities across different mods). It applies a priority-based selection algorithm to choose the most appropriate entity.

### Architecture
- Part of the **recipe validation pipeline**
- Uses **dependency injection** with `IDataRegistry` for entity lookup
- Invoked by `extractHierarchicalSockets()` which orchestrates socket extraction from:
  - Root entity
  - Structure templates
  - Composed slots
  - Slot children

---

## Problem

### What Failed
Cross-namespace recipe validation failed for blueprints in the `anatomy-creatures` namespace (e.g., `cat_girl.recipe.json`, `ermine_folk_female.recipe.json`).

### How It Failed
The system produced 7+ validation errors:
```
Socket 'left_ear' not found on parent slot 'head'
Socket 'right_ear' not found on parent slot 'head'
Socket 'left_eye' not found on parent slot 'head'
Socket 'right_eye' not found on parent slot 'head'
Socket 'nose' not found on parent slot 'head'
Socket 'mouth' not found on parent slot 'head'
Socket 'brain_socket' not found on parent slot 'head'
```

### Why It Failed
The entity resolution algorithm prioritized **namespace matching** over **functional requirements**:

1. Blueprint `anatomy-creatures:cat_girl` extracted namespace `anatomy-creatures`
2. When resolving `partType: "head"`, two entities matched:
   - `anatomy-creatures:kraken_head` (no sockets defined)
   - `anatomy:humanoid_head` (has all required sockets)
3. **Namespace preference rule** selected `kraken_head` because it shared the blueprint's namespace
4. `kraken_head` lacks socket definitions → validation failed for all child slots

### Root Cause
The original priority rules were:
1. Namespace match (highest priority)
2. Fewer underscores in ID
3. Alphabetical order
4. Shorter ID

This ordering prioritized **organizational locality** over **functional compatibility**.

### Link to Tests
- **Primary Test**: `tests/integration/anatomy/socketExtractorNamespaceResolution.integration.test.js`
- **Pipeline Test**: `tests/integration/scripts/validateRecipe.integration.test.js`

---

## Truth Sources

### Schema Definitions
| Schema | Purpose |
|--------|---------|
| `data/schemas/anatomy.blueprint.schema.json` | Defines valid blueprint structure with slots and socket references |
| `data/schemas/anatomy.recipe.schema.json` | Defines recipe structure including `blueprintId` and slot overrides |
| `data/schemas/entity-definition.schema.json` | Defines entity structure including `anatomy:sockets` component |

### Domain Rules
1. **Socket Attachment Rule**: A child slot can only attach to a parent slot if the parent's entity has the required socket defined
2. **Part Type Matching**: Entities are candidates for a slot if their `anatomy:part.subType` matches the slot's `partType`
3. **Hierarchical Validation**: Parent entities must be resolved before child slots can validate their socket attachments

### External Contracts
- **IDataRegistry Interface**: Provides `getEntitiesBySubType(subType)` for entity lookup
- **Validation Report Format**: Errors follow `{ type: string, message: string, context: object }` structure

---

## Desired Behavior

### Normal Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Single entity matches `partType` | Return that entity |
| Multiple entities, one has required sockets | Prefer entity with sockets |
| Multiple entities with sockets, same namespace | Apply secondary tiebreakers |
| Cross-namespace resolution | Socket presence beats namespace preference |
| All entities have required sockets | Use namespace preference as tiebreaker |

### Edge Cases

#### 1. Empty Sockets Array
**Input**: Entity with `anatomy:sockets: { sockets: [] }`
**Expected**: Treat as "no sockets" - do not prefer over entities with actual sockets
**Rationale**: Empty array indicates intentional omission of sockets

#### 2. No Namespace in Blueprint Root
**Input**: `blueprint.root` is `null`, `undefined`, or missing colon separator
**Expected**: Skip namespace preference rule entirely; use remaining tiebreakers
**Rationale**: Cannot extract namespace from invalid/missing root

#### 3. Entity ID Without Colon
**Input**: Entity ID like `humanoid_head` (no namespace prefix)
**Expected**: Use entire ID as identifier; skip namespace comparison for this entity
**Rationale**: Legacy or special entities may lack namespace prefix

#### 4. Deep Hierarchy Chains (3+ Levels)
**Input**: Slot with grandchild attachments (e.g., torso → arm → hand → finger)
**Expected**: Resolve recursively; each level validates against its parent's sockets
**Rationale**: Anatomy can have arbitrary depth

#### 5. Circular Socket References
**Input**: Socket A references entity with socket pointing back to A
**Expected**: Detect cycle and break with error; do not infinite loop
**Rationale**: Malformed data should fail gracefully

#### 6. Multiple Entities with Identical Priority
**Input**: Two entities with same socket presence, namespace, underscore count
**Expected**: Deterministic selection via alphabetical ordering
**Rationale**: Reproducibility across runs is required

### Failure Modes

| Failure | Error Type | Message Pattern |
|---------|------------|-----------------|
| No matching entity for `partType` | `EntityNotFoundError` | `No entity found with partType "${partType}"` |
| Required socket missing on selected entity | Validation Error | `Socket '${socketName}' not found on parent slot '${slotName}'` |
| Invalid blueprint structure | Schema Validation Error | Reference to specific schema violation |
| Registry unavailable | Dependency Error | `IDataRegistry dependency not available` |

### Invariants

These properties MUST always hold:

1. **Socket Presence Priority**: Entities WITH sockets MUST be preferred over entities WITHOUT sockets when resolving slots that have child socket attachments

2. **Deterministic Resolution**: Given identical inputs (same blueprint, same registry state), `resolveEntityId()` MUST return the same entity every time

3. **Socket Completeness**: If the selected entity has sockets, it MUST have all sockets required by child slots (validation catches missing sockets)

4. **Namespace Extraction Safety**: Namespace extraction from `blueprint.root` MUST handle:
   - `null` / `undefined` values
   - Strings without colon separator
   - Empty strings

### API Contracts

#### Stable (Do Not Change)

```javascript
// Function signature
extractHierarchicalSockets(blueprint, options) → Map<slotName, socketDefinitions>

// Options structure
{
  registry: IDataRegistry,  // Required
  logger?: ILogger          // Optional
}

// Return type
Map<string, {
  socketName: string,
  parentSlot: string,
  entityId: string
}>

// Error types thrown
EntityNotFoundError  // When no entity matches partType
```

#### Validation Report Structure
```javascript
{
  errors: Array<{
    type: string,      // e.g., 'SOCKET_NOT_FOUND_ON_PARENT'
    message: string,   // Human-readable description
    context: {
      slotName: string,
      socketName: string,
      parentSlot: string,
      selectedEntity: string
    }
  }>
}
```

### What Is Allowed to Change

1. **Internal Tiebreaker Rules**: Order and weights of secondary priority rules (underscores, alphabetical, length)
2. **Logging Format**: Log messages and verbosity levels
3. **Cache Implementation**: Internal caching strategies for entity lookups
4. **Additional Metadata**: New fields can be added to return values (backward compatible)
5. **Performance Optimizations**: Internal algorithm changes that preserve behavior

---

## Testing Plan

### Tests to Add

| Test Case | Description | Priority |
|-----------|-------------|----------|
| Empty sockets array handling | Entity with `sockets: []` should not be preferred over entities with actual sockets | High |
| No namespace prefix | Entity ID like `humanoid_head` without colon should be handled gracefully | Medium |
| Null blueprint.root | Should skip namespace preference when root is null/undefined | High |
| Deep hierarchy (3+ levels) | Test grandchild slot resolution (e.g., torso → arm → hand) | Medium |
| Determinism verification | Same inputs always produce same resolution order | High |
| Mixed socket presence | Some entities have sockets, some don't, some have empty arrays | Medium |

### Regression Tests

Existing tests that must continue passing:

| Test File | Coverage |
|-----------|----------|
| `tests/integration/anatomy/socketExtractorNamespaceResolution.integration.test.js` | Cross-namespace resolution, socket preference |
| `tests/integration/scripts/validateRecipe.integration.test.js` | Full pipeline validation with real mods |

### Property Tests (Recommended)

#### 1. Idempotency
```javascript
// resolve(resolve(input)) === resolve(input)
// Re-running resolution with same input yields same result
```

#### 2. Determinism
```javascript
// for i in 1..100: resolve(input) === resolve(input)
// Multiple runs with identical input produce identical output
```

#### 3. Socket Coverage Guarantee
```javascript
// IF any candidate has required sockets
// THEN selected entity has required sockets
```

#### 4. Priority Ordering
```javascript
// IF entityA has sockets AND entityB lacks sockets
// THEN entityA is selected regardless of namespace
```

### Test Fixtures Required

```javascript
// Entity with sockets
{
  id: 'test:head_with_sockets',
  components: {
    'anatomy:part': { subType: 'head' },
    'anatomy:sockets': { sockets: ['left_ear', 'right_ear'] }
  }
}

// Entity without sockets
{
  id: 'test:head_without_sockets',
  components: {
    'anatomy:part': { subType: 'head' }
    // No anatomy:sockets component
  }
}

// Entity with empty sockets
{
  id: 'test:head_empty_sockets',
  components: {
    'anatomy:part': { subType: 'head' },
    'anatomy:sockets': { sockets: [] }
  }
}
```

---

## Current Implementation Status

### Priority Rules (As Implemented)

The current `resolveEntityId()` function uses these priority rules in order:

1. **Rule 0 (Highest)**: Prefer entities WITH sockets over entities WITHOUT sockets
2. **Rule 1**: Prefer entities from the same namespace as the blueprint
3. **Rule 2**: Prefer entities with fewer underscores in ID
4. **Rule 3**: Alphabetical ordering
5. **Rule 4**: Shorter ID length

### Fix Applied
The socket presence check (Rule 0) was added to ensure functional requirements take precedence over organizational locality.

### Remaining Work
- Add edge case tests documented above
- Verify determinism across all edge cases
- Consider adding circular reference detection
