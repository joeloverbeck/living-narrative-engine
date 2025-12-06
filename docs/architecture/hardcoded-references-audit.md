# Hardcoded Mod References - Complete Audit

**Generated:** 2025-11-15T10:21:28.486Z
**Scope:** Production source code in `src/`
**Methodology:** Automated scan using `scripts/audit-mod-references.js`
**Total Violations:** 290

---

## Summary Statistics

| Mod         | Total Refs | Critical | High  | Medium  | Registry Candidates | Plugin Candidates | Config Candidates |
| ----------- | ---------- | -------- | ----- | ------- | ------------------- | ----------------- | ----------------- |
| positioning | 98         | 63       | 2     | 33      | 63                  | 2                 | 33                |
| items       | 95         | 57       | 0     | 38      | 57                  | 0                 | 38                |
| affection   | 0          | 0        | 0     | 0       | 0                   | 0                 | 0                 |
| violence    | 0          | 0        | 0     | 0       | 0                   | 0                 | 0                 |
| clothing    | 97         | 37       | 0     | 60      | 37                  | 0                 | 60                |
| **TOTAL**   | **290**    | **157**  | **2** | **131** | **157**             | **2**             | **131**           |

---

## Positioning Mod References

### src/actions/scopes/unifiedScopeResolver.js

| Line | Snippet                                                  | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------- | -------- | -------------------- |
| 375  | `if (scopeName === 'positioning:available_furniture') {` | Medium   | Config               |
| 422  | `if (scopeName === 'positioning:available_furniture') {` | Medium   | Config               |
| 442  | `if (scopeName === 'positioning:available_furniture') {` | Medium   | Config               |

### src/actions/targetResolutionService.js

| Line | Snippet                                           | Severity | Refactoring Approach |
| ---- | ------------------------------------------------- | -------- | -------------------- | ------ | ------ |
| 128  | `actionId === 'positioning:sit_down'              |          | `                    | Medium | Config |
| 129  | `scopeName === 'positioning:available_furniture'` | Medium   | Config               |
| 162  | `actionId === 'positioning:sit_down'              |          | `                    | Medium | Config |
| 163  | `scopeName === 'positioning:available_furniture'` | Medium   | Config               |
| 179  | `actionId === 'positioning:sit_down'              |          | `                    | Medium | Config |
| 180  | `scopeName === 'positioning:available_furniture'` | Medium   | Config               |

### src/actions/validation/TargetRequiredComponentsValidator.js

| Line | Snippet                                                                                                  | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 46   | `*     actor: ["positioning:closeness"],`                                                                | Medium   | Config               |
| 47   | `*     primary: ["positioning:sitting_on", "positioning:closeness"]`                                     | Medium   | Config               |
| 51   | `*   primary: { id: "npc1", components: { "positioning:sitting_on": {}, "positioning:closeness": {} } }` | Medium   | Config               |

### src/anatomy/services/activityMetadataCollectionSystem.js

| Line | Snippet                                                                                     | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 161  | `* // Returns: [{ type: 'inline', sourceComponent: 'positioning:kneeling', ... }]`          | Critical | Registry             |
| 345  | `* // Returns: [{ type: 'dedicated', sourceComponent: 'positioning:kneeling', ... }] or []` | Critical | Registry             |

### src/anatomy/services/context/activityContextBuildingSystem.js

| Line | Snippet                                                                            | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------------- | -------- | -------------------- |
| 48   | `* Retrieves closeness relationships from the positioning:closeness component and` | Critical | Registry             |
| 87   | `* Queries the positioning:closeness component for the actor's partner list.`      | Critical | Registry             |
| 104  | `const closenessData = actorEntity?.getComponentData?.('positioning:closeness');`  | Critical | Registry             |

### src/entities/entityDefinition.js

| Line | Snippet                                                              | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------- | -------- | -------------------- |
| 80   | `hasAllowsSitting: 'positioning:allows_sitting' in this.components,` | Medium   | Config               |
| 81   | `allowsSittingData: this.components['positioning:allows_sitting'],`  | Medium   | Config               |

### src/entities/entityManager.js

| Line | Snippet                                                                                                 | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------------- | -------- | -------------------- | ------ | ------ |
| 545  | `if (componentTypeId === 'positioning:allows_sitting') {`                                               | Medium   | Config               |
| 547  | `\`[DEBUG] EntityManager.getEntitiesWithComponent('positioning:allows_sitting'): found ${result?.length |          | 0} entities\`,`      | Medium | Config |
| 554  | `'positioning:allows_sitting'`                                                                          | Medium   | Config               |

### src/entities/managers/EntityQueryManager.js

| Line | Snippet                                                                    | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------- | -------- | -------------------- |
| 202  | `if (componentTypeId === 'positioning:allows_sitting') {`                  | High     | Plugin               |
| 204  | `\`EntityQueryManager detailed search for 'positioning:allows_sitting'\`,` | High     | Plugin               |

### src/entities/services/entityRepositoryAdapter.js

