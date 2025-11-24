# LLMROLPROARCANA-004: Remove Redundant Instructions Across Template Sections

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 1.2, Section 5.3, Phase 1, Task 4
**Priority:** HIGH ⭐⭐⭐⭐
**Estimated Effort:** Low (4-6 hours)
**Impact:** 10% total prompt token reduction (800+ tokens saved)
**Phase:** 1 - Critical Fixes (Week 1)

## Problem Statement

The prompt template contains ~850 tokens of pure redundancy where the same rules and instructions are repeated across multiple sections:

**Identified Redundancies:**

1. **Action Tag Rules** (~300 tokens wasted)
   - Appears in: portrayal_guidelines, final_instructions, implicit in notes
   - Status: Being addressed in LLMROLPROARCANA-003

2. **Anti-Repetition Statements** (~150 tokens wasted)
   - "Do not repeat thoughts" appears in:
     - thoughts section header
     - INNER VOICE GUIDANCE
     - final_instructions reminder

3. **Subject Type Distinctions** (~200 tokens wasted)
   - Multiple "CRITICAL DISTINCTIONS" sections for note types
   - Redundant examples across different sections

4. **Speech Pattern Examples** (~200 tokens wasted)
   - Some speech pattern examples overlap in concept
   - Similar patterns described differently in multiple places

**Total Redundancy:** ~850 tokens (10% of current ~8,200 token prompt)

## Objective

Eliminate all identified redundancies by implementing a "single source of truth" pattern where each rule, instruction, or guideline is defined EXACTLY ONCE in the most appropriate section.

## Acceptance Criteria

- [ ] Anti-repetition rule stated in ONE location only
- [ ] Subject type distinctions consolidated (will be simplified in LLMROLPROARCANA-002)
- [ ] Speech pattern examples deduplicated and consolidated
- [ ] Cross-reference system implemented for referencing rules
- [ ] Token reduction of 500-800 tokens achieved (excluding action tag consolidation)
- [ ] All tests pass with deduplicated template
- [ ] Documentation updated to reflect single source of truth locations

## Technical Implementation

### Files to Modify

1. **`src/prompting/templates/characterPromptTemplate.js`**
   - Remove duplicate rule generation methods
   - Implement cross-reference builder
   - Add rule ID system for references

2. **`data/prompts/corePromptText.json`**
   - Consolidate all rule text
   - Remove duplicated content
   - Add rule IDs for cross-referencing

### Anti-Repetition Consolidation

**Current (scattered across 3 locations):**
```xml
<thoughts>
Recent thoughts (avoid repeating or barely rephrasing these):
...
</thoughts>

<!-- Later in prompt -->
<INNER_VOICE_GUIDANCE>
Your thoughts must be fresh and unique - do not repeat or barely rephrase...
</INNER_VOICE_GUIDANCE>

<!-- Even later -->
<final_instructions>
Remember: Generate fresh thoughts, don't repeat previous ones...
</final_instructions>
```

**Proposed (single authoritative location):**
```xml
<system_constraints>
  <anti_repetition id="rule_anti_rep_thoughts">
    Your thoughts must build on previous mental state with NEW insights.

    Recent thoughts (DO NOT repeat or rephrase):
    {recent_thoughts}

    Generate fresh perspective that:
    - Adds new dimension to situation
    - Changes analytical angle
    - Reflects immediate pre-action reasoning
    - Does NOT assume action outcomes

    **Bad**: Reworded version of previous thought
    **Good**: New insight building on previous understanding
  </anti_repetition>
</system_constraints>

<!-- Later sections can reference if needed -->
<thoughts>
  <!-- See system_constraints > anti_repetition (rule_anti_rep_thoughts) -->
  Generate thought here...
</thoughts>
```

### Subject Type Distinctions Consolidation

**Current (multiple CRITICAL DISTINCTIONS sections):**
```
CRITICAL DISTINCTIONS:
- event vs plan: event is past, plan is future
... [in one section]

CRITICAL DISTINCTIONS:
- emotion vs psychological_state: emotion is simple, psychological is complex
... [in another section]

CRITICAL DISTINCTIONS:
- theory vs observation: theory is hypothesis, observation is fact
... [in yet another section]
```

**Proposed (single location, to be further simplified in LLMROLPROARCANA-002):**
```xml
<system_constraints>
  <note_system id="rule_note_types">
    Subject Types (choose ONE):
    1. entity - People, places, things (who/what/where)
    2. event - Past occurrences (already happened)
    3. plan - Future intentions (not yet executed)
    4. knowledge - Information, theories, observations
    5. state - Mental/emotional/psychological conditions
    6. other - Fallback for unclear cases

    <!-- NO separate CRITICAL DISTINCTIONS sections -->
  </note_system>
</system_constraints>
```

### Speech Pattern Deduplication

Analyze 17 current examples, identify overlapping concepts:

**Overlapping Patterns to Merge:**
1. "Cat-sounds increase when manipulating" + "Cat-sounds increase exponentially" → Single pattern with intensity variation
2. "Compulsive narrativization" + "Referring to people in narrative terms" → Single "narrativization bleeding" pattern
3. "Abrupt tonal shifts" + "Deflecting genuine compliments" → Single "deflection and tonal shift" pattern

