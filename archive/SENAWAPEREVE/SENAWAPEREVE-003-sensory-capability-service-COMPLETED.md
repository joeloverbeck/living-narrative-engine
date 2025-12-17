# SENAWAPEREVE-003: Create SensoryCapabilityService

**Status**: COMPLETED
**Priority**: HIGH
**Effort**: Medium

## Summary

Create a new service that queries an entity's sensory capabilities from anatomy components. This service checks for functioning sensory organs (eyes, ears, nose) and returns a capability object. It also checks for an optional manual override component.

### Assumption Corrections (discovered during implementation)

1. **Part non-functionality has THREE conditions** (not just `destroyed` state):
   - `anatomy:part_health.state === 'destroyed'` (health depleted to 0)
   - Part has `anatomy:dismembered` component (severed but still present in graph)
   - Part is missing entirely (detached via `detachPart()` - not returned by `findPartsByType()`)

2. **No "missing" state exists** - The `anatomy:part_health.state` enum only has: `healthy`, `scratched`, `wounded`, `injured`, `critical`, `destroyed`. Missing parts are simply absent from query results.

3. **Only `destroyed` = non-functional** - Parts at `critical` or other damaged states still function for sensory purposes (user-confirmed design decision).

## File list it expects to touch

- **Create**: `src/perception/services/sensoryCapabilityService.js`
- **Create**: `tests/unit/perception/services/sensoryCapabilityService.test.js`

## Out of scope (must NOT change)

- DI registration (handled in SENAWAPEREVE-005)
- Handler integration (handled in SENAWAPEREVE-007)
- The `perception:sensory_capability` component definition (handled in SENAWAPEREVE-004)
- Any existing perception files
- Any anatomy service modifications
- Lighting checks (handled in PerceptionFilterService)
- Caching of results (per spec: recompute per event)

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPattern="sensoryCapabilityService"` passes
- All unit tests for the new service pass

### Invariants that must remain true

- Service does not modify any entity state (read-only)
- Returns consistent results for same entity state
- No caching - capabilities recomputed on each call (per spec)
- Backward compatibility: entities without anatomy return all senses available
- `canFeel` always returns true (tactile sense always available per spec)

## Implementation details

### Service interface

```javascript
class SensoryCapabilityService {
  /**
   * @param {Object} deps
   * @param {Object} deps.entityManager - Entity retrieval
   * @param {Object} deps.bodyGraphService - Anatomy queries
   * @param {Object} deps.logger - Logging
   */
  constructor({ entityManager, bodyGraphService, logger }) { ... }

  /**
   * Get sensory capabilities for an entity
   * @param {string} entityId - Entity to check
   * @returns {SensoryCapabilities}
   */
  getSensoryCapabilities(entityId) { ... }
}
```

### Return type

```javascript
/**
 * @typedef {Object} SensoryCapabilities
 * @property {boolean} canSee - Has functioning eyes
 * @property {boolean} canHear - Has functioning ears
 * @property {boolean} canSmell - Has functioning nose
 * @property {boolean} canFeel - Has tactile sense (always true)
 * @property {string[]} availableSenses - Array of available sense names
 */
```

### Logic flow

1. Check for `perception:sensory_capability` override component
   - If present with `overrideMode: 'manual'`, return manual values
2. Otherwise, query anatomy via `bodyGraphService.findPartsByType(entityId, partType)`
   - Eyes: `findPartsByType(entityId, 'eye')`
   - Ears: `findPartsByType(entityId, 'ear')`
   - Nose: `findPartsByType(entityId, 'nose')`
3. For each sensory organ type:
   - Get parts with that subType
   - A part is functioning if ALL of:
     - `anatomy:part_health.state !== 'destroyed'`
     - Part does NOT have `anatomy:dismembered` component
   - If at least one functioning part exists, that sense is available
   - If no parts are returned (missing/detached), that sense is unavailable
4. Special cases:
   - No anatomy component = assume all senses available (backward compatibility)
   - `canFeel` always returns true (per spec)
5. Build `availableSenses` array from capabilities:
   - Include 'visual' if canSee
   - Include 'auditory' if canHear
   - Include 'olfactory' if canSmell
   - Always include 'tactile'
   - Include 'proprioceptive' (always - self-perception)

### Test scenarios

1. Entity with healthy eyes, ears, nose → all senses available
2. Entity with destroyed eyes (state='destroyed') → canSee false, others true
3. Entity with destroyed ears → canHear false, others true
4. Entity with destroyed nose → canSmell false, others true
5. Entity with no anatomy component → all senses available (backward compat)
6. Entity with manual override component → uses override values
7. Entity with one destroyed eye but one healthy eye → canSee true
8. Entity with no eyes at all (empty array from findPartsByType) → canSee false
9. Entity with dismembered eyes (has anatomy:dismembered component) → canSee false

## Dependencies

- None (standalone service, but requires bodyGraphService to exist)

## Dependent tickets

- SENAWAPEREVE-005 (PerceptionFilterService uses this service)

## Outcome

### What was actually implemented vs originally planned

**Ticket Corrections Made:**
- Added "Assumption Corrections" section documenting three ways a body part can be non-functional (destroyed state, dismembered component, or missing from graph entirely)
- Clarified that no "missing" state exists in the enum - parts simply don't appear in query results
- Documented user-confirmed design decision: only `destroyed` state = non-functional (not `critical`)
- Added test scenario 9 for dismembered eyes

**Files Created:**
1. `src/perception/services/sensoryCapabilityService.js` - Main service implementation
2. `tests/unit/perception/services/sensoryCapabilityService.test.js` - 21 tests covering all 9 scenarios plus edge cases

**Implementation Details:**
- Used `BodyGraphService.findPartsByType(rootId, partType)` API (requires root entity ID, not the owner entity ID)
- `#isPartFunctioning()` checks both `anatomy:part_health.state === 'destroyed'` AND `anatomy:dismembered` component
- Backward compatibility preserved: entities without `anatomy:body` return all senses available
- `canFeel` always returns true per spec (tactile sense always available)
- `availableSenses` array includes: visual, auditory, olfactory, tactile, proprioceptive

**Test Results:** All 21 tests passing
