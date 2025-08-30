# CLIPORMOD-005: Configure Dependency Injection for Portrait Modal

## Status
🔴 NOT STARTED

## Priority
HIGH - Required for integration

## Dependencies
- CLIPORMOD-001 (PortraitModalRenderer class must exist)

## Description
Register the `PortraitModalRenderer` with the dependency injection container and update the `SpeechBubbleRenderer` registration to include the new dependency. This ensures proper instantiation and lifecycle management of the portrait modal system.

## Files to Modify

### 1. Token Definition
**File**: `src/dependencyInjection/tokens.js` (or similar token file)

Add new token:
```javascript
export const tokens = {
  // ... existing tokens ...
  IPortraitModalRenderer: 'IPortraitModalRenderer', // NEW TOKEN
  // ... rest of tokens ...
};
```

### 2. Registration Configuration
**File**: Likely in `src/dependencyInjection/registrations/` directory

Find the file that registers UI components (might be `uiRegistrations.js` or similar).

## Implementation Steps

### Step 1: Import PortraitModalRenderer
```javascript
import PortraitModalRenderer from '../../domUI/portraitModalRenderer.js';
```

### Step 2: Register PortraitModalRenderer
```javascript
// Add this registration BEFORE SpeechBubbleRenderer registration
container.register(
  tokens.IPortraitModalRenderer,
  PortraitModalRenderer,
  {
    singleton: true, // Single instance for entire application
    dependencies: [
      tokens.IDocumentContext,
      tokens.IDomElementFactory,
      tokens.ILogger,
      tokens.IValidatedEventDispatcher
    ]
  }
);
```

### Step 3: Update SpeechBubbleRenderer Registration
Find the existing `SpeechBubbleRenderer` registration and add the new dependency:

```javascript
container.register(
  tokens.ISpeechBubbleRenderer,
  SpeechBubbleRenderer,
  {
    singleton: true,
    dependencies: [
      // ... existing dependencies ...
      tokens.IPortraitModalRenderer, // ADD THIS
      // ... rest of dependencies ...
    ]
  }
);
```

### Step 4: Verify Dependency Order
Ensure dependencies are registered in the correct order:
1. Logger (usually first)
2. DocumentContext
3. DomElementFactory
4. ValidatedEventDispatcher
5. PortraitModalRenderer (NEW)
6. SpeechBubbleRenderer (updated)

## Container Configuration Details

### Singleton vs Transient
- `PortraitModalRenderer`: **Singleton** - One instance manages all portrait modals
- Reasoning: Modal state should be centralized, only one modal visible at a time

### Lazy Loading Consideration
If the container supports lazy loading:
```javascript
container.register(
  tokens.IPortraitModalRenderer,
  PortraitModalRenderer,
  {
    singleton: true,
    lazy: true, // Only instantiate when first requested
    dependencies: [/* ... */]
  }
);
```

### Factory Pattern Alternative
If complex initialization is needed:
```javascript
container.register(
  tokens.IPortraitModalRenderer,
  {
    factory: (dependencies) => {
      const { documentContext, domElementFactory, logger, validatedEventDispatcher } = dependencies;
      
      // Any pre-initialization logic
      const renderer = new PortraitModalRenderer({
        documentContext,
        domElementFactory,
        logger,
        validatedEventDispatcher
      });
      
      // Any post-initialization setup
      return renderer;
    },
    singleton: true,
    dependencies: [/* ... */]
  }
);
```

## Validation Requirements

### Circular Dependency Check
Ensure no circular dependencies:
- PortraitModalRenderer should NOT depend on SpeechBubbleRenderer
- SpeechBubbleRenderer depends on PortraitModalRenderer (one-way)

### Token Uniqueness
Verify the token name is unique:
```javascript
// Check for conflicts
if (tokens.IPortraitModalRenderer) {
  throw new Error('Token IPortraitModalRenderer already exists');
}
```

### Dependency Resolution Test
```javascript
// Test that container can resolve the dependency
const portraitModal = container.resolve(tokens.IPortraitModalRenderer);
if (!portraitModal) {
  throw new Error('Failed to resolve IPortraitModalRenderer');
}
```

## Error Handling

### Registration Errors
```javascript
try {
  container.register(tokens.IPortraitModalRenderer, PortraitModalRenderer, config);
} catch (error) {
  console.error('Failed to register PortraitModalRenderer:', error);
  // Graceful degradation - app continues without portrait modal feature
}
```

### Resolution Errors
In SpeechBubbleRenderer constructor:
```javascript
constructor({ portraitModalRenderer, ...otherDeps }) {
  // Graceful handling if dependency is missing
  if (!portraitModalRenderer) {
    this.#logger.warn('PortraitModalRenderer not available - portraits will not be clickable');
    this.#portraitModalRenderer = null;
  } else {
    validateDependency(portraitModalRenderer, 'IPortraitModalRenderer', logger, {
      requiredMethods: ['showModal', 'hideModal']
    });
    this.#portraitModalRenderer = portraitModalRenderer;
  }
}
```

## Testing the Registration

### Unit Test
```javascript
describe('Portrait Modal Dependency Injection', () => {
  it('should register IPortraitModalRenderer token', () => {
    expect(tokens.IPortraitModalRenderer).toBeDefined();
    expect(tokens.IPortraitModalRenderer).toBe('IPortraitModalRenderer');
  });
  
  it('should resolve PortraitModalRenderer from container', () => {
    const instance = container.resolve(tokens.IPortraitModalRenderer);
    expect(instance).toBeInstanceOf(PortraitModalRenderer);
  });
  
  it('should inject PortraitModalRenderer into SpeechBubbleRenderer', () => {
    const speechBubble = container.resolve(tokens.ISpeechBubbleRenderer);
    // Verify it has the portrait modal renderer
    expect(speechBubble).toBeDefined();
    // Note: May need to expose a method to test this
  });
  
  it('should maintain singleton instance', () => {
    const instance1 = container.resolve(tokens.IPortraitModalRenderer);
    const instance2 = container.resolve(tokens.IPortraitModalRenderer);
    expect(instance1).toBe(instance2);
  });
});
```

### Integration Test
```javascript
describe('Portrait Modal Integration with DI Container', () => {
  it('should properly wire all dependencies', () => {
    // Resolve the entire dependency graph
    const speechBubble = container.resolve(tokens.ISpeechBubbleRenderer);
    
    // Verify the chain works
    expect(speechBubble).toBeDefined();
    // Render a speech bubble and verify portrait modal can be opened
  });
});
```

## Rollback Instructions
If issues occur:
1. Remove `IPortraitModalRenderer` token
2. Remove PortraitModalRenderer registration
3. Revert SpeechBubbleRenderer registration to original dependencies
4. Remove portraitModalRenderer parameter from SpeechBubbleRenderer constructor

## Success Criteria
- [ ] Token `IPortraitModalRenderer` is defined
- [ ] PortraitModalRenderer is registered as singleton
- [ ] All required dependencies are specified
- [ ] SpeechBubbleRenderer registration includes new dependency
- [ ] Container can resolve PortraitModalRenderer
- [ ] No circular dependencies introduced
- [ ] Tests verify proper registration
- [ ] Graceful degradation if registration fails
- [ ] Documentation updated with new token

## Notes
- Registration order matters - dependencies must be registered before dependents
- Consider adding a feature flag to enable/disable the portrait modal feature
- Monitor container initialization time after adding new registration
- If using TypeScript, update type definitions for the token