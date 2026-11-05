import React, { useState, useEffect, useRef } from "react";
import { FaBolt } from "react-icons/fa";
import { presetRange, QUICK_PRESETS } from "../utils/data_range";

const labelCls = "block text-xs font-medium text-gray-500 mb-1";
const dateCls =
  "px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-500 transition";

/**
 * Date range picker: Start date / End date (calendar) + quick select icon.
 *
 * Props:
 *  - from, to        "YYYY-MM-DD" (controlled by parent)
 *  - onChange(f, t)  called every time the range changes
 *  - presets         [[key, label], ...] — keys understood by presetRange()
 */
export default function DateRangePicker({ from, to, onChange, presets = QUICK_PRESETS }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // isara ang quick select pag nag-click sa labas o pinindot ang Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // laging valid ang range: hindi pwedeng mas maaga ang "End" kaysa "Start"
  const setFrom = (v) => {
    if (!v) return; // ignore pag na-clear ang input
    onChange(v, v > to ? v : to);
  };
  const setTo = (v) => {
    if (!v) return;
    onChange(v < from ? v : from, v);
  };

  const isActive = (key) => {
    const [f, t] = presetRange(key);
    return f === from && t === to;
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className={labelCls}>Start date</label>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className={dateCls}
        />
      </div>

      <div>
        <label className={labelCls}>End date</label>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className={dateCls}
        />
      </div>

      {/* Quick select: icon lang, lalabas ang choices pag na-click */}
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Quick select"
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex items-center justify-center w-9 h-9 border rounded-md transition ${
            open
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <FaBolt size={13} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 z-30 w-40 py-1 mt-1 bg-white border border-gray-200 rounded-md shadow-lg"
          >
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Quick select
            </p>
            {presets.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  const [f, t] = presetRange(key);
                  onChange(f, t);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-xs font-medium text-left transition ${
                  isActive(key)
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}