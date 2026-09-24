/**
 * MotorInteractionAdapter.test.js
 *
 * Focused test suite verifying:
 *  1. Target detection (DOM hierarchy, interactive semantics, disabled/overlay exclusions)
 *  2. Dwell cancellation (cursor leave, target switch, timer invalidation)
 *  3. Activation (click invocation, focus management, event dispatch)
 *  4. Switch scanning (target indexing, wrap-around navigation, key handling)
 */

import {
  isInteractiveElement,
  findInteractiveAncestor,
  detectTarget,
  getFocusableTargets,
  scanNext,
  scanPrev,
  activateFocused,
  handleSwitchKeyDown,
  MotorInteractionAdapter,
  INTERACTIVE_SELECTOR,
} from "./MotorInteractionAdapter";

describe("MotorInteractionAdapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // =========================================================================
  // 1. Target Detection
  // =========================================================================
  describe("Target Detection", () => {
    test("detects native interactive elements (button, input, select, textarea)", () => {
      const button = document.createElement("button");
      button.textContent = "Click Me";
      document.body.appendChild(button);

      expect(isInteractiveElement(button)).toBe(true);

      const input = document.createElement("input");
      expect(isInteractiveElement(input)).toBe(true);

      const select = document.createElement("select");
      expect(isInteractiveElement(select)).toBe(true);

      const textarea = document.createElement("textarea");
      expect(isInteractiveElement(textarea)).toBe(true);
    });

    test("detects anchor only if it has an href attribute", () => {
      const linkWithHref = document.createElement("a");
      linkWithHref.setAttribute("href", "#home");
      expect(isInteractiveElement(linkWithHref)).toBe(true);

      const linkWithoutHref = document.createElement("a");
      expect(isInteractiveElement(linkWithoutHref)).toBe(false);
    });

    test("detects elements with role='button', role='link', or data-switchable", () => {
      const roleBtn = document.createElement("div");
      roleBtn.setAttribute("role", "button");
      expect(isInteractiveElement(roleBtn)).toBe(true);

      const switchable = document.createElement("div");
      switchable.setAttribute("data-switchable", "true");
      expect(isInteractiveElement(switchable)).toBe(true);

      const tabIndexElem = document.createElement("div");
      tabIndexElem.setAttribute("tabindex", "0");
      expect(isInteractiveElement(tabIndexElem)).toBe(true);
    });

    test("excludes disabled elements and aria-disabled='true'", () => {
      const disabledBtn = document.createElement("button");
      disabledBtn.disabled = true;
      expect(isInteractiveElement(disabledBtn)).toBe(false);

      const ariaDisabledBtn = document.createElement("button");
      ariaDisabledBtn.setAttribute("aria-disabled", "true");
      expect(isInteractiveElement(ariaDisabledBtn)).toBe(false);
    });

    test("findInteractiveAncestor resolves nested child nodes to the parent interactive element", () => {
      const button = document.createElement("button");
      const icon = document.createElement("span");
      icon.className = "material-icons";
      icon.textContent = "play_arrow";
      const label = document.createElement("span");
      label.textContent = "Start Lesson";

      button.appendChild(icon);
      button.appendChild(label);
      document.body.appendChild(button);

      expect(findInteractiveAncestor(icon)).toBe(button);
      expect(findInteractiveAncestor(label)).toBe(button);
    });

    test("findInteractiveAncestor returns null for non-interactive elements and cursor overlays", () => {
      const container = document.createElement("div");
      const text = document.createElement("p");
      text.textContent = "Some informational paragraph";
      container.appendChild(text);
      document.body.appendChild(container);

      expect(findInteractiveAncestor(text)).toBeNull();

      // Virtual cursor overlay exclusion
      const cursorOverlay = document.createElement("div");
      cursorOverlay.setAttribute("data-headtrack-cursor", "true");
      const cursorChild = document.createElement("span");
      cursorOverlay.appendChild(cursorChild);
      document.body.appendChild(cursorOverlay);

      expect(findInteractiveAncestor(cursorChild)).toBeNull();
    });

    test("detectTarget hit-tests spatial coordinates correctly", () => {
      const button = document.createElement("button");
      button.id = "btn-course";
      document.body.appendChild(button);

      const customHitTest = (x, y) => {
        if (x === 150 && y === 200) return button;
        return document.body;
      };

      const found = detectTarget(150, 200, { elementFromPoint: customHitTest });
      expect(found).toBe(button);

      const missed = detectTarget(50, 50, { elementFromPoint: customHitTest });
      expect(missed).toBeNull();
    });
  });

  // =========================================================================
  // 2. Dwell Cancellation
  // =========================================================================
  describe("Dwell Cancellation", () => {
    test("cancels active dwell timer and resets progress when cursor moves away to empty space", () => {
      const button = document.createElement("button");
      document.body.appendChild(button);

      const onDwellCancel = jest.fn();
      const onActivate = jest.fn();

      const adapter = new MotorInteractionAdapter({
        dwellDuration: 1000,
        onDwellCancel,
        onActivate,
      });

      // Start dwell on button
      adapter.startDwell(button);
      expect(adapter.currentTarget).toBe(button);

      // Advance halfway
      jest.advanceTimersByTime(500);

      // Cancel dwell
      adapter.cancelDwell();

      expect(adapter.currentTarget).toBeNull();
      expect(adapter.progress).toBe(0);
      expect(onDwellCancel).toHaveBeenCalledWith(button);

      // Advance remaining time - ensure activation does NOT fire
      jest.advanceTimersByTime(600);
      expect(onActivate).not.toHaveBeenCalled();
    });

    test("cancels dwell when updateCursor moves away from target", () => {
      const btn1 = document.createElement("button");
      const btn2 = document.createElement("button");
      document.body.appendChild(btn1);
      document.body.appendChild(btn2);

      let currentHit = btn1;
      const adapter = new MotorInteractionAdapter({
        dwellDuration: 1000,
        elementFromPoint: () => currentHit,
      });

      // Cursor is on btn1
      adapter.updateCursor(100, 100);
      expect(adapter.currentTarget).toBe(btn1);

      // Move cursor off to background (null target)
      currentHit = document.body;
      adapter.updateCursor(0, 0);

      expect(adapter.currentTarget).toBeNull();
      expect(adapter.dwellTimer).toBeNull();
    });

    test("cancels previous target dwell and initiates new dwell when moving to a different target", () => {
      const btn1 = document.createElement("button");
      const btn2 = document.createElement("button");
      document.body.appendChild(btn1);
      document.body.appendChild(btn2);

      const onDwellCancel = jest.fn();
      const onDwellStart = jest.fn();

      let currentHit = btn1;
      const adapter = new MotorInteractionAdapter({
        dwellDuration: 1000,
        onDwellCancel,
        onDwellStart,
        elementFromPoint: () => currentHit,
      });

      adapter.updateCursor(100, 100);
      expect(onDwellStart).toHaveBeenCalledWith(btn1);

      jest.advanceTimersByTime(400);

      // Move to btn2
      currentHit = btn2;
      adapter.updateCursor(200, 200);

      expect(onDwellCancel).toHaveBeenCalledWith(btn1);
      expect(onDwellStart).toHaveBeenCalledWith(btn2);
      expect(adapter.currentTarget).toBe(btn2);
    });

    test("delegates cancellation to external dwell engine if provided", () => {
      const mockExternalEngine = {
        start: jest.fn(),
        cancel: jest.fn(),
      };

      const adapter = new MotorInteractionAdapter();
      adapter.cancelDwell(mockExternalEngine);

      expect(mockExternalEngine.cancel).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Activation
  // =========================================================================
  describe("Activation", () => {
    test("triggers click, focus, and custom event when dwell completes", () => {
      const button = document.createElement("button");
      button.click = jest.fn();
      button.focus = jest.fn();
      document.body.appendChild(button);

      const eventListener = jest.fn();
      button.addEventListener("motor-activated", eventListener);

      const onActivate = jest.fn();
      const adapter = new MotorInteractionAdapter({
        dwellDuration: 800,
        onActivate,
      });

      adapter.startDwell(button);

      // Fast-forward past dwell duration
      jest.advanceTimersByTime(850);

      expect(button.click).toHaveBeenCalled();
      expect(button.focus).toHaveBeenCalled();
      expect(onActivate).toHaveBeenCalledWith(button);
      expect(eventListener).toHaveBeenCalled();
      expect(adapter.currentTarget).toBeNull();
    });

    test("activate() invokes target click and optional inline callback", () => {
      const button = document.createElement("button");
      button.click = jest.fn();
      const inlineCallback = jest.fn();

      const adapter = new MotorInteractionAdapter();
      adapter.activate(button, inlineCallback);

      expect(button.click).toHaveBeenCalled();
      expect(inlineCallback).toHaveBeenCalledWith(button);
    });
  });

  // =========================================================================
  // 4. Scanning (Switch Navigation)
  // =========================================================================
  describe("Scanning (Switch Navigation)", () => {
    let container;
    let b1, b2, b3;

    beforeEach(() => {
      container = document.createElement("div");
      b1 = document.createElement("button");
      b1.id = "btn-1";
      b1.focus = jest.fn();
      b1.click = jest.fn();

      b2 = document.createElement("button");
      b2.id = "btn-2";
      b2.focus = jest.fn();
      b2.click = jest.fn();

      b3 = document.createElement("button");
      b3.id = "btn-3";
      b3.focus = jest.fn();
      b3.click = jest.fn();

      container.appendChild(b1);
      container.appendChild(b2);
      container.appendChild(b3);
      document.body.appendChild(container);
    });

    test("getFocusableTargets retrieves only active interactive elements", () => {
      const disabledBtn = document.createElement("button");
      disabledBtn.disabled = true;
      container.appendChild(disabledBtn);

      const targets = getFocusableTargets(container);
      expect(targets).toHaveLength(3);
      expect(targets).toEqual([b1, b2, b3]);
    });

    test("scanNext cycles focus forward and wraps around to 0", () => {
      const onIndexChange = jest.fn();

      let idx = scanNext(container, 0, onIndexChange);
      expect(idx).toBe(1);
      expect(b2.focus).toHaveBeenCalled();
      expect(onIndexChange).toHaveBeenCalledWith(1);

      idx = scanNext(container, 1, onIndexChange);
      expect(idx).toBe(2);
      expect(b3.focus).toHaveBeenCalled();

      // Wrap-around
      idx = scanNext(container, 2, onIndexChange);
      expect(idx).toBe(0);
      expect(b1.focus).toHaveBeenCalled();
    });

    test("scanPrev cycles focus backward and wraps around to last element", () => {
      const onIndexChange = jest.fn();

      // From 0 to last
      let idx = scanPrev(container, 0, onIndexChange);
      expect(idx).toBe(2);
      expect(b3.focus).toHaveBeenCalled();

      idx = scanPrev(container, 2, onIndexChange);
      expect(idx).toBe(1);
      expect(b2.focus).toHaveBeenCalled();
    });

    test("activateFocused clicks currently targeted element", () => {
      const activated = activateFocused(container, 1);
      expect(activated).toBe(b2);
      expect(b2.click).toHaveBeenCalled();
    });

    test("handleSwitchKeyDown processes Space, Tab, and Enter keys", () => {
      const setFocusedIndex = jest.fn();

      // Space key -> scan forward
      const spaceEvent = { key: " ", preventDefault: jest.fn() };
      handleSwitchKeyDown(spaceEvent, container, 0, setFocusedIndex);
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(setFocusedIndex).toHaveBeenCalledWith(1);

      // Tab key -> scan forward
      const tabEvent = { key: "Tab", preventDefault: jest.fn() };
      handleSwitchKeyDown(tabEvent, container, 1, setFocusedIndex);
      expect(tabEvent.preventDefault).toHaveBeenCalled();
      expect(setFocusedIndex).toHaveBeenCalledWith(2);

      // Enter key -> activate
      const enterEvent = { key: "Enter", preventDefault: jest.fn() };
      handleSwitchKeyDown(enterEvent, container, 2, setFocusedIndex);
      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(b3.click).toHaveBeenCalled();
    });
  });
});
