name: "Fondle Penis Action Implementation PRP"
description: |

## Purpose

Create a "fondle penis" action and corresponding rule for the sex mod, mirroring the existing "fondle breasts" action pattern while following established conventions for actions, scopes, and rules in the living-narrative-engine.

## Core Principles

1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal

Implement a complete "fondle penis" action for the sex mod that:

- Creates an action with template "fondle {target}'s penis"
- Requires the actor to have the "anatomy:closeness" component
- Defines a scope for targets with a "penis" body part type in the actor's closeness array
- Dispatches appropriate perceptible events and success messages when executed

## Why

- **User Value**: Expands intimate interaction options in the sex mod
- **Consistency**: Maintains parity with existing fondle_breasts action
- **Integration**: Uses established anatomy and intimacy systems
- **Extensibility**: Follows patterns that allow easy addition of similar actions

## What

### User-Visible Behavior

- Players can select "fondle-penis" action when near partners with appropriate anatomy
- Action displays as "fondle {target}'s penis" in UI
- Success triggers visible event: "{actor} fondles eagerly {target}'s penis"
- Turn ends after successful action

### Technical Requirements

- JSON-based action, scope, condition, and rule definitions
- Integration with anatomy system for body part detection
- Use of intimacy:closeness component for partner filtering
- Proper event dispatching for perception system

### Success Criteria

- [ ] Action appears in available actions when conditions are met
- [ ] Scope correctly filters targets with penis body parts
- [ ] Rule executes and dispatches perceptible events
- [ ] Integration test passes
- [ ] All JSON files validate against schemas
- [ ] Scope linting passes

## All Needed Context

### Documentation & References (list all context needed to implement the feature)

```yaml
# MUST READ - Include these in your context window
- file: data/mods/sex/actions/fondle_breasts.action.json
  why: Direct template for action structure, component requirements

- file: data/mods/sex/scopes/actors_with_breasts_in_intimacy.scope
  why: Template for anatomy-based scope filtering

- file: data/mods/sex/rules/handle_fondle_breasts.rule.json
  why: Rule structure and event dispatching pattern

- file: data/mods/sex/conditions/event-is-action-fondle-breasts.condition.json
  why: Condition structure for action detection

- file: tests/integration/mods/sex/fondle_breasts_action.test.js
  why: Test structure and anatomy setup patterns

- doc: docs/scope-dsl.md
  why: Scope syntax and hasPartOfType operator usage

- doc: docs/json-logic/json-logic for modders.md
  why: JsonLogic patterns for conditions

- file: data/mods/core/macros/logSuccessAndEndTurn.macro.json
  why: Macro reference for rule actions
```

### Current Codebase Structure (relevant parts)

```bash
data/mods/sex/
├── actions/
│   └── fondle_breasts.action.json
├── conditions/
│   └── event-is-action-fondle-breasts.condition.json
├── rules/
│   └── handle_fondle_breasts.rule.json
├── scopes/
│   └── actors_with_breasts_in_intimacy.scope
└── mod-manifest.json

tests/integration/mods/sex/
└── fondle_breasts_action.test.js
```

### Desired Codebase Structure (files to be added)

```bash
data/mods/sex/
├── actions/
│   ├── fondle_breasts.action.json (existing)
│   └── fondle_penis.action.json (NEW - action definition)
├── conditions/
│   ├── event-is-action-fondle-breasts.condition.json (existing)
│   └── event-is-action-fondle-penis.condition.json (NEW - condition for rule trigger)
├── rules/
│   ├── handle_fondle_breasts.rule.json (existing)
│   └── handle_fondle_penis.rule.json (NEW - rule for handling action)
├── scopes/
│   ├── actors_with_breasts_in_intimacy.scope (existing)
│   └── actors_with_penis_in_intimacy.scope (NEW - scope for valid targets)

tests/integration/mods/sex/
├── fondle_breasts_action.test.js (existing)
└── fondle_penis_action.test.js (NEW - integration test)
```

### Known Gotchas & Patterns

```javascript
// CRITICAL: Body part filtering uses custom hasPartOfType operator
// Syntax: [{"hasPartOfType": [".", "breast"]}] where "." refers to current entity

// CRITICAL: Scope names are auto-namespaced by mod
// Define as "actors_with_penis_in_intimacy", accessed as "sex:actors_with_penis_in_intimacy"

// CRITICAL: All IDs must be prefixed with mod namespace
// Use "sex:fondle_penis" not just "fondle_penis"

// CRITICAL: Command verbs use hyphens
// "fondle-penis" not "fondle_penis" or "fondlePenis"

// CRITICAL: Anatomy system structure
// Entity has anatomy:body -> body.root points to torso -> torso has children array with parts
```

## Implementation Blueprint

### Data Models and Structure

All files follow JSON schema validation. Key structures:

- Actions: Define user-available commands with scopes and templates
- Scopes: Define valid targets using DSL syntax
- Conditions: JsonLogic expressions for rule triggers
- Rules: Event handlers that execute when conditions are met

### List of Tasks to Complete (in order)

