# Core Motivations Generator - Technical Specification

## Implementation Status

**Status**: NOT IMPLEMENTED  
**Type**: NEW FEATURE SPECIFICATION  
**Database Impact**: Will require migration to DB_VERSION 3  
**Current Production State**:

- Database is at version 2 (includes clichés)
- No Core Motivations code exists yet
- No event definitions created
- No schema files created
- No HTML page or UI components exist
- CharacterBuilderService has no motivation-related methods

This specification describes a completely new feature to be built from scratch.

## 1. Feature Overview

### 1.1 Purpose

The Core Motivations Generator is a new Character Builder feature that generates powerful core motivations, internal contradictions, and central questions for characters based on existing thematic directions and clichés. This feature helps writers create psychologically complex and narratively compelling characters by establishing their psychological and narrative core.

### 1.2 Core Functionality

- Generate 3-5 motivation blocks per generation request
- Each block contains: core motivation, contradiction/conflict, and central question
- Accumulative storage (multiple generations per direction)
- Integration with existing thematic directions and clichés
- Direct database interaction following the cliché pattern

### 1.3 Key Differentiators

- **Accumulative Generation**: Unlike clichés (replaced on regeneration), motivations accumulate
- **Many-to-One Relationship**: Multiple motivation records per direction (non-unique index)
- **Filtered Selection**: Only directions with associated clichés are eligible
- **Content Guidelines**: NC-21 rating with no content restrictions (adults-only app)

## 2. Architecture & Design

### 2.1 System Architecture

```
Core Motivations Generator
├── Presentation Layer (HTML/CSS)
│   ├── core-motivations-generator.html
│   └── css/core-motivations-generator.css
├── Application Layer (JavaScript)
│   ├── Entry Point: core-motivations-generator-main.js
│   ├── Controller: CoreMotivationsGeneratorController.js
│   ├── Services: CoreMotivationsGenerator.js
│   └── Display: CoreMotivationsDisplayEnhancer.js
├── Domain Layer
│   ├── Model: coreMotivation.js
│   └── Prompt: coreMotivationsGenerationPrompt.js
├── Data Layer
│   ├── Database: characterDatabase.js (extended)
│   └── Service: characterBuilderService.js (extended)
└── Infrastructure
    ├── Events: core motivation event definitions
    └── Schema: coreMotivation.schema.json
```

### 2.2 Data Model

#### Core Motivation Entity

```javascript
{
  id: string,              // UUID
  directionId: string,     // Reference to thematic direction
  conceptId: string,       // Reference to character concept
  motivationBlock: {
    coreMotivation: string,    // What deeply drives the character
    contradiction: string,      // Internal contradiction OR external conflict
    centralQuestion: string     // Philosophical/narrative question
  },
  createdAt: string,       // ISO timestamp
  llmMetadata: {           // LLM generation metadata
    model: string,
    temperature: number,
    promptTokens: number,
    completionTokens: number,
    generationTime: number
  }
}
```

### 2.3 Database Schema

#### IndexedDB Object Store

```javascript
// Object Store: coreMotivations
// Requires DB_VERSION upgrade from 2 to 3
// Current production: DB_VERSION = 2 (with clichés)
// After implementation: DB_VERSION = 3 (adds coreMotivations)
{
  keyPath: 'id',
  indexes: [
    {
      name: 'by-direction',
      keyPath: 'directionId',
      unique: false  // IMPORTANT: Non-unique for many-to-one relationship
    },
    {
      name: 'by-concept',
      keyPath: 'conceptId',
      unique: false
    }
  ]
}
```

### 2.4 Storage Pattern

**Validated Pattern** (confirmed via codebase analysis):

- Follow cliché implementation pattern: direct database interaction ✓
- NO CharacterStorageService involvement (consistent with current clichés implementation) ✓
- CharacterBuilderService methods call CharacterDatabase directly ✓
- Support accumulative storage (multiple records per direction - KEY DIFFERENCE from clichés)

## 3. Implementation Requirements

### 3.1 User Interface Requirements

#### Page Layout

- **Header**: Title "Core Motivations Generator" with description
- **Left Panel**: Direction selector (filtered to show only directions with clichés)
- **Right Panel**: Generated motivations display (scrollable, accumulative)
- **Footer**: Navigation controls and action buttons

