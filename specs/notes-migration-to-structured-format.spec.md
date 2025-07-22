# Notes Component Migration to Structured Format Specification

## Executive Summary

This specification outlines the complete migration strategy for transitioning the Living Narrative Engine from supporting multiple notes formats (string, mixed arrays, structured objects) to a single, unified structured notes format. The migration will eliminate the `notesRaw` property confusion, remove 345+ lines of compatibility code, and establish a consistent data model throughout the system.

### Key Objectives
1. Eliminate all support for plain-text/legacy notes formats
2. Rename all instances of `notesRaw` to `notes` 
3. Establish structured notes as the only supported format
4. Provide migration utilities for existing save files
5. Update all tests to validate only the structured format

### Expected Benefits
- **Code Reduction**: Remove ~500 lines of compatibility/conversion code
- **Performance**: Eliminate runtime format detection overhead
- **Maintainability**: Single format to understand and maintain
- **Consistency**: Unified schema across all components and events
- **Developer Experience**: Clear, unambiguous data model

## Technical Requirements

### Structured Notes Format (Final State)

```typescript
interface Note {
  text: string;         // Required: The note content
  subject: string;      // Required: What/who the note is about
  subjectType: string;  // Required: Enum type of subject
  context?: string;     // Optional: Additional context
  tags?: string[];      // Optional: Categorization tags
  timestamp?: string;   // Optional: ISO 8601 datetime
}

interface NotesComponent {
  notes: Note[];        // Array of structured notes only
}
```

### Subject Type Enumeration
```json
{
  "enum": ["character", "location", "item", "event", "quest", "other"]
}
```

## Implementation Phases

### Phase 1: Schema Updates (Priority: Critical)

#### 1.1 Event Schema Updates

**Files to modify:**
- `data/mods/core/events/display_speech.event.json`
- `data/mods/core/events/entity_spoke.event.json`
- `data/mods/core/events/action_decided.event.json`

**Changes for `display_speech.event.json`:**
```json
// FROM:
{
  "notes": {
    "type": "string",
    "description": "Private notes about the speech"
  }
}

// TO:
{
  "notes": {
    "type": "array",
    "description": "Private notes about the speech",
    "items": {
      "$ref": "#/definitions/structuredNote"
    }
  }
}
```

**Changes for `entity_spoke.event.json`:**
```json
// FROM:
{
  "notes": { "type": "string" },
  "notesRaw": {
    "oneOf": [
      {"type": "array", "items": {...}},
      {"type": "object", "properties": {...}},
      {"type": "string"}
    ]
  }
}

// TO:
{
  "notes": {
    "type": "array",
    "description": "Structured notes from the entity",
    "items": {
      "$ref": "#/definitions/structuredNote"
    }
  }
}
// Remove notesRaw completely
```

**Changes for `action_decided.event.json`:**
```json
// FROM:
{
  "notes": {
    "type": "array",
    "items": {
      "oneOf": [
        {"type": "string"},
        {"type": "object", "properties": {...}}
      ]
    }
  }
}

// TO:
{
  "notes": {
    "type": "array",
    "description": "Structured notes about the action",
    "items": {
      "$ref": "#/definitions/structuredNote"
    }
  }
}
```

**Shared Definition (add to all event schemas):**
```json
{
  "definitions": {
    "structuredNote": {
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
          "description": "What or who the note is about"
        },
        "subjectType": {
          "type": "string",
          "enum": ["character", "location", "item", "event", "quest", "other"],
          "description": "The type of subject"
        },
        "context": {
          "type": "string",
          "description": "Additional context for the note"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Categorization tags"
        },
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "When the note was created"
        }
      },
      "required": ["text", "subject", "subjectType"],
      "additionalProperties": false
    }
  }
}
```

### Phase 2: Core Processing Updates

#### 2.1 Build Speech Payload Updates

**File:** `src/turns/states/helpers/buildSpeechPayload.js`

