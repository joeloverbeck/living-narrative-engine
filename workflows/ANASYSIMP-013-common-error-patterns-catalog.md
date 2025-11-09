# ANASYSIMP-013: Common Error Patterns Catalog

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (1 day)
**Impact:** High - Reduces troubleshooting time
**Status:** Not Started

## Context

Same errors encountered repeatedly without reference documentation. Recipe creators spend time re-discovering solutions to known problems.

## Solution Overview

Create comprehensive error catalog at `docs/anatomy/common-errors.md` documenting all common anatomy system errors with:

- **Error signature** - How to recognize the error
- **Symptoms** - What you see
- **Common causes** - Why it happens
- **Diagnostic steps** - How to investigate
- **Example fixes** - Concrete solutions
- **Related issues** - Similar errors

## Content Structure

### Major Error Categories

1. **Component Errors**
   - Component not found
   - Invalid component data
   - Missing component fields

2. **Property Errors**
   - Invalid enum value
   - Wrong data type
   - Missing required property

3. **Entity Errors**
   - No matching entities
   - Entity missing components
   - Property value mismatches

4. **Socket/Slot Errors**
   - Socket not found
   - Missing socket reference
   - Capacity exceeded

5. **Pattern Errors**
   - Pattern matching failure
   - No entities match pattern
   - Pattern requirements too strict

6. **Constraint Errors**
   - Invalid constraint definition
   - Constraint violation
   - Co-presence failure

7. **Description Errors**
   - Parts excluded from description
   - Missing descriptors
   - Empty description output

### Example Entry Format

```markdown
## Error: "No entity definitions found matching anatomy requirements"

**Symptom:** Pattern matching fails to find entities

**Common Causes:**
1. Entity missing required component
2. Entity component has wrong property values
3. Pattern requirements too strict
4. Entity not loaded (mod dependency issue)

**Diagnostic Steps:**
1. Check entity has all required components (pattern.tags)
2. Verify component property values match (pattern.properties)
3. Check entity partType matches (pattern.partType)
4. Verify mod is loaded in game.json

**Example Fix:**
[Code example showing before/after]

**Related Errors:**
- "Component validation failed"
- "Pattern matching returned 0 results"
```

## File Structure

```
docs/anatomy/
└── common-errors.md              # Error catalog
```

## Acceptance Criteria

- [ ] Documents all errors from Red Dragon case study
- [ ] Covers all validator error types
- [ ] Includes concrete examples for each error
- [ ] Provides diagnostic steps
- [ ] Shows before/after fixes
- [ ] Links to related documentation
- [ ] Searchable error signatures

## Dependencies

**Depends On:** ANASYSIMP-007 (Error classes provide error signatures)

## References

- **Report Section:** Recommendation 3.2
- **Report Pages:** Lines 967-1048
- **Error Examples:** Throughout Red Dragon analysis
