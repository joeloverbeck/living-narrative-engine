# Expression Registry

This document serves as a comprehensive registry of all expressions in the Living Narrative Engine emotion system. Use it to:

- Identify gaps in the breadth of possible expressions
- Coordinate with existing priority numbers when creating new expressions
- Decide whether to add expressions to existing mods or create new ones

## Priority System Overview

Expressions use a numeric priority system where **higher numbers = higher priority** (evaluated first). The current range spans from **68 to 76**.

When prerequisites for multiple expressions are satisfied simultaneously, the expression with the highest priority wins.

### Priority Distribution

| Range | Count | Category |
|-------|-------|----------|
| 68-69 | 1 | Moderate emotional states |
| 70-72 | 2 | Active emotional responses |
| 76 | 1 | Elevated engagement states |

**Total: 4 expressions across 4 mods**

## Expressions by Mod

### emotions-absorption (1 expression)

Deep absorption and flow states.

| Priority | ID | Description |
|----------|----|----|
| 76 | `emotions-absorption:flow_absorption` | Flow state: sustained engagement with a sense of control and ease; actions become efficient, attention stable, self-consciousness reduced. |

**Category**: attention

### emotions-acceptance (1 expression)

Coming to terms with loss or difficult circumstances.

| Priority | ID | Description |
|----------|----|----|
| 68 | `emotions-acceptance:post_loss_settling` | Acceptance / letting go: the loss is still present, but the mind stops wrestling it for a moment. The feeling lands as a quiet, lived-in steadiness. |

**Category**: calm

### emotions-admiration (1 expression)

Respect and appreciation for others.

| Priority | ID | Description |
|----------|----|----|
| 70 | `emotions-admiration:admiration_swell` | Admiration swell: respect rises and steadies into a quiet uplift. Attention tightens into appreciation; the mind starts framing what it sees as exemplary or worth emulating. |

**Category**: affection

### emotions-affection-care (1 expression)

Warmth, care, and compassion directed toward others.

| Priority | ID | Description |
|----------|----|----|
| 72 | `emotions-affection-care:comforted_vulnerability` | Comforted vulnerability: being cared for finally lands, and the body stops fighting it. Trust and affection open a soft seam where guardedness loosens into relief without collapsing into shutdown. |

**Category**: affection

## Expression Categories

Each expression must specify a `category` that determines its visual styling in the chat panel (border color and background gradient). Choose the category that best matches the emotional quality of the expression.

| Category | Purpose | Use For |
|----------|---------|---------|
| `calm` | Peaceful, grounded states | Serenity, contentment, acceptance, relief, quiet satisfaction |
| `joy` | Excitement, elevation | Happiness, amusement, playfulness, euphoria, inspiration |
| `affection` | Bonding, warmth | Love, care, compassion, admiration, gratitude, empathy |
| `desire` | Sexual, wanting | Arousal, longing, anticipation of intimacy, sensual states |
| `attention` | Curiosity, absorption | Focus, interest, flow states, fascination, engagement |
| `threat` | Fear, anxiety | Alarm, dread, panic, nervousness, vigilance |
| `anger` | Hostility, aversion | Irritation, frustration, rage, disgust, resentment |
| `loss` | Grief, sadness | Sorrow, mourning, melancholy, disappointment, loneliness |
| `shame` | Guilt, embarrassment | Humiliation, regret, self-criticism, awkwardness |
| `shutdown` | Numbness, fatigue | Emotional flatness, exhaustion, dissociation, apathy |
| `agency` | Mastery, determination | Confidence, assertiveness, resolve, pride in capability |

### Category Selection Tips

1. **Match the dominant quality** - Choose based on the core emotional experience, not surface appearance
2. **Consider the felt-sense** - What would the character feel internally?
3. **Mixed states** - For complex expressions, choose the category of the most prominent emotion
4. **Intensity doesn't matter** - Categories are about type, not strength (mild irritation and rage both use `anger`)

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

### Prerequisites Best Practices

1. **Core emotion threshold**: Primary emotion that defines the state
2. **Companion emotions**: Supporting emotions that shape the quality
3. **Blockers**: Emotions that would contradict the state
4. **Transition detection**: Threshold crossings or spikes to prevent spam
5. **Failure messages**: Clear explanation of why prerequisites failed
