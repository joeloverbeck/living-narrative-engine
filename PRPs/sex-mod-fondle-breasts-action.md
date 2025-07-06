# PRP: Sex Mod - Fondle Breasts Action

## Goal

Implement the first action and corresponding rule for the sex mod: a "fondle breasts" action with proper scope definitions, prerequisites, and event handling following the established patterns in the intimacy mod.

## Why

- Establishes the foundation for the sex mod's action system
- Provides a template for future intimate actions in the mod
- Extends the intimacy system with more detailed physical interactions
- Creates reusable patterns for body-part-specific actions

## What

### User-visible behavior:

- Players can select "fondle [target]'s breasts" action for valid targets
- Action requires intimacy:closeness component on actor
- Target must have breast anatomy and be in actor's closeness partners list
- Success dispatches perceptible events with appropriate descriptive text
- Action ends the actor's turn after execution

### Technical requirements:

- Create action definition file: `data/mods/sex/actions/fondle_breasts.action.json`
- Create scope definition file: `data/mods/sex/scopes/actors_with_breasts_in_intimacy.scope`
- Create rule file: `data/mods/sex/rules/handle_fondle_breasts.rule.json`
- Create condition file: `data/mods/sex/conditions/event-is-action-fondle-breasts.condition.json`
- Use custom JsonLogic operators for anatomy checks
- Follow existing naming conventions and patterns

## Success Criteria

1. Action appears in UI for valid actors and targets
2. Action correctly validates prerequisites (intimacy component, target has breasts)
3. Rule fires on attempt_action event and dispatches appropriate events
4. Integration tests pass for the new action and rule
5. No linting or format errors

## All Needed Context

### Documentation References:

- **JsonLogic for modders**: `docs/json-logic/json-logic for modders.md`
- **Scope DSL**: `docs/scope-dsl.md` and `docs/mods/creating-scopes.md`
- **Custom JsonLogic operators**: Implemented in `jsonLogicCustomOperators.js`

### Existing Patterns to Follow:

**Action Pattern (from intimacy mod):**
Check out the kiss_cheek.action.json

**Rule Pattern (from intimacy mod):**
Check out the kiss_cheek.rule.json

**Scope Pattern (from intimacy mod):**

```
actor.components.intimacy:closeness.partners[]
```

### Custom JsonLogic Operators Available:

1. **`hasPartOfType`** - Check if entity has specific body part

   ```json
   { "hasPartOfType": ["target", "breast"] }
   ```

2. **`hasPartWithComponentValue`** - Check body part component values

   ```json
   {
     "hasPartWithComponentValue": [
       "target",
       "descriptors:size",
       "size",
       "large"
     ]
   }
   ```

3. **Standard component checks:**

   ```json
   { "!!": { "var": "actor.components.intimacy:closeness" } }
   ```

4. **Array membership:**
   ```json
   {
     "in": [
       { "var": "actor.id" },
       { "var": "target.components.intimacy:closeness.partners" }
     ]
   }
   ```

### Anatomy System Context:

- Body parts are entities with `anatomy:part` component
- Part type stored in `anatomy:part.subType` (e.g., "breast")
- Parts can have descriptor components for size, shape, etc.
- Root body part accessed via `anatomy:body.body.root`

### File Naming Conventions:

- Actions: `{action_name}.action.json`
- Rules: `handle_{action_name}.rule.json`
- Conditions: `event-is-action-{actionname}.condition.json`
- Scopes: `{descriptive_name}.scope`

### Key Gotchas:

1. All IDs must be namespaced with mod name (e.g., `sex:fondle_breasts`)
2. Template strings use `{target}` placeholder for target name
3. Prerequisites should provide clear failure messages
4. Rules must dispatch both perceptible events and action success events
5. Scope definitions have max depth of 4 property accesses
6. Body part checks should use custom operators, not direct component access

## Implementation Blueprint

### Data Models:

**Action Definition:**

