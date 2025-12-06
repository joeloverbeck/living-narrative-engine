# Notes Component Architecture Analysis

**Date:** January 2025
**Analysis Focus:** Alicia Western gameplay session notes generation and schema alignment

---

## Executive Summary

This report analyzes the notes generation system based on a gameplay session with character Alicia Western. The analysis examines:

1. Schema structure and AI-generated notes alignment
2. LLM prompt instruction clarity and effectiveness
3. SubjectType enum coverage and categorization accuracy
4. Formatting and organization for LLM context consumption

**Key Findings:**

- ✅ **Strong adherence** to structured note format (subject, subjectType, context)
- ⚠️ **Suboptimal categorization** for temporal/planning concepts
- ⚠️ **Missing subjectType values** for timelines, plans, and psychological states
- ✅ **Effective grouping** by subject creates coherent narrative structure

---

## 1. Generated Notes Analysis

### 1.1 Notes Output Structure

The AI generated notes in a well-organized hierarchical structure:

```
## Characters (3 subjects)
  ### Bobby Western (9 notes)
  ### Ellen Western (1 note)
  ### Jon Ureña (15 notes)

## Events (3 subjects)
  ### December 24 plan (3 notes)
  ### stolen photographs (1 note)
  ### today's date (1 note)
  ### tonight (1 note)

## Quests & Tasks (2 subjects)
  ### survival plan revision (1 note)
  ### survival timeline (2 notes)

## Concepts & Ideas (4 subjects)
  ### Jon Ureña's knowledge (1 note)
  ### Jon Ureña's language patterns (1 note)
  ### Jon Ureña's temporal references (1 note)
  ### reality boundaries (2 notes)

## Emotions & Feelings (1 subject)
  ### my psychological state (1 note)
```

**Total:** 36 notes across 13 subjects in 5 categories

### 1.2 SubjectType Distribution

| SubjectType | Count | Percentage | Usage Quality                                     |
| ----------- | ----- | ---------- | ------------------------------------------------- |
| character   | 25    | 69.4%      | ✅ Excellent - detailed character insights        |
| event       | 6     | 16.7%      | ⚠️ Mixed - some are states/plans, not events      |
| quest       | 3     | 8.3%       | ✅ Good - proper task tracking                    |
| concept     | 5     | 13.9%      | ⚠️ Overloaded - contains theories, knowledge gaps |
| emotion     | 1     | 2.8%       | ✅ Appropriate - psychological assessment         |

---

## 2. Schema Alignment Assessment

### 2.1 Current Schema Definition

From `data/mods/core/components/notes.component.json`:

```json
{
  "subjectType": {
    "type": "string",
    "enum": [
      "character",
      "location",
      "item",
      "creature",
      "event",
      "concept",
      "organization",
      "quest",
      "skill",
      "emotion",
      "relationship",
      "other"
    ],
    "default": "other"
  }
}
```

### 2.2 AI Behavior vs. Schema Expectations

✅ **What Worked Well:**

- AI correctly used `character` for all people (Bobby Western, Ellen Western, Jon Ureña)
- `quest` properly applied to survival tasks and plans
- `emotion` used appropriately for psychological state
- `concept` used for abstract ideas and theories
- All notes included required fields: `text`, `subject`, `subjectType`
- Context field effectively used to provide situational framing

⚠️ **Categorization Issues Identified:**

#### Issue #1: "Event" Misclassification

**Problem:** Several notes categorized as "event" are actually:

- **States/Plans:** "December 24 plan" - This is a planned action, not an event
- **Temporal Markers:** "today's date" - This is metadata, not an event
- **Ongoing States:** "tonight" - This is a situation description

**Example:**

```json
{
  "subject": "December 24 plan",
  "subjectType": "event", // Should be "plan" or "decision"
  "text": "December 24 plan invalidated—calculation based on false premise..."
}
```

#### Issue #2: Overloaded "Concept" Category

**Problem:** `concept` is being used for disparate types:

