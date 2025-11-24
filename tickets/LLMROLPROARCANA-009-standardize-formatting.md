# LLMROLPROARCANA-009: Standardize Formatting Across Template

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 7.3, Phase 3, Task 1
**Priority:** LOW ⭐⭐
**Estimated Effort:** Low (2-4 hours)
**Impact:** 5% readability improvement, improved maintainability
**Phase:** 3 - Polish & Optimization (Week 3)

## Problem Statement

The current template uses inconsistent formatting patterns that reduce readability and make maintenance difficult:

**Identified Inconsistencies:**
1. Mixed emphasis (CAPS, **bold**, *italic*, combinations)
2. Inconsistent example formatting (sometimes code blocks, sometimes inline)
3. Varied bullet point depth (2-5 levels deep)
4. Mixed markers (CRITICAL, ⚠️, ❌, ✅ used inconsistently)
5. Inconsistent XML tag indentation
6. Mixed use of HTML comments vs XML comments

**Impact:**
- Harder to scan and understand template
- Difficult to locate specific sections during debugging
- Maintenance complexity (which style to use where?)
- Inconsistent visual hierarchy

## Objective

Standardize all formatting across the template to create consistent visual hierarchy, improve scannability, and reduce maintenance complexity.

## Acceptance Criteria

- [ ] Single emphasis system chosen and applied consistently
- [ ] All examples use code blocks (no inline examples)
- [ ] Bullet point depth limited to 3 levels maximum
- [ ] Consistent marker system (✅ for good, ❌ for bad)
- [ ] XML tag indentation standardized (2 spaces per level)
- [ ] HTML comments used consistently for processing hints
- [ ] Style guide documented for future maintenance
- [ ] All tests pass with standardized formatting

## Technical Implementation

### Formatting Standards

**1. Emphasis System**

Choose ONE system and apply consistently:

**Proposed Standard: Markdown Bold + Headers**
```markdown
## SECTION NAME (top-level sections)
### Subsection Name (subsections)

**Rule**: Bold for rules and important concepts
*Example*: Italic for examples only (sparingly)

NO MIXING: Don't use **BOLD CAPS** or ***bold italic***
```

**2. Example Formatting**

**Proposed Standard: Always Use Code Blocks**
```markdown
**Valid Examples:**
```
✅ *crosses arms*
✅ *narrows eyes*
```

**Invalid Examples:**
```
❌ *feels anxious* (internal state)
❌ *thinks about leaving* (mental action)
```
```

**3. Bullet Point Hierarchy**

**Proposed Standard: Maximum 3 Levels**
```markdown
- Level 1: Main point
  - Level 2: Supporting detail
    - Level 3: Specific example
      (NO LEVEL 4 - restructure if needed)
```

**4. Marker System**

**Proposed Standard: Unicode Symbols**
```markdown
✅ Correct / Valid / Good
❌ Incorrect / Invalid / Bad
⚠️ Warning / Caution
📋 Rule / Instruction
💡 Tip / Suggestion
🔍 Example / Demonstration
```

**5. XML Indentation**

**Proposed Standard: 2 Spaces Per Level**
```xml
<parent>
  <child>
    <grandchild>
      Content
    </grandchild>
  </child>
</parent>
```

**6. Comment Style**

**Proposed Standard:**
- HTML comments for LLM processing hints: `<!-- CRITICAL: ... -->`
- XML comments for developer notes: `<!-- Developer: Update this section when... -->`

### Code Implementation

