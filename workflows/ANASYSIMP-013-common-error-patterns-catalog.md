# ANASYSIMP-013: Common Error Patterns Catalog

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (1 day)
**Impact:** High - Reduces troubleshooting time
**Status:** Not Started

## Context

Same errors encountered repeatedly without comprehensive reference documentation. Recipe creators spend time re-discovering solutions to known problems. While `docs/anatomy/troubleshooting.md` exists with 583 lines of error documentation, it focuses on debugging specific scenarios rather than providing a comprehensive catalog of all error types with their signatures, causes, and fixes. An error catalog (`docs/anatomy/common-errors.md`, 41KB) already exists but needs enhancement for complete coverage.

**Current State**:
- `docs/anatomy/troubleshooting.md` - Problem-oriented troubleshooting guide (583 lines)
- `docs/anatomy/common-errors.md` - Error catalog already exists (41KB) - needs enhancement/update
- Error classes implemented in `src/anatomy/errors/` with structured error information
- Validation infrastructure in place (`RecipePreflightValidator`, validation rules)
- Task: Enhance existing error catalog with complete coverage and cross-references

## Solution Overview

Enhance existing error catalog at `docs/anatomy/common-errors.md` (41KB) documenting all common anatomy system errors with:

- **Error signature** - How to recognize the error
- **Symptoms** - What you see
- **Common causes** - Why it happens
- **Diagnostic steps** - How to investigate
- **Example fixes** - Concrete solutions
- **Related issues** - Similar errors

## Content Structure

### Major Error Categories

Based on actual error classes (`src/anatomy/errors/`) and validation infrastructure (`src/anatomy/validation/`):

1. **Validation Report Errors** (RecipeValidationError)
   - Multiple validation failures
   - Load-time validation failures
   - Recipe structure violations

2. **Component Existence Errors** (ComponentNotFoundError)
   - Component not found in registry
   - Invalid component reference
   - Missing component definition
   - Source: `ComponentExistenceValidationRule`

3. **Property Schema Errors** (InvalidPropertyError)
   - Invalid enum value
   - Wrong data type
   - Missing required property
   - Additional properties not allowed
   - Source: `PropertySchemaValidationRule`

4. **Entity/Part Selection Errors** (Most common from Red Dragon case study)
   - No matching entities found
   - partType/subType mismatch
   - Entity missing required components
   - Property value mismatches
   - Source: `PartSelectionService` - validation in `#meetsAllRequirements` (lines 251-433), type checking (lines 273-307), error building (lines 467-539)

5. **Socket/Slot Errors** (SocketNotFoundError)
   - Socket not found on parent entity
   - Missing socket reference
   - Blueprint additionalSlots compatibility
   - Source: `socketSlotCompatibilityValidator`

6. **Pattern Matching Errors**
   - Pattern matching failure (zero slots matched)
   - No entities match pattern requirements
   - Pattern requirements too strict
   - Source: `patternMatchingValidator`

7. **Blueprint/Recipe Compatibility Errors**
   - Blueprint-recipe mismatch
   - Structure template errors
   - Blueprint missing required fields
   - Source: `BlueprintRecipeValidationRule`

8. **Constraint Validation Errors**
   - Invalid constraint definition
   - Constraint violation at generation
   - Co-presence requirement failure
   - Source: Recipe constraint evaluator

**Note**: "Description Errors" removed as lower priority than core generation errors

### Example Entry Format

Based on actual error class structure (`src/anatomy/errors/`) and ValidationReport format:

```markdown
## Error: "No entity definitions found matching anatomy requirements"

**Error Class:** Entity/Part Selection Error (thrown by `PartSelectionService`)

**Error Signature:**
```
Error: No entity definitions found matching anatomy requirements.
Need part type: 'dragon_wing'. Allowed types: [wing]
```

**Error Properties** (from actual implementation):
- `partType`: Required part type (e.g., 'dragon_wing')
- `allowedTypes`: Socket's allowed types (e.g., ['wing'])
- `requirements`: Full requirements object from pattern
- Location: Part selection during recipe processing

**Symptom:** Pattern matching fails to find entities, anatomy generation halts

**When It Occurs:**
- Runtime (during anatomy generation)
- After pattern matching succeeds but entity selection fails
- Most common error from Red Dragon case study (Error Round 2)

**Common Causes:**
1. **partType/subType mismatch** - Entity's `subType` doesn't match recipe's `partType` (CRITICAL - see `docs/anatomy/troubleshooting.md:264-487`)
2. Entity missing required components from pattern.tags
3. Entity component properties don't match pattern.properties
4. Entity not loaded (mod dependency issue)

**Diagnostic Steps:**
1. Check entity's `anatomy:part.subType` matches recipe's `partType` EXACTLY
2. Verify entity has all required components (pattern.components or pattern.tags)
3. Check component property values match (pattern.properties)
4. Verify allowedTypes includes the partType
5. Confirm mod is loaded in game.json

**Example Fix:**

Before (WRONG):
```json
// Recipe pattern
{
  "partType": "dragon_wing",  // Specific type
  "components": ["anatomy:part", "descriptors:length_category"]
}