| Line | Snippet                                                                    | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------- | -------- | -------------------- |
| 289  | `// Debug logging for positioning:allows_sitting component`                | Critical | Registry             |
| 290  | `if (componentType === 'positioning:allows_sitting') {`                    | Critical | Registry             |
| 292  | `\`[DEBUG] Indexed positioning:allows_sitting for entity '${entityId}'\`,` | Critical | Registry             |

### src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js

| Line | Snippet                                                              | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------- | -------- | -------------------- |
| 36   | `const CLOSENESS_COMPONENT_ID = 'positioning:closeness';`            | Critical | Registry             |
| 316  | `this.#dispatcher.dispatch('positioning:entity_exited_location', {`  | Critical | Registry             |
| 322  | `this.#dispatcher.dispatch('positioning:entity_entered_location', {` | Critical | Registry             |

### src/logic/operationHandlers/breakClosenessWithTargetHandler.js

| Line | Snippet                                                                      | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------- | -------- | -------------------- |
| 193  | `'positioning:closeness'`                                                    | Critical | Registry             |
| 197  | `'positioning:closeness'`                                                    | Critical | Registry             |
| 256  | `'positioning:closeness'`                                                    | Critical | Registry             |
| 265  | `await this.#entityManager.addComponent(actorId, 'positioning:closeness', {` | Critical | Registry             |
| 321  | `'positioning:closeness'`                                                    | Critical | Registry             |
| 332  | `'positioning:closeness',`                                                   | Critical | Registry             |
| 374  | `this.#dispatcher.dispatch('positioning:closeness_with_target_broken', {`    | Critical | Registry             |

### src/logic/operationHandlers/establishLyingClosenessHandler.js

| Line | Snippet                                                                  | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------ | -------- | -------------------- |
| 199  | `'positioning:allows_lying_on'`                                          | Critical | Registry             |
| 210  | `'positioning:closeness'`                                                | Critical | Registry             |
| 231  | `'positioning:lying_down'`                                               | Critical | Registry             |
| 247  | `'positioning:lying_down'`                                               | Critical | Registry             |
| 286  | `'positioning:closeness'`                                                | Critical | Registry             |
| 290  | `'positioning:closeness'`                                                | Critical | Registry             |
| 318  | `'positioning:closeness',`                                               | Critical | Registry             |
| 325  | `'positioning:closeness',`                                               | Critical | Registry             |
| 437  | `this.#dispatcher.dispatch('positioning:lying_closeness_established', {` | Critical | Registry             |

### src/logic/operationHandlers/establishSittingClosenessHandler.js

| Line | Snippet                                                                    | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------- | -------- | -------------------- |
| 201  | `'positioning:allows_sitting'`                                             | Critical | Registry             |
| 219  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 253  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 294  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 298  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 326  | `'positioning:closeness',`                                                 | Critical | Registry             |
| 333  | `'positioning:closeness',`                                                 | Critical | Registry             |
| 447  | `this.#dispatcher.dispatch('positioning:sitting_closeness_established', {` | Critical | Registry             |

### src/logic/operationHandlers/mergeClosenessCircleHandler.js

| Line | Snippet                                                                 | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------------- | -------- | -------------------- |
| 140  | `'positioning:closeness'`                                               | Critical | Registry             |
| 144  | `'positioning:closeness'`                                               | Critical | Registry             |
| 154  | `await this.#entityManager.addComponent(id, 'positioning:closeness', {` | Critical | Registry             |

### src/logic/operationHandlers/removeFromClosenessCircleHandler.js

| Line | Snippet                                                                    | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------- | -------- | -------------------- |
| 153  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 163  | `'positioning:closeness'`                                                  | Critical | Registry             |
| 169  | `await this.#entityManager.removeComponent(pid, 'positioning:closeness');` | Critical | Registry             |
| 172  | `await this.#entityManager.addComponent(pid, 'positioning:closeness', {`   | Critical | Registry             |
| 181  | `'positioning:closeness'`                                                  | Critical | Registry             |

### src/logic/operationHandlers/removeLyingClosenessHandler.js

| Line | Snippet                         | Severity | Refactoring Approach |
| ---- | ------------------------------- | -------- | -------------------- |
| 121  | `'positioning:closeness'`       | Critical | Registry             |
| 204  | `'positioning:closeness'`       | Critical | Registry             |
| 210  | `'positioning:closeness',`      | Critical | Registry             |
| 226  | `'positioning:closeness'`       | Critical | Registry             |
| 327  | `'positioning:allows_lying_on'` | Critical | Registry             |
| 349  | `'positioning:lying_down'`      | Critical | Registry             |
| 364  | `'positioning:lying_down'`      | Critical | Registry             |
| 399  | `'positioning:closeness'`       | Critical | Registry             |
| 424  | `'positioning:closeness'`       | Critical | Registry             |
| 479  | `'positioning:closeness'`       | Critical | Registry             |

### src/logic/operationHandlers/removeSittingClosenessHandler.js

