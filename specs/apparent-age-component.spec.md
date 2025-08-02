# Apparent Age Component Specification

## Overview

This specification defines a new `apparent_age.component.json` for the Living Narrative Engine's core mod. The component represents the perceived age of an entity, allowing for realistic age perception with uncertainty ranges and narrative flexibility.

## Current Component System Analysis

### Component Architecture
The Living Narrative Engine uses an Entity Component System (ECS) where components are defined by JSON files following a strict schema structure:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:componentName",
  "description": "Human-readable description",
  "dataSchema": { /* JSON Schema defining component data */ }
}
```

### Existing Component Patterns

1. **Marker Components**: Empty dataSchema for entity tagging
   - Example: `actor.component.json` - identifies entities that can perform actions
   - DataSchema: `{ "type": "object", "properties": {}, "additionalProperties": false }`

2. **Simple Data Components**: Single required field
   - Example: `name.component.json` - entity name storage
   - DataSchema: Single required string property

3. **Complex Data Components**: Rich structured data
   - Example: `personality.component.json` - character personality traits
   - Example: `profile.component.json` - detailed character background
   - DataSchema: Complex objects with validation rules

### Integration Points

The apparent age component should integrate well with:
- `description.component.json` - Physical appearance descriptions
- `personality.component.json` - Age-related personality traits
- `profile.component.json` - Life history and background
- `actor.component.json` - Age-based action availability

## Design Options Analysis

### Option 1: Simple Numeric Age

**Structure:**
```json
{
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["age"],
    "properties": {
      "age": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Apparent age in years"
      }
    }
  }
}
```

**Pros:**
- Simple to implement and use
- Direct numeric operations for rules and logic
- Minimal storage requirements
- Easy to understand for content creators

**Cons:**
- No uncertainty modeling
- Unrealistic precision (exact age perception)
- Limited narrative flexibility
- No contextual variation support

**Use Cases:**
- Simple age-based rules ("must be 18 or older")
- Basic character generation
- Straightforward age comparisons

### Option 2: Age Range with Uncertainty (Recommended)

**Structure:**
```json
{
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["minAge", "maxAge"],
    "properties": {
      "minAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Minimum perceived age in years"
      },
      "maxAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Maximum perceived age in years"
      },
      "bestGuess": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Most likely age estimate (optional)"
      }
    }
  }
}
```

**Additional Validation:**
- `maxAge >= minAge` (enforced at runtime)
- `bestGuess` must be between `minAge` and `maxAge` if provided

**Pros:**
- Models realistic age perception uncertainty
- Supports narrative scenarios ("appears to be in their twenties")
- Flexible for both precise and imprecise age estimates
- Allows for gradual age revelation in stories
- Compatible with probabilistic age-based rules

**Cons:**
- Slightly more complex than simple numeric age
- Requires additional validation logic
- May need helper functions for common operations

**Use Cases:**
- Realistic character descriptions ("appears to be between 25 and 35")
- Age-based mystery elements
- Gradual character revelation
- Probabilistic age-dependent interactions

### Option 3: Comprehensive Age System

**Structure:**
```json
{
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["apparentAge"],
    "properties": {
      "apparentAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Primary apparent age in years"
      },
      "category": {
        "type": "string",
        "enum": ["child", "adolescent", "young_adult", "adult", "middle_aged", "elderly"],
        "description": "Age category for semantic grouping"
      },
      "uncertainty": {
        "type": "number",
        "minimum": 0,
        "maximum": 10,
        "description": "Uncertainty level (0=certain, 10=completely uncertain)"
      },
      "physicalAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Physical appearance age (may differ from apparent age)"
      },
      "mentalAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Perceived mental/emotional maturity age"
      }
    }
  }
}
```

**Pros:**
- Very rich semantic information
- Supports complex age-related mechanics
- Handles physical vs. mental age distinctions
- Semantic categories for rule-based systems

**Cons:**
- High complexity for basic use cases
- May be over-engineered for most scenarios
- Requires extensive validation logic
- Steep learning curve for content creators

**Use Cases:**
- Complex character systems
- Age-related skill/ability modifiers
- Sophisticated AI personality systems
- Fantasy scenarios with age-appearance disconnects

### Option 4: Contextual Age Perception

**Structure:**
```json
{
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["baseAge"],
    "properties": {
      "baseAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Base apparent age in neutral context"
      },
      "modifiers": {
        "type": "object",
        "additionalProperties": true,
        "description": "Context-dependent age perception modifiers",
        "properties": {
          "lighting": { "type": "number" },
          "distance": { "type": "number" },
          "cultural_context": { "type": "string" },
          "observer_age": { "type": "number" }
        }
      }
    }
  }
}
```

**Pros:**
- Handles observer-dependent age perception
- Supports complex environmental factors
- Very flexible and extensible
- Realistic modeling of perception variance

**Cons:**
- Extremely complex implementation
- Unclear usage patterns for content creators
- Performance implications
- May be unnecessarily sophisticated

**Use Cases:**
- Advanced simulation systems
- Research-level age perception modeling
- Complex social interaction systems

## Recommended Implementation

### Primary Recommendation: Option 2 (Age Range with Uncertainty)

**Rationale:**
1. **Realistic Modeling**: Reflects how humans actually perceive age (in ranges, not exact numbers)
2. **Narrative Flexibility**: Supports both precise ("25 years old") and imprecise ("in their twenties") descriptions
3. **Reasonable Complexity**: More sophisticated than simple numeric but not overwhelming
4. **Implementation Feasibility**: Clear usage patterns and validation rules
5. **Future-Proof**: Can be extended if more sophisticated age modeling is needed

### Component Definition

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:apparent_age",
  "description": "Stores the perceived age range of an entity, allowing for uncertainty in age perception typical of real-world scenarios.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["minAge", "maxAge"],
    "properties": {
      "minAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Minimum perceived age in years. The youngest the entity could reasonably appear to be."
      },
      "maxAge": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Maximum perceived age in years. The oldest the entity could reasonably appear to be."
      },
      "bestGuess": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Most likely age estimate in years. Optional field representing the most probable age within the range."
      }
    }
  }
}
```

