# SENAWAPEREVE-005: Create PerceptionFilterService and DI Registration

**Status**: COMPLETED
**Priority**: HIGH
**Effort**: Medium

## Summary

Create the perception filter service that determines what description each recipient should receive based on their sensory capabilities and environmental conditions (lighting). Register both new perception services in the DI container.

## File list it expects to touch

- **Create**: `src/perception/services/perceptionFilterService.js`
- **Create**: `tests/unit/perception/services/perceptionFilterService.test.js`
- **Modify**: `src/dependencyInjection/tokens/tokens-core.js` (add new tokens)
- **Modify**: `src/dependencyInjection/registrations/infrastructureRegistrations.js` (register services)

## Out of scope (must NOT change)

- Handler integration (handled in SENAWAPEREVE-007)
- Schema changes (handled in SENAWAPEREVE-001 and SENAWAPEREVE-006)
- Existing perception registry functionality
- Existing handlers
- LightingStateService implementation (assumed to exist)
- Creating new operation types

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPattern="perceptionFilterService"` passes
- `npm run test:unit -- --testPathPattern="tokens"` passes
- `npm run test:unit -- --testPathPattern="infrastructureRegistrations"` passes
- DI container resolves both services correctly

### Invariants that must remain true

- Service does not modify any entity state (read-only)
- Service does not modify input eventData
- Silent filtering when no fallback available (per spec - no error thrown)
- Omniscient types bypass all filtering
- Proprioceptive types only delivered to actor

## Implementation details

### DI Tokens (add to `tokens-core.js`)

```javascript
ISensoryCapabilityService: 'ISensoryCapabilityService',
IPerceptionFilterService: 'IPerceptionFilterService',
```

### Service Registration (add to `infrastructureRegistrations.js`)

```javascript
// SensoryCapabilityService
container.register(tokens.ISensoryCapabilityService, (c) => {
  return new SensoryCapabilityService({
    entityManager: c.resolve(tokens.EntityManager),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    logger: c.resolve(tokens.ILogger)
  });
}, { lifecycle: 'singleton' });

// PerceptionFilterService
container.register(tokens.IPerceptionFilterService, (c) => {
  return new PerceptionFilterService({
    sensoryCapabilityService: c.resolve(tokens.ISensoryCapabilityService),
    lightingStateService: c.resolve(tokens.ILightingStateService),
    logger: c.resolve(tokens.ILogger)
  });
}, { lifecycle: 'singleton' });
```

### PerceptionFilterService interface

```javascript
class PerceptionFilterService {
  /**
   * @param {Object} deps
   * @param {Object} deps.sensoryCapabilityService - Query entity senses
   * @param {Object} deps.lightingStateService - Query location lighting
   * @param {Object} deps.logger - Logging
   */
  constructor({ sensoryCapabilityService, lightingStateService, logger }) { ... }

  /**
   * Filter event for multiple recipients
   * @param {Object} eventData - Event details including perception_type, description_text, alternate_descriptions
   * @param {string[]} recipientIds - Entity IDs to filter for
   * @param {string} locationId - Location for lighting check
   * @param {string} actorId - Actor who performed action (for proprioceptive)
   * @returns {FilteredRecipient[]}
   */
  filterEventForRecipients(eventData, recipientIds, locationId, actorId) { ... }
}
```

### Return type

```javascript
/**
 * @typedef {Object} FilteredRecipient
 * @property {string} entityId - Recipient entity ID
 * @property {string|null} descriptionText - Text to show, or null if filtered
 * @property {string} sense - Sense used for perception ('visual', 'auditory', etc.)
 * @property {boolean} canPerceive - Whether recipient can perceive the event
 */
```

### Filtering logic flow

1. Get perception type metadata (via registry helpers from SENAWAPEREVE-002)
2. For each recipient:
   a. If recipient is actor AND type is proprioceptive → always perceive via visual
   b. If type is omniscient → always perceive via 'omniscient' sense
   c. Get recipient's sensory capabilities (via SensoryCapabilityService)
   d. Check primary sense:
      - If visual: check `locationLighting !== 'dark'` AND `canSee`
      - If auditory: check `canHear`
      - If olfactory: check `canSmell`
      - If tactile: check `canFeel` (always true)
   e. If primary sense available → use `description_text`, sense = primarySense
   f. If primary unavailable, try fallback senses in order:
      - Check each fallback sense availability
      - If available AND `alternate_descriptions[sense]` exists → use that text
   g. If no fallback works AND `alternate_descriptions.limited` exists → use that
   h. Otherwise → `canPerceive: false`, `descriptionText: null`

### Test scenarios

1. Visual event in lit room, sighted recipient → receives visual description
2. Visual event in dark room, sighted recipient → filtered (or auditory fallback)
3. Visual event, blind recipient with auditory fallback → receives auditory text
4. Auditory event, deaf recipient → filtered (or tactile fallback)
5. Omniscient event (error) → all recipients receive it
6. Proprioceptive event → only actor receives it
7. Event with `limited` fallback → used when all senses fail
8. Event with no fallbacks, recipient can't perceive → canPerceive false

## Dependencies

- SENAWAPEREVE-002 (registry sense helper functions)
- SENAWAPEREVE-003 (SensoryCapabilityService)

## Dependent tickets

- SENAWAPEREVE-007 (handlers use this service)

## Outcome

**Completed**: 2025-12-17

### Implementation Summary

All acceptance criteria met:

1. **Created PerceptionFilterService** (`src/perception/services/perceptionFilterService.js`)
   - Implements filtering logic per spec
   - Uses registry helpers: `getPrimarySense`, `getFallbackSenses`, `isOmniscient`
   - Returns `FilteredRecipient[]` with `{entityId, descriptionText, sense, canPerceive}`

2. **Added DI Tokens** (`src/dependencyInjection/tokens/tokens-core.js`)
   - `ISensoryCapabilityService`
   - `IPerceptionFilterService`

3. **Registered Services** (`src/dependencyInjection/registrations/infrastructureRegistrations.js`)
   - SensoryCapabilityService (singleton)
   - PerceptionFilterService (singleton)

4. **Created Comprehensive Tests** (`tests/unit/perception/services/perceptionFilterService.test.js`)
   - 23 tests covering all 8 ticket scenarios
   - Tests for input validation, invariants, and edge cases
   - All tests pass

### Test Results

- `tests/unit/perception/services/perceptionFilterService.test.js`: 23/23 passed
- `tests/unit/dependencyInjection/`: 385 tests passed
- `tests/unit/perception/`: 129 tests passed

### Ticket Correction

Fixed token reference discrepancy in ticket: Changed `tokens.IBodyGraphService` to `tokens.BodyGraphService` (line 60) to match actual codebase token.
