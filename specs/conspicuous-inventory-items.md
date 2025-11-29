# Conspicuous Inventory Items

## Context
Currently, LLM-based characters are unaware of items other characters are carrying unless they are being wielded or worn. This creates a gap in the narrative where conspicuous items (e.g., a large weapon on a belt, a glowing artifact) should be visible but aren't reported to the LLM.

## Goal
Add an "Inventory: " section to the character description generated for LLMs. This section will list items in the character's inventory that are marked as `conspicuous`.

## Implementation Details

### 1. New Component
*   **Name:** `conspicuous.component.json`
*   **Location:** `data/mods/core/components/`
*   **Type:** Marker component (no data required).

### 2. Description Generation
*   **Logic:** Modify the description generation service (likely `equipmentDescriptionService` or `anatomyFormattingService`) to:
    *   Iterate through the character's inventory.
    *   Filter items that have the `conspicuous` component.
    *   If any such items exist, append an "Inventory: " section between "Wearing: " and "Activity: ".
    *   Format: "Inventory: item name, item name."

### 3. Action Updates
*   The following actions must trigger description regeneration (`regenerateDescriptionHandler`) to ensure the "Inventory: " list is up-to-date when items are moved:
    *   `drop_item`
    *   `drop_wielded_item`
    *   `give_item`
    *   `pick_up_item`
    *   `put_in_container`
    *   `take_from_container`

### 4. Entity Updates
*   Add the `conspicuous` component to the following items in `data/mods/fantasy/entities/definitions/`:
    *   `ale_tankard.entity.json`
    *   `rill_practice_stick.entity.json`
    *   `threadscar_melissa_longsword.entity.json`
    *   `vespera_hybrid_lute_viol.entity.json`
    *   `vespera_main_gauche.entity.json`
    *   `vespera_rapier.entity.json`

## Testing
*   Verify that characters with conspicuous items have the "Inventory: " line.
*   Verify that characters without conspicuous items do not have the line.
*   Verify that moving items (pick up, drop, give) updates the description.
