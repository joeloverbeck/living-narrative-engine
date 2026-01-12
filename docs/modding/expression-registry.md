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
| 30-39 | 3 | Baseline states (serene, mild) |
| 40-49 | 2 | Low-intensity awareness |
| 50-59 | 5 | Moderate engagement |
| 60-69 | 27 | Active emotional states |
| 70-79 | 76 | Elevated emotional responses |
| 80-89 | 20 | Intense emotional states |
| 90-95 | 6 | Peak intensity expressions |

## Expressions by Mod

### emotions-curiosity-attention (3 expressions)

Expressions related to curiosity and engaged attention.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 50 | `emotions-curiosity-attention:interested_attention` | attention | Engaged curiosity with focused awareness |
| 66 | `emotions-curiosity-attention:curious_lean_in` | attention | Active curiosity drawing closer to the subject |
| 72 | `emotions-curiosity-attention:fascinated_lock_on` | attention | Intense captivation where attention becomes completely absorbed |

### emotions-absorption (2 expressions)

Expressions related to deep absorption and flow states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-absorption:entranced_stillness` | attention | Deep absorption where external awareness fades |
| 76 | `emotions-absorption:flow_absorption` | attention | Complete immersion in activity where self-awareness dissolves |

### emotions-disengagement (2 expressions)

Expressions related to disengagement and boredom.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 46 | `emotions-disengagement:bored_disinterest` | attention | Disengaged attention with restless energy |
| 62 | `emotions-disengagement:mind_wander_drift` | attention | Benign mind-wander with attention gently drifting from the present task |

### emotions-confusion (3 expressions)

Expressions related to cognitive confusion and processing difficulty.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 46 | `emotions-confusion:confused_frown` | attention | Puzzled concentration trying to process something unclear |
| 72 | `emotions-confusion:insight_click` | attention | A sudden internal re-ordering: confusion loosens while attention stays locked in, replaced by a clean sense of grasp |
| 73 | `emotions-confusion:cognitive_overload_stall` | shutdown | Cognitive overload stall: too many simultaneous threads—thinking stays online, but it starts to stutter |

### emotions-hope (2 expressions)

Expressions of hope and optimism - forward-looking positive emotional states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 61 | `emotions-hope:optimistic_lift` | calm | Rising hopefulness about possibilities |
| 64 | `emotions-hope:hopeful_glimmer` | calm | Tentative hope emerging from uncertainty |

### emotions-admiration (1 expression)

Expressions of admiration and respectful uplift.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 70 | `emotions-admiration:admiration_swell` | affection | Respectful admiration swelling into uplifted, focused regard |

### emotions-anticipation (1 expression)

Forward-looking anticipation states - eager readiness and expectant energy.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-anticipation:eager_anticipation` | joy | Bright, forward-leaning anticipation with restless readiness |

### emotions-craving (1 expression)

