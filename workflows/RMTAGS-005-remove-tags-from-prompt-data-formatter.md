# RMTAGS-005: Remove Tags from Prompt Data Formatter

**Priority**: High  
**Phase**: 2 - Data Pipeline & Processing (Core Implementation)  
**Estimated Effort**: 2.5 hours  
**Risk Level**: Medium (Core prompt processing changes)  

## Overview

Remove tag processing and display logic from the prompt data formatter. This eliminates the `showTags` option and related logic that includes tags in prompts sent to LLMs, providing the primary token savings of 3-8 tokens per note.

## Problem Statement

The `promptDataFormatter.js` currently includes tags in formatted prompts by default (`showTags: true` on line 171) and processes tag data on line 255. This means every note with tags consumes 3-8 additional tokens in prompts sent to LLMs. The analysis shows this functionality provides no value while consuming significant tokens across conversations.

## Acceptance Criteria

- [ ] Remove `showTags` option and all related logic
- [ ] Eliminate tag processing from note formatting
- [ ] Remove tag display from all prompt formats
- [ ] Maintain all other note formatting functionality
- [ ] Achieve 3-8 token savings per note in prompts

## Technical Implementation

### Files to Modify

1. **`src/prompting/promptDataFormatter.js`**
   - Line 158: Remove showTags option definition
   - Line 171: Remove `showTags: true` default setting
   - Line 245: Remove showTags processing logic  
   - Line 255: Remove tag formatting logic `if (options.showTags && note.tags && note.tags.length > 0)`

### Implementation Steps

1. **Locate Tag Processing Logic**
   - Open `src/prompting/promptDataFormatter.js`
   - Identify all references to `showTags` option
   - Find tag formatting code around line 255
   - Map complete tag processing workflow

2. **Remove showTags Option**
   - Delete showTags from options configuration (line 158)
   - Remove `showTags: true` from default settings (line 171)
   - Clean up any option validation related to showTags

3. **Remove Tag Formatting Logic**
   - Delete the complete tag formatting block around line 255:
     ```javascript
     if (options.showTags && note.tags && note.tags.length > 0) {
       formatted += ` [${note.tags.join(', ')}]`;
     }
     ```
   - Ensure no orphaned variables or references remain
   - Verify note formatting continues normally without tag logic

4. **Clean Up Function Parameters**
   - Remove showTags from any function signatures
   - Update JSDoc comments to remove tag references
   - Ensure consistent parameter handling

5. **Validate Formatting Output**
   - Test formatted output excludes tag information
   - Confirm other note formatting remains intact
   - Verify prompt structure quality maintained

### Token Impact Analysis

**Expected Savings**:
- 3-8 tokens per note with tags in prompts
- Cumulative savings: 30-80 tokens for typical conversation with 10 notes
- System-wide impact: Estimated 1-3% token usage reduction

**Format Changes**:
- Notes will no longer include `[tag1, tag2, tag3]` suffixes
- Cleaner, more concise note display in prompts
- Focused on essential note content only

### Testing Requirements

#### Unit Tests
- [ ] Test note formatting without showTags option
- [ ] Verify options validation handles missing showTags
- [ ] Confirm formatted output excludes tag information
- [ ] Test edge cases with empty/null tag arrays

#### Integration Tests
- [ ] Test complete prompt formatting pipeline
- [ ] Validate formatted prompts sent to LLMs
- [ ] Confirm prompt quality and readability
- [ ] Test various note configurations

#### Regression Tests
- [ ] Ensure all other formatting options work correctly
- [ ] Verify note display options unaffected
- [ ] Test error handling for malformed data
- [ ] Validate performance with large note sets

## Dependencies

**Requires**:
- RMTAGS-001 (Component schema changes) - Foundation requirement
- RMTAGS-002 (LLM output schema changes) - Prevents validation conflicts
- RMTAGS-003 (Remove prompt instructions) - Coordinated removal

**Blocks**:
- RMTAGS-006 (AI prompt content provider changes)
- RMTAGS-014 (Unit test updates)

## Testing Validation

### Before Implementation
- Document current token usage for sample prompts
- Capture formatted output examples with tags
- Identify all showTags usage patterns

### After Implementation
- Measure token reduction for equivalent prompts
- Validate formatted output quality
- Confirm 3-8 token per-note savings achieved

### Test Commands
```bash
# Test prompt formatting functionality
npm run test:unit -- --testPathPattern="promptDataFormatter"

# Test integration with prompt processing
npm run test:integration -- --testPathPattern=".*prompt.*formatting"

# Validate token usage changes
npm run test:unit -- --testPathPattern=".*token.*"
```

## Success Metrics

- [ ] showTags option completely removed from codebase
- [ ] Tag formatting logic eliminated from prompt processing
- [ ] 3-8 token per-note reduction achieved
- [ ] All other note formatting functionality preserved
- [ ] No errors in prompt generation or processing
- [ ] Integration tests pass with updated formatting

## Implementation Notes

**Code Cleanup**: Ensure thorough removal of all showTags-related code, including:
- Option definitions and defaults
- Parameter passing through function calls
- JSDoc comments and type definitions
- Any conditional logic depending on showTags

**Output Quality**: Focus on maintaining clean, readable prompt formatting while removing tag clutter. The simplified format should improve prompt quality by focusing on essential note content.

**Performance**: This change should improve prompt processing performance slightly by removing conditional tag formatting logic and reducing overall prompt length.

## Rollback Procedure

1. **Git Revert**: Restore previous formatter version
2. **Tag Processing**: Confirm showTags functionality restored
3. **Integration Test**: Verify tag display in prompts working
4. **Token Usage**: Validate expected token usage increases

## Quality Assurance

**Code Review Checklist**:
- [ ] All showTags references removed
- [ ] No orphaned tag processing logic
- [ ] Function signatures updated appropriately
- [ ] JSDoc comments reflect changes
- [ ] Error handling remains robust

**Output Validation**:
- [ ] Formatted prompts exclude tag information
- [ ] Note formatting remains clear and readable
- [ ] No formatting artifacts from tag removal
- [ ] Prompt structure and quality maintained

This ticket represents a core implementation change that provides significant token savings while simplifying the prompt formatting pipeline. The removal should be comprehensive to prevent any tag data from appearing in prompts sent to LLMs.