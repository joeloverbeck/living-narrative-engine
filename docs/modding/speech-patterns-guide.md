# Speech Patterns Guide

This guide explains how to define speech patterns for characters in the Living Narrative Engine. Speech patterns help LLMs generate dialogue that captures a character's unique verbal style, quirks, and personality.

## Table of Contents

- [Overview](#overview)
- [Format Comparison](#format-comparison)
- [Structured Format Details](#structured-format-details)
- [Context Tags Vocabulary](#context-tags-vocabulary)
- [Best Practices](#best-practices)
- [Complete Examples](#complete-examples)
- [Schema Reference](#schema-reference)
- [Validation Workflow](#validation-workflow)
- [Troubleshooting](#troubleshooting)

## Overview

The **speech patterns component** (`core:speech_patterns`) stores distinctive examples of how a character speaks. These patterns help LLMs understand and replicate:

- Unique vocabulary and word choices
- Sentence structures and cadence
- Catchphrases and verbal tics
- Context-dependent speech variations
- Emotional expression styles

Speech patterns are defined in character entity files within the `components` section:

```json
{
  "id": "mymod:my_character",
  "components": {
    "core:speech_patterns": {
      "patterns": [
        // Your patterns go here
      ]
    }
  }
}
```

## Format Comparison

The system supports two formats for defining speech patterns:

| Feature | Legacy String Format | Structured Object Format |
|---------|---------------------|-------------------------|
| Organization | Flat list | Grouped by category |
| Context Info | Inline (manual) | Dedicated `contexts` field |
| Examples | Single per entry | Multiple per category |
| Readability | Lower | Higher |
| Maintainability | Harder to update | Easier to update |
| LLM Guidance | Basic | Rich context |

### Legacy String Format

Simple strings with inline descriptions:

```json
{
  "core:speech_patterns": {
    "patterns": [
      "(when nervous) 'I, um, didn't mean to—sorry.'",
      "(casual greeting) 'Hey there, friend!'",
      "(formal speech) 'I humbly request your consideration.'"
    ]
  }
}
```

### Structured Object Format

Organized objects with explicit metadata:

```json
{
  "core:speech_patterns": {
    "patterns": [
      {
        "type": "Nervous Speech",
        "contexts": ["anxiety", "confrontation", "social situations"],
        "examples": [
          "I, um, didn't mean to—sorry.",
          "Could we maybe... never mind.",
          "Is it hot in here or is it just—sorry."
        ]
      }
    ]
  }
}
```

**Recommendation**: Use the structured format for new characters. It provides better organization and richer guidance to the LLM.

## Structured Format Details

Each structured pattern object has three fields:

### `type` (required)

A descriptive category name for the speech pattern group.

**Good type names**:
- "Feline Verbal Tics"
- "Nervous Deflections"
- "Formal Register"
- "Combat Banter"
- "Tonal Shifts"

**Avoid**:
- Generic names like "Pattern 1" or "Speech Type A"
- Overly long descriptions
- Names that don't clearly describe the pattern

### `contexts` (optional)

An array of strings describing when this pattern typically appears.

```json
"contexts": ["casual", "manipulative", "vulnerable"]
```

Context tags help the LLM understand **when** to use these patterns, not just **what** they sound like.

### `examples` (required)

An array of concrete dialogue examples (minimum 1, recommended 2-5).

```json
"examples": [
  "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?",
  "Purr-haps you could help a girl out?",
  "That's just paw-fully rude!"
]
```

**Tips for examples**:
- Include actual dialogue, not descriptions
- Show variety within the pattern category
- Capture the character's authentic voice
- Include emotional cues where relevant (e.g., `*laughs*`, `*tail flicking*`)

## Context Tags Vocabulary

Use lowercase, consistent context tags. Here are recommended categories:

### Emotional States
- `casual` - Relaxed, everyday conversation
- `formal` - Official or respectful situations
- `vulnerable` - Emotionally exposed moments
- `defensive` - When feeling threatened
- `playful` - Lighthearted interactions
- `aggressive` - Confrontational moments

### Social Contexts
- `manipulative` - When attempting to influence others
- `intimate` - Close personal conversations
- `public` - Performing for an audience
- `professional` - Work or business settings

### Situational Contexts
- `combat` - During or after fights
- `storytelling` - When narrating or explaining
- `evasive` - Avoiding direct answers
- `confessional` - Rare honest moments

### Character-Specific
- `revealing moments` - When masks slip
- `power dynamics` - Hierarchy-aware speech
- `identity crisis` - Uncertainty about self

## Best Practices

### Pattern Organization

**Aim for 4-8 categories** per character. This provides enough variety without overwhelming the LLM.

- Too few (1-3): May feel one-dimensional
- Optimal (4-8): Rich but focused
- Too many (9+): Can dilute impact and confuse

### Example Count

**Aim for 15-25 total examples** across all categories.

- Each category: 2-5 examples
- Balance across categories
- Quality over quantity

### Avoiding Mechanical Dialogue

The goal is **natural speech**, not robotic pattern matching. Good patterns help the LLM understand tendencies, not rules.

**Do**:
- Show patterns that emerge organically
- Include examples of when patterns *don't* appear (via contexts)
- Let examples demonstrate flexibility

**Don't**:
- Create patterns that must appear in every sentence
- Make patterns so unique they feel forced
- Forget that silence/normalcy is also valid

### Pattern Distinctiveness

Each category should feel clearly different:

```json
// Good: Distinct categories
[
  { "type": "Nervous Tics", "examples": ["I, um...", "Sorry, I just..."] },
  { "type": "Confident Declarations", "examples": ["Make no mistake.", "I guarantee it."] }
]

// Bad: Overlapping categories
[
  { "type": "Speech Pattern A", "examples": ["I think maybe..."] },
  { "type": "Speech Pattern B", "examples": ["I think perhaps..."] }
]
```

## Complete Examples

### Example 1: Nervous Scholar

```json
{
  "core:speech_patterns": {
    "patterns": [
      {
        "type": "Hesitant Speech",
        "contexts": ["social situations", "confrontation", "new people"],
        "examples": [
          "I, um, I was just thinking that maybe—never mind.",
          "Could you perhaps... no, it's nothing important.",
          "Sorry, I didn't mean to interrupt, but..."
        ]
      },
      {
        "type": "Academic Enthusiasm",
        "contexts": ["discussing research", "teaching", "discovery"],
        "examples": [
          "Oh! This is exactly what I theorized! The crystalline structure proves—",
          "Fascinating, absolutely fascinating. Do you see how the patterns align?",
          "I've read about this! In Thornwick's third volume, chapter seven—"
        ]
      },
      {
        "type": "Self-Deprecation",
        "contexts": ["receiving praise", "making mistakes", "introductions"],
        "examples": [
          "Me? No, I just got lucky with the translation.",
          "I should have caught that error. I'm sorry.",
          "I'm nobody important, really. Just a researcher."
        ]
      }
    ]
  }
}
```

### Example 2: Confident Merchant

```json
{
  "core:speech_patterns": {
    "patterns": [
      {
        "type": "Sales Pitch Language",
        "contexts": ["negotiation", "first impressions", "persuasion"],
        "examples": [
          "My friend, you have excellent taste. This piece is one of a kind.",
          "I'll tell you what—because I like you—special price. Just this once.",
          "Quality recognizes quality. I can see you understand value."
        ]
      },
      {
        "type": "Street Wisdom",
        "contexts": ["advice", "warnings", "casual conversation"],
        "examples": [
          "In this business, you learn to read people. And you, friend, are an open book.",
          "Trust is the currency that matters. Gold comes and goes.",
          "Never show them the bottom of your purse or the depth of your desperation."
        ]
      },
      {
        "type": "Cultural Expressions",
        "contexts": ["emphasis", "agreement", "surprise"],
        "examples": [
          "By the Brass Scales! That's a proposition worth considering.",
          "As my grandmother always said, 'The early seller sets the price.'",
          "Hai! You drive a hard bargain. I respect that."
        ]
      }
    ]
  }
}
```

### Example 3: Vespera Nightwhisper (Complex Character)

This real example shows a character with 6 distinct pattern categories:

```json
{
  "core:speech_patterns": {
    "patterns": [
      {
        "type": "Feline Verbal Tics",
        "contexts": [
          "Casual context: \"meow\", \"mrow\", \"mmh\" integrated naturally into speech",
          "Manipulative context: Intensified cuteness when deceiving",
          "Vulnerable context: Complete absence of cat-sounds when genuinely upset"
        ],
        "examples": [
          "Mrrrow... I could play the ballad about the duke's wife... or mmh... maybe something newer?",
          "Met this merchant—boring as hell, meow, but he knew stories from the Brass Islands.",
          "Oh meow-y goodness, surely you wouldn't let a poor kitty go thirsty?",
          "Oh meow-y stars, you have NO idea what I can do~",
          "Don't. Don't you dare."
        ]
      },
      {
        "type": "Tonal Shifts",
        "contexts": [
          "Abrupt transitions from flirtation to cold analysis without warning",
          "Deflects genuine compliments with aggressive flirtation or mockery",
          "Rare moments of genuine vulnerability followed by immediate deflection"
        ],
        "examples": [
          "You have gorgeous eyes, truly mesmerizing~ Your pupil dilation suggests arousal but your breathing's defensive. Childhood trauma or recent betrayal?",
          "Oh, you think I'm talented? How adorable. Want to fuck about it, or should we skip to the part where you're disappointed?",
          "Sometimes I think I'm just empty inside, you know? Just performance all the way down. *laughs* Gods, how fucking melodramatic. Forget I said that."
        ]
      },
      {
        "type": "Violence Casualization",
        "contexts": [
          "Combat and death treated as mundane background events",
          "Combat language becomes tactical and detached during fights",
          "Trails off mid-sentence about violent experiences"
        ],
        "examples": [
          "Killed three bandits before breakfast, mrow. You were saying?",
          "Three on the left, two behind. The one with the axe moves like he's compensating—target him first. Beautiful formation, really. Shall we?",
          "Decent workout. You were saying about the contract?"
        ]
      }
    ]
  }
}
```

## Schema Reference

Speech patterns are validated against the `core:speech_patterns` component schema.

**Schema Location**: `data/mods/core/components/speech_patterns.component.json`

### Validation Rules

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `patterns` | array | Yes | Contains strings or objects |
| `type` | string | Yes (for objects) | Non-empty |
| `contexts` | array of strings | No | Defaults to empty array |
| `examples` | array of strings | Yes (for objects) | Minimum 1 item |

### Mixed Format Support

You can mix legacy strings and structured objects in the same array (backward compatibility), but this is **not recommended**:

```json
{
  "patterns": [
    { "type": "Formal", "examples": ["Good day."] },
    "(casual) 'Hey there!'"  // Legacy string - avoid mixing
  ]
}
```

## Validation Workflow

### 1. Validate JSON Syntax

Ensure your character file is valid JSON:

```bash
# Use the project's validation command
npm run validate:mod:yourmodname
```

### 2. Schema Validation

The engine validates speech patterns against the component schema during mod loading. Invalid patterns will produce clear error messages.

### 3. Manual Review

Check that:
- [ ] Categories are distinct and meaningful
- [ ] Context tags are lowercase and consistent
- [ ] Examples feel authentic to the character
- [ ] No duplicate examples across categories
- [ ] Total examples within 15-25 range

### 4. In-Game Testing

Test with the LLM to verify:
- Patterns appear naturally in dialogue
- Context-appropriate usage
- No mechanical cycling through patterns
- Natural absence of patterns when appropriate

## Troubleshooting

### "Required property 'type' is missing"

Your object pattern is missing the `type` field:

```json
// Wrong
{ "examples": ["Hello!"] }

// Correct
{ "type": "Greeting", "examples": ["Hello!"] }
```

### "Required property 'examples' is missing"

Your object pattern needs at least one example:

```json
// Wrong
{ "type": "Greeting", "contexts": ["casual"] }

// Correct
{ "type": "Greeting", "contexts": ["casual"], "examples": ["Hello!"] }
```

### "items must match exactly one schema in oneOf"

Your pattern is neither a valid string nor a valid object. Check for:
- Objects with invalid field names
- Arrays where strings/objects expected
- Null values

### Patterns Feel Mechanical in Dialogue

If the LLM cycles through patterns robotically:
1. Reduce the number of patterns
2. Add more diverse examples per category
3. Include context tags that limit when patterns apply
4. Remember: the LLM should use patterns *naturally*, not constantly

### Character Voice Feels Inconsistent

If the character doesn't sound cohesive:
1. Review examples for voice consistency
2. Ensure categories don't contradict each other
3. Check that examples all feel like the same character
4. Consider whether some patterns are too generic

---

**Related Documentation**:
- [Speech Patterns Migration Guide](./speech-patterns-migration.md) - Converting legacy patterns to structured format
- [Component Schema](../../data/mods/core/components/speech_patterns.component.json) - Technical schema definition
