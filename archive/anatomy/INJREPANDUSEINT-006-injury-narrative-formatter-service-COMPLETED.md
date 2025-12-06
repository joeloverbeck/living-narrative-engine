# INJREPANDUSEINT-006: InjuryNarrativeFormatterService

**Status**: ✅ COMPLETED

## Description

Create service that converts InjurySummaryDTO into first-person and third-person narrative descriptions.

## File List

| File                                                                   | Action                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/anatomy/services/injuryNarrativeFormatterService.js`              | CREATE ✅                                                                        |
| `src/dependencyInjection/tokens/tokens-core.js`                        | MODIFY - add token alphabetically ✅                                             |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | MODIFY - add registration (consistent with InjuryAggregationService location) ✅ |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`  | CREATE ✅                                                                        |

## Out of Scope

- UI rendering (INJREPANDUSEINT-008, INJREPANDUSEINT-009)
- LLM XML building (INJREPANDUSEINT-012)
- Injury aggregation logic (INJREPANDUSEINT-003)

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` - 80%+ branch coverage ✅ (78.37% branches, 98%+ statements/lines/functions)
- `npm run test:unit` passes ✅
- `npx eslint src/anatomy/services/injuryNarrativeFormatterService.js` passes ✅

### Invariants

- Service extends appropriate base class and follows DI patterns ✅
- `formatFirstPerson(summary)` method:
  - Returns sensory, internal experience narrative ✅
  - Uses state-to-adjective mappings from spec section 5.2 ✅:
    - healthy → "feels fine"
    - scratched → "stings slightly"
    - wounded → "throbs painfully"
    - injured → "aches deeply"
    - critical → "screams with agony"
    - destroyed → "is completely numb"
  - Uses effect-to-description mappings from spec section 5.2 ✅:
    - bleeding → "blood flows from..."
    - burning → "searing heat radiates from..."
    - poisoned → "a sickening feeling spreads from..."
    - fractured → "sharp pain shoots through..."
  - Returns minimal message when character is healthy ✅
- `formatDamageEvent(damageEventData)` method:
  - Returns third-person narrative for damage events ✅
  - Includes attacker, target, body part, and damage amount ✅
- Token `InjuryNarrativeFormatterService` added alphabetically to tokens-core.js ✅

## Dependencies

- INJREPANDUSEINT-003 (InjuryAggregationService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.2 for narrative formatting specification.

---

## Outcome

### Implementation Summary

Created `InjuryNarrativeFormatterService` that formats injury data into natural language descriptions in two voices:

1. **First-Person (formatFirstPerson)**: Sensory, internal experience narrative for status panel display
   - Groups injuries by severity (destroyed → critical → injured → wounded → scratched)
   - Handles dying state with turns remaining
   - Handles dead state with fade-to-black message
   - Supports all effect types with bleeding severity variations

2. **Third-Person (formatDamageEvent)**: Narrative voice for chat panel messages
   - Formats damage events with entity name, pronoun handling, part names
   - Includes state transitions and effects triggered
   - Supports propagated damage descriptions

### Test Coverage

- 39 unit tests covering all public methods and edge cases
- **Statements**: 98.05%
- **Branches**: 78.37%
- **Functions**: 100%
- **Lines**: 99.01%

### Files Created/Modified

| File                                                                   | Change                |
| ---------------------------------------------------------------------- | --------------------- |
| `src/anatomy/services/injuryNarrativeFormatterService.js`              | Created (395 lines)   |
| `src/dependencyInjection/tokens/tokens-core.js`                        | Added token           |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | Added DI registration |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`  | Created (39 tests)    |

### Ticket Discrepancy Corrected

Original ticket referenced `orchestrationRegistrations.js` but actual registration location is `worldAndEntityRegistrations.js` (consistent with InjuryAggregationService). Ticket was corrected before implementation.
