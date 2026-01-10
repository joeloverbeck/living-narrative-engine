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
| 70-79 | 30 | Elevated emotional responses |
| 80-89 | 17 | Intense emotional states |
| 90-95 | 7 | Peak intensity expressions |

## Expressions by Mod

### emotions-attention (7 expressions)

Expressions related to focus, interest, and cognitive engagement.

| Priority | ID | Description |
|----------|----|----|
| 46 | `emotions-attention:bored_disinterest` | Disengaged attention with restless energy |
| 46 | `emotions-attention:confused_frown` | Puzzled concentration trying to process something unclear |
| 50 | `emotions-attention:interested_attention` | Engaged curiosity with focused awareness |
| 66 | `emotions-attention:curious_lean_in` | Active curiosity drawing closer to the subject |
| 72 | `emotions-attention:fascinated_lock_on` | Intense captivation where attention becomes completely absorbed |
| 74 | `emotions-attention:entranced_stillness` | Deep absorption where external awareness fades |
| 76 | `emotions-attention:flow_absorption` | Complete immersion in activity where self-awareness dissolves |

### emotions-positive-affect (13 expressions)

Expressions of positive emotional states including joy, hope, and contentment.

| Priority | ID | Description |
|----------|----|----|
| 32 | `emotions-positive-affect:serene_calm` | Deep tranquility and inner peace |
| 38 | `emotions-positive-affect:quiet_contentment` | Gentle satisfaction without need for more |
| 56 | `emotions-positive-affect:playful_mischief` | Lighthearted troublemaking energy |
| 61 | `emotions-positive-affect:optimistic_lift` | Rising hopefulness about possibilities |
| 62 | `emotions-positive-affect:amused_chuckle` | Light amusement finding humor in the moment |
| 64 | `emotions-positive-affect:hopeful_glimmer` | Tentative hope emerging from uncertainty |
| 64 | `emotions-positive-affect:aesthetic_appreciation_soften` | Softening in response to beauty or artistry |
| 70 | `emotions-positive-affect:inspired_uplift` | Creative or motivational surge of energy |
| 71 | `emotions-positive-affect:enthusiastic_energy` | Eager excitement and engagement |
| 73 | `emotions-positive-affect:euphoric_excitement` | Intense happiness bordering on giddiness |
| 74 | `emotions-positive-affect:joy_burst` | Sudden overflow of happiness |
| 76 | `emotions-positive-affect:sigh_of_relief` | Release of tension as worry dissolves |
| 78 | `emotions-positive-affect:awed_transfixion` | Overwhelmed wonder at something magnificent |

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

### emotions-threat-response (11 expressions)

