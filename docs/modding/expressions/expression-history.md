# Expression History

This document lists all expressions that have ever existed in the `data/mods/emotions-*/expressions/` folders throughout the project's git history. It serves as a reference for expressions that may have been removed during system refactoring but could be re-implemented when the emotion system stabilizes.

## Background

The Living Narrative Engine has undergone significant changes to its mood axes, affect traits, and prototypes. During this evolution, many expressions were removed en masse because maintaining their prerequisites through constant system changes became untenable. These expressions remain in the git history and can be restored once the underlying emotion architecture stabilizes.

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total unique expressions** | 161 |
| **Currently active** | 5 |
| **Historical (removed)** | 156 |
| **Unique emotion mods** | 71 |

## Currently Active Expressions

These 5 expressions are currently present in the codebase:

| Expression | Mod | Last Updated |
|------------|-----|--------------|
| `admiration_swell` | emotions-admiration | 2026-01-25 |
| `adoring_tenderness` | emotions-love-attachment | 2026-01-25 |
| `comforted_vulnerability` | emotions-affection-care | 2026-01-25 |
| `flow_absorption` | emotions-absorption | 2026-01-25 |
| `post_loss_settling` | emotions-acceptance | 2026-01-25 |

## Complete Expression Registry

Below is the complete list of all expressions that have existed, organized alphabetically. Each entry shows the expression name, its latest associated mod (for expressions that migrated between mods), and the last modification date in git.

**Legend:**
- ✅ = Currently active in codebase
- ❌ = Historical (removed)

### A

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ✅ | `admiration_swell` | emotions-admiration | 2026-01-25 |
| ✅ | `adoring_tenderness` | emotions-love-attachment | 2026-01-25 |
| ❌ | `adrenaline_aftershock` | emotions-aftershock | 2026-01-25 |
| ❌ | `aesthetic_appreciation_soften` | emotions-elevation | 2026-01-25 |
| ❌ | `afterglow_soft_closeness` | emotions-sexual-intimacy-style | 2026-01-21 |
| ❌ | `alarm_surge` | emotions-alarm | 2026-01-24 |
| ❌ | `amused_chuckle` | emotions-joy-play | 2026-01-25 |
| ❌ | `anticipatory_edge` | emotions-sexual-desire | 2026-01-25 |
| ❌ | `apathy_blank` | emotions-shutdown | 2026-01-25 |
| ❌ | `appeasing_fawn_smile` | emotions-deference-submission | 2026-01-21 |
| ❌ | `aroused_but_ashamed_conflict` | emotions-sexual-conflict | 2026-01-21 |
| ❌ | `assertive_boundary_no` | emotions-assertiveness-boundaries | 2026-01-25 |
| ❌ | `astonished_disbelief` | emotions-surprise | 2026-01-21 |
| ❌ | `attachment_rupture_ache` | emotions-heartbreak | 2026-01-21 |
| ❌ | `attachment_swell` | emotions-affiliation | 2026-01-25 |
| ❌ | `awed_transfixion` | emotions-elevation | 2026-01-21 |
| ❌ | `awkward_indebted_gratitude` | emotions-gratitude | 2026-01-25 |
| ❌ | `awkward_stumble` | emotions-social-selfconsciousness | 2026-01-21 |

### B

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `bittersweet_smile` | emotions-nostalgia | 2026-01-21 |
| ❌ | `bored_disinterest` | emotions-disengagement | 2026-01-25 |
| ❌ | `brakes_engaged_nothing_there` | emotions-sexual-disinterest | 2026-01-21 |
| ❌ | `burnout_wall_bitter_detach` | emotions-burnout | 2026-01-24 |

### C

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `camaraderie_click` | emotions-bonding-synchrony | 2026-01-25 |
| ❌ | `choice_paralysis_hesitation` | emotions-executive-control | 2026-01-21 |
| ❌ | `cognitive_overload_stall` | emotions-confusion | 2026-01-21 |
| ❌ | `cold_fury` | emotions-anger-fury-rage | 2026-01-21 |
| ❌ | `cold_loathing` | emotions-hatred | 2026-01-21 |
| ✅ | `comforted_vulnerability` | emotions-affection-care | 2026-01-25 |
| ❌ | `compassion_fatigue_flatten` | emotions-empathy-distress | 2026-01-21 |
| ❌ | `compassionate_concern` | emotions-affection-care | 2026-01-25 |
| ❌ | `confident_composure` | emotions-assertiveness-boundaries | 2026-01-21 |
| ❌ | `confused_frown` | emotions-confusion | 2026-01-25 |
| ❌ | `contemptuous_dismissal` | emotions-social-aversions | 2026-01-21 |
| ❌ | `cooling_down_regain_composure` | emotions-regulation | 2026-01-21 |
| ❌ | `craving_pull` | emotions-craving | 2026-01-21 |
| ❌ | `curious_lean_in` | emotions-curiosity-attention | 2026-01-25 |
| ❌ | `cynical_detachment` | emotions-cynicism | 2026-01-21 |

