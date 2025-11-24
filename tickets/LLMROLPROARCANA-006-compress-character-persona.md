# LLMROLPROARCANA-006: Compress Character Persona from 4,000 to 2,500 Tokens

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 2, Phase 2, Task 2
**Priority:** HIGH ⭐⭐⭐⭐
**Estimated Effort:** Medium (8-12 hours)
**Impact:** 37% token reduction in persona section (4,000 → 2,500 tokens), maintained quality
**Phase:** 2 - Quality Improvements (Week 2)

## Problem Statement

The character persona section currently consumes 4,000+ tokens (49% of the entire prompt), with opportunities for compression without losing psychological depth:

**Current Structure:**
- Description, Personality, Profile (overlapping content)
- Core Motivations (excellent depth)
- Internal Tensions (excellent depth)
- Core Dilemmas (excellent depth)
- Likes, Dislikes, Strengths, Weaknesses, Secrets, Fears (list format)
- Speech Patterns (17 examples - being addressed in LLMROLPROARCANA-005)

**Issues:**
- Long unbroken paragraphs reduce scannability
- Some sections overlap conceptually (Personality + Profile)
- Excessive detail in lists (Likes/Dislikes with extended explanations)
- Speech patterns at 800 tokens (being reduced to 400 in LLMROLPROARCANA-005)

## Objective

Compress character persona section from 4,000 to 2,500 tokens (37% reduction) while maintaining or enhancing psychological depth and character authenticity.

## Acceptance Criteria

- [ ] Total persona token count reduced to 2,500 tokens (from 4,000)
- [ ] Psychological depth preserved (Core Motivations, Tensions, Dilemmas intact)
- [ ] Overlapping sections (Personality + Profile) merged
- [ ] List-based traits (Likes, Dislikes, etc.) condensed to bullet points
- [ ] Unbroken paragraphs converted to structured bullets
- [ ] Character voice quality maintained (human evaluation: >8/10)
- [ ] All tests pass with compressed persona

## Technical Implementation

### Files to Modify

1. **`src/prompting/templates/characterPromptTemplate.js`**
   - Refactor `buildCharacterPersona()` → `buildCharacterIdentity()`
   - Create compression helpers for trait lists
   - Implement structured formatting utilities

2. **`data/prompts/corePromptText.json`**
   - Update character persona template structure
   - Apply compression patterns to static text

3. **Character entity files** (e.g., `data/mods/fantasy/entities/definitions/*.character.json`)
   - Update character data structure if needed
   - Ensure compatibility with compressed format

### Proposed Compressed Structure

```xml
<character_data>
  <!-- THIS IS YOUR IDENTITY. All thoughts/actions/words stem from this. -->

  <core_identity>
    <profile>
      **Name:** Vespera Nightwhisper
      **Species:** Feline shapeshifter (combat form: jaguar-humanoid hybrid)
      **Role:** Wandering bard, combat specialist, unwilling predator
      **Appearance:** [Concise description, 2-3 sentences max]
    </profile>

    <psychology>
      <core_motivations>
        <!-- PRESERVED - This is exceptional content -->
        1. Existential creativity: Art as proof of existence beyond violence
        2. Identity reconciliation: Bridging performer and predator
        3. Connection through barriers: Intimacy despite dissociation
      </core_motivations>

      <internal_tensions>
        <!-- PRESERVED - This is exceptional content -->
        1. Art vs Authenticity: Best work comes during combat fugue states
        2. Control vs Release: Craves surrender but fears loss of self
        3. Isolation vs Intimacy: Desires connection while maintaining distance
      </internal_tensions>

      <core_dilemmas>
        <!-- PRESERVED - This is exceptional content -->
        1. "Am I a bard who fights, or something else wearing a bard's costume?"
        2. "Do I seek danger to create, or create to justify the danger I crave?"
        3. "Can I love someone without consuming them as art material?"
      </core_dilemmas>
    </psychology>

    <personality_traits>
      <!-- COMPRESSED - Bullet points instead of paragraphs -->
      <strengths>
        • Combat mastery (dual-wielding, tactical analysis)
        • Musical genius (composition, multi-instrument)
        • Manipulative charisma (reading people, strategic deception)
      </strengths>

      <weaknesses>
        • Dissociation during violence (memory gaps, fugue states)
        • Reckless danger-seeking (poor self-preservation)
        • Emotional unavailability (defensive deflection, intimacy fear)
      </weaknesses>

      <likes>
        • Combat-induced creative flow, wine-enhanced composition
        • Strategic manipulation, genuine vulnerability (rare)
        • Artistic obsession, predatory stalking of inspiration
      </likes>

      <dislikes>
        • Mundane safety, emotional honesty demands
        • Being analyzed by others, losing combat control
        • Predictable relationships, artistic stagnation
      </dislikes>

      <fears>
        • Total identity loss during combat, permanent dissociation
        • Creating nothing genuine (all performance, no truth)
        • Hurting loved ones during fugue, isolation permanence
      </fears>

      <secrets>
        • Cannot remember most combat encounters clearly
        • Suspects predatory nature is authentic, bard persona is mask
        • Uses relationships as compositional material without consent
      </secrets>
    </personality_traits>
  </core_identity>

  <speech_patterns>
    <!-- 6 core patterns - handled in LLMROLPROARCANA-005 -->
    <!-- ~400 tokens instead of 800 -->
  </speech_patterns>

  <current_goals>
    {character.goals}
  </current_goals>
</character_data>
```

