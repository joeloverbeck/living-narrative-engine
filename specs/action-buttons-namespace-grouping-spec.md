# Action Buttons Namespace Grouping Specification

## Executive Summary

This specification outlines the implementation of visual grouping for action buttons in the Living Narrative Engine's `ActionButtonsRenderer` component. As the number of available actions has increased across different mod namespaces, players are experiencing difficulty navigating cluttered action lists. This proposal introduces namespace-based visual organization to improve user experience and action discovery.

**Problem Statement**: The current flat list of action buttons becomes unwieldy when multiple mods contribute actions, making it difficult for players to quickly identify and select the desired action type.

**Solution Overview**: Implement visual grouping of action buttons by namespace (e.g., `core`, `intimacy`, `sex`, `anatomy`) with configurable display modes and backward compatibility.

**Implementation Priority**: Medium-High (UX improvement for expanding game content)

**Estimated Timeline**: 2-3 weeks for full implementation with testing

**Risk Assessment**: Low (additive feature with fallback to current behavior)

## Current State Analysis

### ActionButtonsRenderer Architecture

Based on the architecture analysis report, the `ActionButtonsRenderer`:

- **Extends**: `SelectableListDisplayComponent` → `BaseListDisplayComponent` → `BoundDomRendererBase`
- **Data Flow**: Receives `ActionComposite[]` via `core:update_available_actions` events
- **Rendering**: Creates flat list of button elements with radio selection behavior
- **Key Properties**:
  - `ActionComposite.actionId`: Namespaced ID (e.g., `"core:wait"`, `"intimacy:get_close"`)
  - `ActionComposite.commandString`: Display text for buttons
  - `ActionComposite.description`: Tooltip text

### Current Action Namespaces

From mod analysis, available namespaces include:
- **core**: Basic movement and interaction (`go`, `wait`, `follow`, `dismiss`)
- **intimacy**: Close-contact interactions (`get_close`, `kiss_cheek`, `massage_shoulders`)
- **sex**: Adult content actions (`fondle_breasts`, `fondle_penis`)
- **anatomy**: Body part interactions
- **clothing**: Equipment and wardrobe actions
- **isekai**: World-specific actions

### Rendering Logic Analysis

Current rendering in `_renderListItem()`:
1. Creates button element using `domElementFactory.button()`
2. Sets tooltip from `actionComposite.description`
3. Adds click handler for selection
4. Returns flat button element

**Integration Point**: The grouping logic should be inserted before/during the rendering phase while maintaining the existing selection and event dispatch mechanisms.

## Design Alternatives

### Alternative 1: Section Headers with Grouped Actions (Recommended)

**Visual Layout**:
```
CORE:
[wait] [go north] [go south] [follow Emma]

INTIMACY:
[get close] [kiss cheek] [massage shoulders]

SEX:
[fondle breasts] [fondle penis]
```

**Pros**:
- Clear visual separation
- Maintains familiar button layout
- Easy to scan and navigate
- Minimal cognitive overhead
- Direct implementation of user's suggestion

**Cons**:
- Increases vertical space usage
- May feel repetitive with few actions per namespace

**Implementation Complexity**: Low-Medium

### Alternative 2: Tabbed Interface

**Visual Layout**:
```
[CORE] [INTIMACY] [SEX]
────────────────────────
[wait] [go north] [go south] [follow Emma]
```

**Pros**:
- Compact horizontal space usage
- Familiar interface pattern
- Clear categorization
- Scales well with many namespaces

**Cons**:
- Hides actions in non-active tabs
- Requires additional interaction for discovery
- More complex keyboard navigation
- Potential accessibility concerns

**Implementation Complexity**: Medium-High

### Alternative 3: Collapsible Accordion Groups

**Visual Layout**:
```
▼ CORE (4 actions)
  [wait] [go north] [go south] [follow Emma]
  
▼ INTIMACY (3 actions)
  [get close] [kiss cheek] [massage shoulders]
  
▼ SEX (2 actions)
  [fondle breasts] [fondle penis]
```

**Pros**:
- Space-efficient when collapsed
- Shows action counts
- Progressive disclosure
- User controls visibility

