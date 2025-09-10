# CHACOMENH-010: Create Manual Testing Checklist

**Phase**: Testing  
**Priority**: Medium  
**Complexity**: Low  
**Dependencies**: CHACOMENH-001 through CHACOMENH-006  
**Estimated Time**: 1-2 hours

## Summary

Create a comprehensive manual testing checklist and validation guide for QA testers and developers to verify the psychological components feature works correctly in a live environment. This includes browser-based testing scenarios, visual verification steps, and LLM response quality checks.

## Background

While automated tests verify code correctness, manual testing is essential for validating user experience, visual presentation, and LLM response quality with the enhanced character prompts. This checklist ensures consistent testing across different team members.

## Manual Testing Checklist

### Environment Setup

#### Prerequisites

- [ ] Latest code from feature branch
- [ ] Browser DevTools accessible (Chrome/Firefox recommended)
- [ ] LLM proxy server running (`npm run dev`)
- [ ] Test data files prepared

#### Initial Verification

- [ ] Application starts without errors (`npm run dev`)
- [ ] No console errors in browser
- [ ] Component files exist in `data/mods/core/components/`:
  - [ ] `motivations.component.json`
  - [ ] `internal_tensions.component.json`
  - [ ] `core_dilemmas.component.json`

### Component Loading Tests

#### Test 1: Verify Component Registration

**Steps:**

1. Open browser DevTools console
2. Run: `window.gameEngine?.dataRegistry?.components?.has('core:motivations')`
3. Run: `window.gameEngine?.dataRegistry?.components?.has('core:internal_tensions')`
4. Run: `window.gameEngine?.dataRegistry?.components?.has('core:core_dilemmas')`

**Expected:** All three commands return `true`

#### Test 2: Inspect Component Schemas

**Steps:**

1. In console, run: `window.gameEngine?.dataRegistry?.getComponent('core:motivations')`
2. Verify schema structure includes:
   - `id: "core:motivations"`
   - `dataSchema.properties.text`
   - `dataSchema.required` contains "text"

**Expected:** Component object with proper schema structure

### Character Creation Tests

#### Test 3: Create Character with All Psychological Components

**Test Data:**

```json
{
  "id": "test-complete",
  "components": {
    "core:actor": { "name": "Complete Test Character" },
    "core:description": { "text": "A test character with depth" },
    "core:motivations": {
      "text": "I test features because quality matters to me."
    },
    "core:internal_tensions": {
      "text": "I want perfection but know iteration is key."
    },
    "core:core_dilemmas": {
      "text": "Is a bug-free system truly achievable?"
    }
  }
}
```

**Steps:**

1. Create character using game UI or console command
2. Verify character appears in entity list
3. Inspect character data in DevTools

**Expected:** Character created successfully with all components

#### Test 4: Create Character with Partial Components

**Test Data:**

```json
{
  "id": "test-partial",
  "components": {
    "core:actor": { "name": "Partial Test Character" },
    "core:motivations": {
      "text": "I only have motivations defined."
    }
  }
}
```

**Steps:**

1. Create character with only motivations
2. Verify character creation succeeds
3. Check other components are undefined (not errors)

**Expected:** Character works normally with only some psychological components

#### Test 5: Create Legacy Character (Backward Compatibility)

**Test Data:**

```json
{
  "id": "test-legacy",
  "components": {
    "core:actor": { "name": "Legacy Character" },
    "core:description": { "text": "Old-style character" },
    "core:personality": { "text": "Traditional traits" }
  }
}
```

**Steps:**

1. Create character without new components
2. Verify character functions normally
3. Confirm no errors or warnings

**Expected:** Full backward compatibility maintained

### Prompt Generation Tests

#### Test 6: Verify Prompt Structure

**Steps:**

1. Trigger AI turn for character with all components
2. In Network tab, intercept request to LLM proxy
3. Inspect prompt payload structure

**Expected Prompt Structure:**

```markdown
YOU ARE Complete Test Character.
This is your identity...

## Your Description

A test character with depth

## Your Profile

[if present]

## Your Core Motivations

I test features because quality matters to me.

## Your Internal Tensions

I want perfection but know iteration is key.

## Your Core Dilemmas

Is a bug-free system truly achievable?

## Your Likes

[if present]

[... other sections ...]
```

**Validation Points:**

