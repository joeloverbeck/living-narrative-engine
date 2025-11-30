# RESTARNONDETACT-002: Positioning Restrain Components

## Description
Add `positioning:restraining` and `positioning:being_restrained` components modeled after hugging/being_hugged to represent actors restraining targets. Include required cross-entity references (`restrained_entity_id` and `restraining_entity_id`), and activityMetadata templates for status descriptions. Register both components in the positioning mod manifest.

## Expected File List
- `data/mods/positioning/components/restraining.component.json` (Add)
- `data/mods/positioning/components/being_restrained.component.json` (Add)
- `data/mods/positioning/mod-manifest.json` (Modify)

## Out of Scope
- Changes to existing positioning components (e.g., hugging/being_hugged/fallen).
- Action, rule, or condition work for restraining; no edits under `data/mods/physical-control/` or `data/mods/skills/`.
- Runtime logic or macros; this ticket is schema/content only.

## Acceptance Criteria
- Component schemas mirror the structure/pattern validation of hugging/being_hugged, including required entity references and additionalProperties disabled.
- activityMetadata entries provide templates `{actor} is restraining {target}` and `{actor} is restrained by {target}` with correct targetRole assignments and priority ordering (restraining slightly higher than being_restrained).
- Positioning manifest lists both new components without dropping or renaming existing entries.
- Commands: `npm run lint` and `npm run validate:quick` pass.

### Invariants
- No changes to other positioning assets or activityMetadata priorities beyond adding the two new entries.
- No new actions/rules/conditions introduced; physical-control gameplay is unaffected by this ticket alone.