### D

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `deep_despair` | emotions-despair | 2026-01-21 |
| ❌ | `defensive_shame_snap` | emotions-shame | 2026-01-21 |
| ❌ | `deferential_yielding` | emotions-deference-submission | 2026-01-21 |
| ❌ | `delighted_surprise` | emotions-surprise | 2026-01-21 |
| ❌ | `determined_focus` | emotions-executive-control | 2026-01-25 |
| ❌ | `dissociation` | emotions-dissociation | 2026-01-25 |
| ❌ | `dominant_pleasure_hold` | emotions-sexual-intimacy-style | 2026-01-25 |
| ❌ | `dread_settling` | emotions-anxiety | 2026-01-21 |

### E

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `eager_anticipation` | emotions-anticipation | 2026-01-25 |
| ❌ | `earned_satisfaction_settle` | emotions-competence-pride | 2026-01-25 |
| ❌ | `embarrassed_blush` | emotions-social-selfconsciousness | 2026-01-21 |
| ❌ | `empathic_joy_resonance` | emotions-empathy-joy | 2026-01-25 |
| ❌ | `empathic_overwhelm` | emotions-empathy-distress | 2026-01-21 |
| ❌ | `enthusiastic_energy` | emotions-excitement | 2026-01-21 |
| ❌ | `entranced_stillness` | emotions-absorption | 2026-01-25 |
| ❌ | `envious_pang` | emotions-social-aversions | 2026-01-21 |
| ❌ | `erotic_thrill` | emotions-sexual-desire | 2026-01-21 |
| ❌ | `euphoric_excitement` | emotions-excitement | 2026-01-25 |
| ❌ | `explosive_anger` | emotions-anger-fury-rage | 2026-01-21 |

### F

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `fascinated_lock_on` | emotions-curiosity-attention | 2026-01-21 |
| ❌ | `fatigue_drag` | emotions-fatigue | 2026-01-25 |
| ❌ | `flat_reminiscence` | emotions-nostalgia | 2026-01-21 |
| ❌ | `flight_impulse_get_out_now` | emotions-fear-acute | 2026-01-21 |
| ❌ | `flirtatious_playfulness` | emotions-sexual-approach | 2026-01-21 |
| ✅ | `flow_absorption` | emotions-absorption | 2026-01-25 |
| ❌ | `flustered_jealousy` | emotions-jealousy-possessiveness | 2026-01-21 |
| ❌ | `forgiven_exhale_release` | emotions-trust-repair | 2026-01-21 |
| ❌ | `forgiving_softening` | emotions-trust-repair | 2026-01-25 |
| ❌ | `freeze_response` | emotions-fear-acute | 2026-01-25 |
| ❌ | `frustrated_helplessness` | emotions-despair | 2026-01-25 |
| ❌ | `frustration_spiral` | emotions-anger-irritation | 2026-01-24 |

### G

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `grief_break` | emotions-grief | 2026-01-25 |
| ❌ | `guard_lowering` | emotions-trust-repair | 2026-01-25 |
| ❌ | `guilt_driven_repair_impulse` | emotions-guilt | 2026-01-25 |

### H

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `hair_trigger_flinch_while_scanning` | emotions-vigilance | 2026-01-21 |
| ❌ | `halting_apology_blurt` | emotions-guilt | 2026-01-21 |
| ❌ | `hard_no_recoil_boundary` | emotions-sexual-repulsion | 2026-01-25 |
| ❌ | `heartbreak_crash` | emotions-heartbreak | 2026-01-21 |
| ❌ | `heavy_sadness_slump` | emotions-sadness | 2026-01-25 |
| ❌ | `hollow_shock_onset` | emotions-grief | 2026-01-25 |
| ❌ | `hopeful_glimmer` | emotions-hope | 2026-01-25 |
| ❌ | `horror_revulsion` | emotions-disgust | 2026-01-21 |
| ❌ | `humiliation` | emotions-humiliation | 2026-01-25 |
| ❌ | `hurt_anger` | emotions-anger-principled-protective | 2026-01-21 |
| ❌ | `hypervigilant_scanning` | emotions-vigilance | 2026-01-25 |

