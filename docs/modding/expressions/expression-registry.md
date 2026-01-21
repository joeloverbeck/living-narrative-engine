# Expression Registry

This document serves as a comprehensive registry of all expressions in the Living Narrative Engine emotion system. Use it to:

- Identify gaps in the breadth of possible expressions
- Coordinate with existing priority numbers when creating new expressions
- Decide whether to add expressions to existing mods or create new ones

## Priority System Overview

Expressions use a numeric priority system where **higher numbers = higher priority** (evaluated first). The current range spans from **32 to 95**.

When prerequisites for multiple expressions are satisfied simultaneously, the expression with the highest priority wins.

### Priority Distribution

| Range | Count | Category |
|-------|-------|----------|
| 30-39 | 3 | Baseline states (serene, mild) |
| 40-49 | 2 | Low-intensity awareness |
| 50-59 | 5 | Moderate engagement |
| 60-69 | 21 | Active emotional states |
| 70-79 | 39 | Elevated emotional responses |
| 80-89 | 6 | Intense emotional states |
| 90-95 | 4 | Peak intensity expressions |

**Total: 80 expressions across 47 mods**

## Expressions by Mod

### emotions-absorption (2 expressions)

Deep absorption and flow states.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-absorption:entranced_stillness` | Entrancement: attention captured with reduced agency; the actor grows quiet and still, pulled into the stimulus with soft surrender rather than effortful control. |
| 76 | `emotions-absorption:flow_absorption` | Flow state: sustained engagement with a sense of control and ease; actions become efficient, attention stable, self-consciousness reduced. |

### emotions-acceptance (2 expressions)

Coming to terms with loss or difficult circumstances.

| Priority | ID | Description |
|----------|----|----|
| 67 | `emotions-acceptance:quiet_acceptance_after_loss` | Acceptance after loss: the pain remains, but it stops escalating. Sadness stays present while relief/calm begins to rise, future expectancy steadies, and the body loosens its brace. |
| 68 | `emotions-acceptance:post_loss_settling` | Acceptance / letting go: the loss is still present, but the mind stops wrestling it for a moment. The feeling lands as a quiet, lived-in steadiness. |

### emotions-admiration (1 expression)

Respect and appreciation for others.

| Priority | ID | Description |
|----------|----|----|
| 70 | `emotions-admiration:admiration_swell` | Admiration swell: respect rises and steadies into a quiet uplift. Attention tightens into appreciation; the mind starts framing what it sees as exemplary or worth emulating. |

### emotions-affection-care (4 expressions)

Warmth, care, and compassion directed toward others.

| Priority | ID | Description |
|----------|----|----|
| 55 | `emotions-affection-care:warm_affection` | Tender feelings of love and care toward others. |
| 60 | `emotions-affection-care:compassionate_concern` | Warm concern and empathy - attentive care directed outward, distinct from personal sadness or panic. |
| 68 | `emotions-affection-care:steady_sympathy` | Sympathetic steadiness: care that stays regulated. Compassion is present, but empathic distress is kept low so it reads as supportive presence rather than emotional flooding. |
| 72 | `emotions-affection-care:comforted_vulnerability` | Comforted vulnerability: being cared for finally lands, and the body stops fighting it. Trust and affection open a soft seam where guardedness loosens into relief without collapsing into shutdown. |

### emotions-affiliation (1 expression)

Deepening attachment and protective warmth.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-affiliation:attachment_swell` | Protective warmth arising from deepening love attachment - a sudden swell of caring closeness. |

### emotions-aftershock (1 expression)

Physical aftermath of adrenaline responses.

| Priority | ID | Description |
|----------|----|----|
| 79 | `emotions-aftershock:adrenaline_aftershock` | Adrenaline aftershock: the body comes down from a threat surge--shaking, breathy laughter, or sudden tears--while danger appraisal drops but arousal lags behind. |

### emotions-alarm (1 expression)

Sharp mobilization into action readiness.

| Priority | ID | Description |
|----------|----|----|
| 84 | `emotions-alarm:alarm_surge` | Alarm surge: a sharp mobilization into fight/flight readiness--fast, keyed-up, and action-oriented--without tipping into panic, freezing, or dissociative shutdown. |

