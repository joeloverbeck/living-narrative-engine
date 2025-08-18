# CORMOTGEN-010: Create Prompt Generation System

## Ticket ID

CORMOTGEN-010

## Title

Implement prompt builder for Core Motivations LLM generation

## Status

TODO

## Priority

HIGH

## Estimated Effort

1-2 hours

## Dependencies

- CORMOTGEN-006 (CoreMotivation model)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 3.2 - Prompt Construction)
- Reference: src/characterBuilder/prompts/clicheGenerationPrompt.js

## Description

Create the prompt generation system that constructs the LLM prompt for generating core motivations. The prompt includes character concept, thematic direction, clichés to avoid, and content guidelines.

## Technical Requirements

### File: `src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js`

**CORRECTED Structure** (following existing pattern from `clicheGenerationPrompt.js`):

1. **Required Exports** (aligned with existing prompt pattern):
   - `export const CORE_MOTIVATIONS_LLM_PARAMS` - LLM parameters
   - `export const CORE_MOTIVATIONS_RESPONSE_SCHEMA` - JSON schema for validation
   - `export const PROMPT_VERSION_INFO` - Version tracking
   - `export function buildCoreMotivationsGenerationPrompt(characterConcept, direction, cliches)` - Main prompt builder
   - `export function validateCoreMotivationsGenerationResponse(response)` - Response validation
   - `export function createCoreMotivationsGenerationLlmConfig(baseLlmConfig)` - LLM config creation

2. **Content Guidelines Integration**:
   - Embed guidelines directly in prompt template (current pattern)
   - Copy exact text from `clicheGenerationPrompt.js` lines 319-331

3. **NO Separate Formatting Methods**:
   - Use single prompt builder function (existing pattern)
   - Token validation handled by LLM services using `TokenEstimator`

3. **Prompt Template**

```text
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

Return as JSON:
{
  "motivations": [
    {
      "coreDesire": "What deeply drives the character",
      "internalContradiction": "Internal contradiction or external conflict",
      "centralQuestion": "Philosophical/narrative question with ?"
    }
  ]
}
```

## Validation Criteria

- [ ] Follows existing `clicheGenerationPrompt.js` pattern exactly
- [ ] JSON schema matches `CoreMotivation` model fields
- [ ] Content guidelines embedded in prompt template
- [ ] Exports all required functions and constants
- [ ] Response validation using AJV schema
- [ ] Token validation handled by LLM services (not prompt builder)

## Testing Requirements

- Mirror existing `tests/unit/characterBuilder/prompts/clicheGenerationPrompt.test.js`
- Test complete prompt generation function
- Test response validation function
- Test LLM config creation function
- Use existing `CharacterBuilderIntegrationTestBed` for integration tests
- Follow test organization in `/tests/unit/characterBuilder/prompts/`

## Checklist

- [ ] Copy structure from `clicheGenerationPrompt.js`
- [ ] Adapt prompt content for core motivations
- [ ] Use correct JSON schema matching `CoreMotivation` model
- [ ] Include version management and enhancement options
- [ ] Embed content guidelines directly in template
- [ ] Write unit tests following existing patterns
- [ ] Create integration tests using existing test bed

## Dependencies Already Satisfied

- ✅ `CoreMotivation` model exists with required structure
- ✅ `CharacterBuilderService` has placeholder for core motivations events
- ✅ Dependency injection tokens already defined in `tokens-core.js`
- ✅ Test infrastructure exists and can be extended
