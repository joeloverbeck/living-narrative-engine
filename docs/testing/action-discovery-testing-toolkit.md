# Action Discovery Testing Toolkit

This addendum complements the consolidated [Mod Testing Guide](./mod-testing-guide.md) by detailing the **migration strategy and troubleshooting workflows** for suites that rely on the Action Discovery Bed. Reference the Mod Testing Guide for API signatures, matcher catalogs, and diagnostics commands.

## When to Use the Discovery Bed

Use the Action Discovery Bed when you need to:

- Validate discovery results before executing an action or reducer.
- Debug resolver behavior with scoped diagnostics (`includeDiagnostics`, `traceScopeResolution`).
- Incrementally modernize legacy suites that still manage their own `SimpleEntityManager` or bespoke entity factories.

If a suite only executes actions end-to-end, the mod fixture alone is sufficient.

## Modernization Checklist

| Priority | Indicators | First steps |
| --- | --- | --- |
| **High** | Manual `SimpleEntityManager` wiring, hand-built closeness components, bespoke logging. | Swap setup for `createActionDiscoveryBed()` and import the matchers module. Modernize a representative test end-to-end. |
| **Medium** | Stable suites still crafting entities by hand. | Adopt `createActorTargetScenario()` for setup, then phase in discovery matchers from the Mod Testing Guide. |
| **Low** | Experimental suites or factories that conflict with the bed. | Defer migration or wrap legacy helpers inside the bed incrementally. |

### Why migrate?

- Validation through `ModEntityBuilder.validate()` catches component drift immediately.
- Domain matchers eliminate repetitive `.some()` assertions and provide rich diagnostics.
- Diagnostics stay opt-in, so healthy suites remain silent while still allowing deep dives.

## Migration Workflow Snapshot

1. **Update imports** – Replace manual wiring with `createActionDiscoveryBed()` and register `../../common/actionMatchers.js`.
2. **Provision the bed** – Instantiate inside `beforeEach` or use `describeActionDiscoverySuite()` for shared lifecycle management.
3. **Rebuild entities** – Use `createActorTargetScenario()`/`createActorWithValidation()` and layer custom factories afterwards.
4. **Establish relationships** – Use `establishClosenessWithValidation()` instead of mutating component maps.
5. **Run discovery** – `await testBed.discoverActionsWithDiagnostics(actor)`; toggle diagnostics only while debugging.
6. **Assert with matchers** – Replace bespoke loops with `toHaveAction`, `toDiscoverActionCount`, or the shared domain matchers.
7. **Log deliberately** – Format diagnostics with `formatDiagnosticSummary()` and guard emission behind debug flags.

For code samples and extended explanations of each step, see the [Action Discovery Harness](./mod-testing-guide.md#action-discovery-harness) section of the Mod Testing Guide.

## Working with Diagnostics

- Call `discoverActionsWithDiagnostics(actorId, { includeDiagnostics, traceScopeResolution })` to capture operator and scope traces.
- Feed diagnostics into `formatDiagnosticSummary()` or `formatScopeEvaluationSummary()` for human-readable output during triage.
- Access captured logs via `getDebugLogs()`/`getInfoLogs()`/`getWarningLogs()`/`getErrorLogs()` when assertions should verify logging side effects.
- Prefer environment-gated logging (`if (process.env.DEBUG_DISCOVERY) { ... }`) to keep passing runs clean.

## Troubleshooting Cheatsheet

| Symptom | What it means | Fix |
| --- | --- | --- |
| `toHaveAction` is undefined | Matchers module not imported. | Import `../../common/actionMatchers.js` once per suite (consider `jest.setup.js`). |
| `Cannot establish closeness` error | Entity missing from the manager. | Build entities through bed helpers before linking or ensure legacy factories register them with the bed's manager. |
| Action unexpectedly missing | Pipeline filtered the action or prerequisites failed. | Enable diagnostics, inspect operator/scope evaluations, and confirm required components via scenario helpers. |
| Empty diagnostics payload | Tracing not enabled. | Pass `includeDiagnostics: true` (and optionally `traceScopeResolution`). |
| Excess actions discovered | Scenario includes extra targets or relationships. | Review closeness setup and adjust builder input or overrides. |

## Related Resources

- [Mod Testing Guide](./mod-testing-guide.md) – Centralized reference for fixtures, matchers, diagnostics, and helper catalogs.
- [`tests/common/actions/actionDiscoveryServiceTestBed.js`](../../tests/common/actions/actionDiscoveryServiceTestBed.js) – Source for the bed and discovery helpers.
- [`tests/common/scopeDsl/scopeTracingHelpers.js`](../../tests/common/scopeDsl/scopeTracingHelpers.js) – Low-level tracing utilities used by the bed.
- [`tests/common/mods/examples`](../../tests/common/mods/examples) – Example suites demonstrating how discovery and fixture tooling integrate.
