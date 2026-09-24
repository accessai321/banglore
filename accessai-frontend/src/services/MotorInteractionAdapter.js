/**
 * MotorInteractionAdapter.js
 *
 * Unified interaction adapter connecting virtual cursor / head tracking
 * to the platform's existing dwell activation and switch-scanning systems.
 * Avoids duplicate interaction engines by bridging cursor spatial coordinates
 * to existing DOM targets, dwell timers, and keyboard switch navigation.
 */

// Selector for focusable/switchable targets matching the platform convention
export const INTERACTIVE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  "[data-switchable]",
  '[tabindex="0"]',
].join(", ");

/**
 * Checks whether a single DOM node is interactive
 */
export function isInteractiveElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;

  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea") return true;
  if (tag === "a" && el.hasAttribute("href")) return true;

  const role = el.getAttribute("role");
  if (role === "button" || role === "link" || role === "menuitem") return true;

  if (el.hasAttribute("data-switchable")) return true;
  if (el.getAttribute("tabindex") === "0") return true;

  return false;
}

/**
 * Ascends from hit element to find the nearest interactive ancestor,
 * stopping at document body or boundary.
 */
export function findInteractiveAncestor(el) {
  let curr = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.hasAttribute && curr.hasAttribute("data-headtrack-cursor")) {
      return null;
    }
    if (isInteractiveElement(curr)) {
      return curr;
    }
    curr = curr.parentElement;
  }
  return null;
}

/**
 * Hit-tests spatial coordinates (x, y) against the DOM.
 * Temporarily disables pointer-events on the virtual cursor overlay to avoid self-blocking.
 *
 * @param {number} x - Viewport X coordinate in px
 * @param {number} y - Viewport Y coordinate in px
 * @param {object} [options]
 * @param {Function} [options.elementFromPoint] - Custom hit-test implementation (useful in JSDOM)
 * @returns {Element|null} The resolved interactive target or null
 */
export function detectTarget(x, y, options = {}) {
  const hitFn =
    options.elementFromPoint ||
    (typeof document !== "undefined" && document.elementFromPoint
      ? document.elementFromPoint.bind(document)
      : null);

  if (!hitFn) return null;

  // Temporarily bypass cursor overlay if present
  let overlay = null;
  if (typeof document !== "undefined") {
    overlay = document.querySelector("[data-headtrack-cursor]");
    if (overlay) overlay.style.pointerEvents = "none";
  }

  let rawEl = null;
  try {
    rawEl = hitFn(x, y);
  } finally {
    if (overlay) overlay.style.pointerEvents = "";
  }

  if (!rawEl) return null;
  return findInteractiveAncestor(rawEl);
}

/**
 * Retrieves all eligible switch-scanning focusable elements within a container
 */
export function getFocusableTargets(container = typeof document !== "undefined" ? document.body : null) {
  if (!container || !container.querySelectorAll) return [];
  const nodes = Array.from(container.querySelectorAll(INTERACTIVE_SELECTOR));
  return nodes.filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
      return false;
    }
    // Filter out explicitly hidden elements if style is set
    if (el.style && (el.style.display === "none" || el.style.visibility === "hidden")) {
      return false;
    }
    return true;
  });
}

/**
 * Switch Scanning: Moves focus forward
 */
export function scanNext(container, currentIndex = 0, onIndexChange = null) {
  const targets = getFocusableTargets(container);
  if (!targets.length) return 0;
  const nextIdx = (currentIndex + 1) % targets.length;
  if (onIndexChange) onIndexChange(nextIdx);
  if (targets[nextIdx] && targets[nextIdx].focus) {
    targets[nextIdx].focus();
  }
  return nextIdx;
}

/**
 * Switch Scanning: Moves focus backward
 */
export function scanPrev(container, currentIndex = 0, onIndexChange = null) {
  const targets = getFocusableTargets(container);
  if (!targets.length) return 0;
  const prevIdx = (currentIndex - 1 + targets.length) % targets.length;
  if (onIndexChange) onIndexChange(prevIdx);
  if (targets[prevIdx] && targets[prevIdx].focus) {
    targets[prevIdx].focus();
  }
  return prevIdx;
}

/**
 * Switch Scanning: Activates currently focused element
 */
export function activateFocused(container, currentIndex = 0) {
  const targets = getFocusableTargets(container);
  const target = targets[currentIndex];
  if (target) {
    if (target.click) target.click();
    return target;
  }
  return null;
}

