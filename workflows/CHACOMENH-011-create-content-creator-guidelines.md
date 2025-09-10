# CHACOMENH-011: Create Content Creator Guidelines

**Phase**: Documentation & Tools  
**Priority**: Medium  
**Complexity**: Medium  
**Dependencies**: CHACOMENH-001 through CHACOMENH-006  
**Estimated Time**: 2-3 hours

## Summary

Create comprehensive documentation and guidelines for content creators (writers, game designers, mod developers) on how to effectively use the three new psychological character components. This includes writing tips, examples, best practices, and common pitfalls to avoid.

## Background

The psychological components (motivations, internal tensions, core dilemmas) add significant depth to character development but require careful crafting to be effective. Content creators need clear guidance on how to write compelling psychological profiles that enhance LLM-generated responses without creating contradictions or confusion.

## Documentation Structure

### 1. Main Documentation File

Create: `docs/content-creation/psychological-components-guide.md`

````markdown
# Psychological Components Guide for Content Creators

## Overview

The Living Narrative Engine now supports three psychological character components that add depth and nuance to AI-generated character responses:

1. **Motivations** - WHY characters act (psychological drivers)
2. **Internal Tensions** - Conflicting desires creating complexity
3. **Core Dilemmas** - Fundamental questions without easy answers

These components are **optional** but highly recommended for main characters, antagonists, and important NPCs.

## Component Definitions

### Motivations

**Purpose:** Explain the deep psychological reasons behind a character's actions, distinct from their concrete goals.

**Key Distinction:**

- ❌ Goal: "I want to become captain of the guard"
- ✅ Motivation: "I need to prove I'm more than my father's disappointment"

**Writing Format:** First-person perspective, revealing inner psychology

### Internal Tensions

**Purpose:** Create realistic internal conflict through competing desires or beliefs.

**Key Characteristics:**

- Shows contradictory impulses
- Creates dynamic character behavior
- Explains inconsistent actions

**Writing Format:** First-person, expressing conflicting desires with "but," "yet," or "however"

### Core Dilemmas

**Purpose:** Present philosophical or moral questions the character grapples with.

**Key Requirements:**

- MUST be phrased as questions
- Should have no easy answers
- Drive character development

**Writing Format:** First-person questions that reveal deeper struggles

## Writing Guidelines

### Effective Motivations

#### DO:

- Reveal emotional needs behind actions
- Connect to character's past experiences
- Show vulnerability and humanity
- Use emotional language

#### DON'T:

- List goals or objectives
- Describe what they want to achieve
- Use third-person perspective
- Make them too simple

#### Examples:

**Excellent:**
"I push everyone away before they can abandon me, just like mother did. Every friendship feels like a countdown to betrayal, so I strike first. The loneliness is crushing, but it's safer than the alternative."

**Good:**
"I seek power because I was powerless as a child. Every achievement is armor against ever feeling that vulnerable again."

**Weak:**
"I want to be successful and respected."

### Crafting Internal Tensions

#### DO:

- Present genuine contradictions
- Show emotional complexity
- Make both desires understandable
- Use contrasting conjunctions

#### DON'T:

- Create artificial conflicts
- Make one side obviously wrong
- Oversimplify the tension
- Resolve the conflict

#### Examples:

**Excellent:**
"I desperately crave intimacy and connection, yet every time someone gets close, I feel trapped and suffocated. I build walls while longing for someone to break them down, then panic when they try."

**Good:**
"I want revenge for what they did to my family, but I also know that forgiveness might be the only path to peace."

**Weak:**
"I like both chocolate and vanilla ice cream."

### Formulating Core Dilemmas

#### DO:

- Ask profound questions
- Touch on universal themes
- Connect to character's situation
- Allow multiple valid answers

#### DON'T:

- Ask questions with obvious answers
- Make them too abstract
- Forget the question marks
- Provide answers

#### Examples:

**Excellent:**
"If I save my village by betraying my principles, am I a hero or a villain? Can good outcomes justify evil methods? How many compromises can I make before I become the very thing I swore to fight?"

**Good:**
"Is loyalty to family more important than loyalty to truth? Can I honor my father while exposing his crimes?"

**Weak:**
"Should I eat breakfast today?"

## Character Archetypes & Templates

### The Reluctant Leader

```json
{
  "motivations": "I never wanted power, but I've seen what happens when the wrong people wield it. I lead not from ambition but from a crushing sense of responsibility that I wish someone else would take.",
  "internal_tensions": "I want to inspire others, yet I doubt every decision I make. I project confidence while drowning in uncertainty.",
  "core_dilemmas": "Do people follow me or the image I present? If leadership requires deception, am I still worthy of trust?"
}
```
````

### The Reformed Villain

