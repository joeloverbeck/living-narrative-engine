# Specification: Enhanced Action Information for LLM Prompts

## Overview

This specification defines enhancements to the available actions display for LLMs in game.html prompts. The enhancement adds contextual metadata (Purpose and Consider When) to action groups, helping LLMs make more informed action selections.

## Problem Statement

Currently, available actions are grouped by mod namespace (e.g., "POSITIONING Actions", "ITEMS Actions") but provide no context about:

- What the mod's actions accomplish narratively
- When the LLM should consider using these actions

This forces the LLM to infer purpose solely from individual action descriptions, potentially leading to suboptimal action choices.

## Desired Output Format

```xml
<available_actions>
  <!-- Consider your character's emotional state, goals, and recent events when selecting. -->

    ## POSITIONING ACTIONS (10 actions)
    **Purpose:** Spatial relationships and body positioning relative to others or furniture.
    **Consider when:** Proximity matters for interaction, relationship dynamics, tactical positioning.

    [Index: 4] Command: "get close to Registrar Copperplate" - Move closer to someone
    [Index: 5] Command: "step back from Registrar Copperplate" - Create distance from someone
    [Index: 6] Command: "sit down on bench" - Take a seat on available furniture
    ...

    ## ITEMS ACTIONS (16 actions)
    **Purpose:** Object manipulation, giving, taking, examining items.
    **Consider when:** Items are relevant to goals, need to inspect or exchange objects.

    [Index: 15] Command: "pick up book" - Take an item from location
    [Index: 16] Command: "give book to Registrar Copperplate" - Hand something to someone
    ...

  <selection_guidance>
    **Decision Process:**
    1. What does my character want right now? (Check current_goals)
    2. What just happened? (Review perception_log)
    3. What's my emotional state? (Consider internal tensions)
    4. Which category serves my current needs?
    5. Which specific action within that category fits best?
  </selection_guidance>
</available_actions>
```

---

## Schema Changes

### File: `data/schemas/mod-manifest.schema.json`

Add two new optional properties to the schema `properties` object:

```json
"actionPurpose": {
  "description": "Brief description of what kinds of actions this mod provides. Displayed in LLM prompts when actions are grouped by mod.",
  "type": "string",
  "minLength": 10,
  "maxLength": 200
},
"actionConsiderWhen": {
  "description": "Guidance for LLM on when to consider using actions from this mod. Displayed in LLM prompts when actions are grouped by mod.",
  "type": "string",
  "minLength": 10,
  "maxLength": 200
}
```

**Notes:**

- Both properties are optional (not added to `required` array)
- Length constraints ensure meaningful content without prompt bloat
- Placed at top level because they describe the mod's actions as a whole

---

## Architecture

### New Service: ModActionMetadataProvider

Create a dedicated service responsible for retrieving mod-level action metadata from manifests.

**Rationale for new service (vs. extending ActionCategorizationService):**

- Single Responsibility: ActionCategorizationService handles categorization logic only
- Testability: Each service testable in isolation
- Caching: Metadata lookups cached independently
- Follows existing DI patterns in codebase

#### Interface Definition

**File:** `src/interfaces/IModActionMetadataProvider.js` (conceptual - may use JSDoc typedef)

```javascript
/**
 * @typedef {object} ModActionMetadata
 * @property {string} modId - The mod identifier
 * @property {string|undefined} actionPurpose - Description of action purpose
 * @property {string|undefined} actionConsiderWhen - Guidance on when to use
 */

/**
 * @interface IModActionMetadataProvider
 * Provides mod-level metadata for action formatting in prompts.
 */
```

#### Service Implementation

**File:** `src/prompting/services/modActionMetadataProvider.js`

```javascript
class ModActionMetadataProvider {
  #dataRegistry;
  #logger;
  #cache;

  constructor({ dataRegistry, logger }) {
    // Validate dependencies
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Retrieves action metadata for a specific mod.
   * @param {string} modId - The mod identifier (namespace)
   * @returns {ModActionMetadata|null} Metadata or null if mod not found
   */
  getMetadataForMod(modId) {
    // 1. Validate input
    // 2. Check cache
    // 3. Retrieve manifest from dataRegistry.get('mod_manifests', modId)
    // 4. Extract actionPurpose and actionConsiderWhen
    // 5. Cache and return result
  }

  /**
   * Clears internal cache (for testing/manifest reload scenarios)
   */
  clearCache() {
    this.#cache.clear();
  }
}
```

### Dependency Injection

#### Token

**File:** `src/dependencyInjection/tokens/tokens-ai.js`

