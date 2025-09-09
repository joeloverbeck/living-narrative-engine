# CHACOMENH-001: Create Component JSON Definitions

**Phase**: Component Foundation  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: None  
**Estimated Time**: 1-2 hours

## Summary

Create three new component JSON definition files for the psychological character aspects: motivations, internal tensions, and core dilemmas. These components will store narrative-driven psychological data that enhances character depth in LLM prompts.

## Background

Current character components focus on external traits (appearance, behavior) and concrete attributes (likes, dislikes). The new components will add psychological depth by capturing:
- **Motivations**: WHY characters act (psychological drivers)
- **Internal Tensions**: Conflicting desires creating psychological complexity
- **Core Dilemmas**: Fundamental questions characters grapple with

## Technical Requirements

### Files to Create

All files should be created in: `data/mods/core/components/`

1. **motivations.component.json**
2. **internal_tensions.component.json**
3. **core_dilemmas.component.json**

### Component Schema Structure

Each component must follow the standard Living Narrative Engine component schema pattern:
- Use the standard component schema reference
- Include unique component ID with `core:` namespace
- Provide clear descriptions for documentation
- Define data schema with text field
- Make text field required
- Include first-person perspective examples

## Implementation Details

### 1. motivations.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:motivations",
  "description": "Stores the character's underlying psychological motivations that drive their actions, distinct from their goals.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string describing the character's core motivations, written from their first-person perspective. For example: 'I push myself to excel because I need to prove I'm more than just my family name. Every achievement is a step away from their shadow, every failure a reminder that maybe they were right about me.'"
      }
    }
  }
}
```

### 2. internal_tensions.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:internal_tensions",
  "description": "Stores the internal conflicts and competing desires within the character's psyche.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string describing the character's internal tensions and conflicts, written from their first-person perspective. For example: 'I want to trust others, but everyone I've trusted has betrayed me. I crave independence, yet I fear being alone. I desire peace but find myself drawn to conflict.'"
      }
    }
  }
}
```

### 3. core_dilemmas.component.json

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:core_dilemmas",
  "description": "Stores the fundamental questions the character grapples with, always phrased as questions.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["text"],
    "properties": {
      "text": {
        "type": "string",
        "description": "A string containing the core questions the character struggles with, written from their first-person perspective. Must be phrased as questions. For example: 'Is loyalty to friends more important than loyalty to principles? Can I be true to myself while meeting others' expectations? Does redemption require forgetting the past or embracing it?'"
      }
    }
  }
}
```

## Validation Requirements

### Schema Validation
- Each component must pass AJV validation against the component schema
- Component IDs must follow the `modId:identifier` pattern
- Text fields must be non-empty strings when provided

### Content Guidelines
- **Motivations**: Must express psychological drivers, not goals
- **Internal Tensions**: Must present conflicting desires or beliefs
- **Core Dilemmas**: Must be phrased as questions without easy answers

## Testing Checklist

### Manual Validation
- [ ] All three JSON files are syntactically valid
- [ ] Component IDs follow naming convention (`core:motivations`, etc.)
- [ ] Schema references are correct
- [ ] Descriptions are clear and distinguishable
- [ ] Example text in descriptions demonstrates proper usage

### Automated Validation
- [ ] Files pass JSON schema validation
- [ ] Component loader successfully registers all three components
- [ ] No conflicts with existing component IDs
- [ ] Schema validation works when components are added to entities

## Examples of Valid Component Data

### Motivations Example
```json
{
  "text": "I act tough and aggressive because deep down I feel insecure about my small stature. I seek validation through displays of strength because I never received approval from my father. Every confrontation is a chance to prove I'm not the weakling he said I was."
}
```

### Internal Tensions Example
```json
{
  "text": "I desperately want romantic connection, but every relationship I've had has ended in disaster. I tell myself I don't need anyone, yet I find myself creating reasons to be around others. I want to open up, but vulnerability feels like giving someone a weapon to use against me."
}
```

### Core Dilemmas Example
```json
{
  "text": "Is it right for me to enforce laws I know are unjust? Can I truly protect people by working within a corrupt system? If I compromise my values for the greater good, am I still a good person? How many small evils can I commit before I become what I fight against?"
}
```

## Acceptance Criteria

- [ ] All three component JSON files are created in the correct directory
- [ ] Each file follows the exact schema structure specified
- [ ] Component IDs are unique and properly namespaced
- [ ] Descriptions clearly differentiate each component's purpose
- [ ] Example text in descriptions demonstrates first-person perspective
- [ ] Files are properly formatted with consistent indentation
- [ ] No syntax errors in JSON
- [ ] Schema validation passes for all three components

## Dependencies for Next Steps

These component definitions are prerequisites for:
- CHACOMENH-002: Updating component constants
- CHACOMENH-004: Implementing data extraction logic
- CHACOMENH-005: Implementing character data formatting

## Notes

- These components are designed to be optional - entities without them should still function normally
- The text-based format allows maximum flexibility for content creators
- First-person perspective maintains consistency with existing character components
- Components are intentionally kept simple (single text field) for ease of use

---

*Ticket created from character-components-analysis.md report*