### emotions-anger-irritation (2 expressions)

Frustration and irritation responses.

| Priority | ID | Description |
|----------|----|----|
| 36 | `emotions-anger-irritation:mild_irritation` | Low-level annoyance and frustration. |
| 76 | `emotions-anger-irritation:frustration_spiral` | Escalating frustration combined with irritation, building pressure from repeated failure or obstruction. |

### emotions-anger-principled-protective (1 expression)

Protective anger in defense of values or others.

| Priority | ID | Description |
|----------|----|----|
| 79 | `emotions-anger-principled-protective:protective_anger` | Protective anger: warm, connected hostility aimed outward to defend someone/something valued. High anger with high affiliation and high agency--boundary-setting, not cruelty. |

### emotions-anticipation (1 expression)

Forward-looking eagerness.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-anticipation:eager_anticipation` | Forward-pulling anticipation with restless momentum: the kind where attention can't stay put, keeps jutting toward what's next, and stillness itself feels like friction. |

### emotions-anxiety (1 expression)

Moderate anxiety and unease.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-anxiety:restless_anxiety` | Moderate anxiety/unease expressed as fidgeting, pacing, and wary attention without full panic. |

### emotions-assertiveness-boundaries (1 expression)

Setting clear boundaries.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-assertiveness-boundaries:assertive_boundary_no` | A clean, self-protective boundary: an unmistakable "No" delivered with steadiness rather than heat. The body stays upright and deliberate; the mind feels organized, not escalated. |

### emotions-bonding-synchrony (3 expressions)

Social bonding and shared emotional experiences.

| Priority | ID | Description |
|----------|----|----|
| 68 | `emotions-bonding-synchrony:camaraderie_click` | Belonging glow: an easy, mutual-fit warmth where closeness feels obvious and uncomplicated. The body relaxes into the social space; attention stays present, not scanning for danger or distance. |
| 68 | `emotions-bonding-synchrony:shared_laughter_bond` | Playful social bonding: shared laughter that lands as synchrony. The moment feels easy and mutual, like a quiet agreement to be on the same side of the world for a beat. |
| 72 | `emotions-bonding-synchrony:vicarious_pride_warm_glow` | Vicarious pride: warm, relational uplift that reads as "I'm proud of you," with a reflected glow: admiration and affection braid into a steady, protective brightness. |

### emotions-burnout (1 expression)

Stress-driven exhaustion and detachment.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-burnout:burnout_wall_bitter_detach` | A burnout wall: stress has stayed high long enough that exhaustion and bitterness take the wheel, and caring starts to feel expensive. |

### emotions-calm (3 expressions)

Peaceful, low-arousal positive states.

| Priority | ID | Description |
|----------|----|----|
| 32 | `emotions-calm:serene_calm` | A neutral-to-gently-positive calm: unhurried, serene, and emotionally even. |
| 38 | `emotions-calm:quiet_contentment` | Calm satisfaction and peaceful happiness - low arousal positive state. |
| 76 | `emotions-calm:sigh_of_relief` | A visible release of tension after fear drops and relief spikes. |

### emotions-competence-pride (2 expressions)

Achievement satisfaction and self-assurance.

| Priority | ID | Description |
|----------|----|----|
| 61 | `emotions-competence-pride:quiet_pride` | Subtle, self-assured satisfaction: an internal 'I did that' settling into confident posture. |
| 66 | `emotions-competence-pride:earned_satisfaction_settle` | Completion satisfaction: the quiet, earned 'done' that settles in after effort. It's competence with a downshift: the body unclenches, attention unhooks, and a small steadiness takes the place of drive. |

### emotions-confusion (1 expression)

Bewilderment and puzzlement.

| Priority | ID | Description |
|----------|----|----|
| 46 | `emotions-confusion:confused_frown` | Confusion or bewilderment - attention snagged on inconsistency, showing as a puzzled frown and small orientation gestures. |

### emotions-curiosity-attention (2 expressions)

Curiosity and engaged attention.

| Priority | ID | Description |
|----------|----|----|
| 50 | `emotions-curiosity-attention:interested_attention` | Quiet, sustained attention: the actor is engaged and tracking information without strong affect or urgency. |
| 66 | `emotions-curiosity-attention:curious_lean_in` | Approach-oriented curiosity: the actor actively seeks more information, testing, probing, and re-orienting to novelty. |

