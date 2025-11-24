# SPEPATREW-006: Update Speech Patterns Generator Prompts

## Objective
Update the prompt templates and response schema in the speech patterns generator to request structured object format output from the LLM instead of legacy string array format.

## Priority
**Medium** - Generator enhancement

## Estimated Effort
0.5 days

## Dependencies
- **SPEPATREW-001** must be completed (schema supports new format)

## Files to Touch
- `src/characterBuilder/prompts/speechPatternsPrompts.js`
- `tests/unit/characterBuilder/prompts/speechPatternsPrompts.test.js` (if exists)

## Implementation Details

### Update Response Schema Constant

**Current**:
```javascript
const SPEECH_PATTERNS_RESPONSE_SCHEMA = `
Return 15-25 speech patterns as a JSON array of strings.
Each pattern should describe a recurring speech feature with 1-2 example phrases.

Format: ["(context) 'example'", ...]
`;
```

**New**:
```javascript
const SPEECH_PATTERNS_RESPONSE_SCHEMA = `
Return 4-8 pattern groups as a JSON array of objects.
Each group should have:
- type: Category name (e.g., "Verbal Tics", "Tonal Shifts")
- contexts: Array of situations where pattern applies (e.g., ["casual", "manipulative"])
- examples: Array of 2-5 dialogue examples demonstrating the pattern

Format:
[
  {
    "type": "Pattern Category",
    "contexts": ["context1", "context2"],
    "examples": ["example 1", "example 2", "example 3"]
  }
]

Aim for 15-25 total examples across all groups.
`;
```

### Update Prompt Template Function

Modify `createSpeechPatternsPrompt(characterData)`:
1. Update instructions to request structured output
2. Add examples of good pattern categories
3. Emphasize natural context-based organization
4. Include guidance on category selection
5. Specify 4-8 categories, 2-5 examples each
6. Keep character context integration

**Add Section**:
```javascript
GOOD PATTERN CATEGORIES:
- Verbal tics (recurring words/phrases)
- Tonal shifts (mood changes in speech)
- Cultural markers (dialect, formality)
- Emotional tells (stress patterns)
- Power dynamics (how they speak to different people)
- Narrative style (meta-narration, storytelling)
```

### Prompt Structure
```javascript
function createSpeechPatternsPrompt(characterData) {
  return `Generate speech patterns for this character, organized into thematic groups.

CHARACTER CONTEXT:
${characterData}

INSTRUCTIONS:
1. Identify 4-8 distinct speech pattern categories
2. For each category:
   - Name the pattern type clearly
   - List contexts where it applies (casual, formal, stressed, manipulative, etc.)
   - Provide 2-5 concrete dialogue examples
3. Ensure patterns feel authentic to character's personality and background
4. Total examples across all groups: 15-25

${GOOD_PATTERN_CATEGORIES}

${SPEECH_PATTERNS_RESPONSE_SCHEMA}`;
}
```

## Out of Scope
- **DO NOT** modify response processing logic (that's SPEPATREW-007)
- **DO NOT** update UI components
- **DO NOT** change LLM configuration
- **DO NOT** modify other prompt files
- **DO NOT** implement validation logic
- **DO NOT** update HTML/CSS
- **DO NOT** modify export functionality

## Acceptance Criteria

### Tests That Must Pass
1. `SPEECH_PATTERNS_RESPONSE_SCHEMA` contains object format specification
2. Schema mentions 4-8 groups
3. Schema specifies type, contexts, examples fields
4. Schema indicates 15-25 total examples
5. `createSpeechPatternsPrompt()` includes character context
6. Prompt includes category examples (verbal tics, tonal shifts, etc.)
7. Prompt emphasizes 4-8 categories
8. Prompt specifies 2-5 examples per category
9. Prompt maintains character authenticity instruction
10. All existing prompt tests pass (if any exist)

### Code Quality
11. Function signature unchanged
12. Returns string (prompt text)
13. Template literal formatting consistent with project style
14. No hardcoded test data in prompt template
15. Clear section structure with headers

### Invariants
- Function exports unchanged (other code can still import)
- Character data parameter still used
- Prompt returns valid string
- No external dependencies added
- No modification of other functions in same file
- Backward compatible with existing generator workflow

## Validation Commands
```bash
# Run unit tests for prompts
npm run test:unit -- tests/unit/characterBuilder/prompts/

# Type check
npm run typecheck

# Lint
npx eslint src/characterBuilder/prompts/speechPatternsPrompts.js

# Run all unit tests
npm run test:unit
```

## Testing Notes
If unit tests don't exist for prompts file:
- Create basic test to verify prompt structure
- Test that character data is included
- Test that schema is included
- Test for presence of key instruction text

## Definition of Done
- [ ] Response schema constant updated
- [ ] Prompt template function updated
- [ ] Category examples added to prompt
- [ ] Instructions specify 4-8 categories
- [ ] Instructions specify 2-5 examples per category
- [ ] Total example count guidance included (15-25)
- [ ] All validation commands pass
- [ ] Existing tests pass (or new basic tests created)
- [ ] Code review completed
- [ ] Manual test: generate prompt and verify structure