```javascript
// src/prompting/templates/characterPromptTemplate.js

class CharacterPromptTemplate {
  // Formatting utilities

  formatHeader(text, level = 2) {
    const prefix = '#'.repeat(level);
    return `${prefix} ${text.toUpperCase()}`;
  }

  formatRule(rule) {
    return `**Rule**: ${rule}`;
  }

  formatExample(examples, type = 'valid') {
    const marker = type === 'valid' ? '✅' : '❌';
    return examples.map(ex => `${marker} ${ex}`).join('\n');
  }

  formatCodeBlock(content, label = '') {
    return `**${label}:**\n\`\`\`\n${content}\n\`\`\``;
  }

  formatBulletList(items, level = 1) {
    const indent = '  '.repeat(level - 1);
    const marker = level === 1 ? '•' : '-';
    return items.map(item => `${indent}${marker} ${item}`).join('\n');
  }

  // Apply standardized formatting to sections

  buildActionTagRules() {
    return `
${this.formatHeader('ACTION TAGS (CRITICAL)', 2)}

${this.formatRule('Use *asterisks* ONLY for visible physical actions')}
${this.formatRule('Format: Third-person present tense')}

${this.formatCodeBlock(this.formatExample([
  '*crosses arms*',
  '*narrows eyes*',
  '*takes a step back*'
], 'valid'), 'Valid Examples')}

${this.formatCodeBlock(this.formatExample([
  '*feels anxious* (internal state - not visible)',
  '*thinks about leaving* (mental action - not visible)',
  '*decided to stay* (past tense - must be present)'
], 'invalid'), 'Invalid Examples')}
`.trim();
  }
}
```

### Formatting Validation Script

```javascript
// scripts/validateTemplateFormatting.js

class TemplateFormattingValidator {
  constructor() {
    this.issues = [];
  }

  validate(templateContent) {
    this.checkEmphasisConsistency(templateContent);
    this.checkBulletDepth(templateContent);
    this.checkCodeBlockUsage(templateContent);
    this.checkXMLIndentation(templateContent);
    this.checkMarkerConsistency(templateContent);

    return {
      valid: this.issues.length === 0,
      issues: this.issues
    };
  }

  checkEmphasisConsistency(content) {
    // Check for mixed emphasis (e.g., **BOLD CAPS**)
    const mixedEmphasis = content.match(/\*\*[A-Z\s]+\*\*/g);
    if (mixedEmphasis && mixedEmphasis.length > 0) {
      this.issues.push({
        type: 'emphasis',
        message: 'Mixed bold and caps detected',
        instances: mixedEmphasis
      });
    }
  }