```json
{
  "motivations": "Every good deed is penance for the monster I was. I save others because I couldn't save myself from becoming what I hated. The weight of my past drives every act of kindness.",
  "internal_tensions": "I want redemption but believe I don't deserve it. I help others while hating myself for needing their gratitude.",
  "core_dilemmas": "Can evil acts ever truly be atoned for? Am I doing good for others or just to ease my own guilt?"
}
```

### The Idealistic Revolutionary

```json
{
  "motivations": "I've seen too much injustice to stay silent. Every oppressed voice echoes my own past helplessness. I fight because standing still feels like drowning in others' suffering.",
  "internal_tensions": "I preach peace while planning violence. I love humanity but struggle to connect with individuals.",
  "core_dilemmas": "When does fighting oppression become oppression itself? How many must suffer for the greater good?"
}
```

## Integration with Other Components

### Aligning with Personality

Ensure psychological components complement, not contradict, personality traits:

**Personality:** "Cheerful and optimistic"
**Motivations:** "I maintain constant cheerfulness because if I stop smiling, I might never start again. The darkness I'm running from terrifies me."

### Connecting to Background (Profile)

Link psychological elements to character history:

**Profile:** "Former soldier who lost their unit"
**Internal Tensions:** "I need to form new bonds but can't bear the thought of losing anyone again."

### Influencing Goals

Show how psychology drives objectives:

**Core Dilemma:** "Is preventing future wars worth becoming a tyrant?"
**Goal:** "Establish absolute peace through unified rule"

## Common Pitfalls to Avoid

### 1. Making Motivations Too Surface-Level

❌ "I want money because I like nice things"
✅ "I hoard wealth because poverty once made me invisible, and I swear I'll never be overlooked again"

### 2. Creating Contradictions That Make No Sense

❌ "I love animals but also hate all living things"
✅ "I'm drawn to animals' unconditional loyalty while distrusting human complexity"

### 3. Asking Dilemmas with Obvious Answers

❌ "Should I be mean or kind?"
✅ "Does kindness without power create change, or does it merely comfort the conscience?"

### 4. Writing in Third Person

❌ "They seek validation from others"
✅ "I seek validation from others"

### 5. Over-Explaining

❌ "I am sad because when I was seven years old, on a Tuesday in March..."
✅ "That March day when I was seven changed everything. I've been running from it ever since."

## Advanced Techniques

### Layered Motivations

Create depth through multiple interconnected drives:

"I pursue knowledge relentlessly—partly to honor my mentor's memory, partly to prove my parents wrong about my potential, but mostly because learning delays confronting who I am without these pursuits."

### Evolving Tensions

Design tensions that can shift with character development:

"I used to crave solitude while fearing loneliness. Now I seek connection while fearing I've forgotten how to truly connect."

### Cascading Dilemmas

Link questions that build on each other:

"If I am not my achievements, who am I? If I stop achieving, will I cease to exist? But if I only exist through achievement, have I ever truly lived?"

## Testing Your Components

### Internal Consistency Check

- Do motivations explain the character's actions?
- Do tensions create believable inconsistency?
- Do dilemmas drive character growth?

### Voice Authenticity

- Read aloud—does it sound natural?
- Would this character actually think this way?
- Is the emotional tone consistent?

### LLM Response Test

- Generate sample responses with your character
- Check if psychological elements influence behavior
- Verify consistency across multiple interactions

## Quick Reference Card

### Component Checklist

- [ ] Motivations reveal WHY, not WHAT
- [ ] Tensions show genuine internal conflict
- [ ] Dilemmas are phrased as questions
- [ ] All use first-person perspective
- [ ] Emotional depth is present
- [ ] Connected to other components
- [ ] Avoids common pitfalls

### Word Count Guidelines

- **Motivations:** 50-200 words
- **Internal Tensions:** 40-150 words
- **Core Dilemmas:** 30-100 words

### Emotional Depth Indicators

Strong components typically include:

- Vulnerability
- Contradiction
- Specificity
- Emotional language
- Personal history references
- Universal themes

## Examples from Published Works

### Literary Example (Hamlet-inspired)

```json
{
  "motivations": "I must avenge my father, yet every action feels like a betrayal of my own nature. I am trapped between the son I should be and the man I am.",
  "internal_tensions": "I crave decisive action while drowning in contemplation. I seek truth but fear what I'll find.",
  "core_dilemmas": "Is revenge justice or merely perpetuating evil? Can I act without certainty? Is madness refuge or prison?"
}
```

### Game Character Example (Geralt-inspired)

```json
{
  "motivations": "I maintain neutrality because choosing sides once cost me everything. My detachment is armor, not apathy—I care too much to risk caring at all.",
  "internal_tensions": "I claim to avoid politics while constantly making moral choices. I insist I'm not a hero while compulsively helping others.",
  "core_dilemmas": "Can neutrality exist when people suffer? Is choosing not to choose still a choice? Does my nature define my destiny?"
}
```