Expressions for craving and urge-pull states - narrowed, insistent wanting with constrained agency.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-craving:craving_pull` | desire | Narrowed, insistent "need it" urge that tugs attention forward with restless, slightly painful wanting |

### emotions-elevation (3 expressions)

Expressions of elevation - awe, inspiration, and aesthetic appreciation.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 64 | `emotions-elevation:aesthetic_appreciation_soften` | joy | Softening in response to beauty or artistry |
| 70 | `emotions-elevation:inspired_uplift` | joy | Creative or motivational surge of energy |
| 78 | `emotions-elevation:awed_transfixion` | joy | Overwhelmed wonder at something magnificent |

### emotions-excitement (3 expressions)

Expressions of excitement, enthusiasm, and euphoric energy.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 71 | `emotions-excitement:enthusiastic_energy` | joy | Eager excitement and engagement |
| 73 | `emotions-excitement:euphoric_excitement` | joy | Intense happiness bordering on giddiness |
| 76 | `emotions-excitement:risk_thrill_grin` | joy | Risk-thrill: danger registers as fuel—bright focus, charged breath, hungry confidence |

### emotions-joy-play (3 expressions)

Expressions of joy, playfulness, and amusement.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 56 | `emotions-joy-play:playful_mischief` | joy | Lighthearted troublemaking energy |
| 62 | `emotions-joy-play:amused_chuckle` | joy | Light amusement finding humor in the moment |
| 74 | `emotions-joy-play:joy_burst` | joy | Sudden overflow of happiness |

### emotions-calm (3 expressions)

Expressions of calm, tranquil, and peaceful emotional states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 32 | `emotions-calm:serene_calm` | calm | Deep tranquility and inner peace |
| 38 | `emotions-calm:quiet_contentment` | calm | Gentle satisfaction without need for more |
| 76 | `emotions-calm:sigh_of_relief` | calm | Release of tension as worry dissolves |

### emotions-acceptance (1 expression)

Expressions of acceptance and post-loss settling.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 67 | `emotions-acceptance:quiet_acceptance_after_loss` | calm | Acceptance after loss: pain remains but stops escalating as relief/calm rises |

### emotions-regulation (1 expression)

Expressions of self-regulation and grounding that restore composure.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 68 | `emotions-regulation:purposeful_grounding` | calm | Deliberate grounding that eases anxiety into steadier composure |

### emotions-affiliation (13 expressions)

Expressions of social connection, bonding, and interpersonal feelings.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 55 | `emotions-affiliation:warm_affection` | affection | Tender caring feelings toward another |
| 60 | `emotions-affiliation:compassionate_concern` | affection | Empathetic worry for another's wellbeing |
| 62 | `emotions-affiliation:lonely_isolation` | affection | Painful sense of disconnection and solitude |
| 66 | `emotions-affiliation:quiet_gratitude` | affection | Quiet gratitude—an everyday, softened thank you feeling that settles in without turning tearful or dramatic |
| 68 | `emotions-affiliation:camaraderie_click` | affection | Belonging glow—an easy, mutual-fit warmth where closeness feels obvious and uncomplicated |
| 68 | `emotions-affiliation:shared_laughter_bond` | affection | Playful social bonding—shared laughter that lands as synchrony. The moment feels easy and mutual, like a quiet agreement to be on the same side of the world for a beat. |
| 68 | `emotions-affiliation:steady_sympathy` | affection | Sympathetic steadiness—care that stays regulated. Compassion is present, but empathic distress is kept low so it reads as supportive presence rather than emotional flooding. |
| 72 | `emotions-affiliation:awkward_indebted_gratitude` | shame | Gratitude that lands with a hitch—warmth tangled with social awkwardness and a sudden sense of obligation. The thank-you arrives, but it comes out careful, as if it costs something to accept help cleanly. |
| 72 | `emotions-affiliation:lonely_yearning_reach` | affection | Lonely yearning reach—an aching pull toward connection that stays outward-facing rather than withdrawing |
| 72 | `emotions-affiliation:tearful_gratitude` | affection | Overwhelming thankfulness bringing tears |
| 72 | `emotions-affiliation:vicarious_pride_warm_glow` | affection | Vicarious pride—warm, relational uplift that reads as “I’m proud of you,” with a reflected glow of admiration and affection |
| 74 | `emotions-affiliation:lonely_reach_out` | affection | Connection-seeking loneliness—an aching pull toward contact rather than retreat. The feeling is tender and exposed, but oriented outward: a small decision to bridge the distance. |
| 74 | `emotions-affiliation:attachment_swell` | affection | Surge of bonding feelings intensifying connection |

### emotions-love-attachment (1 expression)

Expressions of love, attachment, and tender bonding.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-love-attachment:adoring_tenderness` | affection | A soft, reverent warmth—attention settles into quiet appreciation, protective fondness, and the feeling that simply being near is enough. |

### emotions-agency (6 expressions)

Expressions related to personal power, competence, and self-determination.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 61 | `emotions-agency:quiet_pride` | affection | Humble satisfaction in one's own accomplishment |
| 66 | `emotions-agency:earned_satisfaction_settle` | calm | Completion satisfaction—the quiet, earned “done” that settles in after effort |
| 70 | `emotions-agency:confident_composure` | agency | Assured self-possession and poise |
| 74 | `emotions-agency:assertive_boundary_no` | agency | A clean, self-protective boundary—an unmistakable “No” delivered with steadiness rather than heat. The body stays upright and deliberate; the mind feels organized, not escalated. This is refusal without contempt: firm limits, minimal drama. |
| 76 | `emotions-agency:determined_focus` | agency | Resolute commitment to achieving a goal |
| 82 | `emotions-agency:triumphant_release` | agency | Victorious exultation after overcoming challenge |