```yaml
Task 1: Create the scope definition
CREATE data/mods/sex/scopes/actors_with_penis_in_intimacy.scope:
  - COPY pattern from: actors_with_breasts_in_intimacy.scope
  - MODIFY: "breast" to "penis" in hasPartOfType filter
  - KEEP: Same navigation pattern through intimacy:closeness.partners

Task 2: Create the action definition
CREATE data/mods/sex/actions/fondle_penis.action.json:
  - COPY structure from: fondle_breasts.action.json
  - MODIFY: id to "sex:fondle_penis"
  - MODIFY: commandVerb to "fondle-penis"
  - MODIFY: name to "Fondle Penis"
  - MODIFY: description appropriately
  - MODIFY: scope to "sex:actors_with_penis_in_intimacy"
  - MODIFY: template to "fondle {target}'s penis"
  - KEEP: required_components as ["intimacy:closeness"]

Task 3: Create the condition definition
CREATE data/mods/sex/conditions/event-is-action-fondle-penis.condition.json:
  - COPY structure from: event-is-action-fondle-breasts.condition.json
  - MODIFY: id to "sex:event-is-action-fondle-penis"
  - MODIFY: description appropriately
  - MODIFY: logic to check for "sex:fondle_penis" action

Task 4: Create the rule definition
CREATE data/mods/sex/rules/handle_fondle_penis.rule.json:
  - COPY structure from: handle_fondle_breasts.rule.json
  - MODIFY: rule_id to "sex:handle_fondle_penis"
  - MODIFY: comment appropriately
  - MODIFY: condition to "sex:event-is-action-fondle-penis"
  - MODIFY: logMessage in SET_VARIABLE to "fondles eagerly {targetName}'s penis"
  - KEEP: All other action patterns identical (GET_NAME, QUERY_COMPONENT, macro)

Task 5: Create integration test
CREATE tests/integration/mods/sex/fondle_penis_action.test.js:
  - COPY structure from: fondle_breasts_action.test.js
  - MODIFY: Import paths to reference new rule and condition files
  - MODIFY: Test descriptions to reference penis action
  - MODIFY: actionId in dispatch calls to "sex:fondle_penis"
  - MODIFY: Anatomy setup to create penis parts instead of breast parts
  - KEEP: Same test scenarios (success, different action, missing target)
```

### Per-Task Implementation Details

#### Task 1: Scope Definition Pseudocode

```
scope_name := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "penis"]}]
// Navigation: actor -> closeness component -> partners array -> filter for penis parts
```

#### Task 4: Rule Actions Structure

```json
// Critical: Use exact same action sequence as fondle_breasts
1. GET_NAME for actor
2. GET_NAME for target
3. QUERY_COMPONENT for actor position
4. SET_VARIABLE with:
   - logMessage: "fondles eagerly {targetName}'s penis"
   - perceptionType: "sex"
   - locationId from position
   - targetId from event
5. macro: "core:logSuccessAndEndTurn"
```

## Validation Loop

### Level 1: Syntax & JSON Validation

```bash
# Validate JSON syntax for all new files
for file in data/mods/sex/actions/fondle_penis.action.json \
           data/mods/sex/conditions/event-is-action-fondle-penis.condition.json \
           data/mods/sex/rules/handle_fondle_penis.rule.json; do
  jq . "$file" > /dev/null || echo "Invalid JSON in $file"
done

# Run scope linting
npm run scope:lint
# Expected: No errors for new scope file
```

### Level 2: Code Quality

```bash
# Run linting on test file
npm run lint
# Expected: No errors in tests/integration/mods/sex/fondle_penis_action.test.js
```

### Level 3: Integration Tests

```bash
# Run the new test specifically
npm run test:single tests/integration/mods/sex/fondle_penis_action.test.js
# Expected: All tests pass

# Run all tests to ensure no regressions
npm run test
# Expected: All existing tests still pass
```

## Final Validation Checklist

- [ ] All JSON files are valid syntax
- [ ] Scope linting passes: `npm run scope:lint`
- [ ] No ESLint errors: `npm run lint`
- [ ] Integration test passes: `npm run test:single tests/integration/mods/sex/fondle_penis_action.test.js`
- [ ] All tests pass: `npm run test`
- [ ] Action uses correct mod namespace (sex:)
- [ ] Scope follows DSL syntax conventions
- [ ] Rule follows established event handling pattern
- [ ] Test covers success and edge cases

---

## Anti-Patterns to Avoid

- ❌ Don't create new JSON structure patterns - use existing ones exactly
- ❌ Don't skip the condition file - rules need it to trigger
- ❌ Don't change the macro or action sequence in rules
- ❌ Don't forget mod namespacing (sex:) on all IDs
- ❌ Don't use camelCase or underscores in commandVerb - use hyphens
- ❌ Don't create files longer than needed - keep JSON minimal
- ❌ Don't modify existing files unless fixing bugs

## Confidence Score

**9/10** - This PRP provides comprehensive context with exact file references, clear patterns to follow, and executable validation steps. The only uncertainty is potential edge cases in anatomy configuration that may require minor adjustments during implementation.
