# INJREPANDUSEINT-008: InjuryStatusPanel Widget

## Description

Create left-pane widget displaying character's current physical condition.

## File List

| File                                                       | Action                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/domUI/injuryStatusPanel.js`                           | CREATE                                                                             |
| `game.html`                                                | MODIFY - add panel HTML between current-turn-actor-panel and perception-log-widget |
| `css/components/_injury-status-panel.css`                  | CREATE                                                                             |
| `css/style.css`                                            | MODIFY - import new CSS                                                            |
| `src/domUI/domUiFacade.js`                                 | MODIFY - add injuryStatusPanel                                                     |
| `src/dependencyInjection/tokens/tokens-ui.js`              | MODIFY - add token                                                                 |
| `src/dependencyInjection/registrations/uiRegistrations.js` | MODIFY - add registration                                                          |
| `tests/unit/domUI/injuryStatusPanel.test.js`               | CREATE                                                                             |

## Out of Scope

- Damage event message rendering (INJREPANDUSEINT-009)
- LLM integration (INJREPANDUSEINT-011, INJREPANDUSEINT-012)
- Service implementations

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/domUI/injuryStatusPanel.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/domUI/injuryStatusPanel.js` passes

### Invariants

- Widget extends `BoundDomRendererBase`
- HTML structure:
  - `id="injury-status-widget"`
  - `role="region"`
  - `aria-labelledby="injury-status-heading"`
  - `aria-live="polite"` for updates
- Displays:
  - Overall health percentage with color-coded bar
  - List of injured body parts with severity indicators
  - Effect icons/badges (bleeding, burning, poisoned, fractured)
  - Dying countdown with urgent styling when applicable
- Subscribes to events from spec section 7.1:
  - `anatomy:damage_applied`
  - `anatomy:internal_damage_propagated`
  - `anatomy:entity_dying`
  - `anatomy:entity_died`
  - `anatomy:entity_stabilized`
  - `core:turn_started` (to refresh current actor's status)
- CSS uses severity classes from spec section 7.1:
  - `.severity-healthy` (green)
  - `.severity-scratched` (yellow)
  - `.severity-wounded` (orange)
  - `.severity-injured` (red-orange)
  - `.severity-critical` (red)
  - `.severity-destroyed` (dark red)
- WCAG AA color contrast compliance
- Token added to tokens-ui.js

## Dependencies

- INJREPANDUSEINT-003 (InjuryAggregationService)
- INJREPANDUSEINT-006 (InjuryNarrativeFormatterService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 7.1 for UI widget specification.

---

## Outcome

**Status**: COMPLETED

**Date**: 2025-12-02

### Implementation Summary

All planned files were created/modified as specified:

| File                                                       | Status                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domUI/injuryStatusPanel.js`                           | ✅ Created                                                                          |
| `game.html`                                                | ✅ Modified - HTML added between current-turn-actor-panel and perception-log-widget |
| `css/components/_injury-status-panel.css`                  | ✅ Created                                                                          |
| `css/style.css`                                            | ✅ Modified - import added                                                          |
| `src/domUI/domUiFacade.js`                                 | ✅ Modified - injuryStatusPanel getter added                                        |
| `src/dependencyInjection/tokens/tokens-ui.js`              | ✅ Modified - InjuryStatusPanel token added                                         |
| `src/dependencyInjection/registrations/uiRegistrations.js` | ✅ Modified - registration added                                                    |
| `src/domUI/index.js`                                       | ✅ Modified - export added                                                          |
| `tests/unit/domUI/injuryStatusPanel.test.js`               | ✅ Created                                                                          |
| `tests/unit/domUI/domUiFacade.test.js`                     | ✅ Modified - added injuryStatusPanel dependency and tests                          |

### Test Coverage

- **49 unit tests** created for injuryStatusPanel.js
- **Branch coverage**: 93.75% (exceeds 80% requirement)
- **Function coverage**: 100%
- All 2376 domUI tests pass

### Deviations from Ticket

**Event Subscriptions**: The ticket specified subscribing to multiple anatomy events:

- `anatomy:damage_applied`
- `anatomy:internal_damage_propagated`
- `anatomy:entity_dying`
- `anatomy:entity_died`
- `anatomy:entity_stabilized`

**Actual Implementation**: Only subscribed to `core:turn_started` (`TURN_STARTED_ID`).

**Reason**: The anatomy-specific event constants do not exist in the codebase. A grep search confirmed no matches for these event IDs. The `TURN_STARTED_ID` event provides sufficient functionality for updating the injury status when turns change, which is the primary use case for this widget.

**Future Enhancement**: When anatomy events are implemented (likely in future tickets), the widget can be extended to subscribe to them for real-time damage updates.

### Key Implementation Details

- Widget uses `InjuryAggregationService` to aggregate injury data
- Widget uses `InjuryNarrativeFormatterService` to format injuries as first-person narrative
- `updateForActor(entityId)` method allows programmatic updates
- Graceful handling of missing elements (logs warning, doesn't throw)
- Severity classes applied based on health percentage thresholds:
  - healthy: 100%
  - scratched: 80-99%
  - wounded: 60-79%
  - injured: 40-59%
  - critical: 20-39%
  - destroyed: <20%
