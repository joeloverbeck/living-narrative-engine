# LLMROLPROARCANA-003: Consolidate Action Tag Rules to Single Authoritative Section

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 1.2, Section 3.1, Phase 1, Task 3
**Priority:** HIGH ⭐⭐⭐⭐
**Estimated Effort:** Low (2-4 hours)
**Impact:** 20% clearer rule hierarchy, 57% token reduction in action tag section
**Phase:** 1 - Critical Fixes (Week 1)

## Problem Statement

Action tag rules are currently repeated across 3+ locations in the prompt, creating redundancy and potential conflicts:

**Current Repetition:**
1. `portrayal_guidelines` section (lines 1-15)
2. `final_instructions` section (lines 1-50)
3. Implicit in notes section formatting
4. DIALOGUE FORMATTING sub-section

This repetition:
- Wastes ~300-500 tokens
- Creates potential for instruction conflicts
- Suggests historical confusion (progressive emphasis escalation)
- Makes maintenance difficult (must update multiple locations)

**Evidence of Complexity:**
The rule has 5+ sub-rules scattered across sections:
1. Only visible actions in asterisks
2. No internal thoughts in asterisks
3. Third-person present tense
4. No asterisks in dialogue
5. No emphasis asterisks in speech

## Objective

Consolidate all action tag rules into a single, authoritative `system_constraints > output_format > action_tags` section with clear formatting and examples.

## Acceptance Criteria

- [ ] All action tag rules consolidated into ONE section
- [ ] Section appears in `system_constraints` (within first 1,000 tokens)
- [ ] All repetitions removed from other sections
- [ ] Clear format with ✅ good vs ❌ bad examples
- [ ] Token reduction of ~300 tokens (57% of action tag content)
- [ ] Cross-references updated to point to canonical section
- [ ] All tests pass with consolidated rules

## Technical Implementation

### Files to Modify

1. **`src/prompting/templates/characterPromptTemplate.js`**
   - Create `buildActionTagRules()` method
   - Call only from `buildOutputFormat()` within `buildSystemConstraints()`
   - Remove action tag content from other builder methods

2. **`data/prompts/corePromptText.json`**
   - Create single `actionTagRules` section
   - Remove duplicated content from portrayal, final_instructions
   - Add cross-references if needed

### Proposed Consolidated Section

```xml
<system_constraints>
  <output_format>
    <action_tags>
      ## ACTION TAGS (CRITICAL)

      **Rule**: Use *asterisks* ONLY for visible physical actions
      **Format**: Third-person present tense

      **Valid Examples:**
        ✅ *crosses arms*
        ✅ *narrows eyes*
        ✅ *takes a step back*
        ✅ *smooths tail fur*

      **Invalid Examples:**
        ❌ *feels anxious* (internal state - not visible)
        ❌ *thinks about leaving* (mental action - not visible)
        ❌ *notices the door* (observation - not physical)
        ❌ *decided to stay* (past tense - must be present)

      ## DIALOGUE FORMATTING

      **Rule**: Plain quoted text ONLY - no asterisks inside speech

      **Valid Examples:**
        ✅ "You don't understand."
        ✅ "Oh meow-y goodness, this is fascinating~"
        ✅ *sighs* "I'm tired." (action before dialogue - separate)

      **Invalid Examples:**
        ❌ "You don't *understand*." (no emphasis asterisks)
        ❌ "*sighs* I'm tired." (no action tags inside quotes)
        ❌ "I'm *so* frustrated." (no emphasis asterisks)
    </action_tags>

    <thought_vs_speech>
      <!-- Separate section for thought/speech distinction -->
    </thought_vs_speech>
  </output_format>
</system_constraints>
```

### Code Implementation

```javascript
// src/prompting/templates/characterPromptTemplate.js

class CharacterPromptTemplate {
  buildSystemConstraints(data) {
    return `<system_constraints>
      ${this.buildOutputFormat()}
      ${this.buildAntiRepetition(data.recentThoughts)}
      ${this.buildNoteSystem()}
    </system_constraints>`;
  }

  buildOutputFormat() {
    return `<output_format>
      ${this.buildActionTagRules()}
      ${this.buildThoughtVsSpeechRules()}
    </output_format>`;
  }

  buildActionTagRules() {
    // Read from corePromptText.json - single source of truth
    return this.promptText.actionTagRules;
  }

  // Remove buildPortrayalGuidelines() or strip action tag content
  // Remove buildFinalInstructions() or strip action tag content
}
```

