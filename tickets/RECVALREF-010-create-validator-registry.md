# RECVALREF-010: Create Validator Registry

**Phase:** 3 - Validator Implementations
**Priority:** P0 - Critical
**Estimated Effort:** 2 hours
**Dependencies:** RECVALREF-001

## Context

Need centralized registry for validator plugins to:
- Register validators by name
- Retrieve validators sorted by priority
- Support plugin architecture
- Enable/disable validators at runtime

## Objectives

1. Create `ValidatorRegistry` class
2. Support registration, retrieval, and removal
3. Auto-sort validators by priority
4. Validate validator interface compliance

## Implementation

### File to Create
`src/anatomy/validation/core/ValidatorRegistry.js`

### Key Methods
- `register(validator)` - Register validator instance
- `get(name)` - Get validator by name
- `getAll()` - Get all validators sorted by priority
- `has(name)` - Check if validator exists
- `unregister(name)` - Remove validator
- `clear()` - Remove all validators

## Testing
- Unit tests: `tests/unit/anatomy/validation/core/ValidatorRegistry.test.js`
- Test registration and retrieval
- Test priority sorting
- Test interface validation
- Test duplicate handling

## Acceptance Criteria
- [ ] Registry class created
- [ ] All CRUD operations implemented
- [ ] Priority-based sorting works correctly
- [ ] Interface validation enforced
- [ ] Unit tests achieve 100% coverage

## References
- **Recommendations:** Phase 3.3