### I

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `imposter_doubt` | emotions-shame | 2026-01-21 |
| ❌ | `insight_click` | emotions-confusion | 2026-01-21 |
| ❌ | `inspired_uplift` | emotions-elevation | 2026-01-25 |
| ❌ | `intense_desire` | emotions-sexual-desire | 2026-01-21 |
| ❌ | `interested_attention` | emotions-curiosity-attention | 2026-01-25 |

### J

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `joy_burst` | emotions-joy-play | 2026-01-25 |

### L

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `lingering_guilt` | emotions-guilt | 2026-01-25 |
| ❌ | `lonely_isolation` | emotions-loneliness-connection | 2026-01-25 |
| ❌ | `lonely_reach_out` | emotions-loneliness-connection | 2026-01-24 |
| ❌ | `lonely_yearning_reach` | emotions-loneliness-connection | 2026-01-21 |

### M

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `melancholic_disappointment` | emotions-disappointment | 2026-01-25 |
| ❌ | `mild_irritation` | emotions-anger-irritation | 2026-01-25 |
| ❌ | `mind_wander_drift` | emotions-disengagement | 2026-01-25 |
| ❌ | `moral_injury_corrode` | emotions-moral-injury | 2026-01-21 |
| ❌ | `moral_revulsion` | emotions-disgust | 2026-01-21 |

### N

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `nervous_arousal` | emotions-sexual-conflict | 2026-01-21 |
| ❌ | `nostalgic_distance` | emotions-nostalgia | 2026-01-21 |
| ❌ | `numb_flatness` | emotions-shutdown | 2026-01-25 |

### O

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `optimistic_lift` | emotions-hope | 2026-01-25 |

### P

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `panic_onset` | emotions-fear-acute | 2026-01-25 |
| ❌ | `passionate_longing` | emotions-sexual-intimacy-style | 2026-01-21 |
| ❌ | `playful_mischief` | emotions-joy-play | 2026-01-25 |
| ✅ | `post_loss_settling` | emotions-acceptance | 2026-01-25 |
| ❌ | `protective_anger` | emotions-anger-principled-protective | 2026-01-25 |
| ❌ | `purposeful_grounding` | emotions-regulation | 2026-01-21 |

### Q

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `quiet_acceptance_after_loss` | emotions-acceptance | 2026-01-25 |
| ❌ | `quiet_contentment` | emotions-calm | 2026-01-25 |
| ❌ | `quiet_despair` | emotions-despair | 2026-01-25 |
| ❌ | `quiet_gratitude` | emotions-gratitude | 2026-01-25 |
| ❌ | `quiet_grief` | emotions-grief | 2026-01-25 |
| ❌ | `quiet_integrity` | emotions-integrity | 2026-01-25 |
| ❌ | `quiet_jealous_monitoring` | emotions-jealousy-possessiveness | 2026-01-21 |
| ❌ | `quiet_pride` | emotions-competence-pride | 2026-01-25 |

### R

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `rage_surge` | emotions-anger-fury-rage | 2026-01-21 |
| ❌ | `regret_rumination_loop` | emotions-regret | 2026-01-25 |
| ❌ | `rejection_sting_pushed_out` | emotions-rejection | 2026-01-21 |
| ❌ | `relief_laughter_discharge` | emotions-joy-play | 2026-01-25 |
| ❌ | `repair_warmth_return` | emotions-trust-repair | 2026-01-25 |
| ❌ | `resentful_simmer` | emotions-social-aversions | 2026-01-21 |
| ❌ | `resigned_shame` | emotions-shame | 2026-01-21 |
| ❌ | `restless_anxiety` | emotions-anxiety | 2026-01-24 |
| ❌ | `righteous_indignation` | emotions-anger-principled-protective | 2026-01-21 |
| ❌ | `risk_thrill_grin` | emotions-excitement | 2026-01-21 |

