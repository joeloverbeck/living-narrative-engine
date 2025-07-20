# LLM Prompt Enhancement Specification

## Document Information

- **Title**: LLM Prompt Generation Enhancement Specification
- **Version**: 1.0.0
- **Date**: 2025-01-20
- **Author**: Claude Code SuperClaude Framework
- **Status**: Draft

## Executive Summary

This specification defines enhancements to the Living Narrative Engine's LLM prompt generation pipeline to improve readability, reduce XML noise, and ensure complete schema compliance. Three primary areas are addressed: markdown structure for world context, simplified perception log formatting, and updated notes format with subjectType inclusion.

## Problem Statement

### Current Issues

1. **World Context Formatting**: The `<world_context>` section uses plain text formatting that lacks hierarchical structure and visual clarity
2. **Perception Log Verbosity**: Individual `<entry>` XML tags create unnecessary noise without clear benefits
3. **Notes Schema Mismatch**: Final instructions show outdated notes format missing the recently added `subjectType` field

### Impact Analysis

- **LLM Performance**: Poor structure may reduce LLM comprehension and response quality
- **Token Efficiency**: Unnecessary XML tags consume tokens without adding value
- **Schema Compliance**: Missing subjectType leads to incomplete note generation
- **Developer Experience**: Complex formatting makes prompt debugging difficult

## Current State Analysis

### World Context Section

**Current Format** (from `prompt.txt` lines 45-63):
```
<world_context>
CURRENT SITUATION
Location: outside tables of the coffee shop The Gilded Bean.
Description: The stone-paved terrace of a café with a great view...

Exits from your current location:
- into the coffee shop leads to The Gilded Bean.

Other characters present in this location (you cannot speak as them):
- Iker Aguirre - Description: Hair: medium, brown, straight
Eyes: brown, round
Torso: muscular
...
</world_context>
```

**Issues**:
- No hierarchical structure for scanning
- Character descriptions are flat lists without clear organization
- Location and description mixed in same paragraph
- No visual separation between different information types

### Perception Log Section

**Current Format** (from `prompt.txt` lines 65-78):
```
<perception_log>
<entry type="speech_local">
Iker Aguirre says: "aa"
</entry>
<entry type="character_exit">
Iker Aguirre leaves to go to The Gilded Bean.
</entry>
<entry type="speech_local">
Amaia Castillo says: "I encountered an unexpected issue and will wait for a moment."
</entry>
<entry type="character_enter">
Iker Aguirre arrives from The Gilded Bean.
</entry>
</perception_log>
```

**Issues**:
- Individual `<entry>` tags create XML noise
- Type attributes may not provide meaningful value to LLMs
- Verbose structure for simple sequential events
- Difficult to scan chronologically

### Notes Format Section

**Current Format** (from `prompt.txt` lines 99-118):
```
- Example format:
  {
    "text": "Seems nervous about the council meeting",
    "subject": "John",
    "context": "tavern conversation",
    "tags": ["emotion", "politics"]
  }
```

**Issues**:
- Missing `subjectType` field from notes.component.json schema
- LLM won't know to include subject categorization
- Incomplete schema representation leads to malformed notes

## Proposed Enhancements

### Enhancement 1: Markdown-Structured World Context

#### Design Principles
- **Hierarchical Organization**: Use markdown headers for clear section structure
- **Scannable Format**: Enable quick information location
- **Visual Hierarchy**: Distinguish between location, character, and action information
- **Consistent Structure**: Standardize character and location formatting