### emotions-anger (10 expressions)

Expressions of frustration, irritation, and rage across intensity levels.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 36 | `emotions-anger:mild_irritation` | anger | Low-level annoyance that hasn't escalated |
| 72 | `emotions-anger:cooling_down_regain_composure` | agency | Anger de-escalation—heat still in the system, but control returns. The edge dulls, breathing steadies, and the urge to lash out gets replaced by a quieter, more deliberate stance. |
| 76 | `emotions-anger:frustration_spiral` | anger | Mounting irritation as obstacles persist |
| 76 | `emotions-anger:righteous_indignation` | anger | Principled anger that sharpens into moral urgency without tipping into contempt or rage |
| 78 | `emotions-anger:hurt_anger` | anger | Affiliative anger with pain underneath—betrayal, rejection, or grief-adjacent hurt |
| 79 | `emotions-anger:protective_anger` | anger | Warm, connected hostility aimed outward to defend someone valued |
| 80 | `emotions-anger:cold_fury` | anger | Controlled, icy anger beneath the surface |
| 84 | `emotions-anger:suppressed_rage` | anger | Intense anger being forcibly contained |
| 85 | `emotions-anger:explosive_anger` | anger | Sudden violent outburst of rage |
| 90 | `emotions-anger:rage_surge` | anger | Overwhelming fury consuming rational thought |

### emotions-hatred (2 expressions)

Expressions of cold, enduring hatred.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 76 | `emotions-hatred:vengeful_focus` | anger | Cold, organized intent to punish with controlled focus |
| 79 | `emotions-hatred:cold_loathing` | anger | Enduring loathing with deliberate, cold hostility |

### emotions-anxiety (4 expressions)

Expressions of unease, controlled worry, and dread.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 66 | `emotions-anxiety:restless_anxiety` | threat | Unfocused nervousness and unease |
| 72 | `emotions-anxiety:uneasy_restraint` | threat | Controlled unease with deliberate self-restraint—careful, quiet, not yet panic |
| 73 | `emotions-anxiety:dread_settling` | threat | Slow, heavy dread settling in—anticipation turns sour as the body braces without tipping into panic |
| 76 | `emotions-anxiety:worry_rumination_spiral` | threat | A catastrophizing thought-loop: attention clamps down, control feels slippery, and each answer breeds a new worry. The mind keeps trying to solve safety with thinking, but the thinking becomes the threat. |

### emotions-stress (2 expressions)

Expressions of pressure and overload stress.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 76 | `emotions-stress:white_knuckle_competence` | agency | Pressure held in a tight grip—high load, high focus, and stubborn follow-through. The body runs hot, the mind stays task-locked, and the will refuses to slip, even while tension leaks through the edges. |
| 79 | `emotions-stress:stress_overload` | threat | Overloaded-under-pressure stress spike where urgency rises and composure frays |

### emotions-aftershock (1 expression)

Expressions related to adrenaline comedown and aftershock release.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 79 | `emotions-aftershock:adrenaline_aftershock` | threat | Adrenaline aftershock as threat drops while arousal lingers |

### emotions-trust-distrust (6 expressions)

Expressions related to trust, distrust, suspicion, and interpersonal vigilance states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 66 | `emotions-trust-distrust:forgiving_softening` | affection | Deliberate softening toward reconciliation as trust returns |
| 66 | `emotions-trust-distrust:tentative_trust_reach` | affection | A small, deliberate reach toward trust while the guard is still half up |
| 72 | `emotions-trust-distrust:guard_lowering` | affection | Guard lowering—trust takes the wheel and the body stops bracing, softening into openness |
| 73 | `emotions-trust-distrust:wary_suspicion` | threat | Wary suspicion with interpretive vigilance—reading tone, timing, and inconsistencies |
| 77 | `emotions-trust-distrust:trust_fracture` | threat | A sharp trust fracture—suspicion rises into a chilling appraisal that someone or something is not safe to rely on |
| 78 | `emotions-trust-distrust:trusting_surrender` | affection | Deliberately yielding control into perceived safety, softening while choosing to be carried |

