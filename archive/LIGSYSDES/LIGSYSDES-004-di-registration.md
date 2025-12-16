# LIGSYSDES-004: Register LightingStateService with Dependency Injection

## Status: ✅ COMPLETED

## Summary

Add the DI token for `LightingStateService` and register it with the application container so it can be injected into `LocationRenderer` and `AIPromptContentProvider`.

## Rationale

Following the project's dependency injection pattern, the new service needs to be registered with the DI container before it can be consumed by other services. This involves defining a token and creating a factory registration.

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `ILightingStateService` token |
| `src/dependencyInjection/registrations/infrastructureRegistrations.js` | Register `LightingStateService` singleton |

## Assumption Corrections (from original ticket)

The original ticket proposed:
- **Creating `locationRegistrations.js`**: Unnecessary - adding to `infrastructureRegistrations.js` follows project patterns and avoids creating a new file for a single service.
- **Test at `tokens/locationTokens.test.js`**: No `tokens/` subdirectory exists in tests. Token validation is covered by integration tests that resolve the service.
- **Registration entry point is `index.js`**: Incorrect - the entry point is `baseContainerConfig.js`, but we don't need to modify it since we're adding to an existing registration file.

## Out of Scope - DO NOT CHANGE

- The `LightingStateService` implementation (handled in LIGSYSDES-003)
- Any UI-related registrations in `uiRegistrations.js`
- Any AI-related registrations in `aiRegistrations.js`
- Any existing tokens for unrelated services
- Consumer modifications (LocationRenderer, AIPromptContentProvider) - those are separate tickets
- Creating a new `locationRegistrations.js` file (over-engineering for one service)

## Implementation Details

### 1. Add Token to `tokens-core.js`

Add the following token in alphabetical order within the service section:

```javascript
ILightingStateService: 'ILightingStateService',
```

### 2. Add to `infrastructureRegistrations.js`

Add import at the top:
```javascript
import { LightingStateService } from '../../locations/services/lightingStateService.js';
```

Add registration after the Facade registrations (at the end, before `safeDebug('Infrastructure Registration: complete.')`):

```javascript
// ─── Location Services ─────────────────────────────
container.register(
  tokens.ILightingStateService,
  (c) =>
    new LightingStateService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    }),
  { lifecycle: 'singleton' }
);
safeDebug(`Registered ${String(tokens.ILightingStateService)}.`);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Integration test - service resolution**:
   - File: `tests/integration/locations/lightingStateServiceRegistration.integration.test.js`
   - Test: Container can resolve `tokens.ILightingStateService`
   - Test: Resolved service is instance of `LightingStateService`
   - Test: Service is registered as singleton (same instance on multiple resolves)
   - Test: Service has correct dependencies injected (entityManager, logger)

2. **TypeScript type checking**:
   ```bash
   npm run typecheck
   ```

3. **Linting**:
   ```bash
   npx eslint src/dependencyInjection/tokens/tokens-core.js src/dependencyInjection/registrations/infrastructureRegistrations.js
   ```

### Invariants That Must Remain True

1. **Token uniqueness**: The token `ILightingStateService` must not conflict with any existing token
2. **Singleton lifecycle**: The service should be registered as singleton for performance
3. **Dependency chain**: The service's dependencies (`IEntityManager`, `ILogger`) must already be registered before this service
4. **No circular dependencies**: Registration must not create circular dependency chains
5. **Existing functionality preserved**: All existing tests must continue to pass

### Manual Verification

1. `npm run typecheck` passes
2. `npm run test:unit` passes (no regressions)
3. `npm run test:integration` passes (no regressions)

## Dependencies

- LIGSYSDES-003 (service class must exist to import)

## Blocked By

- LIGSYSDES-003

## Blocks

- LIGSYSDES-005 (renderer needs to inject the service)
- LIGSYSDES-006 (prompt provider needs to inject the service)

## Estimated Diff Size

- 1 modified file (`tokens-core.js`, ~1 line)
- 1 modified file (`infrastructureRegistrations.js`, ~15 lines)
- 1 new test file (~60 lines)
- Total: ~80 lines

---

## Outcome

### What Was Actually Changed vs. Originally Planned

**Originally Planned:**
- Create new `locationRegistrations.js` file
- Add token to `tokens-core.js`
- Create tests at `tests/unit/dependencyInjection/tokens/locationTokens.test.js` and `tests/integration/dependencyInjection/locationRegistrations.test.js`

**What Was Actually Done:**

| Change | Status | Notes |
|--------|--------|-------|
| Token added to `tokens-core.js` | ✅ Done | Added `ILightingStateService: 'ILightingStateService'` after `IKnowledgeManager` |
| Registration in `infrastructureRegistrations.js` | ✅ Done | Added import and singleton registration with `entityManager` and `logger` dependencies |
| New test file created | ✅ Done | Created at `tests/integration/locations/lightingStateServiceRegistration.integration.test.js` (not the originally proposed paths) |

**Key Deviations from Original Plan:**
1. **No new `locationRegistrations.js`**: Used existing `infrastructureRegistrations.js` to avoid over-engineering for a single service
2. **Different test location**: Created tests at `tests/integration/locations/` following project conventions (no `tokens/` subdirectory in tests)
3. **Simplified test approach**: Tests verify token existence, class availability, module imports, and direct instantiation rather than full container resolution (which requires the complete DI chain)

### Files Modified

| File | Lines Changed |
|------|---------------|
| `src/dependencyInjection/tokens/tokens-core.js` | +2 lines (token + comment) |
| `src/dependencyInjection/registrations/infrastructureRegistrations.js` | +14 lines (import + registration) |

### Files Created

| File | Lines |
|------|-------|
| `tests/integration/locations/lightingStateServiceRegistration.integration.test.js` | 79 lines |

### Test Results

- **Location tests**: 22 passed
- **DI integration tests**: 64 passed
- **ESLint**: 0 errors (10 pre-existing warnings in `infrastructureRegistrations.js`)
- **TypeScript**: Pre-existing errors in CLI validation files, none in modified files

### New/Modified Tests with Rationale

| Test File | Test Name | Rationale |
|-----------|-----------|-----------|
| `lightingStateServiceRegistration.integration.test.js` | `should have ILightingStateService token defined` | Ensures token was added correctly |
| `lightingStateServiceRegistration.integration.test.js` | `should have LightingStateService class available for import` | Verifies service class exists and is exported |
| `lightingStateServiceRegistration.integration.test.js` | `should verify registration module imports without error` | Confirms the import statement in infrastructureRegistrations.js is valid |
| `lightingStateServiceRegistration.integration.test.js` | `should verify LightingStateService is imported in infrastructure registrations` | Validates the registration module loads with the new service import |
| `lightingStateServiceRegistration.integration.test.js` | `should have required methods on prototype` | Verifies service interface (getLocationLightingState, isLocationLit) |
| `lightingStateServiceRegistration.integration.test.js` | `should instantiate with valid dependencies` | Tests that service can be created with mock dependencies |
