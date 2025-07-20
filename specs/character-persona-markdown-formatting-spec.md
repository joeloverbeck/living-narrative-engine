# Character Persona Markdown Formatting Specification

## Document Information

- **Title**: Character Persona Section Markdown Formatting Enhancement
- **Version**: 1.0.0
- **Date**: 2025-01-20
- **Author**: Claude Code SuperClaude Framework
- **Status**: Draft

## Executive Summary

This specification defines a comprehensive enhancement to the `<character_persona>` section formatting in the Living Narrative Engine's LLM prompt generation system. The goal is to implement consistent markdown formatting that matches the improved structure already adopted for other sections like `<world_context>`, making the prompts more readable and better structured for LLM comprehension.

## Problem Statement

### Current Character Persona Formatting Issues

Based on analysis of `prompt.txt` (lines 10-31), the `<character_persona>` section currently uses inconsistent formatting:

1. **Physical Description**: Uses unstructured colon-separated format without markdown headers
2. **Personality Section**: Lacks clear section headers and organization
3. **Profile/Background**: Dense paragraph format without visual separation
4. **Speech Patterns**: Inconsistent formatting with other sections using bullet points without markdown structure

### Current Format Analysis

```
<character_persona>
YOU ARE Amaia Castillo.
This is your identity. All thoughts, actions, and words must stem from this core truth.
Your Description: Hair: long, blonde, wavy
Eyes: amber, almond
Breasts: G-cup, meaty, soft
...
Your Personality: My charm is a weapon: carefully calibrated...
Your Profile / Background: My name is Amaia - Basque for 'the end'...
Your Speech Patterns:
- I translate life to currency language...
- I favor an arrested metaphor...
</character_persona>
```

### Issues Identified

1. **Inconsistent Hierarchy**: No markdown headers for major sections
2. **Poor Scanability**: Physical descriptions are hard to parse quickly
3. **Visual Organization**: Lacks visual separation between major personality elements
4. **LLM Comprehension**: Current format may be less optimal for LLM processing
5. **Maintenance**: Harder to debug and modify prompt content

## Proposed Enhancement

### Design Principles

1. **Consistent Markdown Structure**: Use `##` and `###` headers to match other sections
2. **Enhanced Readability**: Bold formatting for attribute names in descriptions
3. **Logical Organization**: Clear separation between description, personality, profile, and speech patterns
4. **Scalable Format**: Structure that adapts to different character complexities
5. **LLM Optimization**: Format that aligns with LLM training patterns for better comprehension

### Target Format Structure

```markdown
<character_persona>
YOU ARE [Character Name].
This is your identity. All thoughts, actions, and words must stem from this core truth.

## Your Description
**Hair**: [description]
**Eyes**: [description]
**[Physical Attribute]**: [description]
**Wearing**: [clothing description]

## Your Personality
[Personality description with clear paragraph breaks]

## Your Profile
[Background information with clear paragraph breaks]

## Your Likes
[Likes description]

## Your Dislikes
[Dislikes description]

## Your Secrets
[Secrets description]

## Your Fears
[Fears description]

## Your Speech Patterns
- [Speech pattern 1]
- [Speech pattern 2]
- [Speech pattern 3]
</character_persona>
```

### Detailed Example Transformation

#### Current Format (From prompt.txt)
```
<character_persona>
YOU ARE Amaia Castillo.
This is your identity. All thoughts, actions, and words must stem from this core truth.
Your Description: Hair: long, blonde, wavy
Eyes: amber, almond
Breasts: G-cup, meaty, soft
Legs: long, shapely
Ass: round
Pubic hair: curly
Wearing: black, smooth, calfskin belt | white, smooth, linen structured blazer...
Your Personality: My charm is a weapon: carefully calibrated, icy, meant only to disarm strategically...
</character_persona>
```

