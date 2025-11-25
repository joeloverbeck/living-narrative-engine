# CHADATXMLREW-000: Character Data XML Rework - Overview

**Epic Status:** Not Started
**Total Estimated Effort:** 8 days (as per spec)
**Spec Reference:** [specs/character-data-xml-rework.md](../specs/character-data-xml-rework.md)

---

## Summary

Convert character data formatting from Markdown to XML format for LLM prompts. This improves LLM comprehension through:
- Explicit XML tag hierarchy (vs implicit Markdown headers)
- Semantic grouping of related attributes
- Attention optimization via strategic section ordering
- LLM priming through decorated comments

---

## Ticket Dependency Graph

```
CHADATXMLREW-001 (XmlElementBuilder)
        │
        ▼
CHADATXMLREW-002 (CharacterDataXmlBuilder) ◄── CHADATXMLREW-005 (XML Jest Matchers)*
        │
        ▼
CHADATXMLREW-003 (DI Registration)
        │
        ▼
CHADATXMLREW-004 (AIPromptContentProvider Integration)
        │
        ▼
CHADATXMLREW-006 (Update Test Assertions) ◄── CHADATXMLREW-005
        │
        ▼
CHADATXMLREW-007 (Cleanup: Remove CharacterDataFormatter)

* CHADATXMLREW-005 can be done in parallel with 001-003
```

---

## Tickets Summary

| Ticket | Title | Priority | Effort | Status |
|--------|-------|----------|--------|--------|
| [CHADATXMLREW-001](./CHADATXMLREW-001-xml-element-builder.md) | Create XmlElementBuilder | P1 | 2-3h | Not Started |
| [CHADATXMLREW-002](./CHADATXMLREW-002-character-data-xml-builder.md) | Create CharacterDataXmlBuilder | P1 | 4-5h | Not Started |
| [CHADATXMLREW-003](./CHADATXMLREW-003-di-registration.md) | DI Tokens and Registration | P1 | 1h | Not Started |
| [CHADATXMLREW-004](./CHADATXMLREW-004-aipromptcontentprovider-integration.md) | AIPromptContentProvider Integration | P1 | 2-3h | Not Started |
| [CHADATXMLREW-005](./CHADATXMLREW-005-xml-jest-matchers.md) | XML Jest Matchers | P2 | 1-2h | Not Started |
| [CHADATXMLREW-006](./CHADATXMLREW-006-update-test-assertions.md) | Update Test Assertions | P1 | 3-4h | Not Started |
| [CHADATXMLREW-007](./CHADATXMLREW-007-deprecate-character-data-formatter.md) | Deprecate CharacterDataFormatter | P2 | 1-2h | Not Started |

**Total: 14-20 hours** (approximately 2-3 days of focused work)

---

## Implementation Phases

### Phase 1: Infrastructure (CHADATXMLREW-001, 002, 005)
- Create XML utility classes
- Create test fixtures and matchers
- **Validation Gate:** Unit tests pass with 100% coverage on XmlElementBuilder

### Phase 2: Integration (CHADATXMLREW-003, 004)
- Wire up DI
- Replace Markdown output with XML
- **Validation Gate:** Integration tests pass, XML output well-formed

### Phase 3: Test Migration (CHADATXMLREW-006)
- Update all test assertions from Markdown to XML
- **Validation Gate:** Full test suite passes

### Phase 4: Cleanup (CHADATXMLREW-007)
- Remove deprecated CharacterDataFormatter
- **Validation Gate:** No dead code, coverage maintained

---

## Success Criteria (from spec)

### Mandatory
- [ ] All 18 character components mapped to XML structure
- [ ] XML output is well-formed (validates against parser)
- [ ] LLM optimization features implemented (comments, ordering)
- [ ] 80%+ branch coverage on new code
- [ ] Performance within 20% of Markdown baseline
- [ ] All existing tests updated and passing

### Desirable
- [ ] Clean DI integration
- [ ] Comprehensive test fixtures
- [ ] Documentation complete

---

## Files Created

| File | Created In |
|------|------------|
| `src/prompting/xmlElementBuilder.js` | CHADATXMLREW-001 |
| `tests/unit/prompting/xmlElementBuilder.test.js` | CHADATXMLREW-001 |
| `src/prompting/characterDataXmlBuilder.js` | CHADATXMLREW-002 |
| `tests/unit/prompting/characterDataXmlBuilder.test.js` | CHADATXMLREW-002 |
| `tests/common/prompting/characterDataFixtures.js` | CHADATXMLREW-002 |
| `tests/common/prompting/xmlMatchers.js` | CHADATXMLREW-005 |
| `tests/unit/common/prompting/xmlMatchers.test.js` | CHADATXMLREW-005 |

## Files Modified

| File | Modified In |
|------|------------|
| `src/dependencyInjection/tokens/tokens-ai.js` | CHADATXMLREW-003 |
| `src/dependencyInjection/registrations/aiRegistrations.js` | CHADATXMLREW-003, 004 |
| `src/prompting/AIPromptContentProvider.js` | CHADATXMLREW-004 |
| `tests/unit/prompting/AIPromptContentProvider.test.js` | CHADATXMLREW-004, 006 |
| `tests/unit/dependencyInjection/registrations/aiRegistrations.test.js` | CHADATXMLREW-003 |
| Various integration test files | CHADATXMLREW-006 |

## Files Deleted

| File | Deleted In |
|------|------------|
| `src/prompting/CharacterDataFormatter.js` | CHADATXMLREW-007 |
| `tests/unit/prompting/CharacterDataFormatter.test.js` | CHADATXMLREW-007 |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM behavior change | High | Manual testing with sample prompts before/after |
| Token count increase | Medium | Monitor token counts; XML overhead ~200 tokens |
| Test assertion bulk update | Medium | Use custom matchers to simplify |
| Performance regression | Medium | Benchmark at each phase |

---

## Quick Commands

```bash
# Run all prompting tests
npm run test:unit -- --testPathPattern="prompting"
npm run test:integration -- --testPathPattern="prompting"

# Full validation
npm run test:ci
npm run typecheck
npm run build

# Coverage check
npm run test:unit -- --coverage --testPathPattern="prompting"
```

---

## Recommended Execution Order

1. **CHADATXMLREW-001** - Foundation (no dependencies)
2. **CHADATXMLREW-005** - Can run in parallel with 001
3. **CHADATXMLREW-002** - Requires 001
4. **CHADATXMLREW-003** - Requires 001, 002
5. **CHADATXMLREW-004** - Requires 003, "flips the switch"
6. **CHADATXMLREW-006** - Requires 004, 005
7. **CHADATXMLREW-007** - Final cleanup, requires all others
