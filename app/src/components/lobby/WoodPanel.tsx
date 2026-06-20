import type { ReactNode } from "react";

interface WoodPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function WoodPanel({ title, subtitle, children, className = "" }: WoodPanelProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden border-2 border-[#8b5c1e] shadow-[0_4px_32px_rgba(0,0,0,0.7)] ${className}`}
      style={{ background: "linear-gradient(160deg, #4a2e12 0%, #2e1a08 40%, #1a0f05 100%)" }}
    >
      {/* Panel header */}
      <div className="px-4 py-3 border-b-2 border-[#6b3a0a] bg-[#3d2210]/80 flex flex-col gap-0.5">
        <span
          className="font-extrabold tracking-widest uppercase text-[#f5d07a] drop-shadow-sm"
          style={{ fontSize: "clamp(14px, 2vw, 18px)" }}
        >
          {title}
        </span>
        {subtitle && (
          <span className="text-[#c8a05a] text-xs tracking-wide">{subtitle}</span>
        )}
      </div>
      {/* Content */}
      <div className="flex-1 p-3 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
}