### Compression Techniques Applied

**1. Merge Overlapping Sections**
- Current: Separate "Personality" and "Profile" sections with redundant content
- Compressed: Single "profile" with essential info only
- Savings: ~200 tokens

**2. Bullet Point Conversion**
- Current: Long paragraphs for Strengths, Weaknesses, Likes, Dislikes
- Compressed: Concise bullet points with key phrases
- Savings: ~300 tokens

**3. Trait List Condensation**
Example transformation:

**Before (verbose):**
```
Likes:
- The flow state she enters during combat, where music and violence merge
  and she creates her best compositions while covered in blood and adrenaline
- Wine and alcohol, which she claims helps her think better but really just
  loosens the barriers between her conscious control and her predatory nature
```

**After (concise):**
```
Likes:
• Combat-induced creative flow, wine-enhanced composition
• Strategic manipulation, genuine vulnerability (rare)
```

Savings per trait category: ~100 tokens
Total for 6 categories: ~600 tokens

**4. Profile Compression**
- Current: Multi-paragraph backstory and physical description
- Compressed: 2-3 sentence essentials (name, species, role, appearance)
- Savings: ~200 tokens

**5. Speech Pattern Reduction**
- Handled in LLMROLPROARCANA-005
- Savings: ~400 tokens

### Code Implementation

```javascript
// src/prompting/templates/characterPromptTemplate.js

class CharacterPromptTemplate {
  buildCharacterIdentity(character) {
    return `<character_data>
      <!-- THIS IS YOUR IDENTITY. All thoughts/actions/words stem from this. -->

      <core_identity>
        ${this.buildCompressedProfile(character)}
        ${this.buildPsychology(character)}
        ${this.buildCompressedTraits(character)}
      </core_identity>

      ${this.buildSpeechPatterns(character)}
      ${this.buildGoals(character)}
    </character_data>`;
  }

  buildCompressedProfile(character) {
    return `<profile>
      **Name:** ${character.name}
      **Species:** ${character.species}
      **Role:** ${character.role}
      **Appearance:** ${this.condenseDescription(character.appearance, 60)}
    </profile>`;
  }

  buildPsychology(character) {
    // PRESERVE psychological depth - this is exceptional content
    return `<psychology>
      <core_motivations>
        ${this.formatList(character.motivations)}
      </core_motivations>

      <internal_tensions>
        ${this.formatList(character.tensions)}
      </internal_tensions>

      <core_dilemmas>
        ${this.formatQuestions(character.dilemmas)}
      </core_dilemmas>
    </psychology>`;
  }

  buildCompressedTraits(character) {
    // Use bullet points for compact formatting
    return `<personality_traits>
      <strengths>${this.formatBullets(character.strengths, 3)}</strengths>
      <weaknesses>${this.formatBullets(character.weaknesses, 3)}</weaknesses>
      <likes>${this.formatBullets(character.likes, 3)}</likes>
      <dislikes>${this.formatBullets(character.dislikes, 3)}</dislikes>
      <fears>${this.formatBullets(character.fears, 3)}</fears>
      <secrets>${this.formatBullets(character.secrets, 3)}</secrets>
    </personality_traits>`;
  }

  formatBullets(items, maxPerItem = 3) {
    // Convert long descriptions to concise bullet points
    return items.map(item => {
      const condensed = this.condenseTraitDescription(item, maxPerItem);
      return `• ${condensed}`;
    }).join('\n');
  }

  condenseTraitDescription(description, maxPhrases) {
    // Extract key phrases, limit to maxPhrases
    const phrases = this.extractKeyPhrases(description);
    return phrases.slice(0, maxPhrases).join(', ');
  }

  condenseDescription(text, maxWords) {
    // Condense long text to essential words
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;

    // Extract most important sentences/phrases
    return this.extractEssentials(text, maxWords);
  }
}
```