**Transformation:**
```javascript
// BEFORE:
export function buildSpeechPayload(decisionMeta) {
  const { speech: speechRaw, thoughts: thoughtsRaw, notes: notesRaw } = decisionMeta || {};
  // ... processing ...
  const payload = {
    speechContent: speech,
    ...(thoughts ? { thoughts } : {}),
    ...(notes ? { notes } : {}),        // formatted string
    ...(notesRaw ? { notesRaw } : {}),  // structured data
  };
  return payload;
}

// AFTER:
export function buildSpeechPayload(decisionMeta) {
  const { speech: speechRaw, thoughts: thoughtsRaw, notes } = decisionMeta || {};
  // ... processing ...
  const payload = {
    speechContent: speech,
    ...(thoughts ? { thoughts } : {}),
    ...(notes ? { notes } : {}),  // structured data only
  };
  return payload;
}
```

#### 2.2 Note Formatter Simplification

**File:** `src/turns/states/helpers/noteFormatter.js`

**Transformation:**
```javascript
// BEFORE: Complex multi-format handling
export function formatNotesForDisplay(notes) {
  if (typeof notes === 'string') {
    return isNonBlankString(notes) ? notes.trim() : null;
  }
  if (Array.isArray(notes)) {
    return notes.map(note => {
      if (typeof note === 'string') return note;
      if (note.text) return formatStructuredNote(note);
      return null;
    }).filter(Boolean).join('\n');
  }
  // ... more format handling
}

// AFTER: Structured format only
export function formatNotesForDisplay(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  
  return notes
    .map(note => formatStructuredNote(note))
    .filter(Boolean)
    .join('\n');
}

function formatStructuredNote(note) {
  if (!note || typeof note !== 'object') return null;
  if (!note.text || !note.subject || !note.subjectType) return null;
  
  const parts = [`[${note.subject}]`, note.text];
  if (note.context) parts.push(`(${note.context})`);
  if (note.tags?.length) parts.push(`#${note.tags.join(' #')}`);
  
  return parts.join(' ');
}
```

#### 2.3 Remove Compatibility Service

**Action:** Delete `src/ai/notesCompatibilityService.js` (345 lines)

**Update imports in:**
- `src/ai/notesService.js`
- `src/ai/notesPersistenceHook.js`
- Any other files importing this service

### Phase 3: UI Component Updates

#### 3.1 Build Speech Meta Updates

**File:** `src/domUI/helpers/buildSpeechMeta.js`

**Transformation:**
```javascript
// BEFORE:
export function buildSpeechMeta(document, domFactory, { thoughts, notesRaw }) {
  if (!thoughts && !notesRaw) return null;
  // ... processing ...
  if (notesRaw) {
    const richHtml = formatNotesAsRichHtml(notesRaw);
    // ... create tooltip with richHtml
  }
}

// AFTER:
export function buildSpeechMeta(document, domFactory, { thoughts, notes }) {
  if (!thoughts && !notes) return null;
  // ... processing ...
  if (notes) {
    const richHtml = formatNotesAsRichHtml(notes);
    // ... create tooltip with richHtml
  }
}
```

#### 3.2 Note Tooltip Formatter Updates

**File:** `src/domUI/helpers/noteTooltipFormatter.js`

**Transformation:**
```javascript
// Ensure this function only handles structured notes array
export function formatNotesAsRichHtml(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return '<div class="no-notes">No notes available</div>';
  }
  
  return notes.map(note => formatNoteAsHtml(note)).join('<hr>');
}

function formatNoteAsHtml(note) {
  if (!note || typeof note !== 'object') return '';
  
  const html = [`<div class="note">`];
  html.push(`<div class="note-subject">${escapeHtml(note.subject)}</div>`);
  html.push(`<div class="note-text">${escapeHtml(note.text)}</div>`);
  
  if (note.context) {
    html.push(`<div class="note-context">${escapeHtml(note.context)}</div>`);
  }
  
  if (note.tags?.length) {
    html.push(`<div class="note-tags">`);
    note.tags.forEach(tag => {
      html.push(`<span class="tag">${escapeHtml(tag)}</span>`);
    });
    html.push(`</div>`);
  }
  
  if (note.timestamp) {
    html.push(`<div class="note-timestamp">${formatTimestamp(note.timestamp)}</div>`);
  }
  
  html.push(`</div>`);
  return html.join('');
}
```

### Phase 4: AI System Updates

#### 4.1 Notes Service Updates

**File:** `src/ai/notesService.js`

**Changes:**
- Remove all compatibility service imports
- Remove format detection logic
- Ensure all methods work with structured format only
- Update validation to enforce required fields

#### 4.2 Notes Persistence Hook Updates

**File:** `src/ai/notesPersistenceHook.js`

**Changes:**
- Remove legacy format handling
- Validate structured format on save
- Ensure proper error handling for invalid formats

#### 4.3 Prompt Data Formatter Updates

**File:** `src/prompting/promptDataFormatter.js`

**Transformation:**
```javascript
// BEFORE: Format detection and conversion
function formatNotesForPrompt(notes) {
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) {
    // Complex format detection
  }
  // ...
}

