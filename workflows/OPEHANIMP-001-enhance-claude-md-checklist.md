# OPEHANIMP-001: Update CLAUDE.md with Enhanced Operation Handler Checklist

**Priority**: High
**Effort**: Low
**Phase**: 1 (Day 1)
**Dependencies**: None

## Objective

Update CLAUDE.md with a comprehensive, step-by-step checklist for adding new operation handlers, including validation commands, common pitfalls, and quick reference table.

## Background

Currently, the operation handler addition process in CLAUDE.md lacks detailed validation commands and comprehensive troubleshooting guidance. Developers frequently miss critical steps (especially the pre-validation whitelist) because the documentation doesn't emphasize validation at each step.

## Current State

CLAUDE.md contains a basic checklist but lacks:
- Step-by-step validation commands after each step
- Detailed common pitfalls section
- Quick reference table for file patterns
- Visual emphasis on critical steps (especially step 7: pre-validation whitelist)

## Requirements

### 1. Enhanced Checklist Section

Add to CLAUDE.md under "Adding New Operations - Complete Checklist":

```markdown
### Adding New Operations - Complete Checklist

When adding a new operation to the system, follow this checklist to ensure complete integration:

#### Step-by-Step Process

1. **Create operation schema** ✅ Validation: Schema is valid JSON
   - File: `data/schemas/operations/[operationName].schema.json`
   - Use `allOf` to extend `../base-operation.schema.json`
   - Define `type` constant and `parameters`
   - Verify: `npm run validate` or `npm run validate:strict`

2. **Add schema reference** ✅ Validation: Reference resolves
   - File: `data/schemas/operation.schema.json` (root schemas directory)
   - Add `$ref` entry to the `anyOf` array in the `Operation` definition
   - Keep alphabetically sorted
   - Verify: `npm run validate` or `npm run validate:strict`

3. **Create operation handler** ✅ Validation: Handler compiles
   - File: `src/logic/operationHandlers/[operationName]Handler.js`
   - Extend `BaseOperationHandler`
   - Implement `execute(context)` method
   - Add comprehensive error handling
   - Verify: `npm run typecheck`

4. **Define DI token** ✅ Validation: Token is unique
   - File: `src/dependencyInjection/tokens/tokens-core.js`
   - Add `[OperationName]Handler: '[OperationName]Handler'`
   - Follow naming convention: PascalCase (no "I" prefix for operation handlers)
   - Verify: `npm run typecheck`

5. **Register handler factory** ✅ Validation: Registration syntax correct
   - File: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Add factory to the `handlerFactories` array with proper dependency injection
   - Add import statement for the handler class
   - Verify: `npm run typecheck`

6. **Map operation to handler** ✅ Validation: Type string matches schema
   - File: `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Add `registry.register('[OPERATION_TYPE]', bind(tokens.[OperationName]Handler))`
   - Ensure type matches schema exactly (use the same string as in schema's `const` field)
   - Verify: `npm run typecheck` and `npm run test:unit`

7. **⚠️ CRITICAL: Add to pre-validation whitelist** ✅ Validation: Type in whitelist
   - File: `src/utils/preValidationUtils.js`
   - Add `'[OPERATION_TYPE]'` to `KNOWN_OPERATION_TYPES` array
   - Keep alphabetically sorted
   - **Failure to do this will cause validation failures during mod loading**
   - Verify: `npm run validate` or `npm run test:ci`

8. **Create tests** ✅ Validation: Tests pass with coverage
   - Unit: `tests/unit/logic/operationHandlers/[operationName]Handler.test.js`
   - Integration: `tests/integration/mods/[category]/[operationName]RuleExecution.test.js`
   - Verify: `npm run test:unit && npm run test:integration`

#### Validation Commands

Run after each step for immediate feedback:

```bash
# After steps 1-2: Validate schemas and mod structure
npm run validate           # Basic validation
npm run validate:strict    # Strict validation with all checks

# After steps 3-6: Type check and compile
npm run typecheck

# After step 7: Validate operation completeness
npm run validate           # Will check operation type registration
npm run test:unit          # Unit tests will catch missing registrations

# After step 8: Run tests
npm run test:unit
npm run test:integration

# Final verification: Full test suite
npm run test:ci           # Runs unit, integration, and e2e tests
npx eslint <modified-files>  # Lint the modified files
```

#### Common Pitfalls

❌ **Forgetting pre-validation whitelist** (Step 7)
- Symptom: "Unknown operation type" error during mod loading
- Fix: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

❌ **Type string mismatch**
- Symptom: "No handler registered" error at runtime
- Fix: Ensure type matches exactly in schema, registry, and whitelist

❌ **Missing schema $ref**
- Symptom: AJV validation fails with "no matching schema"
- Fix: Add `$ref` to `operation.schema.json`

❌ **Incomplete DI registration**
- Symptom: "Cannot resolve token" error
- Fix: Check token defined, factory registered, and operation mapped

#### Quick Reference

| File | Purpose | Pattern |
|------|---------|---------|
| `operations/[operation].schema.json` | Structure | `"const": "OPERATION_NAME"` |
| `operation.schema.json` | Reference | `{ "$ref": "./operations/[operation].schema.json" }` in `anyOf` |
| `[operation]Handler.js` | Logic | `class extends BaseOperationHandler` |
| `tokens-core.js` | Token | `[Operation]Handler: '[Operation]Handler'` |
| `operationHandlerRegistrations.js` | Factory | Factory in `handlerFactories` array |
| `interpreterRegistrations.js` | Mapping | `registry.register('TYPE', bind(token))` |
| `preValidationUtils.js` | Whitelist | `'OPERATION_NAME'` in `KNOWN_OPERATION_TYPES` |

**Note**: There is currently no dedicated operation-adding documentation file. Refer to existing operation handlers in `src/logic/operationHandlers/` as examples.
```

### 2. Update Existing "Adding New Operations" Section

Replace the current section in CLAUDE.md with the enhanced version above.

### 3. Add Visual Emphasis

- Use ⚠️ emoji for critical steps
- Use ❌ emoji for common mistakes
- Use ✅ emoji for validation checkpoints

## Acceptance Criteria

- [ ] CLAUDE.md contains complete step-by-step checklist
- [ ] Each step has validation command specified
- [ ] Common pitfalls section is comprehensive
- [ ] Quick reference table is included
- [ ] Step 7 (pre-validation whitelist) is visually emphasized as CRITICAL
- [ ] All validation commands are correct and tested
- [ ] Documentation links are valid

## Testing

1. Have a developer unfamiliar with the process follow the checklist
2. Verify they can complete all steps without external help
3. Verify all validation commands work as documented
4. Confirm the quick reference table is accurate

## Implementation Notes

- Keep existing CLAUDE.md structure intact
- Replace only the "Adding New Operations" section (currently at lines 440-468)
- Ensure markdown formatting is correct
- Test all code blocks for syntax

## Corrections Made to Workflow (Analysis Completed)

The following corrections were made based on analysis of the actual codebase:

1. **Schema reference file path**: Changed from `data/schemas/operations/operation.schema.json` to `data/schemas/operation.schema.json` (root schemas directory)
2. **Schema array type**: Changed from `oneOf` to `anyOf` (actual implementation uses `anyOf`)
3. **Token naming**: Removed "I" prefix from operation handler tokens (actual pattern: `[OperationName]Handler`, not `I[OperationName]Handler`)
4. **Registry method**: Changed from `operationRegistry.registerOperation()` to `registry.register()` (actual method name)
5. **Registry binding**: Added `bind()` wrapper for handler tokens in registry (actual implementation pattern)
6. **Validation commands**: Replaced non-existent commands (`validate:schemas`, `validate:tokens`, `validate:operations`) with actual commands (`validate`, `validate:strict`, `typecheck`, `test:ci`)
7. **Documentation reference**: Updated to note that `docs/adding-operations.md` doesn't exist; recommend using existing handlers as examples
8. **Quick reference table**: Updated all patterns to match actual codebase implementation
9. **Related files**: Added accurate file paths and descriptions

## Time Estimate

2-3 hours

## Related Files

- `CLAUDE.md` (main file to update - section at lines 440-468)
- Reference: `data/schemas/operations/*.schema.json` (individual operation schemas)
- Reference: `data/schemas/operation.schema.json` (main operation schema with anyOf references)
- Reference: `data/schemas/base-operation.schema.json` (base schema for all operations)
- Reference: `src/logic/operationHandlers/*.js` (operation handler implementations)
- Reference: `src/logic/operationHandlers/baseOperationHandler.js` (base handler class)
- Reference: `src/dependencyInjection/tokens/tokens-core.js` (token definitions)
- Reference: `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (handler DI registration)
- Reference: `src/dependencyInjection/registrations/interpreterRegistrations.js` (operation registry mapping)
- Reference: `src/utils/preValidationUtils.js` (KNOWN_OPERATION_TYPES whitelist)

## Success Metrics

- Reduction in "missed step" errors during operation addition
- Faster onboarding for new developers
- Fewer support questions about operation registration