### emotions-despair (2 expressions)

Hopelessness and helplessness.

| Priority | ID | Description |
|----------|----|----|
| 83 | `emotions-despair:frustrated_helplessness` | Anger + frustration combined with powerlessness and hopelessness (despair/low hope present). |
| 92 | `emotions-despair:quiet_despair` | Silent, numbed hopelessness where the future stops feeling real. |

### emotions-disappointment (1 expression)

Wistful sadness over unrealized expectations.

| Priority | ID | Description |
|----------|----|----|
| 58 | `emotions-disappointment:melancholic_disappointment` | Wistful sadness mixed with lingering disappointment over something lost or unrealized. |

### emotions-disengagement (2 expressions)

Boredom and mind-wandering.

| Priority | ID | Description |
|----------|----|----|
| 46 | `emotions-disengagement:bored_disinterest` | Low engagement boredom or apathy - everyday disinterest expressed through drifting attention and impatient fidgeting. |
| 62 | `emotions-disengagement:mind_wander_drift` | Benign mind-wander: attention loosens and slips sideways into idle thought--neither avoidance nor shutdown, just a gentle drift away from the present task. |

### emotions-dissociation (1 expression)

Detachment from reality.

| Priority | ID | Description |
|----------|----|----|
| 86 | `emotions-dissociation:dissociation` | Detachment from reality triggered by sudden numbness spike and interest drop. |

### emotions-elevation (2 expressions)

Aesthetic appreciation and inspiration.

| Priority | ID | Description |
|----------|----|----|
| 64 | `emotions-elevation:aesthetic_appreciation_soften` | Aesthetic appreciation: calm engagement with a gentle, savoring quality - attention held without urgency, often with softened affect. |
| 70 | `emotions-elevation:inspired_uplift` | Inspiration: engaged attention paired with hopeful possibility; the actor shows uplift, mental expansion, and forward-looking energy. |

### emotions-empathy-joy (1 expression)

Shared happiness through empathy.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-empathy-joy:empathic_joy_resonance` | Shared happiness: another person's joy lands in me like a clean echo--my affect lifts in response, pulling me closer rather than turning inward. |

### emotions-excitement (1 expression)

High-energy positive states.

| Priority | ID | Description |
|----------|----|----|
| 73 | `emotions-excitement:euphoric_excitement` | High-energy joy with elevated arousal and positive valence. |

### emotions-executive-control (1 expression)

Goal-directed determination.

| Priority | ID | Description |
|----------|----|----|
| 76 | `emotions-executive-control:determined_focus` | Goal-directed determination: engaged resolve with forward pressure - friction acknowledged, not feared. |

### emotions-fatigue (1 expression)

Low-energy exhaustion states.

| Priority | ID | Description |
|----------|----|----|
| 69 | `emotions-fatigue:fatigue_drag` | A heavy, low-energy slump where fatigue pulls attention down and effort feels costly, without tipping into full dissociation or despair collapse. |

### emotions-fear-acute (2 expressions)

Intense fear responses.

| Priority | ID | Description |
|----------|----|----|
| 88 | `emotions-fear-acute:freeze_response` | Acute freeze response triggered by sudden fear spike with low determination to act. |
| 92 | `emotions-fear-acute:panic_onset` | Acute panic response triggered by high terror combined with alarm and rapid terror increase. |

### emotions-gratitude (3 expressions)

Thankfulness and appreciation.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-gratitude:quiet_gratitude` | Quiet gratitude: an everyday, softened 'thank you' feeling that settles in without turning tearful or dramatic. Warmth spreads through attention and posture. |
| 72 | `emotions-gratitude:awkward_indebted_gratitude` | Gratitude that lands with a hitch: warmth tangled with social awkwardness and a sudden sense of obligation. The thank-you arrives, but it comes out careful. |
| 72 | `emotions-gratitude:tearful_gratitude` | A sudden rush of thankfulness - moved, softened, and visibly affected by kindness or help. |

### emotions-grief (4 expressions)

Loss and mourning responses.

