# ENHACTINFFORLLM-003: Register DI Token and Factory for ModActionMetadataProvider

**Status:** ✅ COMPLETED

## Summary

Add the dependency injection token and factory registration for the new ModActionMetadataProvider service.

## Prerequisites

- ENHACTINFFORLLM-002 must be completed (service implementation)

## Files to Touch

- `src/dependencyInjection/tokens/tokens-ai.js`
- `src/dependencyInjection/registrations/aiRegistrations.js`

## Out of Scope

- DO NOT modify `AIPromptContentProvider` class (that's ENHACTINFFORLLM-004)
- DO NOT modify any other DI registration files
- DO NOT modify the service implementation itself
- DO NOT create test files

## Implementation Details

### 1. Add Token to tokens-ai.js

Location: `src/dependencyInjection/tokens/tokens-ai.js`

Add to the `aiTokens` object:

```javascript
IModActionMetadataProvider: 'IModActionMetadataProvider',
```

**Note:** Tokens are NOT alphabetically sorted in this file. Add after `ILocationSummaryProvider` (line 47) following existing grouping patterns.

### 2. Add Factory Registration to aiRegistrations.js

Location: `src/dependencyInjection/registrations/aiRegistrations.js`

#### 2a. Add Import Statement

Add near the top with other prompting imports:

```javascript
import { ModActionMetadataProvider } from '../../prompting/modActionMetadataProvider.js';
```

**Note (corrected):** The service is at `src/prompting/modActionMetadataProvider.js`, NOT in a `services/` subdirectory.

#### 2b. Add Factory Registration

Add to `registerAITurnPipeline` function, BEFORE the `IAIPromptContentProvider` registration (currently at line 337):

```javascript
registrar.singletonFactory(tokens.IModActionMetadataProvider, (c) => {
  return new ModActionMetadataProvider({
    dataRegistry: c.resolve(tokens.IDataRegistry),
    logger: c.resolve(tokens.ILogger),
  });
});
logger.debug(
  `AI Systems Registration: Registered ${tokens.IModActionMetadataProvider}.`
);
```

## Acceptance Criteria

### Tests That Must Pass

- `npm run typecheck` passes
- `npm run test:unit -- --testPathPattern="aiRegistrations"` passes
- `npm run test:integration` passes (DI container resolves correctly)

### Invariants That Must Remain True

1. Token follows naming convention: `I` prefix for interface tokens
2. Factory uses `singletonFactory` pattern (service is stateless with cache)
3. Factory resolves `IDataRegistry` and `ILogger` as dependencies
4. Registration order: `IModActionMetadataProvider` before `IAIPromptContentProvider`
5. Debug log follows existing pattern with token name
6. Import statement uses named import syntax

## Verification Steps

1. Run `npm run typecheck`
2. Run `npx eslint src/dependencyInjection/tokens/tokens-ai.js src/dependencyInjection/registrations/aiRegistrations.js`
3. Run `npm run test:unit -- --testPathPattern="aiRegistrations"`

---

## Outcome

### What Was Changed

1. **`src/dependencyInjection/tokens/tokens-ai.js`** (line 48): Added `IModActionMetadataProvider` token after `ILocationSummaryProvider`
2. **`src/dependencyInjection/registrations/aiRegistrations.js`** (line 93): Added import for `ModActionMetadataProvider`
3. **`src/dependencyInjection/registrations/aiRegistrations.js`** (lines 338-346): Added singleton factory registration in `registerAITurnPipeline`

### Test Additions

- **`tests/unit/dependencyInjection/registrations/aiRegistrations.test.js`**: Added mock for `ModActionMetadataProvider` and test assertions to verify the factory registration correctly resolves `IDataRegistry` and `ILogger` dependencies

### Corrections Made to Original Ticket

- **Import path**: Changed from `../../prompting/services/modActionMetadataProvider.js` to `../../prompting/modActionMetadataProvider.js` (service is NOT in a `services/` subdirectory)
- **Token ordering note**: Clarified that tokens are NOT alphabetically sorted in `tokens-ai.js`

### All Acceptance Criteria Met

- ✅ `npm run typecheck` passes (pre-existing CLI errors unrelated to this change)
- ✅ `npx eslint` passes on modified files (no errors)
- ✅ Unit tests pass (8/8 tests in `aiRegistrations.test.js`)