| Line | Snippet                        | Severity | Refactoring Approach |
| ---- | ------------------------------ | -------- | -------------------- |
| 124  | `'positioning:allows_sitting'` | Critical | Registry             |
| 135  | `'positioning:closeness'`      | Critical | Registry             |
| 220  | `'positioning:closeness'`      | Critical | Registry             |
| 226  | `'positioning:closeness',`     | Critical | Registry             |
| 242  | `'positioning:closeness'`      | Critical | Registry             |
| 319  | `'positioning:allows_sitting'` | Critical | Registry             |
| 365  | `'positioning:closeness'`      | Critical | Registry             |
| 390  | `'positioning:closeness'`      | Critical | Registry             |
| 445  | `'positioning:closeness'`      | Critical | Registry             |

### src/logic/operators/base/BaseFurnitureOperator.js

| Line | Snippet                        | Severity | Refactoring Approach |
| ---- | ------------------------------ | -------- | -------------------- |
| 175  | `'positioning:sitting_on'`     | Medium   | Config               |
| 191  | `'positioning:allows_sitting'` | Medium   | Config               |

### src/logic/services/closenessCircleService.js

| Line | Snippet                                  | Severity | Refactoring Approach |
| ---- | ---------------------------------------- | -------- | -------------------- |
| 6    | `* @see positioning:closeness component` | Critical | Registry             |

### src/scopeDsl/nodes/stepResolver.js

| Line | Snippet                                                                             | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------------------------- | -------- | -------------------- |
| 128  | `hasCloseness: componentsObj ? ('positioning:closeness' in componentsObj) : false,` | Medium   | Config               |

### src/utils/componentStateValidator.js

| Line | Snippet                   | Severity | Refactoring Approach |
| ---- | ------------------------- | -------- | -------------------- |
| 212  | `'positioning:closeness'` | Medium   | Config               |
| 216  | `'positioning:closeness'` | Medium   | Config               |

### src/utils/stateConsistencyValidator.js

| Line | Snippet                        | Severity | Refactoring Approach |
| ---- | ------------------------------ | -------- | -------------------- |
| 49   | `'positioning:closeness'`      | Medium   | Config               |
| 56   | `'positioning:closeness'`      | Medium   | Config               |
| 70   | `'positioning:closeness'`      | Medium   | Config               |
| 120  | `'positioning:closeness'`      | Medium   | Config               |
| 124  | `'positioning:sitting_on'`     | Medium   | Config               |
| 157  | `'positioning:allows_sitting'` | Medium   | Config               |
| 164  | `'positioning:allows_sitting'` | Medium   | Config               |
| 174  | `'positioning:sitting_on'`     | Medium   | Config               |
| 320  | `'positioning:closeness'`      | Medium   | Config               |
| 328  | `'positioning:closeness',`     | Medium   | Config               |
| 371  | `'positioning:sitting_on',`    | Medium   | Config               |

## Items Mod References

### src/actions/pipeline/stages/TargetComponentValidationStage.js

| Line | Snippet                  | Severity | Refactoring Approach |
| ---- | ------------------------ | -------- | -------------------- |
| 236  | `items: validatedItems,` | Medium   | Config               |

### src/characterBuilder/CharacterBuilderBootstrap.js

| Line | Snippet                | Severity | Refactoring Approach |
| ---- | ---------------------- | -------- | -------------------- |
| 1226 | `align-items: center;` | Medium   | Config               |

### src/characterBuilder/models/cliche.js

| Line | Snippet         | Severity | Refactoring Approach |
| ---- | --------------- | -------- | -------------------- |
| 322  | `items: items,` | Medium   | Config               |

### src/characterBuilder/prompts/clicheGenerationPrompt.js

| Line | Snippet                                    | Severity | Refactoring Approach |
| ---- | ------------------------------------------ | -------- | -------------------- |
| 60   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 66   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 72   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 78   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 84   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 90   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 96   | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 102  | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 108  | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 114  | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 120  | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |
| 141  | `items: { type: 'string', minLength: 1 },` | Medium   | Config               |

### src/characterBuilder/prompts/coreMotivationsGenerationPrompt.js

| Line | Snippet    | Severity | Refactoring Approach |
| ---- | ---------- | -------- | -------------------- |
| 33   | `items: {` | Medium   | Config               |

### src/characterBuilder/prompts/speechPatternsPrompts.js

| Line | Snippet    | Severity | Refactoring Approach |
| ---- | ---------- | -------- | -------------------- |
| 47   | `items: {` | Medium   | Config               |

### src/characterBuilder/prompts/thematicDirectionsPrompt.js

| Line | Snippet    | Severity | Refactoring Approach |
| ---- | ---------- | -------- | -------------------- |
| 25   | `items: {` | Medium   | Config               |

### src/characterBuilder/prompts/traitsRewriterPrompts.js

| Line | Snippet    | Severity | Refactoring Approach |
| ---- | ---------- | -------- | -------------------- |
| 56   | `items: {` | Medium   | Config               |
| 64   | `items: {` | Medium   | Config               |

### src/characterBuilder/services/TraitsDisplayEnhancer.js

