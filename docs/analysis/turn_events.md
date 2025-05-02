# Analysis Document: UI Event Dispatches (Ticket 5.1)

**Document Purpose:** To identify all direct dispatches of events prefixed with `textUI:` from core logic components (TurnManager, CommandProcessor, PlayerTurnHandler, AITurnHandler) using the Validated Event Dispatcher (`dispatchValidated`).

**Analysis Date:** 2025-05-02

---

## File: `src/core/turnManager.js`

* **Line Number:** ~163
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'System Error: No active actors found to start a round. Stopping.', type: 'error' }`)
* **Dispatch Context/Reason:** Error: No active entities with an Actor component were found when attempting to start a new round.

* **Line Number:** ~183
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'System Error: Failed to start a new round. Stopping. Details: [error message]', type: 'error' }`)
* **Dispatch Context/Reason:** Error: An exception was caught when `turnOrderService.startNewRound` was called, preventing a new round from starting.

* **Line Number:** ~198
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'Internal Error: Turn order inconsistency detected. Stopping manager.', type: 'error' }`)
* **Dispatch Context/Reason:** Error: Turn order inconsistency detected; `turnOrderService.getNextEntity()` returned null/undefined when the queue was expected to be non-empty.

* **Line Number:** ~226
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'Error during [player/ai]'s turn: [error message]. See console for details.', type: 'error' }`)
* **Dispatch Context/Reason:** Error: An exception was caught during the execution of the `handleTurn` method of the resolved turn handler (Player or AI).

---

## File: `src/core/commandProcessor.js`

* **Line Number:** ~222
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: [user-friendly parsing error message], type: 'error' }`)
* **Dispatch Context/Reason:** Error: The `ICommandParser` failed to parse the raw command string provided by the player. The event payload contains the parser's error message.

* **Line Number:** ~361
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'An internal error occurred while performing the action.', type: 'error' }`)
* **Dispatch Context/Reason:** Error: An exception was caught during the execution of `IActionExecutor.executeAction` for the parsed command. A generic error is shown to the user.

* **Line Number:** ~380
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error' }` (Example: `{ text: 'An unexpected internal error occurred. Please try again later or report the issue.', type: 'error' }`)
* **Dispatch Context/Reason:** Critical Error: An unexpected exception occurred during the higher-level command processing logic (e.g., context building, critical parser failure), outside of action execution itself.

---

## File: `src/core/handlers/playerTurnHandler.js`

* **Line Number:** ~207
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'warning', recipientEntityId?: string }` (Example: `{ text: 'Please enter a command.', type: 'warning', recipientEntityId: [actorId] }`)
* **Dispatch Context/Reason:** Warning: The player submitted an empty or invalid command string via the `command:submit` event.

* **Line Number:** ~241
* **Event Name:** `textUI:disable_input`
* **Payload Structure/Example:** `{ message?: string, entityId?: string }` (Example: `{ message: 'Processing...', entityId: [actorId] }`)
* **Dispatch Context/Reason:** UX: To prevent the player from entering further commands while the current one is being processed by `CommandProcessor`.

* **Line Number:** ~280
* **Event Name:** `textUI:display_message`
* **Payload Structure/Example:** `{ text: string, type: 'error', recipientEntityId?: string }` (Example: `{ text: 'An internal error occurred while processing your command: [error message]', type: 'error', recipientEntityId: [actorId] }`)
* **Dispatch Context/Reason:** Error: A critical exception occurred within the call to `commandProcessor.processCommand` or surrounding logic in `_processValidatedCommand`.

* **Line Number:** ~339
* **Event Name:** `textUI:update_available_actions`
* **Payload Structure/Example:** `{ actions: Array<ActionDefinition>, entityId?: string }` (Example: `{ actions: [/* ActionDefinition objects */], entityId: [actorId] }`)
* **Dispatch Context/Reason:** Update UI: To inform the UI about the valid actions the player can currently take, based on discovery results.

* **Line Number:** ~347
* **Event Name:** `textUI:update_available_actions`
* **Payload Structure/Example:** `{ actions: Array, entityId?: string }` (Example: `{ actions: [], entityId: [actorId] }`)
* **Dispatch Context/Reason:** Update UI: To clear the list of available actions in the UI as a fallback, because an error occurred during action discovery.

* **Line Number:** ~365
* **Event Name:** `textUI:enable_input`
* **Payload Structure/Example:** `{ placeholder?: string, entityId?: string }` (Example: `{ placeholder: 'Your turn. Enter command...', entityId: [actorId] }`)
* **Dispatch Context/Reason:** UX: To signal the UI that it should allow the player to enter a command (either at the start of their turn or after a non-turn-ending action).

---

## File: `src/core/handlers/aiTurnHandler.js`

* **No `textUI:` prefixed events were found to be dispatched from this file.**

---

**Analysis Summary:** The analysis confirms that `textUI:` events are dispatched from `TurnManager`, `CommandProcessor`, and `PlayerTurnHandler` primarily for error reporting, user feedback (warnings, prompts), and UI state updates (enabling/disabling input, updating action lists). As expected, `AITurnHandler` does not directly interact with the text UI via these events.