#### UI Components

1. **Direction Selector**
   - Dropdown/list of eligible directions
   - Shows direction title and theme
   - Disabled state for directions without clichés
   - "No eligible directions" message when empty

2. **Motivations Display**
   - Card-based layout for each motivation block
   - Visual separation between blocks
   - Timestamp and generation metadata
   - Individual block controls (copy, delete)

3. **Action Controls**
   - Generate button (primary action)
   - Clear All button (with confirmation)
   - Export to Text button
   - Back to Character Builder button

#### Interactive Features

- Copy individual motivation blocks to clipboard
- Delete individual motivation blocks
- Keyboard shortcuts (Ctrl+Enter to generate)
- Loading states with progress indication
- Success/error notifications

### 3.2 Functional Requirements

#### Generation Process

1. User selects thematic direction (must have clichés)
2. System retrieves:
   - Original character concept
   - Complete thematic direction data
   - All associated clichés (formatted for export)
3. System constructs prompt with all data
4. LLM generates 3-5 motivation blocks
5. Response validated against schema
6. Motivations stored cumulatively in database
7. UI updates to show new motivations

#### Prompt Construction

```
Based on the refined concept: [FULL CHARACTER CONCEPT TEXT]

Based on the thematic direction: [COMPLETE DIRECTION WITH ALL SECTIONS]

Keeping in mind the following list of clichés and tropes to avoid:
[ALL ASSOCIATED CLICHÉS IN EXPORT FORMAT]

[CONTENT GUIDELINES - VERBATIM FROM CLICHÉ PROMPT]

Brainstorm 3-5 powerful and potentially unconventional core motivations for this character.
What deeply drives them?

For each motivation, suggest one significant internal contradiction or an external
conflict/dilemma that makes them complex and less predictable.

Formulate a 'Central Question' that the character grapples with throughout their journey.

Goal: To establish the character's psychological and narrative core.
```

#### Data Management

- **Create**: Add new motivation blocks (3-5 per generation)
- **Read**: Retrieve all motivations for a direction
- **Delete**: Remove individual motivation blocks
- **Export**: Generate text format of all motivations
- **Clear**: Remove all motivations (with confirmation)

### 3.3 Non-Functional Requirements

#### Performance

- Generation response time: <10 seconds
- UI responsiveness: <100ms for interactions
- Smooth scrolling for large collections
- Efficient database queries with indexing
- Caching strategy:
  - Concepts: 10 minutes
  - Directions: 10 minutes
  - Clichés: 30 minutes
  - Motivations: Session duration

#### Security

- Input sanitization for all user content
- XSS prevention (use DOM methods, not innerHTML)
- No sensitive data in IndexedDB
- Schema validation for all LLM responses
- Content filtering for inappropriate responses

#### Accessibility

- ARIA labels for all interactive elements
- Full keyboard navigation support
- Screen reader compatibility
- Semantic HTML structure
- WCAG AA color contrast compliance
- Focus management and indicators

#### Error Handling

- Network errors: Retry with exponential backoff
- Validation errors: Specific error messages
- Storage errors: Fallback to session storage
- LLM errors: User-friendly messages
- Recovery mechanisms for all failure modes

## 4. Event System Integration

### 4.1 Event Definitions

All events must be registered in `/data/mods/core/events/`

#### core_motivations_generation_started.event.json

```json
{
  "id": "core:core_motivations_generation_started",
  "description": "Dispatched when core motivations generation begins",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "conceptId": { "type": "string" },
      "directionId": { "type": "string" },
      "directionTitle": { "type": "string" }
    },
    "required": ["conceptId", "directionId"],
    "additionalProperties": false
  }
}
```

#### core_motivations_generation_completed.event.json

```json
{
  "id": "core:core_motivations_generation_completed",
  "description": "Dispatched when core motivations are successfully generated",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "conceptId": { "type": "string" },
      "directionId": { "type": "string" },
      "motivationId": { "type": "string" },
      "totalCount": { "type": "number" },
      "generationTime": { "type": "number" }
    },
    "required": ["conceptId", "directionId"],
    "additionalProperties": false
  }
}
```

#### core_motivations_generation_failed.event.json

