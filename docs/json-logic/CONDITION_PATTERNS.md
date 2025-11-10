# Condition Patterns Documentation

## Body Part Availability Conditions

### Pattern: Part Availability vs Part Engagement

When creating conditions that check if a body part is "available" for use in an action, follow this semantic pattern:

#### Semantic Meaning

- **"Available"** means the part is not currently engaged/locked in another action
- **"Available"** does NOT mean the part must exist
- An entity without a specific body part should generally be allowed to perform actions (unless the part is absolutely required)

#### Implementation Pattern

For conditions checking if a body part is available (e.g., `actor-mouth-available`):

```json
{
  "logic": {
    "or": [
      {
        "not": {
          "hasPartOfType": ["entity", "partType"]
        }
      },
      {
        "hasPartOfTypeWithComponentValue": [
          "entity",
          "partType",
          "namespace:engagement",
          "locked",
          false
        ]
      },
      {
        "and": [
          {
            "hasPartOfType": ["entity", "partType"]
          },
          {
            "not": {
              "hasPartOfTypeWithComponentValue": [
                "entity",
                "partType",
                "namespace:engagement",
                "locked",
                true
              ]
            }
          }
        ]
      }
    ]
  }
}
```

#### Logic Breakdown

1. **First condition**: Entity has no such body part → returns `true` (available)
   - Rationale: Don't prevent actions for entities without the part

2. **Second condition**: Entity has the part with explicit `locked: false` → returns `true` (available)
   - Rationale: Part exists and is explicitly marked as not engaged

3. **Third condition**: Entity has the part but no engagement component or not locked → returns `true` (available)
   - Rationale: Part exists without engagement tracking, or exists but isn't locked

#### Test Patterns

When testing availability conditions:

```javascript
describe('Part Available Cases', () => {
  test('should return true when entity has no such part', () => {
    // Setup: Entity with no parts of this type
    // Expect: true (available)
  });

  test('should return true when part is explicitly unlocked', () => {
    // Setup: Part with engagement component, locked: false
    // Expect: true (available)
  });

  test('should return true when part has no engagement component', () => {
    // Setup: Part exists but no engagement component
    // Expect: true (available)
  });
});

describe('Part Unavailable Cases', () => {
  test('should return false when part is locked', () => {
    // Setup: Part with engagement component, locked: true
    // Expect: false (not available)
  });
});
```

### Pattern: Part Requirement vs Part Availability

#### Part Requirement

For actions that absolutely require a body part to exist:

- Use `hasPartOfType` to check existence
- Fail if the part doesn't exist

Example: `actor-has-mouth` (different from `actor-mouth-available`):

```json
{
  "logic": {
    "hasPartOfType": ["actor", "mouth"]
  }
}
```

#### Part Availability

For actions that can proceed if the part is not engaged:

- Use the availability pattern shown above
- Allow if part doesn't exist OR is not locked

### Integration with Actions

When using availability conditions in action prerequisites:

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ]
}
```

Note the failure message focuses on engagement, not existence.

## Testing Guidelines

### Unit Tests

- Test each branch of the OR logic separately
- Include edge cases (malformed data, missing components)
- Test with different entity paths (actor, event.target, etc.)

### Integration Tests

- Verify condition references resolve correctly
- Test with actual action prerequisites
- Ensure custom operators are registered
- Mock services appropriately (bodyGraphService, entityManager)

### Common Pitfalls to Avoid

1. **Don't confuse availability with existence**
   - Wrong: "mouth available" means "has mouth"
   - Right: "mouth available" means "mouth not engaged"

2. **Don't prevent actions unnecessarily**
   - Wrong: Blocking actions for entities without optional parts
   - Right: Allowing actions unless part is required AND missing

3. **Test both unit and integration levels**
   - Unit tests: Test condition logic in isolation
   - Integration tests: Test condition usage in action prerequisites

## Custom Operator Requirements

Conditions using body part checks require these custom operators:

- `hasPartOfType`: Checks if entity has parts of a specific type
- `hasPartOfTypeWithComponentValue`: Checks if entity has parts with specific component values

Always ensure custom operators are registered in tests:

```javascript
const customOperators = new JsonLogicCustomOperators({
  logger: mockLogger,
  bodyGraphService: mockBodyGraphService,
  entityManager: mockEntityManager,
});
customOperators.registerOperators(jsonLogicService);
```
