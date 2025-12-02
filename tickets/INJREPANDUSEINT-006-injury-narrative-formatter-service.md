# INJREPANDUSEINT-006: InjuryNarrativeFormatterService

## Description

Create service that converts InjurySummaryDTO into first-person and third-person narrative descriptions.

## File List

| File | Action |
|------|--------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY - add token alphabetically |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY - add registration |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | CREATE |

## Out of Scope

- UI rendering (INJREPANDUSEINT-008, INJREPANDUSEINT-009)
- LLM XML building (INJREPANDUSEINT-012)
- Injury aggregation logic (INJREPANDUSEINT-003)

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/anatomy/services/injuryNarrativeFormatterService.js` passes

### Invariants

- Service extends appropriate base class and follows DI patterns
- `formatFirstPerson(summary)` method:
  - Returns sensory, internal experience narrative
  - Uses state-to-adjective mappings from spec section 5.2:
    - healthy → "feels fine"
    - scratched → "stings slightly"
    - wounded → "throbs painfully"
    - injured → "aches deeply"
    - critical → "screams with agony"
    - destroyed → "is completely numb"
  - Uses effect-to-description mappings from spec section 5.2:
    - bleeding → "blood flows from..."
    - burning → "searing heat radiates from..."
    - poisoned → "a sickening feeling spreads from..."
    - fractured → "sharp pain shoots through..."
  - Returns minimal message when character is healthy
- `formatDamageEvent(damageEventData)` method:
  - Returns third-person narrative for damage events
  - Includes attacker, target, body part, and damage amount
- Token `InjuryNarrativeFormatterService` added alphabetically to tokens-core.js

## Dependencies

- INJREPANDUSEINT-003 (InjuryAggregationService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 5.2 for narrative formatting specification.