**Result:** 17 examples → 6 core patterns (see LLMROLPROARCANA-005 for detailed speech pattern compression)

### Cross-Reference System

For cases where a rule needs to be mentioned in multiple contexts:

```javascript
class PromptTemplateBuilder {
  buildCrossReference(ruleId, brief = false) {
    const rules = {
      'rule_anti_rep_thoughts': {
        full: '<!-- Full rule content here -->',
        brief: '(See system_constraints > anti_repetition)',
        location: 'system_constraints > anti_repetition'
      },
      'rule_action_tags': {
        full: '<!-- Full action tag rules -->',
        brief: '(See system_constraints > output_format > action_tags)',
        location: 'system_constraints > output_format > action_tags'
      }
    };

    return brief ? rules[ruleId].brief : rules[ruleId].full;
  }
}
```

## Testing Requirements

### Redundancy Detection Tests
```javascript
// Test for redundant content in assembled prompt
describe('Prompt Redundancy Tests', () => {
  it('should not repeat anti-repetition rule', () => {
    const prompt = assemblePrompt();
    const antiRepMarker = 'do not repeat or barely rephrase';
    const occurrences = (prompt.match(new RegExp(antiRepMarker, 'gi')) || []).length;
    expect(occurrences).toBe(1); // Should appear exactly once
  });

  it('should not repeat action tag rules', () => {
    const prompt = assemblePrompt();
    const actionTagMarker = 'visible physical actions';
    const occurrences = (prompt.match(new RegExp(actionTagMarker, 'gi')) || []).length;
    expect(occurrences).toBeLessThanOrEqual(1);
  });

  it('should consolidate CRITICAL DISTINCTIONS sections', () => {
    const prompt = assemblePrompt();
    const criticalMarker = 'CRITICAL DISTINCTIONS';
    const occurrences = (prompt.match(new RegExp(criticalMarker, 'g')) || []).length;
    expect(occurrences).toBe(0); // Should be eliminated entirely
  });
});
```

### Unit Tests
- [ ] Test each rule appears exactly once in assembled prompt
- [ ] Test cross-reference builder generates correct references
- [ ] Test rule ID system works correctly

### Integration Tests
- [ ] Test full prompt assembly with deduplicated content
- [ ] Verify token count reduction matches target
- [ ] Test that LLM comprehension is maintained or improved

### E2E Tests
- [ ] Run existing roleplay tests
- [ ] Verify output quality is maintained
- [ ] Test that rules are still followed correctly

## Dependencies

- **Blocks:** None
- **Blocked By:**
  - LLMROLPROARCANA-003 (Consolidate Action Tag Rules) - handles one major redundancy
- **Related:**
  - LLMROLPROARCANA-002 (Simplify Note Taxonomy) - will reduce subject type distinctions
  - LLMROLPROARCANA-005 (Compress Speech Patterns) - handles speech pattern overlap

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Total redundancy tokens | ~850 tokens | <100 tokens | Before/after comparison |
| Anti-repetition occurrences | 3 locations | 1 location | Grep/search validation |
| CRITICAL DISTINCTIONS sections | 3+ sections | 0 sections | Section count |
| Duplicate instruction rate | ~10% | <3% | Automated analysis |
| Prompt clarity score | Unknown | >8/10 | Human evaluation |

## Rollback Plan

If LLM comprehension degrades:
1. Identify which specific rule/instruction is unclear
2. Enhance single authoritative section (don't re-duplicate)
3. Add clarifying examples in single location only
4. Use cross-references if rule needs context in multiple places

## Implementation Notes

### Single Source of Truth Pattern

**Principle:** Each rule, instruction, or guideline should be defined ONCE in the most appropriate section.

**Hierarchy:**
1. Define rule in canonical location (usually system_constraints)
2. Assign unique rule ID for referencing
3. Other sections can reference by ID if needed
4. NEVER duplicate full rule text

### Cross-Reference Strategy

**When to use:**
- Rule needs contextual mention in multiple places
- Brief reminder is helpful but full rule would be redundant
- Maintaining logical flow requires reference to earlier rule

**How to implement:**
```xml
<section_a>
  <rule id="rule_unique_id">
    [Full rule definition]
  </rule>
</section_a>

<section_b>
  <!-- Reference to rule_unique_id -->
  [Context-specific mention, not full repetition]
</section_b>
```

### Token Accounting

Track token savings by category:
- Action tag consolidation: ~300 tokens (handled in LLMROLPROARCANA-003)
- Anti-repetition consolidation: ~150 tokens
- Subject type distinctions: ~200 tokens (enhanced by LLMROLPROARCANA-002)
- Speech pattern overlap: ~200 tokens (handled in LLMROLPROARCANA-005)

**Total Expected Savings:** 500-800 tokens (not counting overlaps with other tickets)

## References

- Report Section 1.2: "Instruction Redundancy"
- Report Section 5.3: "Redundancy Analysis"
- Report Section 7.1: "Recommendation 3 - Consolidate Redundant Instructions"
