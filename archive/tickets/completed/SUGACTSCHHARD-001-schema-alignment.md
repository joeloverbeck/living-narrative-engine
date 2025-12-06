# SUGACTSCHHARD-001: Align suggested_action payload schema with structured notes taxonomy

Status: Completed

## Goal

Bring `core:suggested_action` in line with the shared structured note contract while keeping backward compatibility for legacy notes without `subjectType`. The current schema already permits `subjectType`, but it inlines a slightly different definition than `common.schema.json` (which requires `subjectType` and disallows the nullable context/timestamp the event allows). The work here is to centralize on the common definition (updated to allow the legacy shape) and point the event schema at it to remove drift.

## File list

- data/schemas/common.schema.json (make structuredNote accept optional `subjectType`, nullable context/timestamp)
- data/mods/core/events/suggested_action.event.json (switch `notes.items` to $ref the shared structuredNote definition)
- src/constants/subjectTypes.js (verify enum alignment only; no changes expected)
- tests/unit/schemas/suggestedActionEvent.schema.test.js (ensure coverage for the $ref + legacy note shape)

## Out of scope

- Changing event IDs or moving event files out of `data/mods/core/events/`
- Modifying actionDecisionWorkflow behavior or LLM prompt extraction logic
- Altering other event schemas beyond `core:suggested_action`

## Acceptance criteria

- **Tests:**
  - `npm run test:single -- tests/unit/schemas/suggestedActionEvent.schema.test.js`
- **Invariants:**
  - Event ID stays `core:suggested_action` and schema `$id` remains under `core:suggested_action#payload`
  - `notes` items still reject unknown properties while accepting both typed and legacy (no `subjectType`) entries
  - `notes` schema is sourced from `common.schema.json#/definitions/structuredNote` (no inline duplication)
  - `subjectType` enum values match `SUBJECT_TYPE_ENUM_VALUES` in `src/constants/subjectTypes.js`

## Outcome

- Realigned the ticket to reflect that `subjectType` was already allowed but the event schema inlined a divergent structured note; centralized it via `common.schema.json#/definitions/structuredNote`.
- Relaxed the shared structured note definition to allow legacy notes without `subjectType` and preserved nullable context/timestamp while keeping additionalProperties blocked.
- Added a schema test asserting legacy notes still reject unexpected fields and updated acceptance to the working command (`npm run test:single -- tests/unit/schemas/suggestedActionEvent.schema.test.js`).