#### Proposed Format
```markdown
<world_context>
## Current Situation

### Location
outside tables of the coffee shop The Gilded Bean.

### Description
The stone-paved terrace of a café with a great view of the La Concha Bay. The café is named The Gilded Bean. The warm glow of hanging bulbs and brass-sconced lanterns spill from beneath a red scalloped awning to dance across wrought-iron tables topped with steaming cups of coffee and half-empty glasses of wine; behind you, the café's wooden door and tall windows reveal flickering candlelight and the soft murmur of conversation within, while ahead the bay reflects a mountain crowned by a lone spire.

## Exits from Current Location
- **into the coffee shop** leads to The Gilded Bean

## Other Characters Present

### Iker Aguirre
- **Hair**: medium, brown, straight
- **Eyes**: brown, round
- **Torso**: muscular
- **Arms**: muscular
- **Legs**: muscular
- **Ass cheek**: round
- **Pubic hair**: curly
- **Penis**: medium
- **Wearing**: indigo, rugged, denim denim trucker jacket | deep-navy, smooth, cotton fitted boxer briefs | gray, rib-knit, cotton socks | white, smooth, leather sneakers | white, smooth, cotton crew-neck T-shirt, and sand-beige, smooth, cotton slim-tapered chinos.
</world_context>
```

#### Benefits
- **Improved Readability**: Clear section headers enable quick navigation
- **Better LLM Comprehension**: Structured format aligns with LLM training patterns
- **Easier Debugging**: Developers can quickly identify content sections
- **Scalable Format**: Structure adapts well to multiple characters/locations

### Enhancement 2: Simplified Perception Log

#### Design Principles
- **Minimal Noise**: Remove unnecessary XML structure
- **Chronological Clarity**: Present events in clear sequential order
- **Content Focus**: Emphasize the actual events over metadata
- **Token Efficiency**: Reduce XML overhead

#### Proposed Format
```
<perception_log>
Iker Aguirre says: "aa"
Iker Aguirre leaves to go to The Gilded Bean.
Amaia Castillo says: "I encountered an unexpected issue and will wait for a moment."
Iker Aguirre arrives from The Gilded Bean.
</perception_log>
```

#### Alternative (Enhanced) Format
If type information proves valuable, consider:
```
<perception_log>
[SPEECH] Iker Aguirre says: "aa"
[EXIT] Iker Aguirre leaves to go to The Gilded Bean.
[SPEECH] Amaia Castillo says: "I encountered an unexpected issue and will wait for a moment."
[ENTER] Iker Aguirre arrives from The Gilded Bean.
</perception_log>
```

#### Benefits
- **Reduced Token Usage**: Eliminate 8+ XML tags per entry
- **Improved Readability**: Focus on content rather than structure
- **Simpler Processing**: Easier to parse and understand
- **Better Flow**: Events read naturally in chronological order

### Enhancement 3: Complete Notes Format

#### Design Principles
- **Schema Compliance**: Include all required fields from notes.component.json
- **Clear Examples**: Provide complete, valid examples
- **Type Guidance**: Help LLM understand subject categorization
- **Backward Compatibility**: Maintain existing field structure

#### Proposed Format
```
NOTES RULES
- Only record brand-new, critical facts (locations, allies, threats, etc.) that may determine your survival, well-being, or prosperity.
- No internal musings, only hard data.
- Each note MUST identify its subject (who/what the note is about)
- Each note MUST include a subjectType from: character, location, item, creature, event, concept, relationship, organization, quest, skill, emotion, other
- Include context when relevant (where/when observed)
- Use tags for categorization (e.g., "combat", "relationship", "location")
- Example format:
  {
    "text": "Seems nervous about the council meeting",
    "subject": "John",
    "subjectType": "character",
    "context": "tavern conversation",
    "tags": ["emotion", "politics"]
  }
- Another example:
  {
    "text": "Guards doubled at the north gate",
    "subject": "City defenses",
    "subjectType": "location",
    "context": "morning patrol",
    "tags": ["security", "observation"]
  }
- Subject type example:
  {
    "text": "Discovered new spell for healing wounds",
    "subject": "Healing Magic",
    "subjectType": "skill",
    "context": "library research",
    "tags": ["magic", "learning"]
  }
```

#### Benefits
- **Complete Schema**: Includes all required fields from component definition
- **Better Categorization**: LLM will generate properly categorized notes
- **Multiple Examples**: Shows variety of subjectType usage
- **Clear Requirements**: Explicit guidance on required vs. optional fields

