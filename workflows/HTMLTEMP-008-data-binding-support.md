# HTMLTEMP-008: Add Data Binding Support

## Summary

Implement a comprehensive data binding system for templates as a NEW feature that enables safe string interpolation, conditional rendering, list iteration, and event handler attachment while preventing XSS vulnerabilities and maintaining high performance. This will extend the existing basic `TemplateComposer` system with advanced data binding capabilities.

## Status

- **Type**: New Feature Implementation (not an enhancement - these capabilities don't exist yet)
- **Priority**: High  
- **Complexity**: High
- **Estimated Time**: 8-10 hours (increased from 6 due to building from scratch)
- **Dependencies**: 
  - HTMLTEMP-007 (Template Composition Engine) - ✅ COMPLETED (basic composition only)
  - Existing infrastructure to leverage:
    - `src/characterBuilder/templates/utilities/templateComposer.js` - Basic template composition
    - `src/events/eventBus.js` - Application event system (not template-specific)
    - `src/utils/domUtils.js` - Basic HTML escaping utilities
    - `src/characterBuilder/templates/utilities/compositionCache.js` - Simple caching

## Current State Assessment

### What Currently Exists

1. **TemplateComposer** (`src/characterBuilder/templates/utilities/templateComposer.js`)
   - Basic `${variable}` interpolation
   - Slot-based content injection
   - Nested template references
   - Simple caching mechanism
   - Recursion depth protection

2. **Basic Utilities**
   - `DomUtils.escapeHtml()` - Simple HTML escaping
   - `EventBus` - Application-level event dispatching (not for DOM events)
   - `CompositionCache` - Template composition caching

### What Doesn't Exist (Must Be Created)

1. **Data Binding Infrastructure**
   - ❌ DataBindingEngine
   - ❌ HTMLSanitizer (comprehensive XSS prevention)
   - ❌ ExpressionEvaluator
   - ❌ InterpolationProcessor (advanced beyond basic ${})
   - ❌ ConditionalProcessor (tb-if, tb-else directives)
   - ❌ ListProcessor (tb-for directive)
   - ❌ EventBindingProcessor (tb-on directives)

2. **Template Rendering Layer**
   - ❌ TemplateRenderer (noted as future work in utilities/index.js)
   - ❌ DOM event binding system for templates
   - ❌ Reactive data binding capabilities

## Revised Technical Specification

### Architecture Overview

The data binding system will be implemented as a new module that processes templates AFTER the TemplateComposer:

```
Template Definition
    ↓
TemplateComposer (existing)
    ↓ (produces HTML with basic ${} interpolation)
DataBindingEngine (new)
    ↓ (processes directives, adds event bindings)
Final Rendered HTML
```

### File Structure (All New Files)

```
src/characterBuilder/templates/
├── utilities/
│   ├── dataBinding/                    # NEW DIRECTORY
│   │   ├── DataBindingEngine.js       # Main binding orchestrator
│   │   ├── HTMLSanitizer.js           # XSS prevention
│   │   ├── ExpressionEvaluator.js     # Safe expression evaluation
│   │   ├── processors/                 # NEW SUBDIRECTORY
│   │   │   ├── InterpolationProcessor.js
│   │   │   ├── ConditionalProcessor.js
│   │   │   ├── ListProcessor.js
│   │   │   └── EventBindingProcessor.js
│   │   └── index.js                   # Module exports
│   └── templateComposer.js            # EXISTING - will be integrated with
```

### Integration Strategy

Since TemplateRenderer doesn't exist, we'll integrate directly with TemplateComposer:

```javascript
// Modified TemplateComposer usage pattern
import { TemplateComposer } from './templateComposer.js';
import { DataBindingEngine } from './dataBinding/DataBindingEngine.js';

class EnhancedTemplateComposer {
  constructor() {
    this.composer = new TemplateComposer();
    this.bindingEngine = new DataBindingEngine({
      sanitizer: new HTMLSanitizer(),
      evaluator: new ExpressionEvaluator(),
      // Note: We'll create our own event management, not use the app EventBus
      eventManager: new TemplateEventManager()
    });
  }

  render(template, context, options = {}) {
    // Step 1: Compose template (handles slots, nesting, basic ${})
    const composedHtml = this.composer.compose(template, context);
    
    // Step 2: Apply data binding (directives, events, advanced features)
    const { html, cleanup } = this.bindingEngine.bind(composedHtml, context, options);
    
    return { html, cleanup };
  }
}
```

### Implementation Priorities

Given that we're building from scratch, prioritize:

1. **Phase 1: Core Infrastructure** (2 hours)
   - Create DataBindingEngine skeleton
   - Implement HTMLSanitizer (extending DomUtils.escapeHtml)
   - Build ExpressionEvaluator with sandboxing

2. **Phase 2: Basic Directives** (2 hours)
   - Enhanced interpolation (building on existing ${})
   - Simple conditionals (tb-if, tb-show)

3. **Phase 3: Advanced Features** (2 hours)
   - List rendering (tb-for)
   - Complex conditionals (tb-else, tb-else-if)

4. **Phase 4: Event System** (2 hours)
   - Create TemplateEventManager (separate from app EventBus)
   - Implement tb-on directives
   - Event cleanup system

5. **Phase 5: Integration & Testing** (2 hours)
   - Integrate with existing TemplateComposer
   - Comprehensive testing
   - Documentation

### Key Differences from Original Workflow

1. **No existing data binding** - Everything must be built from scratch
2. **No TemplateRenderer** - Will integrate directly with TemplateComposer
3. **EventBus is app-level** - Need separate template event system
4. **Basic escaping only** - Must build comprehensive sanitization
5. **Time estimate increased** - More work than originally anticipated

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| No existing infrastructure | High | Build incrementally, test each component |
| Integration complexity | Medium | Create adapter layer for TemplateComposer |
| Performance with new features | Medium | Implement aggressive caching |
| Security vulnerabilities | Critical | Comprehensive testing, code review |

### Success Criteria (Updated)

- [ ] DataBindingEngine created and integrated with TemplateComposer
- [ ] All directive types (tb-if, tb-for, tb-on, etc.) implemented
- [ ] Comprehensive XSS prevention beyond basic escaping
- [ ] Event binding and cleanup working correctly
- [ ] Performance < 20ms for complex templates
- [ ] Full test coverage for new components
- [ ] Documentation for new API surface

### Notes for Implementation

- The existing `TemplateComposer` should NOT be modified significantly
- Create new components in isolation, then integrate
- Consider making the data binding layer optional/pluggable
- Ensure backward compatibility with existing template usage
- The app's EventBus should not be used for template DOM events

## Definition of Done (Revised)

- [ ] All new components created in `src/characterBuilder/templates/utilities/dataBinding/`
- [ ] Integration layer connecting TemplateComposer to DataBindingEngine
- [ ] Unit tests for each new component with >90% coverage
- [ ] Integration tests showing full data binding pipeline
- [ ] Security audit completed with no XSS vulnerabilities
- [ ] Performance benchmarks met (<20ms for complex binding)
- [ ] Documentation written for new features
- [ ] Existing template functionality remains unchanged
- [ ] Code reviewed and approved