### Content Migration

**Remove from `portrayal_guidelines`:**
```
Action Tag Rules (CRITICAL):
- Wrap only visible, externally observable actions in single asterisks
- No internal thoughts, emotions, private reasoning
- Use third-person present tense
[... all action tag content ...]
```

**Remove from `final_instructions`:**
```
CRITICAL DISTINCTION - THOUGHTS vs SPEECH vs ACTIONS:
*asterisks*: Only VISIBLE ACTIONS...
[... all action tag content ...]
```

**Keep in `system_constraints > output_format` ONLY**

## Testing Requirements

### Unit Tests
- [ ] Test `buildActionTagRules()` returns correct content
- [ ] Test `buildOutputFormat()` includes action tags only once
- [ ] Test other sections (portrayal, final_instructions) don't contain action tag rules

### Integration Tests
- [ ] Test full prompt assembly contains action tag section exactly once
- [ ] Test action tag section appears in first 1,000 tokens
- [ ] Verify section appears before character persona

### E2E Tests
- [ ] Test LLM follows action tag rules correctly
- [ ] Verify action tag compliance rate (target: >95%)
- [ ] Compare compliance: before (scattered) vs after (consolidated)

### Validation Script
```javascript
// Test that action tag rules appear exactly once in prompt
function validateActionTagConsolidation(assembledPrompt) {
  const actionTagMarkers = [
    '*asterisks*',
    'visible physical actions',
    'DIALOGUE FORMATTING'
  ];

  const occurrences = actionTagMarkers.map(marker =>
    (assembledPrompt.match(new RegExp(marker, 'g')) || []).length
  );

  // Each marker should appear exactly once
  assert(occurrences.every(count => count === 1),
    'Action tag rules must appear exactly once in prompt');
}
```

## Dependencies

- **Blocks:** None
- **Blocked By:** LLMROLPROARCANA-001 (Restructure Information Hierarchy) - should be done first for proper section placement
- **Related:**
  - LLMROLPROARCANA-001 (Restructure Information Hierarchy)
  - LLMROLPROARCANA-004 (Remove Redundant Instructions)

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Action tag rule occurrences | 3+ locations | 1 location | Grep/search in prompt |
| Action tag token count | ~500 tokens | ~150 tokens | Section measurement |
| Token reduction | 0 | ~300 tokens | Before/after diff |
| Output format compliance | Unknown | >95% | Automated validation |
| Rule clarity score | Unknown | >8/10 | Human evaluation |

## Rollback Plan

If LLM compliance degrades:
1. Identify which specific examples/rules are missing
2. Enhance single consolidated section (don't re-duplicate)
3. Add clarifying examples within single section only

## Implementation Notes

- **Single Source of Truth Pattern**: Define each rule ONCE in dedicated section
- **Strategic Placement**: Rules must appear early (within first 1,000 tokens)
- **Clear Formatting**: Use consistent ✅/❌ pattern for good vs bad examples
- **Progressive Enhancement**: Start with core rule, add examples as needed

### Why Repetition Occurred (Historical Analysis)

Report section 3.1 suggests progressive emphasis escalation due to frequent historical violations. The rule is actually complex with multiple sub-rules, leading to:
1. Initial statement in guidelines
2. Reinforcement in final instructions (after violations observed)
3. Additional emphasis (CRITICAL, bold, caps) after more violations
4. DIALOGUE sub-section after dialogue-specific violations

**Solution**: Comprehensive single section with ALL sub-rules and examples upfront, positioned early for maximum attention.

## References

- Report Section 1.2: "Instruction Redundancy"
- Report Section 3.1: "Action Tag Rules"
- Report Section 7.1: "Recommendation 3 - Consolidate Redundant Instructions"
- Report Appendix A: "Before vs After: Action Tag Rules"