  checkBulletDepth(content) {
    // Check for bullets deeper than 3 levels
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const indent = line.match(/^(\s*)([-•])/);
      if (indent) {
        const depth = Math.floor(indent[1].length / 2) + 1;
        if (depth > 3) {
          this.issues.push({
            type: 'bullet_depth',
            message: `Bullet depth exceeds 3 levels (depth: ${depth})`,
            line: index + 1
          });
        }
      }
    });
  }

  checkCodeBlockUsage(content) {
    // Check for inline examples that should be code blocks
    const inlineExamples = content.match(/Examples?:\s*[^`\n]+/gi);
    if (inlineExamples) {
      this.issues.push({
        type: 'code_block',
        message: 'Examples found without code blocks',
        instances: inlineExamples
      });
    }
  }

  checkXMLIndentation(content) {
    // Check for inconsistent XML indentation
    const xmlLines = content.match(/<[^>]+>/g);
    // Implementation of indentation checking logic
  }

  checkMarkerConsistency(content) {
    // Check for mixed marker systems
    const hasUnicode = /[✅❌⚠️]/g.test(content);
    const hasText = /\[(CORRECT|WRONG|INVALID|VALID)\]/gi.test(content);

    if (hasUnicode && hasText) {
      this.issues.push({
        type: 'markers',
        message: 'Mixed marker systems detected (Unicode + Text)'
      });
    }
  }
}

// Usage
const validator = new TemplateFormattingValidator();
const result = validator.validate(templateContent);
if (!result.valid) {
  console.error('Formatting issues found:', result.issues);
  process.exit(1);
}
```

## Testing Requirements

### Formatting Validation Tests

```javascript
describe('Template Formatting Standards', () => {
  let template;

  beforeEach(() => {
    template = assemblePromptTemplate();
  });

  it('should use consistent emphasis system', () => {
    // No mixed **BOLD CAPS**
    expect(template).not.toMatch(/\*\*[A-Z\s]+\*\*/);

    // Headers use ## format
    const headers = template.match(/^##\s+/gm);
    expect(headers).toBeDefined();
  });

  it('should use code blocks for all examples', () => {
    // All examples should be in ``` blocks
    const inlineExamples = template.match(/Examples?:\s*[^`]/gi);
    expect(inlineExamples).toBeNull();
  });

  it('should limit bullet depth to 3 levels', () => {
    const lines = template.split('\n');
    const deepBullets = lines.filter(line => {
      const indent = line.match(/^(\s*)([-•])/);
      if (indent) {
        const depth = Math.floor(indent[1].length / 2) + 1;
        return depth > 3;
      }
      return false;
    });

    expect(deepBullets).toHaveLength(0);
  });

  it('should use consistent marker system', () => {
    // Should use Unicode symbols, not text markers
    expect(template).not.toMatch(/\[(CORRECT|WRONG|INVALID|VALID)\]/i);

    // Should use ✅ and ❌ consistently
    const hasValidMarker = template.includes('✅');
    const hasInvalidMarker = template.includes('❌');

    if (template.includes('Example')) {
      expect(hasValidMarker || hasInvalidMarker).toBe(true);
    }
  });

  it('should use consistent XML indentation', () => {
    const xmlLines = template.split('\n').filter(line => /<[^>]+>/.test(line));

    xmlLines.forEach(line => {
      const indent = line.match(/^(\s*)</);
      if (indent) {
        // Indentation should be multiple of 2
        expect(indent[1].length % 2).toBe(0);
      }
    });
  });
});
```

### Unit Tests
- [ ] Test formatting utility methods
- [ ] Test header generation
- [ ] Test example formatting
- [ ] Test bullet list formatting

### Integration Tests
- [ ] Test full template follows all formatting standards
- [ ] Verify formatting doesn't break template parsing
- [ ] Test formatting validation script

## Dependencies

- **Blocks:** None
- **Blocked By:** None (can be done in parallel with other tickets)
- **Related:**
  - LLMROLPROARCANA-010 (Add Metadata Section) - formatting standards apply

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Formatting violations | Unknown | 0 | Validation script |
| Readability score | Unknown | >8/10 | Human evaluation |
| Maintenance time | Unknown | -20% | Developer feedback |
| Bullet depth | 5 levels | 3 levels max | Code analysis |
| Example code blocks | Partial | 100% | Pattern matching |

## Rollback Plan

Formatting changes are low-risk and easily reversible. If issues arise:
1. Revert specific formatting change causing issues
2. Document why deviation from standard is necessary
3. Update style guide with exception

## Implementation Notes

### Style Guide Documentation

Create `docs/prompting/template-style-guide.md`:

```markdown
# Prompt Template Style Guide

## Emphasis
- Headers: `## SECTION NAME` (caps, ## for main sections)
- Rules: `**Rule**: Description` (bold for rules)
- Examples: Use ✅ and ❌ markers
- NO mixed emphasis: **BOLD CAPS** ❌

## Examples
- ALWAYS use code blocks for examples
- Format: **Valid Examples:** followed by ```
- Use ✅ for good, ❌ for bad

## Bullet Points
- Maximum 3 levels deep
- Level 1: Main point
  - Level 2: Supporting detail
    - Level 3: Specific example

## XML
- Indentation: 2 spaces per level
- Always close tags on new line for multi-line content
- Single-line tags acceptable for short content

## Comments
- HTML comments for LLM: `<!-- CRITICAL: ... -->`
- XML comments for developers: `<!-- Developer: ... -->`

## Markers
- ✅ Valid / Correct / Good
- ❌ Invalid / Incorrect / Bad
- ⚠️ Warning / Caution
- 📋 Rule / Instruction
```

### Automated Formatting

Add to build pipeline:
```bash
npm run format:template  # Auto-format template
npm run lint:template    # Validate formatting
```

## References

- Report Section 7.3: "Recommendation 8 - Standardize Formatting"
- Report Section 5.2: "Information Density - Readability Issues"
