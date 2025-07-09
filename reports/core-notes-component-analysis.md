# Core:Notes Component Analysis Report

**Date**: 2025-07-08  
**Purpose**: Comprehensive analysis of 'core:notes' component usage across the Living Narrative Engine codebase  
**Reason for Analysis**: Planned structural changes to the component

## Executive Summary

The `core:notes` component is a critical data storage mechanism used throughout the Living Narrative Engine to enable LLM-based AI players to maintain persistent memories. This analysis identified 16 direct references to the component across the codebase, with usage spanning from data persistence to prompt generation.

### Key Findings

- **16 files** directly reference 'core:notes'
- Component is deeply integrated into the LLM decision-making pipeline
- Notes flow through 7 distinct processing stages
- Strong coupling exists between notes persistence and AI prompting systems
- Test coverage is comprehensive with 6 dedicated test files

## Component Structure

### Schema Definition

Location: `data/mods/core/components/notes.component.json`

```json
{
  "id": "core:notes",
  "description": "Stores an array of notes (text + ISO-8601 timestamp) on an entity.",
  "dataSchema": {
    "properties": {
      "notes": {
        "type": "array",
        "items": {
          "properties": {
            "text": { "type": "string", "minLength": 1 },
            "timestamp": { "type": "string", "format": "date-time" }
          },
          "required": ["text"]
        }
      }
    }
  }
}
```

## Usage Analysis by Module

### 1. Constants and Configuration

- **File**: `src/constants/componentIds.js`
- **Usage**: Defines `NOTES_COMPONENT_ID = 'core:notes'`
- **Impact**: Central constant used throughout the codebase

### 2. Core Services

#### NotesService (`src/ai/notesService.js`)

**Purpose**: Business logic for note management  
**Key Operations**:

- `normalizeNoteText()`: Prevents duplicate notes via text normalization
- `addNotes()`: Adds new notes with timestamp management
- Maintains chronological ordering

#### NotesPersistenceHook (`src/ai/notesPersistenceHook.js`)

**Purpose**: Persists notes from LLM actions to entities  
**Flow**:

1. Validates incoming notes array
2. Filters invalid entries
3. Uses NotesService for deduplication
4. Updates entity component

### 3. LLM Integration

#### Response Processing

- **File**: `src/turns/services/LLMResponseProcessor.js`
- **Function**: Extracts notes from LLM JSON responses
- **Schema**: `src/turns/schemas/llmOutputSchemas.js`
  ```javascript
  notes: {
    type: 'array',
    items: { type: 'string', minLength: 1 }
  }
  ```

#### Prompt Instructions

- **File**: `data/prompts/corePromptText.json`
- **Guidelines**:
  - "Only record brand-new, critical facts"
  - "No internal musings, only hard data"
  - Focus on survival and prosperity information

### 4. Prompt Generation

#### AIPromptContentProvider (`src/prompting/AIPromptContentProvider.js`)

- Extracts notes from entity components
- Method: `_extractMemoryComponents()`
- Provides notes array for prompt assembly

#### NotesSectionAssembler (`src/prompting/assembling/notesSectionAssembler.js`)

- Formats notes as bullet list
- Sorts by timestamp (oldest first)
- Wraps with configurable prefix/suffix

### 5. Entity Management

#### DefaultComponentPolicy (`src/adapters/DefaultComponentPolicy.js`)

- Auto-injects empty notes component to actors
- Initial state: `{ notes: [] }`
- Triggered by `core:actor` component presence

#### EntityManager (`src/entities/entityManager.js`)

- Standard CRUD operations for component management
- No special handling for notes

### 6. Persistence Optimization

#### ComponentCleaningService (`src/persistence/componentCleaningService.js`)

- Removes empty notes arrays during save
- Reduces save file size

## Data Flow Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ LLM Response│────▶│ ResponseProcessor│────▶│ ACTION_DECIDED  │
│   (notes[]) │     │  (extraction)    │     │     Event       │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                                       ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Entity    │◀────│  NotesService    │◀────│PersistenceHook  │
│ Component   │     │ (deduplication)  │     │  (validation)   │
└──────┬──────┘     └──────────────────┘     └─────────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│Next Prompt  │◀────│ PromptAssembler  │◀────│PromptProvider   │
│  Generation │     │  (formatting)    │     │ (extraction)    │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

## Dependencies and Impact Analysis

### Direct Dependencies

1. **Core Systems**:
   - Entity management system
   - Component system
   - Event system
2. **AI/LLM Systems**:
   - LLM response processing
   - Prompt generation
   - Action decision pipeline

3. **Persistence**:
   - Save/load system
   - Component cleaning service

### Files Requiring Updates for Structure Changes

#### Critical Files (Must Update):

1. `data/mods/core/components/notes.component.json` - Schema definition
2. `src/ai/notesService.js` - Business logic
3. `src/ai/notesPersistenceHook.js` - Persistence logic
4. `src/turns/schemas/llmOutputSchemas.js` - LLM response schema
5. `src/prompting/assembling/notesSectionAssembler.js` - Prompt formatting

#### Test Files (Must Update):

1. `tests/unit/schemas/core.notes.schema.test.js`
2. `tests/unit/prompting/AIPromptContentProvider.notes.test.js`
3. `tests/unit/prompting/AIPromptContentProvider.includeNotesGoals.test.js`
4. Additional prompt-related tests

#### Documentation:

1. `README.md` - Component documentation

## Recommendations for Refactoring

### 1. Maintain Backward Compatibility

- Consider versioning the component schema
- Implement migration logic for existing save files
- Add compatibility layer during transition

### 2. Update Order of Operations

1. Update schema definition
2. Modify NotesService to handle new structure
3. Update persistence and validation logic
4. Adjust LLM response schema
5. Update prompt generation
6. Comprehensive test updates
7. Migration utilities for existing data

### 3. Consider Interface Abstraction

- Create an interface for note operations
- Decouple implementation from consumers
- Easier future modifications

### 4. Testing Strategy

- Create integration tests for complete flow
- Test migration scenarios
- Validate backward compatibility
- Performance testing for large note collections

## Risk Assessment

### High Risk Areas:

1. **Save File Compatibility**: Existing games may break
2. **LLM Response Processing**: Structure changes affect AI behavior
3. **Prompt Generation**: May impact AI decision quality

### Medium Risk Areas:

1. **Performance**: New structure may impact processing speed
2. **Memory Usage**: Depending on new structure complexity

### Low Risk Areas:

1. **UI Display**: No direct UI components identified
2. **Network**: Notes are locally stored

## Conclusion

The `core:notes` component is deeply integrated into the Living Narrative Engine's AI memory system. Any structural changes will require careful coordination across multiple subsystems. The recommended approach is to:

1. Design the new structure with backward compatibility in mind
2. Implement changes incrementally with feature flags
3. Provide comprehensive migration tools
4. Extensive testing at each stage

The analysis shows that while the component touches many files, the actual implementation is well-encapsulated in a few core services, which should make refactoring manageable with proper planning.