Add:

```javascript
IModActionMetadataProvider: 'IModActionMetadataProvider',
```

#### Registration

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

Add service registration:

```javascript
import { ModActionMetadataProvider } from '../../prompting/services/modActionMetadataProvider.js';

// Register new service
registrar.singletonFactory(tokens.IModActionMetadataProvider, (c) => {
  return new ModActionMetadataProvider({
    dataRegistry: c.resolve(tokens.IDataRegistry),
    logger: c.resolve(tokens.ILogger),
  });
});
```

Update AIPromptContentProvider registration to include new dependency:

```javascript
modActionMetadataProvider: c.resolve(tokens.IModActionMetadataProvider),
```

---

## Prompt Formatting Changes

### File: `src/prompting/AIPromptContentProvider.js`

#### Constructor Changes

1. Add private field: `#modActionMetadataProvider;`
2. Add to constructor parameters and validation
3. Store dependency

#### Method: `_formatCategorizedActions()`

Update the formatting loop (currently lines 686-698) to include metadata:

```javascript
for (const [namespace, namespaceActions] of grouped) {
  const displayName =
    this.#actionCategorizationService.formatNamespaceDisplayName(namespace);

  // NEW: Look up mod manifest for metadata
  const metadata = this.#modActionMetadataProvider.getMetadataForMod(namespace);

  // Format header with action count
  segments.push(
    `## ${displayName} ACTIONS (${namespaceActions.length} actions)`
  );

  // NEW: Add purpose if available
  if (metadata?.actionPurpose) {
    segments.push(`**Purpose:** ${metadata.actionPurpose}`);
  }

  // NEW: Add consider when if available
  if (metadata?.actionConsiderWhen) {
    segments.push(`**Consider when:** ${metadata.actionConsiderWhen}`);
  }

  // Add spacing after header metadata
  if (metadata?.actionPurpose || metadata?.actionConsiderWhen) {
    segments.push('');
  }

  for (const action of namespaceActions) {
    segments.push(this._formatSingleAction(action));
  }

  segments.push(''); // Empty line between sections
}
```

---

## Content Guidelines

### actionPurpose Guidelines

1. **Be concise**: One sentence, 10-25 words maximum
2. **Focus on narrative impact**: What do these actions accomplish in the story?
3. **Use active verbs**: "Express", "Enable", "Provide", "Perform"
4. **Avoid technical jargon**: Write for the LLM/player, not developers
5. **Describe the category**: Summarize the whole mod's action set, not individual actions

### actionConsiderWhen Guidelines

1. **Be contextual**: Describe situations, emotions, or narrative beats
2. **Use conditional language**: "When...", "If...", "During..."
3. **Focus on character motivation**: What would drive a character to use these?
4. **Include emotional/relational context**: Relationship state, mood, intent
5. **Keep to 15-40 words**: Enough context without being verbose

### Examples

#### positioning

```json
"actionPurpose": "Change body position, spatial relationships, and physical arrangement relative to others and furniture.",
"actionConsiderWhen": "Getting closer or farther from someone, changing posture (sitting, standing, lying, kneeling), or adjusting facing direction."
```

#### affection

```json
"actionPurpose": "Express caring, supportive physical contact that conveys warmth and comfort, from platonic to romantic gestures.",
"actionConsiderWhen": "Showing tenderness, providing comfort, expressing affection without overt romantic or sexual intent, or building emotional closeness."
```

#### items

```json
"actionPurpose": "Interact with objects through pickup, examination, use, storage, and transfer between characters and containers.",
"actionConsiderWhen": "Managing inventory, examining interesting objects, sharing items with others, storing belongings, or using functional items."
```

#### violence

```json
"actionPurpose": "Inflict physical harm through strikes, grabs, and lethal attacks.",
"actionConsiderWhen": "Combat, assault, self-defense, or when a character intends to cause physical pain or injury to another."
```

#### core

```json
"actionPurpose": "Pass time without taking significant action, allowing events to unfold.",
"actionConsiderWhen": "Choosing to observe rather than act, pausing to think, waiting for someone else to act first, or when no other action is appropriate."
```

---

## Mods Requiring Content

The following 29 mods have actions and should receive `actionPurpose` and `actionConsiderWhen` properties:

| Mod ID                  | Action Count | Category          |
| ----------------------- | ------------ | ----------------- |
| affection               | 20           | Physical intimacy |
| ballet                  | ~10          | Physical activity |
| caressing               | ~12          | Physical intimacy |
| clothing                | 2            | Utility           |
| companionship           | 3            | Social            |
| core                    | 1            | Fundamental       |
| distress                | 2            | Emotional         |
| exercise                | 1            | Physical activity |
| gymnastics              | 3            | Physical activity |
| hand-holding            | 5            | Physical intimacy |
| hugging                 | 4            | Physical intimacy |
| items                   | 16           | Utility           |
| kissing                 | ~16          | Physical intimacy |
| metabolism              | 3            | Survival          |
| movement                | 3            | Navigation        |
| music                   | ~17          | Performance       |
| physical-control        | 5            | Dominance         |
| positioning             | 24           | Spatial           |
| seduction               | 8            | Social/romantic   |
| sex-anal-penetration    | ~5           | Sexual            |
| sex-breastplay          | ~10          | Sexual            |
| sex-dry-intimacy        | ~6           | Sexual            |
| sex-penile-manual       | ~4           | Sexual            |
| sex-penile-oral         | ~24          | Sexual            |
| sex-physical-control    | ~3           | Sexual            |
| sex-vaginal-penetration | ~7           | Sexual            |
| vampirism               | 5            | Supernatural      |
| violence                | 5            | Combat            |
| weapons                 | 1            | Combat            |

### Mods WITHOUT Actions (No properties needed)

- activity, anatomy, descriptors, fantasy, furniture, isekai, patrol, sex-core

---

## Testing Requirements

### Unit Tests

**File:** `tests/unit/prompting/services/modActionMetadataProvider.test.js`

Test cases:

1. Returns metadata when manifest exists with both properties
2. Returns metadata with only `actionPurpose`
3. Returns metadata with only `actionConsiderWhen`
4. Returns null when manifest not found
5. Handles invalid modId gracefully (null, empty string, number)
6. Caches results correctly (same result on repeated calls)
7. `clearCache()` works correctly
8. Normalizes modId to lowercase for lookup

**File:** `tests/unit/prompting/AIPromptContentProvider.actionMetadata.test.js`

Test cases:

1. Includes purpose and consider when in formatted output
2. Handles missing metadata gracefully (no Purpose/Consider lines)
3. Handles partial metadata (only purpose OR only consider when)
4. Maintains backward compatibility when metadata provider returns null
5. Correct formatting with proper spacing

### Integration Tests

**File:** `tests/integration/prompting/actionFormattingWithMetadata.integration.test.js`

Test cases:

1. Full integration with real data registry and manifests
2. Verifies output format matches expected LLM prompt structure
3. Mixed scenario: some mods have metadata, others don't
4. Performance test with all mods loaded

---

## Implementation Order

### Phase 1: Foundation (~1 hour)

1. Update `mod-manifest.schema.json` with new properties
2. Create `ModActionMetadataProvider` service
3. Add DI token and registration

### Phase 2: Integration (~1 hour)

4. Update `AIPromptContentProvider` constructor
5. Update `_formatCategorizedActions()` method
6. Update AIPromptContentProvider DI registration

### Phase 3: Testing (~1.5 hours)

7. Create unit tests for ModActionMetadataProvider
8. Create/update unit tests for AIPromptContentProvider
9. Create integration tests

### Phase 4: Content (~30 minutes)

10. Add metadata to 5 key mods (positioning, items, affection, core, violence)
11. Remaining mods can be updated incrementally

---

## Backward Compatibility

- Schema properties are optional: existing manifests work unchanged
- Graceful degradation: if manifest not found or properties missing, output is unchanged
- No breaking changes to existing interfaces or behavior

---

## Performance Considerations

- Caching in `ModActionMetadataProvider` prevents repeated registry lookups
- Single lookup per namespace during formatting (manifests already in memory)
- Negligible overhead: ~1ms per formatted prompt

---

## Risks and Mitigations

| Risk                           | Mitigation                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| Namespace doesn't match mod ID | Registry uses normalized mod IDs; namespace extraction already tested |
| Long content bloats prompts    | Schema enforces 200 char max per property                             |
| Missing manifests cause errors | Graceful null return with fallback to current behavior                |

---

## Acceptance Criteria

1. [ ] Two new optional properties in mod-manifest schema
2. [ ] New `ModActionMetadataProvider` service with caching
3. [ ] `AIPromptContentProvider` displays Purpose/Consider when available
4. [ ] Graceful fallback when metadata not present
5. [ ] At least 5 mods have actionPurpose and actionConsiderWhen populated
6. [ ] Unit tests pass with >80% coverage on new code
7. [ ] Integration tests verify end-to-end formatting
8. [ ] No regression in existing prompt formatting behavior