**Cons**:
- Additional clicks to access actions
- More complex state management
- Potential for hiding important actions

**Implementation Complexity**: Medium

### Alternative 4: Visual Tags with Color Coding

**Visual Layout**:
```
[CORE] [wait] [CORE] [go north] [CORE] [go south]
[INTIM] [get close] [INTIM] [kiss cheek]
[SEX] [fondle breasts] [SEX] [fondle penis]
```

**Pros**:
- Maintains flat layout
- Quick visual identification
- No space overhead
- Preserves current interaction model

**Cons**:
- Can look cluttered
- Color dependency for identification
- Accessibility concerns with color-only differentiation
- Still doesn't truly group actions

**Implementation Complexity**: Low

### Alternative 5: Mixed Approach (Conditional Grouping)

**Implementation Strategy**:
- **1-5 total actions**: No grouping (current behavior)
- **6+ actions with 2+ namespaces**: Section headers (Alternative 1)
- **10+ actions with 3+ namespaces**: Optional accordion mode (Alternative 3)

**Pros**:
- Adaptive to content density
- No overhead for simple scenarios
- Scales appropriately with complexity

**Cons**:
- Inconsistent interface behavior
- More complex implementation logic

**Implementation Complexity**: Medium-High

## Recommended Solution: Section Headers with Enhanced Features

Based on analysis and user feedback, **Alternative 1** with enhancements is recommended:

### Core Features
1. **Namespace Section Headers**: Clear, bold headers for each namespace
2. **Smart Capitalization**: Transform `core` → `CORE`, `intimacy` → `INTIMACY`
3. **Action Count Indicators**: Optional display of action counts per section
4. **Configurable Ordering**: Default alphabetical, with option for custom priority
5. **Responsive Layout**: Adapt to screen size and action density

### Enhanced Features
1. **Namespace Prioritization**: Common namespaces (`core`) appear first
2. **Single-Namespace Fallback**: No headers when only one namespace present
3. **Accessibility Enhancements**: Proper ARIA grouping and navigation
4. **Animation Support**: Smooth transitions when actions update

## Technical Implementation

### Component Architecture Changes

#### ActionButtonsRenderer Modifications

