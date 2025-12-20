# BREMODSAWTHRBARBLO-002: Add craft skill component

Goal: introduce the skills:craft_skill component for contested sawing actions.

# File list it expects to touch
- data/mods/skills/components/craft_skill.component.json
- tests/unit/mods/skills/components/craftSkill.component.test.js

# Out of scope
- Any changes to core, blockers, or breaching mods.
- Updates to existing tests or documentation.
- Any changes to existing skill components.

# Acceptance criteria
## Specific tests that must pass
- npm run test:unit -- tests/unit/mods/skills/components/craftSkill.component.test.js
- npm run validate:fast

## Invariants that must remain true
- Skill values remain bounded 0-100 with default 10.
- The component schema rejects additional properties.
- No other skills mod content is modified.

# Outcome
- Created `data/mods/skills/components/craft_skill.component.json` as specified.
- Created `tests/unit/mods/skills/components/craftSkill.component.test.js` to verify the component schema.
- Verified that the component passes validation and unit tests.
- Updated ticket to reflect the correct test file location and scope regarding test creation.
