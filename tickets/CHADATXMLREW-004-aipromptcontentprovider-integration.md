# CHADATXMLREW-004: Integrate CharacterDataXmlBuilder into AIPromptContentProvider

**Priority:** P1 - HIGH
**Effort:** 2-3 hours
**Status:** Not Started
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Integration Point" section
**Depends On:** CHADATXMLREW-002, CHADATXMLREW-003 (builder class and DI registration)

---

## Problem Statement

Replace the internal instantiation of `CharacterDataFormatter` in `AIPromptContentProvider` with the DI-injected `CharacterDataXmlBuilder`. This is the critical integration point that switches character persona output from Markdown to XML.

Key changes:
1. Add `characterDataXmlBuilder` as a constructor dependency
2. Replace `#characterDataFormatter` with `#characterDataXmlBuilder`
3. Update `getCharacterPersonaContent()` to call `buildCharacterDataXml()`
4. Update the DI registration for `AIPromptContentProvider`
5. Update associated tests

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/prompting/AIPromptContentProvider.js` | MODIFY | Replace CharacterDataFormatter with CharacterDataXmlBuilder |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY | Add CharacterDataXmlBuilder to AIPromptContentProvider factory |
| `tests/unit/prompting/AIPromptContentProvider.test.js` | MODIFY | Update mocks and assertions |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataFormatter.js` - handled in CHADATXMLREW-007
- `XmlElementBuilder.js` or `CharacterDataXmlBuilder.js` - created in prior tickets
- Tests for the XML builders themselves
- Any prompt template files
- Any other prompting services

---

## Implementation Details

### AIPromptContentProvider Changes

**File:** `src/prompting/AIPromptContentProvider.js`

#### 1. Update Imports

```javascript
// REMOVE this import:
import CharacterDataFormatter from './CharacterDataFormatter.js';

// No new imports needed - CharacterDataXmlBuilder injected via DI
```

#### 2. Update Private Field Declaration

```javascript
// Line ~50 - CHANGE from:
#characterDataFormatter;

// TO:
#characterDataXmlBuilder;
```

#### 3. Update Constructor

```javascript
constructor({
  logger,
  promptStaticContentService,
  perceptionLogFormatter,
  gameStateValidationService,
  actionCategorizationService,
  characterDataXmlBuilder,  // ADD this parameter
}) {
  super();
  validateDependencies(
    [
      // ... existing validations ...
      {
        dependency: characterDataXmlBuilder,
        name: 'AIPromptContentProvider: characterDataXmlBuilder',
        methods: ['buildCharacterDataXml'],
      },
    ],
    logger
  );

  // ... existing assignments ...

  // REMOVE this line:
  // this.#characterDataFormatter = new CharacterDataFormatter({ logger });

  // ADD this line:
  this.#characterDataXmlBuilder = characterDataXmlBuilder;

  this.#logger.debug(
    'AIPromptContentProvider initialized with XML builder for character data.'
  );
}
```

#### 4. Update getCharacterPersonaContent()

```javascript
getCharacterPersonaContent(gameState) {
  this.#logger.debug(
    'AIPromptContentProvider: Formatting character persona content with XML structure.'  // Update log message
  );
  const { actorPromptData } = gameState;

  if (!actorPromptData) {
    this.#logger.warn(
      'AIPromptContentProvider: actorPromptData is missing in getCharacterPersonaContent. Using fallback.'
    );
    return gameState.actorState
      ? PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE
      : PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS;
  }

  // Check for minimal character details before formatting
  if (
    (!actorPromptData.name ||
      actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME) &&
    !actorPromptData.description &&
    !actorPromptData.personality &&
    !actorPromptData.profile
  ) {
    this.#logger.debug(
      'AIPromptContentProvider: Character details are minimal. Using PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS.'
    );
    return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
  }

  // Use CharacterDataXmlBuilder for XML structure
  try {
    const formattedPersona =
      this.#characterDataXmlBuilder.buildCharacterDataXml(actorPromptData);  // CHANGED

    if (!formattedPersona || formattedPersona.trim().length === 0) {
      this.#logger.warn(
        'AIPromptContentProvider: CharacterDataXmlBuilder returned empty result. Using fallback.'  // Update message
      );
      return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
    }

    this.#logger.debug(
      'AIPromptContentProvider: Successfully formatted character persona with XML structure.'  // Update message
    );
    return formattedPersona;
  } catch (error) {
    this.#logger.error(
      'AIPromptContentProvider: Error formatting character persona with CharacterDataXmlBuilder.',  // Update message
      error
    );
    // Fallback to basic format if builder fails
    return `YOU ARE ${actorPromptData.name || DEFAULT_FALLBACK_CHARACTER_NAME}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`;
  }
}
```

