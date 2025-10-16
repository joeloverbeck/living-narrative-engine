# TargetComponentValidationStage Hardening Specification

**Version**: 1.0
**Date**: 2025-01-11
**Status**: Draft
**Priority**: High (stability blocker for action discovery refactors)

## Executive Summary

`TargetComponentValidationStage` currently interleaves IO normalization, per-role filtering, validator orchestration, configuration toggles, and trace emissions inside a single 880+ line module. The stage must be resilient because it arbitrates whether an action survives discovery; however, the present design depends on implicit mutations and divergent data shapes, making recent changes brittle. This specification proposes a phased refactor that introduces explicit adapters, separates filtering concerns, and codifies shared role/target utilities so that new component requirements or pipeline stages can be added without breaking validation.

## Current State Assessment

### Responsibilities Concentrated in the Stage

- **Input Normalization & Output Mirroring** – `executeInternal` branches over `actionsWithTargets` vs. `candidateActions`, caches the chosen format, and later rehydrates return data to match the input shape.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L78-L198】
- **Configuration Fan-Out** – Each execution repeatedly re-resolves configuration snapshots via `isTargetValidationEnabled`, `targetValidationConfig`, `getValidationStrictness`, and `shouldSkipValidation`. Because every accessor recomputes `getActionPipelineConfig()` through a deep merge, the stage incurs multiple full config reads per run, including inside the per-action loop via `shouldSkipValidation`.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L101-L305】【F:src/config/actionPipelineConfig.js†L152-L233】
- **Target Filtering & Mutation** – Required-component filtering mutates `actionDef.resolvedTargets`, rewrites `context.actionsWithTargets[*].resolvedTargets`, prunes `targetContexts`, and applies placeholder-aware whitelists, all within `#filterTargetsByRequiredComponents` and `#updateActionTargetsInContext`.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L694】
- **Validator Coordination** – The stage invokes `TargetComponentValidator` (forbidden) and `TargetRequiredComponentsValidator` (required) sequentially, reconciling reasons and lenient-mode overrides before logging or tracing.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L232-L336】【F:src/actions/validation/TargetComponentValidator.js†L47-L140】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L52-L199】
- **Trace & Telemetry** – Validation outcomes, per-action performance metrics, and role-specific target entity identifiers are pushed directly to the trace API when available, duplicating per-role analysis logic inside the stage.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L309-L338】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L791-L858】

### Integration Touchpoints

- **Upstream** – `MultiTargetResolutionStage` feeds `actionsWithTargets` objects that contain `targetDefinitions`, `resolvedTargets`, and `targetContexts`. Target validation currently assumes that structure and mutates it in-place to stay in sync.【F:src/actions/pipeline/stages/MultiTargetResolutionStage.js†L1-L120】
- **Downstream** – Later stages rely on `actionDef.resolvedTargets` and `context.resolvedTargets` to reflect pruning results. Because the current stage mutates both ad hoc, consumers must understand both legacy and multi-target shapes.
- **Shared Validators** – Forbidden and required validators already encapsulate their specific logic but expect well-formed target maps. The stage partially re-implements required-component scanning to decide which candidates to pass into the validator, creating duplication and divergent failure reasons.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L417】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L90-L199】

### Pain Points Observed

1. **Shape Drift** – Any change to upstream resolution output (e.g., introducing new roles) requires editing multiple hard-coded role arrays in the stage, increasing regression risk.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L362-L365】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L842-L850】
2. **Implicit Mutation Contracts** – `#updateActionTargetsInContext` mutates both `context.actionsWithTargets` and `context.resolvedTargets` without returning explicit metadata, making it difficult to reason about stage boundaries and inviting accidental stale data in later stages.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】
3. **Configuration Overhead** – The stage re-fetches environment-derived configuration on every call and, via `shouldSkipValidation`, within every loop iteration. Each call performs a deep merge through `getActionPipelineConfig`, complicating strict/lenient testing and wasting cycles when processing large action sets.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L125-L305】【F:src/config/actionPipelineConfig.js†L152-L233】
4. **Duplicated Required-Component Logic** – Both the stage (`#filterTargetsByRequiredComponents`, `#candidateHasRequiredComponents`) and `TargetRequiredComponentsValidator` perform similar checks but express different failure reasons, leading to inconsistent messaging and double filtering.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L417】【F:src/actions/validation/TargetRequiredComponentsValidator.js†L90-L199】
5. **Trace Coupling** – Action-aware trace capture is tightly embedded in the validation loop, increasing surface area for regressions whenever the trace contract evolves. This also complicates running the stage in non-tracing contexts (unit tests, performance mode) because optional hooks are scattered throughout.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L309-L883】

## Target Architecture & Refactor Plan

