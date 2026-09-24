/**
 * useHeadTracking.js
 *
 * React hook that wraps the HeadTracker service class.
 *
 * Preserves the original external API surface:
 *   { enabled, setEnabled, status, errorMsg, cursorPos, sensitivity, setSensitivity, recalibrate }
 *
 * Additionally exposes the full HeadTracker instance for advanced consumers.
 *
 * Key implementation decisions:
 *  - All per-frame data flows through refs and subscriptions — NOT React state — to
 *    avoid triggering the full React reconciler on every animation frame.
 *  - React state is only updated when UI-meaningful values change (status, errorMsg).
 *  - cursorPos is updated at most ~60fps via a ref-driven animation loop so the
 *    HeadTrackingCursor component can efficiently read it.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { HeadTracker } from "../services/HeadTracker";

// ── Module-level singleton tracker ───────────────────────────────────────────
// A single HeadTracker instance is shared for the lifetime of the app to avoid
// repeatedly tearing down and re-creating the MediaPipe WASM module.
let sharedTrackerInstance = null;
function getSharedTracker() {
  if (!sharedTrackerInstance) {
    sharedTrackerInstance = new HeadTracker();
  }
  return sharedTrackerInstance;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useHeadTracking() {
  const tracker = getSharedTracker();

  // ── UI state (updated sparingly to avoid frame-rate re-renders) ──
  const [enabled, setEnabledState] = useState(tracker.enabled);
  const [status, setStatus] = useState(tracker.status);
  const [errorMsg, setErrorMsg] = useState(tracker.errorMsg);
  const [cursorPos, setCursorPos] = useState(tracker.getState().cursorPos);
  const [sensitivity, setSensitivityState] = useState(tracker.sensitivity);
  const [calibrated, setCalibrated] = useState(tracker.calibrated);
  const [calibrationStep, setCalibrationStep] = useState(tracker.calibrationStep);
  const [locked, setLockedState] = useState(tracker.locked);
  const [lastUnlockReason, setLastUnlockReason] = useState(tracker.lastUnlockReason);

  // Refs for latest values without closure stale issues
  const statusRef = useRef(status);
  const enabledRef = useRef(enabled);

  // ── Subscribe to tracker state changes ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = tracker.subscribe((state) => {
      // Status and error: always sync to React
      if (state.status !== statusRef.current) {
        statusRef.current = state.status;
        setStatus(state.status);
      }
      if (state.errorMsg !== errorMsg) {
        setErrorMsg(state.errorMsg);
      }
      // Enabled state
      if (state.enabled !== enabledRef.current) {
        enabledRef.current = state.enabled;
        setEnabledState(state.enabled);
      }
      // Calibration & lock state
      setCalibrated(state.calibrated);
      setCalibrationStep(state.calibrationStep);
      setLockedState(state.locked);
      setLastUnlockReason(state.lastUnlockReason);

      // Cursor position (high-frequency — batched into a single state update)
      if (state.status === "active") {
        setCursorPos({ x: state.screenX, y: state.screenY });
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Public API ───────────────────────────────────────────────────────────

  const setEnabled = useCallback(
    (valueOrUpdater) => {
      const newEnabled =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(tracker.enabled)
          : valueOrUpdater;

      if (newEnabled) {
        tracker.start();
      } else {
        tracker.stop();
      }
      enabledRef.current = newEnabled;
      setEnabledState(newEnabled);
    },
    [tracker]
  );

  const setSensitivity = useCallback(
    (val) => {
      tracker.setSensitivity(val);
      setSensitivityState(tracker.sensitivity);
    },
    [tracker]
  );

  /**
   * Quick recalibration — resets the neutral anchor to current head position.
   * Used by the legacy recalibrate button in MotorDashboard/Settings.
   */
  const recalibrate = useCallback(() => {
    tracker.recalibrateNeutral();
  }, [tracker]);

  /**
   * Start the 5-step calibration flow
   */
  const startCalibration = useCallback(() => {
    tracker.startCalibration();
  }, [tracker]);

  /**
   * Record current head pose for the active calibration step
   */
  const recordCalibrationStep = useCallback(() => {
    tracker.recordCalibrationStep();
  }, [tracker]);

  /**
   * Reset calibration to factory defaults
   */
  const resetCalibration = useCallback(() => {
    tracker.resetCalibration();
    setCalibrated(false);
    setCalibrationStep(null);
  }, [tracker]);

  return {
    // ── Core state ──
    enabled,
    status,
    errorMsg,
    cursorPos,
    sensitivity,
    calibrated,
    calibrationStep,
    locked,
    lastUnlockReason,

    // ── Actions ──
    setEnabled,
    setSensitivity,
    recalibrate,
    startCalibration,
    recordCalibrationStep,
    resetCalibration,
    lockCursor: useCallback(() => tracker.lockCursor(), [tracker]),
    unlockCursor: useCallback((reason = "manual") => tracker.unlockCursor(reason), [tracker]),
    toggleCursorLock: useCallback(() => tracker.toggleCursorLock(), [tracker]),

    // ── Backward-compatible shim properties ──
    // Legacy consumers that destructure these will not crash:
    dwellProgress: 0,
    dwellTarget: null,
    dwellMs: 5000,
    setDwellMs: () => {},
    mouthClickEnabled: false,
    setMouthClickEnabled: () => {},
    scrollEnabled: false,
    setScrollEnabled: () => {},

    // ── Advanced consumers ──
    tracker, // Expose raw HeadTracker instance for tests / advanced usage
  };
}