```javascript
/**
 * Enhanced ActionButtonsRenderer with namespace grouping support
 */
export class ActionButtonsRenderer extends SelectableListDisplayComponent {
  // Existing properties...
  
  /** @type {object} Configuration for grouping behavior */
  #groupingConfig = {
    enabled: true,
    showCounts: false,
    minActionsForGrouping: 6,
    minNamespacesForGrouping: 2,
    namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing']
  };
  
  /** @type {Map<string, ActionComposite[]>} Grouped actions by namespace */
  #groupedActions = new Map();
  
  /**
   * Groups actions by namespace and renders with section headers
   * @protected
   * @override
   */
  _renderList(actionsData) {
    if (!this.#shouldUseGrouping(actionsData)) {
      return super._renderList(actionsData);
    }
    
    this.#groupedActions = this.#groupActionsByNamespace(actionsData);
    return this.#renderGroupedActions();
  }
  
  /**
   * Determines if grouping should be applied based on action count and diversity
   * @private
   * @param {ActionComposite[]} actions 
   * @returns {boolean}
   */
  #shouldUseGrouping(actions) {
    const namespaces = new Set(actions.map(action => this.#extractNamespace(action.actionId)));
    return actions.length >= this.#groupingConfig.minActionsForGrouping &&
           namespaces.size >= this.#groupingConfig.minNamespacesForGrouping &&
           this.#groupingConfig.enabled;
  }
  
  /**
   * Extracts namespace from action ID (e.g., "core:wait" → "core")
   * @private
   * @param {string} actionId 
   * @returns {string}
   */
  #extractNamespace(actionId) {
    const colonIndex = actionId.indexOf(':');
    return colonIndex !== -1 ? actionId.substring(0, colonIndex) : 'unknown';
  }
  
  /**
   * Groups actions by namespace with ordering priority
   * @private
   * @param {ActionComposite[]} actions 
   * @returns {Map<string, ActionComposite[]>}
   */
  #groupActionsByNamespace(actions) {
    const grouped = new Map();
    
    // Group actions
    for (const action of actions) {
      const namespace = this.#extractNamespace(action.actionId);
      if (!grouped.has(namespace)) {
        grouped.set(namespace, []);
      }
      grouped.get(namespace).push(action);
    }
    
    // Sort namespaces by priority order
    const sortedGroups = new Map();
    const orderedNamespaces = this.#getSortedNamespaces(Array.from(grouped.keys()));
    
    for (const namespace of orderedNamespaces) {
      sortedGroups.set(namespace, grouped.get(namespace));
    }
    
    return sortedGroups;
  }
  
  /**
   * Sorts namespaces according to priority configuration
   * @private
   * @param {string[]} namespaces 
   * @returns {string[]}
   */
  #getSortedNamespaces(namespaces) {
    const { namespaceOrder } = this.#groupingConfig;
    
    return namespaces.sort((a, b) => {
      const aIndex = namespaceOrder.indexOf(a);
      const bIndex = namespaceOrder.indexOf(b);
      
      // If both are in priority list, sort by priority order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in priority list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither is in priority list, sort alphabetically
      return a.localeCompare(b);
    });
  }
  
  /**
   * Renders actions with section headers
   * @private
   * @returns {DocumentFragment}
   */
  #renderGroupedActions() {
    const fragment = document.createDocumentFragment();
    
    for (const [namespace, actions] of this.#groupedActions) {
      // Create section header
      const sectionHeader = this.#createSectionHeader(namespace, actions.length);
      fragment.appendChild(sectionHeader);
      
      // Create action group container
      const groupContainer = this.#createGroupContainer(namespace);
      
      // Render actions in this group
      for (const action of actions) {
        const button = this._renderListItem(action);
        if (button) {
          groupContainer.appendChild(button);
        }
      }
      
      fragment.appendChild(groupContainer);
    }
    
    return fragment;
  }
  
  /**
   * Creates a section header element
   * @private
   * @param {string} namespace 
   * @param {number} actionCount 
   * @returns {HTMLElement}
   */
  #createSectionHeader(namespace, actionCount) {
    const header = document.createElement('div');
    header.className = 'action-section-header';
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-level', '3');
    
    const displayName = this.#formatNamespaceDisplayName(namespace);
    header.textContent = this.#groupingConfig.showCounts 
      ? `${displayName} (${actionCount})`
      : displayName;
    
    return header;
  }
  
  /**
   * Creates a container for grouped actions
   * @private
   * @param {string} namespace 
   * @returns {HTMLElement}
   */
  #createGroupContainer(namespace) {
    const container = document.createElement('div');
    container.className = 'action-group';
    container.setAttribute('data-namespace', namespace);
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', `${this.#formatNamespaceDisplayName(namespace)} actions`);
    
    return container;
  }
  
  /**
   * Formats namespace for display (e.g., "core" → "CORE")
   * @private
   * @param {string} namespace 
   * @returns {string}
   */
  #formatNamespaceDisplayName(namespace) {
    // Handle special cases
    const specialCases = {
      'unknown': 'OTHER'
    };
    
    if (specialCases[namespace]) {
      return specialCases[namespace];
    }
    
    return namespace.toUpperCase();
  }
  
  /**
   * Updates grouping configuration
   * @public
   * @param {object} config 
   */
  updateGroupingConfig(config) {
    this.#groupingConfig = { ...this.#groupingConfig, ...config };
    
    // Re-render if we have current actions
    if (this.availableActions.length > 0) {
      this.refreshList();
    }
  }
  
  /**
   * Gets current grouping configuration
   * @public
   * @returns {object}
   */
  getGroupingConfig() {
    return { ...this.#groupingConfig };
  }
}
```

### CSS Styling Requirements

```css
/* Action Section Headers */
.action-section-header {
  font-weight: bold;
  font-size: 0.9em;
  color: var(--text-muted);
  margin: 0.8em 0 0.4em 0;
  padding: 0.2em 0;
  border-bottom: 1px solid var(--border-light);
  letter-spacing: 0.5px;
}

.action-section-header:first-child {
  margin-top: 0.2em;
}