## Technical Implementation

### Component Mapping

#### Primary Components to Modify

1. **AIPromptContentProvider.js** (`src/prompting/AIPromptContentProvider.js`)
   - **Responsibility**: Generates world_context content
   - **Changes**: Add markdown formatting for location, exits, and characters
   - **Method**: `_buildWorldContext()` or similar

2. **PromptDataFormatter.js** (`src/prompting/promptDataFormatter.js`)
   - **Responsibility**: Formats complex data structures for templates
   - **Changes**: Simplify perception log formatting, remove entry tags
   - **Method**: `_formatPerceptionLog()` or similar

3. **PromptStaticContentService.js** (`src/prompting/promptStaticContentService.js`)
   - **Responsibility**: Provides static text content including final instructions
   - **Changes**: Update notes format examples to include subjectType
   - **Method**: Static content loading or template text

#### Supporting Components

4. **PerceptionLogFormatter.js** (`src/formatting/perceptionLogFormatter.js`)
   - **Changes**: Remove entry tag generation
   - **Simplification**: Return plain text arrays instead of XML structures

5. **CharacterPromptTemplate.js** (`src/prompting/templates/characterPromptTemplate.js`)
   - **Changes**: May need template adjustments if world_context formatting changes significantly

### Implementation Strategy

#### Phase 1: World Context Enhancement
1. **Analysis**: Review `AIPromptContentProvider._buildWorldContext()`
2. **Markdown Integration**: Add markdown formatting helper functions
3. **Template Updates**: Modify world context generation to use structured markdown
4. **Testing**: Verify output format matches specification

#### Phase 2: Perception Log Simplification  
1. **Analysis**: Review `PromptDataFormatter._formatPerceptionLog()`
2. **Simplification**: Remove XML entry tag generation
3. **Format Change**: Return simple line-by-line format
4. **Testing**: Ensure chronological order preservation

#### Phase 3: Notes Format Update
1. **Analysis**: Review static content loading in `PromptStaticContentService`
2. **Content Update**: Update final instructions text with complete notes format
3. **Examples**: Add multiple examples showing different subjectTypes
4. **Validation**: Cross-reference with notes.component.json schema

### Data Flow Impact

#### Current Flow
```
AIPromptContentProvider.getPromptData()
├── _buildWorldContext() → Plain text format
├── PerceptionLogFormatter.format() → XML entries
└── PromptDataFormatter.formatPromptData() → XML structures

PromptStaticContentService.getFinalInstructions() → Outdated notes format

PromptBuilder.build() → Template substitution
```

#### Enhanced Flow
```
AIPromptContentProvider.getPromptData()
├── _buildWorldContext() → Markdown structured format
├── PerceptionLogFormatter.format() → Plain text entries  
└── PromptDataFormatter.formatPromptData() → Simplified structures

PromptStaticContentService.getFinalInstructions() → Complete notes format with subjectType

PromptBuilder.build() → Template substitution
```

## Testing Strategy

### Unit Tests

#### New Test Requirements
1. **World Context Formatting Tests**
   ```javascript
   describe('AIPromptContentProvider - World Context Markdown', () => {
     test('should format location with markdown headers', () => {
       // Test markdown structure generation
     });
     
     test('should format characters with bullet points', () => {
       // Test character attribute formatting
     });
   });
   ```

2. **Perception Log Simplification Tests**
   ```javascript
   describe('PromptDataFormatter - Simplified Perception Log', () => {
     test('should format perception entries without XML tags', () => {
       // Test entry tag removal
     });
     
     test('should preserve chronological order', () => {
       // Test sequence preservation
     });
   });
   ```

3. **Notes Format Tests**
   ```javascript
   describe('PromptStaticContentService - Notes Format', () => {
     test('should include subjectType in example format', () => {
       // Test updated examples include subjectType
     });
     
     test('should provide multiple subjectType examples', () => {
       // Test variety of examples
     });
   });
   ```

