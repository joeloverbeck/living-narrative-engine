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
import {
  createCharacterBuilderPage,
  TemplateRenderer,
} from './templates/index.js';

const pageHtml = createCharacterBuilderPage({
  title: 'My Page',
  leftPanel: { content: 'Content here' },
});

TemplateRenderer.renderToDOM(pageHtml, document.getElementById('app'));
```

## Development

All templates follow these principles:

- Pure functions returning HTML strings or DOM elements
- No external dependencies beyond standard JavaScript
- Framework-agnostic implementation
- Full accessibility support (WCAG 2.1 AA)