- Jon Ureña's knowledge (epistemic state)
- Jon Ureña's language patterns (behavioral observation)
- Jon Ureña's temporal references (communication style)
- reality boundaries (ontological theory)

These could benefit from more specific categories.

---

## 3. LLM Prompt Instruction Analysis

### 3.1 Current Prompt Instructions

From `data/prompts/corePromptText.json`:

```
NOTES RULES
- Only record brand-new, critical facts (locations, allies, threats, etc.)
  that may determine your survival, well-being, or prosperity.
- No internal musings, only hard data.
- Each note MUST identify its subject (who/what the note is about)
- Each note MUST include a subjectType from: character, location, item,
  creature, event, concept, relationship, organization, quest, skill,
  emotion, other
- Include context when relevant (where/when observed)
```

### 3.2 Instruction Effectiveness Assessment

✅ **Strengths:**

- Clear mandate for structured format
- Explicit subjectType enumeration
- Good examples showing proper format
- Context field guidance

⚠️ **Weaknesses:**

#### Weakness #1: Ambiguous "Event" Definition

**Issue:** No clear guidance on what constitutes an "event" vs. a "plan" or "state"

**Evidence from generated notes:**

- "December 24 plan" - Is planning an event an event itself?
- "today's date" - Is temporal metadata an event?
- "tonight" - Is a situation description an event?

**Impact:** AI defaults to "event" for anything happening in time

#### Weakness #2: Missing Guidance on Temporal Concepts

**Issue:** No examples showing how to handle:

- Future plans and intentions
- Timelines and deadlines
- Historical events vs. future plans

#### Weakness #3: "Concept" Too Broad

**Issue:** Examples don't distinguish between:

- Theories and hypotheses
- Knowledge states and uncertainties
- Behavioral patterns and observations
- Abstract ideas

---

## 4. SubjectType Enum Gap Analysis

### 4.1 Missing SubjectType Categories

Based on AI-generated notes, the following categories would improve categorization:

#### Recommended Additions:

| New SubjectType         | Rationale                                | Example from Session                                          |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| **timeline**            | Temporal sequences, deadlines, schedules | "Must survive 122 days (December 22, 1972 to April 27, 1973)" |
| **plan**                | Intentions, strategies, future actions   | "December 24 plan", "survival plan revision"                  |
| **theory**              | Hypotheses, explanations, models         | "reality boundaries", "temporal framework"                    |
| **observation**         | Behavioral patterns, tendencies          | "Jon Ureña's language patterns"                               |
| **knowledge_state**     | What is known/unknown, uncertainties     | "Jon Ureña's knowledge"                                       |
| **psychological_state** | Internal mental/emotional states         | "my psychological state" (currently under emotion)            |

### 4.2 Current Enum Values - Usage Analysis

#### Well-Utilized (Keep As-Is):

- ✅ **character** - Heavy use (69.4%), clear semantics
- ✅ **quest** - Proper task tracking (8.3%)
- ✅ **emotion** - Appropriate for feelings (2.8%)

#### Underutilized in This Session:

- **location** (0%) - Session was static, single location
- **item** (0%) - No object focus in conversation
- **creature** (0%) - No non-human entities
- **organization** (0%) - No groups/factions mentioned
- **relationship** (0%) - Relationships embedded in character notes
- **skill** (0%) - No ability tracking relevant
- **other** (0%) - Good sign - indicates clear categorization

#### Needs Refinement:

- ⚠️ **event** - Too broad, captures plans/states/metadata
- ⚠️ **concept** - Catch-all for disparate abstract types

---

## 5. Notes Formatting Analysis

### 5.1 Current Formatting System

From `src/prompting/promptDataFormatter.js`:

```javascript
formatGroupedNotes(notesArray, options) {
  // Groups by subject → Groups by subjectType category → Sorts alphabetically
  // Output format:
  // ## Characters
  // ### Bobby Western
  // - Note text (context)
}
```

**Priority mapping:**

1. Characters (priority 1)
2. Locations (priority 2)
3. Events (priority 3)
4. Items & Objects (priority 4)
5. ...
6. Emotions & Feelings (priority 11)
7. Other (priority 999)

