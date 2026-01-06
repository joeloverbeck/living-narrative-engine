# CHADISLLMQUALAB-003: AIPromptContentProvider Integration

## Overview

**Ticket ID**: CHADISLLMQUALAB-003
**Status**: Completed
**Priority**: High
**Depends On**: CHADISLLMQUALAB-001, CHADISLLMQUALAB-002
**Blocks**: CHADISLLMQUALAB-005, CHADISLLMQUALAB-006

## Objective

Integrate `ChanceTextTranslator` into `AIPromptContentProvider` so LLM prompt formatting uses qualitative chance labels. Update the DI factory to inject the new dependency and adjust tests that construct `AIPromptContentProvider`.

## File List

| File | Action | Description |
|------|--------|-------------|
| `src/prompting/AIPromptContentProvider.js` | **MODIFY** | Add ChanceTextTranslator dependency, use in `_formatSingleAction()` |
| `src/dependencyInjection/registrations/aiRegistrations.js` | **MODIFY** | Update IAIPromptContentProvider factory to inject ChanceTextTranslator |
| `tests/unit/**/AIPromptContentProvider*.test.js` | **MODIFY** | Add ChanceTextTranslator mock to constructor setups |
| `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js` | **MODIFY** | Expect IAIPromptContentProvider factory to pass ChanceTextTranslator |

## Out of Scope

- **DO NOT** modify `ActionFormattingStage.js` - UI must continue showing numeric percentages
- **DO NOT** modify `MultiTargetActionFormatter.js` - source commandString unchanged
- **DO NOT** modify `ChanceCalculationService.js` - calculation logic unchanged
- **DO NOT** modify any schema files
- **DO NOT** modify any UI rendering code in `domUI/`
- **DO NOT** create the ChanceTextTranslator service (already exists at `src/prompting/ChanceTextTranslator.js`)
- **DO NOT** add the DI token (already present in `src/dependencyInjection/tokens/tokens-ai.js`)

## Implementation Details

### Step 1: Modify AIPromptContentProvider Constructor

**File**: `src/prompting/AIPromptContentProvider.js`

#### 1.1 Add Private Field

Add to class private fields:

```javascript
#chanceTextTranslator;
```

#### 1.2 Update Constructor Signature

Add `chanceTextTranslator` to destructured parameters:

```javascript
constructor({
  logger,
  promptStaticContentService,
  perceptionLogFormatter,
  gameStateValidationService,
  actionCategorizationService,
  characterDataXmlBuilder,
  modActionMetadataProvider,
  chanceTextTranslator,  // NEW
}) {
```

#### 1.3 Add Validation

Add to the existing `validateDependencies` list with required `translateForLlm`.

#### 1.4 Store Reference

After validation:

```javascript
this.#chanceTextTranslator = chanceTextTranslator;
```

### Step 2: Modify _formatSingleAction Method

**File**: `src/prompting/AIPromptContentProvider.js`

Locate the `_formatSingleAction(action)` method and update it:

```javascript
_formatSingleAction(action) {
  if (!action) {
    this.#logger.warn(
      'AIPromptContentProvider: Attempted to format null/undefined action'
    );
    return '';
  }

  // Get command string and translate chance for LLM
  let commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
  commandStr = this.#chanceTextTranslator.translateForLlm(commandStr);

  let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
  description = ensureTerminalPunctuation(description);

  return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
}
```

**Key change**: The line `commandStr = this.#chanceTextTranslator.translateForLlm(commandStr);` is inserted after getting the command string.

### Step 3: Update DI Factory Registration

**File**: `src/dependencyInjection/registrations/aiRegistrations.js`

Locate the `IAIPromptContentProvider` factory and add the new dependency:

```javascript
registrar.singletonFactory(tokens.IAIPromptContentProvider, (c) => {
  return new AIPromptContentProvider({
    logger: c.resolve(tokens.ILogger),
    promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
    perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
    gameStateValidationService: c.resolve(
      tokens.IGameStateValidationServiceForPrompting
    ),
    actionCategorizationService: c.resolve(
      tokens.IActionCategorizationService
    ),
    characterDataXmlBuilder: c.resolve(tokens.CharacterDataXmlBuilder),
    modActionMetadataProvider: c.resolve(tokens.IModActionMetadataProvider),
    chanceTextTranslator: c.resolve(tokens.ChanceTextTranslator),  // NEW
  });
});
```

### Step 4: Update Unit Tests That Construct AIPromptContentProvider

Update existing unit/integration tests that instantiate `AIPromptContentProvider` directly to pass a `chanceTextTranslator` mock with `translateForLlm`. Add a focused unit test to ensure `_formatSingleAction()` calls the translator and preserves the unmutated command string.

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit tests**:
   - `npm run test:unit -- --testPathPattern="AIPromptContentProvider"` passes
   - Constructor tests verify chanceTextTranslator dependency
   - `_formatSingleAction` tests verify translation is called

2. **Integration tests** (optional if not yet authored):
   - Actions with `(55% chance)` appear as `(decent chance)` in LLM prompts
   - Actions without chance patterns pass through unchanged
   - Modifier tags preserved after translation

3. **Existing functionality preserved**:
   - `npm run test:integration -- --testPathPattern="prompting"` passes
   - Action categorization still works
   - All prompt generation tests pass

### Invariants That Must Remain True

1. **UI unchanged**: Action buttons in game.html still show "(55% chance)"
2. **Source data unchanged**: `action.commandString` in pipeline is not mutated
3. **Only LLM output affected**: Translation only happens in `_formatSingleAction()`
4. **Modifier tags preserved**: Tags like `[flanking]` appear after qualitative label
5. **Backward compatible**: Actions without chance patterns work unchanged
6. **No performance regression**: Translation adds negligible overhead

## Technical Notes

- The translation happens at the last possible moment before LLM formatting
- `action.commandString` is NOT mutated - only the local variable is transformed
- The existing `DEFAULT_FALLBACK_ACTION_COMMAND` fallback still applies first
- Ensure `translateForLlm` is called after the fallback assignment

## Manual Verification

After implementation, manually verify:

1. Start the game with `npm run dev`
2. Navigate to an action with chance (e.g., combat action)
3. In UI: Action button shows "(55% chance)" ✓
4. Click "Prompt to LLM" button
5. In prompt preview: Action shows "(decent chance)" ✓

## Definition of Done

- [x] `#chanceTextTranslator` private field added
- [x] Constructor accepts `chanceTextTranslator` parameter
- [x] Dependency validated with `validateDependencies`
- [x] `_formatSingleAction()` calls `translateForLlm()` on command string
- [x] DI factory updated to inject `ChanceTextTranslator`
- [x] Unit tests updated for new dependency
- [x] `npm run test:unit -- --runInBand --testPathPatterns="AIPromptContentProvider|aiRegistrations" --coverage=false` passes

## Outcome

Implemented ChanceTextTranslator injection in `AIPromptContentProvider` and wired DI to pass the dependency. Updated all direct constructor usages in tests/performance/e2e to supply a translator mock and added a unit test verifying translation without mutating the action command string. The only scope change from the original plan was updating unit tests (they were already present and needed constructor changes), and no integration test expansion was required for this ticket.
