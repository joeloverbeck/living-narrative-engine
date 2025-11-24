# LLMROLPROARCANA-002: Simplify Note Subject Taxonomy from 16 to 6 Types

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 3.3, Section 9, Phase 1, Task 2
**Priority:** CRITICAL ⭐⭐⭐⭐⭐
**Estimated Effort:** Low (4-8 hours)
**Impact:** 30% reduction in decision complexity, 67% token reduction in taxonomy section
**Phase:** 1 - Critical Fixes (Week 1)

## Problem Statement

The current note-taking system uses 16+ subject types with extensive decision trees, creating cognitive overload for the LLM:

**Current Types (16):**
- Core Entity: character, location, item, creature, organization
- Temporal & Action: event, plan, timeline, quest
- Knowledge & Mental: theory, observation, knowledge_state, concept
- Psychological & Social: emotion, psychological_state, relationship, skill
- Other: other

This complexity:
- Creates decision paralysis (16-question decision tree)
- Consumes ~1,200 tokens for rules alone
- Overwhelms classification task with excessive distinctions
- Leads to classification errors and hesitation

## Objective

Reduce note subject types to 6 core categories with clear, simple classification criteria, eliminating complex decision trees while maintaining core functionality.

**Target Taxonomy (6 types):**
1. **entity** - People, places, things, creatures
2. **event** - Things that already happened
3. **plan** - Future intentions not yet executed
4. **knowledge** - Information, theories, observations
5. **state** - Mental/emotional/psychological conditions
6. **other** - Fallback for uncertain or abstract concepts

## Acceptance Criteria

- [ ] Note taxonomy reduced from 16 to 6 types
- [ ] Simple 1-sentence criteria for each type
- [ ] Decision tree eliminated (replaced with direct criteria)
- [ ] Token count for taxonomy section reduced by 67% (1,200 → 400 tokens)
- [ ] All existing tests pass with new taxonomy
- [ ] Note classification accuracy maintained or improved (target: >90%)
- [ ] Updated schemas and validation

## Technical Implementation

### Files to Modify

1. **`data/schemas/note.schema.json`**
   - Update `subjectType` enum to 6 values
   - Remove deprecated type references

2. **`src/prompting/templates/characterPromptTemplate.js`**
   - Update `buildNoteSystem()` with simplified taxonomy
   - Remove complex decision tree text
   - Add concise classification guidance

3. **`data/prompts/corePromptText.json`**
   - Replace extensive taxonomy documentation
   - Add simple 6-type reference

4. **`src/ai/notesAnalyticsService.js`** (if exists)
   - Update type validation logic
   - Add migration mapping for old → new types

### Proposed Documentation

```markdown
## NOTE SUBJECT TYPES

Select ONE type per note using these simple criteria:

1. **entity** - Describing who/what/where
   Use when: Recording information about people, places, things, creatures
   Examples: "Registrar Copperplate", "The Crown and Quill tavern", "enchanted lute"

2. **event** - Describing past occurrences
   Use when: Recording things that already happened
   Examples: "Bertram offered job posting", "Fight broke out at bar"

3. **plan** - Describing future intentions
   Use when: Recording what you intend to do (not yet executed)
   Examples: "Will investigate the sewers tomorrow", "Planning to perform at festival"

4. **knowledge** - Information, theories, observations
   Use when: Recording what you know, noticed, or theorize
   Examples: "Copperplate keeps secrets", "Town guard changes at midnight"

5. **state** - Mental/emotional/psychological conditions
   Use when: Describing feelings or complex mental states
   Examples: "Feeling increasingly feral", "Conflicted about artistic integrity"

6. **other** - Anything not clearly fitting above
   Use when: Uncertain or abstract concepts

**Format:** 1-3 sentences, max 60 words, in character voice.

**Priority Guidelines:**
- HIGH: Character secrets, survival plans, critical deadlines → Always record
- MEDIUM: Behavioral patterns, theories, relationships → Record if significant
- LOW: Routine events, common knowledge → OMIT unless exceptional
```

### Migration Mapping

Old Type → New Type mapping for backward compatibility:

```javascript
const NOTE_TYPE_MIGRATION = {
  // Entity types
  'character': 'entity',
  'location': 'entity',
  'item': 'entity',
  'creature': 'entity',
  'organization': 'entity',

  // Event/temporal types
  'event': 'event',
  'timeline': 'event',

  // Plan types
  'plan': 'plan',
  'quest': 'plan',

  // Knowledge types
  'theory': 'knowledge',
  'observation': 'knowledge',
  'knowledge_state': 'knowledge',
  'concept': 'knowledge',

  // State types
  'emotion': 'state',
  'psychological_state': 'state',
  'relationship': 'state',
  'skill': 'state',

  // Fallback
  'other': 'other'
};
```

## Testing Requirements

### Unit Tests
- [ ] Test note type validation with new 6-type enum
- [ ] Test migration mapping for old types
- [ ] Test classification guidance formatting

### Integration Tests
- [ ] Test note creation with each of 6 types
- [ ] Test existing notes with old types (migration)
- [ ] Verify schema validation accepts new types

### E2E Tests
- [ ] Test LLM note classification accuracy with simplified taxonomy
- [ ] Compare classification accuracy: old (16 types) vs new (6 types)
- [ ] Verify note quality is maintained or improved

### Classification Accuracy Test
Create test dataset with 100 scenarios, verify LLM selects correct type >90% of time:

```javascript
const testScenarios = [
  {
    scenario: "Met a mysterious cloaked figure at the market",
    expectedType: "entity",
    description: "Describing a person"
  },
  {
    scenario: "Witnessed a brawl break out near the fountain",
    expectedType: "event",
    description: "Past occurrence"
  },
  {
    scenario: "Will investigate the abandoned mill tomorrow night",
    expectedType: "plan",
    description: "Future intention"
  },
  // ... 97 more scenarios
];
```

## Dependencies

- **Blocks:** None
- **Blocked By:** None
- **Related:**
  - LLMROLPROARCANA-001 (Restructure Information Hierarchy)
  - LLMROLPROARCANA-003 (Consolidate Action Tag Rules)

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Subject type count | 16 types | 6 types | Schema enumeration |
| Taxonomy token count | 1,200 tokens | 400 tokens | Section measurement |
| Decision tree complexity | 16 questions | 0 questions | Removal verification |
| Classification accuracy | Unknown | >90% | Test dataset validation |
| Token savings | 0 | 800 tokens | Before/after comparison |

## Rollback Plan

If classification accuracy drops below 85%:
1. Analyze which specific distinctions are needed
2. Consider adding 1-2 intermediate types (e.g., split entity into character/location)
3. Maximum: 8 types (not back to 16)

Maintain old type mapping for backward compatibility with existing notes.

## Implementation Notes

- **Rationale for 6 types:** LLM can reliably handle 6-8 options, but struggles with 16+
- **Entity consolidation:** Game engine can post-process entity type if needed for analytics
- **Knowledge consolidation:** All informational content grouped together
- **State consolidation:** All mental/emotional content grouped together
- **Priority system:** Reduces note volume by filtering low-priority items

## References

- Report Section 3.3: "Note-Taking System"
- Report Section 7.1: "Recommendation 2 - Simplify Note Taxonomy"
- Report Appendix A: "Before vs After: Note Subject Types"
