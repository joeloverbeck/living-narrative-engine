# SEXMODMOD-001: Audit Legacy Sex Mod Assets and Define Migration Map

## Summary
Establish the authoritative inventory of actions, scopes, conditions, rules, and components that currently live in `data/mods/sex/` so each element can be assigned to the correct target module before files are copied or renamed.

## Prerequisites
- Ability to run `rg` and `jq` locally for JSON inspection.
- Familiarity with the structures described in `specs/sex-mod-modularization-and-color-assignments.spec.md`.

## Tasks
1. Export a manifest of every action, rule, scope, condition, and component ID that resides in `data/mods/sex/` using `jq` or targeted `rg` queries; save the list to `reports/sex-mod/legacy-inventory.md`.
2. For each ID collected, annotate the report with its destination module (`sex-core`, `sex-breastplay`, `sex-penile-manual`, `sex-penile-oral`, `sex-dry-intimacy`, `sex-vaginal-penetration`, or `sex-anal-penetration`).
3. Flag reusable assets (shared scopes, anatomy checks, or components) that must move into `sex-core` so downstream tickets know which files to treat as dependencies rather than module-specific artifacts.
4. Note any references from other mods (use `rg "sex:" data/mods -g"*.json"`) that will break once IDs change; document them in the same report with file paths for follow-up updates.
5. Attach the completed report to the ticket and circulate to stakeholders for sign-off before any migration work starts.

## Acceptance Criteria
- `reports/sex-mod/legacy-inventory.md` exists and lists every legacy `sex:` asset exactly once with a mapped target module.
- Shared assets destined for `sex-core` are clearly labeled in the report.
- All external references to `sex:` IDs are cataloged with file paths and noted for remediation.
- Stakeholder approval (recorded in ticket comments) confirms the inventory is complete.

## Validation
- Provide the command output or script snippet used to generate the inventory.
- Include screenshots or excerpts from the report showing module assignments and flagged cross-mod references.
