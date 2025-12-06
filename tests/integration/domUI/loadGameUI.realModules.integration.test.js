import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LoadGameUI from '../../../src/domUI/loadGameUI.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';

class TestLogger {
  constructor() {
    this.records = { debug: [], info: [], warn: [], error: [] };
  }

  debug(...args) {
    this.records.debug.push(args);
  }

  info(...args) {
    this.records.info.push(args);
  }

  warn(...args) {
    this.records.warn.push(args);
  }

  error(...args) {
    this.records.error.push(args);
  }
}

class TestValidatedEventDispatcher {
  constructor() {
    this.handlers = new Map();
  }

  dispatch(eventName, payload) {
    const listeners = this.handlers.get(eventName);
    if (listeners) {
      for (const handler of [...listeners]) {
        handler(payload);
      }
    }
    return true;
  }

  subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(handler);
    return () => {
      const list = this.handlers.get(eventName);
      if (!list) {
        return;
      }
      const idx = list.indexOf(handler);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    };
  }
}

class TestUserPrompt {
  constructor(responses = []) {
    this.responses = [...responses];
    this.prompts = [];
  }

  confirm(message) {
    this.prompts.push(message);
    if (this.responses.length === 0) {
      return true;
    }
    return this.responses.shift();
  }
}

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const createSlots = () => [
  {
    identifier: 'slot-a',
    saveName: 'Morning Save',
    timestamp: '2024-02-10T08:00:00.000Z',
    playtimeSeconds: 5400,
    isCorrupted: false,
  },
  {
    identifier: 'slot-b',
    saveName: 'Broken Save',
    timestamp: '2024-02-01T08:00:00.000Z',
    playtimeSeconds: 1200,
    isCorrupted: true,
  },
];

const setupDom = () => {
  document.body.innerHTML = `
    <button id="outside-focus" type="button">outside</button>
    <div id="load-game-screen" class="modal" style="display: none;">
      <div class="modal-content">
        <button id="cancel-load-button" type="button">Cancel</button>
        <div id="load-slots-container"></div>
        <button id="confirm-load-button" type="button">Load</button>
        <button id="delete-save-button" type="button">Delete</button>
        <div id="load-game-status-message" class="status-message-area"></div>
      </div>
    </div>
  `;
};

