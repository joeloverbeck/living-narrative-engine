# Legacy Sex Mod Inventory

## Methodology

- Parsed legacy asset IDs with `jq` for JSON and `perl` for ScopeDSL files to guarantee full coverage of actions, rules, conditions, components, and scopes.
- Verified cross-mod references with a filtered `rg` search that excluded the legacy `data/mods/sex/**` directory (removed after migration) to surface any remaining `sex-dry-intimacy:` usages in other manifests.

```bash
jq -r '.id' data/mods/sex/actions/*.json | sort   # executed before the legacy directory was deleted
jq -r '.rule_id' data/mods/sex/rules/*.json | sort   # executed before the legacy directory was deleted
jq -r '.id' data/mods/sex/conditions/*.json | sort   # executed before the legacy directory was deleted
perl -ne 'print "$1\n" if /(sex:[^ ]+)\s*:=/' data/mods/sex/scopes/*.scope | sort   # executed before the legacy directory was deleted
jq -r '.id' data/mods/sex/components/*.json | sort   # executed before the legacy directory was deleted
find data/mods -path 'data/mods/sex' -prune -o -name '*.json' -print0 | xargs -0 rg -n "sex:" || true
```

---

## Actions

| Legacy ID                                      | File                                                                         | Destination Module        | Notes                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| `sex-dry-intimacy:breathe_teasingly_on_penis`               | `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json`               | `sex-penile-oral`         | Oral teasing setup.                    |
| `sex-dry-intimacy:breathe_teasingly_on_penis_sitting_close` | `data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json` | `sex-penile-oral`         | Seated oral-teasing variant.           |
| `sex-dry-intimacy:fondle_breasts`                           | `data/mods/sex-breastplay/actions/fondle_breasts.action.json`                           | `sex-breastplay`          | Core breast stimulation loop.          |
| `sex-dry-intimacy:fondle_breasts_over_clothes`              | `data/mods/sex-breastplay/actions/fondle_breasts_over_clothes.action.json`              | `sex-breastplay`          | Clothed breast contact.                |
| `sex-penile-manual:fondle_penis`               | `data/mods/sex-penile-manual/actions/fondle_penis.action.json`               | `sex-penile-manual`       | Manual penis play.                     |
| `sex-dry-intimacy:grind_ass_against_penis`                  | `data/mods/sex-dry-intimacy/actions/grind_ass_against_penis.action.json`                  | `sex-dry-intimacy`        | Grinding motion with clothing barrier. |
| `sex-dry-intimacy:insert_penis_into_vagina`                 | `data/mods/sex-vaginal-penetration/actions/insert_penis_into_vagina.action.json`                 | `sex-vaginal-penetration` | Vaginal penetration initiator.         |
| `sex-dry-intimacy:insert_primary_penis_into_your_vagina`    | `data/mods/sex-vaginal-penetration/actions/insert_primary_penis_into_your_vagina.action.json`    | `sex-vaginal-penetration` | Receptive-perspective vaginal entry.   |
| `sex-dry-intimacy:lick_glans`                               | `data/mods/sex-penile-oral/actions/lick_glans.action.json`                               | `sex-penile-oral`         | Oral focus on glans.                   |
| `sex-dry-intimacy:lick_testicles_sensually`                 | `data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json`                 | `sex-penile-oral`         | Oral attention to testicles.           |
| `sex-dry-intimacy:nuzzle_penis_through_clothing`            | `data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json`            | `sex-penile-oral`         | Clothed oral teasing.                  |
| `sex-dry-intimacy:press_against_back`                       | `data/mods/sex-breastplay/actions/press_against_back.action.json`                       | `sex-breastplay`          | Chest-to-back breast contact.          |
| `sex-dry-intimacy:press_penis_against_ass_through_clothes`  | `data/mods/sex-dry-intimacy/actions/press_penis_against_ass_through_clothes.action.json`  | `sex-dry-intimacy`        | Clothed frottage against ass.          |
| `sex-penile-manual:pump_penis`                 | `data/mods/sex-penile-manual/actions/pump_penis.action.json`                 | `sex-penile-manual`       | Standing manual stimulation.           |
| `sex-penile-manual:pump_penis_from_up_close`   | `data/mods/sex-penile-manual/actions/pump_penis_from_up_close.action.json`   | `sex-penile-manual`       | Kneeling manual stimulation variant.   |
| `sex-dry-intimacy:ride_penis_greedily`                      | `data/mods/sex-vaginal-penetration/actions/ride_penis_greedily.action.json`                      | `sex-vaginal-penetration` | High-energy vaginal riding.            |
| `sex-dry-intimacy:rub_penis_against_penis`                  | `data/mods/sex-dry-intimacy/actions/rub_penis_against_penis.action.json`                  | `sex-dry-intimacy`        | Frottage between penises.              |
| `sex-dry-intimacy:rub_penis_between_ass_cheeks`             | `data/mods/sex-dry-intimacy/actions/rub_penis_between_ass_cheeks.action.json`             | `sex-dry-intimacy`        | Frottage between cheeks.               |
| `sex-penile-manual:rub_penis_over_clothes`     | `data/mods/sex-penile-manual/actions/rub_penis_over_clothes.action.json`     | `sex-penile-manual`       | Clothed manual stimulation.            |
| `sex-dry-intimacy:rub_pussy_against_penis_through_clothes`  | `data/mods/sex-dry-intimacy/actions/rub_pussy_against_penis_through_clothes.action.json`  | `sex-dry-intimacy`        | Clothed crotch-to-crotch grinding.     |
| `sex-dry-intimacy:rub_vagina_over_clothes`                  | `data/mods/sex-dry-intimacy/actions/rub_vagina_over_clothes.action.json`                  | `sex-dry-intimacy`        | Clothed vulva grinding.                |
| `sex-dry-intimacy:slide_penis_along_labia`                  | `data/mods/sex-vaginal-penetration/actions/slide_penis_along_labia.action.json`                  | `sex-vaginal-penetration` | Pre-penetration teasing.               |
| `sex-dry-intimacy:straddling_penis_milking`                 | `data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json`                 | `sex-vaginal-penetration` | Straddling milking loop.               |
| `sex-dry-intimacy:suckle_testicle`                          | `data/mods/sex-penile-oral/actions/suckle_testicle.action.json`                          | `sex-penile-oral`         | Oral suction on testicle.              |
| `sex-dry-intimacy:tease_asshole_with_glans`                 | `data/mods/sex-anal-penetration/actions/tease_asshole_with_glans.action.json`                 | `sex-anal-penetration`    | Migrated to `sex-anal-penetration:tease_asshole_with_glans`; anal teasing lead-in.                  |