// AFTER: Structured format only
function formatNotesForPrompt(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return 'No notes.';
  
  return notes.map(note => 
    `- [${note.subject}/${note.subjectType}] ${note.text}` +
    (note.context ? ` (Context: ${note.context})` : '') +
    (note.tags?.length ? ` Tags: ${note.tags.join(', ')}` : '')
  ).join('\n');
}
```

### Phase 5: Test Suite Migration

#### 5.1 Event Validation Tests

**Files to update:**
- `tests/unit/events/entitySpokeEventValidation.test.js`
- `tests/unit/events/actionDecidedNotesValidation.test.js`
- `tests/unit/events/displaySpeechEventValidation.test.js`

**Test Pattern Transformation:**
```javascript
// BEFORE: Testing multiple formats
describe('Notes validation', () => {
  it('should validate successfully with notesRaw as string (legacy support)', () => {
    const payload = { notesRaw: 'Legacy string note' };
    expect(validate(payload)).toBe(true);
  });

  it('should validate successfully with mixed array', () => {
    const payload = { 
      notes: ['string', { text: 'object' }] 
    };
    expect(validate(payload)).toBe(true);
  });
});

// AFTER: Testing structured format only
describe('Notes validation', () => {
  it('should validate successfully with structured notes array', () => {
    const payload = { 
      notes: [{
        text: 'Test note',
        subject: 'Test Subject',
        subjectType: 'character'
      }]
    };
    expect(validate(payload)).toBe(true);
  });

  it('should reject notes without required fields', () => {
    const payload = { 
      notes: [{ text: 'Missing required fields' }] 
    };
    expect(validate(payload)).toBe(false);
    expect(validate.errors).toMatchObject([
      { message: expect.stringContaining('required property \'subject\'') }
    ]);
  });

  it('should reject non-array notes', () => {
    const payload = { notes: 'string note' };
    expect(validate(payload)).toBe(false);
  });
});
```

#### 5.2 Test Helper Updates

Create a new test helper for structured notes:

**File:** `tests/common/structuredNotesHelper.js`
```javascript
export function createValidNote(overrides = {}) {
  return {
    text: 'Test note text',
    subject: 'Test Subject',
    subjectType: 'character',
    context: 'Test context',
    tags: ['test'],
    timestamp: '2024-01-01T12:00:00Z',
    ...overrides
  };
}

export function createMinimalNote(text, subject, subjectType = 'other') {
  return { text, subject, subjectType };
}

export function createNotesArray(count = 1, overrides = {}) {
  return Array.from({ length: count }, (_, i) => 
    createValidNote({ 
      text: `Note ${i + 1}`,
      subject: `Subject ${i + 1}`,
      ...overrides 
    })
  );
}
```

### Phase 6: Migration Utilities

#### 6.1 Notes Migration Utility

**File:** `src/utils/notesMigrationUtility.js`
```javascript
/**
 * @file Utility for migrating legacy notes to structured format
 */

import { assertNonBlankString } from './validationUtils.js';
import { v4 as uuidv4 } from 'uuid';