- [ ] Header uses character name
- [ ] Sections appear in correct order
- [ ] Psychological sections after Profile, before Likes
- [ ] Markdown formatting correct (## headers)
- [ ] Text content preserved exactly
- [ ] No extra escaping or formatting issues

#### Test 7: Verify Section Ordering

**Steps:**

1. Create character with all components
2. Generate prompt
3. Verify section order

**Expected Order:**

1. Description
2. Personality
3. Profile
4. **Core Motivations** (NEW)
5. **Internal Tensions** (NEW)
6. **Core Dilemmas** (NEW)
7. Likes
8. Dislikes
9. Strengths
10. Weaknesses
11. Secrets
12. Fears
13. Speech Patterns

### LLM Response Quality Tests

#### Test 8: Enhanced Response Coherence

**Steps:**

1. Create two characters:
   - One WITH psychological components
   - One WITHOUT psychological components
2. Generate AI responses for both
3. Compare response quality

**Evaluation Criteria:**

- [ ] Character WITH components shows deeper personality
- [ ] Motivations reflected in decision-making
- [ ] Internal tensions create nuanced responses
- [ ] Dilemmas influence character reasoning
- [ ] Overall more coherent character voice

#### Test 9: Consistency Check

**Steps:**

1. Generate multiple AI responses for same character
2. Verify psychological traits remain consistent
3. Check for contradictions

**Expected:** Consistent character portrayal across responses

### Edge Case Tests

#### Test 10: Empty Component Values

**Test Data:**

```json
{
  "core:motivations": { "text": "" },
  "core:internal_tensions": { "text": "   " },
  "core:core_dilemmas": { "text": "\n\t" }
}
```

**Steps:**

1. Create character with empty/whitespace values
2. Generate prompt
3. Verify sections omitted (not empty sections)

**Expected:** Empty components excluded from prompt

#### Test 11: Special Characters and Formatting

**Test Data:**

```json
{
  "core:motivations": {
    "text": "I use **markdown** and _emphasis_ and special chars: & < > \" ' @#$%"
  },
  "core:core_dilemmas": {
    "text": "Can I handle questions? Multiple questions?? Even more???"
  }
}
```

**Steps:**

1. Create character with special formatting
2. Generate and inspect prompt
3. Verify characters preserved correctly

**Expected:** All formatting and special characters preserved

#### Test 12: Very Long Text

**Steps:**

1. Create character with 1000+ character text in each component
2. Generate prompt
3. Verify no truncation or errors

**Expected:** Long text handled gracefully

### Performance Tests

#### Test 13: Load Time Impact

**Steps:**

1. Measure app load time without new components
2. Measure app load time with new components
3. Compare times

**Expected:** Negligible impact (< 100ms difference)

#### Test 14: Prompt Generation Speed

**Steps:**

1. Time prompt generation for character with all components
2. Time prompt generation for character without new components
3. Compare times

**Expected:** < 50ms difference

### Save/Load Tests

#### Test 15: Persistence Verification

**Steps:**

1. Create character with psychological components
2. Save game state
3. Reload page
4. Load saved game
5. Verify components preserved

**Expected:** All component data persisted correctly

### UI Integration Tests (If Character Builder Updated)

#### Test 16: Character Builder Support

**Steps:**

1. Open character builder tool
2. Check for new component fields
3. Enter test data
4. Save character
5. Verify data saved correctly

**Expected:** UI supports new components (or gracefully ignores them)

## Bug Report Template

If issues found, report with:

````markdown
### Issue: [Brief description]

**Test Case:** #[number]
**Environment:** [Browser, OS, branch]

**Steps to Reproduce:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected:** [What should happen]
**Actual:** [What actually happened]

**Console Errors:** [Any errors]
**Screenshots:** [If applicable]

**Test Data Used:**

```json
[Include exact JSON]
```
````

````

## Validation Sign-Off

### Core Functionality
- [ ] All three components load successfully
- [ ] Characters can be created with new components
- [ ] Prompts include psychological sections
- [ ] Backward compatibility maintained
- [ ] No performance degradation

### Quality Checks
- [ ] No console errors during testing
- [ ] Markdown formatting correct
- [ ] Section ordering correct
- [ ] Special characters handled
- [ ] Empty values handled gracefully

### LLM Integration
- [ ] Prompts sent correctly to LLM
- [ ] Response quality improved
- [ ] Character consistency maintained

## Testing Notes

### Browser Compatibility
Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)
- [ ] Edge (optional)

### Test Data Location
Store test JSON files in: `tests/manual/psychological-components/`

### Console Commands Reference
```javascript
// Quick character creation
gameEngine.createEntity({
  id: 'quick-test',
  components: {
    'core:actor': { name: 'Quick Test' },
    'core:motivations': { text: 'Test motivation' }
  }
});

// Inspect character
gameEngine.getEntity('quick-test');

// Generate prompt manually
gameEngine.generatePrompt('quick-test');
````

## Acceptance Criteria

- [ ] Checklist document created and accessible
- [ ] All test scenarios documented clearly
- [ ] Expected results defined for each test
- [ ] Bug report template included
- [ ] Console commands documented
- [ ] Performance benchmarks specified
- [ ] Sign-off criteria defined

## Notes

- Manual testing complements automated tests
- Focus on user experience and visual verification
- LLM response quality is subjective but important
- Document any unexpected behaviors
- Update checklist based on findings

---

_Ticket created from character-components-analysis.md report_
