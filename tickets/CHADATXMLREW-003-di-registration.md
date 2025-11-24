# CHADATXMLREW-003: Add DI Tokens and Service Registration

**Priority:** P1 - HIGH
**Effort:** 1 hour
**Status:** Not Started
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Dependency Injection" section
**Depends On:** CHADATXMLREW-001, CHADATXMLREW-002 (classes must exist)

---

## Problem Statement

Register the new XML builder classes in the dependency injection system:
1. Add tokens for `XmlElementBuilder` and `CharacterDataXmlBuilder`
2. Register singleton factories in the prompting engine registration

This enables proper DI usage when `AIPromptContentProvider` is modified (CHADATXMLREW-004).

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFY | Add 2 new tokens |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY | Add 2 factory registrations |
| `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js` | MODIFY | Add registration tests |

---

## Out of Scope

**DO NOT modify:**
- `CharacterDataFormatter.js` - handled in CHADATXMLREW-007
- `AIPromptContentProvider.js` - handled in CHADATXMLREW-004
- Any prompting source files
- Any test files other than `aiRegistrations.test.js`

---

## Implementation Details

### Token Definitions

**File:** `src/dependencyInjection/tokens/tokens-ai.js`

Add to the `aiTokens` object (alphabetically sorted):

```javascript
export const aiTokens = freeze({
  // ... existing tokens ...
  AIPromptContentProvider: 'AIPromptContentProvider',
  // ADD THESE:
  CharacterDataXmlBuilder: 'CharacterDataXmlBuilder',
  // ... more existing tokens ...
  PromptTemplateService: 'PromptTemplateService',
  // ... more existing tokens ...
  XmlElementBuilder: 'XmlElementBuilder',
  // ... remaining tokens ...
});
```

### Service Registration

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

Add to `registerPromptingEngine()` function, after the existing `PromptDataFormatter` registration:

```javascript
// Import at top of file
import XmlElementBuilder from '../../prompting/xmlElementBuilder.js';
import CharacterDataXmlBuilder from '../../prompting/characterDataXmlBuilder.js';

// In registerPromptingEngine():
registrar.singletonFactory(
  tokens.XmlElementBuilder,
  () => new XmlElementBuilder()
);

registrar.singletonFactory(
  tokens.CharacterDataXmlBuilder,
  (c) => new CharacterDataXmlBuilder({
    logger: c.resolve(tokens.ILogger),
    xmlElementBuilder: c.resolve(tokens.XmlElementBuilder)
  })
);
```

### Test Updates

**File:** `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js`

Add test cases for the new registrations:

```javascript
describe('registerPromptingEngine', () => {
  // ... existing tests ...

  it('should register XmlElementBuilder as singleton', () => {
    // Verify registration exists and returns instance
  });

  it('should register CharacterDataXmlBuilder with dependencies', () => {
    // Verify registration exists
    // Verify logger and xmlElementBuilder are injected
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Token Tests**
   - `aiTokens.XmlElementBuilder` equals `'XmlElementBuilder'`
   - `aiTokens.CharacterDataXmlBuilder` equals `'CharacterDataXmlBuilder'`
   - Tokens are unique (no duplicates in aiTokens)

2. **Registration Tests**
   - `XmlElementBuilder` resolves to instance
   - `CharacterDataXmlBuilder` resolves to instance
   - `CharacterDataXmlBuilder` receives logger dependency
   - `CharacterDataXmlBuilder` receives xmlElementBuilder dependency
   - Both are singletons (same instance on multiple resolves)

3. **Existing Tests**
   - All existing `aiRegistrations.test.js` tests continue to pass
   - No regression in other DI tests

### Invariants That Must Remain True

- **Token uniqueness** - no duplicate token values in `aiTokens`
- **Singleton pattern** - both services registered as singletons
- **Dependency order** - `XmlElementBuilder` registered before `CharacterDataXmlBuilder`
- **No circular dependencies** - neither class depends on prompting-level services
- **Alphabetical ordering** - tokens maintain alphabetical order in object

### Coverage Requirements

- Existing coverage maintained
- New registrations covered by tests

---

## Testing Commands

```bash
# Run DI registration tests
npm run test:unit -- tests/unit/dependencyInjection/registrations/aiRegistrations.test.js

# Verify typecheck passes
npm run typecheck

# Lint modified files
npx eslint src/dependencyInjection/tokens/tokens-ai.js src/dependencyInjection/registrations/aiRegistrations.js
```

---

## Notes

- Keep alphabetical ordering in `aiTokens` for maintainability
- Follow existing registration patterns in `registerPromptingEngine()`
- `XmlElementBuilder` has no dependencies (stateless utility)
- `CharacterDataXmlBuilder` depends on logger and XmlElementBuilder
