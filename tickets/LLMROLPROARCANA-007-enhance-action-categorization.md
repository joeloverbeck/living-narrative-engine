# LLMROLPROARCANA-007: Enhance Action Categorization with Context Hints

**Reference:** `reports/llm-roleplay-prompt-architecture-analysis.md` - Section 4.3, Phase 2, Task 3
**Priority:** MEDIUM ⭐⭐⭐
**Estimated Effort:** Low (4-6 hours)
**Impact:** 15% faster action selection, improved decision quality
**Phase:** 2 - Quality Improvements (Week 2)

## Problem Statement

The current available actions presentation is a flat list of 81 actions without grouping or context, creating scanning difficulty and decision fatigue:

**Current Format:**
```
[Index: 1] Command: "wait"
[Index: 2] Command: "get close to Registrar Copperplate"
...
[Index: 81] Command: "remove leather collar with bell"
```

**Issues:**
- Flat list requires scanning all 81 actions sequentially
- No contextual guidance for action selection
- Categories exist but not visually grouped
- No hints about when each type of action is appropriate
- Difficult to find relevant actions quickly

## Objective

Reorganize available actions into meaningful categories with context hints to guide action selection, reducing cognitive load and improving decision quality.

## Acceptance Criteria

- [ ] Actions organized into 7 clear categories
- [ ] Each category has descriptive header and action count
- [ ] Context hints added for each category (when to consider)
- [ ] High-priority actions (wait, examine) highlighted
- [ ] Category summaries explain action purpose
- [ ] Tests verify categorization improves selection time
- [ ] LLM selects more contextually appropriate actions

## Technical Implementation

### Files to Modify

1. **`src/data/providers/availableActionsProvider.js`**
   - Add categorization logic
   - Implement category metadata (descriptions, hints)
   - Add high-priority action flagging

2. **`src/prompting/templates/characterPromptTemplate.js`**
   - Update `buildAvailableActions()` to use categories
   - Add category formatting with hints
   - Implement action grouping display

### Proposed Categorized Format

```xml
<available_actions count="81">
  <!-- Consider your character's emotional state, goals, and recent events when selecting.
       Mundane actions (wait, examine) are always valid choices. -->

  <high_priority>
    ## HIGH-PRIORITY ACTIONS (3 actions)
    Common actions useful in most situations.

    [Index: 1] wait - Do nothing for a moment
    [Index: 2] examine_location - Look around carefully
    [Index: 3] examine_entity - Inspect a person or object closely
  </high_priority>

  <by_category>
    ## POSITIONING ACTIONS (10 actions)
    **Purpose:** Spatial relationships and body positioning relative to others or furniture.
    **Consider when:** Proximity matters for interaction, relationship dynamics, tactical positioning.

    [Index: 4] get_close_to - Move closer to someone
    [Index: 5] step_back_from - Create distance from someone
    [Index: 6] sit_down - Take a seat on available furniture
    ...

    ## INTERACTION ACTIONS (25 actions)
    **Purpose:** Object manipulation, giving, taking, examining items.
    **Consider when:** Items are relevant to goals, need to inspect or exchange objects.

    [Index: 15] pick_up_item - Take an item from location
    [Index: 16] give_item - Hand something to someone
    [Index: 17] drop_item - Put down an item
    ...

    ## SOCIAL ACTIONS (18 actions)
    **Purpose:** Interpersonal communication and relationship building.
    **Consider when:** Building rapport, expressing emotions, social maneuvering.

    [Index: 42] compliment - Express positive regard
    [Index: 43] flirt - Show romantic/sexual interest
    ...

    ## PERFORMANCE ACTIONS (10 actions)
    **Purpose:** Artistic expression and entertainment.
    **Consider when:** Bard identity is relevant, performance opportunities, artistic impulses.

    [Index: 44] play_lute - Perform music on instrument
    [Index: 45] sing - Vocal performance
    ...

    ## CONFLICT ACTIONS (7 actions)
    **Purpose:** Aggressive or defensive actions, distress expression.
    **Consider when:** Threats present, emotional intensity, combat situations.

    [Index: 76] attack - Initiate violence
    [Index: 77] defend - Protective stance
    ...

    ## EQUIPMENT ACTIONS (8 actions)
    **Purpose:** Managing worn items and inventory.
    **Consider when:** Clothing/equipment changes needed, tactical preparation.

    [Index: 78] wear_item - Put on clothing or equipment
    [Index: 79] remove_item - Take off worn item
    ...
  </by_category>

  <selection_guidance>
    **Decision Process:**
    1. What does my character want right now? (Check current_goals)
    2. What just happened? (Review perception_log)
    3. What's my emotional state? (Consider internal tensions)
    4. Which category serves my current needs?
    5. Which specific action within that category fits best?

    **Common Patterns:**
    - Social situations → SOCIAL or PERFORMANCE actions
    - Need information → HIGH-PRIORITY (examine) or INTERACTION
    - Emotional intensity → CONFLICT or SOCIAL
    - Tactical positioning → POSITIONING
    - Inventory management → INTERACTION or EQUIPMENT
  </selection_guidance>
</available_actions>
```

