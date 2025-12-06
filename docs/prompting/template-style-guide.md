# Prompt Template Style Guide

This document describes the formatting standards used in the Living Narrative Engine's prompt template system. These standards are enforced through utility classes and tested comprehensively.

## Overview

The prompt system uses three main components:

- `XmlElementBuilder` - XML formatting utilities (stateless)
- `PromptDataFormatter` - Data formatting with processing hints
- `characterPromptTemplate.js` - String template with `{placeholder}` substitution

## Emphasis System

### Section Headers

Use markdown headers for top-level sections:

```markdown
## SECTION NAME
```

### Rules and Key Concepts

Use bold for rules and important concepts:

```markdown
**Rule**: Description of the rule
**Important**: Critical information
```

### Implementation

- Defined in: `data/prompts/corePromptText.json`
- Processed by: `PromptTemplateService.processTemplate()`

## Example Formatting

### Valid/Invalid Examples

Always use code blocks with consistent markers:

```markdown
**Valid Examples:**
✅ _crosses arms_
✅ _narrows eyes_

**Invalid Examples:**
❌ _feels anxious_ (internal state)
❌ _thinks deeply_ (cognitive process)
```

### Marker System

| Marker | Usage                            |
| ------ | -------------------------------- |
| ✅     | Valid examples, correct patterns |
| ❌     | Invalid examples, anti-patterns  |

### Implementation

- Defined in: `data/prompts/corePromptText.json`

## Bullet Point Guidelines

### Maximum Depth

Limit bullet point nesting to **3 levels maximum**:

```markdown
- Level 1
  - Level 2
    - Level 3 (maximum)
```

### Rationale

- Prevents cognitive overload
- Improves readability
- Matches LLM processing patterns

## XML Indentation

### Standard: 2 Spaces Per Level

All XML elements use 2-space indentation:

```xml
<root>
  <child>
    <grandchild>content</grandchild>
  </child>
</root>
```

### Implementation

```javascript
// src/prompting/xmlElementBuilder.js:18
static #INDENT_SPACES = 2;
```

### Usage

```javascript
const builder = new XmlElementBuilder();
builder.wrap('tag', 'content', 1); // 2 spaces indent
builder.wrap('tag', 'content', 2); // 4 spaces indent
```

## Comment Styles

### Simple Comments

Single-line XML comments:

```javascript
builder.comment('text');
// Output: <!-- text -->
```

### Decorated Comments

Four visual styles for multi-line decorated comments:

| Style       | Character | Purpose                               |
| ----------- | --------- | ------------------------------------- |
| `primary`   | `=`       | Identity emphasis, major sections     |
| `secondary` | `-`       | Section headers, sub-sections         |
| `critical`  | `*`       | Mandatory constraints, critical rules |
| `reference` | `.`       | Context/reference material            |

### Implementation

```javascript
// src/prompting/xmlElementBuilder.js:103-124
const borderChars = {
  primary: '=',
  secondary: '-',
  critical: '*',
  reference: '.',
};
```

### Usage

```javascript
builder.decoratedComment(['Line 1', 'Line 2'], 'primary');
builder.decoratedComment(['Critical Rule'], 'critical');
```

## Processing Hints

### Purpose

Guide LLM attention to specific content types during prompt processing.

### Available Hint Types

| Type        | Marker         | Usage                                 |
| ----------- | -------------- | ------------------------------------- |
| `critical`  | `*** CRITICAL` | Mandatory rules that must be followed |
| `reference` | `REFERENCE`    | Context information for understanding |
| `system`    | `SYSTEM`       | System configuration and metadata     |

### Implementation

```javascript
// src/prompting/promptDataFormatter.js:476-488
const hintMarkers = {
  critical: '*** CRITICAL',
  reference: 'REFERENCE',
  system: 'SYSTEM',
};
```

### Usage

```javascript
formatter.wrapWithProcessingHint(content, 'critical');
formatter.wrapWithProcessingHint(context, 'reference');
```

## XML Character Escaping

### Escaped Characters

| Character | Escaped Form |
| --------- | ------------ |
| `&`       | `&amp;`      |
| `<`       | `&lt;`       |
| `>`       | `&gt;`       |
| `"`       | `&quot;`     |
| `'`       | `&apos;`     |

### Usage

```javascript
builder.escape('text with <special> & "chars"');
// Output: text with &lt;special&gt; &amp; &quot;chars&quot;
```

## Conditional Wrapping

### Pattern

Use `wrapIfPresent()` to only wrap non-empty content:

```javascript
builder.wrapIfPresent('tag', content);
// Returns empty string if content is null, undefined, or whitespace-only
// Returns wrapped content otherwise
```

### Rationale

- Prevents empty XML elements in output
- Keeps prompts clean and focused

## Test Coverage

All formatting utilities are comprehensively tested:

### Unit Tests

- `tests/unit/prompting/xmlElementBuilder.test.js` - 85+ test cases
  - `escape()` - XML character escaping
  - `wrap()` - Tag wrapping with indentation
  - `wrapIfPresent()` - Conditional wrapping
  - `comment()` - Simple comments
  - `decoratedComment()` - Multi-line decorated comments (all 4 styles)

- `tests/unit/prompting/characterPromptTemplate.structure.test.js`
  - Section ordering validation
  - Constraint-first architecture verification

- `tests/unit/prompting/promptDataFormatter.test.js`
  - Processing hint application
  - Conditional section formatting
  - Data structure formatting

### Running Tests

```bash
npm run test:unit -- tests/unit/prompting/
npm run test:integration -- tests/integration/prompting/
```

## References

- `src/prompting/xmlElementBuilder.js` - XML formatting utilities
- `src/prompting/promptDataFormatter.js` - Data formatting and processing hints
- `src/prompting/templates/characterPromptTemplate.js` - Main template
- `data/prompts/corePromptText.json` - Static prompt content
