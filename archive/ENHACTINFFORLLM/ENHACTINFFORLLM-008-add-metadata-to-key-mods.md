# ENHACTINFFORLLM-008: Add actionPurpose and actionConsiderWhen to 5 Key Mods

## Status: ✅ COMPLETED

**Completed Date**: 2025-11-25

## Summary

Add the actionPurpose and actionConsiderWhen properties to the mod manifests of 5 key mods to demonstrate the feature and provide immediate value.

## Prerequisites

- ENHACTINFFORLLM-001 must be completed (schema changes)
- All other tickets (002-007) should be completed for full testing

## Files to Touch

- `data/mods/positioning/mod-manifest.json`
- `data/mods/items/mod-manifest.json`
- `data/mods/affection/mod-manifest.json`
- `data/mods/core/mod-manifest.json`
- `data/mods/violence/mod-manifest.json`

## Out of Scope

- DO NOT modify any JavaScript/TypeScript code
- DO NOT modify schema files
- DO NOT modify test files
- DO NOT add metadata to other mods (those can be done incrementally later)

## Implementation Details

### 1. positioning/mod-manifest.json

Add after the `description` field (around line 7):

```json
"actionPurpose": "Change body position, spatial relationships, and physical arrangement relative to others and furniture.",
"actionConsiderWhen": "Getting closer or farther from someone, changing posture (sitting, standing, lying, kneeling), or adjusting facing direction.",
```

### 2. items/mod-manifest.json

Add after the `description` field:

```json
"actionPurpose": "Interact with objects through pickup, examination, use, storage, and transfer between characters and containers.",
"actionConsiderWhen": "Managing inventory, examining interesting objects, sharing items with others, storing belongings, or using functional items.",
```

### 3. affection/mod-manifest.json

Add after the `description` field:

```json
"actionPurpose": "Express caring, supportive physical contact that conveys warmth and comfort, from platonic to romantic gestures.",
"actionConsiderWhen": "Showing tenderness, providing comfort, expressing affection without overt romantic or sexual intent, or building emotional closeness.",
```

### 4. core/mod-manifest.json

Add after the `description` field:

```json
"actionPurpose": "Pass time without taking significant action, allowing events to unfold.",
"actionConsiderWhen": "Choosing to observe rather than act, pausing to think, waiting for someone else to act first, or when no other action is appropriate.",
```

### 5. violence/mod-manifest.json

**Note**: This manifest requires additional fixes:

- Fix `$schema` to use `schema://living-narrative-engine/mod-manifest.schema.json`
- Add missing `description`, `author`, and `gameVersion` fields

Add after the `name` field (since `description` will be added):

```json
"description": "Provides physical violence actions including strikes, grabs, and lethal attacks.",
"author": "Living Narrative Engine",
"gameVersion": ">=0.0.1",
"actionPurpose": "Inflict physical harm through strikes, grabs, and lethal attacks.",
"actionConsiderWhen": "Combat, assault, self-defense, or when a character intends to cause physical pain or injury to another.",
```

## Content Guidelines (from spec)

### actionPurpose Guidelines

1. Be concise: One sentence, 10-25 words maximum
2. Focus on narrative impact: What do these actions accomplish in the story?
3. Use active verbs: "Express", "Enable", "Provide", "Perform"
4. Avoid technical jargon: Write for the LLM/player, not developers
5. Describe the category: Summarize the whole mod's action set

### actionConsiderWhen Guidelines

1. Be contextual: Describe situations, emotions, or narrative beats
2. Use conditional language: "When...", "If...", "During..."
3. Focus on character motivation: What would drive a character to use these?
4. Include emotional/relational context
5. Keep to 15-40 words

## Acceptance Criteria

### Tests That Must Pass

- `npm run validate` passes (all manifests valid)
- `npm run validate:strict` passes
- `npm run test:unit` passes (no regression)
- `npm run test:integration` passes (manifests load correctly)

### Invariants That Must Remain True

1. All modified manifests remain valid JSON
2. All modified manifests validate against updated schema
3. `actionPurpose` is 10-200 characters (schema constraint)
4. `actionConsiderWhen` is 10-200 characters (schema constraint)
5. Content follows guidelines (no technical jargon, focuses on narrative)
6. Game loads and runs correctly with modified manifests

## Verification Steps

1. Run `npm run validate` to ensure all manifests are valid
2. Run `npm run start` and verify game loads without errors
3. Run `npm run test:integration -- --testPathPattern="modManifest"` to verify manifest loading
4. Manually inspect JSON files for proper formatting and placement

## Future Work (NOT in scope for this ticket)

The following 24 mods should receive metadata in future tickets:

- ballet, caressing, clothing, companionship, distress, exercise, gymnastics
- hand-holding, hugging, kissing, metabolism, movement, music, physical-control
- seduction, sex-anal-penetration, sex-breastplay, sex-dry-intimacy
- sex-penile-manual, sex-penile-oral, sex-physical-control, sex-vaginal-penetration
- vampirism, weapons

---

## Outcome

### What Was Actually Changed

**Files Modified:**

1. `data/mods/positioning/mod-manifest.json` - Added `actionPurpose` and `actionConsiderWhen`
2. `data/mods/items/mod-manifest.json` - Added `actionPurpose` and `actionConsiderWhen`
3. `data/mods/affection/mod-manifest.json` - Added `actionPurpose` and `actionConsiderWhen`
4. `data/mods/core/mod-manifest.json` - Added `actionPurpose` and `actionConsiderWhen`
5. `data/mods/violence/mod-manifest.json` - Added `actionPurpose`, `actionConsiderWhen`, PLUS fixed pre-existing issues:
   - Fixed `$schema` (was `http://example.com/...`, now correct)
   - Added missing `description` field
   - Added missing `author` field
   - Added missing `gameVersion` field

### Differences from Original Plan

- **Violence mod required extra fixes**: The ticket originally assumed the violence mod only needed metadata. During implementation, it was discovered the manifest had an incorrect `$schema` and was missing required fields (`description`, `author`, `gameVersion`). These were fixed as part of this ticket.

### Tests Verified

| Test                                                                           | Result                      |
| ------------------------------------------------------------------------------ | --------------------------- |
| `npm run validate`                                                             | ✅ Passes (manifests valid) |
| `npm run validate:strict`                                                      | ✅ Passes                   |
| `tests/integration/prompting/actionFormattingWithMetadata.integration.test.js` | ✅ 13 tests pass            |
| `tests/unit/prompting/modActionMetadataProvider.test.js`                       | ✅ 14 tests pass            |
| `tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js`          | ✅ 11 tests pass            |
| `tests/integration/loaders/modsLoader.integration.test.js`                     | ✅ 7 tests pass             |

**Note**: Pre-existing cross-reference violations (7) in the `core` mod remain. These are unrelated to this ticket and concern missing `items` dependency declarations.
