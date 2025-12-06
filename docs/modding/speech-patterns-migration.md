# Speech Patterns Migration Guide

This guide walks you through converting legacy string-based speech patterns to the new structured object format. The migration is optional—both formats work indefinitely—but the structured format provides better organization and richer LLM guidance.

## Table of Contents

- [Why Migrate](#why-migrate)
- [When to Migrate](#when-to-migrate)
- [8-Step Conversion Process](#8-step-conversion-process)
- [Pattern Grouping Strategies](#pattern-grouping-strategies)
- [Context Selection Guide](#context-selection-guide)
- [Before/After Examples](#beforeafter-examples)
- [Common Pitfalls](#common-pitfalls)
- [Validation Checklist](#validation-checklist)
- [Testing with LLM](#testing-with-llm)
- [Vespera Case Study](#vespera-case-study)

## Why Migrate

The structured format offers several benefits over legacy strings:

| Benefit                   | Description                                        |
| ------------------------- | -------------------------------------------------- |
| **Better Organization**   | Patterns grouped by theme rather than flat list    |
| **Richer Context**        | Explicit tags tell LLM _when_ to use patterns      |
| **Easier Maintenance**    | Add/remove examples without rewriting descriptions |
| **Improved LLM Guidance** | Structured data helps AI understand pattern usage  |
| **Future-Proofing**       | New features will build on structured format       |

### Prompt Output Comparison

**Legacy format** produces:

```xml
<speech_patterns>
  - (when nervous) 'I, um, didn't mean to—sorry.'
  - (casual greeting) 'Hey there, friend!'
</speech_patterns>
```

**Structured format** produces:

```xml
<speech_patterns>
  <!-- Use naturally, not mechanically. Examples show tendencies, not rules. -->

  1. **Nervous Speech**
     Contexts: anxiety, confrontation, social situations

     Examples:
     - "I, um, didn't mean to—sorry."
     - "Could we maybe... never mind."

  2. **Casual Greetings**
     Contexts: friendly encounters, reunions

     Examples:
     - "Hey there, friend!"
     - "Good to see you again!"
</speech_patterns>
```

## When to Migrate

### Migrate If:

- Character has **5+ patterns** that could be grouped thematically
- You want to add **context-aware** pattern usage
- Patterns feel **disorganized** or hard to maintain
- You're **updating** the character anyway
- You want **richer LLM guidance** for dialogue

### Don't Migrate If:

- Character has only **1-3 simple patterns**
- Legacy format is **working well** for your needs
- You don't have time to **test the conversion**
- Patterns are **generic** without clear groupings

### Decision Tree

```
Has 5+ patterns?
├─ No → Keep legacy format
└─ Yes → Can patterns be grouped thematically?
         ├─ No → Keep legacy format
         └─ Yes → Would context tags improve usage?
                  ├─ No → Optional migration
                  └─ Yes → Recommended migration
```

## 8-Step Conversion Process

### Step 1: Extract Current Patterns

Copy your character's existing patterns into a working document:

```json
// Original
"patterns": [
  "(when performing or manipulating) 'Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?'",
  "(casual speech with feline wordplay) 'Purr-haps you could help a girl out?'",
  "(when genuinely upset - no cat sounds) 'Don't. Don't you dare.'",
  "(casual speech) 'Met this merchant—boring as hell, meow.'",
  "(abrupt tonal shift) 'You have gorgeous eyes~ Your pupil dilation suggests arousal but your breathing's defensive.'"
]
```

### Step 2: Identify Themes

Read through patterns and note recurring themes:

- Cat-related sounds and wordplay → **Feline Verbal Tics**
- Sudden mood changes → **Tonal Shifts**
- Violence mentioned casually → **Violence Casualization**
- Moments of vulnerability → **Deflection & Exposure**

### Step 3: Create Category Names

Choose clear, descriptive names (4-8 categories):

```
1. Feline Verbal Tics
2. Tonal Shifts
3. Violence Casualization
4. Deflection & Exposure Patterns
```

### Step 4: Sort Patterns into Categories

Assign each pattern to a category:

| Pattern                      | Category                            |
| ---------------------------- | ----------------------------------- |
| "Oh meow-y goodness..."      | Feline Verbal Tics                  |
| "Purr-haps you could..."     | Feline Verbal Tics                  |
| "Don't. Don't you dare."     | Feline Verbal Tics (absence marker) |
| "You have gorgeous eyes~..." | Tonal Shifts                        |

### Step 5: Extract Pure Examples

Remove inline descriptions, keep only the dialogue:

```
Before: "(when performing or manipulating) 'Oh meow-y goodness...'"
After:  "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?"
```

### Step 6: Determine Contexts

For each category, identify when these patterns appear:

```json
{
  "type": "Feline Verbal Tics",
  "contexts": [
    "Casual context: integrated naturally into speech",
    "Manipulative context: intensified when deceiving",
    "Vulnerable context: complete absence when genuinely upset"
  ]
}
```

### Step 7: Build Structured Objects

Combine into the final format:

```json
{
  "type": "Feline Verbal Tics",
  "contexts": [
    "Casual context: integrated naturally into speech",
    "Manipulative context: intensified when deceiving",
    "Vulnerable context: complete absence when genuinely upset"
  ],
  "examples": [
    "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?",
    "Purr-haps you could help a girl out?",
    "Met this merchant—boring as hell, meow.",
    "Don't. Don't you dare."
  ]
}
```

### Step 8: Validate and Test

1. Run schema validation
2. Load character in game
3. Test dialogue with LLM
4. Verify patterns appear naturally

## Pattern Grouping Strategies

### By Linguistic Feature

Group patterns that share a speech characteristic:

- **Verbal Tics**: Repeated sounds, words, or phrases
- **Sentence Structure**: Short/long, fragments, formal syntax
- **Vocabulary**: Jargon, slang, archaic terms

### By Emotional State

Group patterns by when they emerge emotionally:

- **Anxious Speech**: Patterns when nervous
- **Confident Speech**: Patterns when in control
- **Vulnerable Speech**: Patterns when exposed

### By Social Context

Group patterns by interaction type:

- **Authority Dynamics**: Speaking to superiors/inferiors
- **Intimate Conversation**: Close personal talks
- **Public Performance**: When observed by many

### By Character Trait

Group patterns that express specific traits:

- **Combat Mindset**: Violence-related patterns
- **Intellectual Curiosity**: Knowledge-seeking patterns
- **Emotional Deflection**: Self-protection patterns

## Context Selection Guide

### Good Context Tags

**Emotional triggers**:

- `anxiety`, `confidence`, `vulnerability`, `anger`, `joy`

**Situational triggers**:

- `combat`, `negotiation`, `storytelling`, `teaching`

**Social triggers**:

- `with strangers`, `with intimates`, `in public`, `alone`

**Frequency indicators**:

- `rare`, `common`, `when stressed`, `when relaxed`

### Context Tag Patterns

**Descriptive phrases** work well:

```json
"contexts": [
  "Casual context: integrated naturally into speech",
  "Vulnerable context: complete absence when genuinely upset"
]
```

**Simple tags** also work:

```json
"contexts": ["casual", "manipulative", "vulnerable"]
```

Choose whichever style better captures the nuance.

## Before/After Examples

### Example 1: Simple Character

**Before (5 legacy patterns)**:

```json
{
  "patterns": [
    "(nervous laugh) 'Ha, well, you know how it is...'",
    "(apologetic) 'Sorry, sorry, I didn't mean—'",
    "(self-deprecating) 'I'm not really that smart, honestly.'",
    "(excited about books) 'Oh! This reminds me of a passage in—'",
    "(trailing off) 'I just thought maybe we could... never mind.'"
  ]
}
```

**After (2 structured categories)**:

```json
{
  "patterns": [
    {
      "type": "Anxious Deflections",
      "contexts": [
        "social situations",
        "receiving attention",
        "making mistakes"
      ],
      "examples": [
        "Ha, well, you know how it is...",
        "Sorry, sorry, I didn't mean—",
        "I'm not really that smart, honestly.",
        "I just thought maybe we could... never mind."
      ]
    },
    {
      "type": "Academic Enthusiasm",
      "contexts": [
        "discussing books",
        "making connections",
        "teaching moments"
      ],
      "examples": [
        "Oh! This reminds me of a passage in—",
        "Fascinating! The parallel to Thornwick's theory is—"
      ]
    }
  ]
}
```

### Example 2: Complex Character

**Before (18 legacy patterns)**:

```json
{
  "patterns": [
    "(when performing or manipulating, she lays it on thick) 'Oh meow-y goodness...'",
    "(casual feline wordplay) 'Purr-haps you could help?'",
    "(abrupt shift from flirtation to analysis) 'Your eyes are gorgeous~ Your breathing suggests trauma.'",
    "(violence as mundane) 'Killed three bandits before breakfast.'"
    // ... 14 more patterns
  ]
}
```

**After (6 structured categories)**:

```json
{
  "patterns": [
    {
      "type": "Feline Verbal Tics",
      "contexts": ["casual", "manipulative", "vulnerable (absence)"],
      "examples": [
        "Oh meow-y goodness...",
        "Purr-haps...",
        "Don't. Don't you dare."
      ]
    },
    {
      "type": "Tonal Shifts",
      "contexts": ["flirtation to analysis", "vulnerability to deflection"],
      "examples": ["Your eyes are gorgeous~ Your breathing suggests trauma."]
    },
    {
      "type": "Violence Casualization",
      "contexts": ["combat", "mundane conversation"],
      "examples": ["Killed three bandits before breakfast.", "Decent workout."]
    }
    // ... 3 more categories
  ]
}
```

## Common Pitfalls

### Pitfall 1: Too Many Categories

**Problem**: Creating 10+ categories dilutes focus.

**Solution**: Merge related categories. Aim for 4-8.

```json
// Too granular
"Greetings", "Farewells", "Casual Talk", "Small Talk"

// Better
"Social Niceties" (with varied examples)
```

### Pitfall 2: Overlapping Categories

**Problem**: Similar patterns in multiple categories.

**Solution**: Ensure each category is distinct. If unsure where a pattern belongs, it probably means categories need rethinking.

### Pitfall 3: Generic Context Tags

**Problem**: Tags like "speech" or "talking" don't help the LLM.

**Solution**: Be specific about _when_ and _why_.

```json
// Too generic
"contexts": ["speaking", "dialogue"]

// Better
"contexts": ["confrontation", "defending self", "caught in lie"]
```

### Pitfall 4: Losing Pattern Nuance

**Problem**: Stripping inline descriptions loses important context.

**Solution**: Move that context into the `contexts` field:

```json
// Original
"(when genuinely upset, NO cat sounds) 'Don't. Don't you dare.'"

// Converted - preserve the nuance
{
  "type": "Feline Verbal Tics",
  "contexts": [
    "Casual: integrated naturally",
    "Vulnerable: complete ABSENCE when genuinely upset"
  ],
  "examples": [
    "Meow, that's interesting.",
    "Don't. Don't you dare."  // The absence example
  ]
}
```

### Pitfall 5: Inconsistent Voice

**Problem**: Examples in a category sound like different characters.

**Solution**: Review all examples in each category for voice consistency.

## Validation Checklist

Before finalizing your migration:

### Structure

- [ ] 4-8 pattern categories
- [ ] Each category has `type` and `examples`
- [ ] Each category has 2-5 examples
- [ ] Total examples: 15-25

### Content Quality

- [ ] Category names are clear and distinct
- [ ] Context tags are specific and helpful
- [ ] Examples are authentic to character
- [ ] No duplicate examples across categories

### Technical

- [ ] Valid JSON syntax
- [ ] Schema validation passes (`npm run validate:mod:yourmod`)
- [ ] Character loads successfully
- [ ] No console errors

### Completeness

- [ ] All original patterns accounted for
- [ ] No important speech characteristics lost
- [ ] Pattern richness preserved

## Testing with LLM

After migration, test dialogue quality:

### Test 1: Natural Usage

Generate several dialogue exchanges. Patterns should appear naturally, not in every line.

**Good**: Patterns emerge when contextually appropriate.
**Bad**: Every sentence contains a pattern mechanically.

### Test 2: Context Awareness

Create scenarios matching your context tags. The LLM should favor those patterns.

**Good**: Nervous patterns appear in stressful situations.
**Bad**: Nervous patterns appear when character is relaxed.

### Test 3: Pattern Absence

Sometimes characters should speak _without_ distinctive patterns.

**Good**: Normal sentences appear alongside patterned speech.
**Bad**: Character cannot speak a single plain sentence.

### Test 4: Voice Consistency

Read dialogue aloud. Does it sound like one character?

**Good**: Consistent voice across all patterns.
**Bad**: Feels like multiple characters merged together.

## Vespera Case Study

This section walks through the real conversion of Vespera Nightwhisper.

### Starting Point

Vespera had 18 legacy string patterns covering:

- Cat-girl verbal tics (meow, purr, etc.)
- Bard's narrative tendency
- Tonal shifts from playful to cold
- Casual references to violence
- Emotional deflection patterns
- Memory gaps and possession themes

### Grouping Decision

Analysis revealed 6 natural groupings:

1. **Feline Verbal Tics** - Cat sounds and their situational usage
2. **Narrativization Bleeding** - Processing events as story material
3. **Tonal Shifts** - Abrupt mood/register changes
4. **Violence Casualization** - Combat as mundane topic
5. **Deflection & Exposure** - Vulnerability and self-protection
6. **Fragmented Memory & Possession** - Ghost influence themes

### Context Development

Each category got contexts explaining _when_ patterns appear:

```json
{
  "type": "Feline Verbal Tics",
  "contexts": [
    "Casual context: 'meow', 'mrow', 'mmh' integrated naturally into speech",
    "Manipulative context: Intensified cuteness when deceiving",
    "Vulnerable context: Complete absence of cat-sounds when genuinely upset"
  ]
}
```

Note how the third context describes **absence** of the pattern—this helps the LLM understand that genuine distress strips away the verbal tics.

### Example Distribution

| Category                 | Examples | Original Patterns |
| ------------------------ | -------- | ----------------- |
| Feline Verbal Tics       | 5        | 4                 |
| Narrativization Bleeding | 3        | 3                 |
| Tonal Shifts             | 3        | 4                 |
| Violence Casualization   | 4        | 3                 |
| Deflection & Exposure    | 3        | 2                 |
| Fragmented Memory        | 2        | 2                 |
| **Total**                | **20**   | **18**            |

Slight increase in examples because some patterns were split to show more variety.

### Results

- All tests passed
- Character file validates against schema
- Dialogue quality improved (subjective assessment)
- LLM respects context tags appropriately
- Pattern usage feels more natural

### Lessons Learned

1. **Context tags can describe absence**: "No cat sounds when genuinely upset" is valuable guidance.
2. **Some patterns span categories**: A single example might show both "tonal shift" and "vulnerability"—choose the primary category.
3. **Quality over quantity**: Better to have 3 excellent examples than 6 mediocre ones.
4. **Test with actual gameplay**: Schema validation isn't enough—real dialogue testing matters.

---

**Related Documentation**:

- [Speech Patterns Guide](./speech-patterns-guide.md) - Complete format reference and best practices
- [Component Schema](../../data/mods/core/components/speech_patterns.component.json) - Technical schema definition