#### Enhanced Format (Proposed)
```markdown
<character_persona>
YOU ARE Amaia Castillo.
This is your identity. All thoughts, actions, and words must stem from this core truth.

## Your Description
**Hair**: long, blonde, wavy
**Eyes**: amber, almond
**Breasts**: G-cup, meaty, soft
**Legs**: long, shapely
**Ass**: round
**Pubic hair**: curly
**Wearing**: black, smooth, calfskin belt | white, smooth, linen structured blazer | nude, silk underwired plunge bra | nude, silk thong | black, stretch-silk bodysuit | gray, smooth, wool wide-leg trousers, and black, smooth, leather stiletto pumps.

## Your Personality
My charm is a weapon: carefully calibrated, icy, meant only to disarm strategically. My discipline is furious, sacrificial - punishing this body I've commodified to maintain its exacting value. And my care? It's a act born of desperation: lavish patronage thrown at young talent, a displaced, pathetic attempt to feel... generative.

## Your Profile
My name is Amaia - Basque for 'the end'. A grim joke, don't you think, for someone feeling perpetually trapped? I possess this hair, luscious blonde, and these eyes... unnaturally pale yellow-amber. Men call them hypnotic; I know they see predation.

[Continue with rest of profile content...]

## Your Likes
Kursaal's Abstract Brutalism speaks to me - unforgiving, unapologetic presence. Sour cherries... things that fight sweetness, shock my senses back from numbness. Observing teenage athletes... yes. The raw potential, brutally channeled.

## Your Dislikes
I despise untouched luxury items... sterile gifts signifying an utter lack of engagement. And bodies too like my own? Those 'cougar' caricatures... they make my skin crawl.

## Your Secrets
My erotic manuscript... tucked away. Pages of transgressive fantasies intertwined with stark psychoanalysis of adolescent males. Defense mechanisms, vulnerabilities — strategically noted.

## Your Fears
I fear becoming an architectural ghost... dissolving into these walls, noticed only as ambient noise. And the False Palladium? Terrifying: discovering that the boy, the patronage, the carefully built fantasy... it's just hollow gilding on the same emptiness.

## Your Speech Patterns
- I translate life to currency language: 'That cellist? Undervalued stock due for correction...', 'Invested too much emotional capital there... dreadful ROI'.
- I favor an arrested metaphor: Cutting thoughts deliberately ('The situation resembles... Venetian fog...') — leaves them hanging.
- Disciplined brevity anchors me. Complex emotions are crushed into clipped precision: 'Tiring. Understood. Later.'
- Montage proofing keeps them off balance. I switch unexpectedly to Euskara or French mid-sentence - it marks territory, asserts dominance in the silence.
</character_persona>
```

## Technical Implementation Strategy

### Component Analysis

Based on review of the codebase and `PromptGenerationPipeline.e2e.test.js`, the character persona content is likely generated through:

1. **Character Data Loading**: Entity system loading character components
2. **Prompt Content Provider**: `AIPromptContentProvider.js` assembling character data
3. **Template System**: `characterPromptTemplate.js` providing the structure
4. **Prompt Builder**: `PromptBuilder.js` assembling final prompt sections

### Primary Implementation Areas

#### 1. Character Data Formatting Service
**Target Component**: `src/prompting/characterDataFormatter.js` (likely)
- **Responsibility**: Transform character component data into markdown format
- **New Methods**:
  - `formatPhysicalDescription(characterData)` → Markdown description section
  - `formatPersonalitySection(personalityData)` → Markdown personality section
  - `formatProfileSection(profileData)` → Markdown profile section
  - `formatSpeechPatterns(speechData)` → Markdown speech patterns

#### 2. Character Prompt Template Enhancement
**Target Component**: `src/prompting/templates/characterPromptTemplate.js`
- **Responsibility**: Provide markdown-structured character persona template
- **Changes**:
  - Update template to use `##` headers for major sections
  - Ensure proper spacing and structure
  - Maintain placeholder system for dynamic content

