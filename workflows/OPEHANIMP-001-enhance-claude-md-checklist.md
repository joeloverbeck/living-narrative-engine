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
   - Use `allOf` to extend `base-operation.schema.json`
   - Define `type` constant and `parameters`
   - Verify: `npm run validate:schemas`

2. **Add schema reference** ✅ Validation: Reference resolves
   - File: `data/schemas/operations/operation.schema.json`
   - Add `$ref` entry to `oneOf` array
   - Keep alphabetically sorted
   - Verify: `npm run validate:schemas`

3. **Create operation handler** ✅ Validation: Handler compiles
   - File: `src/logic/operationHandlers/[operationName]Handler.js`
   - Extend `BaseOperationHandler`
   - Implement `execute(context)` method
   - Add comprehensive error handling
   - Verify: `npm run typecheck`

4. **Define DI token** ✅ Validation: Token is unique
   - File: `src/dependencyInjection/tokens/tokens-core.js`
   - Add `I[OperationName]Handler: 'I[OperationName]Handler'`
   - Follow naming convention: PascalCase
   - Verify: `npm run validate:tokens`

5. **Register handler factory** ✅ Validation: Registration syntax correct
   - File: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Add `container.register(tokens.I[OperationName]Handler, [OperationName]Handler)`
   - Add import statement
   - Verify: `npm run typecheck`

6. **Map operation to handler** ✅ Validation: Type string matches schema
   - File: `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Add `operationRegistry.registerOperation('[OPERATION_TYPE]', tokens.I[OperationName]Handler)`
   - Ensure type matches schema exactly
   - Verify: `npm run validate:operations`

7. **⚠️ CRITICAL: Add to pre-validation whitelist** ✅ Validation: Type in whitelist
   - File: `src/utils/preValidationUtils.js`
   - Add `'[OPERATION_TYPE]'` to `KNOWN_OPERATION_TYPES` array
   - Keep alphabetically sorted
   - **Failure to do this will cause validation failures during mod loading**
   - Verify: `npm run validate:operations`

8. **Create tests** ✅ Validation: Tests pass with coverage
   - Unit: `tests/unit/logic/operationHandlers/[operationName]Handler.test.js`
   - Integration: `tests/integration/mods/[category]/[operationName]RuleExecution.test.js`
   - Verify: `npm run test:unit && npm run test:integration`

#### Validation Commands

Run after each step for immediate feedback:

```bash
# After steps 1-2: Validate schemas
npm run validate:schemas

# After steps 3-6: Type check and compile
npm run typecheck

# After step 7: Validate operation completeness
npm run validate:operations

# After step 8: Run tests
npm run test:unit
npm run test:integration

# Final verification: Full test suite
npm run test:ci
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
| `[operation].schema.json` | Structure | `"const": "OPERATION_NAME"` |
| `operation.schema.json` | Reference | `{ "$ref": "./[operation].schema.json" }` |
| `[operation]Handler.js` | Logic | `class extends BaseOperationHandler` |
| `tokens-core.js` | Token | `I[Operation]Handler: 'I[Operation]Handler'` |
| `operationHandlerRegistrations.js` | Factory | `container.register(token, Class)` |
| `interpreterRegistrations.js` | Mapping | `registerOperation('TYPE', token)` |
| `preValidationUtils.js` | Whitelist | `'OPERATION_NAME'` in array |

See `docs/adding-operations.md` for detailed examples and troubleshooting.
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
- Replace only the "Adding New Operations" section
- Ensure markdown formatting is correct
- Test all code blocks for syntax

## Time Estimate

2-3 hours

## Related Files

- `CLAUDE.md` (main file to update)
- Reference: `data/schemas/operations/*.schema.json`
- Reference: `src/logic/operationHandlers/*.js`
- Reference: `src/dependencyInjection/tokens/tokens-core.js`
- Reference: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- Reference: `src/dependencyInjection/registrations/interpreterRegistrations.js`
- Reference: `src/utils/preValidationUtils.js`

## Success Metrics

- Reduction in "missed step" errors during operation addition
- Faster onboarding for new developers
- Fewer support questions about operation registration