```json
{
  "id": "core:core_motivations_generation_failed",
  "description": "Dispatched when core motivations generation fails",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "conceptId": { "type": "string" },
      "directionId": { "type": "string" },
      "error": { "type": "string" },
      "retryAttempt": { "type": "number" }
    },
    "required": ["conceptId", "directionId", "error"],
    "additionalProperties": false
  }
}
```

#### core_motivations_stored.event.json

```json
{
  "id": "core:core_motivations_stored",
  "description": "Dispatched when core motivations are saved to storage",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "directionId": { "type": "string" },
      "motivationId": { "type": "string" },
      "count": { "type": "number" }
    },
    "required": ["directionId", "motivationId"],
    "additionalProperties": false
  }
}
```

#### core_motivations_deleted.event.json

```json
{
  "id": "core:core_motivations_deleted",
  "description": "Dispatched when a core motivation block is deleted",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "directionId": { "type": "string" },
      "motivationId": { "type": "string" },
      "remainingCount": { "type": "number" }
    },
    "required": ["directionId", "motivationId"],
    "additionalProperties": false
  }
}
```

#### core_motivations_retrieved.event.json

```json
{
  "id": "core:core_motivations_retrieved",
  "description": "Dispatched when core motivations are loaded from storage",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "directionId": { "type": "string" },
      "count": { "type": "number" }
    },
    "required": ["directionId", "count"],
    "additionalProperties": false
  }
}
```

## 5. API Specifications

### 5.1 CharacterBuilderService Extensions

**Current State**: CharacterBuilderService has methods for concepts, directions, and clichés. No motivation-related methods exist.  
**Required Changes**: Add the following new methods for core motivations functionality.

```javascript
class CharacterBuilderService {
  // Generate new core motivations for a direction
  async generateCoreMotivationsForDirection(conceptId, directionId, cliches) {
    // Returns: Array of motivation objects
  }

  // Retrieve all motivations for a direction
  async getCoreMotivationsByDirectionId(directionId) {
    // Returns: Array of motivation objects (sorted by createdAt)
  }

  // Check if direction has motivations
  async hasCoreMotivationsForDirection(directionId) {
    // Returns: boolean
  }

  // Save core motivations (accumulative)
  async saveCoreMotivations(directionId, motivations) {
    // Returns: Array of saved motivation IDs
  }

  // Remove individual motivation
  async removeCoreMotivationItem(directionId, motivationId) {
    // Returns: boolean success
  }

  // Clear all motivations for a direction
  async clearCoreMotivationsForDirection(directionId) {
    // Returns: number of deleted items
  }
}
```

### 5.2 CharacterDatabase Extensions

**Current State**: CharacterDatabase is at version 2 with methods for concepts, directions, and clichés.  
**Required Changes**: Add version 3 migration and new methods for core motivations.

```javascript
class CharacterDatabase {
  // Create core motivations object store
  // This method will be called during version 2 → 3 migration
  _createCoreMotivationsStore(db) {
    // DB_VERSION 3 migration
  }

  // Save a single motivation
  async saveCoreMotivation(motivation) {
    // Returns: saved motivation with ID
  }

  // Get all motivations for a direction
  async getCoreMotivationsByDirectionId(directionId) {
    // Returns: Array of motivations
  }

  // Get single motivation by ID
  async getCoreMotivationById(motivationId) {
    // Returns: motivation object or null
  }

  // Delete a motivation
  async deleteCoreMotivation(motivationId) {
    // Returns: boolean success
  }

  // Update a motivation
  async updateCoreMotivation(motivationId, data) {
    // Returns: updated motivation
  }

  // Delete all motivations for a direction
  async deleteAllCoreMotivationsForDirection(directionId) {
    // Returns: number deleted
  }
}
```

## 6. Testing Requirements

### 6.1 Unit Tests

#### Model Tests (`tests/unit/characterBuilder/models/coreMotivation.test.js`)

- Validation of motivation structure
- ID generation and uniqueness
- Timestamp formatting
- Metadata validation

#### Prompt Tests (`tests/unit/characterBuilder/prompts/coreMotivationsGenerationPrompt.test.js`)

- Prompt construction with all inputs
- Content guidelines inclusion
- Cliché formatting
- Response validation logic

#### Service Tests (`tests/unit/characterBuilder/services/CoreMotivationsGenerator.test.js`)