| Priority | ID | Description |
|----------|----|----|
| 70 | `emotions-grief:quiet_grief` | Deep but contained grief, mourning without dramatic display. |
| 74 | `emotions-grief:hollow_shock_onset` | Hollow shock: the first unreal beat of grief where the mind stalls and the body keeps going. Everything feels slightly delayed, like perception is arriving through cotton. |
| 75 | `emotions-grief:tearful_sorrow` | Active crying or near-crying state from overwhelming sadness. |
| 95 | `emotions-grief:grief_break` | Acute grief breakdown triggered by overwhelming sorrow and rapid grief escalation. |

### emotions-guilt (3 expressions)

Guilt and self-forgiveness.

| Priority | ID | Description |
|----------|----|----|
| 55 | `emotions-guilt:lingering_guilt` | Moderate, non-spiking guilt: an apologetic, sheepish self-consciousness after a minor mistake. |
| 72 | `emotions-guilt:self_forgiveness_release` | Self-forgiveness release: the knot of guilt loosens and relief moves in--breathing returns, posture unhooks, and the inner voice stops prosecuting for a beat. |
| 74 | `emotions-guilt:guilt_driven_repair_impulse` | Urgent need to make amends triggered by rapidly rising guilt. |

### emotions-hope (2 expressions)

Optimism and hopeful expectancy.

| Priority | ID | Description |
|----------|----|----|
| 61 | `emotions-hope:optimistic_lift` | General upbeat expectancy: things are likely to go well, and the body behaves as if it believes that. |
| 64 | `emotions-hope:hopeful_glimmer` | A small but meaningful uptick in hope: future feels less closed, possibilities re-enter the frame. |

### emotions-humiliation (1 expression)

Profound public shame.

| Priority | ID | Description |
|----------|----|----|
| 93 | `emotions-humiliation:humiliation` | Profound humiliation causing visible distress and urge to disappear. |

### emotions-integrity (1 expression)

Self-respect and moral alignment.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-integrity:quiet_integrity` | Quiet integrity: a clean, steady self-respect - pride without swagger, guilt and shame unclenching without any rush of triumph. The body settles into alignment. |

### emotions-joy-play (4 expressions)

Joy, amusement, and playfulness.

| Priority | ID | Description |
|----------|----|----|
| 56 | `emotions-joy-play:playful_mischief` | Lighthearted playfulness with a hint of mischief. |
| 62 | `emotions-joy-play:amused_chuckle` | Light amusement surfacing as a contained laugh or grin - socially readable, de-escalating, and safe. |
| 74 | `emotions-joy-play:joy_burst` | A brief, spontaneous spike of joy that breaks through as a visible micro-celebration - light, bright, and hard to fully suppress. |
| 74 | `emotions-joy-play:relief_laughter_discharge` | Relief that vents socially: tension breaks into a small, involuntary laugh. The body cashes out the danger-signal into warmth and motion. |

### emotions-loneliness-connection (2 expressions)

Loneliness and connection-seeking.

| Priority | ID | Description |
|----------|----|----|
| 62 | `emotions-loneliness-connection:lonely_isolation` | Profound sense of isolation and disconnection from others. |
| 74 | `emotions-loneliness-connection:lonely_reach_out` | Connection-seeking loneliness: an aching pull toward contact rather than retreat. The feeling is tender and exposed, but oriented outward: a small decision to bridge the distance. |

### emotions-regret (1 expression)

Rumination over past choices.

| Priority | ID | Description |
|----------|----|----|
| 74 | `emotions-regret:regret_rumination_loop` | Regret rumination loop: counterfactual self-reproach that keeps replaying alternatives--"I chose wrong / missed it"--without collapsing into moral guilt or identity-shame. |

### emotions-sadness (1 expression)

Everyday heavy sadness.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-sadness:heavy_sadness_slump` | Everyday heavy sadness: a low, sinking mood that pulls the body down and slows thought, without tipping into grief-break, despair, or shutdown. |

### emotions-sexual-approach (1 expression)

