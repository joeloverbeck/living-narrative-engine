# ACTFORSTA-006-03-03: Keep ActionFormattingStage constructor focused on coordinator wiring

## Summary
`ActionFormattingStage` already functions as the wiring layer for the action-formatting pipeline. Its constructor instantiates
the decider, strategies, factories, and services required by `ActionFormattingCoordinator`, and no longer maintains state for
the legacy helper flows. This workflow tracks the standing audit to ensure the constructor stays lean and to document the
dependencies it passes to the coordinator.

## Tasks
- Catalogue the collaborators that the `ActionFormattingStage` constructor currently builds (strategies, decider, error factory,
  fallback formatter, target normalization service) and the injected services it forwards (command formatter, entity manager,
  dispatcher, logger, display-name helper, error context builder).
- Confirm that each constructor-initialised dependency is used either by the coordinator directly or by the strategies provided
  to the decider; flag any newly unused fields for follow-up cleanup.
- Add a brief inline comment or developer note explaining that the constructor is intentionally limited to coordinator wiring so
  future refactors avoid reintroducing helper-flow state here.

## Acceptance Criteria
- Constructor dependencies are documented, and there are no hidden or newly unused collaborators initialised by the stage.
- Bootstrapping code that constructs `ActionFormattingStage` remains valid without further changes.
- Inline guidance clarifies the constructor’s narrow role as a coordinator wiring layer.
