/**
 * useMotorInteractionAdapter.js
 *
 * React Hook providing a bridge between the virtual cursor coordinates,
 * the existing dwell engine, and switch scanning without creating duplicate
 * interaction loops.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MotorInteractionAdapter,
  detectTarget,
  scanNext,
  scanPrev,
  activateFocused,
} from "../services/MotorInteractionAdapter";

export function useMotorInteractionAdapter({
  cursorPos,
  enabled = true,
  dwellEngine = null,
  dwellDuration = 1400,
  onActivate = null,
  containerRef = null,
}) {
  const [currentTarget, setCurrentTarget] = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);

  const adapterRef = useRef(null);
  if (!adapterRef.current) {
    adapterRef.current = new MotorInteractionAdapter({
      dwellDuration,
      onDwellProgress: (progress, target) => {
        setDwellProgress(progress);
      },
      onDwellStart: (target) => {
        setCurrentTarget(target);
      },
      onDwellCancel: () => {
        setCurrentTarget(null);
        setDwellProgress(0);
      },
      onActivate: (target) => {
        if (onActivate) onActivate(target);
        setCurrentTarget(null);
        setDwellProgress(0);
      },
    });
  }

  // Update dwell duration if changed
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.dwellDuration = dwellDuration;
    }
  }, [dwellDuration]);

  // Connect cursor position updates to target detection and dwell
  useEffect(() => {
    if (!enabled || !cursorPos) {
      if (adapterRef.current) {
        adapterRef.current.cancelDwell(dwellEngine);
      }
      setCurrentTarget(null);
      setDwellProgress(0);
      return;
    }

    const target = adapterRef.current.updateCursor(
      cursorPos.x,
      cursorPos.y,
      dwellEngine,
      onActivate
    );

    if (!dwellEngine) {
      setCurrentTarget(target);
    }
  }, [cursorPos, enabled, dwellEngine, onActivate]);

  // Teardown
  useEffect(() => {
    return () => {
      if (adapterRef.current) {
        adapterRef.current.destroy();
      }
    };
  }, []);

  const handleScanNext = useCallback(
    (currentIndex, setIndex) => {
      const container = containerRef?.current || (typeof document !== "undefined" ? document.body : null);
      return scanNext(container, currentIndex, setIndex);
    },
    [containerRef]
  );

  const handleScanPrev = useCallback(
    (currentIndex, setIndex) => {
      const container = containerRef?.current || (typeof document !== "undefined" ? document.body : null);
      return scanPrev(container, currentIndex, setIndex);
    },
    [containerRef]
  );

  const handleActivateFocused = useCallback(
    (currentIndex) => {
      const container = containerRef?.current || (typeof document !== "undefined" ? document.body : null);
      return activateFocused(container, currentIndex);
    },
    [containerRef]
  );

  return {
    currentTarget,
    dwellProgress: dwellEngine ? dwellEngine.progress : dwellProgress,
    adapter: adapterRef.current,
    detectTarget,
    scanNext: handleScanNext,
    scanPrev: handleScanPrev,
    activateFocused: handleActivateFocused,
  };
}