export class NotesMigrationUtility {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Migrates any legacy notes format to structured format
   * @param {string|Array|Object} legacyNotes - Notes in any legacy format
   * @returns {Array<Object>} Structured notes array
   */
  migrateLegacyNotes(legacyNotes) {
    if (!legacyNotes) return [];

    try {
      if (typeof legacyNotes === 'string') {
        return [this.#createStructuredNote(legacyNotes)];
      }

      if (Array.isArray(legacyNotes)) {
        return legacyNotes
          .map(note => this.#migrateNote(note))
          .filter(Boolean);
      }

      if (typeof legacyNotes === 'object') {
        return [this.#migrateNote(legacyNotes)];
      }

      this.#logger.warn('Unknown notes format, skipping migration', { legacyNotes });
      return [];
    } catch (error) {
      this.#logger.error('Failed to migrate notes', error);
      return [];
    }
  }

  #migrateNote(note) {
    if (!note) return null;

    if (typeof note === 'string') {
      return this.#createStructuredNote(note);
    }

    if (typeof note === 'object') {
      // Already structured, just ensure required fields
      return {
        text: note.text || 'Migrated note',
        subject: note.subject || this.#extractSubject(note.text || ''),
        subjectType: note.subjectType || 'other',
        context: note.context || 'migrated from legacy format',
        tags: note.tags || ['legacy-migration'],
        timestamp: note.timestamp || new Date().toISOString()
      };
    }

    return null;
  }

  #createStructuredNote(text) {
    assertNonBlankString(text, 'Note text');
    
    return {
      text: text.trim(),
      subject: this.#extractSubject(text),
      subjectType: 'other',
      context: 'migrated from plain text',
      tags: ['legacy-migration', 'plain-text'],
      timestamp: new Date().toISOString()
    };
  }

  #extractSubject(text) {
    // Simple heuristic: first few words or "Unknown"
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return 'Unknown';
    
    return words.slice(0, 3).join(' ').substring(0, 50);
  }
}

export default NotesMigrationUtility;
```

#### 6.2 Save File Migration

**File:** `src/persistence/saveFileMigration.js`
```javascript
/**
 * @file Save file migration for notes format update
 */

import NotesMigrationUtility from '../utils/notesMigrationUtility.js';

export class SaveFileMigration {
  #migrationUtility;
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
    this.#migrationUtility = new NotesMigrationUtility({ logger });
  }

  /**
   * Migrates a save file to use structured notes format
   * @param {Object} saveData - The save file data
   * @returns {Object} Migrated save data
   */
  migrateSaveFile(saveData) {
    try {
      const migrated = { ...saveData };
      
      // Migrate entity components
      if (migrated.entities) {
        migrated.entities = this.#migrateEntities(migrated.entities);
      }
      
      // Migrate event log
      if (migrated.eventLog) {
        migrated.eventLog = this.#migrateEventLog(migrated.eventLog);
      }
      
      // Update version marker
      migrated.notesFormatVersion = 'structured-v1';
      
      return migrated;
    } catch (error) {
      this.#logger.error('Failed to migrate save file', error);
      throw error;
    }
  }

  #migrateEntities(entities) {
    return entities.map(entity => {
      if (!entity.components?.notes) return entity;
      
      const migratedEntity = { ...entity };
      migratedEntity.components = { ...entity.components };
      migratedEntity.components.notes = {
        ...entity.components.notes,
        notes: this.#migrationUtility.migrateLegacyNotes(
          entity.components.notes.notes
        )
      };
      
      return migratedEntity;
    });
  }

  #migrateEventLog(eventLog) {
    return eventLog.map(event => {
      const migratedEvent = { ...event };
      
      // Migrate notes property
      if (event.payload?.notes) {
        migratedEvent.payload = {
          ...event.payload,
          notes: this.#migrationUtility.migrateLegacyNotes(event.payload.notes)
        };
      }
      
      // Migrate notesRaw to notes
      if (event.payload?.notesRaw) {
        migratedEvent.payload = {
          ...event.payload,
          notes: this.#migrationUtility.migrateLegacyNotes(event.payload.notesRaw)
        };
        delete migratedEvent.payload.notesRaw;
      }
      
      return migratedEvent;
    });
  }

  /**
   * Checks if a save file needs migration
   * @param {Object} saveData - The save file data
   * @returns {boolean} True if migration is needed
   */
  needsMigration(saveData) {
    return !saveData.notesFormatVersion || 
           saveData.notesFormatVersion !== 'structured-v1';
  }
}

