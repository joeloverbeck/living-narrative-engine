// src/core/domRenderer.js

// --- Import Interfaces ---
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

/**
 * Implements the IGameRenderer contract using direct DOM manipulation.
 * Handles rendering messages, location details, controlling the input element's visual state,
 * updating the main title, managing the inventory UI panel, and rendering action buttons.
 * Subscribes itself to necessary UI events via the EventBus.
 * Uses ValidatedEventDispatcher for specific outgoing events requiring validation.
 */
class DomRenderer {
  /** @type {HTMLElement} */
  #outputDiv;
  /** @type {HTMLInputElement} */
  #inputElement;
  /** @type {HTMLHeadingElement} */
  #titleElement;
  /** @type {EventBus} */
  #eventBus;
  // --- EVENT-MIGR-018: Inject ValidatedEventDispatcher ---
  /** @type {ValidatedEventDispatcher} */
  #validatedDispatcher;
  // --- EVENT-MIGR-018: Inject ILogger ---
  /** @type {ILogger} */
  #logger;

  // --- Inventory UI Elements ---
  /** @type {HTMLElement | null} */
  #inventoryPanel = null;
  /** @type {HTMLElement | null} */
  #inventoryList = null;
  /** @type {boolean} */
  #isInventoryVisible = false;

  // --- Action Buttons Elements (FEAT-UI-ACTIONS-03) ---
  /** @type {HTMLElement | null} */ // AC1: Container Reference Property
  #actionButtonsContainer = null;

