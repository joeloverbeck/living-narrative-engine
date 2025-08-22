# RMTAGS-003: Remove Tag Instructions from Core Prompts

**Priority**: High  
**Phase**: 1 - Schema & LLM Integration (Foundation)  
**Estimated Effort**: 2 hours  
**Risk Level**: Low-Medium (Prompt modification)  

## Overview

Remove tag generation instructions and examples from the core prompt text. This eliminates the ~50-75 tokens per prompt spent instructing LLMs to generate tags that provide no functional value.

## Problem Statement

The `finalLlmInstructionText` in `data/prompts/corePromptText.json` (line 5) contains explicit instructions for LLMs to generate tags with detailed examples. This consumes approximately 200+ characters of prompt space and ~50-75 tokens per prompt, instructing LLMs to generate data that is subsequently ignored.

Current prompt includes:
- Instructions to "Use tags for categorization"
- Detailed examples showing tag usage (e.g., "combat", "relationship", "location")
- Complete example format with tags array
- Three examples demonstrating tag generation patterns

## Acceptance Criteria

- [ ] Remove all tag-related instructions from `finalLlmInstructionText`
- [ ] Remove tag examples and format demonstrations
- [ ] Maintain clear note formatting instructions for remaining fields
- [ ] Preserve overall prompt quality and coherence
- [ ] Achieve estimated 50-75 token reduction per prompt

## Technical Implementation

### Files to Modify

1. **`data/prompts/corePromptText.json`** (line 5: `finalLlmInstructionText`)
   - Remove tag instruction content:
     ```
     - Use tags for categorization (e.g., "combat", "relationship", "location")
     - Example format:
       {
         "text": "Seems nervous about the council meeting",
         "subject": "John", 
         "subjectType": "character",
         "context": "tavern conversation",
         "tags": ["emotion", "politics"]
       }
     ```

### Implementation Steps

1. **Locate Core Prompt Text**
   - Open `data/prompts/corePromptText.json`
   - Find `finalLlmInstructionText` field (line 5)
   - Identify all tag-related instruction content

2. **Remove Tag Instructions**
   - Delete "Use tags for categorization" instruction line
   - Remove tag examples from all note format examples
   - Remove tag-specific explanation text
   - Clean up any orphaned example formatting

3. **Update Example Formats**
   - Modify existing note examples to exclude tags field
   - Ensure remaining examples show proper format for:
     - `text` (required)
     - `subject` (required) 
     - `subjectType` (required)
     - `context` (optional)
   - Maintain clear formatting and readability

4. **Validate Prompt Quality**
   - Ensure instruction flow remains logical
   - Verify JSON examples are valid without tags
   - Confirm overall prompt coherence

### Prompt Impact Analysis

**Token Savings**:
- Estimated 50-75 tokens per prompt reduction
- Approximately 200+ character reduction in prompt text
- Cumulative savings across all LLM interactions

**Content Preserved**:
- Core note formatting instructions
- Required field specifications (`text`, `subject`, `subjectType`)
- Optional field guidance (`context`)
- JSON structure examples

**Content Removed**:
- Tag categorization instructions
- Tag example lists
- Tag field in example JSON objects
- Tag-related explanatory text

### Testing Requirements

#### Unit Tests
- [ ] Validate prompt JSON structure remains valid
- [ ] Confirm prompt loading and parsing successful
- [ ] Verify example JSON objects are valid without tags

#### Integration Tests
- [ ] Test LLM instruction processing with updated prompts
- [ ] Validate note generation follows updated format
- [ ] Confirm LLM responses exclude tag attempts

#### Prompt Quality Tests
- [ ] Manual review of prompt clarity and coherence
- [ ] Validate instruction completeness without tags
- [ ] Test LLM understanding of updated format requirements

## Dependencies

**Requires**:
- RMTAGS-002 (Remove tags from LLM output schemas) - Should be completed first to avoid validation conflicts

**Blocks**:
- RMTAGS-005 (Remove tags from prompt data formatter)
- Phase 2 implementation tickets

## Token Usage Validation

### Before Implementation
- Measure baseline token usage for typical prompts
- Document current prompt character count
- Identify specific tag-related content sections

### After Implementation  
- Measure post-removal token usage
- Validate 50-75 token reduction achieved
- Confirm prompt quality maintained

### Measurement Commands
```bash
# Test prompt loading and token estimation
npm run test:unit -- --testPathPattern=".*prompt.*"

# Validate prompt parsing and structure  
npm run test:integration -- --testPathPattern=".*prompt.*processing"
```

## Success Metrics

- [ ] Prompt JSON remains syntactically valid
- [ ] Estimated 50-75 token reduction per prompt achieved
- [ ] LLM instruction quality maintained without tags
- [ ] Note formatting examples clear and complete
- [ ] No references to tags in prompt content
- [ ] Integration tests pass with updated prompts

## Implementation Notes

**Prompt Clarity**: Focus on maintaining clear, actionable instructions for LLMs while removing all tag-related content. The remaining instruction should be sufficient for LLMs to generate well-formatted notes.

**Example Quality**: Ensure remaining JSON examples are realistic and demonstrate the expected note structure without confusion about missing fields.

**Content Flow**: Maintain logical flow in prompt instructions, ensuring the removal of tag content doesn't create awkward gaps or unclear transitions.

## Rollback Procedure

1. **Git Revert**: Restore previous prompt version
2. **Prompt Validation**: Confirm tag instructions restored
3. **Integration Test**: Verify LLM responses include tags again

## Quality Assurance

**Manual Review Checklist**:
- [ ] Prompt reads naturally without tag content
- [ ] JSON examples are complete and valid
- [ ] Instruction clarity maintained
- [ ] No orphaned references to tags
- [ ] Overall prompt length appropriately reduced

**Automated Testing**:
- [ ] JSON structure validation passes
- [ ] Prompt loading tests successful  
- [ ] LLM integration tests with updated prompts pass