describe('LoadGameUI real-module integration', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  const createEnvironment = ({
    slots = createSlots(),
    listThrows = false,
    deleteResultFactory,
    userPrompt,
  } = {}) => {
    const logger = new TestLogger();
    const documentContext = new DocumentContext(document);
    const domElementFactory = new DomElementFactory(documentContext);
    const validatedEventDispatcher = new TestValidatedEventDispatcher();
    const prompt = userPrompt ?? new TestUserPrompt();

    let currentSlots = slots.map((slot) => ({ ...slot }));
    const saveLoadService = {
      listManualSaveSlots: async () => {
        if (listThrows) {
          throw new Error('listing failed');
        }
        return currentSlots.map((slot) => ({ ...slot }));
      },
      deleteManualSave: async (identifier) => {
        if (deleteResultFactory) {
          return deleteResultFactory({
            identifier,
            currentSlots,
            setSlots: (next) => {
              currentSlots = next.map((slot) => ({ ...slot }));
            },
          });
        }
        currentSlots = currentSlots.filter(
          (slot) => slot.identifier !== identifier
        );
        return { success: true, message: '' };
      },
    };

    const environment = {
      logger,
      documentContext,
      domElementFactory,
      validatedEventDispatcher,
      prompt,
      saveLoadService,
      get slots() {
        return currentSlots.map((slot) => ({ ...slot }));
      },
      set slots(next) {
        currentSlots = next.map((slot) => ({ ...slot }));
      },
    };

    const ui = new LoadGameUI({
      logger,
      documentContext,
      domElementFactory,
      saveLoadService,
      validatedEventDispatcher,
      userPrompt: prompt,
    });

    return { ui, environment };
  };

  it('enforces required dependencies during construction', () => {
    const logger = new TestLogger();
    const documentContext = new DocumentContext(document);
    const domElementFactory = new DomElementFactory(documentContext);
    const validatedEventDispatcher = new TestValidatedEventDispatcher();
    const userPrompt = new TestUserPrompt();

    expect(() => {
      // Missing saveLoadService methods should throw.
      // @ts-expect-error intentionally invalid
      new LoadGameUI({
        logger,
        documentContext,
        domElementFactory,
        saveLoadService: {},
        validatedEventDispatcher,
        userPrompt,
      });
    }).toThrow(/ISaveLoadService dependency is missing or invalid/i);

    expect(() => {
      // Missing userPrompt confirm should throw.
      // @ts-expect-error intentionally invalid
      new LoadGameUI({
        logger,
        documentContext,
        domElementFactory,
        saveLoadService: {
          listManualSaveSlots: async () => [],
          deleteManualSave: async () => ({ success: true, message: '' }),
        },
        validatedEventDispatcher,
        userPrompt: {},
      });
    }).toThrow(/IUserPrompt dependency is missing or invalid/i);
  });

  it('populates slot list, handles selection, and completes a successful load', async () => {
    const { ui, environment } = createEnvironment();
    const loadCalls = [];
    const loadService = {
      load: async (identifier) => {
        loadCalls.push(identifier);
        return { success: true };
      },
    };

    ui.init(loadService);
    ui.show();
    await flushAsync();

    const { confirmLoadButtonEl, deleteSaveButtonEl, listContainerElement } =
      ui.elements;
    expect(listContainerElement?.querySelectorAll('.save-slot').length).toBe(2);
    expect(confirmLoadButtonEl?.disabled).toBe(true);
    expect(deleteSaveButtonEl?.disabled).toBe(true);

    const firstSlot = listContainerElement?.querySelector('.save-slot');
    expect(firstSlot).not.toBeNull();
    firstSlot?.dispatchEvent(new Event('click', { bubbles: true }));
    await flushAsync();

    expect(ui.selectedSlotData?.identifier).toBe('slot-a');
    expect(confirmLoadButtonEl?.disabled).toBe(false);
    expect(deleteSaveButtonEl?.disabled).toBe(false);

    jest.useFakeTimers();
    confirmLoadButtonEl?.click();
    await flushAsync();
    expect(loadCalls).toEqual(['slot-a']);

    jest.runOnlyPendingTimers();
    await flushAsync();

    expect(ui.isVisible).toBe(false);
    expect(ui.currentSlotsDisplayData).toEqual([]);
    expect(
      environment.logger.records.debug.some((entry) =>
        entry[0]?.includes('Load slots list populated')
      )
    ).toBe(true);
    expect(ui.elements.statusMessageElement?.textContent).toContain(
      'loaded successfully'
    );
  });

  it('handles load precondition failures and load errors', async () => {
    const { ui, environment } = createEnvironment();
    ui.init(null);
    ui.show();
    await flushAsync();

    await ui._handleLoad();
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Please select a save slot to load.'
    );
    expect(environment.logger.records.warn.length).toBeGreaterThan(0);

    const listContainer = ui.elements.listContainerElement;
    const corruptedSlot = listContainer?.querySelector('.save-slot.corrupted');
    corruptedSlot?.dispatchEvent(new Event('click', { bubbles: true }));
    await flushAsync();

    await ui._handleLoad();
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Cannot load a corrupted save file. Please delete it or choose another.'
    );

    ui.loadService = null;
    ui.selectedSlotData = {
      ...ui.selectedSlotData,
      isCorrupted: false,
      identifier: 'slot-a',
      saveName: 'Morning Save',
    };

    await ui._handleLoad();
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Cannot load: Game engine is not ready.'
    );

    const loadCalls = [];
    ui.loadService = {
      load: async (identifier) => {
        loadCalls.push(identifier);
        return { success: false, error: 'Service rejected' };
      },
    };

    await ui._handleLoad();
    expect(loadCalls).toEqual(['slot-a']);
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Load failed: Service rejected'
    );
    expect(ui.elements.confirmLoadButtonEl?.disabled).toBe(false);

    ui.loadService = {
      load: async () => {
        throw new Error('Boom');
      },
    };

    await ui._handleLoad();
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Load failed: Boom'
    );
  });

  it('supports deletion workflow with confirmation and refresh logic', async () => {
    const userPrompt = new TestUserPrompt([false, true]);
    const { ui, environment } = createEnvironment({ userPrompt });
    ui.init({
      load: async () => ({ success: true }),
    });

    ui.show();
    await flushAsync();

    const listContainer = ui.elements.listContainerElement;
    const firstSlot = listContainer?.querySelector('.save-slot');
    firstSlot?.dispatchEvent(new Event('click', { bubbles: true }));
    await flushAsync();

    await ui._handleDelete();
    expect(
      environment.logger.records.debug.some((entry) =>
        entry[0]?.includes('Delete operation cancelled')
      )
    ).toBe(true);
    expect(userPrompt.prompts).toHaveLength(1);

    await ui._handleDelete();
    await flushAsync();
    expect(userPrompt.prompts).toHaveLength(2);
    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Save "Morning Save" deleted successfully.'
    );
    expect(ui.selectedSlotData).not.toBeNull();
    expect(document.activeElement?.classList.contains('save-slot')).toBe(true);
  });

  it('refreshes list after failed deletion and leaves selection cleared', async () => {
    const { ui } = createEnvironment({
      deleteResultFactory: () => ({ success: false, message: 'Not allowed' }),
    });
    ui.init({ load: async () => ({ success: true }) });
    ui.show();
    await flushAsync();

    const firstSlot =
      ui.elements.listContainerElement?.querySelector('.save-slot');
    firstSlot?.dispatchEvent(new Event('click', { bubbles: true }));
    await flushAsync();

    await ui._handleDelete();
    await flushAsync();

    expect(ui.elements.statusMessageElement?.textContent).toBe(
      'Delete failed: Not allowed'
    );
    expect(ui.selectedSlotData?.identifier).toBe('slot-a');
  });

  it('clears slot data on hide and dispose, and handles empty or failing slot fetches', async () => {
    const { ui } = createEnvironment();
    ui.init({ load: async () => ({ success: true }) });

    ui.show();
    await flushAsync();
    ui.hide();
    expect(ui.currentSlotsDisplayData).toEqual([]);
    expect(ui.elements.listContainerElement?.childElementCount).toBe(0);

    ui.dispose();
    expect(ui.loadService).toBeNull();

    const failingEnv = createEnvironment({ listThrows: true });
    failingEnv.ui.init({ load: async () => ({ success: true }) });
    failingEnv.ui.show();
    await flushAsync();
    expect(failingEnv.ui.elements.statusMessageElement?.textContent).toBe(
      'Error loading list of saved games.'
    );

    const emptyEnv = createEnvironment({ slots: [] });
    emptyEnv.ui.init({ load: async () => ({ success: true }) });
    emptyEnv.ui.show();
    await flushAsync();
    const emptyMessage =
      emptyEnv.ui.elements.listContainerElement?.textContent?.trim();
    expect(emptyMessage).toBe('No saved games found.');
  });

  it('gracefully handles rendering when domElementFactory is unavailable', () => {
    const { ui } = createEnvironment();
    ui.domElementFactory = null;
    const rendered = ui._renderLoadSlotItem(
      {
        identifier: 'slot-x',
        saveName: 'X',
        timestamp: '2023-01-01T00:00:00.000Z',
        playtimeSeconds: 0,
        isCorrupted: false,
      },
      0
    );
    expect(rendered).toBeNull();
  });
});