### emotions-cynicism (1 expression)

Expressions of cynical appraisal and guarded skepticism.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-cynicism:cynical_detachment` | anger | Cynical detachment: an armored, bitter disbelief that stays sharp and evaluative—still engaged enough to judge, but refusing hope or sincerity. |

### emotions-empathy-distress (1 expression)

Empathic overwhelm expressions—prosocial distress when care is present but the felt load becomes too much.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 82 | `emotions-empathy-distress:empathic_overwhelm` | affection | Prosocial distress flooding the system—care present but overwhelmed |

### emotions-vigilance (1 expression)

Expressions of scanning and monitoring states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 84 | `emotions-vigilance:hypervigilant_scanning` | threat | Heightened alertness scanning for threats |

### emotions-alarm (1 expression)

Expressions of alarm-driven mobilization and readiness.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 84 | `emotions-alarm:alarm_surge` | threat | Sharp mobilization into fight/flight readiness without tipping into panic or freeze |

### emotions-fear-acute (4 expressions)

Expressions of terror, panic, and freeze cluster.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 82 | `emotions-fear-acute:flight_impulse_get_out_now` | threat | Escape-mobilization beat: fear/terror peaks into movement-readiness—an urgent, single-track impulse to create distance. Distinct from freeze (immobility) and panic (loss-of-control). |
| 88 | `emotions-fear-acute:freeze_response` | threat | Paralyzed stillness in face of overwhelming threat |
| 89 | `emotions-fear-acute:terror_spike` | threat | Sudden, sustained surge of terror—intense fear that clamps the body and narrows cognition without fully tipping into panic or freeze |
| 92 | `emotions-fear-acute:panic_onset` | threat | Escalating terror overwhelming coping ability |

### emotions-courage (1 expression)

Expressions of fear regulation and override.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 88 | `emotions-courage:steeled_courage` | threat | Summoned bravery overriding fear response |

### emotions-surprise (4 expressions)

Expressions of startle and surprise response.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-surprise:astonished_disbelief` | attention | Astonished disbelief—surprise that doesn’t resolve into glee or fear |
| 72 | `emotions-surprise:stunned_processing_pause` | attention | Cognitive shock without panic—attention locks while the mind re-parses what it just took in |
| 76 | `emotions-surprise:delighted_surprise` | joy | Pleasant surprise—an upbeat jolt that turns into a bright, spontaneous lift |
| 78 | `emotions-surprise:startle_flinch` | threat | Sudden reactive jolt from unexpected stimulus |

### emotions-disgust (3 expressions)

Expressions of disgust and revulsion.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-disgust:visceral_recoil` | anger | Immediate physical revulsion to something offensive |
| 74 | `emotions-disgust:moral_revulsion` | anger | Ethical revulsion—disgust blended with contempt and cold judgment |
| 86 | `emotions-disgust:horror_revulsion` | anger | Deep disgust mixed with fear at something terrible |

### emotions-disappointment (1 expression)

Melancholic disappointment expressions for wistful sadness over unmet expectations.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 58 | `emotions-disappointment:melancholic_disappointment` | loss | Wistful sadness mixed with lingering disappointment |

### emotions-grief (4 expressions)

Expressions of mourning, tears, and grief breakdown.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 70 | `emotions-grief:quiet_grief` | loss | Subdued mourning held close to the heart |
| 74 | `emotions-grief:hollow_shock_onset` | loss | Hollow shock—the first unreal beat of grief where the mind stalls and the body keeps going |
| 75 | `emotions-grief:tearful_sorrow` | loss | Open weeping from emotional pain |
| 95 | `emotions-grief:grief_break` | loss | Complete emotional breakdown from overwhelming loss |

### emotions-despair (3 expressions)

Hopelessness collapse driven by agency loss and bleak future expectancy.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 83 | `emotions-despair:frustrated_helplessness` | loss | Anguished inability to change circumstances |
| 85 | `emotions-despair:deep_despair` | loss | Profound hopelessness and emotional collapse |
| 92 | `emotions-despair:quiet_despair` | loss | Silent, internalized hopelessness |

### emotions-shutdown (2 expressions)

Low engagement and muted affect where the emotional system goes offline.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-shutdown:apathy_blank` | shutdown | Low-energy motivational shutdown where caring goes offline |
| 73 | `emotions-shutdown:numb_flatness` | shutdown | Blunted affect and emotional muting without full dissociation |