#### 3. AI Prompt Content Provider
**Target Component**: `src/prompting/AIPromptContentProvider.js`
- **Responsibility**: Coordinate character data assembly
- **Changes**:
  - Integrate new character data formatting service
  - Ensure markdown structure is preserved
  - Handle edge cases (missing data, optional sections)

### Data Flow Enhancement

#### Current Data Flow (Inferred)
```
Character Components → Character Data Assembly → Template Application → Final Persona Section
```

#### Enhanced Data Flow
```
Character Components → Markdown Formatter → Structured Template → Enhanced Persona Section
                     ↓
              Section Validation → Error Handling → Quality Assurance
```

### Implementation Phases

#### Phase 1: Core Formatting Infrastructure
1. **Create Character Data Formatter Service**
   - Implement markdown formatting methods
   - Add comprehensive validation
   - Create unit tests for all formatting functions

2. **Update Character Template**
   - Modify template structure to use markdown headers
   - Ensure backward compatibility during transition
   - Add template validation

#### Phase 2: Integration and Testing
1. **Integrate with Prompt Content Provider**
   - Connect new formatter to existing pipeline
   - Maintain data integrity
   - Add integration tests

2. **Update End-to-End Tests**
   - Modify `PromptGenerationPipeline.e2e.test.js` assertions
   - Add specific markdown structure validation
   - Test edge cases and error handling

#### Phase 3: Validation and Optimization
1. **Content Quality Validation**
   - Ensure all character data sections are properly formatted
   - Validate markdown structure correctness
   - Performance optimization

2. **LLM Output Testing**
   - Test prompt generation with new format
   - Validate LLM comprehension and response quality
   - Compare before/after performance metrics

### Detailed Implementation Specifications

#### Character Data Formatter Implementation

```javascript
/**
 * Character Data Formatter Service
 * Transforms character component data into markdown-structured format
 */
class CharacterDataFormatter {
  /**
   * Format physical description with markdown structure
   * @param {Object} characterData - Character component data
   * @returns {string} Markdown formatted description
   */
  formatPhysicalDescription(characterData) {
    const description = characterData.description || {};
    let result = '## Your Description\n';
    
    // Format physical attributes with bold labels
    Object.entries(description).forEach(([key, value]) => {
      if (key !== 'wearing') {
        result += `**${this.capitalizeFirst(key)}**: ${value}\n`;
      }
    });
    
    // Handle wearing separately (often longer)
    if (description.wearing) {
      result += `**Wearing**: ${description.wearing}\n`;
    }
    
    return result;
  }
  
  /**
   * Format personality section with proper markdown headers
   * @param {string} personalityText - Personality description
   * @returns {string} Markdown formatted personality
   */
  formatPersonalitySection(personalityText) {
    if (!personalityText) return '';
    return `## Your Personality\n${personalityText}\n`;
  }
  
  /**
   * Format profile/background section
   * @param {string} profileText - Profile description
   * @returns {string} Markdown formatted profile
   */
  formatProfileSection(profileText) {
    if (!profileText) return '';
    return `## Your Profile\n${profileText}\n`;
  }
  
  /**
   * Format speech patterns as markdown list
   * @param {Array|string} speechPatterns - Speech pattern data
   * @returns {string} Markdown formatted speech patterns
   */
  formatSpeechPatterns(speechPatterns) {
    if (!speechPatterns) return '';
    
    let result = '## Your Speech Patterns\n';
    
    if (Array.isArray(speechPatterns)) {
      speechPatterns.forEach(pattern => {
        result += `- ${pattern}\n`;
      });
    } else if (typeof speechPatterns === 'string') {
      // Handle existing format where patterns might be in text
      const patterns = this.extractSpeechPatterns(speechPatterns);
      patterns.forEach(pattern => {
        result += `- ${pattern}\n`;
      });
    }
    
    return result;
  }
  
  /**
   * Format optional sections (likes, dislikes, secrets, fears)
   * @param {string} sectionName - Name of the section
   * @param {string} content - Section content
   * @returns {string} Markdown formatted section
   */
  formatOptionalSection(sectionName, content) {
    if (!content) return '';
    const headerName = this.formatSectionHeader(sectionName);
    return `## Your ${headerName}\n${content}\n`;
  }
  
  /**
   * Main formatting method that assembles complete character persona
   * @param {Object} characterData - Complete character data
   * @returns {string} Complete markdown formatted character persona
   */
  formatCharacterPersona(characterData) {
    const { name, identity, description, personality, profile, likes, dislikes, secrets, fears, speechPatterns } = characterData;
    
    let result = `YOU ARE ${name}.\n`;
    result += `This is your identity. All thoughts, actions, and words must stem from this core truth.\n\n`;
    
    // Add each section if data exists
    result += this.formatPhysicalDescription({ description });
    result += '\n';
    result += this.formatPersonalitySection(personality);
    result += '\n';
    result += this.formatProfileSection(profile);
    result += '\n';
    result += this.formatOptionalSection('Likes', likes);
    result += '\n';
    result += this.formatOptionalSection('Dislikes', dislikes);
    result += '\n';
    result += this.formatOptionalSection('Secrets', secrets);
    result += '\n';
    result += this.formatOptionalSection('Fears', fears);
    result += '\n';
    result += this.formatSpeechPatterns(speechPatterns);
    
    return result.trim();
  }
}
```

#### Template Integration

```javascript
/**
 * Enhanced Character Prompt Template
 * Uses markdown-structured character persona format
 */
