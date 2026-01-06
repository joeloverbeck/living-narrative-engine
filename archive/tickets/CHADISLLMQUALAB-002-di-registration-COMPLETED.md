# CHADISLLMQUALAB-002: DI Token and Service Registration

## Overview

**Ticket ID**: CHADISLLMQUALAB-002
**Status**: Completed
**Priority**: High
**Depends On**: CHADISLLMQUALAB-001
**Blocks**: CHADISLLMQUALAB-003

## Objective

Add the DI token for `ChanceTextTranslator` and register the service as a singleton in the AI registrations module.

## Assumptions & Corrections

- The `ChanceTextTranslator` service already exists at `src/prompting/ChanceTextTranslator.js` (not `src/prompting/services/`).
- Unit tests for the translator already exist at `tests/unit/prompting/ChanceTextTranslator.test.js`.
- This ticket only wires DI; no AIPromptContentProvider changes are included.

## File List

| File | Action | Description |
|------|--------|-------------|
| `src/dependencyInjection/tokens/tokens-ai.js` | **MODIFY** | Add `ChanceTextTranslator` token |
| `src/dependencyInjection/registrations/aiRegistrations.js` | **MODIFY** | Import and register `ChanceTextTranslator` |
| `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js` | **MODIFY** | Cover new DI registration (if needed) |

## Out of Scope

- **DO NOT** modify `AIPromptContentProvider.js` (handled in CHADISLLMQUALAB-003)
- **DO NOT** modify the `AIPromptContentProvider` factory registration yet (handled in CHADISLLMQUALAB-003)
- **DO NOT** create or modify any other tokens files
- **DO NOT** create the `ChanceTextTranslator` service (done in CHADISLLMQUALAB-001)
- **DO NOT** add new production dependencies beyond ILogger

## Implementation Details

### Step 1: Add Token to tokens-ai.js

**File**: `src/dependencyInjection/tokens/tokens-ai.js`

Add the following token to the `aiTokens` export object:

```javascript
ChanceTextTranslator: 'ChanceTextTranslator',
```

**Placement**: Add alphabetically or at the end of the token list, matching existing patterns.

### Step 2: Register Service in aiRegistrations.js

**File**: `src/dependencyInjection/registrations/aiRegistrations.js`

#### 2.1 Add Import

Add at the top with other imports:

```javascript
import { ChanceTextTranslator } from '../../prompting/ChanceTextTranslator.js';
```

#### 2.2 Add Service Registration

In the `registerAITurnPipeline` function, add registration **before** the `IAIPromptContentProvider` registration:

```javascript
registrar.singletonFactory(tokens.ChanceTextTranslator, (c) => {
  return new ChanceTextTranslator({
    logger: c.resolve(tokens.ILogger),
  });
});
logger.debug(
  `AI Systems Registration: Registered ${tokens.ChanceTextTranslator}.`
);
```

**Why singleton?**: The translator is stateless and can be shared across all uses.

**Why before AIPromptContentProvider?**: Because CHADISLLMQUALAB-003 will inject it into AIPromptContentProvider.

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Existing tests continue to pass**:
   - `npm run test:unit -- --testPathPatterns="aiRegistrations"` passes
   - `npm run test:unit -- --testPathPatterns="dependencyInjection"` passes

2. **Token resolution works** (manual verification once wired into the container):
   ```javascript
   container.resolve(tokens.ChanceTextTranslator)
   // Should return ChanceTextTranslator instance
   ```

3. **No circular dependencies**:
   - `npm run typecheck` passes
   - Application starts without DI errors

### Invariants That Must Remain True

1. **Token uniqueness**: `ChanceTextTranslator` token is unique (no duplicates)
2. **Singleton pattern**: Service is registered as singleton, not transient
3. **Registration order**: ChanceTextTranslator registered before IAIPromptContentProvider
4. **Logger injection**: Service receives valid logger from container
5. **No breaking changes**: All existing AI service registrations unchanged
6. **No new dependencies**: Only ILogger required for ChanceTextTranslator

## Technical Notes

- Follow existing token naming pattern (PascalCase, no "I" prefix for services)
- Follow existing registration pattern with debug logging
- Ensure import path is correct relative to `aiRegistrations.js` location

## Definition of Done

- [x] `ChanceTextTranslator` token added to `tokens-ai.js`
- [x] Import statement added to `aiRegistrations.js`
- [x] Service registered as singleton in `registerAITurnPipeline`
- [x] Debug log statement follows existing pattern
- [x] Registration placed before IAIPromptContentProvider
- [x] `npm run test:unit -- --testPathPatterns="aiRegistrations"` passes
- [x] `npm run test:unit -- --testPathPatterns="dependencyInjection"` passes

## Outcome

- Added DI token + singleton registration for `ChanceTextTranslator` in the AI pipeline.
- Updated DI registration tests to cover the new registration.
- No changes to AIPromptContentProvider or other prompting logic (reserved for CHADISLLMQUALAB-003).