## Rules

| Legacy Rule ID                                    | File                                                                            | Destination Module        | Notes                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------- |
| `handle_breathe_teasingly_on_penis`               | `data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis.rule.json`               | `sex-penile-oral`         | Handles `sex-dry-intimacy:breathe_teasingly_on_penis`.               |
| `handle_breathe_teasingly_on_penis_sitting_close` | `data/mods/sex-penile-oral/rules/handle_breathe_teasingly_on_penis_sitting_close.rule.json` | `sex-penile-oral`         | Handles `sex-dry-intimacy:breathe_teasingly_on_penis_sitting_close`. |
| `handle_fondle_breasts`                           | `data/mods/sex-breastplay/rules/handle_fondle_breasts.rule.json`                           | `sex-breastplay`          | Handles `sex-dry-intimacy:fondle_breasts`.                           |
| `handle_fondle_breasts_over_clothes`              | `data/mods/sex-breastplay/rules/handle_fondle_breasts_over_clothes.rule.json`              | `sex-breastplay`          | Handles `sex-dry-intimacy:fondle_breasts_over_clothes`.              |
| `handle_fondle_penis`                             | `data/mods/sex-penile-manual/rules/handle_fondle_penis.rule.json`               | `sex-penile-manual`       | Handles `sex-penile-manual:fondle_penis`.               |
| `handle_grind_ass_against_penis`                  | `data/mods/sex-dry-intimacy/rules/handle_grind_ass_against_penis.rule.json`                  | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:grind_ass_against_penis`.                  |
| `handle_insert_penis_into_vagina`                 | `data/mods/sex-vaginal-penetration/rules/handle_insert_penis_into_vagina.rule.json`                 | `sex-vaginal-penetration` | Handles `sex-dry-intimacy:insert_penis_into_vagina`.                 |
| `handle_insert_primary_penis_into_your_vagina`    | `data/mods/sex-vaginal-penetration/rules/handle_insert_primary_penis_into_your_vagina.rule.json`    | `sex-vaginal-penetration` | Handles `sex-dry-intimacy:insert_primary_penis_into_your_vagina`.    |
| `handle_lick_glans`                               | `data/mods/sex-penile-oral/rules/handle_lick_glans.rule.json`                               | `sex-penile-oral`         | Handles `sex-dry-intimacy:lick_glans`.                               |
| `handle_lick_testicles_sensually`                 | `data/mods/sex-penile-oral/rules/handle_lick_testicles_sensually.rule.json`                 | `sex-penile-oral`         | Handles `sex-dry-intimacy:lick_testicles_sensually`.                 |
| `handle_nuzzle_penis_through_clothing`            | `data/mods/sex-penile-oral/rules/handle_nuzzle_penis_through_clothing.rule.json`            | `sex-penile-oral`         | Handles `sex-dry-intimacy:nuzzle_penis_through_clothing`.            |
| `handle_press_against_back`                       | `data/mods/sex-breastplay/rules/handle_press_against_back.rule.json`                       | `sex-breastplay`          | Handles `sex-dry-intimacy:press_against_back`.                       |
| `handle_press_penis_against_ass_through_clothes`  | `data/mods/sex-dry-intimacy/rules/handle_press_penis_against_ass_through_clothes.rule.json`  | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:press_penis_against_ass_through_clothes`.  |
| `handle_pump_penis`                               | `data/mods/sex-penile-manual/rules/handle_pump_penis.rule.json`                 | `sex-penile-manual`       | Handles `sex-penile-manual:pump_penis`.                 |
| `handle_pump_penis_from_up_close`                 | `data/mods/sex-penile-manual/rules/handle_pump_penis_from_up_close.rule.json`   | `sex-penile-manual`       | Handles `sex-penile-manual:pump_penis_from_up_close`.   |
| `handle_ride_penis_greedily`                      | `data/mods/sex-vaginal-penetration/rules/handle_ride_penis_greedily.rule.json`                      | `sex-vaginal-penetration` | Handles `sex-dry-intimacy:ride_penis_greedily`.                      |
| `handle_rub_penis_against_penis`                  | `data/mods/sex-dry-intimacy/rules/handle_rub_penis_against_penis.rule.json`                  | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:rub_penis_against_penis`.                  |
| `handle_rub_penis_between_ass_cheeks`             | `data/mods/sex-dry-intimacy/rules/handle_rub_penis_between_ass_cheeks.rule.json`             | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:rub_penis_between_ass_cheeks`.             |
| `handle_rub_penis_over_clothes`                   | `data/mods/sex-penile-manual/rules/handle_rub_penis_over_clothes.rule.json`     | `sex-penile-manual`       | Handles `sex-penile-manual:rub_penis_over_clothes`.     |
| `handle_rub_pussy_against_penis_through_clothes`  | `data/mods/sex-dry-intimacy/rules/handle_rub_pussy_against_penis_through_clothes.rule.json`  | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:rub_pussy_against_penis_through_clothes`.  |
| `handle_rub_vagina_over_clothes`                  | `data/mods/sex-dry-intimacy/rules/handle_rub_vagina_over_clothes.rule.json`                  | `sex-dry-intimacy`        | Handles `sex-dry-intimacy:rub_vagina_over_clothes`.                  |
| `handle_slide_penis_along_labia`                  | `data/mods/sex-vaginal-penetration/rules/handle_slide_penis_along_labia.rule.json`                  | `sex-vaginal-penetration` | Handles `sex-dry-intimacy:slide_penis_along_labia`.                  |
| `handle_straddling_penis_milking`                 | `data/mods/sex-vaginal-penetration/rules/handle_straddling_penis_milking.rule.json`                 | `sex-vaginal-penetration` | Handles `sex-dry-intimacy:straddling_penis_milking`.                 |
| `handle_suckle_testicle`                          | `data/mods/sex-penile-oral/rules/handle_suckle_testicle.rule.json`                          | `sex-penile-oral`         | Handles `sex-dry-intimacy:suckle_testicle`.                          |
| `handle_tease_asshole_with_glans`                 | `data/mods/sex-anal-penetration/rules/handle_tease_asshole_with_glans.rule.json`                 | `sex-anal-penetration`    | Handles `sex-anal-penetration:tease_asshole_with_glans`.                 |

## Conditions

| Legacy ID                                                      | File                                                                                               | Destination Module        | Notes                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| `sex-dry-intimacy:event-is-action-breathe-teasingly-on-penis`               | `data/mods/sex-penile-oral/conditions/event-is-action-breathe-teasingly-on-penis.condition.json`               | `sex-penile-oral`         | Event check for `sex-dry-intimacy:breathe_teasingly_on_penis`. |
| `sex-dry-intimacy:event-is-action-breathe-teasingly-on-penis-sitting-close` | `data/mods/sex-penile-oral/conditions/event-is-action-breathe-teasingly-on-penis-sitting-close.condition.json` | `sex-penile-oral`         | Event check for sitting-close oral tease.         |
| `sex-dry-intimacy:event-is-action-fondle-breasts`                           | `data/mods/sex-breastplay/conditions/event-is-action-fondle-breasts.condition.json`                           | `sex-breastplay`          | Event check for `sex-dry-intimacy:fondle_breasts`.             |
| `sex-dry-intimacy:event-is-action-fondle-breasts-over-clothes`              | `data/mods/sex-breastplay/conditions/event-is-action-fondle-breasts-over-clothes.condition.json`              | `sex-breastplay`          | Event check for clothed fondling.                 |
| `sex-penile-manual:event-is-action-fondle-penis`               | `data/mods/sex-penile-manual/conditions/event-is-action-fondle-penis.condition.json`               | `sex-penile-manual`       | Event check for `sex-penile-manual:fondle_penis`. |
| `sex-dry-intimacy:event-is-action-grind-ass-against-penis`                  | `data/mods/sex-dry-intimacy/conditions/event-is-action-grind-ass-against-penis.condition.json`                  | `sex-dry-intimacy`        | Event check for `sex-dry-intimacy:grind_ass_against_penis`.    |
| `sex-dry-intimacy:event-is-action-insert-penis-into-vagina`                 | `data/mods/sex-vaginal-penetration/conditions/event-is-action-insert-penis-into-vagina.condition.json`                 | `sex-vaginal-penetration` | Event check for `sex-dry-intimacy:insert_penis_into_vagina`.   |
| `sex-dry-intimacy:event-is-action-insert-primary-penis-into-your-vagina`    | `data/mods/sex-vaginal-penetration/conditions/event-is-action-insert-primary-penis-into-your-vagina.condition.json`    | `sex-vaginal-penetration` | Event check for receptive vaginal entry.          |
| `sex-dry-intimacy:event-is-action-lick-glans`                               | `data/mods/sex-penile-oral/conditions/event-is-action-lick-glans.condition.json`                               | `sex-penile-oral`         | Event check for `sex-dry-intimacy:lick_glans`.                 |
| `sex-dry-intimacy:event-is-action-lick-testicles-sensually`                 | `data/mods/sex-penile-oral/conditions/event-is-action-lick-testicles-sensually.condition.json`                 | `sex-penile-oral`         | Event check for `sex-dry-intimacy:lick_testicles_sensually`.   |
| `sex-dry-intimacy:event-is-action-nuzzle-penis-through-clothing`            | `data/mods/sex-penile-oral/conditions/event-is-action-nuzzle-penis-through-clothing.condition.json`            | `sex-penile-oral`         | Event check for clothed oral teasing.             |
| `sex-dry-intimacy:event-is-action-press-against-back`                       | `data/mods/sex-breastplay/conditions/event-is-action-press-against-back.condition.json`                       | `sex-breastplay`          | Event check for `sex-dry-intimacy:press_against_back`.         |
| `sex-dry-intimacy:event-is-action-press-penis-against-ass-through-clothes`  | `data/mods/sex-dry-intimacy/conditions/event-is-action-press-penis-against-ass-through-clothes.condition.json`  | `sex-dry-intimacy`        | Event check for clothed frottage.                 |
| `sex-penile-manual:event-is-action-pump-penis`                 | `data/mods/sex-penile-manual/conditions/event-is-action-pump-penis.condition.json`                 | `sex-penile-manual`       | Event check for `sex-penile-manual:pump_penis`.   |
| `sex-penile-manual:event-is-action-pump-penis-from-up-close`   | `data/mods/sex-penile-manual/conditions/event-is-action-pump-penis-from-up-close.condition.json`   | `sex-penile-manual`       | Event check for kneeling manual play.             |
| `sex-dry-intimacy:event-is-action-ride-penis-greedily`                      | `data/mods/sex-vaginal-penetration/conditions/event-is-action-ride-penis-greedily.condition.json`                      | `sex-vaginal-penetration` | Event check for `sex-dry-intimacy:ride_penis_greedily`.        |
| `sex-dry-intimacy:event-is-action-rub-penis-against-penis`                  | `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-penis-against-penis.condition.json`                  | `sex-dry-intimacy`        | Event check for penis-to-penis frottage.          |
| `sex-dry-intimacy:event-is-action-rub-penis-between-ass-cheeks`             | `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-penis-between-ass-cheeks.condition.json`             | `sex-dry-intimacy`        | Event check for cheek frottage.                   |
| `sex-penile-manual:event-is-action-rub-penis-over-clothes`     | `data/mods/sex-penile-manual/conditions/event-is-action-rub-penis-over-clothes.condition.json`     | `sex-penile-manual`       | Event check for clothed manual play.              |
| `sex-dry-intimacy:event-is-action-rub-pussy-against-penis-through-clothes`  | `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-pussy-against-penis-through-clothes.condition.json`  | `sex-dry-intimacy`        | Event check for clothed crotch grinding.          |
| `sex-dry-intimacy:event-is-action-rub-vagina-over-clothes`                  | `data/mods/sex-dry-intimacy/conditions/event-is-action-rub-vagina-over-clothes.condition.json`                  | `sex-dry-intimacy`        | Event check for clothed vulva grinding.           |
| `sex-dry-intimacy:event-is-action-slide-penis-along-labia`                  | `data/mods/sex-vaginal-penetration/conditions/event-is-action-slide-penis-along-labia.condition.json`                  | `sex-vaginal-penetration` | Event check for labia teasing.                    |
| `sex-dry-intimacy:event-is-action-straddling-penis-milking`                 | `data/mods/sex-vaginal-penetration/conditions/event-is-action-straddling-penis-milking.condition.json`                 | `sex-vaginal-penetration` | Event check for milking loop.                     |
| `sex-dry-intimacy:event-is-action-suckle-testicle`                          | `data/mods/sex-penile-oral/conditions/event-is-action-suckle-testicle.condition.json`                          | `sex-penile-oral`         | Event check for `sex-dry-intimacy:suckle_testicle`.            |
| `sex-dry-intimacy:event-is-action-tease-asshole-with-glans`                 | `data/mods/sex-anal-penetration/conditions/event-is-action-tease-asshole-with-glans.condition.json`                 | `sex-anal-penetration`    | Migrated as `sex-anal-penetration:event-is-action-tease-asshole-with-glans`; event check for anal teasing.                     |

## Scopes

| Legacy Scope ID                                                            | File                                                                                              | Destination Module        | Notes                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `sex-dry-intimacy:actor_kneeling_before_target_with_covered_penis`                      | `data/mods/sex-core/scopes/actor_kneeling_before_target_with_covered_penis.scope`                      | `sex-core`                | **Shared** clothed oral teasing helper.                                                |
| `sex-dry-intimacy:actor_kneeling_before_target_with_penis`                              | `data/mods/sex-core/scopes/actor_kneeling_before_target_with_penis.scope`                              | `sex-core`                | **Shared** between manual (`pump_penis_from_up_close`) and oral actions.      |
| `sex-dry-intimacy:actor_kneeling_before_target_with_testicle`                           | `data/mods/sex-core/scopes/actor_kneeling_before_target_with_testicle.scope`                           | `sex-core`                | **Shared** testicle exposure helper.                                        |
| `sex-dry-intimacy:actors_sitting_close_with_uncovered_penis`                            | `data/mods/sex-core/scopes/actors_sitting_close_with_uncovered_penis.scope`                            | `sex-core`                | **Shared** seated oral teasing helper.                                                 |
| `sex-dry-intimacy:actors_with_breasts_facing_each_other`                                | `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other.scope`                                | `sex-breastplay`          | Drives exposed-breast fondling.                                               |
| `sex-dry-intimacy:actors_with_breasts_facing_each_other_covered`                        | `data/mods/sex-breastplay/scopes/actors_with_breasts_facing_each_other_covered.scope`                        | `sex-breastplay`          | Clothed breast fondling.                                                      |
| `sex-dry-intimacy:actors_with_breasts_in_intimacy`                                      | `data/mods/sex-breastplay/scopes/actors_with_breasts_in_intimacy.scope`                                      | `sex-breastplay`          | Currently unused; keep with breast intimacy helpers.                          |
| `sex-dry-intimacy:actors_with_covered_penis_im_facing_away_from`                        | `data/mods/sex-dry-intimacy/scopes/actors_with_covered_penis_im_facing_away_from.scope`                        | `sex-dry-intimacy`        | Supports clothed grinding from behind.                                        |
| `sex-dry-intimacy:actors_with_exposed_ass_facing_away`                                  | `data/mods/sex-dry-intimacy/scopes/actors_with_exposed_ass_facing_away.scope`                                  | `sex-dry-intimacy`        | Supports penis-between-cheeks frottage.                                       |
| `sex-dry-intimacy:actors_with_exposed_asshole_facing_away`                              | `data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_facing_away.scope`                              | `sex-anal-penetration`    | Migrated to `sex-anal-penetration:actors_with_exposed_asshole_facing_away`; required for anal teasing setups.                                             |
| `sex-dry-intimacy:actors_with_penis_facing_each_other`                                  | `data/mods/sex-core/scopes/actors_with_penis_facing_each_other.scope`                                  | `sex-core`                | **Shared** by manual (`fondle_penis`, `pump_penis`) and frottage actions.     |
| `sex-penile-manual:actors_with_penis_facing_each_other_covered`            | `data/mods/sex-penile-manual/scopes/actors_with_penis_facing_each_other_covered.scope`            | `sex-penile-manual`       | Clothed manual positioning.                                                   |
| `sex-dry-intimacy:actors_with_penis_facing_straddler_covered`                           | `data/mods/sex-dry-intimacy/scopes/actors_with_penis_facing_straddler_covered.scope`                           | `sex-dry-intimacy`        | Supports clothed crotch grinding.                                             |
| `sex-dry-intimacy:actors_with_penis_in_intimacy`                                        | `data/mods/sex-core/scopes/actors_with_penis_in_intimacy.scope`                                        | `sex-core`                | **Shared helper** for any close penis contact (currently unused but neutral). |
| `sex-dry-intimacy:actors_with_uncovered_penis_facing_each_other_or_target_facing_away`  | `data/mods/sex-vaginal-penetration/scopes/actors_with_uncovered_penis_facing_each_other_or_target_facing_away.scope`  | `sex-vaginal-penetration` | Shared across vaginal penetration actions.                                    |
| `sex-dry-intimacy:actors_with_uncovered_vagina_facing_each_other_or_target_facing_away` | `data/mods/sex-vaginal-penetration/scopes/actors_with_uncovered_vagina_facing_each_other_or_target_facing_away.scope` | `sex-vaginal-penetration` | Supports vaginal teasing and entry.                                           |
| `sex-dry-intimacy:actors_with_vagina_facing_each_other_covered`                         | `data/mods/sex-dry-intimacy/scopes/actors_with_vagina_facing_each_other_covered.scope`                         | `sex-dry-intimacy`        | Clothed vulva grinding helper.                                                |

## Components

| Legacy Component ID          | File                                                             | Destination Module | Notes                                                        |
| ---------------------------- | ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `sex-dry-intimacy:being_fucked_vaginally` | `data/mods/sex-core/components/being_fucked_vaginally.component.json` | `sex-core`         | **Shared** vaginal state used by multiple penetration rules. |
| `sex-dry-intimacy:fucking_vaginally`      | `data/mods/sex-core/components/fucking_vaginally.component.json`      | `sex-core`         | **Shared** vaginal state counterpart applied to penetrator.  |

## Cross-Mod References

No JSON files outside the legacy `data/mods/sex/` directory referenced `sex-dry-intimacy:` IDs (`find … | rg "sex:"` returned no matches prior to removal), so renaming could proceed without immediate downstream updates.

## Stakeholder Notes

- Shared assets flagged above (`sex-core` entries) should migrate first to preserve dependencies.
- Module-specific assets can then be redistributed according to the assignments documented here.