### Category Definitions

```javascript
// src/data/providers/availableActionsProvider.js

const ACTION_CATEGORIES = {
  HIGH_PRIORITY: {
    id: 'high_priority',
    name: 'High-Priority Actions',
    description: 'Common actions useful in most situations.',
    hints: 'Always consider these first - they are universally applicable.',
    priority: 1
  },

  POSITIONING: {
    id: 'positioning',
    name: 'Positioning Actions',
    description: 'Spatial relationships and body positioning relative to others or furniture.',
    hints: 'Consider when proximity matters for interaction, relationship dynamics, or tactical positioning.',
    priority: 2
  },

  INTERACTION: {
    id: 'interaction',
    name: 'Interaction Actions',
    description: 'Object manipulation, giving, taking, examining items.',
    hints: 'Consider when items are relevant to goals or you need to inspect/exchange objects.',
    priority: 3
  },

  SOCIAL: {
    id: 'social',
    name: 'Social Actions',
    description: 'Interpersonal communication and relationship building.',
    hints: 'Consider when building rapport, expressing emotions, or social maneuvering.',
    priority: 4
  },

  PERFORMANCE: {
    id: 'performance',
    name: 'Performance Actions',
    description: 'Artistic expression and entertainment.',
    hints: 'Consider when bard identity is relevant, performance opportunities arise, or artistic impulses surface.',
    priority: 5
  },

  CONFLICT: {
    id: 'conflict',
    name: 'Conflict Actions',
    description: 'Aggressive or defensive actions, distress expression.',
    hints: 'Consider when threats are present, emotional intensity is high, or combat situations arise.',
    priority: 6
  },

  EQUIPMENT: {
    id: 'equipment',
    name: 'Equipment Actions',
    description: 'Managing worn items and inventory.',
    hints: 'Consider when clothing/equipment changes are needed or tactical preparation is required.',
    priority: 7
  }
};

class AvailableActionsProvider {
  categorizeActions(actions) {
    const categorized = {
      high_priority: [],
      positioning: [],
      interaction: [],
      social: [],
      performance: [],
      conflict: [],
      equipment: [],
      uncategorized: []
    };

    actions.forEach(action => {
      const category = this.determineCategory(action);
      categorized[category].push(action);
    });

    return categorized;
  }

  determineCategory(action) {
    // Category determination logic based on action properties
    if (this.isHighPriority(action)) return 'high_priority';
    if (this.isPositioning(action)) return 'positioning';
    if (this.isInteraction(action)) return 'interaction';
    if (this.isSocial(action)) return 'social';
    if (this.isPerformance(action)) return 'performance';
    if (this.isConflict(action)) return 'conflict';
    if (this.isEquipment(action)) return 'equipment';
    return 'uncategorized';
  }

  formatCategorized(categorizedActions) {
    let output = `<available_actions count="${this.getTotalCount(categorizedActions)}">\n`;
    output += this.buildContextHint();

    // High-priority first
    output += this.formatCategory('high_priority', categorizedActions.high_priority);

    // Then other categories by priority
    output += '<by_category>\n';
    ['positioning', 'interaction', 'social', 'performance', 'conflict', 'equipment'].forEach(cat => {
      output += this.formatCategory(cat, categorizedActions[cat]);
    });
    output += '</by_category>\n';

    output += this.buildSelectionGuidance();
    output += '</available_actions>';

    return output;
  }
}
```