const characterPromptTemplate = `
<character_persona>
{{characterPersonaContent}}
</character_persona>
`;

// Template would be populated by the CharacterDataFormatter output
```

### Testing Strategy

#### Unit Tests

```javascript
describe('CharacterDataFormatter', () => {
  test('should format physical description with markdown headers', () => {
    const characterData = {
      description: {
        hair: 'long, blonde, wavy',
        eyes: 'amber, almond',
        wearing: 'black dress'
      }
    };
    
    const result = formatter.formatPhysicalDescription(characterData);
    
    expect(result).toContain('## Your Description');
    expect(result).toContain('**Hair**: long, blonde, wavy');
    expect(result).toContain('**Eyes**: amber, almond');
    expect(result).toContain('**Wearing**: black dress');
  });
  
  test('should format speech patterns as markdown list', () => {
    const speechPatterns = [
      'I speak with authority',
      'I use metaphors frequently'
    ];
    
    const result = formatter.formatSpeechPatterns(speechPatterns);
    
    expect(result).toContain('## Your Speech Patterns');
    expect(result).toContain('- I speak with authority');
    expect(result).toContain('- I use metaphors frequently');
  });
  
  test('should handle empty sections gracefully', () => {
    const result = formatter.formatOptionalSection('Likes', null);
    expect(result).toBe('');
  });
});
```

#### Integration Tests

```javascript
describe('Enhanced Character Persona Integration', () => {
  test('should generate markdown-structured character persona in prompt', async () => {
    const prompt = await testBed.generatePrompt(actorId, turnContext, actions);
    
    const sections = testBed.parsePromptSections(prompt);
    const personaSection = sections.character_persona;
    
    // Verify markdown structure
    expect(personaSection).toContain('## Your Description');
    expect(personaSection).toContain('## Your Personality');
    expect(personaSection).toContain('## Your Speech Patterns');
    
    // Verify bold formatting in description
    expect(personaSection).toMatch(/\*\*Hair\*\*:/);
    expect(personaSection).toMatch(/\*\*Eyes\*\*:/);
    
    // Verify list formatting in speech patterns
    expect(personaSection).toMatch(/## Your Speech Patterns\n- /);
  });
});
```

#### E2E Test Updates

```javascript
// Update to PromptGenerationPipeline.e2e.test.js
test('should generate character persona with markdown formatting', async () => {
  const prompt = await testBed.generatePrompt(aiActor.id, turnContext, availableActions);
  
  // Verify markdown structure in character persona
  expect(prompt).toMatch(/<character_persona>[\s\S]*## Your Description[\s\S]*<\/character_persona>/);
  expect(prompt).toMatch(/\*\*Hair\*\*:/);
  expect(prompt).toMatch(/\*\*Eyes\*\*:/);
  expect(prompt).toMatch(/## Your Speech Patterns/);
  expect(prompt).toMatch(/- [^-]/); // List items
});
```

## Benefits and Impact

### Immediate Benefits

1. **Enhanced Readability**: Clear markdown structure makes character personas easier to scan and understand
2. **Consistent Formatting**: Aligns character persona with other enhanced sections like world_context
3. **Better LLM Comprehension**: Structured format should improve AI character response quality
4. **Improved Maintainability**: Easier to debug and modify character content

### Long-term Benefits

1. **Scalable Character System**: Structure adapts well to complex characters with many attributes
2. **Template Consistency**: Standardized approach across all prompt sections
3. **Development Efficiency**: Clearer structure aids in prompt debugging and optimization
4. **Quality Assurance**: Easier validation of character data completeness

### Performance Considerations

1. **Token Impact**: Minimal increase in token count due to markdown headers (estimated <5% increase)
2. **Processing Overhead**: Negligible performance impact from formatting operations
3. **Memory Usage**: No significant change in memory footprint
4. **Caching**: Formatted content can be cached for repeated use

## Migration and Deployment

### Backward Compatibility Strategy

1. **Feature Flag Implementation**: Deploy enhancement behind feature flag
2. **A/B Testing**: Compare old vs. new format performance
3. **Gradual Rollout**: Enable for subset of characters initially
4. **Fallback Mechanism**: Maintain old formatter as backup

### Deployment Phases

1. **Phase 1**: Implement formatter service with comprehensive tests
2. **Phase 2**: Integrate with prompt generation pipeline
3. **Phase 3**: Update all relevant tests and assertions
4. **Phase 4**: Enable feature flag for beta testing
5. **Phase 5**: Full deployment after validation

### Risk Mitigation

1. **LLM Output Quality**: Monitor character response quality before/after
2. **Performance Monitoring**: Track prompt generation speed and token usage
3. **Error Handling**: Comprehensive error handling for malformed character data
4. **Quick Rollback**: Ability to instantly revert to old format if needed

## Success Metrics

### Quantitative Metrics

1. **Format Compliance**: 100% of generated character personas use markdown structure
2. **Test Coverage**: Maintain >90% test coverage for character formatting components
3. **Performance**: No degradation in prompt generation speed
4. **Token Efficiency**: <5% increase in character persona token count

### Qualitative Metrics

1. **Developer Experience**: Improved prompt debugging and development workflow
2. **LLM Output Quality**: Maintained or improved AI character response quality
3. **Code Maintainability**: Cleaner, more organized character formatting code
4. **Template Consistency**: Unified markdown approach across all prompt sections

## Future Enhancements

### Potential Extensions

1. **Dynamic Section Ordering**: Customize section order based on character importance
2. **Conditional Formatting**: Advanced formatting based on character complexity
3. **Localization Support**: Language-specific formatting considerations
4. **Interactive Templates**: Runtime customization of character presentation

### Technical Debt Reduction

1. **Template Consolidation**: Unify all prompt section formatting approaches
2. **Validation Enhancement**: Stronger validation for character data completeness
3. **Performance Optimization**: Advanced caching and formatting optimization
4. **Error Recovery**: Robust handling of incomplete or malformed character data

## Conclusion

This comprehensive enhancement will significantly improve the character persona section formatting in the Living Narrative Engine's LLM prompt generation system. The proposed markdown structure provides better organization, enhanced readability, and improved LLM comprehension while maintaining full backward compatibility.

The implementation follows established patterns in the codebase and provides a scalable foundation for future character system enhancements. Through careful phased deployment and comprehensive testing, this enhancement will deliver immediate benefits while setting the stage for continued prompt system evolution.