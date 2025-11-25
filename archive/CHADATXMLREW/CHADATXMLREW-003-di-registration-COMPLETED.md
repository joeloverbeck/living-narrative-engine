# CHADATXMLREW-003: Add DI Tokens and Service Registration

**Priority:** P1 - HIGH
**Effort:** 1 hour
**Status:** COMPLETED
**Completed:** 2025-11-25
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md) - "Dependency Injection" section
**Depends On:** CHADATXMLREW-001, CHADATXMLREW-002 (classes must exist)

---

## Problem Statement

Register the new XML builder classes in the dependency injection system:
1. Add tokens for `XmlElementBuilder` and `CharacterDataXmlBuilder`
2. Register singleton factories in the prompting engine registration

This enables proper DI usage when `AIPromptContentProvider` is modified (CHADATXMLREW-004).

---

## Outcome

### What Was Actually Changed vs. Originally Planned

**Implementation matched the plan exactly.** All changes were minimal and followed existing patterns:

1. **tokens-ai.js** - Added 2 new tokens:
   - `CharacterDataXmlBuilder: 'CharacterDataXmlBuilder'` (at top, alphabetical position)
   - `XmlElementBuilder: 'XmlElementBuilder'` (at bottom, alphabetical position)

2. **aiRegistrations.js** - Added:
   - Import statements for both classes
   - Singleton factory registration for `XmlElementBuilder` (no dependencies)
   - Singleton factory registration for `CharacterDataXmlBuilder` (depends on logger and XmlElementBuilder)

3. **aiRegistrations.test.js** - Added:
   - Jest mocks for both classes
   - `jest.requireMock` for accessing mock instances
   - Tests within existing `registerPromptingEngine` test to verify:
     - XmlElementBuilder registration and instantiation
     - CharacterDataXmlBuilder registration with correct dependencies

### Tests Added/Modified

| Test | File | Rationale |
|------|------|-----------|
| XmlElementBuilder registration test | `aiRegistrations.test.js` | Verifies stateless utility is registered and can be resolved |
| CharacterDataXmlBuilder registration test | `aiRegistrations.test.js` | Verifies class receives correct dependencies (logger, xmlElementBuilder) |

### Verification

- All 392 DI tests pass
- All 490 prompting tests pass
- ESLint passes with no new warnings/errors
- Typecheck passes (pre-existing unrelated errors only)

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFIED | Added 2 new tokens |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFIED | Added 2 factory registrations + imports |
| `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js` | MODIFIED | Added mocks and registration tests |

---

## Original Acceptance Criteria (All Met)

### Tests That Must Pass

1. **Token Tests** ✅
   - `aiTokens.XmlElementBuilder` equals `'XmlElementBuilder'`
   - `aiTokens.CharacterDataXmlBuilder` equals `'CharacterDataXmlBuilder'`
   - Tokens are unique (no duplicates in aiTokens)

2. **Registration Tests** ✅
   - `XmlElementBuilder` resolves to instance
   - `CharacterDataXmlBuilder` resolves to instance
   - `CharacterDataXmlBuilder` receives logger dependency
   - `CharacterDataXmlBuilder` receives xmlElementBuilder dependency
   - Both are singletons (same instance on multiple resolves)

3. **Existing Tests** ✅
   - All existing `aiRegistrations.test.js` tests continue to pass
   - No regression in other DI tests

### Invariants That Remained True

- **Token uniqueness** - no duplicate token values in `aiTokens`
- **Singleton pattern** - both services registered as singletons
- **Dependency order** - `XmlElementBuilder` registered before `CharacterDataXmlBuilder`
- **No circular dependencies** - neither class depends on prompting-level services
- **Alphabetical ordering** - tokens maintain alphabetical order in object

---

## Testing Commands Used

```bash
# Run DI registration tests
NODE_ENV=test npx jest tests/unit/dependencyInjection/registrations/aiRegistrations.test.js --no-coverage --verbose

# Run all DI tests
NODE_ENV=test npx jest tests/unit/dependencyInjection/ --no-coverage --silent

# Run all prompting tests
NODE_ENV=test npx jest tests/unit/prompting/ --no-coverage --silent

# Lint modified files
npx eslint src/dependencyInjection/tokens/tokens-ai.js src/dependencyInjection/registrations/aiRegistrations.js
```