## Testing Requirements

### Action Selection Performance Tests

```javascript
describe('Action Categorization Performance', () => {
  it('should reduce action selection time', async () => {
    const scenarios = [
      { context: 'Need to move closer to NPC', expectedCategory: 'positioning' },
      { context: 'Want to examine an object', expectedCategory: 'high_priority' },
      { context: 'Building social rapport', expectedCategory: 'social' },
      { context: 'Artistic performance moment', expectedCategory: 'performance' }
    ];

    for (const scenario of scenarios) {
      const startTime = performance.now();
      const selectedAction = await selectActionWithCategories(scenario.context);
      const withCategoriesTime = performance.now() - startTime;

      const startTime2 = performance.now();
      const selectedAction2 = await selectActionFlat(scenario.context);
      const flatTime = performance.now() - startTime2;

      // Categorized should be faster
      expect(withCategoriesTime).toBeLessThan(flatTime);

      // Should select from correct category
      expect(selectedAction.category).toBe(scenario.expectedCategory);
    }
  });

  it('should improve contextual appropriateness', async () => {
    const testCases = [
      {
        context: 'Character is in combat',
        appropriateCategories: ['conflict', 'positioning'],
        inappropriateCategories: ['performance', 'social']
      },
      {
        context: 'Character is performing at tavern',
        appropriateCategories: ['performance', 'social'],
        inappropriateCategories: ['conflict', 'equipment']
      }
    ];

    for (const testCase of testCases) {
      const selections = await generateMultipleSelections(testCase.context, 10);
      const categories = selections.map(s => s.category);

      // Should favor appropriate categories
      testCase.appropriateCategories.forEach(cat => {
        const count = categories.filter(c => c === cat).length;
        expect(count).toBeGreaterThan(0);
      });

      // Should avoid inappropriate categories
      testCase.inappropriateCategories.forEach(cat => {
        const count = categories.filter(c => c === cat).length;
        expect(count).toBe(0);
      });
    }
  });
});
```

### Unit Tests
- [ ] Test action categorization logic
- [ ] Test category formatting
- [ ] Test action count per category
- [ ] Test high-priority flagging

### Integration Tests
- [ ] Test full action list categorization
- [ ] Verify all actions assigned to categories
- [ ] Test formatted output structure

### E2E Tests
- [ ] Measure action selection time (categorized vs flat)
- [ ] Test contextual appropriateness of selections
- [ ] Verify category hints guide correct choices

## Dependencies

- **Blocks:** None
- **Blocked By:** None
- **Related:**
  - LLMROLPROARCANA-001 (Restructure Information Hierarchy) - for proper section placement

## Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Action selection time | Unknown | -15% | Performance testing |
| Contextual appropriateness | Unknown | >85% | Scenario-based validation |
| Category distribution | Flat list | 7 categories | Structure verification |
| Selection guidance | None | Full hints | Content audit |
| User satisfaction | Unknown | >8/10 | Human evaluation |

## Rollback Plan

If categorization confuses LLM:
1. Simplify to 4-5 broader categories
2. Remove detailed hints, keep basic descriptions
3. Maintain high-priority section regardless

## Implementation Notes

### Categorization Principles

1. **Semantic Grouping**
   - Group by purpose/intent, not technical implementation
   - Example: "Social Actions" not "Speech Actions"

2. **Contextual Guidance**
   - Provide hints about WHEN to consider category
   - Connect categories to character state (goals, emotions, situation)

3. **Progressive Disclosure**
   - High-priority actions shown first (always relevant)
   - Then categorized by situation type
   - Maintains ability to browse all 81 if needed

4. **Decision Support**
   - Selection guidance walks through decision process
   - Common patterns help match situation to category
   - Emphasizes character-driven selection (goals, emotions)

### Category Design Rationale

**High-Priority (3 actions):**
- Always valid, universally applicable
- Shown first for immediate access

**By Category (78 actions in 6 categories):**
- Average: 13 actions per category
- More manageable than 81-item flat list
- Each category has clear purpose and context

## References

- Report Section 4.3: "Available Actions Presentation"
- Report Section 7.2: "Recommendation 5 - Enhance Action Categorization"