### S

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `schadenfreude_smirk` | emotions-social-aversions | 2026-01-21 |
| ❌ | `seductive_confidence` | emotions-sexual-approach | 2026-01-24 |
| ❌ | `self_condemning_spike` | emotions-self-directed-anger | 2026-01-21 |
| ❌ | `self_disgust_arousal` | emotions-sexual-conflict | 2026-01-21 |
| ❌ | `self_forgiveness_release` | emotions-guilt | 2026-01-25 |
| ❌ | `sensual_enjoyment` | emotions-sexual-desire | 2026-01-25 |
| ❌ | `serene_calm` | emotions-calm | 2026-01-25 |
| ❌ | `sexual_frustration` | emotions-sexual-conflict | 2026-01-21 |
| ❌ | `shame_spike` | emotions-shame | 2026-01-25 |
| ❌ | `shared_laughter_bond` | emotions-bonding-synchrony | 2026-01-25 |
| ❌ | `sigh_of_relief` | emotions-calm | 2026-01-25 |
| ❌ | `spotlight_dread` | emotions-social-anxiety | 2026-01-21 |
| ❌ | `startle_flinch` | emotions-surprise | 2026-01-25 |
| ❌ | `steady_sympathy` | emotions-affection-care | 2026-01-25 |
| ❌ | `steeled_courage` | emotions-courage | 2026-01-21 |
| ❌ | `stress_overload` | emotions-stress | 2026-01-21 |
| ❌ | `stress_overload` (typo) | emotions-threat-response | 2026-01-10 |
| ❌ | `stunned_processing_pause` | emotions-surprise | 2026-01-24 |
| ❌ | `submissive_pleasure` | emotions-sexual-intimacy-style | 2026-01-21 |
| ❌ | `suppressed_rage` | emotions-anger-fury-rage | 2026-01-21 |

### T

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `tearful_gratitude` | emotions-gratitude | 2026-01-25 |
| ❌ | `tearful_sorrow` | emotions-grief | 2026-01-25 |
| ❌ | `tentative_trust_reach` | emotions-trust-repair | 2026-01-21 |
| ❌ | `terror_spike` | emotions-fear-acute | 2026-01-21 |
| ❌ | `triumphant_release` | emotions-competence-pride | 2026-01-21 |
| ❌ | `trust_fracture` | emotions-distrust-vigilance | 2026-01-21 |
| ❌ | `trusting_surrender` | emotions-trust-repair | 2026-01-21 |

### U

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `uneasy_restraint` | emotions-anxiety | 2026-01-21 |

### V

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `vengeful_focus` | emotions-hatred | 2026-01-21 |
| ❌ | `vicarious_pride_warm_glow` | emotions-bonding-synchrony | 2026-01-25 |
| ❌ | `victory_afterglow_glow` | emotions-competence-pride | 2026-01-21 |
| ❌ | `visceral_recoil` | emotions-disgust | 2026-01-21 |

### W

| Status | Expression | Mod | Last Updated |
|--------|------------|-----|--------------|
| ❌ | `warm_affection` | emotions-affection-care | 2026-01-25 |
| ❌ | `wary_suspicion` | emotions-distrust-vigilance | 2026-01-21 |
| ❌ | `white_knuckle_competence` | emotions-stress | 2026-01-21 |
| ❌ | `worry_rumination_spiral` | emotions-anxiety | 2026-01-21 |

## Expressions by Emotional Domain

Below is a categorization of all expressions by their general emotional domain, useful for identifying coverage gaps.

### Positive Affect
- Joy/Play: `amused_chuckle`, `joy_burst`, `playful_mischief`, `relief_laughter_discharge`
- Excitement: `enthusiastic_energy`, `euphoric_excitement`, `risk_thrill_grin`
- Hope: `hopeful_glimmer`, `optimistic_lift`
- Calm: `quiet_contentment`, `serene_calm`, `sigh_of_relief`
- Elevation: `aesthetic_appreciation_soften`, `awed_transfixion`, `inspired_uplift`

### Social/Affiliative
- Affection/Care: `comforted_vulnerability` ✅, `compassionate_concern`, `steady_sympathy`, `warm_affection`
- Love/Attachment: `adoring_tenderness` ✅
- Gratitude: `awkward_indebted_gratitude`, `quiet_gratitude`, `tearful_gratitude`
- Bonding: `attachment_swell`, `camaraderie_click`, `shared_laughter_bond`, `vicarious_pride_warm_glow`
- Admiration: `admiration_swell` ✅
- Trust/Repair: `forgiven_exhale_release`, `forgiving_softening`, `guard_lowering`, `repair_warmth_return`, `tentative_trust_reach`, `trusting_surrender`
- Empathy: `empathic_joy_resonance`, `empathic_overwhelm`, `compassion_fatigue_flatten`