| Line | Snippet                         | Severity | Refactoring Approach |
| ---- | ------------------------------- | -------- | -------------------- |
| 393  | `items: expandStructured`       | Critical | Registry             |
| 422  | `items: expandStructured`       | Critical | Registry             |
| 440  | `items: traitsData.strengths,`  | Critical | Registry             |
| 452  | `items: traitsData.weaknesses,` | Critical | Registry             |
| 464  | `items: traitsData.likes,`      | Critical | Registry             |
| 476  | `items: traitsData.dislikes,`   | Critical | Registry             |
| 488  | `items: traitsData.fears,`      | Critical | Registry             |
| 514  | `items: traitsData.notes,`      | Critical | Registry             |
| 537  | `items: traitsData.secrets,`    | Critical | Registry             |

### src/clichesGenerator/services/ClicheExporter.js

| Line | Snippet                  | Severity | Refactoring Approach |
| ---- | ------------------------ | -------- | -------------------- |
| 111  | `items: category.items,` | Critical | Registry             |

### src/clichesGenerator/services/ClicheFilterService.js

| Line | Snippet                 | Severity | Refactoring Approach |
| ---- | ----------------------- | -------- | -------------------- |
| 39   | `items: filteredItems,` | Critical | Registry             |

### src/clothing/errors/clothingErrorHandler.js

| Line | Snippet                                                   | Severity | Refactoring Approach |
| ---- | --------------------------------------------------------- | -------- | -------------------- |
| 319  | `return { mode: 'legacy', items: [], accessible: true };` | Medium   | Config               |

### src/clothing/facades/IClothingSystemFacade.js

| Line | Snippet                                                                                   | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------------------------------- | -------- | -------------------- |
| 422  | `removed: result.previousItems ? [{ slot, entityId, items: result.previousItems }] : [],` | Medium   | Config               |

### src/clothing/services/equipmentDescriptionService.js

| Line | Snippet                                                                                                                        | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------- | -------- |
| 84   | `const { items: equippedItems, equippedData } =`                                                                               | Critical | Registry             |
| 118  | `\* @returns {Promise<{items: Array<{id: string, slotId: string, layerIndex: number, garmentId: string}>, equippedData: object | null}>}` | Critical             | Registry |
| 131  | `return { items: [], equippedData: null };`                                                                                    | Critical | Registry             |
| 140  | `return { items: [], equippedData };`                                                                                          | Critical | Registry             |
| 171  | `items: sortedItems,`                                                                                                          | Critical | Registry             |
| 179  | `return { items: [], equippedData: null };`                                                                                    | Critical | Registry             |

### src/config/errorHandling.config.js

| Line | Snippet                                              | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------- | -------- | -------------------- |
| 159  | `getAccessibility: { accessible: true, items: [] },` | Medium   | Config               |

### src/data/providers/availableActionsProvider.js

| Line | Snippet                                                                   | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------- | -------- | -------------------- |
| 34   | `'items:', // Any items component (portable, container, inventory, etc.)` | Medium   | Config               |

### src/domUI/AnatomyVisualizerUI.js

| Line | Snippet      | Severity | Refactoring Approach |
| ---- | ------------ | -------- | -------------------- |
| 587  | `items: [],` | Medium   | Config               |

### src/goap/refinement/refinementStateManager.js

| Line | Snippet                              | Severity | Refactoring Approach |
| ---- | ------------------------------------ | -------- | -------------------- |
| 50   | `*   actionId: 'items:pick_up_item'` | Medium   | Config               |
| 131  | `*   actionId: 'items:pick_up_item'` | Medium   | Config               |

### src/goap/refinement/steps/primitiveActionStepExecutor.js

| Line | Snippet                                                                               | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------- | -------- | -------------------- |
| 101  | `* @param {string} step.actionId - Namespaced action ID (e.g., 'items:pick_up_item')` | Medium   | Config               |

### src/logic/operationHandlers/drinkEntirelyHandler.js

| Line | Snippet                                                                    | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------- | -------- | -------------------- |
| 12   | `* 6. Dispatches items:liquid_consumed_entirely event`                     | Critical | Registry             |
| 29   | `const LIQUID_CONTAINER_COMPONENT_ID = 'items:liquid_container';`          | Critical | Registry             |
| 30   | `const DRINKABLE_COMPONENT_ID = 'items:drinkable';`                        | Critical | Registry             |
| 31   | `const EMPTY_COMPONENT_ID = 'items:empty';`                                | Critical | Registry             |
| 33   | `const LIQUID_CONSUMED_ENTIRELY_EVENT = 'items:liquid_consumed_entirely';` | Critical | Registry             |

### src/logic/operationHandlers/drinkFromHandler.js

| Line | Snippet                                                           | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------- | -------- | -------------------- |
| 12   | `* 6. Dispatches items:liquid_consumed event`                     | Critical | Registry             |
| 29   | `const LIQUID_CONTAINER_COMPONENT_ID = 'items:liquid_container';` | Critical | Registry             |
| 30   | `const DRINKABLE_COMPONENT_ID = 'items:drinkable';`               | Critical | Registry             |
| 31   | `const EMPTY_COMPONENT_ID = 'items:empty';`                       | Critical | Registry             |
| 33   | `const LIQUID_CONSUMED_EVENT = 'items:liquid_consumed';`          | Critical | Registry             |

