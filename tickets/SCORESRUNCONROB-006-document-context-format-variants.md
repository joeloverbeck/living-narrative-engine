# SCORESRUNCONROB-006 – Document Three Context Format Variants

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
