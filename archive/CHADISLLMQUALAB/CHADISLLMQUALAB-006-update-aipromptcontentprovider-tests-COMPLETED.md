# CHADISLLMQUALAB-006: Update AIPromptContentProvider Tests

## Overview

**Ticket ID**: CHADISLLMQUALAB-006
**Status**: Completed
**Priority**: Medium
**Depends On**: CHADISLLMQUALAB-003
**Blocks**: None

## Objective

Confirm `AIPromptContentProvider` constructor validation covers the new `chanceTextTranslator` dependency, adding the missing invalid-method test if needed.

## Reassessment

- All `AIPromptContentProvider` unit/integration/performance tests already include the `chanceTextTranslator` dependency.
- `_formatSingleAction()` translation coverage already exists in `tests/unit/prompting/AIPromptContentProvider.coverage.test.js`.
- `ChanceTextTranslator` lives at `src/prompting/ChanceTextTranslator.js` (not under `src/prompting/services/`).
- The only gap is constructor validation coverage for a `chanceTextTranslator` missing the `translateForLlm` method.

## File List

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/prompting/AIPromptContentProvider.test.js` | **MODIFY** | Add constructor validation test for missing `translateForLlm` |

## Out of Scope

- **DO NOT** modify `AIPromptContentProvider.js` source (done in CHADISLLMQUALAB-003)
- **DO NOT** create new test files (integration tests in CHADISLLMQUALAB-005)
- **DO NOT** modify ChanceTextTranslator tests (CHADISLLMQUALAB-004)
- **DO NOT** change test logic unrelated to ChanceTextTranslator
- **DO NOT** remove or rename existing tests

## Implementation Details

### Step 1: Add Constructor Validation Test

Add a constructor test to ensure `chanceTextTranslator` without `translateForLlm` throws:

```javascript
describe('constructor', () => {
  // ... existing tests ...

  it('should throw when chanceTextTranslator lacks translateForLlm method', () => {
    expect(() => {
      new AIPromptContentProvider({
        logger: mockLogger,
        promptStaticContentService: mockPromptStaticContentService,
        // ... other deps ...
        chanceTextTranslator: {},  // Missing required method
      });
    }).toThrow();
  });
});
```

### Step 2: No Changes Needed for _formatSingleAction Tests

Translation coverage already exists in `tests/unit/prompting/AIPromptContentProvider.coverage.test.js`.

### Step 3: Verify Existing Tests Still Pass

After updates, run:

```bash
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js
```

All existing tests should pass with the mock providing pass-through behavior.

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js
```

All tests in this file must pass, including:
1. All pre-existing tests (no regressions)
2. New constructor validation test for invalid `chanceTextTranslator`

### Test Coverage

Ensure coverage metrics don't decrease:
```bash
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js --coverage
```

### Invariants That Must Remain True

1. **Existing tests unchanged**: Pre-existing test logic should not change
2. **Mock is pass-through by default**: `translateForLlm.mockImplementation((text) => text)`
3. **Constructor validation tested**: Invalid `chanceTextTranslator` throws

## Technical Notes

### Finding All Constructor Usages

Search for instantiation patterns:
```bash
rg -n "new AIPromptContentProvider" tests/unit/prompting/AIPromptContentProvider.test.js
```

### Mock Reset Between Tests

If using shared mock in `beforeEach`, ensure it resets:
```javascript
beforeEach(() => {
  mockChanceTextTranslator.translateForLlm.mockClear();
  mockChanceTextTranslator.translateForLlm.mockImplementation((text) => text);
});
```

## Changes Summary

| Change Type | Description |
|-------------|-------------|
| Add constructor test | Validation of `chanceTextTranslator.translateForLlm` requirement |

## Definition of Done

- [ ] Constructor validation test added for missing `translateForLlm`
- [ ] All existing tests still pass (no regressions)
- [ ] `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js` passes
- [ ] Coverage metrics maintained or improved

## Outcome

Updated constructor validation coverage for missing `translateForLlm` while leaving existing mocks and `_formatSingleAction` translation tests intact (already covered in the coverage suite).