### src/logic/operationHandlers/dropItemAtLocationHandler.js

| Line | Snippet                                                                                          | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------ | -------- | -------------------- |
| 11   | `* 5. Dispatches items:item_dropped event`                                                       | Critical | Registry             |
| 26   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`                                              | Critical | Registry             |
| 28   | `const ITEM_DROPPED_EVENT = 'items:item_dropped';`                                               | Critical | Registry             |
| 172  | `items: newInventoryItems,`                                                                      | Critical | Registry             |
| 208  | `const itemItemMarker = this.#entityManager.getComponentData(itemEntity, 'items:item');`         | Critical | Registry             |
| 209  | `const itemPortableMarker = this.#entityManager.getComponentData(itemEntity, 'items:portable');` | Critical | Registry             |

### src/logic/operationHandlers/openContainerHandler.js

| Line | Snippet                                                    | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------- | -------- | -------------------- |
| 27   | `const CONTAINER_OPENED_EVENT = 'items:container_opened';` | Critical | Registry             |
| 28   | `const OPENABLE_COMPONENT_ID = 'items:openable';`          | Critical | Registry             |
| 29   | `const CONTAINER_COMPONENT_ID = 'items:container';`        | Critical | Registry             |
| 30   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`        | Critical | Registry             |

### src/logic/operationHandlers/pickUpItemFromLocationHandler.js

| Line | Snippet                                                | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------ | -------- | -------------------- |
| 11   | `* 5. Dispatches items:item_picked_up event`           | Critical | Registry             |
| 26   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`    | Critical | Registry             |
| 28   | `const ITEM_PICKED_UP_EVENT = 'items:item_picked_up';` | Critical | Registry             |
| 124  | `items: [...inventory.items, itemEntity]`              | Critical | Registry             |

### src/logic/operationHandlers/putInContainerHandler.js

| Line | Snippet                                                    | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------- | -------- | -------------------- |
| 28   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`        | Critical | Registry             |
| 29   | `const CONTAINER_COMPONENT_ID = 'items:container';`        | Critical | Registry             |
| 30   | `const ITEM_PUT_EVENT = 'items:item_put_in_container';`    | Critical | Registry             |
| 253  | `items: inventoryItems.filter((id) => id !== itemEntity),` | Critical | Registry             |

### src/logic/operationHandlers/takeFromContainerHandler.js

| Line | Snippet                                                       | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------- | -------- | -------------------- |
| 27   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`           | Critical | Registry             |
| 28   | `const CONTAINER_COMPONENT_ID = 'items:container';`           | Critical | Registry             |
| 29   | `const ITEM_TAKEN_EVENT = 'items:item_taken_from_container';` | Critical | Registry             |
| 193  | `items: [...inventoryItems, itemEntity],`                     | Critical | Registry             |

### src/logic/operationHandlers/transferItemHandler.js

| Line | Snippet                                                         | Severity | Refactoring Approach |
| ---- | --------------------------------------------------------------- | -------- | -------------------- |
| 27   | `const INVENTORY_COMPONENT_ID = 'items:inventory';`             | Critical | Registry             |
| 28   | `const ITEM_TRANSFERRED_EVENT = 'items:item_transferred';`      | Critical | Registry             |
| 162  | `items: fromInventory.items.filter((id) => id !== itemEntity),` | Critical | Registry             |
| 170  | `items: [...toInventory.items, itemEntity],`                    | Critical | Registry             |

### src/logic/operationHandlers/validateContainerCapacityHandler.js

| Line | Snippet                                             | Severity | Refactoring Approach |
| ---- | --------------------------------------------------- | -------- | -------------------- |
| 28   | `const CONTAINER_COMPONENT_ID = 'items:container';` | Critical | Registry             |
| 29   | `const WEIGHT_COMPONENT_ID = 'items:weight';`       | Critical | Registry             |

### src/logic/operationHandlers/validateInventoryCapacityHandler.js

| Line | Snippet                                             | Severity | Refactoring Approach |
| ---- | --------------------------------------------------- | -------- | -------------------- |
| 28   | `const INVENTORY_COMPONENT_ID = 'items:inventory';` | Critical | Registry             |
| 29   | `const WEIGHT_COMPONENT_ID = 'items:weight';`       | Critical | Registry             |

### src/logic/operators/base/BaseEquipmentOperator.js

| Line | Snippet                                                                                | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------------------------- | -------- | -------------------- |
| 206  | `\`${this.operatorName}: hasItemsInSlot - Slot '${slotName}' has items: ${hasItems}\`` | Medium   | Config               |

### src/logic/operators/hasClothingInSlotLayerOperator.js

| Line | Snippet                                                                                                       | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 90   | `\`${this.operatorName}: Entity ${entityId} slot '${slotName}' layer '${layerName}' has items: ${hasItems}\`` | Medium   | Config               |

### src/logic/operators/hasClothingInSlotOperator.js

| Line | Snippet                                                                                  | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------------------- | -------- | -------------------- |
| 70   | `\`${this.operatorName}: Entity ${entityId} slot '${slotName}' has items: ${hasItems}\`` | Medium   | Config               |

