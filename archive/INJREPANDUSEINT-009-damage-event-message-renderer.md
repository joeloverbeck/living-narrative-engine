# INJREPANDUSEINT-009: DamageEventMessageRenderer

## Description

Create chat panel integration for rendering damage events.

## File List

| File                                                       | Action                                  |
| ---------------------------------------------------------- | --------------------------------------- |
| `src/domUI/damageEventMessageRenderer.js`                  | CREATE                                  |
| `css/components/_damage-messages.css`                      | CREATE                                  |
| `css/style.css`                                            | MODIFY - import new CSS                 |
| `src/domUI/domUiFacade.js`                                 | MODIFY - add damageEventMessageRenderer |
| `src/dependencyInjection/tokens/tokens-ui.js`              | MODIFY - add token                      |
| `src/dependencyInjection/registrations/uiRegistrations.js` | MODIFY - add registration               |
| `tests/unit/domUI/damageEventMessageRenderer.test.js`      | CREATE                                  |

## Out of Scope

- InjuryStatusPanel (INJREPANDUSEINT-008)
- Perception log modifications
- LLM integration

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/domUI/damageEventMessageRenderer.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/domUI/damageEventMessageRenderer.js` passes

### Invariants

- Subscribes to damage-related events:
  - `anatomy:damage_applied`
  - `anatomy:internal_damage_propagated`
  - `anatomy:entity_dying`
  - `anatomy:entity_died`
- Uses `queueMicrotask` batching pattern from spec section 7.2:
  - Collects multiple rapid events
  - Renders them in a single batch
  - Prevents UI flickering
- Creates message elements for `#message-list` container
- Uses CSS classes from spec section 7.2:
  - `.damage-message` (base class)
  - `.damage-message--minor` (low damage)
  - `.damage-message--moderate` (medium damage)
  - `.damage-message--severe` (high damage)
  - `.damage-message--critical` (critical/death)
  - `.damage-message--dying` (dying state)
  - `.damage-message--death` (death event)
- Token added to tokens-ui.js
- Messages include:
  - Attacker and target names
  - Body part affected
  - Damage amount/type
  - State change narrative

## Dependencies

- INJREPANDUSEINT-002 (Event Definitions)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 7.2 for message rendering specification.