// Entity definition
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "wing"  // ❌ MISMATCH! Generic type
    }
  }
}
```

After (CORRECT):
```json
// Entity definition
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "dragon_wing"  // ✅ MATCHES recipe partType
    },
    "descriptors:length_category": { "length": "immense" }
  }
}
```

**Related Errors:**
- "Runtime component validation failed"
- "Pattern matched zero slots" (pattern matching validator warning)
- "Invalid property value" (if properties don't match)

**Implementation References:**
- `src/anatomy/partSelectionService.js:251-433` - Full validation logic in `#meetsAllRequirements`
- `src/anatomy/partSelectionService.js:467-539` - Error context building
- `docs/anatomy/troubleshooting.md:264-487` - partType/subType guide
- `reports/anatomy-system-v2-improvements.md:190-196` - Red Dragon Error Round 2
```

## File Structure

```
docs/anatomy/
├── troubleshooting.md            # Problem-oriented guide (existing, 583 lines)
└── common-errors.md              # EXISTING: Error catalog (41KB) - enhance with complete coverage
```

**Relationship to Existing Documentation:**
- `troubleshooting.md` (583 lines) - Problem-oriented ("Body parts not generated", "Clothing not attaching")
- `common-errors.md` (existing 41KB) - Error-oriented ("ComponentNotFoundError", "No matching entities")
- Different organization strategies for different use cases
- Both documents exist and complement each other - task is to enhance coverage and cross-references

## Acceptance Criteria

**Required Error Coverage:**
- [ ] Documents all 7 error scenarios from Red Dragon case study (6 error rounds + 1 final issue, lines 181-243)
- [ ] Covers all error classes in `src/anatomy/errors/`:
  - [ ] AnatomyError (base class)
  - [ ] ComponentNotFoundError
  - [ ] InvalidPropertyError
  - [ ] SocketNotFoundError
  - [ ] RecipeValidationError
  - [ ] BodyDescriptorValidationError (exists but not exported in index.js - document if relevant to common errors)
- [ ] Documents all validator error types from `src/anatomy/validation/`:
  - [ ] RecipePreflightValidator errors
  - [ ] ComponentExistenceValidationRule
  - [ ] PropertySchemaValidationRule
  - [ ] BlueprintRecipeValidationRule
  - [ ] Pattern matching validator warnings
  - [ ] Socket/slot compatibility errors
  - [ ] Part availability errors

**Content Quality:**
- [ ] Each error includes: signature, properties, causes, diagnostic steps, fix examples
- [ ] Shows before/after code examples
- [ ] Links error classes to source files (with line numbers)
- [ ] Cross-references to `troubleshooting.md` for related problems
- [ ] Distinguishes load-time vs runtime errors
- [ ] Includes ValidationReport structure and format

**Usability:**
- [ ] Searchable error signatures (exact error messages)
- [ ] Organized by error class/category
- [ ] Quick reference table at top (Error → Class → Source File)
- [ ] Examples use real data from Red Dragon case study where applicable

## Dependencies

**Depends On:** ANASYSIMP-007 (Error classes provide error signatures)

**Current Status**: ✅ Error classes already implemented in `src/anatomy/errors/`:
- `AnatomyError.js` (base class)
- `ComponentNotFoundError.js`
- `InvalidPropertyError.js`
- `SocketNotFoundError.js`
- `RecipeValidationError.js`
- `bodyDescriptorValidationError.js` (exists but not exported in index.js)
- `errorTemplates.js` with ERROR_TEMPLATES registry
- `index.js` exports 5 main error classes

Dependency is **satisfied** - error infrastructure exists and is in production use.

## Implementation Notes

**Existing Resources to Leverage:**
1. **Error Classes** (`src/anatomy/errors/`) - Structured error information with context, problem, impact, fix, and references
2. **Validation Infrastructure** (`src/anatomy/validation/`) - All validators and error types are implemented
   - 9 validation rules in `src/anatomy/validation/rules/`
   - `RecipePreflightValidator.js`, `patternMatchingValidator.js`, `socketSlotCompatibilityValidator.js`
3. **Red Dragon Case Study** (`reports/anatomy-system-v2-improvements.md:181-243`) - 7 error scenarios (6 rounds + final issue)
4. **Troubleshooting Guide** (`docs/anatomy/troubleshooting.md`) - 583 lines of problem-oriented documentation
5. **Existing Error Catalog** (`docs/anatomy/common-errors.md`) - 41KB existing file with error documentation
6. **ValidationReport Format** (`src/anatomy/validation/ValidationReport.js`) - Error/warning/suggestion structure

**Approach:**
- Review and enhance existing `common-errors.md` (41KB)
- Mine error examples from Red Dragon case study (lines 181-243 in report)
- Extract error signatures from error class constructors (`src/anatomy/errors/*.js`)
- Document validation rules from `src/anatomy/validation/rules/` (9 rules)
- Cross-reference to troubleshooting.md (583 lines) for related problems
- Maintain distinction between load-time and runtime errors
- Ensure comprehensive coverage of all validation infrastructure

## References

- **Report Section:** Recommendation 3.2
- **Report Pages:** Lines 967-1048 (recommendation), 181-243 (Red Dragon 7 error scenarios)
- **Error Examples:** Throughout Red Dragon analysis in report
- **Existing Documentation:**
  - `docs/anatomy/troubleshooting.md` (583 lines) - Problem-oriented guide
  - `docs/anatomy/common-errors.md` (41KB existing) - Error catalog to enhance
- **Error Classes:** `src/anatomy/errors/` (6 error class files, 5 exported + errorTemplates)
- **Validators:** `src/anatomy/validation/` (9 validation rules + 3 main validators)
