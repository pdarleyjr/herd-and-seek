const PRODUCTION_BACKEND = "https://herd-and-seek-backend.pdarleyjr.workers.dev";

export const BACKEND_ORIGIN = (import.meta.env.VITE_BACKEND_ORIGIN || PRODUCTION_BACKEND).replace(/\/$/, "");
export const BACKEND_WS_ORIGIN = BACKEND_ORIGIN.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
