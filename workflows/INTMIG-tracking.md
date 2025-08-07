# INTMIG Migration Tracking

## Migration Status

| Action ID                             | File Path                                                           | Current Format | Migration Status | Validated | Tests Pass | Notes |
| ------------------------------------- | ------------------------------------------------------------------- | -------------- | ---------------- | --------- | ---------- | ----- |
| intimacy:accept_kiss_passively        | data/mods/intimacy/actions/accept_kiss_passively.action.json        | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:break_kiss_gently            | data/mods/intimacy/actions/break_kiss_gently.action.json            | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:brush_hand                   | data/mods/intimacy/actions/brush_hand.action.json                   | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:cup_face_while_kissing       | data/mods/intimacy/actions/cup_face_while_kissing.action.json       | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:explore_mouth_with_tongue    | data/mods/intimacy/actions/explore_mouth_with_tongue.action.json    | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:feel_arm_muscles             | data/mods/intimacy/actions/feel_arm_muscles.action.json             | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:fondle_ass                   | data/mods/intimacy/actions/fondle_ass.action.json                   | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:kiss_back_passionately       | data/mods/intimacy/actions/kiss_back_passionately.action.json       | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:kiss_cheek                   | data/mods/intimacy/actions/kiss_cheek.action.json                   | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:kiss_neck_sensually          | data/mods/intimacy/actions/kiss_neck_sensually.action.json          | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:lean_in_for_deep_kiss        | data/mods/intimacy/actions/lean_in_for_deep_kiss.action.json        | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:lick_lips                    | data/mods/intimacy/actions/lick_lips.action.json                    | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:massage_back                 | data/mods/intimacy/actions/massage_back.action.json                 | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:massage_shoulders            | data/mods/intimacy/actions/massage_shoulders.action.json            | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:nibble_earlobe_playfully     | data/mods/intimacy/actions/nibble_earlobe_playfully.action.json     | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:nibble_lower_lip             | data/mods/intimacy/actions/nibble_lower_lip.action.json             | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:nuzzle_face_into_neck        | data/mods/intimacy/actions/nuzzle_face_into_neck.action.json        | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:peck_on_lips                 | data/mods/intimacy/actions/peck_on_lips.action.json                 | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:place_hand_on_waist          | data/mods/intimacy/actions/place_hand_on_waist.action.json          | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:pull_back_breathlessly       | data/mods/intimacy/actions/pull_back_breathlessly.action.json       | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:pull_back_in_revulsion       | data/mods/intimacy/actions/pull_back_in_revulsion.action.json       | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:suck_on_neck_to_leave_hickey | data/mods/intimacy/actions/suck_on_neck_to_leave_hickey.action.json | scope          | ❌ Not Started   | ❌        | ❌         |       |
| intimacy:suck_on_tongue               | data/mods/intimacy/actions/suck_on_tongue.action.json               | targets        | ✅ Migrated      | ✅        | ✅         | Batch 1 |
| intimacy:thumb_wipe_cheek             | data/mods/intimacy/actions/thumb_wipe_cheek.action.json             | scope          | ❌ Not Started   | ❌        | ❌         |       |

## Migration Summary

- **Total Actions to Migrate**: 24
- **Migrated**: 11
- **In Progress**: 0
- **Not Started**: 13

Note: `intimacy:adjust_clothing` already uses the `targets` format and does not need migration.

## Validation Checklist

- [ ] All 24 actions migrated from `scope` to `targets`
- [ ] No files contain both `scope` and `targets` properties
- [ ] Schema validation passes for all migrated files
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] No regression in test coverage
- [ ] Action tracing validates correctly (if enabled)
- [ ] Performance benchmarks maintained or improved
- [ ] Documentation updated

## Rollback Log

| Date | Action | Reason | Restored From |
| ---- | ------ | ------ | ------------- |
|      |        |        |               |

## Migration Batches

### Batch 1 (INTMIG-002): Kissing Actions

- accept_kiss_passively
- break_kiss_gently
- cup_face_while_kissing
- explore_mouth_with_tongue
- kiss_back_passionately
- lean_in_for_deep_kiss
- nibble_lower_lip
- peck_on_lips
- pull_back_breathlessly
- pull_back_in_revulsion
- suck_on_tongue

### Batch 2 (INTMIG-003): Touch Actions

- brush_hand
- feel_arm_muscles
- fondle_ass
- massage_back
- massage_shoulders
- place_hand_on_waist

### Batch 3 (INTMIG-004): Neck/Face Actions

- kiss_cheek
- kiss_neck_sensually
- nibble_earlobe_playfully
- nuzzle_face_into_neck
- suck_on_neck_to_leave_hickey

### Batch 4 (INTMIG-005): Remaining Actions

- lick_lips
- thumb_wipe_cheek

## Notes

- This tracking document should be updated after each migration step
- Use the validation script to verify migration status: `node scripts/validate-intmig-migration.js`
- Always create a backup before starting any migration batch
- Run tests after each batch to catch issues early
