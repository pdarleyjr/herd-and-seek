import { useEffect, useState } from "react";

export interface ViewportInfo {
  width: number;
  height: number;
  isPortrait: boolean;
  isCompact: boolean;
}

function readViewportInfo(): ViewportInfo {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, isPortrait: true, isCompact: false };
  }

  const viewport = window.visualViewport;
  const width = Math.round(viewport?.width ?? window.innerWidth);
  const height = Math.round(viewport?.height ?? window.innerHeight);

  return {
    width,
    height,
    isPortrait: height >= width,
    // Compact layouts kick in on phones and tablets, especially landscape.
    isCompact: width < 1200 || height < 820,
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
