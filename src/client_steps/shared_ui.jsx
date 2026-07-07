import React from "react";

// ─── Shared design tokens — used across all onboarding steps ───────────────
// Kept in one place so every step looks and behaves the same way.
export const ACCENT = "#1a5c2e"; // same green used in SOA / billing branding

export const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-800 placeholder-slate-400 transition focus:outline-none focus:border-[#1a5c2e] focus:ring-1 focus:ring-[#1a5c2e]/20";

export const selectCls =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-800 cursor-pointer transition focus:outline-none focus:border-[#1a5c2e] focus:ring-1 focus:ring-[#1a5c2e]/20";

export const disabledInputCls =
  "w-full px-3 py-2 text-sm font-mono font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-md cursor-not-allowed";

export const labelCls =
  "block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500";

export const sectionTitleCls =
  "text-sm font-semibold tracking-wide uppercase text-slate-500";

export const sectionHintCls = "mt-1 text-xs text-slate-400";

export const Field = ({ label, children, span2, required }) => (
  <div className={span2 ? "md:col-span-2" : ""}>
    <label className={labelCls}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

// Simple, uniform Yes/No or option toggle — used wherever a choice
// was previously a colored box, gradient pill, or ad-hoc radio.
export const RadioGroup = ({ name, value, onChange, options, inline }) => (
  <div className={inline ? "flex items-center gap-4" : "flex flex-col gap-2"}>
    {options.map((opt) => (
      <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
        <span
          onClick={() => onChange({ target: { name, value: opt } })}
          className={`w-4 h-4 rounded-full border flex items-center justify-center transition
            ${value === opt ? "border-[#1a5c2e] bg-[#1a5c2e]" : "border-slate-300 group-hover:border-slate-400"}`}
        >
          {value === opt && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm text-slate-700">{opt}</span>
      </label>
    ))}
  </div>
);

// Flat, bordered button — replaces gradient/shadow buttons (e.g. map Search)
export const btnPrimaryCls =
  "px-4 py-2 text-sm font-semibold text-white rounded-md whitespace-nowrap transition hover:opacity-90";
export const btnPrimaryStyle = { background: ACCENT };

export const btnOutlineCls =
  "px-4 py-2 text-sm font-semibold rounded-md border whitespace-nowrap transition hover:bg-slate-50";