# Expression Registry

This document serves as a comprehensive registry of all expressions in the Living Narrative Engine emotion system. Use it to:

- Identify gaps in the breadth of possible expressions
- Coordinate with existing priority numbers when creating new expressions
- Decide whether to add expressions to existing mods or create new ones

## Priority System Overview

Expressions use a numeric priority system where **higher numbers = higher priority** (evaluated first). The current range spans from **32 to 95**.

### Priority Distribution

| Range | Count | Category |
|-------|-------|----------|
| 30-39 | 2 | Baseline states (serene, mild) |
| 40-49 | 2 | Low-intensity awareness |
| 50-59 | 5 | Moderate engagement |
| 60-69 | 14 | Active emotional states |
| 70-79 | 36 | Elevated emotional responses |
| 80-89 | 18 | Intense emotional states |
| 90-95 | 7 | Peak intensity expressions |

## Expressions by Mod

### emotions-curiosity-attention (3 expressions)

Expressions related to curiosity and engaged attention.

| Priority | ID | Description |
|----------|----|----|
| 50 | `emotions-curiosity-attention:interested_attention` | Engaged curiosity with focused awareness |
| 66 | `emotions-curiosity-attention:curious_lean_in` | Active curiosity drawing closer to the subject |
| 72 | `emotions-curiosity-attention:fascinated_lock_on` | Intense captivation where attention becomes completely absorbed |

### emotions-absorption (2 expressions)

Expressions related to deep absorption and flow states.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-absorption:entranced_stillness` | Deep absorption where external awareness fades |
| 76 | `emotions-absorption:flow_absorption` | Complete immersion in activity where self-awareness dissolves |

### emotions-disengagement (1 expression)

Expressions related to disengagement and boredom.

| Priority | ID | Description |
|----------|----|----|
| 46 | `emotions-disengagement:bored_disinterest` | Disengaged attention with restless energy |

### emotions-confusion (1 expression)

Expressions related to cognitive confusion and processing difficulty.

| Priority | ID | Description |
|----------|----|----|
| 46 | `emotions-confusion:confused_frown` | Puzzled concentration trying to process something unclear |

### emotions-hope (2 expressions)

Expressions of hope and optimism - forward-looking positive emotional states.

| Priority | ID | Description |
|----------|----|----|
| 61 | `emotions-hope:optimistic_lift` | Rising hopefulness about possibilities |
| 64 | `emotions-hope:hopeful_glimmer` | Tentative hope emerging from uncertainty |

### emotions-anticipation (1 expression)

Forward-looking anticipation states - eager readiness and expectant energy.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-anticipation:eager_anticipation` | Bright, forward-leaning anticipation with restless readiness |

### emotions-craving (1 expression)