### Competence/Agency
- Pride: `earned_satisfaction_settle`, `quiet_pride`, `triumphant_release`, `victory_afterglow_glow`
- Executive Control: `choice_paralysis_hesitation`, `determined_focus`
- Boundaries: `assertive_boundary_no`, `confident_composure`
- Integrity: `quiet_integrity`

### Attention/Engagement
- Curiosity: `curious_lean_in`, `fascinated_lock_on`, `interested_attention`
- Absorption: `entranced_stillness`, `flow_absorption` ✅
- Disengagement: `bored_disinterest`, `mind_wander_drift`
- Confusion: `cognitive_overload_stall`, `confused_frown`, `insight_click`

### Threat/Fear
- Acute Fear: `flight_impulse_get_out_now`, `freeze_response`, `panic_onset`, `terror_spike`
- Anxiety: `dread_settling`, `restless_anxiety`, `uneasy_restraint`, `worry_rumination_spiral`
- Alarm: `alarm_surge`
- Vigilance: `hair_trigger_flinch_while_scanning`, `hypervigilant_scanning`
- Courage: `steeled_courage`

### Anger/Hostility
- Fury/Rage: `cold_fury`, `explosive_anger`, `rage_surge`, `suppressed_rage`
- Irritation: `frustration_spiral`, `mild_irritation`
- Principled/Protective: `hurt_anger`, `protective_anger`, `righteous_indignation`
- Regulation: `cooling_down_regain_composure`
- Hatred: `cold_loathing`, `vengeful_focus`
- Self-directed: `self_condemning_spike`

### Social Aversions
- Contempt: `contemptuous_dismissal`
- Envy: `envious_pang`
- Resentment: `resentful_simmer`
- Schadenfreude: `schadenfreude_smirk`
- Distrust: `trust_fracture`, `wary_suspicion`
- Jealousy: `flustered_jealousy`, `quiet_jealous_monitoring`
- Cynicism: `cynical_detachment`

### Loss/Grief
- Grief: `grief_break`, `hollow_shock_onset`, `quiet_grief`, `tearful_sorrow`
- Despair: `deep_despair`, `frustrated_helplessness`, `quiet_despair`
- Disappointment: `melancholic_disappointment`
- Heartbreak: `attachment_rupture_ache`, `heartbreak_crash`
- Rejection: `rejection_sting_pushed_out`
- Acceptance: `post_loss_settling` ✅, `quiet_acceptance_after_loss`
- Loneliness: `lonely_isolation`, `lonely_reach_out`, `lonely_yearning_reach`
- Nostalgia: `bittersweet_smile`, `flat_reminiscence`, `nostalgic_distance`

### Shame/Guilt
- Shame: `defensive_shame_snap`, `imposter_doubt`, `resigned_shame`, `shame_spike`
- Guilt: `guilt_driven_repair_impulse`, `halting_apology_blurt`, `lingering_guilt`, `self_forgiveness_release`
- Humiliation: `humiliation`
- Embarrassment: `awkward_stumble`, `embarrassed_blush`
- Moral Injury: `moral_injury_corrode`
- Regret: `regret_rumination_loop`
- Social Anxiety: `spotlight_dread`

### Shutdown/Depletion
- Shutdown: `apathy_blank`, `numb_flatness`
- Dissociation: `dissociation`
- Fatigue: `fatigue_drag`
- Burnout: `burnout_wall_bitter_detach`
- Stress: `stress_overload`, `white_knuckle_competence`
- Aftershock: `adrenaline_aftershock`

### Disgust
- Physical: `visceral_recoil`
- Moral: `moral_revulsion`
- Horror: `horror_revulsion`

### Surprise
- Positive: `delighted_surprise`
- Negative: `astonished_disbelief`
- Neutral: `startle_flinch`, `stunned_processing_pause`

### Sexual/Desire
- Desire: `anticipatory_edge`, `erotic_thrill`, `intense_desire`, `sensual_enjoyment`
- Approach: `flirtatious_playfulness`, `seductive_confidence`
- Conflict: `aroused_but_ashamed_conflict`, `nervous_arousal`, `self_disgust_arousal`, `sexual_frustration`
- Intimacy Style: `afterglow_soft_closeness`, `dominant_pleasure_hold`, `passionate_longing`, `submissive_pleasure`
- Disinterest: `brakes_engaged_nothing_there`
- Repulsion: `hard_no_recoil_boundary`
- Craving: `craving_pull`

