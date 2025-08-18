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

3-4 hours

## Dependencies

- CORMOTGEN-006 (CoreMotivation model)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 3.2 - Prompt Construction)
- Reference: src/characterBuilder/prompts/clicheGenerationPrompt.js

## Description

Create the prompt generation system that constructs the LLM prompt for generating core motivations. The prompt includes character concept, thematic direction, clichés to avoid, and content guidelines.

## Technical Requirements

### File: `src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js`

Key components:

1. **Prompt Template Structure**
   - Character concept section
   - Thematic direction details (all sections)
   - Clichés list (formatted for avoidance)
   - Content guidelines (NC-21, no restrictions)
   - Generation instructions (3-5 blocks)

2. **Required Methods**
   - `buildPrompt(concept, direction, cliches)` - Main prompt builder
   - `formatConcept(concept)` - Format concept text
   - `formatDirection(direction)` - Include all direction sections
   - `formatCliches(cliches)` - Export format for clichés
   - `getContentGuidelines()` - Copy from cliché prompt

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
      "coreMotivation": "What deeply drives the character",
      "contradiction": "Internal contradiction or external conflict",
      "centralQuestion": "Philosophical/narrative question with ?"
    }
  ]
}
```

## Validation Criteria

- [ ] Prompt includes all required sections
- [ ] Content guidelines match cliché prompt exactly
- [ ] JSON format instructions are clear
- [ ] Handles missing data gracefully
- [ ] Character limit validation (<10K tokens)

## Testing Requirements

- Unit tests for each formatting method
- Test complete prompt generation
- Test edge cases (missing data)
- Validate token count

## Checklist

- [ ] Create prompt class
- [ ] Implement formatting methods
- [ ] Add content guidelines
- [ ] Add JSON instructions
- [ ] Write unit tests
