# POSTARVAL-007: Update Intimacy Actions

## Overview
Analyze and update intimacy mod actions to use target validation where appropriate, ensuring positioning conflicts are properly handled and maintaining compatibility with existing validation logic.

## Prerequisites
- POSTARVAL-001 through POSTARVAL-005: Core validation system implemented
- POSTARVAL-006: Positioning actions updated (for reference patterns)

## Objectives
1. Analyze intimacy actions for positioning requirements
2. Add target validation to prevent conflicting states
3. Maintain compatibility with existing condition-based validation
4. Ensure intimate actions respect positioning constraints
5. Document intimacy validation patterns

## Implementation Steps

### 1. Analyze Current Intimacy Actions
- [ ] Review all actions in `data/mods/intimacy/actions/`
- [ ] Identify actions with positioning requirements
- [ ] Document current validation methods
- [ ] Determine which need target component validation

**Key Actions to Review:**
- `kiss` - Already has positioning conflict detection via conditions
- `fondle_breasts` - Requires appropriate positioning
- `fondle_crotch` - Requires accessible positioning
- `fondle_ass` - May have positioning requirements
- `lick_ear` - Requires close positioning
- `whisper_sweet_nothings` - Requires proximity

### 2. Analyze Current kiss Action
- [ ] Review `data/mods/intimacy/actions/kiss.action.json`
- [ ] Check existing condition-based validation
- [ ] Determine if target validation would simplify/improve
- [ ] Document current approach

**Current Implementation Review:**
```json
{
  "id": "intimacy:kiss",
  "conditions": [
    {
      "condition_ref": "intimacy:kiss-not-positioning-conflict"
    }
  ]
}
```

### 3. Evaluate Schema-Based vs Condition-Based Validation
- [ ] Compare approaches for maintainability
- [ ] Consider performance implications
- [ ] Determine best pattern for intimacy mod
- [ ] Document decision rationale

**Comparison:**
- **Schema-based (forbidden_components)**:
  - ✅ Declarative and clear
  - ✅ Validated early in pipeline
  - ✅ Better performance
  - ❌ Less flexible for complex logic

- **Condition-based (current)**:
  - ✅ More flexible logic possible
  - ✅ Can check relationship states
  - ❌ Evaluated later in pipeline
  - ❌ More complex to maintain

### 4. Update Actions with Target Validation
- [ ] Add forbidden components where appropriate
- [ ] Maintain existing conditions for complex logic
- [ ] Test compatibility between approaches

**Example: fondle_breasts Update**
```json
{
  "id": "intimacy:fondle_breasts",
  "forbidden_components": {
    "actor": [
      "positioning:immobilized",
      "core:unconscious"
    ],
    "primary": [
      "positioning:facing_away",
      "positioning:lying_face_down",
      "core:unconscious"
    ]
  },
  "conditions": [
    {
      "condition_ref": "intimacy:consent-established"
    }
  ]
}
```

### 5. Create Hybrid Validation Pattern
- [ ] Use forbidden_components for simple state checks
- [ ] Use conditions for complex relationship/consent logic
- [ ] Document when to use each approach
- [ ] Create examples for mod developers

**Recommended Pattern:**
```json
{
  "forbidden_components": {
    "actor": ["physical_state_components"],
    "primary": ["physical_state_components"]
  },
  "conditions": [
    "relationship_and_consent_conditions"
  ]
}
```

### 6. Update Related Actions
- [ ] Update `fondle_crotch` with positioning validation
- [ ] Update `fondle_ass` with accessibility validation
- [ ] Update `lick_ear` with proximity validation
- [ ] Ensure all updates maintain gameplay balance

### 7. Document Intimacy Validation Patterns
- [ ] Create guide for intimacy action validation
- [ ] Include consent and relationship considerations
- [ ] Document positioning requirements
- [ ] Add examples and best practices

```markdown
# Intimacy Action Validation Guide

## Validation Layers

### Layer 1: Physical State (forbidden_components)
- Actor and target physical capability
- Positioning compatibility
- Consciousness and awareness

### Layer 2: Consent & Relationship (conditions)
- Consent mechanisms
- Relationship thresholds
- Social context

## Best Practices
1. Use forbidden_components for physical impossibilities
2. Use conditions for social/consent validation
3. Always validate both actor and target states
4. Consider power dynamics in positioning
5. Respect player agency and consent
```

## Testing Requirements

### Integration Tests
```javascript
// tests/integration/mods/intimacy/targetValidation.test.js
describe('Intimacy Actions with Target Validation', () => {
  describe('fondle actions', () => {
    it('should prevent fondling facing away target')
    it('should prevent fondling unconscious target')
    it('should allow fondling when properly positioned')
  });

  describe('kiss action compatibility', () => {
    it('should work with existing condition validation')
    it('should respect both forbidden components and conditions')
  });

  describe('hybrid validation', () => {
    it('should check physical state via forbidden_components')
    it('should check consent via conditions')
    it('should require both validations to pass')
  });
});
```

### Scenario Tests
- Test intimate actions with various positioning states
- Test consent and positioning interaction
- Test with AI-controlled characters
- Ensure appropriate narrative outcomes

## Success Criteria
- [ ] Intimacy actions respect positioning constraints
- [ ] Hybrid validation pattern works correctly
- [ ] No regression in existing intimacy functionality
- [ ] Clear documentation for mod developers
- [ ] Maintains appropriate consent mechanisms
- [ ] All tests pass

## Files to Modify
- `data/mods/intimacy/actions/fondle_breasts.action.json` - Add target validation
- `data/mods/intimacy/actions/fondle_crotch.action.json` - Add target validation
- `data/mods/intimacy/actions/fondle_ass.action.json` - Add target validation
- `data/mods/intimacy/actions/lick_ear.action.json` - Add proximity validation

## Files to Create
- `data/mods/intimacy/documentation/validation-guide.md` - Documentation
- `tests/integration/mods/intimacy/targetValidation.test.js` - Tests

## Dependencies
- POSTARVAL-001 through POSTARVAL-005: Core system complete
- POSTARVAL-006: Positioning patterns established

## Estimated Time
3-4 hours

## Notes
- Prioritize consent and player agency
- Balance realism with gameplay flexibility
- Consider cultural sensitivity in validation rules
- Maintain backward compatibility with existing content