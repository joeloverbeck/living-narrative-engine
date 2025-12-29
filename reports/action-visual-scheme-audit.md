# Action Visual Scheme Audit

Scope: data/mods/*/actions/*.action.json
Note: only action visuals were evaluated.

## 1) Mods Sharing Identical Visual Schemes

### Scheme: {"backgroundColor":"#004d61","hoverBackgroundColor":"#006978","hoverTextColor":"#ffffff","textColor":"#e0f7fa"}
- aiming (example: data/mods/aiming/actions/aim_item.action.json)
- drinking (example: data/mods/drinking/actions/drink_entirely.action.json)
- items (example: data/mods/items/actions/apply_lipstick.action.json)
- reading (example: data/mods/reading/actions/read_item.action.json)

### Scheme: {"backgroundColor":"#6c0f36","hoverBackgroundColor":"#861445","hoverTextColor":"#fff2f7","textColor":"#ffe6ef"}
- sex-vaginal-penetration (example: data/mods/sex-vaginal-penetration/actions/pull_penis_out_of_vagina.action.json)
- vampirism (example: data/mods/vampirism/actions/bare_fangs.action.json)

## 2) Mods With Inconsistent Visual Schemes Across Actions

### item-handling
- Scheme A: {"backgroundColor":"#5d4037","hoverBackgroundColor":"#6d4c41","hoverTextColor":"#ffffff","textColor":"#efebe9"}
  - data/mods/item-handling/actions/drop_item.action.json
  - data/mods/item-handling/actions/drop_wielded_item.action.json
  - data/mods/item-handling/actions/pick_up_item.action.json
- Scheme B: {"backgroundColor":"#112a46","hoverBackgroundColor":"#0b3954","hoverTextColor":"#f0f4f8","textColor":"#e6f1ff"}
  - data/mods/item-handling/actions/unwield_item.action.json

### movement
- Scheme A: {"backgroundColor":"#006064","hoverBackgroundColor":"#00838f","hoverTextColor":"#ffffff","textColor":"#e0f7fa"}
  - data/mods/movement/actions/feel_your_way_to_an_exit.action.json
  - data/mods/movement/actions/go.action.json
  - data/mods/movement/actions/pass_through_breach.action.json
  - data/mods/movement/actions/teleport.action.json
- Scheme B: {"backgroundColor":"#1a0033","hoverBackgroundColor":"#330066","hoverTextColor":"#e6ccff","textColor":"#cc99ff"}
  - data/mods/movement/actions/travel_through_dimensions.action.json

### sex-penile-oral
- Scheme A: {"backgroundColor":"#2a1a5e","hoverBackgroundColor":"#372483","hoverTextColor":"#ffffff","textColor":"#ede7f6"}
  - data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis.action.json
  - data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_lying_close.action.json
  - data/mods/sex-penile-oral/actions/breathe_teasingly_on_penis_sitting_close.action.json
  - data/mods/sex-penile-oral/actions/ejaculate_in_mouth.action.json
  - data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json
  - data/mods/sex-penile-oral/actions/lick_glans.action.json
  - data/mods/sex-penile-oral/actions/lick_glans_lying_close.action.json
  - data/mods/sex-penile-oral/actions/lick_glans_sitting_close.action.json
  - data/mods/sex-penile-oral/actions/lick_testicles_lying_close.action.json
  - data/mods/sex-penile-oral/actions/lick_testicles_sensually.action.json
  - data/mods/sex-penile-oral/actions/lick_testicles_sitting_close.action.json
  - data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing.action.json
  - data/mods/sex-penile-oral/actions/nuzzle_penis_through_clothing_sitting_close.action.json
  - data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json
  - data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json
  - data/mods/sex-penile-oral/actions/suck_penis_hard.action.json
  - data/mods/sex-penile-oral/actions/suck_penis_slowly.action.json
  - data/mods/sex-penile-oral/actions/suckle_testicle.action.json
  - data/mods/sex-penile-oral/actions/suckle_testicle_lying_close.action.json
  - data/mods/sex-penile-oral/actions/suckle_testicle_sitting_close.action.json
  - data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json
  - data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json
  - data/mods/sex-penile-oral/actions/take_penis_in_mouth_lying_close.action.json
- Scheme B: {"backgroundColor":"#4a1a1a","hoverBackgroundColor":"#6b2424","hoverTextColor":"#ffffff","textColor":"#ffcccc"}
  - data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json

## 3) Other Inconsistencies

### Actions Missing a visual Scheme
- data/mods/locks/actions/lock_connection.action.json
- data/mods/locks/actions/unlock_connection.action.json

### Key Shape Consistency
- All actions that define `visual` use the same four keys: backgroundColor, hoverBackgroundColor, hoverTextColor, textColor.