### src/logic/operators/isSocketCoveredOperator.js

| Line | Snippet                                                                                                             | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 373  | `\`${this.operatorName}: hasItemsInSlotExcludingAccessories - Slot '${slotName}' has covering items: ${hasItems}\`` | Medium   | Config               |

### src/scopeDsl/nodes/filterResolver.js

| Line | Snippet                                                                      | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------- | -------- | -------------------- | ------ | ------ |
| 271  | `hasItemMarker: itemEntity?.componentTypeIds?.includes('items:item')         |          | false,`              | Medium | Config |
| 272  | `hasPortableMarker: itemEntity?.componentTypeIds?.includes('items:portable') |          | false,`              | Medium | Config |

### src/storage/indexedDBStorageAdapter.js

| Line | Snippet                                            | Severity | Refactoring Approach |
| ---- | -------------------------------------------------- | -------- | -------------------- | ------ | ------ |
| 430  | `\`Failed to count items: ${request.error?.message |          | 'Unknown error'}\``  | Medium | Config |

### src/thematicDirectionsManager/thematicDirectionsManagerMain.js

| Line | Snippet                | Severity | Refactoring Approach |
| ---- | ---------------------- | -------- | -------------------- |
| 138  | `align-items: center;` | Medium   | Config               |

### src/turns/schemas/llmOutputSchemas.js

| Line | Snippet    | Severity | Refactoring Approach |
| ---- | ---------- | -------- | -------------------- |
| 44   | `items: {` | Medium   | Config               |

### src/utils/safeDispatchErrorUtils.js

| Line | Snippet                                                      | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------ | -------- | -------------------- |
| 156  | `return rawDetails.length > 0 ? { items: rawDetails } : {};` | Medium   | Config               |

## Affection Mod References

_No references detected in current scan._

## Violence Mod References

_No references detected in current scan._

## Clothing Mod References

### src/actions/validation/prerequisiteDebugger.js

| Line | Snippet                                                                                        | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 250  | `const clothingData = this.#entityManager.getComponentData(entity.id, 'clothing:worn_items');` | Medium   | Config               |

### src/anatomy/workflows/stages/slotEntityCreationStage.js

| Line | Snippet                                                                                                                                                 | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 287  | `* Creates the clothing:slot_metadata component with socket coverage mappings`                                                                          | Medium   | Config               |
| 336  | `await entityManager.addComponent(entityId, 'clothing:slot_metadata', {`                                                                                | Medium   | Config               |
| 341  | `\`SlotEntityCreationStage: Created clothing:slot_metadata component with ${Object.keys(slotMappings).length} slot mappings for entity '${entityId}'\`` | Medium   | Config               |

### src/clothing/analysis/coverageAnalyzer.js

| Line | Snippet                       | Severity | Refactoring Approach |
| ---- | ----------------------------- | -------- | -------------------- |
| 98   | `'clothing:coverage_mapping'` | Medium   | Config               |

### src/clothing/facades/IClothingSystemFacade.js

| Line | Snippet                                                                                 | Severity | Refactoring Approach |
| ---- | --------------------------------------------------------------------------------------- | -------- | -------------------- |
| 93   | `const cacheKey = \`clothing:accessible:${entityId}:${JSON.stringify(queryOptions)}\`;` | Medium   | Config               |
| 129  | `const cacheKey = \`clothing:equipped:${entityId}\`;`                                   | Medium   | Config               |
| 165  | `const cacheKey = \`clothing:slot:${entityId}:${slot}\`;`                               | Medium   | Config               |
| 195  | `const cacheKey = \`clothing:compatibility:${entityId}:${itemId}:${slot}\`;`            | Medium   | Config               |
| 256  | `await this.invalidateCache(\`clothing:equipped:${entityId}\`);`                        | Medium   | Config               |
| 257  | `await this.invalidateCache(\`clothing:slot:${entityId}:${slot}\`);`                    | Medium   | Config               |
| 306  | `await this.invalidateCache(\`clothing:equipped:${entityId}\`);`                        | Medium   | Config               |
| 307  | `await this.invalidateCache(\`clothing:slot:${entityId}:\*\`, true);`                   | Medium   | Config               |
| 357  | `await this.invalidateCache(\`clothing:equipped:${entityId}\`);`                        | Medium   | Config               |
| 358  | `await this.invalidateCache(\`clothing:slot:${entityId}:\*\`, true);`                   | Medium   | Config               |
| 410  | `await this.invalidateCache(\`clothing:equipped:${entityId}\`);`                        | Medium   | Config               |
| 411  | `await this.invalidateCache(\`clothing:slot:${entityId}:${slot}\`);`                    | Medium   | Config               |
| 481  | `const cacheKey = \`clothing:blocked-slots:${entityId}\`;`                              | Medium   | Config               |
| 507  | `const cacheKey = \`clothing:layer-conflicts:${entityId}\`;`                            | Medium   | Config               |
| 736  | `await this.invalidateCache(\`clothing:equipped:${fromEntityId}\`);`                    | Medium   | Config               |
| 737  | `await this.invalidateCache(\`clothing:equipped:${toEntityId}\`);`                      | Medium   | Config               |

