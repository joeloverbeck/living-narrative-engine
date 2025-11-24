# LLMROLPROARCANA-001: Restructure Information Hierarchy to Constraint-First Architecture

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 9, Phase 1, Task 1
**Priority:** CRITICAL ⭐⭐⭐⭐⭐
**Estimated Effort:** Medium (8-16 hours)
**Impact:** 40% improvement in constraint adherence
**Phase:** 1 - Critical Fixes (Week 1)

## Problem Statement

The current prompt architecture places critical constraints LAST (in `final_instructions`), after 6,000+ tokens of context. This creates attention decay issues where LLMs may lose focus on critical formatting and behavior rules.

**Current Order:**
1. task_definition (200 tokens)
2. character_persona (4,000+ tokens)
3. portrayal_guidelines (600 tokens)
4. world_context (1,500 tokens)
5. perception_log (800 tokens)
6. thoughts (200 tokens)
7. notes (1,200 tokens)
8. goals (150 tokens)
9. available_actions_info (800 tokens)
10. final_instructions (1,500 tokens) ← **CONSTRAINTS HERE**
11. content_policy (200 tokens)

## Objective

Restructure the prompt template to place critical constraints FIRST, before extensive character and world context, following the constraint-first architecture pattern.

**Target Order:**
1. System Constraints (output format, anti-repetition, note system)
2. Character Identity (compressed persona)
3. World State (location, entities, perception)
4. Execution Context (available actions, recent state)
5. Task Prompt (final execution instruction)

## Acceptance Criteria

- [ ] All critical formatting rules appear in first 1,000 tokens
- [ ] `system_constraints` section created with nested subsections
- [ ] `output_format`, `anti_repetition`, `note_system` consolidated
- [ ] Character persona moved to after constraints
- [ ] World context and execution context properly ordered
- [ ] All existing E2E tests pass with restructured template
- [ ] Template version updated to 2.0

## Technical Implementation

### Files to Modify

1. **`src/prompting/templates/characterPromptTemplate.js`**
   - Refactor `assemble()` method to use new section order
   - Create `buildSystemConstraints()` method
   - Consolidate constraint-building logic

2. **`data/prompts/corePromptText.json`**
   - Restructure JSON to reflect new section hierarchy
   - Move constraint text to dedicated sections

### Proposed Structure

```xml
<system_constraints>
  <output_format>
    <action_tags>...</action_tags>
    <thought_vs_speech>...</thought_vs_speech>
  </output_format>

  <anti_repetition>
    <!-- Recent thoughts mechanism -->
  </anti_repetition>

  <note_system>
    <!-- Note-taking rules (simplified in LLMROLPROARCANA-002) -->
  </note_system>
</system_constraints>

<character_data>
  <core_identity>...</core_identity>
  <speech_patterns>...</speech_patterns>
  <current_goals>...</current_goals>
</character_data>

<world_state>
  <current_location>...</current_location>
  <entities_present>...</entities_present>
  <perception_log>...</perception_log>
</world_state>

<execution_context>
  <available_actions>...</available_actions>
  <recent_state>...</recent_state>
</execution_context>

<task_prompt>
  <!-- Final execution instruction -->
</task_prompt>
```

### Code Example

```javascript
// src/prompting/templates/characterPromptTemplate.js
class CharacterPromptTemplate {
  assemble(data) {
    return [
      // PHASE 1: System Constraints (constraint-first)
      this.buildSystemConstraints(data),

      // PHASE 2: Character Identity
      this.buildCharacterIdentity(data.character),

      // PHASE 3: World State
      this.buildWorldState(data.world, data.perception),

      // PHASE 4: Execution Context
      this.buildExecutionContext(data.actions, data.recentState),

      // PHASE 5: Task Prompt
      this.buildTaskPrompt()
    ].join('\n\n');
  }

  buildSystemConstraints(data) {
    return `<system_constraints>
      ${this.buildOutputFormat()}
      ${this.buildAntiRepetition(data.recentThoughts)}
      ${this.buildNoteSystem()}
    </system_constraints>`;
  }

  buildOutputFormat() {
    // Action tags, thought/speech distinction
  }

  buildAntiRepetition(recentThoughts) {
    // Recent thoughts mechanism
  }

  buildNoteSystem() {
    // Note-taking rules (to be simplified)
  }
}
```

## Testing Requirements

### Unit Tests
- [ ] Test `buildSystemConstraints()` method returns correct structure
- [ ] Test section ordering is preserved
- [ ] Test each subsection builder (output_format, anti_repetition, note_system)

### Integration Tests
- [ ] Test full prompt assembly with new structure
- [ ] Verify all data flows correctly through new architecture
- [ ] Test backward compatibility (if maintaining v1.0)

### E2E Tests
- [ ] Run existing roleplay E2E tests
- [ ] Verify LLM output format compliance improves
- [ ] Measure constraint adherence rate (target: >95%)

## Dependencies

- **Blocks:** None
- **Blocked By:** None
- **Related:**
  - LLMROLPROARCANA-002 (Simplify Note Taxonomy)
  - LLMROLPROARCANA-003 (Consolidate Action Tag Rules)

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Constraint appearance position | Token 6,000+ | Token 0-1,000 | Template analysis |
| Output format compliance | Unknown | >95% | Automated validation |
| LLM constraint adherence | Unknown | 40% improvement | Manual review + metrics |

## Rollback Plan

If quality degrades:
1. Revert template version to 1.0
2. Maintain both versions in parallel
3. Analyze which specific changes caused issues
4. Selectively apply beneficial changes only

## Implementation Notes

- Use semantic XML tag names that reflect purpose (constraints vs data)
- Maintain clear separation between instruction and data sections
- Ensure backward compatibility with existing data structures
- Add version metadata to template for tracking

## References

- Report Section 1.1: "Inverted Priority Structure"
- Report Section 8.1: "Restructured Template"
- Report Section 9: "Implementation Roadmap - Phase 1"