### Integration Tests

#### E2E Test Updates
1. **Update `PromptGenerationPipeline.e2e.test.js`**
   - Modify assertions to expect markdown structure in world_context
   - Update perception log parsing to handle simplified format
   - Add tests for notes format compliance

2. **New Assertion Helpers**
   ```javascript
   // Test helper for markdown structure validation
   function validateMarkdownStructure(worldContext) {
     expect(worldContext).toContain('## Current Situation');
     expect(worldContext).toContain('### Location');
     expect(worldContext).toContain('### Description');
   }
   
   // Test helper for simplified perception log
   function validateSimplifiedPerceptionLog(perceptionLog) {
     expect(perceptionLog).not.toContain('<entry');
     expect(perceptionLog).not.toContain('type=');
   }
   ```

### Quality Assurance

#### LLM Output Testing
1. **Format Compliance Testing**
   - Generate prompts with new format
   - Verify LLM produces expected note structures with subjectType
   - Compare response quality before/after changes

2. **Token Usage Analysis**
   - Measure token reduction from simplified perception log
   - Analyze token impact of markdown structure (likely minimal increase)
   - Verify overall token efficiency improvement

3. **Readability Assessment**
   - Manual review of generated prompts
   - Developer feedback on debugging experience
   - LLM comprehension validation

## Migration Strategy

### Backward Compatibility

#### Gradual Migration Approach
1. **Feature Flagging**: Implement feature flags for each enhancement
2. **A/B Testing**: Compare old vs. new formats in parallel
3. **Fallback Mechanisms**: Maintain old format generators as fallbacks

#### Migration Steps
1. **Phase 1**: Deploy world context enhancement with feature flag
2. **Phase 2**: Deploy perception log simplification with feature flag  
3. **Phase 3**: Deploy notes format update with feature flag
4. **Phase 4**: Enable all features by default after validation
5. **Phase 5**: Remove old format generators after stable operation

### Risk Mitigation

#### Potential Risks
1. **LLM Behavior Changes**: New format may affect AI character responses
2. **Parser Compatibility**: Downstream systems may expect current format
3. **Performance Impact**: Markdown processing may add computational overhead

#### Mitigation Strategies
1. **Extensive Testing**: Comprehensive test coverage before deployment
2. **Gradual Rollout**: Feature flag controlled deployment
3. **Monitoring**: Track LLM output quality metrics
4. **Quick Rollback**: Maintain ability to instantly revert changes

## Success Metrics

### Quantitative Metrics
- **Token Efficiency**: 5-10% reduction in perception log tokens
- **Format Compliance**: 100% of generated notes include subjectType
- **Test Coverage**: Maintain >80% test coverage across modified components
- **Performance**: No measurable decrease in prompt generation speed

### Qualitative Metrics
- **Developer Experience**: Improved prompt debugging and readability
- **LLM Output Quality**: Maintained or improved AI character responses
- **Schema Compliance**: Complete alignment with notes.component.json
- **Maintainability**: Cleaner, more maintainable formatting code

## Future Considerations

### Potential Extensions
1. **Dynamic Markdown**: Conditional markdown complexity based on content volume
2. **Format Customization**: Per-character or per-game format preferences
3. **Internationalization**: Language-specific formatting considerations
4. **Template Evolution**: More sophisticated template systems

### Monitoring Requirements
1. **LLM Response Quality**: Track character consistency and prompt adherence
2. **Token Usage**: Monitor total prompt token consumption
3. **Error Rates**: Watch for format-related parsing errors
4. **Performance**: Track prompt generation timing

## Conclusion

These enhancements will significantly improve the Living Narrative Engine's LLM prompt generation by providing better structure, reducing noise, and ensuring complete schema compliance. The proposed changes maintain backward compatibility while offering substantial improvements to both developer experience and LLM performance.

The implementation should follow the phased approach with comprehensive testing to ensure quality and reliability throughout the migration process.