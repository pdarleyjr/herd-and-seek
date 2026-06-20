// Safari lobby design tokens
export const lobbyTheme = {
  panel: {
    bg: "bg-[#3d2610]/90",
    border: "border-2 border-[#8b5c1e]",
    shadow: "shadow-[0_4px_24px_rgba(0,0,0,0.6)]",
    inner: "bg-[#1a0f05]/70",
    header: "bg-[#4a2e12] border-b-2 border-[#8b5c1e]",
    headerText: "text-[#f5d07a] font-bold tracking-wide uppercase",
    subText: "text-[#c8a05a] text-sm",
  },
  card: {
    base: "rounded-xl border-2 cursor-pointer transition-all duration-150 select-none",
    idle: "border-[#5a3a1a] bg-[#2a1808]/80 hover:border-[#a07030] hover:bg-[#3a2010]/80",
    selected: "border-[#7fff00] bg-[#1a3008]/80 shadow-[0_0_14px_2px_rgba(127,255,0,0.35)]",
  },
  button: {
    ready: "bg-[#3db02a] hover:bg-[#4ecf35] active:bg-[#2a8c1e] border-2 border-[#7fff00] text-white font-extrabold tracking-widest uppercase shadow-[0_0_20px_rgba(127,255,0,0.4)]",
    readyDone: "bg-[#1a7c10] hover:bg-[#228c18] active:bg-[#146010] border-2 border-[#7fff00] text-[#7fff00] font-extrabold tracking-widest uppercase",
    start: "bg-[#d4a010] hover:bg-[#e8b520] active:bg-[#b88c0a] border-2 border-[#f5d07a] text-black font-extrabold tracking-widest uppercase shadow-[0_0_20px_rgba(212,160,16,0.5)]",
    waiting: "bg-[#3a3a3a] border-2 border-[#666] text-[#999] font-extrabold tracking-widest uppercase cursor-not-allowed",
  },
} as const;