### Deference/Submission
- `appeasing_fawn_smile`, `deferential_yielding`

### Anticipation
- `eager_anticipation`

### Regulation
- `purposeful_grounding`

## Expressions That Migrated Between Mods

Some expressions existed in multiple mods during refactoring. This table shows which expressions moved between mods (the table above shows the latest mod only):

| Expression | Previous Mod(s) | Latest Mod |
|------------|-----------------|------------|
| `comforted_vulnerability` | emotions-affiliation | emotions-affection-care |
| `compassionate_concern` | emotions-affiliation | emotions-affection-care |
| `steady_sympathy` | emotions-affiliation | emotions-affection-care |
| `warm_affection` | emotions-affiliation | emotions-affection-care |
| `flow_absorption` | emotions-attention | emotions-absorption |
| `entranced_stillness` | emotions-attention | emotions-absorption |
| `camaraderie_click` | emotions-affiliation | emotions-bonding-synchrony |
| `shared_laughter_bond` | emotions-affiliation | emotions-bonding-synchrony |
| `vicarious_pride_warm_glow` | emotions-affiliation | emotions-bonding-synchrony |
| `cold_fury` | emotions-anger | emotions-anger-fury-rage |
| `explosive_anger` | emotions-anger | emotions-anger-fury-rage |
| `rage_surge` | emotions-anger | emotions-anger-fury-rage |
| `suppressed_rage` | emotions-anger | emotions-anger-fury-rage |
| `frustration_spiral` | emotions-anger | emotions-anger-irritation |
| `mild_irritation` | emotions-anger | emotions-anger-irritation |
| `hurt_anger` | emotions-anger | emotions-anger-principled-protective |
| `protective_anger` | emotions-anger | emotions-anger-principled-protective |
| `righteous_indignation` | emotions-anger | emotions-anger-principled-protective |
| `curious_lean_in` | emotions-attention | emotions-curiosity-attention |
| `fascinated_lock_on` | emotions-attention | emotions-curiosity-attention |
| `interested_attention` | emotions-attention | emotions-curiosity-attention |
| `bored_disinterest` | emotions-attention | emotions-disengagement |
| `assertive_boundary_no` | emotions-agency | emotions-assertiveness-boundaries |
| `confident_composure` | emotions-agency | emotions-assertiveness-boundaries |
| `choice_paralysis_hesitation` | emotions-agency | emotions-executive-control |
| `determined_focus` | emotions-agency | emotions-executive-control |
| `earned_satisfaction_settle` | emotions-agency | emotions-competence-pride |
| `quiet_pride` | emotions-agency | emotions-competence-pride |
| `triumphant_release` | emotions-agency | emotions-competence-pride |
| `victory_afterglow_glow` | emotions-agency | emotions-competence-pride |
| `lonely_isolation` | emotions-affiliation | emotions-loneliness-connection |
| `lonely_reach_out` | emotions-affiliation | emotions-loneliness-connection |
| `lonely_yearning_reach` | emotions-affiliation | emotions-loneliness-connection |
| `awkward_indebted_gratitude` | emotions-affiliation | emotions-gratitude |
| `quiet_gratitude` | emotions-affiliation | emotions-gratitude |
| `tearful_gratitude` | emotions-affiliation | emotions-gratitude |
| Various sexual expressions | emotions-sexuality | emotions-sexual-* (specialized) |
| Various trust expressions | emotions-trust-distrust | emotions-trust-repair, emotions-distrust-vigilance |

## Notes for Future Restoration

When the mood axes, affect traits, and prototypes stabilize, expressions can be restored by:

1. Finding the expression in git history:
   ```bash
   git log --all --oneline -- "data/mods/emotions-*/expressions/{expression_name}.expression.json"
   ```

2. Restoring the file:
   ```bash
   git show {commit_hash}:data/mods/{mod_name}/expressions/{expression_name}.expression.json > target_path
   ```

3. Updating prerequisites to match the current system's mood axes and affect traits

4. Testing the expression with the current emotion system

---

*Last updated: 2026-01-25*
*Generated from git history analysis*