### emotions-burnout (1 expression)

Expressions related to burnout walls where stress and fatigue calcify into bitter detachment.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-burnout:burnout_wall_bitter_detach` | shutdown | A burnout wall: stress has stayed high long enough that exhaustion and bitterness take the wheel, and caring starts to feel expensive |

### emotions-fatigue (1 expression)

Physiological and effort-cost expressions.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 69 | `emotions-fatigue:fatigue_drag` | shutdown | Heavy, low-energy slump where effort feels costly |

### emotions-nostalgia (3 expressions)

Memory-recall and reminiscence with past-oriented emotional tone.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 68 | `emotions-nostalgia:nostalgic_distance` | loss | Bittersweet reminiscence where the past feels closer than the present |
| 71 | `emotions-nostalgia:bittersweet_smile` | loss | Mixed-valence nostalgia—warmth threaded with ache. The memory-feel lands tender rather than crushing: a small smile that doesn’t quite outrun the sting. |
| 71 | `emotions-nostalgia:flat_reminiscence` | loss | Flat reminiscence—memories surface without bite or warmth; a dull, listless recall |

### emotions-dissociation (1 expression)

Protective disconnect with distinct anti-collision gates.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 86 | `emotions-dissociation:dissociation` | shutdown | Emotional disconnection as protective response |

### emotions-regret (1 expression)

Counterfactual self-reproach and rumination—"I chose wrong" without collapsing into moral guilt or identity-shame.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-regret:regret_rumination_loop` | loss | Counterfactual self-reproach that keeps replaying alternatives without collapsing into moral guilt or identity-shame |

### emotions-sadness (1 expression)

Everyday sadness expressions - low, heavy moods that weigh down without reaching grief or despair territory.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 66 | `emotions-sadness:heavy_sadness_slump` | loss | Heavy everyday sadness pulling the body down and slowing thought, without tipping into grief-break, despair, or shutdown |

### emotions-guilt (4 expressions)

Expressions of guilt - "I did bad" repair-oriented responses.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 55 | `emotions-guilt:lingering_guilt` | shame | Persistent low-level remorse over past action |
| 72 | `emotions-guilt:self_forgiveness_release` | calm | Self-forgiveness release as guilt loosens and relief moves in |
| 74 | `emotions-guilt:guilt_driven_repair_impulse` | shame | Urgent need to make amends for wrongdoing |
| 76 | `emotions-guilt:halting_apology_blurt` | shame | A halting apology / confession blurt—guilt pushes outward into speech before it can be fully rehearsed |

### emotions-integrity (1 expression)

Expressions of integrity - quiet, steady self-respect with low guilt and shame.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 66 | `emotions-integrity:quiet_integrity` | calm | Quiet integrity: a clean, steady self-respect - pride without swagger, guilt and shame unclenching without any rush of triumph |

### emotions-humiliation (1 expression)

Expressions of humiliation - shame combined with social exposure.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 93 | `emotions-humiliation:humiliation` | shame | Public shame with crushing social exposure |

### emotions-shame (3 expressions)

Expressions of shame - "I am bad" self-condemnation responses.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 60 | `emotions-shame:resigned_shame` | shame | Accepted self-condemnation without hope of repair |
| 73 | `emotions-shame:imposter_doubt` | shame | Competence-threat wobble with rumination and over-monitoring |
| 82 | `emotions-shame:shame_spike` | shame | Acute self-condemnation flooding awareness |

### emotions-rejection (1 expression)

Expressions of rejection - abrupt social exclusion and self-worth sting.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 74 | `emotions-rejection:rejection_sting_pushed_out` | shame | Social rejection sting with lonely pull, self-worth pain, and a hurt-anger edge |

### emotions-deference-submission (2 expressions)