export default SaveFileMigration;
```

## Breaking Changes

### API Changes

1. **Event Payloads**
   - `notesRaw` property removed from all events
   - `notes` property now always contains structured array
   - String notes no longer accepted in any event

2. **Component Data**
   - Notes component only accepts structured notes array
   - No automatic conversion from strings

3. **UI Properties**
   - All UI components expect `notes` property (not `notesRaw`)
   - Structured format required for display

### Migration Requirements

1. **Save Files**
   - Automatic migration on load
   - One-time conversion process
   - Version marker added

2. **Mod Compatibility**
   - Mods must update to structured format
   - Provide migration guide for mod authors

3. **Test Updates**
   - All tests must use structured format
   - Legacy format tests removed

## Rollback Strategy

### Phase 1: Detection
- Monitor error rates after deployment
- Check for save file corruption reports
- Track UI rendering issues

### Phase 2: Emergency Rollback
If critical issues arise:
1. Revert schema changes
2. Restore compatibility service
3. Re-enable format detection

### Phase 3: Data Recovery
- Maintain backup of pre-migration saves
- Provide manual migration tool
- Support ticket system for data recovery

## Success Criteria

### Quantitative Metrics
- **Code Reduction**: ≥500 lines removed
- **Test Coverage**: Maintain ≥80% coverage
- **Performance**: 10-20% improvement in note operations
- **Zero Data Loss**: All saves successfully migrated

### Qualitative Metrics
- **Developer Feedback**: Positive response to simplified API
- **User Experience**: No degradation in functionality
- **Mod Community**: Successful adoption of new format

### Testing Validation
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Manual testing of save migration
- Performance benchmarks improved

## Implementation Checklist

### Pre-Implementation
- [ ] Review and approve specification
- [ ] Create feature branch
- [ ] Set up migration testing environment
- [ ] Backup sample save files

### Phase 1: Schema Updates
- [ ] Update display_speech.event.json
- [ ] Update entity_spoke.event.json
- [ ] Update action_decided.event.json
- [ ] Validate schema changes

### Phase 2: Core Processing
- [ ] Update buildSpeechPayload.js
- [ ] Update noteFormatter.js
- [ ] Delete notesCompatibilityService.js
- [ ] Update import statements

### Phase 3: UI Components
- [ ] Update buildSpeechMeta.js
- [ ] Update noteTooltipFormatter.js
- [ ] Update speechBubbleRenderer.js
- [ ] Test UI rendering

### Phase 4: AI System
- [ ] Update notesService.js
- [ ] Update notesPersistenceHook.js
- [ ] Update promptDataFormatter.js
- [ ] Test AI integration

### Phase 5: Test Suite
- [ ] Update event validation tests
- [ ] Update UI component tests
- [ ] Update processing tests
- [ ] Create structured notes helper

### Phase 6: Migration Utilities
- [ ] Create notesMigrationUtility.js
- [ ] Create saveFileMigration.js
- [ ] Test migration on sample data
- [ ] Create migration documentation

### Post-Implementation
- [ ] Update CLAUDE.md
- [ ] Create migration guide for mod authors
- [ ] Performance benchmarking
- [ ] Deploy to staging environment
- [ ] User acceptance testing
- [ ] Production deployment plan

## Risk Mitigation Matrix

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Save file corruption | Low | Critical | Automatic backups, migration validation |
| UI rendering issues | Medium | High | Comprehensive UI testing, fallbacks |
| Mod incompatibility | High | Medium | Migration guide, compatibility warnings |
| Performance regression | Low | Medium | Benchmarking, profiling, optimization |
| Data loss | Low | Critical | Backup strategy, recovery tools |

## Conclusion

This specification provides a comprehensive roadmap for migrating the Living Narrative Engine from multiple notes formats to a single, structured format. The migration will significantly improve code quality, performance, and maintainability while providing a clear upgrade path for existing content and save files.

The phased approach ensures minimal risk while maximizing the benefits of the new architecture. With proper testing and migration utilities, the transition should be smooth for both developers and end users.