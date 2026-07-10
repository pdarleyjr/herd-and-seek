import { useEffect, useState } from "react";

export interface ViewportInfo {
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
  isCompact: boolean;
  isTouch: boolean;
  isCoarsePointer: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  layoutMode: "phone-portrait" | "phone-landscape" | "tablet-portrait" | "tablet-landscape" | "desktop";
  renderDprCap: number;
  syncIntervalMs: number;
}

function readViewportInfo(): ViewportInfo {
  if (typeof window === "undefined") {
    return {
      width: 0,
      height: 0,
      isPortrait: true,
      isLandscape: false,
      isCompact: false,
      isTouch: false,
      isCoarsePointer: false,
      isPhone: false,
      isTablet: false,
      isDesktop: false,
      layoutMode: "desktop",
      renderDprCap: 1,
      syncIntervalMs: 1000 / 30,
    };
  }

  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round(viewport?.height ?? window.innerHeight);
  const isPortrait = height >= width;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1200;
  const isDesktop = width >= 1200;
  const layoutMode = isDesktop
    ? "desktop"
    : isTablet
      ? (isPortrait ? "tablet-portrait" : "tablet-landscape")
      : (isPortrait ? "phone-portrait" : "phone-landscape");
  const renderDprCap = isDesktop
    ? 2
    : isTablet
      ? (layoutMode === "tablet-portrait" ? 1.6 : 1.4)
      : (layoutMode === "phone-portrait" ? 1.35 : 1.25);

  return {
    width,
    height,
    isPortrait,
    isLandscape: !isPortrait,
    // Compact layouts kick in on phones and tablets, especially landscape.
    isCompact: !isDesktop,
    isTouch,
    isCoarsePointer,
    isPhone,
    isTablet,
    isDesktop,
    layoutMode,
    renderDprCap,
    syncIntervalMs: isTouch ? (isPhone ? 1000 / 18 : 1000 / 20) : 1000 / 30,
  };
}

export function useViewportInfo(): ViewportInfo {
  const [viewport, setViewport] = useState(readViewportInfo);

  useEffect(() => {
    const update = () => setViewport(readViewportInfo());

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return viewport;
}
