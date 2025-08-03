# Action Categorization for LLM Prompts - Comprehensive Analysis

## Executive Summary

This report analyzes the action categorization mechanism used in `src/domUI/actionButtonsRenderer.js` and proposes implementing similar categorization for LLM prompts without modifying action indexes. The UI system uses namespace-based grouping to organize actions into logical sections, which can significantly improve LLM understanding and response quality when applied to prompt formatting.

**Key Findings:**

- UI categorization extracts namespaces from actionId (e.g., "core:wait" → "core")
- Grouping activates with ≥6 actions and ≥2 namespaces
- Priority order: ['core', 'intimacy', 'sex', 'anatomy', 'clothing']
- Current LLM formatting lacks categorization entirely
- Implementation can reuse existing logic without index modification

**Recommendation:** Implement markdown-based categorization in `AIPromptContentProvider.js` using the same namespace extraction and grouping logic as the UI.

---

## Current UI Categorization Analysis

### Core Mechanism (`src/domUI/actionButtonsRenderer.js`)

The action buttons renderer implements sophisticated categorization through several key methods:

#### 1. Namespace Extraction (`#extractNamespace()`)

**Location:** `actionButtonsRenderer.js:409-415`

```javascript
#extractNamespace(actionId) {
  if (!actionId || typeof actionId !== 'string') {
    return 'unknown';
  }
  const colonIndex = actionId.indexOf(':');
  return colonIndex !== -1 ? actionId.substring(0, colonIndex) : 'unknown';
}
```

**Functionality:**

- Parses actionId strings using colon delimiter
- Examples: `"core:wait"` → `"core"`, `"intimacy:kiss_back_passionately"` → `"intimacy"`
- Handles edge cases with fallback to `"unknown"`

#### 2. Grouping Decision Logic (`#shouldUseGrouping()`)

**Location:** `actionButtonsRenderer.js:389-400`

```javascript
#shouldUseGrouping(actions) {
  const namespaces = new Set(
    actions
      .filter((action) => action && action.actionId)
      .map((action) => this.#extractNamespace(action.actionId))
  );
  return (
    actions.length >= this.#groupingConfig.minActionsForGrouping &&
    namespaces.size >= this.#groupingConfig.minNamespacesForGrouping &&
    this.#groupingConfig.enabled
  );
}
```

**Thresholds:**

- Minimum 6 actions (`minActionsForGrouping: 6`)
- Minimum 2 namespaces (`minNamespacesForGrouping: 2`)
- Configuration toggle available

#### 3. Namespace Prioritization (`#getSortedNamespaces()`)

**Location:** `actionButtonsRenderer.js:457-476`

**Priority Order Configuration:**

```javascript
namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'];
```

**Sorting Logic:**

1. Priority namespaces sorted by configured order
2. Non-priority namespaces sorted alphabetically
3. Priority namespaces always appear first

#### 4. Visual Grouping Implementation

**Location:** `actionButtonsRenderer.js:484-510`

**Structure:**

- Section headers with namespace names (e.g., "CORE", "INTIMACY")
- Grouped containers with ARIA labels
- Individual action buttons within groups
- CSS classes for styling: `.action-section-header`, `.action-group`

---

## Current LLM Prompt Formatting Analysis

### Current Implementation (`src/prompting/AIPromptContentProvider.js`)

#### Action Formatting Method (`getAvailableActionsInfoContent()`)

**Location:** `AIPromptContentProvider.js:637-669`

```javascript
getAvailableActionsInfoContent(gameState) {
  return this._formatListSegment(
    'Choose one of the following available actions by its index',
    gameState.availableActions,
    (action) => {
      const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
      let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
      description = ensureTerminalPunctuation(description);

      // The critical index formatting
      return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
    },
    noActionsMessage
  );
}
```

**Current Output Format:**

```
Choose one of the following available actions by its index:
[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.
[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.
```

**Limitations:**

- No categorization or grouping
- All actions in flat list regardless of namespace
- Missed opportunity for semantic organization
- Potentially harder for LLM to understand action relationships

---

## Namespace Pattern Analysis

### Discovered Namespaces from Codebase

Based on analysis of `data/mods/*/actions/*.json` files:

#### 1. **Core Namespace** (`core:`)

**Actions:** wait, go, follow, dismiss, stop_following
**Purpose:** Basic gameplay mechanics
**Examples:**

