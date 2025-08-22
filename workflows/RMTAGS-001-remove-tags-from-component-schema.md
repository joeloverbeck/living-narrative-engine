# RMTAGS-001: Remove Tags from Core Component Schema

**Priority**: High  
**Phase**: 1 - Schema & LLM Integration (Foundation)  
**Estimated Effort**: 2 hours  
**Risk Level**: Medium (Schema breaking change)  

## Overview

Remove the `tags` property from the notes component schema definition. This is a foundational change that eliminates the schema validation for tags and creates a breaking change that requires version management.

## Problem Statement

The `tags` field in `data/mods/core/components/notes.component.json` (lines 48-51) is currently defined as an optional array of strings that provides categorization metadata. However, the analysis shows that tags consume tokens without providing functional value and are unused in any meaningful search or filtering operations.

## Acceptance Criteria

- [ ] Remove `tags` property definition from notes component schema
- [ ] Ensure schema validation no longer accepts tags field  
- [ ] Verify existing save data with tags still loads gracefully (tags ignored)
- [ ] Confirm component validation tests pass
- [ ] No functional gameplay impact

## Technical Implementation

### Files to Modify

1. **`data/mods/core/components/notes.component.json`** (lines 48-51)
   - Remove the entire tags property definition:
   ```json
   "tags": {
     "type": "array", 
     "items": { "type": "string" },
     "description": "Additional categorization tags (optional)."
   }
   ```

### Implementation Steps

1. **Locate Schema Definition**
   - Open `data/mods/core/components/notes.component.json`
   - Identify lines 48-51 containing tags property

2. **Remove Tags Property**
   - Delete the complete tags property definition
   - Ensure valid JSON structure after removal
   - Verify no trailing comma issues

3. **Validate Schema Structure** 
   - Confirm required fields array still contains only: `["text", "subject", "subjectType"]`
   - Verify overall schema remains valid JSON
   - Check that component ID and description unchanged

### Breaking Change Considerations

**Impact**: This creates a schema breaking change where:
- New game engine will not validate tags in notes
- Existing saves with tagged notes will load gracefully (tags retained in save data but ignored)
- LLM responses may still attempt to include tags but will be ignored by validation

**Migration Strategy**: 
- No data migration required - removal is additive in terms of functionality
- Games remain fully playable regardless of tagged note data

### Testing Requirements

#### Unit Tests
- [ ] Verify AJV schema validation rejects notes with tags field
- [ ] Confirm notes without tags validate successfully  
- [ ] Test component loading with modified schema

#### Integration Tests
- [ ] Load saved game data containing tagged notes
- [ ] Verify notes data processing ignores tag fields
- [ ] Confirm gameplay continues normally with existing saves

#### Validation Tests
- [ ] Schema validation properly rejects tags
- [ ] Component registration succeeds with updated schema
- [ ] Error messages clear when tags validation fails

## Dependencies

**Blocks**: 
- RMTAGS-002 (Remove tags from LLM output schemas)
- RMTAGS-003 (Remove tag instructions from core prompts)

**Requires**: None - This is a foundational change

## Rollback Procedure

1. **Git Revert**: Use git revert to restore previous schema version
2. **Schema Validation**: Confirm tags field validation restored  
3. **Testing**: Verify tagged notes validate properly again

## Testing Validation

Before marking complete:

1. **Schema Validation Test**:
   ```bash
   # Test that notes with tags are rejected
   npm run test:unit -- --testPathPattern="components.*schema"
   ```

2. **Integration Test**:
   ```bash
   # Test save game compatibility  
   npm run test:integration -- --testPathPattern=".*save.*"
   ```

3. **Component Loading Test**:
   ```bash
   # Test component registration
   npm run test:unit -- --testPathPattern=".*componentLoader"
   ```

## Success Metrics

- [ ] Schema validation rejects notes containing tags field
- [ ] All existing tests pass (except those explicitly testing tags)
- [ ] Saved games with tagged notes load without errors
- [ ] Component loading and registration successful
- [ ] No console errors or warnings related to schema changes

## Notes

This ticket represents the first step in the three-phase removal strategy. It establishes the foundation by preventing new tag data from being validated while maintaining backward compatibility with existing save data.

The breaking change is intentional and necessary - it prevents the continued creation of unused tag data while not disrupting existing gameplay for users with saved games containing tags.