/* Action Groups */
.action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-bottom: 1em;
}

.action-group:last-child {
  margin-bottom: 0;
}

/* Action Buttons within Groups */
.action-group .action-button {
  min-width: auto;
  margin: 0; /* Remove default margins since gap handles spacing */
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .action-group {
    flex-direction: column;
    gap: 0.3em;
  }
  
  .action-section-header {
    font-size: 0.8em;
    margin: 0.6em 0 0.3em 0;
  }
}

/* Accessibility Enhancements */
.action-section-header:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Animation Support */
.action-group {
  transition: opacity 0.2s ease-in-out;
}

.actions-fade-in .action-group {
  animation: fadeInGroup 0.3s ease-in-out;
}

@keyframes fadeInGroup {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Configuration Integration

#### Configuration Options

```javascript
// Add to game configuration or UI settings
const actionGroupingConfig = {
  // Feature toggle
  enabled: true,
  
  // Display preferences
  showActionCounts: false,
  
  // Grouping thresholds
  minActionsForGrouping: 6,
  minNamespacesForGrouping: 2,
  
  // Namespace ordering priority
  namespaceOrder: [
    'core',       // Basic actions first
    'intimacy',   // Social interactions
    'sex',        // Adult content
    'anatomy',    // Body interactions
    'clothing',   // Equipment
    'isekai'      // World-specific last
  ],
  
  // Visual customization
  useCompactMode: false,
  animateTransitions: true,
  
  // Accessibility
  enableKeyboardGroupNavigation: true,
  announceGroupChanges: true
};
```

#### Integration with Game Settings

```javascript
// In UIBootstrapper or similar initialization
const actionRenderer = new ActionButtonsRenderer({
  // ... existing parameters
});

// Load configuration from game settings
const groupingConfig = gameConfig.getValue('ui.actionGrouping') || {};
actionRenderer.updateGroupingConfig(groupingConfig);

// Allow runtime configuration changes
eventBus.subscribe('ui:update_action_grouping', (event) => {
  actionRenderer.updateGroupingConfig(event.payload.config);
});
```

## Implementation Phases

### Phase 1: Core Grouping Implementation (Week 1)

**Objectives**:
- Implement basic namespace extraction and grouping logic
- Add section header rendering
- Ensure backward compatibility when grouping is disabled

**Tasks**:
1. **Day 1-2**: Implement `#extractNamespace()` and `#groupActionsByNamespace()` methods
2. **Day 3-4**: Add grouped rendering logic with section headers
3. **Day 5**: Implement configuration system and fallback behavior
4. **Weekend**: Unit testing and integration testing

**Deliverables**:
- Modified `ActionButtonsRenderer` with grouping capability
- Basic CSS styles for section headers
- Configuration integration
- Unit tests covering grouping logic

**Success Criteria**:
- Actions are correctly grouped by namespace
- Section headers display properly
- Existing functionality remains unchanged when grouping disabled
- All existing tests continue to pass

### Phase 2: Enhanced Features and Polish (Week 2)

**Objectives**:
- Add namespace ordering and prioritization
- Implement responsive design and animations
- Enhance accessibility features

**Tasks**:
1. **Day 1-2**: Implement namespace ordering and priority system
2. **Day 3-4**: Add responsive CSS and animation support
3. **Day 5**: Enhance accessibility with ARIA attributes and keyboard navigation
4. **Weekend**: Integration testing and performance optimization

**Deliverables**:
- Namespace prioritization system
- Responsive CSS design
- Accessibility enhancements
- Performance optimizations

**Success Criteria**:
- Namespaces appear in configured priority order
- Interface adapts properly to different screen sizes
- Accessibility standards are maintained
- No significant performance regression

### Phase 3: Advanced Features and Configuration (Week 3)

**Objectives**:
- Add runtime configuration capabilities
- Implement advanced display options
- Comprehensive testing and documentation

**Tasks**:
1. **Day 1-2**: Runtime configuration system and UI controls
2. **Day 3-4**: Advanced display options (counts, compact mode)
3. **Day 5**: End-to-end testing and user acceptance testing
4. **Weekend**: Documentation updates and deployment preparation

**Deliverables**:
- Runtime configuration system
- Advanced display options
- Comprehensive test suite
- Updated documentation

**Success Criteria**:
- Users can configure grouping behavior at runtime
- All display options work correctly
- Comprehensive test coverage (>85%)
- Documentation is complete and accurate

## Accessibility Considerations

### ARIA Implementation

1. **Section Headers**: Use `role="heading"` with appropriate `aria-level`
2. **Action Groups**: Use `role="group"` with descriptive `aria-label`
3. **Navigation**: Support arrow key navigation between groups
4. **Announcements**: Screen reader announcements for group changes

### Keyboard Navigation Enhancement

```javascript
/**
 * Enhanced keyboard navigation for grouped actions
 */
#setupGroupedKeyboardNavigation() {
  // Existing navigation logic...
  
  // Add group-level navigation
  this.elements.listContainerElement.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const currentButton = this.elements.listContainerElement.querySelector('.action-button:focus');
      const currentGroup = currentButton?.closest('.action-group');
      
      if (event.ctrlKey && currentGroup) {
        // Ctrl + Arrow keys navigate between groups
        const nextGroup = event.key === 'ArrowDown' 
          ? currentGroup.nextElementSibling?.querySelector('.action-group')
          : currentGroup.previousElementSibling?.querySelector('.action-group');
          
        if (nextGroup) {
          const firstButton = nextGroup.querySelector('.action-button');
          firstButton?.focus();
          event.preventDefault();
        }
      }
    }
  });
}
```

### Screen Reader Support

```javascript
/**
 * Announces group changes to screen readers
 */
#announceGroupChange(namespace, actionCount) {
  if (this.#groupingConfig.announceGroupChanges) {
    const announcement = `${this.#formatNamespaceDisplayName(namespace)} actions, ${actionCount} available`;
    
    // Create temporary live region for announcement
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = announcement;
    
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }
}
```

## Testing Strategy

### Unit Testing

#### Core Functionality Tests

```javascript
describe('ActionButtonsRenderer - Namespace Grouping', () => {
  let renderer;
  let mockActions;

  beforeEach(() => {
    mockActions = [
      { index: 1, actionId: 'core:wait', commandString: 'wait', description: 'Wait' },
      { index: 2, actionId: 'core:go', commandString: 'go north', description: 'Go north' },
      { index: 3, actionId: 'intimacy:get_close', commandString: 'get close', description: 'Get close' },
      { index: 4, actionId: 'sex:fondle_breasts', commandString: 'fondle breasts', description: 'Fondle breasts' },
    ];
    
    renderer = new ActionButtonsRenderer({
      // ... test configuration
    });
  });

  describe('Namespace Extraction', () => {
    it('should extract namespace from action ID', () => {
      expect(renderer.#extractNamespace('core:wait')).toBe('core');
      expect(renderer.#extractNamespace('intimacy:get_close')).toBe('intimacy');
      expect(renderer.#extractNamespace('no_colon_action')).toBe('unknown');
    });
  });

  describe('Action Grouping', () => {
    it('should group actions by namespace', () => {
      const grouped = renderer.#groupActionsByNamespace(mockActions);
      
      expect(grouped.has('core')).toBe(true);
      expect(grouped.has('intimacy')).toBe(true);
      expect(grouped.has('sex')).toBe(true);
      expect(grouped.get('core')).toHaveLength(2);
      expect(grouped.get('intimacy')).toHaveLength(1);
      expect(grouped.get('sex')).toHaveLength(1);
    });
    
    it('should sort namespaces by priority order', () => {
      const namespaces = ['sex', 'core', 'intimacy'];
      const sorted = renderer.#getSortedNamespaces(namespaces);
      
      expect(sorted).toEqual(['core', 'intimacy', 'sex']);
    });
  });

  describe('Grouping Thresholds', () => {
    it('should not group when below minimum actions threshold', () => {
      const fewActions = mockActions.slice(0, 2);
      expect(renderer.#shouldUseGrouping(fewActions)).toBe(false);
    });
    
    it('should not group when below minimum namespaces threshold', () => {
      const singleNamespace = [
        { index: 1, actionId: 'core:wait', commandString: 'wait', description: 'Wait' },
        { index: 2, actionId: 'core:go', commandString: 'go', description: 'Go' },
      ];
      expect(renderer.#shouldUseGrouping(singleNamespace)).toBe(false);
    });
    
    it('should group when thresholds are met', () => {
      expect(renderer.#shouldUseGrouping(mockActions)).toBe(true);
    });
  });
});
```

#### Configuration Tests

```javascript
describe('Configuration Management', () => {
  it('should update grouping configuration', () => {
    const newConfig = { enabled: false, showCounts: true };
    renderer.updateGroupingConfig(newConfig);
    
    const config = renderer.getGroupingConfig();
    expect(config.enabled).toBe(false);
    expect(config.showCounts).toBe(true);
  });
  
  it('should preserve existing configuration when partially updating', () => {
    const originalConfig = renderer.getGroupingConfig();
    renderer.updateGroupingConfig({ enabled: false });
    
    const updatedConfig = renderer.getGroupingConfig();
    expect(updatedConfig.enabled).toBe(false);
    expect(updatedConfig.namespaceOrder).toEqual(originalConfig.namespaceOrder);
  });
});
```

### Integration Testing

#### Rendering Integration Tests

```javascript
describe('ActionButtonsRenderer Integration - Grouping', () => {
  let testBed;
  let renderer;

  beforeEach(() => {
    testBed = new ActionButtonsRendererTestBed();
    renderer = testBed.createRenderer();
  });

  it('should render grouped actions with section headers', async () => {
    const actions = testBed.createMixedNamespaceActions();
    
    await testBed.simulateActionsUpdate(actions);
    
    const container = testBed.getActionsContainer();
    const headers = container.querySelectorAll('.action-section-header');
    const groups = container.querySelectorAll('.action-group');
    
    expect(headers).toHaveLength(3); // core, intimacy, sex
    expect(groups).toHaveLength(3);
    expect(headers[0].textContent).toBe('CORE');
    expect(headers[1].textContent).toBe('INTIMACY');
    expect(headers[2].textContent).toBe('SEX');
  });
  
  it('should maintain selection behavior with grouped actions', async () => {
    const actions = testBed.createMixedNamespaceActions();
    await testBed.simulateActionsUpdate(actions);
    
    const firstButton = testBed.getActionButton(1);
    await testBed.clickButton(firstButton);
    
    expect(renderer.selectedAction).toBeTruthy();
    expect(renderer.selectedAction.actionId).toBe(actions[0].actionId);
    expect(firstButton.getAttribute('aria-checked')).toBe('true');
  });
  
  it('should fall back to ungrouped rendering when thresholds not met', async () => {
    const fewActions = testBed.createActionsFromSingleNamespace(2);
    await testBed.simulateActionsUpdate(fewActions);
    
    const container = testBed.getActionsContainer();
    const headers = container.querySelectorAll('.action-section-header');
    const buttons = container.querySelectorAll('.action-button');
    
    expect(headers).toHaveLength(0);
    expect(buttons).toHaveLength(2);
  });
});
```

### End-to-End Testing

#### User Workflow Tests

```javascript
describe('E2E - Action Grouping User Workflows', () => {
  let gameEngine;
  let ui;

  beforeEach(async () => {
    ({ gameEngine, ui } = await setupTestGameEnvironment());
  });

  it('should display grouped actions in a real game scenario', async () => {
    // Load game with multiple mods that provide actions
    await gameEngine.loadWorld('test-world-with-multiple-mods');
    
    // Simulate player turn that discovers many actions
    const player = gameEngine.getCurrentActor();
    await gameEngine.processAction(player, 'core:wait');
    
    // Verify UI shows grouped actions
    const actionButtons = ui.getActionButtons();
    const groupHeaders = ui.getActionGroupHeaders();
    
    expect(groupHeaders).toContain('CORE');
    expect(groupHeaders).toContain('INTIMACY');
    expect(actionButtons.length).toBeGreaterThan(6);
  });
  
  it('should handle namespace priority ordering correctly', async () => {
    await gameEngine.loadWorld('test-world-mixed-actions');
    
    const groupHeaders = ui.getActionGroupHeaders();
    const headerTexts = groupHeaders.map(h => h.textContent);
    
    // Verify core actions appear first regardless of alphabetical order
    expect(headerTexts[0]).toBe('CORE');
    
    // Verify remaining order follows configuration
    const remainingHeaders = headerTexts.slice(1);
    const expectedOrder = ['INTIMACY', 'SEX']; // Based on config
    expect(remainingHeaders.slice(0, expectedOrder.length)).toEqual(expectedOrder);
  });
});
```

### Performance Testing

#### Rendering Performance Tests

```javascript
describe('Performance - Action Grouping', () => {
  it('should not significantly impact rendering performance', () => {
    const largeActionSet = createLargeActionSet(100); // 100 actions across 5 namespaces
    
    const startTime = performance.now();
    renderer._renderList(largeActionSet);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50); // Should render in under 50ms
  });
  
  it('should efficiently handle frequent action updates', () => {
    const performanceLog = [];
    
    for (let i = 0; i < 10; i++) {
      const actions = createRandomActionSet(20);
      
      const startTime = performance.now();
      renderer._renderList(actions);
      const endTime = performance.now();
      
      performanceLog.push(endTime - startTime);
    }
    
    const averageTime = performanceLog.reduce((a, b) => a + b) / performanceLog.length;
    expect(averageTime).toBeLessThan(30); // Average under 30ms
  });
});
```

## Migration and Backward Compatibility

### Backward Compatibility Strategy

1. **Feature Flag Control**: Grouping can be completely disabled via configuration
2. **Fallback Behavior**: When disabled or thresholds not met, renders exactly as before
3. **API Preservation**: All existing public methods and properties remain unchanged
4. **Event Compatibility**: All existing events and payloads remain the same

### Migration Path

#### Phase 1: Silent Introduction
- Deploy grouping feature disabled by default
- Allow opt-in via configuration
- Monitor for any regressions

#### Phase 2: Gradual Rollout
- Enable grouping for development/staging environments
- Collect user feedback and performance metrics
- Adjust default thresholds based on real usage

#### Phase 3: Production Deployment
- Enable grouping by default in production
- Maintain ability to disable if issues arise
- Document configuration options for customization

### Configuration Migration

```javascript
// Legacy configuration (still supported)
const legacyConfig = {
  actionButtons: {
    // existing settings...
  }
};

// New configuration (additive)
const enhancedConfig = {
  actionButtons: {
    // existing settings preserved...
    grouping: {
      enabled: true,
      minActionsForGrouping: 6,
      minNamespacesForGrouping: 2,
      // ... other grouping options
    }
  }
};

// Migration helper
function migrateActionButtonsConfig(oldConfig) {
  return {
    ...oldConfig,
    grouping: {
      enabled: oldConfig.enableGrouping ?? true,
      // Apply sensible defaults for new options
      ...getDefaultGroupingConfig()
    }
  };
}
```

## Alternative Implementation Approaches

### Approach A: Minimal Modification (Low Risk)

**Strategy**: Minimal changes to existing component, grouping logic as utility functions

**Pros**:
- Lowest risk of breaking existing functionality
- Easy to understand and maintain
- Quick implementation

**Cons**:
- Less integrated with component architecture
- Limited extensibility for future enhancements

### Approach B: Component Composition (Medium Risk)

**Strategy**: Create separate `ActionGroupRenderer` components, compose within main renderer

**Pros**:
- Clean separation of concerns
- Reusable group components
- Easier testing of group logic

**Cons**:
- More complex component hierarchy
- Potential performance overhead
- More files to maintain

### Approach C: Full Refactor (High Risk)

**Strategy**: Completely redesign `ActionButtonsRenderer` with grouping as core feature

**Pros**:
- Clean, optimized architecture
- Best performance and extensibility
- Eliminates technical debt

**Cons**:
- High risk of breaking changes
- Significant development time
- Complex migration path

**Recommendation**: **Approach A** for initial implementation, with option to evolve toward Approach B in future versions.

## Success Criteria

### Technical Success Criteria

1. **Functional Requirements**:
   - ✅ Actions are correctly grouped by namespace
   - ✅ Section headers display appropriate namespace names
   - ✅ Selection and event dispatch behavior unchanged
   - ✅ Grouping can be disabled via configuration
   - ✅ Fallback to ungrouped rendering when thresholds not met

2. **Performance Requirements**:
   - ✅ No significant rendering performance regression (<10% increase)
   - ✅ Memory usage increase <5%
   - ✅ Initialization time impact <50ms

3. **Accessibility Requirements**:
   - ✅ ARIA compliance maintained
   - ✅ Keyboard navigation works correctly
   - ✅ Screen reader compatibility preserved
   - ✅ Color contrast standards met

### User Experience Success Criteria

1. **Usability Improvements**:
   - ✅ Users can find desired actions faster (measured via user testing)
   - ✅ Interface feels less cluttered with many actions
   - ✅ Visual organization enhances action discovery

2. **Compatibility**:
   - ✅ No disruption to existing player workflows
   - ✅ Consistent behavior across different screen sizes
   - ✅ Works correctly with all existing mods

3. **Configurability**:
   - ✅ Users can customize grouping behavior
   - ✅ Admins can disable feature if needed
   - ✅ Namespace ordering can be customized

### Quality Assurance Criteria

1. **Code Quality**:
   - ✅ Test coverage >85% for new functionality
   - ✅ Code follows project style guidelines
   - ✅ Proper error handling and logging
   - ✅ Documentation updated and complete

2. **Integration Quality**:
   - ✅ All existing tests continue to pass
   - ✅ No breaking changes to public APIs
   - ✅ Proper dependency injection usage
   - ✅ Configuration follows project patterns

3. **Production Readiness**:
   - ✅ Feature flag controls work correctly
   - ✅ Rollback procedures tested
   - ✅ Performance benchmarks established
   - ✅ Monitoring and alerting in place

## Future Enhancements

### Phase 4: Advanced Features (Future)

1. **Customizable Display Modes**:
   - Compact grid layout for high action density
   - Icon-based namespace identification
   - User-customizable group names and colors

2. **Smart Grouping**:
   - Machine learning-based action priority
   - Context-aware grouping (time of day, location, etc.)
   - Dynamic namespace discovery and organization

3. **Enhanced Interaction**:
   - Drag-and-drop group reordering
   - Collapsible groups with state persistence
   - Quick action search within groups

4. **Analytics and Optimization**:
   - Usage analytics for group optimization
   - A/B testing for different layouts
   - Performance monitoring and optimization

### Integration Opportunities

1. **Mod System Integration**:
   - Mod-defined namespace display names
   - Mod-specific grouping rules
   - Cross-mod action organization

2. **Accessibility Enhancements**:
   - Voice navigation support
   - High contrast mode optimizations
   - Customizable font sizes and spacing

3. **Mobile Optimization**:
   - Touch-friendly group interactions
   - Swipe navigation between groups
   - Responsive breakpoint optimizations

## Conclusion

The namespace-based grouping feature represents a significant improvement to the Living Narrative Engine's user interface, addressing the growing complexity of action selection as the modding ecosystem expands. The recommended implementation provides:

**Key Benefits**:
- **Improved User Experience**: Clear visual organization reduces cognitive load
- **Scalability**: System handles growth in action diversity gracefully
- **Flexibility**: Multiple configuration options accommodate different preferences
- **Maintainability**: Clean, well-tested implementation following project patterns

**Low Risk Implementation**:
- Additive feature with comprehensive fallback behavior
- Extensive testing strategy covering all scenarios
- Gradual rollout plan minimizes disruption
- Full backward compatibility preserved

**Future-Ready Architecture**:
- Extensible design accommodates future enhancements
- Configuration system supports ongoing customization
- Performance-optimized for growth in content volume

The implementation should proceed with confidence, following the phased approach outlined in this specification. The result will be a more organized, user-friendly interface that grows elegantly with the expanding game content while maintaining the engine's commitment to flexibility and moddability.

---

**Specification Version**: 1.0  
**Author**: AI Assistant  
**Date**: 2025-01-19  
**Status**: Ready for Implementation  
**Next Steps**: Begin Phase 1 implementation with core grouping functionality