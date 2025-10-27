# Activity Description Testing Guide

This document summarises the existing coverage for the Activity Description Composition
System and explains how to extend it when adding features.

## Test Suites

| Suite | Command | Purpose |
| --- | --- | --- |
| Unit | `npm run test:unit -- ActivityDescriptionService` | Validates service behaviour, caching, pronouns, grouping, and error handling. |
| Integration | `npm run test:integration -- BodyDescriptionComposer` | Exercises the full body composition pipeline with real modules and activity metadata. |
| Performance | `npm run test:performance -- ActivityDescription` | Measures throughput and ensures caching keeps latency below targets. |
| Memory | `npm run test:memory -- ActivityDescription` | Detects leaks when repeatedly generating descriptions. |

> Tip: All commands accept standard Jest flags. Use `--watch` during development or
> `--runInBand` when debugging race conditions.

## Key Test Files

* `tests/unit/anatomy/services/activityDescriptionService.test.js` – comprehensive coverage
  of inline metadata, dedicated metadata, pronoun logic, grouping, context awareness, and
  cache invalidation.
* `tests/unit/anatomy/bodyDescriptionComposer.activityIntegration.test.js` – validates that
  the composer requests activity descriptions at the correct point in the pipeline and handles
  empty strings safely.
* `tests/integration/anatomy/activityDescriptionIntegration.test.js` – runs discovery against
  real mod data, ensuring metadata from multiple sources is merged correctly.
* `tests/integration/anatomy/activityDescriptionConfiguration.test.js` – confirms
  configuration overrides (prefixes, max counts, pronouns) are honoured.
* `tests/performance/anatomy/activityDescriptionPerformance.test.js` – benchmark harness for
  high-volume generation with mock data.
* `tests/memory/anatomy/bodyDescriptionComposer.memory.test.js` – ensures caches do not leak
  when descriptions are regenerated repeatedly.

## Adding New Tests

1. **Choose the right level** – unit tests for isolated helpers, integration tests for
   pipeline behaviour, and performance/memory tests for regressions.
2. **Leverage test hooks** – `ActivityDescriptionService.getTestHooks()` exposes utilities for
   constructing deterministic metadata arrays without touching private fields.
3. **Use fixtures** – existing fixtures under `tests/common/anatomy/` provide mocked entities,
   formatting services, and registries to reduce setup noise.
4. **Assert events** – subscribe to `ACTIVITY_DESCRIPTION_ERROR` when validating error paths.
5. **Schema validation** – update or add tests under `tests/unit/schemas/` if you extend the
   metadata schema.

## Continuous Integration Expectations

* Keep unit and integration suites passing before merging. The project requires
  `npm run test:ci` in CI (unit + integration + e2e).
* Performance and memory suites are optional locally but must stay under documented targets
  (<50ms for 10 activities, no sustained growth in heap usage).
* Add regression tests for every bug fix to maintain confidence across releases.