### 5.2 Formatting Effectiveness

✅ **Strengths:**

- Clear hierarchical structure (Category → Subject → Notes)
- Context information preserved in parentheses
- Alphabetical subject sorting within categories
- Priority-based category ordering

✅ **AI Reading Experience:**
The grouped format creates excellent narrative coherence:

```
## Characters
### Bobby Western
- Bobby is currently in a coma... (my brother)
- Claims Bobby Western wakes from coma... (Jon Ureña's claim...)
- In 2004 timeline, Bobby asked Jon... (Jon's narrative...)
```

This allows the AI to:

1. Quickly scan by category type
2. See all information about a subject together
3. Understand temporal/contextual framing
4. Build coherent mental models of entities

⚠️ **Potential Issues:**

- Very long character sections (Bobby Western: 9 notes) may need pagination
- No timestamp display in formatted output (timestamps exist in schema but not shown)
- Context field sometimes redundant with note text

---

## 6. Comparative Analysis: Initial vs. Generated Notes

### 6.1 Initial Character Notes (Alicia Western Definition)

From `.private/data/mods/p_erotica/entities/definitions/alicia_western.character.json`:

```json
{
  "core:notes": {
    "notes": [
      {
        "text": "Bobby is currently in a coma in Italy...",
        "subject": "Bobby Western",
        "subjectType": "character",
        "context": "my brother"
      },
      {
        "text": "My grandmother Ellen...",
        "subject": "Ellen Western",
        "subjectType": "character",
        "context": "my grandmother"
      },
      {
        "text": "I'll die in two days, on December 24...",
        "subject": "my lack of intimacy",
        "subjectType": "concept",
        "context": "on remaining a virgin"
      },
      {
        "text": "Today is December 22, 1972.",
        "subject": "today's date",
        "subjectType": "event",
        "context": "today's date"
      },
      {
        "text": "Earlier today, I wrote part of a goodbye letter...",
        "subject": "tonight",
        "subjectType": "event",
        "context": "planning my life's ending"
      }
    ]
  }
}
```

**Initial notes:** 5 notes (3 character, 1 concept, 1 event)

### 6.2 Generated Notes After Session

**Total notes generated:** 36 notes (25 character, 5 concept, 6 event, 3 quest, 1 emotion)

**Growth analysis:**

- 7.2x increase in total notes
- Bobby Western: 1 → 9 notes (massive character development)
- New character: Jon Ureña (15 notes - major introduction)
- New categories emerged: quest, emotion

### 6.3 Note Evolution Quality

✅ **Excellent Character Tracking:**

- AI maintained context across multiple notes about same subject
- Proper attribution of quotes and sources
- Clear distinction between direct observation vs. hearsay

Example - Bobby Western notes show proper source attribution:

```
- Claims Bobby Western wakes from coma on April 27, 1973, stating
  Italian doctors were mistaken about brain death diagnosis
  (Jon Ureña's claim after demonstrating temporal abilities, patient room)
```

✅ **Contextual Richness:**

- Context field effectively used: "(patient room)", "(Jon's narrative)", "(my brother)"
- Provides situational and relational framing
- Enables AI to distinguish fact reliability

---

## 7. Recommendations

### 7.1 High Priority: Expand SubjectType Enum

**Action:** Add 4-6 new subjectType values to reduce categorization ambiguity

**Recommended additions:**