Expressions for craving and urge-pull states - narrowed, insistent wanting with constrained agency.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-craving:craving_pull` | Narrowed, insistent "need it" urge that tugs attention forward with restless, slightly painful wanting |

### emotions-elevation (3 expressions)

Expressions of elevation - awe, inspiration, and aesthetic appreciation.

| Priority | ID | Description |
|----------|----|----|
| 64 | `emotions-elevation:aesthetic_appreciation_soften` | Softening in response to beauty or artistry |
| 70 | `emotions-elevation:inspired_uplift` | Creative or motivational surge of energy |
| 78 | `emotions-elevation:awed_transfixion` | Overwhelmed wonder at something magnificent |

### emotions-excitement (2 expressions)

Expressions of excitement, enthusiasm, and euphoric energy.

| Priority | ID | Description |
|----------|----|----|
| 71 | `emotions-excitement:enthusiastic_energy` | Eager excitement and engagement |
| 73 | `emotions-excitement:euphoric_excitement` | Intense happiness bordering on giddiness |

### emotions-joy-play (3 expressions)

Expressions of joy, playfulness, and amusement.

| Priority | ID | Description |
|----------|----|----|
| 56 | `emotions-joy-play:playful_mischief` | Lighthearted troublemaking energy |
| 62 | `emotions-joy-play:amused_chuckle` | Light amusement finding humor in the moment |
| 74 | `emotions-joy-play:joy_burst` | Sudden overflow of happiness |

### emotions-calm (3 expressions)

Expressions of calm, tranquil, and peaceful emotional states.

| Priority | ID | Description |
|----------|----|----|
| 32 | `emotions-calm:serene_calm` | Deep tranquility and inner peace |
| 38 | `emotions-calm:quiet_contentment` | Gentle satisfaction without need for more |
| 76 | `emotions-calm:sigh_of_relief` | Release of tension as worry dissolves |

### emotions-affiliation (5 expressions)

Expressions of social connection, bonding, and interpersonal feelings.

| Priority | ID | Description |
|----------|----|----|
| 55 | `emotions-affiliation:warm_affection` | Tender caring feelings toward another |
| 60 | `emotions-affiliation:compassionate_concern` | Empathetic worry for another's wellbeing |
| 62 | `emotions-affiliation:lonely_isolation` | Painful sense of disconnection and solitude |
| 72 | `emotions-affiliation:tearful_gratitude` | Overwhelming thankfulness bringing tears |
| 74 | `emotions-affiliation:attachment_swell` | Surge of bonding feelings intensifying connection |

### emotions-agency (4 expressions)

Expressions related to personal power, competence, and self-determination.

| Priority | ID | Description |
|----------|----|----|
| 61 | `emotions-agency:quiet_pride` | Humble satisfaction in one's own accomplishment |
| 70 | `emotions-agency:confident_composure` | Assured self-possession and poise |
| 76 | `emotions-agency:determined_focus` | Resolute commitment to achieving a goal |
| 82 | `emotions-agency:triumphant_release` | Victorious exultation after overcoming challenge |

### emotions-anger (8 expressions)

Expressions of frustration, irritation, and rage across intensity levels.

| Priority | ID | Description |
|----------|----|----|
| 36 | `emotions-anger:mild_irritation` | Low-level annoyance that hasn't escalated |
| 76 | `emotions-anger:frustration_spiral` | Mounting irritation as obstacles persist |
| 78 | `emotions-anger:hurt_anger` | Affiliative anger with pain underneath—betrayal, rejection, or grief-adjacent hurt |
| 79 | `emotions-anger:protective_anger` | Warm, connected hostility aimed outward to defend someone valued |
| 80 | `emotions-anger:cold_fury` | Controlled, icy anger beneath the surface |
| 84 | `emotions-anger:suppressed_rage` | Intense anger being forcibly contained |
| 85 | `emotions-anger:explosive_anger` | Sudden violent outburst of rage |
| 90 | `emotions-anger:rage_surge` | Overwhelming fury consuming rational thought |

### emotions-anxiety (3 expressions)

Expressions of unease, controlled worry, and dread.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-anxiety:restless_anxiety` | Unfocused nervousness and unease |
| 72 | `emotions-anxiety:uneasy_restraint` | Controlled unease with deliberate self-restraint—careful, quiet, not yet panic |
| 73 | `emotions-anxiety:dread_settling` | Slow, heavy dread settling in—anticipation turns sour as the body braces without tipping into panic |

### emotions-stress (1 expression)

Expressions of pressure and overload stress.

| Priority | ID | Description |
|----------|----|----|
| 79 | `emotions-stress:stress_overload` | Overloaded-under-pressure stress spike where urgency rises and composure frays |

### emotions-aftershock (1 expression)

Expressions related to adrenaline comedown and aftershock release.

| Priority | ID | Description |
|----------|----|----|
| 79 | `emotions-aftershock:adrenaline_aftershock` | Adrenaline aftershock as threat drops while arousal lingers |

### emotions-trust-distrust (2 expressions)

Expressions related to trust, distrust, suspicion, and interpersonal vigilance states.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-trust-distrust:guard_lowering` | Guard lowering—trust takes the wheel and the body stops bracing, softening into openness |
| 73 | `emotions-trust-distrust:wary_suspicion` | Wary suspicion with interpretive vigilance—reading tone, timing, and inconsistencies |

### emotions-cynicism (1 expression)

Expressions of cynical appraisal and guarded skepticism.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-cynicism:cynical_detachment` | Cynical detachment: an armored, bitter disbelief that stays sharp and evaluative—still engaged enough to judge, but refusing hope or sincerity. |

