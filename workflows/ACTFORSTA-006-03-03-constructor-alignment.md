# ACTFORSTA-006-03-03: Align ActionFormattingStage constructor with coordinator needs

## Summary
Reconcile the `ActionFormattingStage` constructor so it keeps building the decider, strategies, factories, and services
required by `ActionFormattingCoordinator`, while removing any state that belonged to deleted helper flows.

## Tasks
- Review the current constructor for `ActionFormattingStage` to catalog all instantiated collaborators and injected services.
- Ensure the constructor continues to build or receive the decider, strategy list, error factory, legacy fallback formatter,
  target normalization service, formatter helpers, logger, dispatcher, and validation utilities expected by the coordinator.
- Remove constructor parameters, assignments, or property initializers that fed only the removed helper methods.
- Update documentation or inline comments so future maintainers understand that the stage now serves primarily as a wiring layer.

## Acceptance Criteria
- Constructor only initializes the collaborators needed for coordinator delegation; no unused class properties remain.
- Unit or integration bootstrapping code that creates the stage still compiles without modification, or is updated accordingly.
- Comments accurately describe the stage’s role as a thin adapter over `ActionFormattingCoordinator`.