Expressions of deferential submission: compliance under pressure without warmth or safety.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-deference-submission:deferential_yielding` | agency | Deferential yielding—compliance without warmth. The stance is: reduce friction by giving ground, even if it tastes a little sour, with attention tuned to risk and social pressure rather than connection. |
| 74 | `emotions-deference-submission:appeasing_fawn_smile` | agency | Safety-seeking friendliness—an automatic, polished warmth used as cover. The body offers cooperation and soft edges first, hoping to reduce risk before it has to fight or flee. |

### emotions-social-selfconsciousness (2 expressions)

Social self-consciousness expressions capturing embarrassment, awkwardness, and recoverable self-conscious flares.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 66 | `emotions-social-selfconsciousness:embarrassed_blush` | shame | A quick, recoverable self-conscious flare—heat to the face, awkward recalibration, and a brief urge to hide without collapsing into shame |
| 73 | `emotions-social-selfconsciousness:awkward_stumble` | shame | A brief social fumble: awkwardness spikes, attention narrows, and the body tries to recover smoothness without fully shutting down |

### emotions-social-aversions (4 expressions)

Status-based social aversions like envy, resentment, and contempt—comparison-driven self-worth stings, simmering unfairness, and cool dismissal without possessive or romantic elements.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 72 | `emotions-social-aversions:contemptuous_dismissal` | anger | A cool, superior dismissal—social dominance expressed through minimization and disregard rather than active hostility |
| 72 | `emotions-social-aversions:envious_pang` | anger | A quick, status-based envy pang: attention narrows into comparison and a self-worth sting, without tipping into possessive jealousy or sexual/romantic pull |
| 72 | `emotions-social-aversions:resentful_simmer` | anger | Long-simmering unfairness: a cold, sticky sense of being wronged that stays narrative-active without tipping into explosive anger |
| 73 | `emotions-social-aversions:schadenfreude_smirk` | anger | A quick, rewarding jolt of satisfaction at another’s setback—less “joy” than superiority-flavored amusement |

### emotions-sexual-desire (4 expressions)

Expressions of arousal, wanting, and desire states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 71 | `emotions-sexual-desire:sensual_enjoyment` | desire | Pleasure in physical or aesthetic sensations |
| 74 | `emotions-sexual-desire:anticipatory_edge` | desire | Excited tension before expected intimacy |
| 75 | `emotions-sexual-desire:erotic_thrill` | desire | Electric rush of sexual excitement |
| 77 | `emotions-sexual-desire:intense_desire` | desire | Strong wanting focused on specific person or act |

### emotions-sexual-approach (2 expressions)

Expressions of presentation, stance, and seductive style.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 64 | `emotions-sexual-approach:flirtatious_playfulness` | desire | Teasing romantic interest with light energy |
| 72 | `emotions-sexual-approach:seductive_confidence` | desire | Assured allure in pursuit of attraction |

### emotions-sexual-intimacy-style (3 expressions)

Expressions of bonding, yielding, and intimacy-oriented states.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 73 | `emotions-sexual-intimacy-style:afterglow_soft_closeness` | affection | Sexual afterglow: desire softens into warmth and ease—attention turns toward closeness, comfort, and quiet bonding |
| 82 | `emotions-sexual-intimacy-style:passionate_longing` | desire | Deep yearning for romantic/sexual connection |
| 82 | `emotions-sexual-intimacy-style:submissive_pleasure` | desire | Enjoyment in yielding control |

### emotions-sexual-conflict (4 expressions)

Expressions of inhibition, anxiety, shame, and frustration in sexual contexts.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 76 | `emotions-sexual-conflict:sexual_frustration` | desire | Unfulfilled desire creating tension |
| 83 | `emotions-sexual-conflict:nervous_arousal` | desire | Anxious excitement mixing desire with uncertainty |
| 86 | `emotions-sexual-conflict:aroused_but_ashamed_conflict` | shame | Internal conflict between desire and moral discomfort |
| 93 | `emotions-sexual-conflict:self_disgust_arousal` | shame | Shame at one's own arousal response |

### emotions-jealousy-possessiveness (1 expression)

Expressions of jealousy, envy, and possessive feelings.

| Priority | ID | Category | Description |
|----------|----|----|-------------|
| 67 | `emotions-jealousy-possessiveness:flustered_jealousy` | desire | Anxious possessiveness over romantic interest |

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

- **Total expressions**: 139
- **Number of mods**: 54
- **Priority range**: 32-95
- **Average expressions per mod**: 2.60

---

*Last updated: Based on analysis of `data/mods/emotions-*/expressions/` directories*