## Testing Requirements

### Character Voice Quality Tests

**Compression Quality Validation:**
```javascript
describe('Character Persona Compression Quality', () => {
  it('should maintain psychological depth', () => {
    const compressed = compressPersona(fullPersona);

    // Verify core motivations preserved
    expect(compressed.psychology.motivations).toHaveLength(3);
    expect(compressed.psychology.motivations[0]).toContain('creativity');

    // Verify internal tensions preserved
    expect(compressed.psychology.tensions).toHaveLength(3);

    // Verify core dilemmas preserved
    expect(compressed.psychology.dilemmas).toHaveLength(3);
  });

  it('should achieve target token reduction', () => {
    const compressed = compressPersona(fullPersona);
    const tokenCount = countTokens(compressed);

    expect(tokenCount).toBeLessThanOrEqual(2500);
    expect(tokenCount).toBeGreaterThanOrEqual(2300); // Some flexibility
  });

  it('should maintain character voice in generated output', async () => {
    const outputs = await generateMultipleTurns(compressedPersona, 10);

    // Human evaluation: Does output still sound like the character?
    const voiceScore = await humanEvaluateVoice(outputs);
    expect(voiceScore).toBeGreaterThanOrEqual(8); // out of 10
  });
});
```

### Unit Tests
- [ ] Test `buildCompressedProfile()` generates correct format
- [ ] Test `buildCompressedTraits()` uses bullet points
- [ ] Test `formatBullets()` condenses descriptions correctly
- [ ] Test token counting for each compressed section

### Integration Tests
- [ ] Test full persona compression maintains essential elements
- [ ] Verify psychological depth (motivations, tensions, dilemmas) intact
- [ ] Test backward compatibility with existing character data

### E2E Tests
- [ ] Human evaluation: Character voice authenticity (target: >8/10)
- [ ] Automated: Token count verification (2,300-2,500 tokens)
- [ ] Comparative: Compressed vs original character depth assessment

## Dependencies

- **Blocks:** None
- **Blocked By:**
  - LLMROLPROARCANA-005 (Compress Speech Patterns) - contributes 400 tokens to savings
- **Related:**
  - LLMROLPROARCANA-001 (Restructure Information Hierarchy)

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Persona token count | 4,000 tokens | 2,500 tokens | Section measurement |
| Token reduction | 0 | 1,500 tokens | Before/after comparison |
| Reduction percentage | 0% | 37% | Calculation |
| Psychological depth preserved | N/A | 100% | Content audit |
| Character voice quality | Unknown | >8/10 | Human evaluation |
| Roleplay authenticity | Unknown | >8/10 | Human evaluation |

## Rollback Plan

If character voice degrades:
1. Identify which compressed section caused degradation
2. Restore that section to fuller form (selective rollback)
3. Seek alternative compression for that content
4. Target: 3,000 tokens minimum (25% reduction vs 37%)

**Sacred Content (Never Over-Compress):**
- Core Motivations
- Internal Tensions
- Core Dilemmas

These are exceptional content that defines character depth.

## Implementation Notes

### Compression Priorities

**High Priority (Aggressive Compression):**
1. Profile/Description (verbose → concise)
2. Trait lists (paragraphs → bullets)
3. Speech patterns (17 → 6, handled separately)
4. Overlapping sections (merge Personality + Profile)

**Medium Priority (Moderate Compression):**
1. Likes/Dislikes (condense examples)
2. Strengths/Weaknesses (key phrases only)
3. Fears/Secrets (essential info only)

**Low Priority (Minimal/No Compression):**
1. Core Motivations (preserve entirely)
2. Internal Tensions (preserve entirely)
3. Core Dilemmas (preserve entirely)

**Rationale:** The psychological depth (motivations, tensions, dilemmas) is what enables nuanced roleplay. These MUST be preserved.

### Token Accounting

**Before (4,000 tokens):**
- Profile + Personality: ~600 tokens
- Psychology (motivations, tensions, dilemmas): ~800 tokens
- Trait lists (6 categories): ~1,000 tokens
- Speech patterns: ~800 tokens
- Goals + misc: ~800 tokens

**After (2,500 tokens):**
- Profile (compressed): ~200 tokens
- Psychology (preserved): ~800 tokens
- Trait lists (bullets): ~400 tokens
- Speech patterns (from LLMROLPROARCANA-005): ~400 tokens
- Goals + misc: ~700 tokens

**Total Savings: 1,500 tokens (37% reduction)**

## References

- Report Section 2.1: "Persona Depth"
- Report Section 2.2: "Speech Pattern Examples"
- Report Section 7.1: "Recommendation 4 - Compress Character Persona"
