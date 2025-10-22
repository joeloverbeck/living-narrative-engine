# SEXMODMOD-009: Finalize Documentation, Color Registry, and Legacy Manifest Decommissioning

## Summary
Update ecosystem documentation and color registries to reflect the new modular structure, ensure the WCAG palette file records module usage, and retire or downsize the original `sex` manifest without breaking compatibility.

## Prerequisites
- Completion of module migrations from `SEXMODMOD-002` through `SEXMODMOD-008`.
- Approval of the asset inventory from `SEXMODMOD-001`.

## Tasks
1. Update `specs/wcag-compliant-color-combinations.spec.md` Section 12 to mark each palette as **USED BY** its respective module (`sex-core`, `sex-breastplay`, `sex-penile-manual`, `sex-penile-oral`, `sex-dry-intimacy`, `sex-vaginal-penetration`, `sex-anal-penetration`).
2. Edit any catalog or documentation pages (e.g., `docs/mod-catalog/` if present) to describe the new modules, their scopes, and color identities; include migration guidance for mod authors.
3. Slim the legacy `data/mods/sex/mod-manifest.json` to either a compatibility wrapper (forwarding dependencies to the new modules) or decommission it entirely per stakeholder decision, ensuring no duplicate actions remain.
4. Search the repository for `"sex:"` references and update lingering IDs to the new module namespaces or to `sex-core` where appropriate, leaving documented exceptions only if necessary for backwards compatibility.
5. Run `npm run validate:ecosystem` for the full suite to confirm all manifests load cleanly after documentation and manifest updates.
6. Record migration notes in `docs/changelogs/` (or create `docs/changelogs/sex-modularization.md`) summarizing the restructuring steps and any required save-game migration guidance.

## Acceptance Criteria
- WCAG color spec explicitly notes each module usage as described.
- Documentation reflects the modular structure and provides migration instructions.
- Legacy `sex` manifest is either a minimal compatibility shell or removed, with no duplicate assets remaining.
- Repository-wide search finds no outdated `sex:` IDs except intentional compatibility stubs documented in the changelog.
- Full ecosystem validation passes.

## Validation
- Attach the full `npm run validate:ecosystem` command output.
- Provide links or screenshots to updated documentation and color spec sections.
