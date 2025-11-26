# SCHVALTESINT-000: Schema Validation Test Integration - Overview

**Epic**: Schema Validation Robustness & Test Integration
**Status**: Planning
**Created**: 2025-11-26
**Spec**: `specs/schema-validation-test-integration.md`

---

## Problem Summary

The test infrastructure (`ModTestFixture`, `IntegrationTestBed`, `systemLogicTestEnv`) bypasses schema validation, allowing invalid mod data to pass tests while failing in production. This caused runtime failures for LOCK_GRABBING/UNLOCK_GRABBING operations and corePromptText.json validation.

## Root Causes

1. **ModTestFixture bypasses schema validation** - JSON parsed but not validated
2. **IntegrationTestBed mocks schema validator** - Uses test-only schemas
3. **Template strings not natively supported** - Each operation reinvents oneOf pattern
4. **Only 4 of 62 operations have pre-validation rules** - Most operations lack parameter validation
5. **No CI validation gate** - Validation failures not caught before tests run

## Ticket Breakdown

### Phase 1: CRITICAL - Fail-Fast in Test Infrastructure

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-001 | Add schema validation to ModTestFixture.forAction() | CRITICAL | M |
| SCHVALTESINT-002 | Add schema validation to ModTestFixture.forRule() | CRITICAL | S |
| SCHVALTESINT-003 | Update systemLogicTestEnv with schema validator | HIGH | S |
| SCHVALTESINT-004 | Add real schema option to IntegrationTestBed | HIGH | M |

### Phase 2: HIGH - CI Validation Gate

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-005 | Add validation-gate job to CI workflow | HIGH | S |

### Phase 3: MEDIUM - Template String Standardization

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-006 | Create common.schema.json with template definitions | MEDIUM | M |
| SCHVALTESINT-007 | Migrate lockGrabbing.schema.json to use $ref | MEDIUM | S |
| SCHVALTESINT-008 | Migrate unlockGrabbing.schema.json to use $ref | MEDIUM | S |
| SCHVALTESINT-009 | Create schema pattern linting script | LOW | S |

### Phase 4: MEDIUM - Parameter Rule Auto-Generation

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-010 | Create parameterRuleGenerator.js | MEDIUM | L |
| SCHVALTESINT-011 | Integrate auto-generated rules into preValidationUtils | MEDIUM | M |

### Phase 5: LOW - Enhanced Error Messages

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-012 | Create validationErrorContext.js | LOW | M |
| SCHVALTESINT-013 | Create suggestionUtils.js for "Did you mean?" | LOW | S |
| SCHVALTESINT-014 | Integrate enhanced errors into ajvAnyOfErrorFormatter | LOW | M |

### Testing & Validation

| Ticket | Title | Priority | Est. Size |
|--------|-------|----------|-----------|
| SCHVALTESINT-015 | Create regression test suite | HIGH | M |

## Dependencies

```
SCHVALTESINT-001 ─┬─→ SCHVALTESINT-002 ─→ SCHVALTESINT-003
                  │
                  └─→ SCHVALTESINT-004

SCHVALTESINT-006 ─→ SCHVALTESINT-007 ─→ SCHVALTESINT-008 ─→ SCHVALTESINT-009

SCHVALTESINT-010 ─→ SCHVALTESINT-011

SCHVALTESINT-012 ─┬─→ SCHVALTESINT-014
                  │
SCHVALTESINT-013 ─┘

SCHVALTESINT-001..004 ─→ SCHVALTESINT-015
```

## Invariants to Enforce

1. **INV-1**: All tests using ModTestFixture must validate against schemas before execution
2. **INV-2**: Template-accepting parameters must use common.schema.json $ref
3. **INV-3**: Every known operation type must have parameter validation rules
4. **INV-4**: CI validation gate must pass before any test job runs
5. **INV-5**: All fields accessed from JSON data files must exist in corresponding schemas

## Success Criteria

- [ ] All existing mod tests fail fast when rule files violate schemas
- [ ] CI rejects PRs with validation failures before test execution
- [ ] All 62 operations have parameter validation rules
- [ ] Template string patterns use single shared definition
- [ ] Validation errors include file path, line number, and suggestions
