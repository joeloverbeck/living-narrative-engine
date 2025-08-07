# HTMLTEMP-001: Create Template Directory Structure and Base Setup

## Status
**Status**: Not Started  
**Priority**: Critical  
**Estimated**: 2 hours  
**Complexity**: Low  
**Dependencies**: None  

## Objective

Establish the foundational directory structure for the HTML Template System and create the base setup including index exports and JSDoc type definitions. This ticket creates the physical infrastructure needed for all subsequent template development.

## Background

The current character builder system has no template infrastructure. Each page uses static HTML files in `data/html/` with direct DOM manipulation. This ticket establishes the new template system's home in the codebase.

## Technical Requirements

### 1. Directory Structure Creation

Create the following directory structure under `src/characterBuilder/`:

```
src/characterBuilder/templates/
├── core/                  # Core page structure templates
├── components/            # Reusable component templates
├── utilities/             # Template utilities and services
├── index.js              # Main export file
└── types.js              # JSDoc type definitions
```

### 2. Core Directory Setup

#### File: `src/characterBuilder/templates/core/index.js`
```javascript
/**
 * @file Core template exports
 * @module characterBuilder/templates/core
 */

// Will be populated in subsequent tickets
export { createCharacterBuilderPage } from './pageTemplate.js';
export { createHeader } from './headerTemplate.js';
export { createMain } from './mainTemplate.js';
export { createFooter } from './footerTemplate.js';
export { createModal } from './modalTemplate.js';
```

### 3. Components Directory Setup

#### File: `src/characterBuilder/templates/components/index.js`
```javascript
/**
 * @file Component template exports
 * @module characterBuilder/templates/components
 */

// Will be populated in subsequent tickets
export { createPanel } from './panelTemplate.js';
export { createFormGroup } from './formGroupTemplate.js';
export { createButtonGroup } from './buttonGroupTemplate.js';
export { createDisplayCard } from './displayCardTemplate.js';
export { createStatistics } from './statisticsTemplate.js';
```

### 4. Utilities Directory Setup

#### File: `src/characterBuilder/templates/utilities/index.js`
```javascript
/**
 * @file Template utility exports
 * @module characterBuilder/templates/utilities
 */

// Will be populated in subsequent tickets
export { TemplateRenderer } from './templateRenderer.js';
export { TemplateInjector } from './templateInjector.js';
export { TemplateValidator } from './templateValidator.js';
export { TemplateCache } from './templateCache.js';
```

### 5. Main Index File

#### File: `src/characterBuilder/templates/index.js`
```javascript
/**
 * @file HTML Template System main exports
 * @module characterBuilder/templates
 * 
 * This module provides a comprehensive template system for character builder pages,
 * eliminating HTML duplication and enabling rapid development of new pages.
 */

// Core templates
export * from './core/index.js';

// Component templates
export * from './components/index.js';

// Utilities
export * from './utilities/index.js';

// Type definitions are available via JSDoc in types.js
```

### 6. Type Definitions File

