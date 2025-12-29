# SCORESRUNCONROB-006 – Document Three Context Format Variants

**Status**: ✅ COMPLETED

## Problem

Scope resolvers accept three different context formats, but this is not documented anywhere:

1. **Direct entity**: `{ id: "actor-123", components: {...} }`
2. **Enriched context**: `{ actorEntity: {...}, otherData: ... }`
3. **Actor pipeline context**: `{ actor: {...}, targets: {...} }`

The `registerCustomScope()` method normalizes these formats before validation using:
```javascript
const actorEntity = context.actorEntity || context.actor || context;
```

Without documentation, developers don't know:
- Which formats are valid inputs
- How normalization works
- Why validation errors might occur with wrapped contexts

## Proposed scope

Add documentation to `docs/testing/mod-testing-guide.md` explaining:
- The three accepted context formats with examples
- The normalization process that extracts the actor entity
- When each format is typically encountered
- Common error scenarios from incorrect format usage

## File list

- `docs/testing/mod-testing-guide.md` (MODIFY — add to section from SCORESRUNCONROB-005 or new subsection)

## Out of scope

- Any source code files — no changes
- Any test files — no changes
- `docs/testing/scope-resolver-registry.md` — no changes
- Other documentation files — no changes

## Acceptance criteria

### Tests

Manual review of documentation content. No automated tests required.

### Invariants

1. Existing documentation sections remain unchanged
2. No broken markdown links
3. Follows existing documentation style and patterns
4. Code examples are syntactically correct JavaScript

### Content requirements

The documentation must include:

| Requirement | Description |
|-------------|-------------|
| **Format 1: Direct entity** | Example: `{ id: "actor-1", components: { "core:actor": {} } }` |
| **Format 2: Enriched context** | Example: `{ actorEntity: { id: "actor-1" }, metadata: {} }` |
| **Format 3: Actor pipeline** | Example: `{ actor: { id: "actor-1" }, targets: { primary: {...} } }` |
| **Normalization explanation** | Show the extraction priority: `actorEntity || actor || context` |
| **Usage context** | Explain when each format is typically used |
| **Error examples** | Show what happens with invalid formats |

### Code examples required

```javascript
// Format 1: Direct entity (most common in unit tests)
const directEntity = { id: "actor-123", components: {} };
resolver(directEntity);

// Format 2: Enriched context (used by action discovery pipeline)
const enrichedContext = {
  actorEntity: { id: "actor-123", components: {} },
  targets: { primary: targetEntity }
};
resolver(enrichedContext);

// Format 3: Actor pipeline context (used internally by pipeline stages)
const pipelineContext = {
  actor: { id: "actor-123", components: {} },
  targets: {}
};
resolver(pipelineContext);
```

### Placement

Add as a subsection within or adjacent to the "Location-Based Scope Resolution" section added by SCORESRUNCONROB-005.

---

## Outcome

### What was actually changed

**Modified file**: `docs/testing/mod-testing-guide.md`

Added a new section "Context Format Variants for Scope Resolution" (lines 1472-1589) containing:

1. **Overview**: Explanation of why normalization exists and how it prevents validation failures
2. **Three format examples** with JavaScript code showing:
   - Direct entity format (most common in unit tests)
   - Enriched context format (used by action discovery pipeline)
   - Actor pipeline context format (used internally by pipeline stages)
3. **Format usage table**: When each format is typically encountered
4. **Normalization process**: Detailed explanation of the `actorEntity || actor || context` extraction priority
5. **Common error scenarios**: Before/after code examples showing validation failures and their fixes
6. **Format detection helper**: Utility function for debugging context format issues

### Verification

- Ticket assumptions verified against actual code:
  - `tests/common/mods/ModTestFixture.js:2905` contains the normalization pattern
  - `tests/common/mods/scopeResolverHelpers.js:1276` contains the same pattern
- All acceptance criteria met:
  - ✅ Three format examples with code
  - ✅ Normalization explanation
  - ✅ Usage context table
  - ✅ Error examples with correct/incorrect patterns
  - ✅ Placed adjacent to "Location-Based Scope Resolution" section
- No source code or test files were modified (documentation-only change as specified)

### Changes vs. originally planned

No deviations from the original plan. The documentation was added exactly as specified in the ticket requirements, placed in the designated location within `docs/testing/mod-testing-guide.md`.
