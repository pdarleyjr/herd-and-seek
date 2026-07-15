import { useEffect, useState } from "react";
import {
  readControlSettings,
  type ControlSettings,
} from "../game-engine/systems/ControlSettings";

export function useControlSettings(): ControlSettings {
  const [settings, setSettings] = useState(readControlSettings);
  useEffect(() => {
    const update = (event: Event) => setSettings((event as CustomEvent<ControlSettings>).detail ?? readControlSettings());
    const refresh = () => setSettings(readControlSettings());
    window.addEventListener("hs-control-settings", update);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hs-control-settings", update);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return settings;
}