### emotions-empathy-distress (1 expression)

Empathic overwhelm expressions—prosocial distress when care is present but the felt load becomes too much.

| Priority | ID | Description |
|----------|----|----|
| 82 | `emotions-empathy-distress:empathic_overwhelm` | Prosocial distress flooding the system—care present but overwhelmed |

### emotions-vigilance (1 expression)

Expressions of scanning and monitoring states.

| Priority | ID | Description |
|----------|----|----|
| 84 | `emotions-vigilance:hypervigilant_scanning` | Heightened alertness scanning for threats |

### emotions-alarm (1 expression)

Expressions of alarm-driven mobilization and readiness.

| Priority | ID | Description |
|----------|----|----|
| 84 | `emotions-alarm:alarm_surge` | Sharp mobilization into fight/flight readiness without tipping into panic or freeze |

### emotions-fear-acute (3 expressions)

Expressions of terror, panic, and freeze cluster.

| Priority | ID | Description |
|----------|----|----|
| 88 | `emotions-fear-acute:freeze_response` | Paralyzed stillness in face of overwhelming threat |
| 89 | `emotions-fear-acute:terror_spike` | Sudden, sustained surge of terror—intense fear that clamps the body and narrows cognition without fully tipping into panic or freeze |
| 92 | `emotions-fear-acute:panic_onset` | Escalating terror overwhelming coping ability |

### emotions-courage (1 expression)

Expressions of fear regulation and override.

| Priority | ID | Description |
|----------|----|----|
| 88 | `emotions-courage:steeled_courage` | Summoned bravery overriding fear response |

### emotions-surprise (2 expressions)

Expressions of startle and surprise response.

| Priority | ID | Description |
|----------|----|----|
| 76 | `emotions-surprise:delighted_surprise` | Pleasant surprise—an upbeat jolt that turns into a bright, spontaneous lift |
| 78 | `emotions-surprise:startle_flinch` | Sudden reactive jolt from unexpected stimulus |

### emotions-disgust (1 expression)

Expressions of disgust and revulsion.

| Priority | ID | Description |
|----------|----|----|
| 86 | `emotions-disgust:horror_revulsion` | Deep disgust mixed with fear at something terrible |

### emotions-disappointment (1 expression)

Melancholic disappointment expressions for wistful sadness over unmet expectations.

| Priority | ID | Description |
|----------|----|----|
| 58 | `emotions-disappointment:melancholic_disappointment` | Wistful sadness mixed with lingering disappointment |

### emotions-grief (3 expressions)

Expressions of mourning, tears, and grief breakdown.

| Priority | ID | Description |
|----------|----|----|
| 70 | `emotions-grief:quiet_grief` | Subdued mourning held close to the heart |
| 75 | `emotions-grief:tearful_sorrow` | Open weeping from emotional pain |
| 95 | `emotions-grief:grief_break` | Complete emotional breakdown from overwhelming loss |

### emotions-despair (3 expressions)

Hopelessness collapse driven by agency loss and bleak future expectancy.

| Priority | ID | Description |
|----------|----|----|
| 83 | `emotions-despair:frustrated_helplessness` | Anguished inability to change circumstances |
| 85 | `emotions-despair:deep_despair` | Profound hopelessness and emotional collapse |
| 92 | `emotions-despair:quiet_despair` | Silent, internalized hopelessness |

### emotions-shutdown (2 expressions)

Low engagement and muted affect where the emotional system goes offline.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-shutdown:apathy_blank` | Low-energy motivational shutdown where caring goes offline |
| 73 | `emotions-shutdown:numb_flatness` | Blunted affect and emotional muting without full dissociation |

### emotions-fatigue (1 expression)

Physiological and effort-cost expressions.

| Priority | ID | Description |
|----------|----|----|
| 69 | `emotions-fatigue:fatigue_drag` | Heavy, low-energy slump where effort feels costly |

### emotions-nostalgia (2 expressions)

Memory-recall and reminiscence with past-oriented emotional tone.

| Priority | ID | Description |
|----------|----|----|
| 68 | `emotions-nostalgia:nostalgic_distance` | Bittersweet reminiscence where the past feels closer than the present |
| 71 | `emotions-nostalgia:flat_reminiscence` | Flat reminiscence—memories surface without bite or warmth; a dull, listless recall |

### emotions-dissociation (1 expression)

Protective disconnect with distinct anti-collision gates.

| Priority | ID | Description |
|----------|----|----|
| 86 | `emotions-dissociation:dissociation` | Emotional disconnection as protective response |

### emotions-regret (1 expression)

Counterfactual self-reproach and rumination—"I chose wrong" without collapsing into moral guilt or identity-shame.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-regret:regret_rumination_loop` | Counterfactual self-reproach that keeps replaying alternatives without collapsing into moral guilt or identity-shame |

