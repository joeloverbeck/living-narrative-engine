# EXPSIM-002: Bootstrap entry and controller scaffold

## Status
Completed

## Goal
Add the simulator entry point and a controller skeleton that wires DI services, initializes state, and binds the base DOM container for future behavior.

## File list
- src/expressions-simulator.js
- src/domUI/expressions-simulator/ExpressionsSimulatorController.js
- expressions-simulator.html
- scripts/build.config.js

## Out of scope
- No UI rendering of inputs or output text yet.
- No expression evaluation or dispatch logic.
- No tests added in this ticket.

## Acceptance criteria
### Specific tests that must pass
- No new tests required for this ticket.
- Relevant existing test suites should remain green (run subsets with --runInBand).

### Invariants that must remain true
- The bootstrap uses `CommonBootstrapper` with `containerConfigType: 'minimal'` and mod loading enabled.
- The minimal container already registers expression services; only call `registerExpressionServices(container)` if they are not registered.

## Implementation notes
- Resolve services listed in the spec and store references on the controller.
- Create placeholder methods for DOM binding, state init, and cleanup (no logic yet).
- Keep all code ASCII and consistent with existing ES module style.
- Wire the HTML page to the new entry bundle and include it in the build config.

## Outcome
- Added the expressions simulator entry bundle and controller scaffold with DOM binding and placeholder state setup.
- Wired `expressions-simulator.html` to load the bundle and added the entry/HTML to the build config so it ships.
- Adjusted scope to avoid duplicate expression-service registrations since the minimal container already includes them.
