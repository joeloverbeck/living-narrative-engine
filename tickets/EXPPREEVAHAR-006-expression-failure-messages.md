# EXPPREEVAHAR-006: Add failure_message to Expression Definitions

## Summary

Populate `failure_message` for every expression definition to improve diagnostics when prerequisites fail at runtime.

## Background

Only some expressions currently include a `failure_message`. Consistent messages help designers understand why an expression did not trigger.

## File List (Expected to Touch)

### Existing Files
- `data/mods/emotions/expressions/*.json`

## Out of Scope (MUST NOT Change)

- Expression prerequisite logic or thresholds
- Runtime evaluation behavior in `src/expressions/`
- Validation pipeline changes

## Implementation Details

- Add or fill `failure_message` fields across the expression pack.
- Keep messages short, actionable, and consistent in style.
- Do not alter ids, tags, priorities, or prerequisite structures.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate:expressions`

### Invariants That Must Remain True

1. Expression ids, tags, priorities, and prerequisites remain unchanged.
2. Message additions are the only diffs in the expression JSON files.
3. No new non-ASCII characters are introduced into JSON content.