### Goal Principles

- **Single Responsibility** – Separate IO adaptation, filtering, validator orchestration, and trace reporting into dedicated collaborators.
- **Explicit Contracts** – Return immutable `TargetValidationResult` objects that include filtered targets and removal metadata rather than mutating context implicitly.
- **Extensibility** – Centralize target-role knowledge and configuration so future roles (e.g., `quaternary`, `group`) only require updating shared utilities.

### Proposed Components

1. **`TargetValidationIOAdapter`**
   - Responsibility: Accept pipeline context, normalize to a canonical `{ actions, format, metadata }` structure, and rebuild the original shape for output.
   - Implementation: Extract from `executeInternal` the branching logic that flattens or reconstructs `actionsWithTargets` vs. `candidateActions` and the post-filter mirroring logic.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L78-L198】
   - Benefit: Future stages can consume a stable intermediate representation regardless of upstream format, isolating format churn.

2. **`TargetCandidatePruner` Service**
   - Responsibility: Given an action, resolved targets, and required-component rules, return filtered candidates plus removal reasons without mutating inputs.
   - Implementation: Move `#filterTargetsByRequiredComponents` and `#candidateHasRequiredComponents` into this service, and expose results that the existing `TargetRequiredComponentsValidator` can consume (e.g., by passing pruned targets back into the validator).【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L350-L417】
   - Alignment: Let `TargetRequiredComponentsValidator` operate on the already-pruned data to avoid double iteration, or augment the validator to accept pruner output via an interface change.【F:src/actions/validation/TargetRequiredComponentsValidator.js†L90-L199】

3. **`TargetRoleRegistry` Utility**
   - Responsibility: Provide canonical role lists, detect legacy vs. multi-target formats, and support placeholder lookups.
   - Implementation: Replace hard-coded arrays (`['primary','secondary','tertiary']`, etc.) with constants exported from a shared module so future roles only require updating the registry.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L362-L365】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L842-L850】

4. **`TargetValidationOrchestrator` (refined stage)**
   - Responsibility: Coordinate configuration evaluation, pruner invocation, validator calls, and trace hooks by delegating to injected services.
   - Implementation Adjustments:
     - Accept a `configProvider` dependency that surfaces a pre-resolved snapshot (`strictness`, `logging`, `skip lists`). Cache it per stage instance to avoid repeated deep merges.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L125-L305】【F:src/config/actionPipelineConfig.js†L165-L233】
     - Use immutable result objects from the pruner and validators. Rather than mutating `actionDef` or `context`, collect updates in a `StageUpdate` structure and hand it to the IO adapter for reconstruction.
     - Emit trace/telemetry by calling a dedicated `TargetValidationReporter` (see below).

5. **`TargetValidationReporter`**
   - Responsibility: Encapsulate trace/performance logging logic, providing no-op implementations when tracing is disabled.
   - Implementation: Extract from `#captureValidationAnalysis` and `#capturePerformanceData`, and have the stage pass it summary objects. Reporter can guard on trace capabilities internally.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L309-L883】

6. **`ContextUpdateEmitter` (optional)**
   - Responsibility: Apply target pruning results back to `actionsWithTargets` and `context.resolvedTargets` in a controlled, testable way.
   - Implementation: Move `#updateActionTargetsInContext` into a helper that accepts the immutable `StageUpdate`. This makes downstream dependencies explicit and allows regression tests for context synchronization.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L630-L694】

### Data Flow After Refactor

```
Pipeline Context
  │
  ▼
TargetValidationIOAdapter.normalize() -> { format, items: TargetValidationItem[] }
  │
  ▼
For each item:
  TargetCandidatePruner.prune()
  TargetComponentValidator.validate()
  TargetRequiredComponentsValidator.validate()
  TargetValidationReporter.report()
  │
  ▼
Collect TargetValidationResult[]
  │
  ▼
TargetValidationIOAdapter.rebuild(results) -> { data, continueProcessing }
  │
  ▼
ContextUpdateEmitter.apply(results)
```

## Implementation Phases

1. **Scaffolding & Tests**
   - Introduce the IO adapter and role registry with unit coverage to lock in current format behavior.
   - Write golden tests that feed both `actionsWithTargets` and `candidateActions` into the adapter to ensure parity.

2. **Pruner Extraction**
   - Move `#filterTargetsByRequiredComponents` and `#candidateHasRequiredComponents` into `TargetCandidatePruner`.
   - Update the stage to consume pruner results and stop mutating `actionDef` directly; instead, store updates for the emitter.
   - Add unit tests comparing pruner output with the existing validator to guarantee consistent failure reasons.