- LLM communication
- Response parsing
- Error handling
- Retry logic

#### Controller Tests (`tests/unit/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.test.js`)

- Direction filtering
- State management
- Event dispatching
- Error recovery

### 6.2 Integration Tests

#### Database Integration (`tests/integration/characterBuilder/coreMotivationsDatabase.test.js`)

- Object store creation
- Index functionality
- CRUD operations
- Transaction handling
- Many-to-one relationships

#### Service Integration (`tests/integration/characterBuilder/coreMotivationsService.test.js`)

- End-to-end generation flow
- Database persistence
- Event dispatching
- Cache management

#### Event System Integration (`tests/integration/coreMotivationsGenerator/eventFlow.test.js`)

- Event dispatching order
- Payload validation
- Event listener execution
- Error event handling

### 6.3 E2E Tests

**Note**: E2E tests for Core Motivations Generator have been removed due to poor design (JSDOM-based instead of real browser testing). Future E2E testing should use Playwright with actual browsers.

For current test coverage, see:

- Unit tests: `tests/unit/coreMotivationsGenerator/`
- Integration tests: `tests/integration/coreMotivationsGenerator/`

#### User Interactions

- Copy functionality
- Delete operations
- Export feature
- Clear all with confirmation
- Keyboard shortcuts

### 6.4 Acceptance Criteria

1. **Direction Filtering**
   - ✓ Only directions with clichés are selectable
   - ✓ Helpful message shown when no eligible directions
   - ✓ Direction details displayed on selection

2. **Generation Process**
   - ✓ Generates 3-5 motivation blocks per request
   - ✓ Each block has all three required components
   - ✓ Content follows NC-21 guidelines
   - ✓ Generation completes within 10 seconds

3. **Storage Management**
   - ✓ Motivations accumulate (not replaced)
   - ✓ Individual blocks can be deleted
   - ✓ All motivations can be cleared with confirmation
   - ✓ Data persists across page refreshes

4. **User Experience**
   - ✓ Loading indicators during generation
   - ✓ Success/error messages displayed
   - ✓ Copy to clipboard works for individual blocks
   - ✓ Export generates formatted text
   - ✓ Keyboard shortcuts functional

5. **Error Handling**
   - ✓ Network errors handled gracefully
   - ✓ Validation errors show specific messages
   - ✓ Retry mechanism for failed generations
   - ✓ Recovery options available

## 7. Implementation Phases

**Note**: All phases represent NEW development - no existing code to modify except for integration points.

### Phase 1: Foundation (2-3 days)

1. Create HTML page and CSS styles (NEW: core-motivations-generator.html)
2. Implement main entry point with bootstrapping (NEW: core-motivations-generator-main.js)
3. Create base controller structure (NEW: CoreMotivationsGeneratorController.js)
4. Add event definitions to mod system (NEW: 6 event definition files)
5. Update index.html with navigation button (MODIFY: add button after clichés)

**Deliverables**: Basic page accessible from index, events registered

### Phase 2: Data Layer (2-3 days)

1. Create coreMotivation model (NEW: src/characterBuilder/models/coreMotivation.js)
2. Extend CharacterDatabase with new object store (MODIFY: add version 3 migration)
3. Implement database migration (MODIFY: DB_VERSION 2 → 3)
4. Extend CharacterBuilderService with new methods (MODIFY: add 6 new methods)
5. Create JSON schema for validation (NEW: data/schemas/coreMotivation.schema.json)

**Deliverables**: Complete data persistence layer with tests

### Phase 3: Generation Logic (3-4 days)

1. Implement prompt generator
2. Create CoreMotivationsGenerator service
3. Add LLM integration
4. Implement response validation
5. Add retry logic and error handling

**Deliverables**: Working generation pipeline with validation

### Phase 4: UI Implementation (3-4 days)

1. Create responsive layout
2. Implement direction filtering logic
3. Add loading and state management
4. Build motivation display components
5. Implement accumulative display

**Deliverables**: Complete UI with all display features

### Phase 5: Enhancement Features (2-3 days)

1. Add copy to clipboard functionality
2. Implement delete operations
3. Create export feature
4. Add keyboard shortcuts
5. Implement "Clear All" with confirmation

**Deliverables**: All interactive features functional

### Phase 6: Testing & Polish (3-4 days)

