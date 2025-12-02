# INJREPANDUSEINT-011: ActorDataExtractor LLM Extension

## Description

Add health state data to ActorPromptDataDTO and extend ActorDataExtractor.

## File List

| File | Action |
|------|--------|
| `src/turns/dtos/AIGameStateDTO.js` | MODIFY - add ActorHealthStateDTO, ActorInjuryDTO typedefs |
| `src/turns/services/actorDataExtractor.js` | MODIFY - add #extractHealthData method |
| `tests/unit/turns/services/actorDataExtractor.test.js` | MODIFY - add health extraction tests |

## Out of Scope

- XML building (INJREPANDUSEINT-012)
- UI components
- Service implementations

## Acceptance Criteria

### Tests That Must Pass

- All existing `actorDataExtractor.test.js` tests continue to pass
- New health extraction tests pass
- `npm run test:unit` passes
- `npx eslint src/turns/services/actorDataExtractor.js` passes

### Invariants

- `ActorHealthStateDTO` typedef added per spec section 8.1:
  ```javascript
  /**
   * @typedef {Object} ActorHealthStateDTO
   * @property {number} overallHealthPercent
   * @property {string} overallStatus - healthy|scratched|wounded|injured|critical|dying|dead
   * @property {ActorInjuryDTO[]} injuries
   * @property {string[]} activeEffects
   * @property {boolean} isDying
   * @property {number|null} turnsUntilDeath
   * @property {string|null} firstPersonNarrative
   */
  ```
- `ActorInjuryDTO` typedef added per spec section 8.1:
  ```javascript
  /**
   * @typedef {Object} ActorInjuryDTO
   * @property {string} partName
   * @property {string} partType
   * @property {string} state - healthy|scratched|wounded|injured|critical|destroyed
   * @property {number} healthPercent
   * @property {string[]} effects
   */
  ```
- `ActorPromptDataDTO` extended with `healthState` property
- `#extractHealthData(actorId)` private method:
  - Uses `InjuryAggregationService` to get injury summary
  - Uses `InjuryNarrativeFormatterService` for first-person narrative
  - Returns `null` for healthy characters (optimization to reduce token usage)
  - Returns `ActorHealthStateDTO` for injured characters

## Dependencies

- INJREPANDUSEINT-003 (InjuryAggregationService)
- INJREPANDUSEINT-006 (InjuryNarrativeFormatterService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 8.1 for DTO specification.