- `core:wait` - "Wait for a moment, doing nothing"
- `core:go` - Movement between locations
- `core:follow` - Leadership/following mechanics

#### 2. **Intimacy Namespace** (`intimacy:`)

**Actions:** kiss_back_passionately, nibble_lower_lip, cup_face_while_kissing, etc.
**Purpose:** Romantic and intimate interactions
**Examples:**

- `intimacy:kiss_back_passionately` - "Return the kiss with equal or greater passion"
- `intimacy:massage_shoulders` - Physical comfort actions
- `intimacy:nuzzle_face_into_neck` - Tender gestures

#### 3. **Sex Namespace** (`sex:`)

**Actions:** rub_vagina_over_clothes, rub_penis_over_clothes, fondle_penis, fondle_breasts
**Purpose:** Explicit sexual interactions
**Examples:**

- `sex:fondle_breasts` - Adult content actions
- `sex:rub_penis_over_clothes` - Clothed sexual acts

#### 4. **Anatomy Namespace** (`anatomy:`)

**Purpose:** Body-related actions and descriptions
**Integration:** Works with anatomy system for detailed character descriptions

#### 5. **Clothing Namespace** (`clothing:`)

**Actions:** remove_clothing
**Purpose:** Clothing manipulation and wardrobe changes
**Examples:**

- `clothing:remove_clothing` - Garment removal actions

#### 6. **Positioning Namespace** (`positioning:`)

**Actions:** kneel_before, turn_around_to_face, turn_around, step_back, get_close
**Purpose:** Spatial positioning and character movement
**Examples:**

- `positioning:kneel_before` - "Kneel before another actor as a sign of respect"
- `positioning:get_close` - Proximity adjustments

#### 7. **Violence Namespace** (`violence:`)

**Actions:** sucker_punch, slap
**Purpose:** Combat and aggressive actions
**Examples:**

- `violence:slap` - Physical aggression
- `violence:sucker_punch` - Surprise attacks

#### 8. **Examples Namespace** (`examples:`)

**Actions:** context_dependent, optional_targets, basic_multi_target
**Purpose:** Development and testing examples

---

## ActionComposite Data Structure

### TypeScript Definition (`src/turns/dtos/actionComposite.js`)

```javascript
/**
 * @typedef {object} ActionComposite
 * @property {number} index - 1-based position in the list (1 ≤ index ≤ MAX_ACTIONS_PER_TURN)
 * @property {string} actionId - Canonical identifier (e.g. "core:attack")
 * @property {string} commandString - Raw command (e.g. "go out to town")
 * @property {object} params - Action parameters (extensible)
 * @property {string} description - Human-readable, localized summary
 */
```

**Critical Constraints:**

- `index` is 1-based and **cannot be modified**
- `actionId` contains namespace prefix (extraction target)
- `commandString` provides user-facing command text
- `description` gives context for LLM understanding

---

## Proposed LLM Categorization System

### Design Principles

1. **Index Preservation**: Never modify or obscure action indexes
2. **Namespace Reuse**: Leverage existing extraction logic
3. **Readability**: Clear markdown structure for LLM parsing
4. **Consistency**: Mirror UI grouping behavior
5. **Fallback Compatibility**: Graceful degradation when categorization disabled

### Proposed Markdown Format

```markdown
## Available Actions

### CORE Actions

[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.
[Index: 7] Command: "follow Sarah". Description: Start following Sarah around.

### INTIMACY Actions

[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.
[Index: 4] Command: "massage Sarah's shoulders". Description: Provide comfort through gentle touch.
[Index: 8] Command: "nuzzle face into Sarah's neck". Description: Show tender affection.

### POSITIONING Actions

[Index: 5] Command: "kneel before Sarah". Description: Kneel before Sarah as a sign of respect.
[Index: 6] Command: "step back from Sarah". Description: Increase distance from Sarah.
```

### Implementation Strategy

#### 1. Create Categorization Service

**New File:** `src/prompting/actionCategorizationService.js`