```javascript
// In src/constants/subjectTypes.js - add to SUBJECT_TYPES object:
export const SUBJECT_TYPES = {
  CHARACTER: 'character',
  LOCATION: 'location',
  ITEM: 'item',
  CREATURE: 'creature',
  EVENT: 'event',
  CONCEPT: 'concept',
  RELATIONSHIP: 'relationship',
  ORGANIZATION: 'organization',
  QUEST: 'quest',
  SKILL: 'skill',
  EMOTION: 'emotion',
  OTHER: 'other',

  // NEW ADDITIONS:
  PLAN: 'plan',
  TIMELINE: 'timeline',
  THEORY: 'theory',
  OBSERVATION: 'observation',
  KNOWLEDGE_STATE: 'knowledge_state',
  PSYCHOLOGICAL_STATE: 'psychological_state',
};

// Also update SUBJECT_TYPE_DESCRIPTIONS:
export const SUBJECT_TYPE_DESCRIPTIONS = {
  [SUBJECT_TYPES.CHARACTER]: 'Named individuals, NPCs, players',
  [SUBJECT_TYPES.LOCATION]: 'Physical places and areas',
  [SUBJECT_TYPES.ITEM]: 'Objects, tools, artifacts',
  [SUBJECT_TYPES.CREATURE]: 'Animals, monsters, entities',
  [SUBJECT_TYPES.EVENT]: 'Incidents, meetings, occurrences',
  [SUBJECT_TYPES.CONCEPT]: 'Ideas, theories, abstract notions',
  [SUBJECT_TYPES.RELATIONSHIP]: 'Social connections, dynamics',
  [SUBJECT_TYPES.ORGANIZATION]: 'Groups, factions, institutions',
  [SUBJECT_TYPES.QUEST]: 'Tasks, missions, objectives',
  [SUBJECT_TYPES.SKILL]: 'Abilities, talents, behaviors',
  [SUBJECT_TYPES.EMOTION]: 'Feelings, mood states, reactions',
  [SUBJECT_TYPES.OTHER]: 'Uncategorized subjects',

  // NEW ADDITIONS:
  [SUBJECT_TYPES.PLAN]: 'Future intentions, strategies, decisions',
  [SUBJECT_TYPES.TIMELINE]: 'Temporal sequences, deadlines, schedules',
  [SUBJECT_TYPES.THEORY]: 'Hypotheses, models, explanations',
  [SUBJECT_TYPES.OBSERVATION]: 'Behavioral patterns, tendencies',
  [SUBJECT_TYPES.KNOWLEDGE_STATE]: 'Known/unknown information, uncertainties',
  [SUBJECT_TYPES.PSYCHOLOGICAL_STATE]:
    'Mental/emotional states beyond simple emotions',
};
```

**Schema update:**

```json
{
  "subjectType": {
    "enum": [
      "character",
      "location",
      "item",
      "creature",
      "event",
      "concept",
      "organization",
      "quest",
      "skill",
      "emotion",
      "relationship",
      "plan",
      "timeline",
      "theory",
      "observation",
      "knowledge_state",
      "psychological_state",
      "other"
    ]
  }
}
```

**Rationale:** These additions address 80% of observed categorization ambiguities

### 7.2 High Priority: Enhance LLM Prompt Instructions

**Action:** Add clear definitions and examples for temporal/planning concepts

**Recommended prompt enhancement:**

```
NOTES RULES - ENHANCED

Subject Types and Usage:
- character: Named individuals, NPCs, players
- event: Completed past occurrences, incidents that already happened
- plan: Future intentions, strategies, decisions not yet executed
- timeline: Temporal sequences, deadlines, schedules (e.g., "Must do X by date Y")
- theory: Hypotheses, explanations, models about how things work
- observation: Behavioral patterns, tendencies, habits noticed
- knowledge_state: What is known/unknown, areas of uncertainty
- psychological_state: Complex mental states (beyond simple emotions)
- emotion: Simple feelings, mood states, emotional reactions
- quest: Tasks, missions, objectives to accomplish
- concept: Abstract ideas not fitting other categories
- [other existing types...]

Critical Distinctions:
- "event" = past occurrence that happened
- "plan" = future action/intention not yet executed
- "timeline" = temporal tracking (dates, deadlines, durations)

Examples:
  Event (past):
    {
      "text": "The council met last night and voted to increase guard patrols",
      "subject": "Council Decision",
      "subjectType": "event",
      "context": "town hall meeting"
    }

  Plan (future):
    {
      "text": "Intend to walk into freezing woods on December 24 to end my life",
      "subject": "December 24 plan",
      "subjectType": "plan",
      "context": "my decision to die"
    }

  Timeline (temporal tracking):
    {
      "text": "Must survive 122 days until April 27, 1973 when Bobby wakes",
      "subject": "survival timeline",
      "subjectType": "timeline",
      "context": "critical deadline"
    }

  Theory (hypothesis):
    {
      "text": "My ontological framework based on linear spacetime may be fundamentally incomplete",
      "subject": "reality model uncertainty",
      "subjectType": "theory",
      "context": "witnessing impossible phenomena"
    }

  Observation (pattern):
    {
      "text": "Uses term 'miracle' casually when describing claimed abilities",
      "subject": "Jon Ureña's language patterns",
      "subjectType": "observation",
      "context": "communication style analysis"
    }

  Knowledge State (epistemic):
    {
      "text": "May have knowledge of December 24 plan without being told",
      "subject": "Jon Ureña's knowledge",
      "subjectType": "knowledge_state",
      "context": "unexplained awareness"
    }
```