#### File: `src/characterBuilder/templates/types.js`
```javascript
/**
 * @file Template system type definitions
 * @module characterBuilder/templates/types
 */

/**
 * @typedef {Object} PageConfig
 * @property {string} title - Page title (required)
 * @property {string} [subtitle] - Page subtitle
 * @property {Array<Action>} [headerActions] - Header action buttons
 * @property {PanelConfig} leftPanel - Left panel configuration (required for dual-panel)
 * @property {PanelConfig} [rightPanel] - Right panel configuration
 * @property {Array<ModalConfig>} [modals] - Modal configurations
 * @property {FooterConfig} [footer] - Footer configuration
 * @property {string} [customClasses] - Additional CSS classes for the page container
 * @property {boolean} [singlePanel=false] - Use single panel layout instead of dual
 */

/**
 * @typedef {Object} PanelConfig
 * @property {string} [id] - Panel DOM ID
 * @property {string} [heading] - Panel heading text
 * @property {string|Function} content - Panel content (HTML string or template function)
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [showWhenEmpty=false] - Show panel even when content is empty
 * @property {string} [emptyMessage='No content available'] - Message for empty state
 * @property {Array<Action>} [actions] - Panel action buttons
 * @property {Object} [state] - Panel state indicators
 */

/**
 * @typedef {Object} ModalConfig
 * @property {string} id - Modal DOM ID (required)
 * @property {string} title - Modal title (required)
 * @property {string|Function} content - Modal content (HTML string or template function)
 * @property {Array<Action>} [actions] - Modal action buttons
 * @property {boolean} [closeOnEscape=true] - Close modal on ESC key
 * @property {boolean} [closeOnBackdrop=true] - Close modal on backdrop click
 * @property {string} [size='medium'] - Modal size: 'small' | 'medium' | 'large'
 * @property {boolean} [centered=true] - Center modal vertically
 */

/**
 * @typedef {Object} Action
 * @property {string} label - Button label text (required)
 * @property {string} name - Action identifier (required)
 * @property {string} [type='button'] - Button type: 'button' | 'submit' | 'reset'
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [disabled=false] - Disabled state
 * @property {Object} [data] - Data attributes (data-* attributes)
 * @property {string} [icon] - Icon class or HTML
 * @property {string} [tooltip] - Tooltip text
 */

/**
 * @typedef {Object} FooterConfig
 * @property {string} [status] - Status text
 * @property {Array<Link>} [links] - Footer links
 * @property {boolean} [showVersion=true] - Show version information
 * @property {string} [customContent] - Custom HTML content
 */

/**
 * @typedef {Object} Link
 * @property {string} label - Link text (required)
 * @property {string} href - Link URL (required)
 * @property {string} [target='_self'] - Link target
 * @property {string} [className] - Additional CSS classes
 */

/**
 * @typedef {Object} FormFieldConfig
 * @property {string} type - Input type (required)
 * @property {string} id - Field ID (required)
 * @property {string} label - Field label (required)
 * @property {string} [name] - Field name attribute
 * @property {string} [value] - Field value
 * @property {string} [placeholder] - Placeholder text
 * @property {boolean} [required=false] - Required field
 * @property {boolean} [disabled=false] - Disabled state
 * @property {string} [help] - Help text
 * @property {Array<Option>} [options] - Options for select/radio/checkbox
 * @property {Object} [validation] - Validation rules
 */

/**
 * @typedef {Object} Option
 * @property {string} value - Option value (required)
 * @property {string} label - Option label (required)
 * @property {boolean} [selected=false] - Selected state
 * @property {boolean} [disabled=false] - Disabled state
 */

/**
 * @typedef {Object} TemplateOptions
 * @property {boolean} [sanitize=true] - Sanitize HTML output
 * @property {boolean} [cache=true] - Cache rendered templates
 * @property {boolean} [debug=false] - Enable debug mode
 * @property {Object} [data] - Data for template rendering
 * @property {Object} [events] - Event handlers to attach
 */

/**
 * @typedef {Object} RenderResult
 * @property {string} html - Rendered HTML string
 * @property {number} renderTime - Render time in milliseconds
 * @property {boolean} cached - Whether result was from cache
 * @property {Array<string>} warnings - Any warnings during render
 */

// Export types for IDE support
export const Types = {};
```

## Implementation Steps

### Step 1: Create Directory Structure
```bash
# From project root
mkdir -p src/characterBuilder/templates/core
mkdir -p src/characterBuilder/templates/components
mkdir -p src/characterBuilder/templates/utilities
```

### Step 2: Create Index Files
1. Create `src/characterBuilder/templates/index.js` with main exports
2. Create `src/characterBuilder/templates/core/index.js` with core exports
3. Create `src/characterBuilder/templates/components/index.js` with component exports
4. Create `src/characterBuilder/templates/utilities/index.js` with utility exports

