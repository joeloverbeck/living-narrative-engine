# Core Motivations Generator - Implementation Report

## Executive Summary

This report outlines the technical implementation plan for the Core Motivations Generator feature, a new Character Builder page that will allow users to generate powerful core motivations, internal contradictions, and central questions for their characters based on existing thematic directions and clichés.

## Architecture Overview

The Core Motivations Generator will follow the established Character Builder architecture pattern used by existing pages like `cliches-generator.html` and `thematic-direction-generator.html`. It will:

1. Integrate with the existing Character Builder ecosystem
2. Reuse common components and services
3. Store data using IndexedDB through direct database access (following cliché pattern)
4. Dispatch events through the central EventBus system
5. Use the LLM proxy server for AI generation

### Important Architectural Clarifications

Based on code analysis, the following patterns should be followed:

1. **Storage Pattern**: Core motivations should interact directly with CharacterDatabase, NOT through CharacterStorageService (following the cliché implementation pattern)
2. **Database Schema**: Unlike clichés (one-to-one with unique index), core motivations need many-to-one relationship (non-unique index on directionId)
3. **Service Methods**: Add methods to CharacterBuilderService that directly call database methods
4. **Controller Base**: Extend BaseCharacterBuilderController for consistent behavior
5. **Event System**: Follow existing event patterns with proper payload schemas

## Files to Be Modified

### 1. **index.html**

- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/index.html`
- **Modifications**:
  - Add a new button after the "Clichés Generator" button (after line 52-53)
  - Add corresponding JavaScript event listener for navigation
  - Button text: "Core Motivations Generator"
  - Target URL: `core-motivations-generator.html`

### 2. **src/characterBuilder/services/characterBuilderService.js**

- **Purpose**: Extend the service to handle core motivations
- **Note**: Following the existing cliché pattern, methods will interact directly with the database, not through CharacterStorageService
- **New Methods**:
  - `generateCoreMotivationsForDirection(concept, direction, cliches)`
  - `getCoreMotivationsByDirectionId(directionId)`
  - `hasCoreMotivationsForDirection(directionId)`
  - `saveCoreMotivations(directionId, motivations)`
  - `removeCoreMotivationItem(directionId, motivationId)`

### 3. **src/characterBuilder/services/characterStorageService.js**

- **Note**: Currently does NOT handle cliché storage - clichés are handled directly through CharacterDatabase
- **Decision**: Core motivations should follow the same pattern as clichés for consistency
- **No modifications needed** - core motivations will be handled directly through database like clichés

### 4. **src/characterBuilder/storage/characterDatabase.js**

- **Purpose**: Add IndexedDB schema for core motivations
- **Modifications**:
  - Add new object store: `coreMotivations` in DB_VERSION 3
  - Add **NON-UNIQUE** index on `directionId` for efficient queries (unlike clichés which has unique index)
  - Important: Must support many-to-one relationship for accumulative storage
  - Add methods following cliché pattern:
    - `saveCoreMotivation(motivation)`
    - `getCoreMotivationsByDirectionId(directionId)` - returns array
    - `getCoreMotivationById(motivationId)` - returns single motivation
    - `deleteCoreMotivation(motivationId)`
    - `updateCoreMotivation(motivationId, data)`

### 5. **data/schemas/**

- **Purpose**: Add JSON schema for core motivations validation
- **Note**: No characterBuilder.schema.json exists - schemas are in `/data/schemas/` directory
- **New File Needed**: `coreMotivation.schema.json` following the pattern of `cliche.schema.json`

## New Files to Be Created

### HTML & Entry Points

#### 1. **core-motivations-generator.html**

- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/core-motivations-generator.html`
- **Structure**: Similar to `cliches-generator.html`
- **Key Sections**:
  - Header with title and description
  - Left panel: Direction selector (filtered to only show directions with clichés)
  - Right panel: Generated motivations display
  - Footer with navigation

#### 2. **src/core-motivations-generator-main.js**

- **Purpose**: Entry point for the page
- **Pattern**: Follows `cliches-generator-main.js` structure
- **Responsibilities**:
  - Bootstrap the application
  - Configure with `includeModLoading: true`
  - Register custom schemas
  - Set up cleanup handlers

### Controllers

#### 3. **src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js**