### src/clothing/orchestration/equipmentOrchestrator.js

| Line | Snippet                                                         | Severity | Refactoring Approach |
| ---- | --------------------------------------------------------------- | -------- | -------------------- |
| 90   | `'clothing:wearable'`                                           | Medium   | Config               |
| 146  | `await this.#eventDispatcher.dispatch('clothing:equipped', {`   | Medium   | Config               |
| 246  | `await this.#eventDispatcher.dispatch('clothing:unequipped', {` | Medium   | Config               |
| 312  | `'clothing:wearable'`                                           | Medium   | Config               |
| 377  | `'clothing:wearable'`                                           | Medium   | Config               |
| 459  | `'clothing:equipment'`                                          | Medium   | Config               |
| 479  | `'clothing:equipment',`                                         | Medium   | Config               |
| 508  | `'clothing:equipment'`                                          | Medium   | Config               |
| 540  | `'clothing:equipment',`                                         | Medium   | Config               |
| 566  | `'clothing:equipment'`                                          | Medium   | Config               |

### src/clothing/services/clothingAccessibilityService.js

| Line | Snippet                                                                                    | Severity | Refactoring Approach |
| ---- | ------------------------------------------------------------------------------------------ | -------- | -------------------- |
| 157  | `const equipment = this.#entityManager.getComponentData(entityId, 'clothing:equipment');`  | Critical | Registry             |
| 311  | `* Apply removal blocking based on clothing:blocks_removal component`                      | Critical | Registry             |
| 328  | `'clothing:wearable'`                                                                      | Critical | Registry             |
| 343  | `if (!this.#entityManager.hasComponent(equippedItem.itemId, 'clothing:blocks_removal')) {` | Critical | Registry             |
| 349  | `'clothing:blocks_removal'`                                                                | Critical | Registry             |
| 438  | `'clothing:coverage_mapping'`                                                              | Critical | Registry             |
| 630  | `* // Returns: ['clothing:shirt', 'clothing:pants']`                                       | Critical | Registry             |
| 786  | `* // Returns: 'clothing:jacket' or null`                                                  | Critical | Registry             |

### src/clothing/services/clothingInstantiationService.js

| Line | Snippet                                                                                   | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------------------------------- | -------- | -------------------- |
| 414  | `this.#eventBus.dispatch('clothing:instantiation_completed', {`                           | Critical | Registry             |
| 578  | `clothingInstance.getComponentData('clothing:wearable');`                                 | Critical | Registry             |
| 581  | `\`Clothing instance '${clothingInstanceId}' does not have clothing:wearable component\`` | Critical | Registry             |
| 666  | `const clothingComponent = definition.components?.['clothing:wearable'];`                 | Critical | Registry             |
| 689  | `if (!finalProperties['clothing:wearable']) {`                                            | Critical | Registry             |
| 690  | `finalProperties['clothing:wearable'] = {};`                                              | Critical | Registry             |
| 692  | `finalProperties['clothing:wearable'].layer = layerResult.layer;`                         | Critical | Registry             |

### src/clothing/services/clothingManagementService.js

| Line | Snippet                | Severity | Refactoring Approach |
| ---- | ---------------------- | -------- | -------------------- |
| 244  | `'clothing:equipment'` | Critical | Registry             |

### src/clothing/services/equipmentDescriptionService.js

| Line | Snippet                                            | Severity | Refactoring Approach |
| ---- | -------------------------------------------------- | -------- | -------------------- |
| 28   | `'clothing:wearable',`                             | Critical | Registry             |
| 224  | `jacket_clothing: 'outerwear',`                    | Critical | Registry             |
| 225  | `coat_clothing: 'outerwear',`                      | Critical | Registry             |
| 228  | `torso_clothing: 'tops',`                          | Critical | Registry             |
| 229  | `shirt_clothing: 'tops',`                          | Critical | Registry             |
| 232  | `legs_clothing: 'bottoms',`                        | Critical | Registry             |
| 233  | `pants_clothing: 'bottoms',`                       | Critical | Registry             |
| 234  | `skirt_clothing: 'bottoms',`                       | Critical | Registry             |
| 243  | `feet_clothing: 'footwear',`                       | Critical | Registry             |
| 244  | `shoes_clothing: 'footwear',`                      | Critical | Registry             |
| 248  | `belt_clothing: 'accessories',`                    | Critical | Registry             |
| 249  | `head_clothing: 'accessories',`                    | Critical | Registry             |
| 250  | `hands_clothing: 'accessories',`                   | Critical | Registry             |
| 251  | `neck_clothing: 'accessories',`                    | Critical | Registry             |
| 522  | `'clothing:slot_metadata'`                         | Critical | Registry             |
| 584  | `* via their clothing:coverage_mapping component.` | Critical | Registry             |
| 609  | `'clothing:coverage_mapping'`                      | Critical | Registry             |

### src/clothing/validation/layerCompatibilityService.js