### DI Registration Changes

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

Find the existing `AIPromptContentProvider` registration and add the new dependency:

```javascript
registrar.singletonFactory(
  tokens.IAIPromptContentProvider,
  (c) => new AIPromptContentProvider({
    logger: c.resolve(tokens.ILogger),
    promptStaticContentService: c.resolve(tokens.IPromptStaticContentService),
    perceptionLogFormatter: c.resolve(tokens.IPerceptionLogFormatter),
    gameStateValidationService: c.resolve(tokens.IGameStateValidationServiceForPrompting),
    actionCategorizationService: c.resolve(tokens.IActionCategorizationService),
    characterDataXmlBuilder: c.resolve(tokens.CharacterDataXmlBuilder),  // ADD
  })
);
```

### Test Changes

**File:** `tests/unit/prompting/AIPromptContentProvider.test.js`

Update mock setup:

```javascript
// In mock setup, ADD:
const mockCharacterDataXmlBuilder = {
  buildCharacterDataXml: jest.fn().mockReturnValue('<character_data>...</character_data>')
};

// In constructor calls, ADD:
const provider = new AIPromptContentProvider({
  logger: mockLogger,
  promptStaticContentService: mockPromptStaticContentService,
  perceptionLogFormatter: mockPerceptionLogFormatter,
  gameStateValidationService: mockGameStateValidationService,
  actionCategorizationService: mockActionCategorizationService,
  characterDataXmlBuilder: mockCharacterDataXmlBuilder,  // ADD
});

// Update assertions to check for XML output instead of Markdown
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor Validation**
   - Throws if `characterDataXmlBuilder` is null/undefined
   - Throws if `characterDataXmlBuilder` lacks `buildCharacterDataXml` method
   - Accepts valid `characterDataXmlBuilder` dependency

2. **getCharacterPersonaContent Tests**
   - Calls `buildCharacterDataXml()` with actorPromptData
   - Returns XML string on success
   - Returns fallback on empty result
   - Returns fallback on error
   - Still handles missing actorPromptData correctly
   - Still handles minimal character details correctly

3. **Integration Tests**
   - Full pipeline produces valid XML output
   - `AIPromptContentProvider` resolves from DI container
   - Character persona is included in prompt data

4. **Existing Functionality**
   - All other `AIPromptContentProvider` methods unchanged
   - All other test files continue to pass

### Invariants That Must Remain True

- **No direct instantiation** - CharacterDataXmlBuilder comes from DI
- **Same fallback behavior** - fallback strings unchanged
- **Same null/undefined handling** - edge cases preserved
- **Same minimal details check** - logic unchanged
- **Output format changed** - from Markdown to XML (intentional)

### Coverage Requirements

- Existing coverage maintained on `AIPromptContentProvider.js`
- New dependency path covered

---

## Testing Commands

```bash
# Run AIPromptContentProvider tests
npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.test.js

# Run all prompting tests to check for regressions
npm run test:unit -- --testPathPattern="prompting"

# Run integration tests
npm run test:integration -- --testPathPattern="prompting"

# Lint modified files
npx eslint src/prompting/AIPromptContentProvider.js src/dependencyInjection/registrations/aiRegistrations.js
```

---

## Notes

- This is the "flip the switch" ticket - after this, character personas are XML
- Ensure `CharacterDataFormatter` import is removed (dead code)
- Log messages should reference "XML structure" not "markdown structure"
- The fallback format remains simple text (not XML) - this is intentional for robustness