- **Extends**: `BaseCharacterBuilderController`
- **Key Features**:
  - Direction selection (filtered to those with clichés)
  - Multiple generation support (accumulative, not replacement)
  - State management and caching
  - Event dispatching
  - Error handling with retry logic

### Models

#### 4. **src/characterBuilder/models/coreMotivation.js**

- **Structure**:

```javascript
{
  id: string (UUID),
  directionId: string,
  conceptId: string,
  motivationBlock: {
    coreMotivation: string,
    contradiction: string,
    centralQuestion: string
  },
  createdAt: string (ISO timestamp),
  llmMetadata: object
}
```

### Prompts

#### 5. **src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js**

- **Purpose**: Build LLM prompts for motivation generation
- **Key Functions**:
  - `buildCoreMotivationsPrompt(concept, direction, cliches)`
  - `validateCoreMotivationsResponse(response)`
  - Include content guidelines section (verbatim from cliché prompt)

### Services

#### 6. **src/characterBuilder/services/CoreMotivationsGenerator.js**

- **Purpose**: Handle LLM communication for motivation generation
- **Dependencies**: LLM service, logger, schema validator
- **Key Methods**:
  - `generateMotivations(concept, direction, cliches)`
  - `validateResponse(response)`
  - `formatForDisplay(motivations)`

#### 7. **src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js**

- **Purpose**: Enhance display with interactive features
- **Features**:
  - Copy buttons for each motivation block
  - Delete functionality for individual blocks
  - Export to text functionality
  - Collapsible sections

### Styles

#### 8. **css/core-motivations-generator.css**

- **Purpose**: Page-specific styles
- **Pattern**: Follow existing character builder page styles
- **Key Classes**:
  - `.motivation-block`
  - `.motivation-item`
  - `.contradiction-item`
  - `.central-question`
  - `.motivation-controls`

## Event Definitions to Add

Location: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/core/events/`

### 9. **core_motivations_generation_started.event.json**

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
    "required": ["conceptId", "directionId"]
  }
}
```

### 10. **core_motivations_generation_completed.event.json**

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
    "required": ["conceptId", "directionId"]
  }
}
```

### 11. **core_motivations_generation_failed.event.json**

```json
{
  "id": "core:core_motivations_generation_failed",
  "description": "Dispatched when core motivations generation fails",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "conceptId": { "type": "string" },
      "directionId": { "type": "string" },
      "error": { "type": "string" }
    },
    "required": ["conceptId", "directionId", "error"]
  }
}
```

### 12. **core_motivations_stored.event.json**

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
    "required": ["directionId"]
  }
}
```

### 13. **core_motivations_deleted.event.json**

```json
{
  "id": "core:core_motivations_deleted",
  "description": "Dispatched when a core motivation block is deleted",
  "payloadSchema": {
    "type": "object",
    "properties": {
      "directionId": { "type": "string" },
      "motivationId": { "type": "string" }
    },
    "required": ["directionId", "motivationId"]
  }
}
```

## Data Flow

### Generation Flow

1. User selects a thematic direction (must have associated clichés)
2. Controller retrieves:
   - Original character concept
   - Thematic direction details
   - Associated clichés
3. Controller builds prompt using all three data sources
4. LLM generates 3-5 motivation blocks
5. Response is validated and stored
6. UI displays new motivations (added to existing ones)

### Storage Strategy

- Core motivations are stored cumulatively (not replaced on regeneration)
- Each generation creates a new set of motivation blocks
- Users can delete individual blocks
- Storage is indexed by directionId for efficient retrieval (NON-UNIQUE index)
- **Key Difference from Clichés**: Clichés have one-to-one relationship with directions (unique index), while core motivations have many-to-one relationship (multiple motivation records per direction)

## Key Implementation Considerations

### 1. Direction Filtering

- Only show directions that have associated clichés
- Use `characterBuilderService.hasClichesForDirection()` to filter
- Display helpful message if no eligible directions exist

### 2. Accumulative Generation

- Unlike clichés (which are replaced), motivations accumulate
- Each generation adds 3-5 new blocks
- Implement pagination or scrolling for large collections
- Consider adding a "Clear All" option with confirmation

### 3. Prompt Construction

The prompt will include:

- Original character concept (full text)
- Complete thematic direction (all sections)
- All associated clichés (formatted as export text)
- Content guidelines (NC-21 rating, no restrictions)
- Instructions for 3-5 motivation blocks

### 4. Response Structure

Each motivation block contains:

- Core Motivation (what deeply drives them)
- Internal Contradiction OR External Conflict
- Central Question (philosophical/narrative question)

### 5. UI/UX Considerations

- Show loading state during generation
- Display success/error messages
- Enable keyboard shortcuts (Ctrl+Enter to generate)
- Implement copy-to-clipboard for individual blocks
- Add export functionality for all motivations
- Responsive design for mobile compatibility

### 6. Error Handling

- Network errors: Retry with exponential backoff
- Validation errors: Show specific error messages
- Storage errors: Fallback to session storage
- LLM errors: Provide user-friendly messages

## Testing Requirements

### Unit Tests

- Model validation tests
- Prompt generation tests
- Response validation tests
- Storage operation tests

### Integration Tests

- Full generation workflow
- Event dispatching verification
- Storage persistence
- Error recovery scenarios

### E2E Tests

- Page navigation
- Direction selection and filtering
- Generation and display
- Delete operations
- Export functionality

## Development Phases

### Phase 1: Foundation (Core Infrastructure)

1. Create HTML page and main entry point
2. Implement basic controller structure
3. Add events to mod system
4. Set up routing from index.html

### Phase 2: Data Layer

1. Create model classes
2. Extend storage service
3. Update database schema
4. Implement caching strategy

### Phase 3: Generation Logic

1. Build prompt generator
2. Implement LLM service integration
3. Add response validation
4. Handle error scenarios

### Phase 4: UI Implementation

1. Create responsive layout
2. Implement direction filtering
3. Add loading states
4. Build motivation display components

### Phase 5: Enhancement Features

1. Add copy/delete functionality
2. Implement export feature
3. Add keyboard shortcuts
4. Optimize performance

### Phase 6: Testing & Polish

1. Write comprehensive tests
2. Fix bugs and edge cases
3. Optimize user experience
4. Update documentation

## Dependencies

### Existing Dependencies

- Character Builder infrastructure
- LLM proxy server
- IndexedDB storage
- Event bus system
- Schema validation

### New Dependencies

None required - all functionality can be built with existing libraries

## Performance Considerations

### Caching Strategy

- Cache concepts for 10 minutes
- Cache directions for 10 minutes
- Cache clichés for 30 minutes
- Cache motivations for session duration

### Optimization Opportunities

- Lazy load motivation blocks (pagination)
- Debounce direction selection
- Batch storage operations
- Use Web Workers for heavy processing

## Security Considerations

1. **Input Sanitization**: All user inputs sanitized before display
2. **XSS Prevention**: Use DOM methods, not innerHTML for user content
3. **Storage Security**: No sensitive data in IndexedDB
4. **API Security**: Validate all LLM responses against schema

## Accessibility Requirements

1. **ARIA Labels**: All interactive elements properly labeled
2. **Keyboard Navigation**: Full keyboard support
3. **Screen Reader**: Semantic HTML and proper announcements
4. **Focus Management**: Logical focus order and visible focus indicators
5. **Color Contrast**: WCAG AA compliance minimum

## Future Enhancements

1. **Batch Operations**: Generate for multiple directions at once
2. **Templates**: Save motivation patterns as templates
3. **Sharing**: Export/import motivation collections
4. **AI Analysis**: Analyze motivation coherence and depth
5. **Relationship Mapping**: Show how motivations connect
6. **Version History**: Track changes to motivations over time

## Conclusion

The Core Motivations Generator will be a valuable addition to the Character Builder suite, providing writers with tools to create psychologically complex and narratively compelling characters. By building on the existing architecture and following established patterns, implementation should be straightforward and maintainable.

The modular design ensures easy testing, debugging, and future enhancements while maintaining consistency with the rest of the application.

## Next Steps

1. Review and approve this implementation plan
2. Create a detailed specification file (`.spec.md`)
3. Begin Phase 1 implementation
4. Set up testing infrastructure
5. Iterate based on user feedback

---

_Document created: 2024_
_Living Narrative Engine - Character Builder System_