## Workshop Exercises

### Exercise 1: Motivation Mining

1. Write a character's surface goal
2. Ask "why?" five times, going deeper each time
3. The fifth answer is your motivation seed

### Exercise 2: Tension Building

1. List two things your character wants
2. Find ways they conflict
3. Express both desires in one sentence using "but" or "yet"

### Exercise 3: Dilemma Discovery

1. Identify character's core value
2. Create situation where that value hurts someone
3. Phrase as question with no clear answer

## Frequently Asked Questions

**Q: Can I leave these components empty?**
A: Yes, they're optional. However, main characters benefit significantly from having them.

**Q: How long should each component be?**
A: Quality over quantity. A concise, powerful statement beats lengthy rambling.

**Q: Should all characters have all three components?**
A: No. Minor NPCs might only need one or none. Focus on characters with significant story roles.

**Q: Can these components change during gameplay?**
A: Yes! Character development can involve evolving psychological components.

**Q: How do I avoid making characters too depressing?**
A: Balance heavy psychological elements with moments of hope, humor, or determination.

## Resources and References

### Recommended Reading

- "Creating Character Depth" by Mark Johnson
- "The Psychology of Fictional Characters" by Sarah Chen
- "Internal Conflict in Narrative" by James Rivera

### Component Templates

Available in: `/data/templates/psychological-components/`

### Community Examples

Share and discuss at: [community-forum-link]

---

_Last Updated: [Date]_
_Version: 1.0_
_Feedback: [feedback-link]_

````

### 2. Quick Reference File

Create: `docs/content-creation/psychological-components-quick-ref.md`

```markdown
# Psychological Components Quick Reference

## At a Glance

| Component | Purpose | Perspective | Key Words | Question? |
|-----------|---------|-------------|-----------|-----------|
| **Motivations** | WHY they act | First-person | "because", "need", "must" | No |
| **Internal Tensions** | Conflicting desires | First-person | "but", "yet", "while" | No |
| **Core Dilemmas** | Fundamental questions | First-person | "Can I?", "Should I?", "Is it?" | YES |

## Quick Templates

### Motivations
"I [action] because [deep emotional reason]. [Past event] made me [current behavior]."

### Internal Tensions
"I want [desire A], but/yet I also [conflicting desire B]."

### Core Dilemmas
"[Question about morality/purpose/identity]? [Related deeper question]?"

## Do's and Don'ts

| ✅ DO | ❌ DON'T |
|-------|----------|
| Use first-person | Use third-person |
| Show vulnerability | List goals |
| Connect to past | Be generic |
| Create depth | Over-explain |
| Ask hard questions | Give answers |
````

### 3. Workshop Materials File

Create: `docs/content-creation/workshop-exercises.md`

```markdown
# Psychological Components Workshop

## Workshop 1: Finding Character Motivations

### The "Five Whys" Exercise

Transform surface goals into deep motivations:

1. **Goal:** "I want to become rich"
2. **Why?** "So I have security"
3. **Why?** "Because I fear being vulnerable"
4. **Why?** "Because vulnerability meant abuse in my childhood"
5. **Why?** "Because those who should have protected me didn't"
6. **Why?** "Because they were too broken by their own trauma"

**Result Motivation:** "I accumulate wealth as armor against the vulnerability that once nearly destroyed me. Every coin is a brick in the wall between me and the helpless child I was."

[Additional exercises...]
```

## Implementation Tasks

### Documentation Creation

- [ ] Write main guide document
- [ ] Create quick reference card
- [ ] Develop workshop exercises
- [ ] Add examples library

### Integration Points

- [ ] Link from main README
- [ ] Reference in component JSON files
- [ ] Include in developer docs
- [ ] Add to mod creation guide

### Review Process

- [ ] Content creator review
- [ ] Technical accuracy check
- [ ] Example validation
- [ ] Clarity assessment

## Acceptance Criteria

- [ ] Comprehensive guide document created
- [ ] Clear distinction between components explained
- [ ] Multiple examples for each component provided
- [ ] Common pitfalls documented
- [ ] Workshop exercises included
- [ ] Quick reference available
- [ ] Integration with other components explained
- [ ] Testing guidance provided
- [ ] FAQ section complete
- [ ] Templates and resources listed

## Distribution

### Documentation Locations

- Main guide: `/docs/content-creation/`
- Quick reference: `/docs/content-creation/`
- Templates: `/data/templates/`
- Examples: `/data/examples/`

### Format Versions

- Markdown (primary)
- PDF (generated)
- HTML (for web docs)

## Notes

- Focus on practical application
- Use real examples where possible
- Keep language accessible to non-programmers
- Emphasize creative writing aspects
- Provide clear success metrics

---

_Ticket created from character-components-analysis.md report_
