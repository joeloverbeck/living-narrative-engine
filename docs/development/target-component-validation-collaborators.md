# Target Component Validation Collaborator Guide

## Overview

The target component validation stage coordinates several collaborators to keep
multi-target action discovery predictable. This guide summarizes each role and
highlights the data flow so new contributors can extend the stage without
studying the 600+ line implementation file.

## Collaborator Responsibilities

### TargetValidationIOAdapter

- Normalizes the pipeline context into `{ format, items, metadata }`.
- Ensures every validation item carries resolved targets, target definitions,
  and a pointer back to the original structure for reconstruction.
- Removes the actor entry when rebuilding payloads so downstream stages see the
  same shape they provided.

### TargetCandidatePruner

- Receives normalized items and trims target candidates that fail required
  component checks.
- Emits rich removal metadata (role, placeholder, reason) that the reporter and
  emitter can surface to traces or debugging tools.
- Accepts registry helpers and placeholder definitions so future roles are
  immediately supported.

### TargetComponentValidator & TargetRequiredComponentsValidator

- Execute forbidden and required component checks, respectively, using the
  canonical target maps provided by the adapter/pruner.
- Each validator imports role definitions from `TargetRoleRegistry` to avoid
  drifting when new roles are introduced.

### TargetValidationReporter

- Receives stage lifecycle events and per-action summaries.
- Writes structured data into action-aware traces when available while remaining
  a no-op when tracing is disabled.
- Surface-level warnings/errors continue to flow through the injected logger to
  keep behaviour familiar to existing dashboards.

### ContextUpdateEmitter

- Applies immutable validation results back to the mutable pipeline context.
- Synchronises `actionsWithTargets` and `candidateActions` collections without
  exposing actor metadata to downstream consumers.
- Returns a per-action result description that upstream orchestrators can log or
  expose to developer tooling.

## Dependency Injection Expectations

The `ActionPipelineOrchestrator` now accepts optional overrides for the pruner,
config provider, reporter, and context emitter. If not provided, the
orchestrator instantiates the default implementations once and reuses them for
all stage executions. This keeps the stage constructor simple while allowing
mods, debugging harnesses, or tests to inject custom collaborators.

```js
const orchestrator = new ActionPipelineOrchestrator({
  // existing dependencies...
  targetCandidatePruner: new TargetCandidatePruner({ logger }),
  targetValidationConfigProvider: new TargetValidationConfigProvider(),
  targetValidationReporter: new TargetValidationReporter({ logger }),
  contextUpdateEmitter: new ContextUpdateEmitter(),
});
```

## Extension Points

1. **Adding a New Target Role**
   - Update `TargetRoleRegistry` with the new constant.
   - Validators and utilities automatically consume the registry, so no further
     edits are required unless special placeholder behaviour is desired.

2. **Custom Reporting**
   - Supply an alternative reporter via the orchestrator to capture validation
     analytics in bespoke formats.
   - The injected reporter must implement the `reportStageSkipped`,
     `reportStageStart`, `reportStageCompletion`, `reportValidationAnalysis`, and
     `reportPerformanceData` methods.

3. **Experimental Pruning Strategies**
   - Provide a different pruner implementation that conforms to the
     `TargetCandidatePruner` interface. The stage only depends on the `prune`
     method and its structured return payload.

## Data Flow Recap

1. Orchestrator calls `TargetValidationIOAdapter.normalize` to produce canonical
   items.
2. The pruner filters candidates and records removals.
3. Validators run forbidden and required checks on the filtered targets.
4. Reporter captures trace events and timing information.
5. The adapter rebuilds outputs and the emitter applies the final state back to
   the pipeline context.

Each collaborator owns a narrow responsibility, making the validation stage
simpler to reason about and safer to extend.