### Step 3: Create Type Definitions
1. Create `src/characterBuilder/templates/types.js` with all JSDoc typedefs
2. Ensure all type definitions are comprehensive and well-documented

### Step 4: Add README

#### File: `src/characterBuilder/templates/README.md`
```markdown
# HTML Template System

## Overview
This directory contains the HTML Template System for character builder pages.

## Structure
- `core/` - Core page structure templates (page, header, main, footer, modal)
- `components/` - Reusable UI component templates
- `utilities/` - Template rendering and management utilities
- `types.js` - JSDoc type definitions
- `index.js` - Main export file

## Usage
```javascript
import { createCharacterBuilderPage, TemplateRenderer } from './templates/index.js';

const pageHtml = createCharacterBuilderPage({
  title: 'My Page',
  leftPanel: { content: 'Content here' }
});

TemplateRenderer.renderToDOM(pageHtml, document.getElementById('app'));
```

## Development
All templates follow these principles:
- Pure functions returning HTML strings or DOM elements
- No external dependencies beyond standard JavaScript
- Framework-agnostic implementation
- Full accessibility support (WCAG 2.1 AA)
```

### Step 5: Update .gitignore (if needed)
Ensure the new directories are not ignored and will be tracked by git.

## Testing Requirements

### Unit Tests

#### File: `tests/unit/characterBuilder/templates/structure.test.js`
```javascript
import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Template System Directory Structure', () => {
  const templatesPath = 'src/characterBuilder/templates';

  it('should have the correct directory structure', () => {
    expect(fs.existsSync(templatesPath)).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'core'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'components'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'utilities'))).toBe(true);
  });

  it('should have required index files', () => {
    expect(fs.existsSync(path.join(templatesPath, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'types.js'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'core/index.js'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'components/index.js'))).toBe(true);
    expect(fs.existsSync(path.join(templatesPath, 'utilities/index.js'))).toBe(true);
  });

  it('should export expected modules from main index', () => {
    const mainIndex = require(path.join(process.cwd(), templatesPath, 'index.js'));
    expect(mainIndex).toBeDefined();
    // Note: Specific exports will be tested as they're implemented
  });
});
```

### Validation Tests

```javascript
describe('Type Definitions', () => {
  it('should have valid JSDoc type definitions', () => {
    const typesPath = 'src/characterBuilder/templates/types.js';
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    
    // Check for required type definitions
    expect(typesContent).toContain('@typedef {Object} PageConfig');
    expect(typesContent).toContain('@typedef {Object} PanelConfig');
    expect(typesContent).toContain('@typedef {Object} ModalConfig');
    expect(typesContent).toContain('@typedef {Object} Action');
  });
});
```

## Acceptance Criteria

- [ ] Directory structure created at `src/characterBuilder/templates/`
- [ ] All subdirectories (core, components, utilities) created
- [ ] Main index.js file exports all modules correctly
- [ ] Type definitions file contains all required JSDoc typedefs
- [ ] Each subdirectory has its own index.js for exports
- [ ] README.md created with usage instructions
- [ ] All files have proper JSDoc headers
- [ ] Directory structure test passes
- [ ] Type definitions are comprehensive and accurate
- [ ] No ESLint errors or warnings

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Wrong directory location | Medium | Low | Follow existing patterns in codebase |
| Missing type definitions | Medium | Low | Comprehensive JSDoc coverage |
| Export conflicts | Low | Low | Namespace properly |

## Notes

- This is a non-breaking change as it only adds new directories
- Ensure all team members are aware of the new structure
- Consider adding this to developer onboarding documentation
- The structure is designed to be extensible for future template types

## Related Tickets

- **Next**: HTMLTEMP-002 (Page Template Container)
- **Blocks**: All subsequent template implementation tickets
- **Related**: HTMLTEMP-000 (Overview)