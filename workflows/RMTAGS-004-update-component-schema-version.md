# RMTAGS-004: Update Component Schema Version

**Priority**: Medium  
**Phase**: 1 - Schema & LLM Integration (Foundation)  
**Estimated Effort**: 1 hour  
**Risk Level**: Low (Version management)

## Overview

Update the component schema version to reflect the breaking change from removing tags. This ensures proper version tracking and helps identify when the schema change occurred for debugging and rollback purposes.

## Problem Statement

The removal of the `tags` field from the notes component schema (RMTAGS-001) represents a breaking change that should be reflected in the schema version. This helps with:

- Change tracking and debugging
- Rollback identification
- Version compatibility checks
- Development team awareness

## Acceptance Criteria

- [ ] Increment component schema version appropriately
- [ ] Update any version-related metadata or documentation
- [ ] Ensure version change doesn't break existing functionality
- [ ] Document the version change reason in commit message
- [ ] Validate schema loading works with new version

## Technical Implementation

### Files to Modify

1. **`data/mods/core/components/notes.component.json`**
   - Update version field (if exists)
   - Add version field if not present
   - Document the breaking change reason

### Implementation Steps

1. **Identify Current Versioning**
   - Check if component schema has version field
   - Review versioning pattern in other component schemas
   - Determine appropriate version increment (major.minor.patch)

2. **Update Version Number**
   - If using semantic versioning: increment major version for breaking change
   - If using simple versioning: increment appropriately
   - Follow established project versioning conventions

3. **Add Version Metadata (if applicable)**
   - Include change description in schema
   - Add timestamp or date if part of schema structure
   - Document breaking change nature

4. **Validate Version Integration**
   - Ensure version loading and parsing works
   - Confirm schema validation includes version
   - Test component registration with new version

### Version Change Strategy

**Breaking Change Guidelines**:

- Major version increment recommended (e.g., 1.0.0 → 2.0.0)
- Indicates incompatible API/schema changes
- Alerts developers to significant modifications

**Documentation Requirements**:

- Clear commit message explaining version bump
- Link to RMTAGS ticket series
- Note the breaking change nature

### Testing Requirements

#### Unit Tests

- [ ] Verify schema loading with updated version
- [ ] Confirm version validation (if implemented)
- [ ] Test component registration success

#### Integration Tests

- [ ] Load existing saves with new schema version
- [ ] Validate backward compatibility handling
- [ ] Test component system functionality

#### Version Validation

- [ ] Schema parsing successful with new version
- [ ] No errors from version change
- [ ] Existing functionality unaffected

## Dependencies

**Requires**:

- RMTAGS-001 (Remove tags from component schema) - Must be completed first

**Blocks**: None - This is supplementary to main removal work

## Implementation Notes

**Version Strategy**: Follow the project's established versioning conventions. If no clear pattern exists, use semantic versioning principles with major version increment for breaking changes.

**Minimal Impact**: This change should be purely informational and not affect system functionality - only metadata for tracking purposes.

**Documentation**: The version change serves as a marker for when tags were removed, helping with future debugging and development.

### Sample Implementation

If versioning is used:

```json
{
  "version": "2.0.0",
  "lastModified": "2025-01-27",
  "changeLog": "Removed tags field - breaking change",
  "id": "core:notes",
  ...
}
```

## Success Metrics

- [ ] Schema version properly incremented
- [ ] Schema loading and validation successful
- [ ] Component registration works normally
- [ ] No functionality broken by version change
- [ ] Clear documentation of version change reason

## Rollback Procedure

1. **Git Revert**: Restore previous version number
2. **Validation**: Confirm original version loads properly
3. **Testing**: Verify functionality restored

## Quality Assurance

**Version Validation**:

- [ ] Version number follows project conventions
- [ ] Version increment appropriate for breaking change
- [ ] No side effects from version change
- [ ] Schema structure remains valid

**Testing Validation**:

```bash
# Test schema loading and validation
npm run test:unit -- --testPathPattern=".*schema.*"

# Test component registration
npm run test:integration -- --testPathPattern=".*component.*"
```

## Coordination Notes

This ticket can be completed immediately after RMTAGS-001 or bundled with it as part of the same change. The version update is supplementary to the main schema modification and doesn't affect the removal functionality.

The version change serves primarily as documentation and tracking for the development team, helping identify when the breaking change occurred and facilitating future debugging or rollback scenarios if needed.