### emotions-sadness (1 expression)

Everyday sadness expressions - low, heavy moods that weigh down without reaching grief or despair territory.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-sadness:heavy_sadness_slump` | Heavy everyday sadness pulling the body down and slowing thought, without tipping into grief-break, despair, or shutdown |

### emotions-guilt (2 expressions)

Expressions of guilt - "I did bad" repair-oriented responses.

| Priority | ID | Description |
|----------|----|----|
| 55 | `emotions-guilt:lingering_guilt` | Persistent low-level remorse over past action |
| 74 | `emotions-guilt:guilt_driven_repair_impulse` | Urgent need to make amends for wrongdoing |

### emotions-humiliation (1 expression)

Expressions of humiliation - shame combined with social exposure.

| Priority | ID | Description |
|----------|----|----|
| 93 | `emotions-humiliation:humiliation` | Public shame with crushing social exposure |

### emotions-shame (2 expressions)

Expressions of shame - "I am bad" self-condemnation responses.

| Priority | ID | Description |
|----------|----|----|
| 60 | `emotions-shame:resigned_shame` | Accepted self-condemnation without hope of repair |
| 82 | `emotions-shame:shame_spike` | Acute self-condemnation flooding awareness |

### emotions-social-selfconsciousness (2 expressions)

Social self-consciousness expressions capturing embarrassment, awkwardness, and recoverable self-conscious flares.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-social-selfconsciousness:embarrassed_blush` | A quick, recoverable self-conscious flare—heat to the face, awkward recalibration, and a brief urge to hide without collapsing into shame |
| 73 | `emotions-social-selfconsciousness:awkward_stumble` | A brief social fumble: awkwardness spikes, attention narrows, and the body tries to recover smoothness without fully shutting down |

### emotions-social-aversions (3 expressions)

