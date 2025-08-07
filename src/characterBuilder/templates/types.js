/**
 * @file Template system type definitions
 * @module characterBuilder/templates/types
 */

/**
 * @typedef {object} PageConfig
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
 * @typedef {object} PanelConfig
 * @property {string} [id] - Panel DOM ID
 * @property {string} [heading] - Panel heading text
 * @property {string|Function} content - Panel content (HTML string or template function)
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [showWhenEmpty=false] - Show panel even when content is empty
 * @property {string} [emptyMessage='No content available'] - Message for empty state
 * @property {Array<Action>} [actions] - Panel action buttons
 * @property {object} [state] - Panel state indicators
 */

/**
 * @typedef {object} ModalConfig
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
 * @typedef {object} Action
 * @property {string} label - Button label text (required)
 * @property {string} name - Action identifier (required)
 * @property {string} [type='button'] - Button type: 'button' | 'submit' | 'reset'
 * @property {string} [className] - Additional CSS classes
 * @property {boolean} [disabled=false] - Disabled state
 * @property {object} [data] - Data attributes (data-* attributes)
 * @property {string} [icon] - Icon class or HTML
 * @property {string} [tooltip] - Tooltip text
 */

/**
 * @typedef {object} FooterConfig
 * @property {string} [status] - Status text
 * @property {Array<Link>} [links] - Footer links
 * @property {boolean} [showVersion=true] - Show version information
 * @property {string} [customContent] - Custom HTML content
 */

/**
 * @typedef {object} Link
 * @property {string} label - Link text (required)
 * @property {string} href - Link URL (required)
 * @property {string} [target='_self'] - Link target
 * @property {string} [className] - Additional CSS classes
 */

/**
 * @typedef {object} FormFieldConfig
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
 * @property {object} [validation] - Validation rules
 */

/**
 * @typedef {object} Option
 * @property {string} value - Option value (required)
 * @property {string} label - Option label (required)
 * @property {boolean} [selected=false] - Selected state
 * @property {boolean} [disabled=false] - Disabled state
 */

/**
 * @typedef {object} TemplateOptions
 * @property {boolean} [sanitize=true] - Sanitize HTML output
 * @property {boolean} [cache=true] - Cache rendered templates
 * @property {boolean} [debug=false] - Enable debug mode
 * @property {object} [data] - Data for template rendering
 * @property {object} [events] - Event handlers to attach
 */

/**
 * @typedef {object} RenderResult
 * @property {string} html - Rendered HTML string
 * @property {number} renderTime - Render time in milliseconds
 * @property {boolean} cached - Whether result was from cache
 * @property {Array<string>} warnings - Any warnings during render
 */

// Export types for IDE support
export const Types = {};