```javascript
/**
 * Service for categorizing actions by namespace, similar to UI grouping logic
 */
export class ActionCategorizationService {
  static NAMESPACE_ORDER = [
    'core',
    'intimacy',
    'sex',
    'anatomy',
    'clothing',
    'positioning',
    'violence',
  ];
  static MIN_ACTIONS_FOR_GROUPING = 6;
  static MIN_NAMESPACES_FOR_GROUPING = 2;

  /**
   * Extract namespace from actionId (mirrors UI logic)
   */
  extractNamespace(actionId) {
    if (!actionId || typeof actionId !== 'string') {
      return 'unknown';
    }
    const colonIndex = actionId.indexOf(':');
    return colonIndex !== -1 ? actionId.substring(0, colonIndex) : 'unknown';
  }

  /**
   * Determine if actions should be grouped
   */
  shouldUseGrouping(actions) {
    const namespaces = new Set(
      actions
        .filter((action) => action && action.actionId)
        .map((action) => this.extractNamespace(action.actionId))
    );

    return (
      actions.length >= this.MIN_ACTIONS_FOR_GROUPING &&
      namespaces.size >= this.MIN_NAMESPACES_FOR_GROUPING
    );
  }

  /**
   * Group actions by namespace with priority ordering
   */
  groupActionsByNamespace(actions) {
    const grouped = new Map();

    // Group actions by namespace
    for (const action of actions) {
      const namespace = this.extractNamespace(action?.actionId);
      if (!grouped.has(namespace)) {
        grouped.set(namespace, []);
      }
      grouped.get(namespace).push(action);
    }

    // Sort namespaces by priority
    const sortedGroups = new Map();
    const sortedNamespaces = this.getSortedNamespaces(
      Array.from(grouped.keys())
    );

    for (const namespace of sortedNamespaces) {
      sortedGroups.set(namespace, grouped.get(namespace));
    }

    return sortedGroups;
  }

  /**
   * Sort namespaces by priority order
   */
  getSortedNamespaces(namespaces) {
    return namespaces.sort((a, b) => {
      const aIndex = this.NAMESPACE_ORDER.indexOf(a);
      const bIndex = this.NAMESPACE_ORDER.indexOf(b);

      // Both in priority list - sort by priority
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // Only one in priority list - prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Neither in priority list - alphabetical
      return a.localeCompare(b);
    });
  }

  /**
   * Format namespace for display
   */
  formatNamespaceDisplayName(namespace) {
    const specialCases = {
      unknown: 'OTHER',
    };

    return specialCases[namespace] || namespace.toUpperCase();
  }
}
```

#### 2. Modify AIPromptContentProvider

**Update Method:** `getAvailableActionsInfoContent()`

```javascript
getAvailableActionsInfoContent(gameState) {
  const actions = gameState.availableActions || [];

  if (!this.#actionCategorizationService.shouldUseGrouping(actions)) {
    // Use existing flat formatting
    return this._formatListSegment(
      'Choose one of the following available actions by its index',
      actions,
      this._formatSingleAction.bind(this),
      noActionsMessage
    );
  }

  // Use new categorized formatting
  return this._formatCategorizedActions(actions);
}

_formatCategorizedActions(actions) {
  const grouped = this.#actionCategorizationService.groupActionsByNamespace(actions);
  const segments = ['## Available Actions', ''];

  for (const [namespace, namespaceActions] of grouped) {
    const displayName = this.#actionCategorizationService.formatNamespaceDisplayName(namespace);
    segments.push(`### ${displayName} Actions`);

    for (const action of namespaceActions) {
      segments.push(this._formatSingleAction(action));
    }

    segments.push(''); // Empty line between sections
  }

  return segments.join('\n');
}