```json
{
  "id": "sex:fondle_breasts",
  "name": "Fondle Breasts",
  "template": "fondle {target}'s breasts",
  "turnEnding": true,
  "components": ["intimacy:closeness"],
  "scope": "sex:actors_with_breasts_in_intimacy",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["target", "breast"]
      },
      "failure_message": "{target} doesn't have the anatomy for that."
    }
  ]
}
```

**Scope Definition:**

```
actor.components.intimacy:closeness.partners[][{"hasPartOfType": ["entity", "breast"]}]
```

**Rule Structure:**

```json
{
  "id": "sex:handle_fondle_breasts",
  "name": "Handle Fondle Breasts Action",
  "trigger": "core:attempt_action",
  "condition": "sex:event-is-action-fondle-breasts",
  "actions": [
    {
      "type": "core:get_entity_name",
      "entity": "{{event.actor}}",
      "saveTo": "actorName"
    },
    {
      "type": "core:get_entity_name",
      "entity": "{{event.target}}",
      "saveTo": "targetName"
    },
    {
      "type": "core:dispatch_perceptible_event",
      "location": "{{event.location}}",
      "text": "{{actorName}} gently fondles {{targetName}}'s breasts."
    },
    {
      "type": "core:dispatch_action_successful",
      "actor": "{{event.actor}}",
      "text": "You fondle {{targetName}}'s breasts."
    },
    {
      "type": "core:end_turn",
      "entity": "{{event.actor}}"
    }
  ]
}
```

### Task List (in order):

1. **Create action definition file**
   - Path: `data/mods/sex/actions/fondle_breasts.action.json`
   - Include proper ID, template, components, scope reference
   - Add prerequisite for breast anatomy check

2. **Create scope definition file**
   - Path: `data/mods/sex/scopes/actors_with_breasts_in_intimacy.scope`
   - Filter intimacy partners who have breast anatomy
   - Use hasPartOfType custom operator

3. **Create condition file**
   - Path: `data/mods/sex/conditions/event-is-action-fondle-breasts.condition.json`
   - Check if event.action equals "sex:fondle_breasts"

4. **Create rule file**
   - Path: `data/mods/sex/rules/handle_fondle_breasts.rule.json`
   - Listen to core:attempt_action
   - Get entity names, dispatch events, end turn

5. **Create integration test**
   - Path: `tests/integration/mods/sex/fondle_breasts_action.test.js`
   - Test action availability with/without prerequisites
   - Test rule firing and event dispatching
   - Test failure cases

6. **Update mod manifest if needed**
   - Ensure new files are properly referenced
   - Check dependencies on intimacy and anatomy mods

## Validation Loop

```bash
# Syntax/Style validation
npm run lint
npm run format

# Run tests
npm run test tests/integration/mods/sex/

# Full test suite
npm run test
```

## Final Validation Checklist

- [ ] Action appears in UI for actors with intimacy:closeness component
- [ ] Action only shows for targets with breast anatomy
- [ ] Action only shows for targets in actor's closeness partners
- [ ] Prerequisite failure messages display correctly
- [ ] Rule fires and dispatches perceptible event
- [ ] Action successful event sent to actor
- [ ] Actor's turn ends after action
- [ ] All tests pass
- [ ] No linting errors
- [ ] Code follows existing patterns

## Anti-Patterns to Avoid

1. **Don't hardcode entity checks** - Use scope definitions
2. **Don't access anatomy directly** - Use custom JsonLogic operators
3. **Don't forget namespacing** - All IDs must start with "sex:"
4. **Don't skip prerequisites** - Always validate anatomy exists
5. **Don't create files over 500 lines** - Split if needed
6. **Don't forget to end turn** - Action should be turnEnding
7. **Don't use complex nested logic** - Keep conditions simple and readable

## Confidence Score

**8/10** - High confidence in successful implementation

The patterns are well-established in the intimacy mod, documentation is comprehensive, and the custom operators provide exactly what's needed for anatomy checks. The main complexity is ensuring proper integration between the intimacy system and anatomy system, but the examples and test patterns provide clear guidance.