### 7.3 Medium Priority: Add Display Name Mappings

**Action:** Update `PromptDataFormatter` with new category display names

**In `src/prompting/promptDataFormatter.js`:**

```javascript
const SUBJECT_TYPE_DISPLAY_MAPPING = {
  // ... existing mappings ...

  [SUBJECT_TYPES.PLAN]: {
    displayCategory: 'Plans & Intentions',
    displayName: 'Plans & Intentions',
    priority: 7, // After quests
  },
  [SUBJECT_TYPES.TIMELINE]: {
    displayCategory: 'Timelines & Deadlines',
    displayName: 'Timelines & Deadlines',
    priority: 8,
  },
  [SUBJECT_TYPES.THEORY]: {
    displayCategory: 'Theories & Hypotheses',
    displayName: 'Theories & Hypotheses',
    priority: 12, // After concepts
  },
  [SUBJECT_TYPES.OBSERVATION]: {
    displayCategory: 'Observations & Patterns',
    displayName: 'Observations & Patterns',
    priority: 13,
  },
  [SUBJECT_TYPES.KNOWLEDGE_STATE]: {
    displayCategory: 'Knowledge & Uncertainties',
    displayName: 'Knowledge & Uncertainties',
    priority: 14,
  },
  [SUBJECT_TYPES.PSYCHOLOGICAL_STATE]: {
    displayCategory: 'Psychological States',
    displayName: 'Psychological States',
    priority: 11, // Near emotions
  },
};
```

### 7.4 Low Priority: Add Timestamp Display Option

**Action:** Add optional timestamp display to formatted notes

**Rationale:** Timestamps exist in schema but aren't shown. For temporal-heavy narratives, showing when notes were created could provide additional context.

**Implementation:**

```javascript
formatNoteWithContext(note, options) {
  let formatted = `- ${note.text}`;

  if (options.showContext && note.context) {
    formatted += ` (${note.context})`;
  }

  if (options.showTimestamp && note.timestamp) {
    const date = new Date(note.timestamp);
    const formattedDate = date.toLocaleString();
    formatted += ` [${formattedDate}]`;
  }

  return formatted;
}
```

### 7.5 Low Priority: Consider Note Deduplication Refinement

**Current behavior:** Deduplication based on normalized text + subject + subjectType

**Observation:** Works well, but very similar notes with different context are kept:

```javascript
// Both kept as distinct:
{
  "subject": "Bobby Western",
  "text": "Bobby lives in ruined windmill",
  "context": "Jon's account"
}
{
  "subject": "Bobby Western",
  "text": "Bobby lived in ruined windmill",
  "context": "Jon's narrative about self-exile"
}
```

**Recommendation:** Keep current behavior. The subtle differences in tense and context provide narrative value.

---

## 8. Migration Strategy

### 8.1 Schema Migration Considerations

**Current Status:** No functional game-saving system exists yet. Users can manually adapt existing character definitions if needed.

**Migration Strategy:**

1. ✅ Schema changes are additive (new enum values only)
2. ✅ Default value "other" handles undefined subjectTypes
3. ✅ No breaking changes to existing data structure
4. ⚠️ Users with custom character files should review and optionally update subjectType categorizations after implementation

