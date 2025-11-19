# GOARESTASSCHVAL-006 – Align task-schema documentation with canonical assets

## Problem
Docs (`authoring-planning-tasks` / `task-loading`) describe canonical directory layouts, task/refinement file samples, and validation behavior that do not currently exist in the repo. After shipping real assets + stricter validation, the docs must be updated to reference actual file paths, new manifest keys, and loader failure messaging.

## Proposed scope
Refresh the GOAP authoring docs to walk through the real `data/mods/core/tasks/*.task.json` files and their partner refinement methods. Document how planning scopes bind entities, how `$ref` resolution works (including the new path restrictions), and what errors modders should expect when scopes or methods are missing. Ensure any diagrams or snippets link to the canonical files and remove stale instructions that referenced mock data.

## File list
- `docs/modding/authoring-planning-tasks.md`
- `docs/goap/task-loading.md`
- `docs/goap/examples/README.md` (if it references task samples)
- `README.md` / `docs/mods/mod_manifest_format.md` (only where new manifest keys must be mentioned)

## Out of scope
- Creating additional tutorial mods or guides unrelated to planning tasks.
- Changing schema definitions or loader code.
- Documenting GOAP features outside scope validation, refinement references, and canonical content.

## Acceptance criteria
### Tests
- `npm run lint` (docs build steps rely on linting for MD rules where configured).
- `npm run test:unit -- docs` (if markdown lint tests exist; otherwise ensure `npm run test:unit` remains green).

### Invariants
- Documentation continues referencing the same schema version (1.0.0) and does not introduce unsupported API promises.
- Links/paths resolve to committed files within the repo (no external canonical samples).
- Examples remain TypeScript/JSON focused without inserting executable JS beyond existing patterns.
