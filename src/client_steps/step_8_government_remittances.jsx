import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const inputCls =
  "w-full px-4 py-2 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";

// ─── GOVERNMENT REMITTANCE REFERENCE LIST ────────────────────────────────────
// Pass-through amounts paid directly to the agency on the client's behalf
// (not company income) — kept separate from Fees for correct posting later.
const REMITTANCE_GROUPS = [
  {
    group: "SEC",
    items: [{ key: "remit_sec_registration", label: "Application/Registration Fee" }],
  },
  {
    group: "DTI",
    items: [
      { key: "remit_dti_barangay", label: "Application/Registration Fee - Barangay" },
      { key: "remit_dti_municipality", label: "Application/Registration Fee - Municipality" },
      { key: "remit_dti_regional", label: "Application/Registration Fee - Regional" },
      { key: "remit_dti_national", label: "Application/Registration Fee - National" },
    ],
  },
  {
    group: "BIR",
    items: [
      { key: "remit_bir_income_tax", label: "Income Tax" },
      { key: "remit_bir_vat", label: "Value Added Tax" },
      { key: "remit_bir_percentage_tax", label: "Percentage Tax" },
      { key: "remit_bir_wtax_rental", label: "Withholding Tax - Rental" },
      { key: "remit_bir_wtax_compensation", label: "Withholding Tax - Compensation" },
      { key: "remit_bir_wtax_final", label: "Withholding Tax - Final" },
      { key: "remit_bir_documentary_stamp", label: "Documentary Stamp Tax" },
      { key: "remit_bir_loa_assessment", label: "LOA Assessment" },
      { key: "remit_bir_open_cases", label: "Open Cases" },
    ],
  },
  {
    group: "Municipality",
    items: [
      { key: "remit_mayors_permit", label: "Mayor's Permit" },
      { key: "remit_cedula", label: "Cedula" },
      { key: "remit_insurance", label: "Insurance" },
      { key: "remit_barangay", label: "Barangay" },
      { key: "remit_fire", label: "Fire" },
      { key: "remit_sanitary", label: "Sanitary" },
    ],
  },
  {
    group: "Social Security System",
    items: [
      { key: "remit_sss_contributions", label: "SSS Contributions" },
      { key: "remit_sss_loan", label: "SSS Loan" },
      { key: "remit_sss_personal_contribution", label: "SSS Personal Contribution" },
    ],
  },
  {
    group: "PhilHealth",
    items: [
      { key: "remit_philhealth_contributions", label: "PhilHealth Contributions" },
      { key: "remit_philhealth_personal_contribution", label: "PhilHealth Personal Contribution" },
    ],
  },
  {
    group: "Pag-IBIG",
    items: [
      { key: "remit_pagibig_contributions", label: "Pag-IBIG Contributions" },
      { key: "remit_pagibig_personal_contribution", label: "Pag-IBIG Personal Contribution" },
      { key: "remit_pagibig_loan", label: "Pag-IBIG Loan" },
      { key: "remit_mp2", label: "MP2" },
    ],
  },
];

export default function Step8GovernmentRemittances({ formData, handleChange }) {
  // Keep every group collapsed by default; user opens the ones they need.
  const [openGroups, setOpenGroups] = useState(
    () => Object.fromEntries(REMITTANCE_GROUPS.map((g) => [g.group, false]))
  );

  const toggleGroup = (group) =>
    setOpenGroups((p) => ({ ...p, [group]: !p[group] }));

  const parseAmount = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const subtotal = REMITTANCE_GROUPS.reduce(
    (sum, g) =>
      sum + g.items.reduce((s, item) => s + parseAmount(formData[item.key]), 0),
    0
  );

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-sm font-bold tracking-wide uppercase text-slate-500">
          Government Remittances
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          These are pass-through amounts paid directly to the agency on the client's behalf, separate from professional/processing fees. Leave blank or 0 if not applicable.
        </p>
      </div>

      <div className="space-y-4">
        {REMITTANCE_GROUPS.map((g) => (
          <div key={g.group} className="overflow-hidden border-2 rounded-lg border-slate-200">
            <button
              type="button"
              onClick={() => toggleGroup(g.group)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold transition bg-slate-50 hover:bg-slate-100 text-slate-700"
            >
              <span>{g.group}</span>
              {openGroups[g.group] ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
            </button>

            {openGroups[g.group] && (
              <div className="divide-y divide-slate-100">
                {g.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <label className="text-sm text-slate-600 md:pr-4">{item.label}</label>
                    <div className="relative w-full md:w-48 shrink-0">
                      <span className="absolute text-sm -translate-y-1/2 left-3 top-1/2 text-slate-400">
                        ₱
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name={item.key}
                        value={formData[item.key] || ""}
                        onChange={handleChange}
                        placeholder="0.00"
                        className={`${inputCls} pl-7`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-4 mt-6 border-t-2 border-slate-100">
        <span className="text-sm font-semibold text-slate-600">Government Remittances Subtotal</span>
        <span className="text-lg font-bold text-blue-600">
          ₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}