Expressions related to fear, anxiety, and responses to perceived danger.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-threat-response:restless_anxiety` | Unfocused nervousness and unease |
| 72 | `emotions-threat-response:uneasy_restraint` | Controlled unease with deliberate self-restraint—careful, quiet, not yet panic |
| 73 | `emotions-threat-response:dread_settling` | Slow, heavy dread settling in—anticipation turns sour as the body braces without tipping into panic |
| 78 | `emotions-threat-response:startle_flinch` | Sudden reactive jolt from unexpected stimulus |
| 79 | `emotions-threat-response:stress_overload` | Overloaded-under-pressure stress spike where urgency rises and composure frays |
| 84 | `emotions-threat-response:hypervigilant_scanning` | Heightened alertness scanning for threats |
| 86 | `emotions-threat-response:horror_revulsion` | Deep disgust mixed with fear at something terrible |
| 88 | `emotions-threat-response:freeze_response` | Paralyzed stillness in face of overwhelming threat |
| 88 | `emotions-threat-response:steeled_courage` | Summoned bravery overriding fear response |
| 89 | `emotions-threat-response:terror_spike` | Sudden, sustained surge of terror—intense fear that clamps the body and narrows cognition without fully tipping into panic or freeze |
| 92 | `emotions-threat-response:panic_onset` | Escalating terror overwhelming coping ability |

### emotions-loss (13 expressions)

Expressions of grief, sadness, and responses to loss or disappointment.

| Priority | ID | Description |
|----------|----|----|
| 58 | `emotions-loss:melancholic_disappointment` | Sad acceptance of unmet expectations |
| 68 | `emotions-loss:nostalgic_distance` | Bittersweet reminiscence where the past feels closer than the present |
| 69 | `emotions-loss:fatigue_drag` | Heavy, low-energy slump where effort feels costly |
| 70 | `emotions-loss:quiet_grief` | Subdued mourning held close to the heart |
| 71 | `emotions-loss:flat_reminiscence` | Flat reminiscence—memories surface without bite or warmth; a dull, listless recall |
| 72 | `emotions-loss:apathy_blank` | Low-energy motivational shutdown where caring goes offline |
| 73 | `emotions-loss:numb_flatness` | Blunted affect and emotional muting without full dissociation |
| 75 | `emotions-loss:tearful_sorrow` | Open weeping from emotional pain |
| 83 | `emotions-loss:frustrated_helplessness` | Anguished inability to change circumstances |
| 85 | `emotions-loss:deep_despair` | Profound hopelessness and emotional collapse |
| 86 | `emotions-loss:dissociation` | Emotional disconnection as protective response |
| 92 | `emotions-loss:quiet_despair` | Silent, internalized hopelessness |
| 95 | `emotions-loss:grief_break` | Complete emotional breakdown from overwhelming loss |

### emotions-moral (5 expressions)

Expressions related to guilt, shame, and moral self-evaluation.

| Priority | ID | Description |
|----------|----|----|
| 55 | `emotions-moral:lingering_guilt` | Persistent low-level remorse over past action |
| 60 | `emotions-moral:resigned_shame` | Accepted self-condemnation without hope of repair |
| 74 | `emotions-moral:guilt_driven_repair_impulse` | Urgent need to make amends for wrongdoing |
| 82 | `emotions-moral:shame_spike` | Acute self-condemnation flooding awareness |
| 93 | `emotions-moral:humiliation` | Public shame with crushing social exposure |

### emotions-sexuality (13 expressions)

Expressions related to desire, arousal, and sexual/romantic feelings.

| Priority | ID | Description |
|----------|----|----|
| 64 | `emotions-sexuality:flirtatious_playfulness` | Teasing romantic interest with light energy |
| 67 | `emotions-sexuality:flustered_jealousy` | Anxious possessiveness over romantic interest |
| 71 | `emotions-sexuality:sensual_enjoyment` | Pleasure in physical or aesthetic sensations |
| 72 | `emotions-sexuality:seductive_confidence` | Assured allure in pursuit of attraction |
| 74 | `emotions-sexuality:anticipatory_edge` | Excited tension before expected intimacy |
| 75 | `emotions-sexuality:erotic_thrill` | Electric rush of sexual excitement |
| 76 | `emotions-sexuality:sexual_frustration` | Unfulfilled desire creating tension |
| 77 | `emotions-sexuality:intense_desire` | Strong wanting focused on specific person or act |
| 82 | `emotions-sexuality:passionate_longing` | Deep yearning for romantic/sexual connection |
| 82 | `emotions-sexuality:submissive_pleasure` | Enjoyment in yielding control |
| 83 | `emotions-sexuality:nervous_arousal` | Anxious excitement mixing desire with uncertainty |
| 86 | `emotions-sexuality:aroused_but_ashamed_conflict` | Internal conflict between desire and moral discomfort |
| 93 | `emotions-sexuality:self_disgust_arousal` | Shame at one's own arousal response |

## Complete Priority Index

All expressions sorted by priority for quick reference:

| Priority | ID | Mod |
|----------|----|----|
| 32 | `serene_calm` | emotions-positive-affect |
| 36 | `mild_irritation` | emotions-anger |
| 38 | `quiet_contentment` | emotions-positive-affect |
| 46 | `bored_disinterest` | emotions-attention |
| 46 | `confused_frown` | emotions-attention |
| 50 | `interested_attention` | emotions-attention |
| 55 | `warm_affection` | emotions-affiliation |
| 55 | `lingering_guilt` | emotions-moral |
| 56 | `playful_mischief` | emotions-positive-affect |
| 58 | `melancholic_disappointment` | emotions-loss |
| 60 | `compassionate_concern` | emotions-affiliation |
| 60 | `resigned_shame` | emotions-moral |
| 61 | `optimistic_lift` | emotions-positive-affect |
| 61 | `quiet_pride` | emotions-agency |
| 62 | `amused_chuckle` | emotions-positive-affect |
| 62 | `lonely_isolation` | emotions-affiliation |
| 64 | `hopeful_glimmer` | emotions-positive-affect |
| 64 | `aesthetic_appreciation_soften` | emotions-positive-affect |
| 64 | `flirtatious_playfulness` | emotions-sexuality |
| 66 | `curious_lean_in` | emotions-attention |
| 66 | `restless_anxiety` | emotions-threat-response |
| 67 | `flustered_jealousy` | emotions-sexuality |
| 68 | `nostalgic_distance` | emotions-loss |
| 69 | `fatigue_drag` | emotions-loss |
| 70 | `inspired_uplift` | emotions-positive-affect |
| 70 | `confident_composure` | emotions-agency |
| 70 | `quiet_grief` | emotions-loss |
| 71 | `enthusiastic_energy` | emotions-positive-affect |
| 71 | `sensual_enjoyment` | emotions-sexuality |
| 71 | `flat_reminiscence` | emotions-loss |
| 72 | `fascinated_lock_on` | emotions-attention |
| 72 | `tearful_gratitude` | emotions-affiliation |
| 72 | `seductive_confidence` | emotions-sexuality |
| 72 | `apathy_blank` | emotions-loss |
| 72 | `uneasy_restraint` | emotions-threat-response |
| 73 | `dread_settling` | emotions-threat-response |
| 73 | `euphoric_excitement` | emotions-positive-affect |
| 73 | `numb_flatness` | emotions-loss |
| 74 | `entranced_stillness` | emotions-attention |
| 74 | `joy_burst` | emotions-positive-affect |
| 74 | `attachment_swell` | emotions-affiliation |
| 74 | `guilt_driven_repair_impulse` | emotions-moral |
| 74 | `anticipatory_edge` | emotions-sexuality |
| 75 | `tearful_sorrow` | emotions-loss |
| 75 | `erotic_thrill` | emotions-sexuality |
| 76 | `flow_absorption` | emotions-attention |
| 76 | `sigh_of_relief` | emotions-positive-affect |
| 76 | `determined_focus` | emotions-agency |
| 76 | `frustration_spiral` | emotions-anger |
| 76 | `sexual_frustration` | emotions-sexuality |
| 77 | `intense_desire` | emotions-sexuality |
| 78 | `awed_transfixion` | emotions-positive-affect |
| 78 | `startle_flinch` | emotions-threat-response |
| 78 | `hurt_anger` | emotions-anger |
| 79 | `stress_overload` | emotions-threat-response |
| 79 | `protective_anger` | emotions-anger |
| 80 | `cold_fury` | emotions-anger |
| 82 | `triumphant_release` | emotions-agency |
| 82 | `shame_spike` | emotions-moral |
| 82 | `passionate_longing` | emotions-sexuality |
| 82 | `submissive_pleasure` | emotions-sexuality |
| 83 | `frustrated_helplessness` | emotions-loss |
| 83 | `nervous_arousal` | emotions-sexuality |
| 84 | `suppressed_rage` | emotions-anger |
| 84 | `hypervigilant_scanning` | emotions-threat-response |
| 85 | `explosive_anger` | emotions-anger |
| 85 | `deep_despair` | emotions-loss |
| 86 | `horror_revulsion` | emotions-threat-response |
| 86 | `dissociation` | emotions-loss |
| 86 | `aroused_but_ashamed_conflict` | emotions-sexuality |
| 88 | `freeze_response` | emotions-threat-response |
| 88 | `steeled_courage` | emotions-threat-response |
| 89 | `terror_spike` | emotions-threat-response |
| 90 | `rage_surge` | emotions-anger |
| 92 | `panic_onset` | emotions-threat-response |
| 92 | `quiet_despair` | emotions-loss |
| 93 | `humiliation` | emotions-moral |
| 93 | `self_disgust_arousal` | emotions-sexuality |
| 95 | `grief_break` | emotions-loss |

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

### Identified Gaps

Based on current coverage, these emotional areas may benefit from additional expressions:

- **Surprise/Startle** (40-60 range): Only `startle_flinch` exists; consider pleasant surprise, shock, astonishment
- **Disgust** (standalone): Currently only appears mixed with fear (`horror_revulsion`); consider pure disgust, revulsion, contempt
- **Nostalgia/Memory** (50-70 range): `nostalgic_distance` covers inward reminiscence; consider adding longing for specific past, regretful nostalgia
- **Anticipation** (40-60 range): `dread_settling` covers negative anticipation; consider general excitement, suspense, eager anticipation
- **Trust/Distrust** (50-70 range): No expressions for building or breaking trust
- **Embarrassment** (60-80 range): Distinct from shame; social awkwardness, self-consciousness
- **Envy** (60-80 range): Only `flustered_jealousy` exists in sexuality context; consider general envy
- **Suspicious watchfulness** (low affiliation + moderate threat + suspicion high)

## Statistics

- **Total expressions**: 77
- **Number of mods**: 8
- **Priority range**: 32-95
- **Average expressions per mod**: 9.625

---

*Last updated: Based on analysis of `data/mods/emotions-*/expressions/` directories*
