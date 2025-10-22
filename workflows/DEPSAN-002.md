# DEPSAN-002: Break Entity Monitoring ↔ Service Initialization Circular Dependency Chain

## Summary
Multiple dependency-cruiser `no-circular` warnings originate from a single cycle: entity initialization code builds monitoring services, but the monitoring layer depends on `BaseService` → `serviceInitializerUtils.js` → `logic/types/executionTypes.js`, which re-imports `entities/entityManager.js`. That re-entry cascades through `createDefaultServicesWithConfig.js`, the mutation/ lifecycle services, and back into the monitoring classes, creating >15 reported cycles. We need to decouple execution context typing from the concrete `EntityManager` implementation (and any other high-level modules) so monitoring utilities and service infrastructure no longer pull the entire entity stack back in.

## Prerequisites
- Understanding of ES module evaluation order and how JSDoc `import()` typedefs are treated by dependency-cruiser.
- Comfort refactoring shared type definitions without breaking downstream documentation or tooling.
- Ability to run `npm run depcruise` and targeted Jest suites.

## Tasks
1. Confirm the exact import chain by inspecting `serviceInitializerUtils.js`, `logic/types/executionTypes.js`, and `entities/entityManager.js`. Document how typedef-only imports are still seen as dependencies by depcruise.
2. Design a new, cycle-free typing strategy for execution contexts:
   - Prefer referencing interfaces (`../interfaces/IEntityManager.js`, `IValidatedEventDispatcher`, etc.) or plain object typedefs that live in a leaf module with **no** runtime imports.
   - If richer structural typing is needed, create a dedicated `src/logic/types/executionContext.d.ts` (or `.js` with pure comments) that does not import from entity code paths.
3. Update `serviceInitializerUtils.js` (and any other consumers) to import the new leaf type definitions instead of `logic/types/executionTypes.js`, or adjust the existing file so it no longer imports `entities/entityManager.js` / other high-level modules.
4. Sweep the monitoring stack (`MemoryMonitor`, `MemoryPressureManager`, strategies, reporters, profiler) for any remaining imports that might resurrect the cycle (for example, ensure they only depend on logger helpers and interfaces, not entity managers).
5. Run `npm run depcruise` to verify all cycles reported in the original warning list are resolved. If new cycles appear, iterate until the dependency graph is acyclic for these modules.
6. Execute targeted tests covering entity lifecycle + monitoring interactions (e.g., `npm run test:unit -- entities` or the relevant suite) to ensure behaviour remains intact after refactoring.

## Acceptance Criteria
- `npm run depcruise` reports zero circular dependencies for the entity monitoring/service initialization chain described in the original warnings.
- Execution context type definitions no longer import `entities/entityManager.js` (or any other module that pulls entity services back into monitoring).
- Monitoring services remain functionally equivalent with passing tests.

## Validation
- Attach the clean `npm run depcruise` output.
- Provide proof of passing targeted tests that cover entity lifecycle + monitoring (list specific Jest files or commands).