1. Write comprehensive unit tests
2. Create integration tests
3. Implement E2E tests
4. Fix bugs and edge cases
5. Performance optimization
6. Update documentation

**Deliverables**: Fully tested, production-ready feature

**Total Estimated Time**: 15-20 days

## 8. Dependencies & Constraints

### 8.1 Technical Dependencies

- Character Builder infrastructure (existing)
- LLM proxy server (existing)
- IndexedDB support (browser requirement)
- Event bus system (existing)
- AJV schema validation (existing)

### 8.2 Data Dependencies

- Character concepts must exist
- Thematic directions must be generated
- Clichés must be associated with directions

### 8.3 Constraints

- Browser compatibility: Modern browsers with IndexedDB
- Network requirement: LLM API access
- Content rating: NC-21 (adults only)
- Performance: <10 second generation time

## 9. Security & Privacy Considerations

### 9.1 Data Security

- No sensitive personal data stored
- All storage client-side (IndexedDB)
- No server-side persistence
- LLM requests anonymized

### 9.2 Content Security

- Input sanitization for XSS prevention
- DOM manipulation instead of innerHTML
- Schema validation for all external data
- Content filtering for inappropriate responses

### 9.3 Privacy

- No tracking or analytics
- No data sharing with third parties
- Clear data ownership (user's browser)
- Export functionality for data portability

## 10. Future Enhancements

### 10.1 Near-term (Next Release)

- Batch generation for multiple directions
- Motivation templates and patterns
- Relationship mapping between motivations
- Advanced filtering and search

### 10.2 Long-term (Future Releases)

- AI-powered motivation analysis
- Coherence scoring between motivations
- Integration with story generation
- Collaborative sharing features
- Version history and rollback
- Multi-language support

## 11. Success Metrics

### 11.1 Technical Metrics

- Generation success rate >95%
- Response time <10 seconds
- Zero critical bugs in production
- Test coverage >80%

### 11.2 User Experience Metrics

- Feature adoption rate
- Average motivations generated per session
- User retention after feature use
- Export/share functionality usage

### 11.3 Quality Metrics

- LLM response quality scores
- Validation pass rate
- Error recovery success rate
- Performance consistency

## 12. Risks & Mitigation

### 12.1 Technical Risks

- **Risk**: LLM API unavailability
  - **Mitigation**: Retry logic, graceful degradation, offline mode consideration

- **Risk**: IndexedDB storage limits
  - **Mitigation**: Data cleanup strategies, export reminders, storage monitoring

- **Risk**: Performance degradation with large datasets
  - **Mitigation**: Pagination, lazy loading, efficient indexing

### 12.2 User Experience Risks

- **Risk**: Complex UI overwhelming users
  - **Mitigation**: Progressive disclosure, tooltips, help documentation

- **Risk**: Low-quality LLM responses
  - **Mitigation**: Validation, regeneration options, user editing capabilities

## 13. Documentation Requirements

### 13.1 Technical Documentation

- API documentation for new methods
- Database schema documentation
- Event flow diagrams
- Integration guide

### 13.2 User Documentation

- Feature overview and benefits
- Step-by-step usage guide
- FAQ and troubleshooting
- Best practices for motivation creation

### 13.3 Developer Documentation

- Code architecture overview
- Testing guidelines
- Contribution guide
- Maintenance procedures

## 14. Sign-off Criteria

### 14.1 Development Complete

- [ ] All phases implemented
- [ ] Code review passed
- [ ] Documentation complete
- [ ] Tests passing (>80% coverage)

### 14.2 Quality Assurance

- [ ] Manual testing complete
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Security review complete

### 14.3 Deployment Ready

- [ ] Production build created
- [ ] Deployment checklist complete
- [ ] Rollback plan documented
- [ ] Monitoring configured

---

**Document Version**: 1.1.0  
**Created**: 2024  
**Last Updated**: 2025-08-17 (Added implementation status clarifications)  
**Status**: APPROVED FOR IMPLEMENTATION  
**Implementation Status**: NOT STARTED  
**Owner**: Character Builder Team  
**Review Date**: Quarterly

_This specification represents the complete requirements and implementation guidelines for the Core Motivations Generator feature. Implementation should follow this specification exactly, with any deviations requiring approval and documentation updates._