### Alternative: Simple Numeric Age

For scenarios requiring maximum simplicity:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:apparent_age",
  "description": "Stores the apparent age of an entity as a simple numeric value.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["age"],
    "properties": {
      "age": {
        "type": "number",
        "minimum": 0,
        "maximum": 200,
        "description": "Apparent age in years"
      }
    }
  }
}
```

## Implementation Considerations

### Validation Rules

1. **Schema Validation**: Standard JSON Schema validation via AJV
2. **Business Logic Validation**: 
   - `maxAge >= minAge`
   - `bestGuess` (if provided) must be between `minAge` and `maxAge`
   - Age values should be reasonable for the game context

### Integration Patterns

#### With Description Component
```javascript
// Age-aware description generation
const ageComponent = entity.getComponent('core:apparent_age');
const ageDescription = ageComponent.bestGuess 
  ? `appears to be around ${ageComponent.bestGuess} years old`
  : `appears to be between ${ageComponent.minAge} and ${ageComponent.maxAge} years old`;
```

#### With Rule Systems
```javascript
// Age-based rule evaluation
const meetsAgeRequirement = (entity, minimumAge) => {
  const ageComponent = entity.getComponent('core:apparent_age');
  return ageComponent.minAge >= minimumAge; // Conservative check
  // OR: return ageComponent.maxAge >= minimumAge; // Liberal check
  // OR: return (ageComponent.bestGuess || (ageComponent.minAge + ageComponent.maxAge) / 2) >= minimumAge; // Average check
};
```

### Helper Functions

```javascript
// Utility functions for working with age ranges
class AgeUtils {
  static getAverageAge(ageComponent) {
    return ageComponent.bestGuess || (ageComponent.minAge + ageComponent.maxAge) / 2;
  }
  
  static getAgeUncertainty(ageComponent) {
    return ageComponent.maxAge - ageComponent.minAge;
  }
  
  static isAgeInRange(ageComponent, targetAge) {
    return targetAge >= ageComponent.minAge && targetAge <= ageComponent.maxAge;
  }
  
  static formatAgeDescription(ageComponent) {
    if (ageComponent.bestGuess) {
      return `around ${ageComponent.bestGuess} years old`;
    }
    if (ageComponent.minAge === ageComponent.maxAge) {
      return `${ageComponent.minAge} years old`;
    }
    return `between ${ageComponent.minAge} and ${ageComponent.maxAge} years old`;
  }
}
```

## Testing Requirements

### Unit Tests
1. **Schema Validation**: Test valid and invalid age data
2. **Range Validation**: Test minAge <= maxAge constraints
3. **BestGuess Validation**: Test bestGuess within range
4. **Helper Functions**: Test utility function behavior

### Integration Tests
1. **Component Loading**: Test component loads correctly from JSON
2. **Entity Integration**: Test component attachment to entities
3. **Rule System Integration**: Test age-based rule evaluation
4. **Description Integration**: Test age description generation

### Example Test Data

```javascript
// Valid examples
const validAges = [
  { minAge: 25, maxAge: 35 },
  { minAge: 30, maxAge: 30 }, // Exact age
  { minAge: 20, maxAge: 25, bestGuess: 23 },
  { minAge: 0, maxAge: 200 } // Full range
];

// Invalid examples
const invalidAges = [
  { minAge: 35, maxAge: 25 }, // maxAge < minAge
  { minAge: 25, maxAge: 35, bestGuess: 40 }, // bestGuess outside range
  { minAge: -5, maxAge: 25 }, // negative age
  { minAge: 25, maxAge: 250 } // age > maximum
];
```

## Future Enhancement Possibilities

### Version 2 Features
1. **Age Categories**: Add semantic age categories (child, adult, elderly)
2. **Uncertainty Metrics**: Quantified uncertainty levels
3. **Temporal Changes**: Age progression over time
4. **Cultural Modifiers**: Culture-specific age perception

### Version 3 Features
1. **Contextual Perception**: Observer-dependent age perception
2. **Physical vs Mental Age**: Separate physical and mental age estimates
3. **Dynamic Modifiers**: Environmental factors affecting age perception
4. **AI-Driven Estimates**: LLM-generated age assessments

## Conclusion

The Age Range with Uncertainty approach provides the optimal balance of realism, usability, and extensibility for the Living Narrative Engine. It supports both simple and sophisticated age-based mechanics while maintaining compatibility with the existing component architecture.

The specification allows for immediate implementation with the recommended approach while preserving the option to upgrade to more sophisticated age modeling in future versions.