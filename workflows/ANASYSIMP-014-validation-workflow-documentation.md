# ANASYSIMP-014: Validation Workflow Documentation

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Improves understanding
**Status:** Partially Implemented

## Context

The anatomy system has a comprehensive validation pipeline already implemented, but lacks centralized documentation explaining the complete validation workflow and how the stages work together.

**Existing Validation Documentation:**
- `docs/anatomy/common-errors.md` - Error catalog with validation sections
- `docs/anatomy/troubleshooting.md` - Troubleshooting with validation diagnostics
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor validation guide

**Gap:** No single document explaining the complete validation pipeline workflow from load-time through runtime.

## Solution Overview

Create comprehensive validation workflow documentation at `docs/anatomy/validation-workflow.md` that consolidates and extends existing validation documentation:

1. **Validation Stages** (with accurate implementation details)
   - **Stage 1: Load-Time Schema Validation**
     - Implementation: `AjvSchemaValidator` (`src/validation/ajvSchemaValidator.js`)
     - Validates: JSON schemas for blueprints, recipes, components, entity definitions
     - When: During mod loading, before any content processing
     - Tools: Automatic during mod loading

   - **Stage 2: Pre-flight Recipe Validation**
     - Implementation: `RecipePreflightValidator` (`src/anatomy/validation/RecipePreflightValidator.js`)
     - Validates: 9 checks including component existence, property schemas, socket-slot compatibility, pattern matching
     - When: After schema validation, before runtime generation
     - Tools: `scripts/validate-recipe.js`, RecipePreflightValidator API

   - **Stage 3: Generation-Time Runtime Validation**
     - Implementation: Multiple validators in `src/anatomy/bodyBlueprintFactory/blueprintValidator.js`, `src/anatomy/graphIntegrityValidator.js`
     - Validates: Blueprint-recipe slot compatibility, entity graph integrity, socket availability
     - When: During `AnatomyGenerationWorkflow.generate()`
     - Tools: Runtime validation in generation workflow

   - **Stage 4: Body Descriptor Validation**
     - Implementation: `BodyDescriptorValidator` (`src/anatomy/validators/bodyDescriptorValidator.js`)
     - Validates: Body descriptor values, formatting config, system consistency
     - When: Multiple stages (load-time recipes, runtime generation, CLI validation)
     - Tools: `npm run validate:body-descriptors`, BodyDescriptorValidator API

2. **Validation Best Practices**
   - Always run schema validation first (automatic)
   - Use pre-flight validator during development: `node scripts/validate-recipe.js <recipe-id>`
   - Check validation report for all issues before testing
   - Test incrementally with explicit slot definitions before patterns
   - Validate body descriptors: `npm run validate:body-descriptors`

3. **Validation Checklist**
   - ✅ Component references exist (Stage 2: ComponentExistenceValidationRule)
   - ✅ Property values valid (Stage 2: PropertySchemaValidationRule)
   - ✅ Entity definitions complete (Stage 2: Part availability checks)
   - ✅ Sockets match slots (Stage 2: socketSlotCompatibilityValidator)
   - ✅ Patterns have matches (Stage 2: patternMatchingValidator)
   - ✅ Blueprint-recipe compatibility (Stage 3: blueprintValidator)
   - ✅ Entity graph integrity (Stage 3: graphIntegrityValidator)
   - ✅ Body descriptors valid (Stage 4: BodyDescriptorValidator)

4. **Troubleshooting Workflow**
   - Read full error messages (include context from ValidationReport)
   - Check referenced files (blueprints, recipes, templates, entity definitions)
   - Use validation tools:
     - `node scripts/validate-recipe.js <recipe-id>` - Recipe validation
     - `npm run validate:body-descriptors` - Body descriptor validation
     - RecipePreflightValidator API - Programmatic validation
   - Consult error catalog: `docs/anatomy/common-errors.md`
   - Follow troubleshooting guide: `docs/anatomy/troubleshooting.md`

5. **Integration with Existing Docs**
   - Link to `common-errors.md` for error message lookup
   - Link to `troubleshooting.md` for problem-oriented scenarios
   - Link to `body-descriptors-complete.md` for descriptor validation details
   - Reference `anatomy-system-guide.md` for architectural context

## File Structure

```
docs/anatomy/
├── validation-workflow.md        # NEW: Complete validation pipeline guide
├── common-errors.md             # EXISTS: Error catalog with validation sections
├── troubleshooting.md           # EXISTS: Problem-oriented troubleshooting
└── body-descriptors-complete.md # EXISTS: Body descriptor validation guide
```

## Implementation Status

**Already Implemented:**
- ✅ AjvSchemaValidator (Stage 1)
- ✅ RecipePreflightValidator with 9 validation checks (Stage 2)
- ✅ Blueprint and graph integrity validators (Stage 3)
- ✅ BodyDescriptorValidator (Stage 4)
- ✅ CLI validation tools (`validate-recipe.js`, `validate:body-descriptors`)
- ✅ Error catalog documentation (`common-errors.md`)
- ✅ Troubleshooting guide (`troubleshooting.md`)

**Remaining Work:**
- ❌ Create centralized `validation-workflow.md` document
- ❌ Document complete validation pipeline with stage interactions
- ❌ Add cross-references between validation docs
- ❌ Document validation tool usage examples
- ❌ Add validation workflow diagrams

## Acceptance Criteria

- [ ] Documents all 4 validation stages with accurate implementation details
- [ ] Explains when each stage runs and what it validates
- [ ] Provides best practices with concrete tool examples
- [ ] Includes comprehensive validation checklist mapped to validators
- [ ] Links to all validation tools with usage examples
- [ ] Shows complete troubleshooting workflow with tool references
- [ ] Integrates with existing validation documentation
- [ ] Includes validation pipeline diagrams

## Dependencies

**Implementation Complete:** RecipePreflightValidator is already implemented at `src/anatomy/validation/RecipePreflightValidator.js`

**Documentation Dependencies:**
- Existing docs: `common-errors.md`, `troubleshooting.md`, `body-descriptors-complete.md`
- Source code: `RecipePreflightValidator.js`, `BodyDescriptorValidator.js`, `blueprintValidator.js`
- Validation tools: `scripts/validate-recipe.js`, `npm run validate:body-descriptors`

## References

- **Report Section:** Recommendation 3.3
- **Report Pages:** Lines 1050-1148
- **Existing Validators:**
  - `src/validation/ajvSchemaValidator.js` - Schema validation
  - `src/anatomy/validation/RecipePreflightValidator.js` - Pre-flight validation
  - `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` - Blueprint validation
  - `src/anatomy/graphIntegrityValidator.js` - Graph integrity validation
  - `src/anatomy/validators/bodyDescriptorValidator.js` - Body descriptor validation
- **CLI Tools:**
  - `scripts/validate-recipe.js` - Recipe validation CLI
  - `npm run validate:body-descriptors` - Body descriptor validation CLI
