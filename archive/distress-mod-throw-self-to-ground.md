# Spec: Distress Mod - Throw Self to Ground

## Objective
Add a new dramatic action "throw yourself to the ground in grief" to the `distress` mod. This action allows characters to physically express extreme grief by collapsing to the ground.

## Implementation Details

### 1. New Action
*   **File:** `data/mods/distress/actions/throw_self_to_ground.action.json`
*   **Template:** "throw yourself to the ground in grief"
*   **Constraints:**
    *   **Forbidden Components (Actor):**
        *   `positioning:fallen` (Cannot throw self if already fallen)
        *   `positioning:lying_down` (Cannot throw self if already lying down)
*   **Structure:** Follow the pattern of `data/mods/distress/actions/bury_face_in_hands.action.json`.

### 2. New Rule
*   **File:** `data/mods/distress/rules/throw_self_to_ground.rule.json` (or appropriate name within rules directory)
*   **Trigger:** The `distress:throw_self_to_ground` action.
*   **Effects:**
    *   **State Change:** Add the `positioning:fallen` component to the acting entity (similar to how `lie_down` adds `positioning:lying_down`).
    *   **Messages:**
        *   Perceptible Event: "{actor} throws themselves to the ground in grief."
        *   Successful Action: "{actor} throws themselves to the ground in grief."

## Testing Requirements

Create a comprehensive integration test suite in `tests/integration/mods/distress/throw_self_to_ground.test.js` (or similar).

### Test Coverage
1.  **Action Discoverability:**
    *   Verify the action is available when the actor is standing (not fallen/lying down).
    *   Verify the action is **not** available if the actor has `positioning:fallen`.
    *   Verify the action is **not** available if the actor has `positioning:lying_down`.
2.  **Rule Execution:**
    *   Perform the action.
    *   Verify the `positioning:fallen` component is added to the actor.
    *   Verify the correct event message is logged.

## References
*   **Existing Mod Action:** `data/mods/distress/actions/bury_face_in_hands.action.json`
*   **Reference Logic:** `data/mods/positioning/actions/lie_down.action.json` and its associated rule (for adding positioning components).
*   **Testing Docs:** `docs/testing/`
*   **Existing Tests:** `tests/integration/mods/`