  /**
     * Creates an instance of DomRenderer.
     * @param {HTMLElement} outputDiv - The main element where game output is displayed.
     * @param {HTMLInputElement} inputElement - The input element for player commands.
     * @param {HTMLHeadingElement} titleElement - The H1 element for displaying titles/status.
     * @param {EventBus} eventBus - The application's event bus instance.
     * @param {ValidatedEventDispatcher} validatedDispatcher - Service for dispatching validated events.
     * @param {ILogger} logger - Service for logging messages.
     */
  constructor(outputDiv, inputElement, titleElement, eventBus, validatedDispatcher, logger) {
    // --- Constructor Validation ---
    if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
      throw new Error('DomRenderer requires a valid output HTMLElement.');
    }
    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      throw new Error('DomRenderer requires a valid HTMLInputElement.');
    }
    if (!titleElement || !(titleElement instanceof HTMLHeadingElement)) {
      throw new Error('DomRenderer requires a valid HTMLHeadingElement (H1).');
    }
    if (!eventBus || typeof eventBus.subscribe !== 'function' || typeof eventBus.dispatch !== 'function') {
      throw new Error('DomRenderer requires a valid EventBus instance.');
    }
    // --- EVENT-MIGR-018: Validate new dependencies ---
    if (!validatedDispatcher || typeof validatedDispatcher.dispatchValidated !== 'function') {
      throw new Error('DomRenderer requires a valid ValidatedEventDispatcher instance.'); // AC5
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
      throw new Error('DomRenderer requires a valid ILogger instance.'); // AC5
    }

    this.#outputDiv = outputDiv;
    this.#inputElement = inputElement;
    this.#titleElement = titleElement;
    this.#eventBus = eventBus;
    this.#validatedDispatcher = validatedDispatcher; // AC5
    this.#logger = logger; // AC5

    // --- Initialize Inventory UI ---
    this.#createInventoryPanel();

    // --- Initialize Action Buttons Container (FEAT-UI-ACTIONS-03) ---
    this.#actionButtonsContainer = document.getElementById('action-buttons-container');
    if (!this.#actionButtonsContainer) {
      this.#logger.error("DomRenderer Error: Could not find the required '#action-buttons-container' element in the DOM. Action buttons will not be rendered.");
    } else {
      this.#logger.info("DomRenderer: Found '#action-buttons-container'.");
    }

    // Subscribe to necessary events internally
    this.#subscribeToEvents();

    this.#logger.info('DomRenderer initialized, inventory panel created, action button container referenced, and subscribed to events.');
  }

  #createInventoryPanel() {
    this.#inventoryPanel = document.createElement('div');
    this.#inventoryPanel.id = 'inventory-panel';
    this.#inventoryPanel.classList.add('inventory-panel', 'hidden'); // Start hidden

    const header = document.createElement('h3');
    header.textContent = 'Inventory';
    this.#inventoryPanel.appendChild(header);

    this.#inventoryList = document.createElement('ul');
    this.#inventoryList.id = 'inventory-list';
    this.#inventoryPanel.appendChild(this.#inventoryList);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.onclick = () => this.toggleInventory(false); // Force hide
    this.#inventoryPanel.appendChild(closeButton);

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.#inventoryPanel);
    } else {
      this.#logger.warn('DomRenderer: Could not find #game-container to append inventory panel. Appending to body.');
      document.body.appendChild(this.#inventoryPanel);
    }
  }


  #subscribeToEvents() {
    // --- Standard UI Events ---
    this.#eventBus.subscribe('event:display_message', this.#handleMessageDisplay.bind(this));
    this.#eventBus.subscribe('event:command_echo', this.#handleCommandEcho.bind(this));
    this.#eventBus.subscribe('event:enable_input', this.#handleEnableInput.bind(this));
    this.#eventBus.subscribe('event:disable_input', this.#handleDisableInput.bind(this));
    this.#eventBus.subscribe('event:display_location', this.#handleDisplayLocation.bind(this));
    this.#eventBus.subscribe('set_title', this.#handleSetTitle.bind(this));

    // --- Inventory UI Events ---
    this.#eventBus.subscribe('event:render_inventory', this.#handleRenderInventory.bind(this));
    this.#eventBus.subscribe('event:toggle_inventory', () => this.toggleInventory());
    // EVENT-MIGR-018: 'ui:request_inventory_render' requires no validation (Line: 105 in ticket description, now in toggleInventory)

    // --- Action Buttons Events (FEAT-UI-ACTIONS-03) ---
    this.#eventBus.subscribe('event:update_available_actions', this.#handleUpdateActions.bind(this));

    this.#logger.info('DomRenderer event subscriptions complete (including action updates).');
  }

  // --- Private Event Handlers ---

  /** @private @param {{text: string, type?: string}} message */
  #handleMessageDisplay(message) {
    if (message && typeof message.text === 'string') {
      this.renderMessage(message.text, message.type || 'info');
    } else {
      this.#logger.warn('DomRenderer received "event:display_message" with invalid data:', message);
    }
  }

  /** @private @param {{command: string}} data */
  #handleCommandEcho(data) {
    if (data && typeof data.command === 'string') {
      this.renderMessage(`> ${data.command}`, 'command');
    } else {
      this.#logger.warn("DomRenderer received 'ui:command_echo' with invalid data:", data);
    }
  }

  /** @private @param {{placeholder: string}} data */
  #handleEnableInput(data) {
    if (data && typeof data.placeholder === 'string') {
      this.setInputState(true, data.placeholder);
    } else {
      this.#logger.warn("DomRenderer received 'event:enable_input' with invalid/missing data, using default placeholder:", data);
      this.setInputState(true, 'Enter command...');
    }
  }

  /** @private @param {{message?: string}} data */
  #handleDisableInput(data) {
    const message = (data && typeof data.message === 'string') ? data.message : 'Input disabled.';
    if (!data || typeof data.message !== 'string') {
      this.#logger.warn("DomRenderer received 'ui:disable_input' without specific message, using default:", data, ` -> "${message}"`);
    }
    this.setInputState(false, message);
  }

  /** @private @param {{text: string}} data */
  #handleSetTitle(data) {
    if (data && typeof data.text === 'string') {
      this.#titleElement.textContent = data.text;
    } else {
      this.#logger.warn("DomRenderer received 'set_title' with invalid data:", data);
    }
  }

  /** @private @param {InventoryRenderPayload} payload */
  #handleRenderInventory(payload) {
    if (!this.#inventoryList) {
      this.#logger.error('Inventory list element not found!');
      return;
    }
    if (!payload || !Array.isArray(payload.items)) {
      this.#logger.warn("DomRenderer received 'ui:render_inventory' with invalid data:", payload);
      this.#inventoryList.innerHTML = '<li>Error loading inventory.</li>';
      return;
    }
    this.#updateInventoryUI(payload.items);
  }

  /** @private @param {LocationDisplayPayload} locationData */
  #handleDisplayLocation(locationData) {
    if (locationData &&
            typeof locationData.name === 'string' &&
            typeof locationData.description === 'string' &&
            Array.isArray(locationData.exits) &&
            (!locationData.items || Array.isArray(locationData.items)) &&
            (!locationData.entities || Array.isArray(locationData.entities))
    ) {
      this.renderLocation(locationData);
    } else {
      this.#logger.warn("DomRenderer received '" + 'event:display_location' + "' event with invalid or incomplete data:", locationData);
      this.renderMessage('Error: Could not display location details due to invalid data format received.', 'error');
    }
  }

  // --- NEW: Handler for Action Buttons (FEAT-UI-ACTIONS-03) ---
  /** @private @param {UIUpdateActionsPayload} eventData */
  #handleUpdateActions(eventData) {
    if (!this.#actionButtonsContainer) {
      // Already logged in constructor if missing
      return;
    }
    this.#actionButtonsContainer.innerHTML = ''; // Clear existing buttons

    if (!eventData || !Array.isArray(eventData.actions)) {
      this.#logger.warn('DomRenderer received invalid "event:update_available_actions" payload:', eventData);
      return;
    }

    const actions = eventData.actions;
    if (actions.length === 0) {
      this.#logger.debug('DomRenderer: No actions received, clearing action buttons.');
      return;
    }

    actions.forEach(actionString => {
      try {
        if (typeof actionString !== 'string' || actionString.trim() === '') {
          this.#logger.warn(`DomRenderer: Skipping invalid action string: "${actionString}"`);
          return;
        }

        const button = document.createElement('button');
        button.textContent = actionString;
        button.classList.add('action-button');
        button.setAttribute('title', `Click to ${actionString}`);

        // --- EVENT-MIGR-018: Refactor click listener for validation ---
        button.addEventListener('click', async () => { // Make listener async
          const commandToSubmit = button.textContent; // Or actionString from the outer scope
          this.#logger.debug(`DomRenderer: Action button "${commandToSubmit}" clicked. Attempting validated dispatch...`);

          // AC1, AC2: Use ValidatedEventDispatcher for 'command:submit'
          // AC4: Implicitly uses EventDefinition/payloadSchema via dispatcher
          const dispatched = await this.#validatedDispatcher.dispatchValidated(
            'command:submit',
            {command: commandToSubmit}
          );

          // AC3: Failure handling (log, skip) is done *inside* dispatchValidated
          // Log the outcome of the dispatch attempt
          if (dispatched) {
            this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" dispatched successfully.`);
          } else {
            this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandToSubmit}" was NOT dispatched (validation failed or other error). See previous dispatcher logs.`); // Warning level as failure is significant
          }
        });

        this.#actionButtonsContainer.appendChild(button);

      } catch (error) {
        this.#logger.error(`DomRenderer: Error creating button for action "${actionString}":`, error);
      }
    });
  }


  // --- Public Rendering Methods ---

  /** @param {string} message, @param {string} [type='info'] */
  renderMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `message-${type}`);
    messageDiv.innerHTML = message;
    this.#outputDiv.appendChild(messageDiv);
    this.#outputDiv.scrollTop = this.#outputDiv.scrollHeight;
  }

  /**
     * Renders the location details based on the provided payload.
     * NOTE (Ticket 4.4): This method receives pre-processed data in `locationData`.
     * The system *generating* this payload (e.g., LookSystem, MovementSystem) needs to be refactored
     * to use `entityManager.getComponentData('core:name')` and `entityManager.getComponentData('core:description')`
     * (or the `getDisplayName`/`getDisplayDescription` helpers) to populate the `name`, `description`,
     * `items[].name`, and `entities[].name` fields before dispatching the 'event:display_location' event.
     * This renderer itself just displays the provided strings.
     *
     * @param {LocationDisplayPayload} locationData
     */
  renderLocation(locationData) {
    let outputHtml = '';
    // TICKET 4.4 NOTE: Uses locationData.name (assumed pre-fetched using core:name)
    outputHtml += `<h2 class="location__name">${locationData.name || 'Unnamed Location'}</h2>`;
    // TICKET 4.4 NOTE: Uses locationData.description (assumed pre-fetched using core:description)
    outputHtml += `<p class="location__description">${locationData.description || 'You see nothing remarkable.'}</p>`;

    if (locationData.items && locationData.items.length > 0) {
      // TICKET 4.4 NOTE: Uses item.name from payload (assumed pre-fetched using core:name)
      const itemNames = locationData.items.map(item => item.name || 'unnamed item').join(', ');
      outputHtml += `<p class="location__items">Items here: ${itemNames}</p>`;
    }
    if (locationData.entities && locationData.entities.length > 0) {
      // TICKET 4.4 NOTE: Uses entity.name from payload (assumed pre-fetched using core:name)
      const entityNames = locationData.entities.map(entity => entity.name || 'unnamed entity').join(', ');
      outputHtml += `<p class="location__entities">Others here: ${entityNames}</p>`;
    }
    if (locationData.exits && locationData.exits.length > 0) {
      // TICKET 4.4 NOTE: Uses exit.description from payload (likely pre-fetched using core:description or similar for connections)
      const exitDescriptions = locationData.exits.map(exit => exit.description || 'an exit').join('<br>  ');
      outputHtml += `<p class="location__exits">Exits:<br>  ${exitDescriptions}</p>`;
    } else {
      outputHtml += '<p class="location__exits">Exits: None</p>';
    }
    this.renderMessage(outputHtml, 'location');
  }

  clearOutput() {
    this.#outputDiv.innerHTML = '';
  }

  /** @param {boolean} enabled, @param {string} placeholderText */
  setInputState(enabled, placeholderText) {
    this.#inputElement.disabled = !enabled;
    this.#inputElement.placeholder = placeholderText;
  }

  /** @param {boolean} [forceState] */
  toggleInventory(forceState) {
    if (!this.#inventoryPanel) return;
    const shouldBeVisible = forceState === undefined ? !this.#isInventoryVisible : forceState;

    if (shouldBeVisible) {
      // EVENT-MIGR-018: 'ui:request_inventory_render' dispatch remains here.
      // As per ticket, Validation N/A (Empty Payload). Using direct EventBus.
      this.#eventBus.dispatch('ui:request_inventory_render', {}); // (Ticket Line 105)
      this.#inventoryPanel.classList.remove('hidden');
      this.#isInventoryVisible = true;
    } else {
      this.#inventoryPanel.classList.add('hidden');
      this.#isInventoryVisible = false;
    }
  }

  /**
     * Updates the inventory UI based on the provided item data payload.
     * NOTE (Ticket 4.4): This method receives pre-processed data in `itemsData`.
     * The system generating the `InventoryRenderPayload` (e.g., InventorySystem) needs to be refactored
     * to use `entityManager.getComponentData('core:name')` (or `getDisplayName`)
     * to populate the `name` field for each item in the payload before dispatching the 'event:render_inventory' event.
     *
     * @private
     * @param {ItemUIData[]} itemsData - Array of item data for UI rendering.
     */
  #updateInventoryUI(itemsData) {
    if (!this.#inventoryList) {
      this.#logger.error('DomRenderer: Cannot update inventory UI, list element is null.');
      return;
    }
    this.#inventoryList.innerHTML = '';

    if (itemsData.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.textContent = '(Empty)';
      emptyLi.classList.add('inventory-item-empty');
      this.#inventoryList.appendChild(emptyLi);
    } else {
      itemsData.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('inventory-item');
        li.dataset.itemId = item.id;

        const itemName = item.name || '(Unnamed Item)'; // TICKET 4.4 NOTE: Uses name from payload

        if (item.icon) {
          const img = document.createElement('img');
          img.src = item.icon;
          img.alt = itemName; // Use fetched name
          img.classList.add('inventory-item-icon');
          li.appendChild(img);
        } else {
          const iconPlaceholder = document.createElement('span');
          iconPlaceholder.classList.add('inventory-item-icon-placeholder');
          iconPlaceholder.textContent = '📦';
          li.appendChild(iconPlaceholder);
        }

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('inventory-item-name');
        nameSpan.textContent = itemName; // Use fetched name
        li.appendChild(nameSpan);

        const dropButton = document.createElement('button');
        dropButton.textContent = 'Drop';
        dropButton.classList.add('inventory-item-drop-button');
        dropButton.dataset.itemName = itemName; // Use fetched name for command context

        // --- EVENT-MIGR-018: Refactor click listener for validation ---
        dropButton.addEventListener('click', async (event) => { // Make listener async
          event.stopPropagation();
          const clickedButton = /** @type {HTMLButtonElement} */ (event.target);
          const parentLi = clickedButton.closest('li');
          if (!parentLi) {
            this.#logger.error('DomRenderer: Could not find parent <li> for drop button.');
            return;
          }
          const itemIdToDrop = parentLi.dataset.itemId;
          const itemNameToDrop = clickedButton.dataset.itemName; // Gets name from dataset (which came from payload)
          if (!itemIdToDrop || !itemNameToDrop) {
            this.#logger.error('DomRenderer: Drop button clicked, but missing item ID or name from dataset.');
            return;
          }

          const commandString = `drop ${itemNameToDrop}`; // Example: "drop Rusty Sword"
          this.#logger.debug(`DomRenderer: Inventory Drop button for "${itemNameToDrop}" clicked. Attempting validated dispatch...`);

          // AC1, AC2: Use ValidatedEventDispatcher for 'command:submit'
          // AC4: Implicitly uses EventDefinition/payloadSchema via dispatcher
          const dispatched = await this.#validatedDispatcher.dispatchValidated(
            'command:submit',
            {command: commandString}
          );

          // AC3: Failure handling (log, skip) is done *inside* dispatchValidated
          if (dispatched) {
            this.#logger.debug(`DomRenderer: Event 'command:submit' for "${commandString}" dispatched successfully.`);
            this.toggleInventory(false); // Close inventory on successful drop command dispatch
          } else {
            this.#logger.warn(`DomRenderer: Event 'command:submit' for "${commandString}" was NOT dispatched (validation failed or other error). See previous dispatcher logs.`);
          }
        });
        li.appendChild(dropButton);

        li.addEventListener('click', () => {
          const currentSelected = this.#inventoryList?.querySelector('.selected');
          if (currentSelected) {
            currentSelected.classList.remove('selected');
          }
          li.classList.add('selected');
          this.#logger.debug(`Selected item: ${itemName} (ID: ${item.id})`); // Use fetched name
        });

        this.#inventoryList.appendChild(li);
      });
    }
  }
}

export default DomRenderer;