Status-based social aversions like envy, resentment, and contempt—comparison-driven self-worth stings, simmering unfairness, and cool dismissal without possessive or romantic elements.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-social-aversions:contemptuous_dismissal` | A cool, superior dismissal—social dominance expressed through minimization and disregard rather than active hostility |
| 72 | `emotions-social-aversions:envious_pang` | A quick, status-based envy pang: attention narrows into comparison and a self-worth sting, without tipping into possessive jealousy or sexual/romantic pull |
| 72 | `emotions-social-aversions:resentful_simmer` | Long-simmering unfairness: a cold, sticky sense of being wronged that stays narrative-active without tipping into explosive anger |

### emotions-sexual-desire (4 expressions)

Expressions of arousal, wanting, and desire states.

| Priority | ID | Description |
|----------|----|----|
| 71 | `emotions-sexual-desire:sensual_enjoyment` | Pleasure in physical or aesthetic sensations |
| 74 | `emotions-sexual-desire:anticipatory_edge` | Excited tension before expected intimacy |
| 75 | `emotions-sexual-desire:erotic_thrill` | Electric rush of sexual excitement |
| 77 | `emotions-sexual-desire:intense_desire` | Strong wanting focused on specific person or act |

### emotions-sexual-approach (2 expressions)

Expressions of presentation, stance, and seductive style.

| Priority | ID | Description |
|----------|----|----|
| 64 | `emotions-sexual-approach:flirtatious_playfulness` | Teasing romantic interest with light energy |
| 72 | `emotions-sexual-approach:seductive_confidence` | Assured allure in pursuit of attraction |

### emotions-sexual-intimacy-style (2 expressions)

Expressions of bonding, yielding, and intimacy-oriented states.

| Priority | ID | Description |
|----------|----|----|
| 82 | `emotions-sexual-intimacy-style:passionate_longing` | Deep yearning for romantic/sexual connection |
| 82 | `emotions-sexual-intimacy-style:submissive_pleasure` | Enjoyment in yielding control |

### emotions-sexual-conflict (4 expressions)

Expressions of inhibition, anxiety, shame, and frustration in sexual contexts.

| Priority | ID | Description |
|----------|----|----|
| 76 | `emotions-sexual-conflict:sexual_frustration` | Unfulfilled desire creating tension |
| 83 | `emotions-sexual-conflict:nervous_arousal` | Anxious excitement mixing desire with uncertainty |
| 86 | `emotions-sexual-conflict:aroused_but_ashamed_conflict` | Internal conflict between desire and moral discomfort |
| 93 | `emotions-sexual-conflict:self_disgust_arousal` | Shame at one's own arousal response |

### emotions-jealousy-possessiveness (1 expression)

Expressions of jealousy, envy, and possessive feelings.

| Priority | ID | Description |
|----------|----|----|
| 67 | `emotions-jealousy-possessiveness:flustered_jealousy` | Anxious possessiveness over romantic interest |

## Complete Priority Index

All expressions sorted by priority for quick reference:

| Priority | ID | Mod |
|----------|----|----|
| 32 | `serene_calm` | emotions-calm |
| 36 | `mild_irritation` | emotions-anger |
| 38 | `quiet_contentment` | emotions-calm |
| 46 | `bored_disinterest` | emotions-disengagement |
| 46 | `confused_frown` | emotions-confusion |
| 50 | `interested_attention` | emotions-curiosity-attention |
| 55 | `warm_affection` | emotions-affiliation |
| 55 | `lingering_guilt` | emotions-guilt |
| 56 | `playful_mischief` | emotions-joy-play |
| 58 | `melancholic_disappointment` | emotions-disappointment |
| 60 | `compassionate_concern` | emotions-affiliation |
| 60 | `resigned_shame` | emotions-shame |
| 61 | `optimistic_lift` | emotions-hope |
| 61 | `quiet_pride` | emotions-agency |
| 62 | `amused_chuckle` | emotions-joy-play |
| 62 | `lonely_isolation` | emotions-affiliation |
| 64 | `hopeful_glimmer` | emotions-hope |
| 64 | `aesthetic_appreciation_soften` | emotions-elevation |
| 64 | `flirtatious_playfulness` | emotions-sexual-approach |
| 66 | `curious_lean_in` | emotions-curiosity-attention |
| 66 | `restless_anxiety` | emotions-anxiety |
| 66 | `embarrassed_blush` | emotions-social-selfconsciousness |
| 66 | `heavy_sadness_slump` | emotions-sadness |
| 67 | `flustered_jealousy` | emotions-jealousy-possessiveness |
| 68 | `nostalgic_distance` | emotions-nostalgia |
| 69 | `fatigue_drag` | emotions-fatigue |
| 70 | `inspired_uplift` | emotions-elevation |
| 70 | `confident_composure` | emotions-agency |
| 70 | `quiet_grief` | emotions-grief |
| 71 | `enthusiastic_energy` | emotions-excitement |
| 71 | `sensual_enjoyment` | emotions-sexual-desire |
| 71 | `flat_reminiscence` | emotions-nostalgia |
| 72 | `eager_anticipation` | emotions-anticipation |
| 72 | `fascinated_lock_on` | emotions-curiosity-attention |
| 72 | `tearful_gratitude` | emotions-affiliation |
| 72 | `seductive_confidence` | emotions-sexual-approach |
| 72 | `apathy_blank` | emotions-shutdown |
| 72 | `contemptuous_dismissal` | emotions-social-aversions |
| 72 | `uneasy_restraint` | emotions-anxiety |
| 72 | `guard_lowering` | emotions-trust-distrust |
| 72 | `cynical_detachment` | emotions-cynicism |
| 72 | `envious_pang` | emotions-social-aversions |
| 72 | `resentful_simmer` | emotions-social-aversions |
| 73 | `awkward_stumble` | emotions-social-selfconsciousness |
| 73 | `dread_settling` | emotions-anxiety |
| 73 | `wary_suspicion` | emotions-trust-distrust |
| 73 | `euphoric_excitement` | emotions-excitement |
| 73 | `numb_flatness` | emotions-shutdown |
| 74 | `entranced_stillness` | emotions-absorption |
| 74 | `joy_burst` | emotions-joy-play |
| 74 | `attachment_swell` | emotions-affiliation |
| 74 | `guilt_driven_repair_impulse` | emotions-guilt |
| 74 | `anticipatory_edge` | emotions-sexual-desire |
| 74 | `regret_rumination_loop` | emotions-regret |
| 74 | `craving_pull` | emotions-craving |
| 75 | `tearful_sorrow` | emotions-grief |
| 75 | `erotic_thrill` | emotions-sexual-desire |
| 76 | `delighted_surprise` | emotions-surprise |
| 76 | `flow_absorption` | emotions-absorption |
| 76 | `sigh_of_relief` | emotions-calm |
| 76 | `determined_focus` | emotions-agency |
| 76 | `frustration_spiral` | emotions-anger |
| 76 | `sexual_frustration` | emotions-sexual-conflict |
| 77 | `intense_desire` | emotions-sexual-desire |
| 78 | `awed_transfixion` | emotions-elevation |
| 78 | `startle_flinch` | emotions-surprise |
| 78 | `hurt_anger` | emotions-anger |
| 79 | `adrenaline_aftershock` | emotions-aftershock |
| 79 | `stress_overload` | emotions-stress |
| 79 | `protective_anger` | emotions-anger |
| 80 | `cold_fury` | emotions-anger |
| 82 | `triumphant_release` | emotions-agency |
| 82 | `shame_spike` | emotions-shame |
| 82 | `empathic_overwhelm` | emotions-empathy-distress |
| 82 | `passionate_longing` | emotions-sexual-intimacy-style |
| 82 | `submissive_pleasure` | emotions-sexual-intimacy-style |
| 83 | `frustrated_helplessness` | emotions-despair |
| 83 | `nervous_arousal` | emotions-sexual-conflict |
| 84 | `suppressed_rage` | emotions-anger |
| 84 | `hypervigilant_scanning` | emotions-vigilance |
| 84 | `alarm_surge` | emotions-alarm |
| 85 | `explosive_anger` | emotions-anger |
| 85 | `deep_despair` | emotions-despair |
| 86 | `horror_revulsion` | emotions-disgust |
| 86 | `dissociation` | emotions-dissociation |
| 86 | `aroused_but_ashamed_conflict` | emotions-sexual-conflict |
| 88 | `freeze_response` | emotions-fear-acute |
| 88 | `steeled_courage` | emotions-courage |
| 89 | `terror_spike` | emotions-fear-acute |
| 90 | `rage_surge` | emotions-anger |
| 92 | `panic_onset` | emotions-fear-acute |
| 92 | `quiet_despair` | emotions-despair |
| 93 | `humiliation` | emotions-humiliation |
| 93 | `self_disgust_arousal` | emotions-sexual-conflict |
| 95 | `grief_break` | emotions-grief |

## Guidelines for Modders

### Adding Expressions to Existing Mods

Add to an existing mod when:
- The expression fits the mod's emotional category
- You want to fill gaps within that category's priority range
- The expression shares prerequisites patterns with existing expressions

### Creating New Expression Mods

Create a new mod when:
- The expression category doesn't fit existing mods (e.g., expressions related to surprise, disgust as standalone, nostalgia)
- You're creating a themed pack with specific prerequisites
- The expressions require unique components or dependencies

### Priority Selection Guidelines

1. **Check for collisions**: Use the priority index above to avoid duplicate priorities within similar emotional categories
2. **Consider intensity**: Lower priorities (30-50) for baseline/mild states, higher (80-95) for intense/peak states
3. **Leave gaps**: Space priorities by 2-5 to allow future insertions
4. **Category coherence**: Similar expressions within a mod should have related priority ranges

## Statistics

- **Total expressions**: 93
- **Number of mods**: 40
- **Priority range**: 32-95
- **Average expressions per mod**: 2.3

---

*Last updated: Based on analysis of `data/mods/emotions-*/expressions/` directories*