Sexual confidence and seduction.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-sexual-approach:seductive_confidence` | Sexual confidence and control - aroused, self-assured, and deliberately seductive. |

### emotions-sexual-desire (2 expressions)

Sexual arousal and enjoyment.

| Priority | ID | Description |
|----------|----|----|
| 71 | `emotions-sexual-desire:sensual_enjoyment` | Relaxed sensual pleasure - high arousal with positive valence and very low threat. |
| 74 | `emotions-sexual-desire:anticipatory_edge` | Approach-oriented anticipation: alert, eager readiness for what's about to happen - waiting becomes charged. |

### emotions-sexual-intimacy-style (1 expression)

Expression of sexual agency.

| Priority | ID | Description |
|----------|----|----|
| 76 | `emotions-sexual-intimacy-style:dominant_pleasure_hold` | Sexual agency held forward: desire that expresses as calm command rather than hunger or pleading. The body reads self-possessed: choosing, steering, and enjoying the fact of control. |

### emotions-sexual-repulsion (1 expression)

Sexual boundary enforcement.

| Priority | ID | Description |
|----------|----|----|
| 79 | `emotions-sexual-repulsion:hard_no_recoil_boundary` | A hard internal stop: attraction slams shut and the body pulls back to re-establish a safety boundary. Attention narrows, contact feels wrong, and the impulse is to create distance immediately. |

### emotions-shame (1 expression)

Acute shame responses.

| Priority | ID | Description |
|----------|----|----|
| 82 | `emotions-shame:shame_spike` | Acute shame response with rapid onset causing visible recoil and avoidance. |

### emotions-shutdown (2 expressions)

Emotional numbing and withdrawal.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-shutdown:apathy_blank` | Low-energy motivational shutdown: caring goes offline and engagement collapses without tipping into full dissociation or deep despair. |
| 73 | `emotions-shutdown:numb_flatness` | Blunted affect and emotional muting: numbness dominates with low engagement/arousal, without tipping into full dissociation or heavy grief/despair. |

### emotions-surprise (2 expressions)

Startle and cognitive shock.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-surprise:stunned_processing_pause` | Cognitive shock without panic: attention locks hard while the mind stalls to re-parse what it just took in. The body isn't fleeing; it's buffering. |
| 78 | `emotions-surprise:startle_flinch` | Sudden startle response triggered by rapid increase in surprise/startle emotion. |

### emotions-trust-repair (3 expressions)

Rebuilding trust and forgiveness.

| Priority | ID | Description |
|----------|----|----|
| 66 | `emotions-trust-repair:forgiving_softening` | A deliberate softening toward reconciliation: care and trust return enough to unclench. |
| 72 | `emotions-trust-repair:guard_lowering` | Guard lowering: trust takes the wheel and the body stops bracing - softening into openness without tipping into helpless surrender. |
| 72 | `emotions-trust-repair:repair_warmth_return` | Interpersonal repair warmth: the body unbraces and the connection feels usable again. Relief comes first, then a quiet warmth that says: we're okay, we can move forward. |

### emotions-vigilance (1 expression)

Heightened threat awareness.

| Priority | ID | Description |
|----------|----|----|
| 84 | `emotions-vigilance:hypervigilant_scanning` | Heightened threat awareness with constant environmental monitoring. |

## Guidelines for Modders

### When to Add to Existing Mods

Add to an existing mod when:
- The new expression fits the mod's emotional domain
- It fills a gap in intensity within that domain (e.g., adding a mid-intensity variant)
- It represents a related sub-category of the mod's theme

### When to Create a New Mod

Create a new mod when:
- The emotion doesn't fit any existing category
- You're introducing a distinct emotional theme
- The expression family is large enough to warrant its own mod (3+ expressions)

### Priority Selection Tips

1. **Check existing priorities** in related mods to avoid conflicts
2. **Leave gaps** (5-10 points) between expressions for future additions
3. **Higher priorities for more specific/intense states** that should override general ones
4. **Lower priorities for baseline states** that serve as defaults

### Priority Ranges by Intensity

| Intensity | Priority Range | Examples |
|-----------|----------------|----------|
| Baseline | 30-45 | serene_calm, mild_irritation |
| Low | 45-60 | warm_affection, playful_mischief |
| Moderate | 60-75 | quiet_gratitude, eager_anticipation |
| High | 75-85 | alarm_surge, shame_spike |
| Peak | 85-95 | panic_onset, grief_break |
