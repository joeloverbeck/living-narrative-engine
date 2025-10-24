# LEGSTRREF-006: Extract Command Processing

## Metadata
- **Ticket ID**: LEGSTRREF-006
- **Phase**: 2 - Method Extraction
- **Priority**: Medium
- **Effort**: 0.5 days
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-004, LEGSTRREF-005
- **Blocks**: LEGSTRREF-007

## Problem Statement

Command processing logic for multi-target actions is embedded within the multi-target formatting method. Extracting it improves testability and clarity.

## Implementation

Already extracted as `#processCommandData` in LEGSTRREF-005. This ticket ensures comprehensive testing and documentation.

### Additional Test Coverage

Add edge case tests:
- String command data
- Object command data with target
- Object command data without target
- Target resolution failures
- Normalization errors
- Various target specifications

## Acceptance Criteria

- ✅ `#processCommandData` fully tested
- ✅ Coverage >95%
- ✅ All edge cases covered
- ✅ Documentation complete

## Files Affected

### Modified Files
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.multiTarget.test.js` (add tests)

## Related Tickets
- **Depends on**: LEGSTRREF-004, LEGSTRREF-005
- **Blocks**: LEGSTRREF-007
- **Part of**: Phase 2 - Method Extraction