| Line | Snippet                | Severity | Refactoring Approach |
| ---- | ---------------------- | -------- | -------------------- |
| 79   | `'clothing:equipment'` | Medium   | Config               |
| 88   | `'clothing:wearable'`  | Medium   | Config               |
| 216  | `'clothing:equipment'` | Medium   | Config               |

### src/config/errorHandling.config.js

| Line | Snippet       | Severity | Refactoring Approach |
| ---- | ------------- | -------- | -------------------- |
| 157  | `clothing: {` | Medium   | Config               |

### src/domUI/AnatomyVisualizerUI.js

| Line | Snippet                                                              | Severity | Refactoring Approach |
| ---- | -------------------------------------------------------------------- | -------- | -------------------- |
| 111  | `'clothing:equipped',`                                               | Medium   | Config               |
| 112  | `'clothing:unequipped',`                                             | Medium   | Config               |
| 113  | `'clothing:equipment_updated',`                                      | Medium   | Config               |
| 524  | `'clothing:equipment'`                                               | Medium   | Config               |
| 626  | `const wearableData = entity.getComponentData('clothing:wearable');` | Medium   | Config               |

### src/logic/operationHandlers/unequipClothingHandler.js

| Line | Snippet                                                                                 | Severity | Refactoring Approach |
| ---- | --------------------------------------------------------------------------------------- | -------- | -------------------- |
| 9    | `* 2. Verify entity has clothing:equipment component`                                   | Critical | Registry             |
| 135  | `if (!this.#entityManager.hasComponent(entityId, 'clothing:equipment')) {`              | Critical | Registry             |
| 137  | `\`UNEQUIP_CLOTHING: Entity "${entityId}" does not have clothing:equipment component\`` | Critical | Registry             |

### src/logic/operators/base/BaseEquipmentOperator.js

| Line | Snippet                | Severity | Refactoring Approach |
| ---- | ---------------------- | -------- | -------------------- |
| 150  | `'clothing:equipment'` | Medium   | Config               |

### src/logic/operators/hasClothingInSlotLayerOperator.js

| Line | Snippet                                                                            | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------------- | -------- | -------------------- |
| 77   | `\`${this.operatorName}: Entity ${entityId} has no clothing:equipment component\`` | Medium   | Config               |

### src/logic/operators/hasClothingInSlotOperator.js

| Line | Snippet                                                                            | Severity | Refactoring Approach |
| ---- | ---------------------------------------------------------------------------------- | -------- | -------------------- |
| 61   | `\`${this.operatorName}: Entity ${entityId} has no clothing:equipment component\`` | Medium   | Config               |

### src/logic/operators/isRemovalBlockedOperator.js

| Line | Snippet                     | Severity | Refactoring Approach |
| ---- | --------------------------- | -------- | -------------------- |
| 102  | `'clothing:wearable'`       | Medium   | Config               |
| 127  | `'clothing:blocks_removal'` | Medium   | Config               |
| 135  | `'clothing:blocks_removal'` | Medium   | Config               |

### src/logic/operators/isSocketCoveredOperator.js

| Line | Snippet                                                                                               | Severity | Refactoring Approach |
| ---- | ----------------------------------------------------------------------------------------------------- | -------- | -------------------- |
| 80   | `\`${this.operatorName}: Entity ${entityId} has no clothing:equipment component\``                    | Medium   | Config               |
| 86   | `traceData.reason = 'No clothing:equipment component';`                                               | Medium   | Config               |
| 98   | `\`${this.operatorName}: Entity ${entityId} has clothing:equipment but no equipped items structure\`` | Medium   | Config               |
| 104  | `traceData.reason = 'No equipped items structure in clothing:equipment';`                             | Medium   | Config               |
| 240  | `* Uses the clothing:slot_metadata component for dynamic lookup`                                      | Medium   | Config               |
| 261  | `'clothing:slot_metadata'`                                                                            | Medium   | Config               |
| 266  | `\`${this.operatorName}: Entity ${entityId} has no clothing:slot_metadata component\``                | Medium   | Config               |
| 278  | `\`${this.operatorName}: Entity ${entityId} has clothing:slot_metadata but no slotMappings\``         | Medium   | Config               |

### src/scopeDsl/engine.js

| Line | Snippet                  | Severity | Refactoring Approach |
| ---- | ------------------------ | -------- | -------------------- |
| 170  | `\`clothing:${itemId}\`` | Critical | Registry             |

### src/scopeDsl/nodes/clothingStepResolver.js

| Line | Snippet                        | Severity | Refactoring Approach |
| ---- | ------------------------------ | -------- | -------------------- |
| 32   | `topmost_clothing: 'topmost',` | Medium   | Config               |
| 34   | `all_clothing: 'all',`         | Medium   | Config               |
| 35   | `outer_clothing: 'outer',`     | Medium   | Config               |
| 36   | `base_clothing: 'base',`       | Medium   | Config               |
| 91   | `'clothing:equipment'`         | Medium   | Config               |

### src/scopeDsl/nodes/slotAccessResolver.js

| Line | Snippet                       | Severity | Refactoring Approach |
| ---- | ----------------------------- | -------- | -------------------- |
| 160  | `'clothing:coverage_mapping'` | Medium   | Config               |