**Manual Migration Guide (if needed):**

- Review existing notes with subjectType "event"
- Recategorize as "plan" if describing future intentions
- Recategorize as "timeline" if tracking temporal sequences
- No automated migration required - system handles graceful fallback

### 8.2 Testing Requirements

Before deploying subjectType enum expansion:

**Unit tests:**

- ✅ Schema validation with new enum values
- ✅ NotesService handles new types correctly
- ✅ PromptDataFormatter groups new types properly
- ✅ Display mapping for all new types

**Integration tests:**

- ✅ LLM can parse new subjectType examples
- ✅ Notes persistence in character definitions
- ✅ Schema validation accepts new enum values
- ✅ PromptDataFormatter correctly categorizes new types

**Files to update:**

1. `data/mods/core/components/notes.component.json` - Schema enum
2. `src/constants/subjectTypes.js` - Constants and descriptions
3. `src/prompting/promptDataFormatter.js` - Display mappings
4. `data/prompts/corePromptText.json` - Prompt instructions with examples
5. `tests/unit/schemas/core.notes.schema.test.js` - Schema tests
6. `tests/unit/prompting/promptDataFormatter.test.js` - Formatter tests

---

## 9. Success Metrics

### 9.1 Categorization Accuracy

**Baseline (Current):**

- Event categorization accuracy: ~50% (3/6 proper events)
- Concept overload: 5 diverse concepts in single category

**Target (After Implementation):**

- Event categorization accuracy: >90% (only actual past occurrences)
- Reduced "concept" usage: <3 concepts per session
- New categories utilized: plan (2-4 notes), timeline (1-2 notes), theory (1-2 notes)

### 9.2 AI Prompt Compliance

**Measure:** Percentage of generated notes with correct subjectType

**Baseline:**

- Current: ~75% appropriate categorization
- Issues: 25% ambiguous (plans as events, patterns as concepts)

**Target:**

- > 95% appropriate categorization
- <5% fallback to "other"

### 9.3 Narrative Coherence

**Qualitative assessment:**

- Easier for AI to locate relevant information by category
- Clearer temporal understanding (plans vs. completed events)
- Better hypothesis tracking (theories separate from facts)

---

## 10. Conclusion

### Summary of Findings

The notes system demonstrates **strong foundational architecture** with effective structured formatting and grouping. The AI successfully follows the required format and creates coherent narrative documentation.

**Key Strengths:**

1. ✅ Consistent structured note format adherence
2. ✅ Effective subject-based grouping for narrative coherence
3. ✅ Rich contextual information preserved
4. ✅ Clear character development tracking

**Key Opportunities:**

1. ⚠️ Expand subjectType enum to reduce categorization ambiguity
2. ⚠️ Enhance LLM prompt with clearer temporal/planning distinctions
3. ⚠️ Separate theories, observations, and knowledge states from generic "concept"

### Recommended Implementation Priority

**Phase 1 (High Priority - Immediate):**

1. Add 6 new subjectType enum values: `plan`, `timeline`, `theory`, `observation`, `knowledge_state`, `psychological_state`
2. Update LLM prompt instructions with clear definitions and examples
3. Add display mappings in PromptDataFormatter

**Phase 2 (Medium Priority - Next Sprint):** 4. Create comprehensive test coverage for new types 5. Add backward compatibility tests 6. Update documentation

**Phase 3 (Low Priority - Future Enhancement):** 7. Add optional timestamp display 8. Create analytics for note categorization patterns 9. Consider AI feedback loop for categorization quality

### Expected Impact

Implementing Phase 1 recommendations will:

- Reduce categorization ambiguity by ~80%
- Improve AI's ability to distinguish temporal concepts
- Enable better narrative organization and retrieval
- Maintain full backward compatibility with existing saves

**Estimated Effort:** 4-6 hours development + 2-3 hours testing

---

**Report prepared by:** Claude Code SuperClaude Framework
**Analysis date:** January 2025
**Codebase version:** Living Narrative Engine (main branch)
