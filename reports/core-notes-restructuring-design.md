# Core:Notes Component Restructuring Design

**Date**: 2025-07-08  
**Author**: System Architect  
**Purpose**: Design comprehensive restructuring of core:notes component to address contextual clarity issues

## Executive Summary

The current `core:notes` component uses a simple array structure that leads to ambiguous notes lacking contextual information. This design proposes restructuring notes as **Structured Note Objects** with explicit subject, context, and categorization fields, providing superior contextual clarity while maintaining backward compatibility.

## Problem Statement

### Current Issues

1. **Ambiguous References**: Notes like "he seems nervous" lack subject identification
2. **Missing Context**: No indication of where/when observations were made
3. **Poor Organization**: All notes mixed together without categorization
4. **Difficult Querying**: Finding notes about specific subjects requires full array scans
5. **LLM Behavior**: LLMs dump unstructured information without clear referential context

### Root Cause

The array-only structure provides no framework for contextual information, leading LLMs to generate notes without proper subject identification.

## Alternative Designs Considered

### 1. Dictionary/Map Structure (User's Proposal)

```json
{
  "notes": {
    "John": ["seems nervous", "likes coffee"],
    "Market": ["crowded today", "prices rising"]
  }
}
```

**Pros**: Simple grouping by subject, clear ownership  
**Cons**: Rigid categorization, single-subject limitation, major breaking change

### 2. Tagged Notes Array

```json
{
  "notes": [
    {
      "text": "John seems nervous",
      "tags": ["John", "emotions", "observation"],
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Pros**: Flexible multi-tagging, searchable, maintains array structure  
**Cons**: Tag management complexity, less structured than explicit fields

### 3. Hierarchical Context Structure

```json
{
  "notes": {
    "entities": { "John": [...], "Sarah": [...] },
    "locations": { "market": [...], "tavern": [...] },
    "concepts": { "politics": [...], "trade": [...] }
  }
}
```

**Pros**: Clear semantic organization  
**Cons**: Predetermined categories limiting, complex for LLMs

### 4. Structured Note Objects (Recommended)

```json
{
  "notes": [
    {
      "text": "Seems nervous about the council meeting",
      "subject": "John",
      "context": "tavern conversation",
      "tags": ["emotion", "politics"],
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Pros**: Explicit context, backward compatible, natural for LLMs, flexible  
**Cons**: Slightly more complex than current structure

### 5. Hybrid Array + Index

```json
{
  "notes": [...],
  "index": {
    "John": [0, 3, 5],
    "Market": [1, 2, 4]
  }
}
```

**Pros**: Maintains compatibility, fast lookups  
**Cons**: Index maintenance overhead, denormalization issues

## Recommended Solution: Structured Note Objects

### Schema Design

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "notes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "description": "The note content"
          },
          "subject": {
            "type": "string",
            "minLength": 1,
            "description": "Primary subject of the note (entity, location, concept)"
          },
          "context": {
            "type": "string",
            "description": "Where/how this was observed (optional)"
          },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Additional categorization tags (optional)"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "When the note was created"
          }
        },
        "required": ["text", "subject"],
        "additionalProperties": false
      }
    }
  }
}
```

### LLM Response Schema Update

```javascript
notes: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      text: { type: 'string', minLength: 1 },
      subject: { type: 'string', minLength: 1 },
      context: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['text', 'subject']
  }
}
```

### LLM Prompt Guidance

Update prompt instructions to include:

```
NOTES RULES:
- Each note MUST identify its subject (who/what the note is about)
- Include context when relevant (where/when observed)
- Use tags for categorization (e.g., "combat", "relationship", "location")
- Example format:
  {
    "text": "Seems nervous about the council meeting",
    "subject": "John",
    "context": "tavern conversation",
    "tags": ["emotion", "politics"]
  }
```

## Implementation Plan

### Phase 1: Schema and Core Updates

1. Update `notes.component.json` schema
2. Create `NotesMigrationService` for data conversion
3. Update `NotesService` to handle both formats
4. Implement deduplication with subject consideration

### Phase 2: LLM Integration

1. Update `llmOutputSchemas.js`
2. Modify `LLMResponseProcessor` for new format
3. Update prompt templates with examples
4. Test LLM comprehension and compliance

### Phase 3: Display and Querying

1. Update `NotesSectionAssembler` for grouped display
2. Create query utilities for subject-based searches
3. Implement note filtering/sorting options

### Phase 4: Migration and Testing

1. Create migration script for existing saves
2. Update all test suites
3. Integration testing with full pipeline
4. Performance testing with large note sets

## Migration Strategy

### Automatic Conversion

```javascript
function migrateNote(oldNote) {
  // Extract subject from text using NLP patterns
  const subjectPattern = /^([\w\s]+)\s+(seems|appears|is|was|has)/i;
  const match = oldNote.text.match(subjectPattern);

  return {
    text: oldNote.text,
    subject: match ? match[1].trim() : 'Unknown',
    context: 'legacy note',
    tags: ['migrated'],
    timestamp: oldNote.timestamp || new Date().toISOString(),
  };
}
```

### Backward Compatibility

- Support reading both formats during transition
- Gradually migrate on save
- Provide manual migration command

## Risk Assessment

### High Priority Risks

1. **Save File Compatibility**: Mitigate with dual-format support
2. **LLM Compliance**: Extensive prompt testing required
3. **Performance Impact**: Index subject field for queries

### Medium Priority Risks

1. **Migration Quality**: Some subjects may be incorrectly extracted
2. **Increased Complexity**: Provide clear documentation

### Low Priority Risks

1. **Storage Size**: Minimal increase due to additional fields
2. **UI Changes**: Display logic easily adaptable

## Benefits

1. **Contextual Clarity**: Every note has clear subject identification
2. **Better Organization**: Notes naturally group by subject/context
3. **Improved Querying**: Find all notes about specific entities easily
4. **LLM Guidance**: Structure encourages better note-taking behavior
5. **Extensibility**: Tags allow future categorization needs
6. **Analytics**: Can analyze note patterns by subject/context

## Success Metrics

1. **LLM Compliance Rate**: >90% of generated notes include valid subjects
2. **Migration Success**: >95% of legacy notes successfully converted
3. **Query Performance**: <10ms for subject-based lookups
4. **User Satisfaction**: Reduced ambiguous note complaints

## Conclusion

The Structured Note Objects design provides the optimal balance of:

- **Contextual clarity** through explicit subject and context fields
- **Flexibility** via optional tags and context
- **Backward compatibility** by maintaining array structure
- **LLM-friendliness** with clear, structured format
- **Future extensibility** for additional metadata

This approach solves the core problem of ambiguous notes while providing a foundation for more sophisticated memory and knowledge management in the Living Narrative Engine.

## Next Steps

1. Review and approve design
2. Create implementation tickets
3. Begin Phase 1 development
4. Establish testing protocols
5. Plan rollout strategy