3. **Reporter & Config Injection**
   - Replace direct config calls with an injected `configSnapshot` (factory or provider) resolved once during construction.
   - Introduce the reporter to encapsulate trace/perf logging.
   - Ensure stage tests cover lenient/strict scenarios by mocking the snapshot rather than patching globals.

4. **Context Update Isolation**
   - Extract `#updateActionTargetsInContext` into `ContextUpdateEmitter`.
   - Adjust downstream stages (if necessary) to consume the emitter’s outputs rather than relying on incidental mutation.

5. **Cleanup & Documentation**
   - Remove duplicated role arrays and expose the registry constants to validators if beneficial.
   - Document the new collaborators in `specs/` and update dependency validation to reflect new interfaces.

## Risk Mitigation & Testing Strategy

- **Regression Harness** – Add integration tests that run `MultiTargetResolutionStage` + refactored validation stage together to confirm no behavioral drift for both legacy (`target_entity`) and multi-target actions.【F:src/actions/pipeline/stages/MultiTargetResolutionStage.js†L1-L120】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L739-L767】
- **Trace Contract Tests** – Provide reporter-focused tests that assert trace payload shapes without spinning up the entire pipeline, reducing coupling to `ActionAwareStructuredTrace` changes.【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L309-L883】
- **Configuration Snapshot Tests** – Validate that strictness toggles and skip lists respect the injected snapshot, ensuring parity with `shouldSkipValidation` semantics after the extraction.【F:src/config/actionPipelineConfig.js†L165-L233】
- **Performance Benchmarks** – Use existing performance harnesses to compare before/after throughput, ensuring configuration caching and pruner extraction do not introduce regressions.

## Phase 5 Regression Coverage (2025-02-10)

- Added an end-to-end regression suite that executes the real `MultiTargetResolutionStage` followed by `TargetComponentValidationStage` for both `candidateActions` and `actionsWithTargets`, asserting that context updates mirror adapter rebuilds and pruning metadata is preserved.【F:tests/integration/actions/pipeline/stages/TargetComponentValidationStage.regression.integration.test.js†L1-L318】
- Exercised telemetry hooks with a live `ActionAwareStructuredTrace`, verifying action-level analysis, performance payloads, and skip notifications flow through `TargetValidationReporter`.【F:tests/integration/actions/pipeline/stages/TargetComponentValidationStage.regression.integration.test.js†L320-L423】
- Demonstrated configuration snapshot reuse and cache invalidation using the injected `TargetValidationConfigProvider` to prevent redundant config loads while validating lenient mode behavior.【F:tests/integration/actions/pipeline/stages/TargetComponentValidationStage.regression.integration.test.js†L425-L486】【F:src/actions/pipeline/stages/TargetValidationConfigProvider.js†L19-L137】
- Introduced a dedicated performance benchmark that feeds 250 multi-target actions through the validation stage to capture a baseline for caching-sensitive regressions; available via `npm run test:performance`.【F:tests/performance/actions/targetValidationStage.performance.test.js†L1-L88】【F:package.json†L84-L87】

## Phase 6 Stabilization Summary (2025-03-02)

The closing stabilization pass focuses on consistency, documentation, and ensuring collaborators remain swappable through the dependency graph.

- **Role Registry Adoption** – All validators, utilities, and the command processor now import canonical role collections from `TargetRoleRegistry`, eliminating drift when new multi-target roles are introduced.【F:src/actions/validation/TargetComponentValidator.js†L7-L9】【F:src/utils/entityRefUtils.js†L11-L15】【F:src/commands/commandProcessor.js†L13-L14】
- **Dependency Injection Surface** – `ActionPipelineOrchestrator` receives explicit handles for the pruner, config provider, reporter, and context emitter so integrators can override collaborators without patching the stage directly.【F:src/actions/actionPipelineOrchestrator.js†L25-L39】【F:src/actions/pipeline/stages/TargetComponentValidationStage.js†L47-L75】
- **Documentation Alignment** – The IO adapter and collaborator overview now describe the end-to-end flow between adapter, pruner, validators, reporter, and emitter, giving new contributors a guided walkthrough of the stabilized architecture.【F:specs/target-validation-io-adapter.md†L1-L36】【F:docs/development/target-component-validation-collaborators.md†L1-L120】
- **Operational Guidelines** – Stakeholder briefing notes summarize behavioural parity expectations, new extension hooks, and migration tips for future pipeline experiments.【F:docs/development/action-discovery-target-validation-summary.md†L1-L80】

## Expected Outcomes

- Reduced stage size and complexity, making it feasible to reason about required/forbidden validation independently.
- Clear extension points for additional target roles or validation modes without touching the orchestration core.
- More deterministic testability via explicit adapters and reporters, preventing future regressions when upstream pipeline data formats evolve.