_formatSingleAction(action) {
  const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
  let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
  description = ensureTerminalPunctuation(description);

  return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
}
```

#### 3. Integration Points

**Constructor Addition:**

```javascript
constructor({ logger, promptStaticContentService, perceptionLogFormatter, gameStateValidationService }) {
  // ... existing code ...
  this.#actionCategorizationService = new ActionCategorizationService();
}
```

---

## Benefits Analysis

### 1. **Improved LLM Understanding**

- **Semantic Context**: Actions grouped by purpose/domain
- **Relationship Clarity**: Related actions appear together
- **Decision Quality**: Better context for appropriate action selection

### 2. **Enhanced UX Consistency**

- **UI Parity**: LLM and human players see similar organization
- **Cognitive Alignment**: Consistent mental models across interfaces
- **Predictable Behavior**: Users understand action grouping logic

### 3. **Maintainable Architecture**

- **Code Reuse**: Leverages existing namespace extraction logic
- **Single Source of Truth**: Centralized categorization service
- **Easy Extension**: New namespaces automatically supported

### 4. **Preserved Functionality**

- **Index Safety**: Critical action indexes remain unchanged
- **Backward Compatibility**: Falls back to flat list when appropriate
- **Performance**: Minimal overhead for grouping logic

---

## Implementation Recommendations

### Phase 1: Core Implementation

1. Create `ActionCategorizationService` with namespace logic
2. Modify `AIPromptContentProvider.getAvailableActionsInfoContent()`
3. Add comprehensive unit tests for categorization logic

### Phase 2: Enhancement & Integration

4. Add configuration options for grouping thresholds
5. Implement logging for categorization decisions
6. Create integration tests with real game scenarios

### Phase 3: Optimization & Monitoring

7. Monitor LLM response quality improvements
8. Gather user feedback on categorized vs. uncategorized prompts
9. Fine-tune namespace priority ordering based on usage patterns

### Technical Considerations

#### Error Handling

- Graceful fallback to flat formatting on categorization errors
- Robust namespace extraction with comprehensive edge case handling
- Logging for debugging categorization decisions

#### Performance

- Minimal impact: O(n) categorization for already-loaded actions
- Optional caching for repeated categorization of same action sets
- Lazy evaluation of grouping decisions

#### Testing Strategy

- Unit tests for `ActionCategorizationService` methods
- Integration tests with `AIPromptContentProvider`
- End-to-end tests with realistic action combinations
- A/B testing for LLM response quality measurement

#### Configuration

```javascript
// Proposed configuration structure
const categorizationConfig = {
  enabled: true,
  minActionsForGrouping: 6,
  minNamespacesForGrouping: 2,
  namespaceOrder: [
    'core',
    'intimacy',
    'sex',
    'anatomy',
    'clothing',
    'positioning',
    'violence',
  ],
  showCounts: false, // Option to show action counts per category
  customFormatting: {
    sectionPrefix: '###',
    actionPrefix: '[Index:',
    actionSuffix: ']',
  },
};
```

---

## Conclusion

Implementing namespace-based action categorization for LLM prompts represents a significant improvement in AI-player interaction quality. By reusing the proven UI categorization logic, we can provide better semantic context to LLMs while maintaining complete backward compatibility and index preservation.

The proposed solution is:

- **Technically sound**: Reuses existing, tested logic
- **Risk-minimal**: Preserves critical action indexes
- **Value-positive**: Improves LLM understanding and decision-making
- **Maintainable**: Clean architecture with clear separation of concerns

This enhancement aligns with the Living Narrative Engine's goal of creating sophisticated, contextually-aware narrative experiences powered by AI.

---

## Appendix: Code Examples

### Sample Input (ActionComposite Array)

```javascript
const sampleActions = [
  {
    index: 1,
    actionId: 'core:wait',
    commandString: 'wait',
    description: 'Wait for a moment, doing nothing.',
  },
  {
    index: 2,
    actionId: 'core:go',
    commandString: 'go north',
    description: 'Move to the northern area.',
  },
  {
    index: 3,
    actionId: 'intimacy:kiss_back_passionately',
    commandString: 'kiss Sarah passionately',
    description: 'Return the kiss with equal passion.',
  },
  {
    index: 4,
    actionId: 'positioning:kneel_before',
    commandString: 'kneel before Sarah',
    description: 'Kneel before Sarah as a sign of respect.',
  },
  {
    index: 5,
    actionId: 'intimacy:massage_shoulders',
    commandString: "massage Sarah's shoulders",
    description: 'Provide comfort through gentle touch.',
  },
  {
    index: 6,
    actionId: 'clothing:remove_clothing',
    commandString: 'remove shirt',
    description: 'Remove your shirt.',
  },
];
```

### Expected Categorized Output

```markdown
## Available Actions

### CORE Actions

[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.

### INTIMACY Actions

[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.
[Index: 5] Command: "massage Sarah's shoulders". Description: Provide comfort through gentle touch.

### CLOTHING Actions

[Index: 6] Command: "remove shirt". Description: Remove your shirt.

### POSITIONING Actions

[Index: 4] Command: "kneel before Sarah". Description: Kneel before Sarah as a sign of respect.
```

### Fallback Output (< 6 actions or < 2 namespaces)

```
Choose one of the following available actions by its index:
[Index: 1] Command: "wait". Description: Wait for a moment, doing nothing.
[Index: 2] Command: "go north". Description: Move to the northern area.
[Index: 3] Command: "kiss Sarah passionately". Description: Return the kiss with equal passion.
```

---

_Report generated by architectural analysis of Living Narrative Engine action categorization systems._