/**
 * Intercepts keyboard switch scanning keys (Space / Tab / Enter)
 */
export function handleSwitchKeyDown(event, container, focusedIndex, setFocusedIndex) {
  if (!event) return;
  if (event.key === " " || event.key === "Tab") {
    event.preventDefault();
    scanNext(container, focusedIndex, setFocusedIndex);
  } else if (event.key === "Enter") {
    event.preventDefault();
    activateFocused(container, focusedIndex);
  }
}

/**
 * MotorInteractionAdapter Class
 * Orchestrates target detection, dwell timing, dwell cancellation, and activation.
 */
export class MotorInteractionAdapter {
  constructor(options = {}) {
    this.dwellDuration = options.dwellDuration || 1400;
    this.onActivate = options.onActivate || null;
    this.onDwellStart = options.onDwellStart || null;
    this.onDwellCancel = options.onDwellCancel || null;
    this.onDwellProgress = options.onDwellProgress || null;
    this.elementFromPoint = options.elementFromPoint || null;

    this.currentTarget = null;
    this.dwellStartTime = null;
    this.dwellTimer = null;
    this.progressInterval = null;
    this.progress = 0;
  }

  /**
   * Evaluates spatial coordinates, managing dwell start, progress, and cancellation.
   * Can interoperate with an existing React dwell engine or use internal state.
   */
  updateCursor(x, y, externalDwellEngine = null, onActivateCallback = null) {
    const target = detectTarget(x, y, { elementFromPoint: this.elementFromPoint });

    // 1. If target changed or no target under cursor
    if (target !== this.currentTarget) {
      if (this.currentTarget) {
        // Dwell cancellation
        this.cancelDwell(externalDwellEngine);
      }

      this.currentTarget = target;

      if (target) {
        // Dwell start
        this.startDwell(target, externalDwellEngine, onActivateCallback);
      }
    }

    return target;
  }

  /**
   * Starts dwell on a detected target
   */
  startDwell(target, externalDwellEngine = null, onActivateCallback = null) {
    if (!target) return;

    // Delegate to existing platform dwell engine if provided
    if (externalDwellEngine && externalDwellEngine.start) {
      const targetId = target.id || target.getAttribute("data-dwell-id") || target.tagName;
      externalDwellEngine.start(targetId, () => {
        this.activate(target, onActivateCallback);
      });
      if (this.onDwellStart) this.onDwellStart(target);
      return;
    }

    // Standalone / internal dwell lifecycle
    this.cancelDwell();
    this.currentTarget = target;
    this.dwellStartTime = Date.now();
    this.progress = 0;

    if (this.onDwellStart) this.onDwellStart(target);

    this.progressInterval = setInterval(() => {
      if (!this.dwellStartTime) return;
      const elapsed = Date.now() - this.dwellStartTime;
      this.progress = Math.min(100, (elapsed / this.dwellDuration) * 100);
      if (this.onDwellProgress) this.onDwellProgress(this.progress, target);
    }, 25);

    this.dwellTimer = setTimeout(() => {
      this.activate(target, onActivateCallback);
      this.cancelDwell();
    }, this.dwellDuration);
  }

  /**
   * Cancels any active dwell timer and resets progress
   */
  cancelDwell(externalDwellEngine = null) {
    if (externalDwellEngine && externalDwellEngine.cancel) {
      externalDwellEngine.cancel();
    }

    if (this.dwellTimer) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    const previousTarget = this.currentTarget;
    this.dwellStartTime = null;
    this.progress = 0;
    this.currentTarget = null;

    if (this.onDwellCancel && previousTarget) {
      this.onDwellCancel(previousTarget);
    }
  }

  /**
   * Activates target through click and focus
   */
  activate(target, callback = null) {
    if (!target) return;

    try {
      if (typeof target.click === "function") {
        target.click();
      }
      if (typeof target.focus === "function") {
        target.focus();
      }
    } catch (e) {
      // Ignore click/focus synthetic error
    }

    // Dispatch event
    if (typeof CustomEvent !== "undefined" && typeof target.dispatchEvent === "function") {
      target.dispatchEvent(
        new CustomEvent("motor-activated", {
          bubbles: true,
          detail: { target, timestamp: Date.now() },
        })
      );
    }

    if (callback) callback(target);
    if (this.onActivate) this.onActivate(target);
  }

  /**
   * Destroys all running timers
   */
  destroy() {
    this.cancelDwell();
  }
}
