# Activity Description Service Hardening

## Overview

This spec captures production hardening work discovered while auditing
`src/anatomy/services/activityDescriptionService.js`. The service already
implements the activity metadata pipeline, but several resilience gaps allow
stale data, configuration flags that do nothing, or unsafe metadata inputs to
bleed into the rendered prose. Closing the gaps below will keep the formatter
predictable when content authors make mistakes or when runtime state shifts
rapidly.

## Known Issues & Fixes

### 1. Honour the `enabled` integration flag

* **Problem**: `#formatActivityDescription` always produces output even when the
  formatting configuration sets `enabled: false`, because the flag is never
  consulted after `#getActivityIntegrationConfig` merges defaults. This makes it
  impossible to disable activity descriptions per-config and forces downstream
  callers to add ad-hoc guards. 【F:src/anatomy/services/activityDescriptionService.js†L1113-L1176】
* **Fix**: Short-circuit inside `#formatActivityDescription` (and ideally before
  heavy preprocessing) when `config.enabled === false`. The method should return
  an empty string and skip grouping/context work when disabled.
* **Tests**: Extend integration coverage in
  `tests/integration/anatomy/activityDescriptionConfiguration.test.js` (or add a
  new test) to assert that `enabled: false` yields an empty description even when
  activities exist.

### 2. Validate inline `targetRole` outputs

* **Problem**: `#parseInlineMetadata` trusts `componentData[targetRole]`
  wholesale. When schema authors accidentally supply arrays or nested objects,
  later lookups feed the raw value into `entityManager.getEntityInstance`,
  raising type errors and aborting description generation. 【F:src/anatomy/services/activityDescriptionService.js†L550-L583】
* **Fix**: Normalise `targetEntityId` by accepting only non-empty strings. For
  everything else, log a warning, fall back to `null`, and keep the activity so
  it can still describe a solo action.
* **Tests**: Add unit coverage that injects malformed `targetRole` data and
  verifies the service logs the warning but still returns a description without
  exploding.

### 3. Harden `#extractEntityData` against component failures

* **Problem**: `#extractEntityData` iterates all `componentTypeIds` and calls
  `getComponentData` without a guard. If a single component accessor throws, the
  entire visibility check (JSON Logic evaluation) fails. 【F:src/anatomy/services/activityDescriptionService.js†L892-L905】
* **Fix**: Wrap each `getComponentData` call in a `try/catch`, log the failure,
  and continue assembling the partial component map instead of throwing away the
  whole context.
* **Tests**: Unit-test the helper through `getTestHooks().extractEntityData`
  using an entity double whose `getComponentData` throws for one component and
  confirm the remainder is still collected.

### 4. Invalidate the closeness cache when relationships change

* **Problem**: Relationship tone relies on `#closenessCache`, but we only prune
  it by TTL. There is no invalidation hook when the `positioning:closeness`
  component changes, so actors continue to describe stale relationships for up
  to 60 seconds. 【F:src/anatomy/services/activityDescriptionService.js†L122-L1410】【F:src/anatomy/services/activityDescriptionService.js†L2484-L2489】
* **Fix**: Listen for the relevant component IDs (addition/removal/updates) and
  call a new `#invalidateClosenessCache(entityId)` helper that clears
  `#closenessCache`. Also expose the invalidation via `invalidateCache` so tests
  and admin tools can flush it explicitly.
* **Tests**: Extend integration coverage to toggle the closeness component and
  assert the tone updates immediately after cache invalidation.

## Implementation Notes

1. When adding the new invalidation helper, reuse the existing logger strings so
   observability stays consistent.
2. Any new warnings should use existing logger levels (`warn` for recoverable
   author mistakes, `debug` for cache misses) to avoid noisy telemetry.
3. After touching the service file, run the targeted Jest suites under
   `npm run test:unit` and `npm run test:integration` to cover both helper logic
   and configuration plumbing.
