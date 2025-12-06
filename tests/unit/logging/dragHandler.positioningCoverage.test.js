import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import DragHandler from '../../../src/logging/dragHandler.js';

/**
 *
 * @param spy
 * @param eventName
 */
function getHandler(spy, eventName) {
  const call = [...spy.mock.calls]
    .reverse()
    .find(([name]) => name === eventName);
  return call && call[1];
}

describe('DragHandler positional coverage', () => {
  let container;
  let badge;
  let documentAddSpy;
  let elementAddSpy;
  let callbacks;
  let dragHandler;
  let logger;
  let rectState;
  let originalVibrate;

  beforeEach(() => {
    jest.useFakeTimers();

    rectState = { left: 240, top: 180, width: 200, height: 120 };

    container = document.createElement('div');
    container.className = 'lne-critical-log-notifier';
    container.setAttribute('data-position', 'top-right');
    container.style.position = 'fixed';
    container.style.left = `${rectState.left}px`;
    container.style.top = `${rectState.top}px`;

    const panel = document.createElement('div');
    panel.className = 'lne-log-panel';
    container.append(panel);

    badge = document.createElement('button');
    container.append(badge);
    document.body.append(container);

    container.getBoundingClientRect = jest.fn(() => {
      const parsedLeft = parseFloat(container.style.left);
      const parsedTop = parseFloat(container.style.top);
      const left = Number.isNaN(parsedLeft) ? rectState.left : parsedLeft;
      const top = Number.isNaN(parsedTop) ? rectState.top : parsedTop;
      rectState.left = left;
      rectState.top = top;
      return {
        left,
        top,
        width: rectState.width,
        height: rectState.height,
        right: left + rectState.width,
        bottom: top + rectState.height,
      };
    });

    callbacks = {
      onDragStart: jest.fn(),
      onDragEnd: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };

    originalVibrate = navigator.vibrate;
    navigator.vibrate = jest.fn();

    documentAddSpy = jest.spyOn(document, 'addEventListener');
    elementAddSpy = jest.spyOn(badge, 'addEventListener');

    dragHandler = new DragHandler({
      element: badge,
      container,
      callbacks,
      logger,
    });
    dragHandler.enable();
  });

  afterEach(() => {
    jest.useRealTimers();
    dragHandler.destroy();
    elementAddSpy.mockRestore();
    documentAddSpy.mockRestore();
    navigator.vibrate = originalVibrate;
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  /**
   *
   * @param startX
   * @param startY
   */
  function startDrag(startX, startY) {
    const mousedown = getHandler(elementAddSpy, 'mousedown');
    expect(mousedown).toBeDefined();
    mousedown({ clientX: startX, clientY: startY, preventDefault: jest.fn() });
    jest.advanceTimersByTime(501);
    expect(callbacks.onDragStart).toHaveBeenCalled();
    expect(container.classList.contains('dragging')).toBe(true);
  }

  it('snaps to top-left when released near edges and fires onDragEnd', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    expect(mousemove).toBeDefined();
    expect(mouseup).toBeDefined();

    mousemove({ clientX: 5, clientY: 10, preventDefault: jest.fn() });
    mouseup({ clientX: 5, clientY: 10, preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('top-left');
    expect(container.getAttribute('data-position')).toBe('top-left');
    expect(container.style.left).toBe('20px');
    expect(container.style.top).toBe('20px');
  });

  it('snaps to top-right when released near the right edge', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: window.innerWidth - 5,
      clientY: 30,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: window.innerWidth - 5,
      clientY: 30,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('top-right');
    expect(container.getAttribute('data-position')).toBe('top-right');
    expect(container.style.right).toBe('20px');
    expect(container.style.top).toBe('20px');
  });

  it('snaps to bottom-left when released near the bottom edge', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: 15,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: 15,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('bottom-left');
    expect(container.getAttribute('data-position')).toBe('bottom-left');
    expect(container.style.left).toBe('20px');
    expect(container.style.bottom).toBe('20px');
  });

  it('snaps to bottom-left via left edge when below vertical midpoint', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({ clientX: 5, clientY: 500, preventDefault: jest.fn() });
    mouseup({ clientX: 5, clientY: 500, preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenLastCalledWith('bottom-left');
    expect(container.getAttribute('data-position')).toBe('bottom-left');
  });

  it('snaps to bottom-left when bottom edge is closest away from side edges', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: 220,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: 220,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenLastCalledWith('bottom-left');
    expect(container.getAttribute('data-position')).toBe('bottom-left');
  });

  it('snaps to bottom-right when bottom edge is closest away from side edges', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: 700,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: 700,
      clientY: window.innerHeight - 10,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenLastCalledWith('bottom-right');
    expect(container.getAttribute('data-position')).toBe('bottom-right');
  });

  it('selects quadrant placement when not near edges', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({ clientX: 900, clientY: 600, preventDefault: jest.fn() });
    mouseup({ clientX: 900, clientY: 600, preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('bottom-right');
    expect(container.getAttribute('data-position')).toBe('bottom-right');
    expect(container.style.right).toBe('20px');
    expect(container.style.bottom).toBe('20px');
  });

  it('selects top-right quadrant when positioned in upper right non-edge area', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: window.innerWidth - 400,
      clientY: 150,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: window.innerWidth - 400,
      clientY: 150,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('top-right');
    expect(container.getAttribute('data-position')).toBe('top-right');
  });

  it('selects top-left quadrant when positioned in upper left non-edge area', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({ clientX: 220, clientY: 140, preventDefault: jest.fn() });
    mouseup({ clientX: 220, clientY: 140, preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('top-left');
    expect(container.getAttribute('data-position')).toBe('top-left');
  });

  it('selects bottom-left quadrant when positioned in lower left non-edge area', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: 150,
      clientY: window.innerHeight - 200,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: 150,
      clientY: window.innerHeight - 200,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenCalledWith('bottom-left');
    expect(container.getAttribute('data-position')).toBe('bottom-left');
  });

  it('falls back to original position when final position calculation fails', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({ clientX: 120, clientY: 140, preventDefault: jest.fn() });
    container.getBoundingClientRect = jest.fn(() => {
      throw new Error('layout failed');
    });
    mouseup({ clientX: 120, clientY: 140, preventDefault: jest.fn() });

    expect(logger.warn).toHaveBeenCalledWith(
      'Error calculating final position, using default',
      expect.any(Error)
    );
    expect(callbacks.onDragEnd).toHaveBeenCalledWith('top-right');
    expect(container.getAttribute('data-position')).toBe('top-right');
  });

  it('ignores mouse move events when drag not started', () => {
    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const initialLeft = container.style.left;
    const initialTop = container.style.top;
    const event = { clientX: 400, clientY: 400, preventDefault: jest.fn() };

    mousemove(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(container.style.left).toBe(initialLeft);
    expect(container.style.top).toBe(initialTop);
  });

  it('ignores mouse up events when drag not started', () => {
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    const event = { clientX: 320, clientY: 280, preventDefault: jest.fn() };

    mouseup(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(callbacks.onDragEnd).not.toHaveBeenCalled();
  });

  it('prevents context menu while dragging', () => {
    startDrag(260, 200);
    const contextMenu = getHandler(elementAddSpy, 'contextmenu');
    const event = { preventDefault: jest.fn() };
    expect(contextMenu(event)).toBe(false);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('allows context menu when idle', () => {
    const contextMenu = getHandler(elementAddSpy, 'contextmenu');
    const event = { preventDefault: jest.fn() };
    expect(contextMenu(event)).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores non-escape key presses', () => {
    const keydown = getHandler(documentAddSpy, 'keydown');
    const event = { key: 'Enter', preventDefault: jest.fn() };
    keydown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(container.classList.contains('dragging')).toBe(false);
  });

  it('cancels drag on Escape and restores pointer events', () => {
    startDrag(260, 200);
    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const keydown = getHandler(documentAddSpy, 'keydown');
    mousemove({ clientX: 420, clientY: 360, preventDefault: jest.fn() });
    keydown({ key: 'Escape', preventDefault: jest.fn() });

    expect(container.classList.contains('dragging')).toBe(false);
    const panel = container.querySelector('.lne-log-panel');
    expect(panel.style.pointerEvents).toBe('auto');
    expect(container.getAttribute('data-position')).toBe('top-right');
    expect(callbacks.onDragEnd).not.toHaveBeenCalled();
  });

  it('completes drag via touch events using stored coordinates', () => {
    const touchstart = getHandler(elementAddSpy, 'touchstart');
    expect(touchstart).toBeDefined();
    touchstart({
      touches: [{ clientX: 220, clientY: 210 }],
      preventDefault: jest.fn(),
    });
    jest.advanceTimersByTime(501);

    const touchmove = getHandler(documentAddSpy, 'touchmove');
    const touchend = getHandler(documentAddSpy, 'touchend');
    touchmove({
      touches: [{ clientX: 560, clientY: 480 }],
      preventDefault: jest.fn(),
    });
    touchend({ preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenCalled();
    expect(container.getAttribute('data-position')).toBeTruthy();
    expect(navigator.vibrate).toHaveBeenCalledWith(50);
  });

  it('updates position for single touch move while dragging', () => {
    startDrag(260, 200);

    const touchmove = getHandler(documentAddSpy, 'touchmove');
    const event = {
      touches: [{ clientX: 400, clientY: 420 }],
      preventDefault: jest.fn(),
    };

    touchmove(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(container.style.left).toBe('380px');
    expect(container.style.top).toBe('400px');
  });

  it('touchend without active drag does not prevent default', () => {
    const touchend = getHandler(documentAddSpy, 'touchend');
    const event = { preventDefault: jest.fn() };
    touchend(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores touch move events when drag not started', () => {
    const touchmove = getHandler(documentAddSpy, 'touchmove');
    const event = {
      touches: [{ clientX: 360, clientY: 360 }],
      preventDefault: jest.fn(),
    };

    touchmove(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does not vibrate when the navigator API is unavailable', () => {
    navigator.vibrate = undefined;
    const touchstart = getHandler(elementAddSpy, 'touchstart');
    const event = {
      touches: [{ clientX: 220, clientY: 210 }],
      preventDefault: jest.fn(),
    };

    touchstart(event);
    jest.advanceTimersByTime(501);

    expect(callbacks.onDragStart).toHaveBeenCalled();
  });

  it('does not start drag for multi-touch start gestures', () => {
    const touchstart = getHandler(elementAddSpy, 'touchstart');
    const event = {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 120, clientY: 120 },
      ],
      preventDefault: jest.fn(),
    };

    touchstart(event);
    jest.advanceTimersByTime(600);

    expect(callbacks.onDragStart).not.toHaveBeenCalled();
    expect(navigator.vibrate).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores multi-touch move updates once dragging', () => {
    startDrag(260, 200);

    const touchmove = getHandler(documentAddSpy, 'touchmove');
    const initialLeft = container.style.left;
    const initialTop = container.style.top;
    const moveEvent = {
      touches: [
        { clientX: 320, clientY: 310 },
        { clientX: 340, clientY: 330 },
      ],
      preventDefault: jest.fn(),
    };

    touchmove(moveEvent);

    expect(moveEvent.preventDefault).not.toHaveBeenCalled();
    expect(container.style.left).toBe(initialLeft);
    expect(container.style.top).toBe(initialTop);
  });

  it('snap calculation prefers top edge when closest', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({
      clientX: window.innerWidth / 2,
      clientY: 5,
      preventDefault: jest.fn(),
    });
    mouseup({
      clientX: window.innerWidth / 2,
      clientY: 5,
      preventDefault: jest.fn(),
    });

    expect(callbacks.onDragEnd).toHaveBeenLastCalledWith('top-right');
  });

  it('completes drag without callbacks or panel gracefully', () => {
    dragHandler.destroy();
    const panel = container.querySelector('.lne-log-panel');
    expect(panel).not.toBeNull();
    panel.remove();

    elementAddSpy.mockClear();
    documentAddSpy.mockClear();

    dragHandler = new DragHandler({
      element: badge,
      container,
      logger,
    });
    dragHandler.enable();

    const mousedown = getHandler(elementAddSpy, 'mousedown');
    expect(mousedown).toBeDefined();
    mousedown({ clientX: 260, clientY: 200, preventDefault: jest.fn() });
    jest.advanceTimersByTime(501);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');

    const moveEvent = { clientX: 520, clientY: 420, preventDefault: jest.fn() };
    const upEvent = { clientX: 520, clientY: 420, preventDefault: jest.fn() };

    mousemove(moveEvent);

    expect(() => mouseup(upEvent)).not.toThrow();
    expect(callbacks.onDragEnd).not.toHaveBeenCalled();
  });

  it('snaps to top-left when top edge is closest on the left side', () => {
    startDrag(260, 200);

    const mousemove = getHandler(documentAddSpy, 'mousemove');
    const mouseup = getHandler(documentAddSpy, 'mouseup');
    mousemove({ clientX: 300, clientY: 5, preventDefault: jest.fn() });
    mouseup({ clientX: 300, clientY: 5, preventDefault: jest.fn() });

    expect(callbacks.onDragEnd).toHaveBeenLastCalledWith('top-left');
    expect(container.getAttribute('data-position')).toBe('top-left');
  });

  it('ignores repeated enable/disable calls when state unchanged', () => {
    dragHandler.enable();
    dragHandler.disable();
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    dragHandler.disable();
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('does not re-register listeners when already enabled', () => {
    const addCallsBefore = documentAddSpy.mock.calls.length;
    dragHandler.enable();
    expect(documentAddSpy.mock.calls.length).toBe(addCallsBefore);
  });

  it('gracefully cancels drag when panel is missing', () => {
    const panel = container.querySelector('.lne-log-panel');
    expect(panel).not.toBeNull();
    panel.remove();

    startDrag(260, 200);
    const keydown = getHandler(documentAddSpy, 'keydown');
    keydown({ key: 'Escape', preventDefault: jest.fn() });

    expect(container.classList.contains('dragging')).toBe(false);
    expect(container.getAttribute('data-position')).toBe('top-right');
  });

  it('restores default position when original attribute is missing on cancel', () => {
    container.removeAttribute('data-position');

    startDrag(260, 200);
    const keydown = getHandler(documentAddSpy, 'keydown');
    keydown({ key: 'Escape', preventDefault: jest.fn() });

    expect(container.getAttribute('data-position')).toBe('top-right');
  });

  it('skips disable operations after destruction', () => {
    dragHandler.destroy();
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    dragHandler.disable();
    expect(removeSpy).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });
});
