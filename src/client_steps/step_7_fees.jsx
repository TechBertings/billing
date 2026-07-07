import React, { useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { inputCls, ACCENT } from "./shared_ui";

// ─── FEES REFERENCE LIST (Professional / Processing Fees) ───────────────────
// Grouped exactly as agreed: these are amounts billed to the client as
// service/processing fees (i.e. income), separate from government remittances.
const FEE_GROUPS = [
  {
    group: "SEC",
    items: [
      { key: "fee_sec_registration", label: "Processing Fee on SEC Registration" },
      { key: "fee_sec_gis_renewal", label: "Processing Fee on SEC - GIS Renewal" },
      { key: "fee_sec_business_closure", label: "Processing Fee on SEC - Business Closure" },
      { key: "fee_sec_annual_gis_filing", label: "Processing Fee on SEC - Annual General Information Sheet (GIS) Filing" },
    ],
  },
  {
    group: "DTI",
    items: [
      { key: "fee_dti_registration", label: "Processing Fee on DTI Registration" },
      { key: "fee_dti_renewal", label: "Processing Fee on DTI - Renewal" },
      { key: "fee_dti_business_closure", label: "Processing Fee on DTI - Business Closure" },
    ],
  },
  {
    group: "LGU / Municipality",
    items: [
      { key: "fee_municipality_registration", label: "Processing Fee on Municipality Registration" },
      { key: "fee_municipality_permit_renewal", label: "Processing Fee on Municipality - Business Permit Renewal" },
      { key: "fee_municipality_business_closure", label: "Processing Fee on Municipality - Business Closure" },
      { key: "fee_fire_certificate", label: "Processing Fee on Fire Certificate Issuance" },
      { key: "fee_sanitary_permit", label: "Processing Fee on Sanitary Permit Issuance" },
      { key: "fee_barangay_permit", label: "Processing Fee on Barangay Permit Issuance" },
      { key: "fee_municipal_updates", label: "Municipal Updates" },
      { key: "fee_business_mayors_permit", label: "Business/Mayor's Permit" },
      { key: "fee_barangay_clearance_solely", label: "Barangay Clearance (solely)" },
      { key: "fee_fire_sanitary_clearance_solely", label: "Fire & Sanitary Clearance (solely)" },
    ],
  },
  {
    group: "BIR",
    items: [
      { key: "fee_bir_registration", label: "Processing Fee on BIR Registration" },
      { key: "fee_bir_fs_prep_filing", label: "Processing Fee on BIR - Financial Statement Preparation and Filing" },
      { key: "fee_bir_audit_certificate", label: "Processing Fee on BIR - Audit Certificate" },
      { key: "fee_bir_updates", label: "Processing Fee on BIR - Updates" },
      { key: "fee_bir_loa_vat_audit", label: "Processing Fee on BIR - LOA (VAT Audit Section)" },
      { key: "fee_bir_loa", label: "Processing Fee on BIR - LOA" },
      { key: "fee_bir_open_case", label: "Processing Fee on BIR - Open Case" },
      { key: "fee_bir_books_renewal", label: "Processing Fee on BIR - Books of Account Renewal" },
      { key: "fee_bir_cor_updating", label: "Processing Fee on BIR - COR Updating" },
      { key: "fee_bir_business_closure", label: "Processing Fee on BIR - Business Closure" },
      { key: "fee_bir_atp", label: "Processing Fee on BIR - Authority to Print (ATP)" },
      { key: "fee_bir_invoice_booklets", label: "Processing Fee on BIR - Invoices Booklets" },
      { key: "fee_bir_quarterly_esubmission", label: "Processing Fee on BIR - Quarterly E-Submission (QAP/SLSP/SAWT)" },
      { key: "fee_bir_annual_esubmission", label: "Processing Fee on BIR - Annual E-Submission (QAP/SLSP/SAWT)" },
      { key: "fee_bir_annual_form_2316", label: "Processing Fee on BIR - Annual Form 2316" },
      { key: "fee_bir_form_2316_by_request", label: "Processing Fee on BIR - Form 2316 by Request (travel, loan, etc.)" },
      { key: "fee_bir_lessee_info_sheet", label: "Processing Fee on BIR - Lessee Info Sheet" },
      { key: "fee_bir_1604e_alphalist", label: "Form 1604E & Alpha List (starting fee/minimum)" },
      { key: "fee_bir_1604cf_alphalist", label: "Form 1604CF & Alpha List (minimum of 10 employees)" },
      { key: "fee_inventory_list", label: "Inventory List (trading)" },
      { key: "fee_bir_quarterly_esubmission_alphalist_ewt", label: "Quarterly E-Submission Alpha List (with EWT)" },
      { key: "fee_bookkeeping", label: "Bookkeeping" },
    ],
  },
  {
    group: "SSS",
    items: [
      { key: "fee_sss_registration", label: "Processing Fee on SSS Registration" },
      { key: "fee_sss_maternity_submission", label: "Processing Fee on SSS Maternity Submission" },
      { key: "fee_sss_record_updating", label: "Processing Fee on SSS Record Updating" },
      { key: "fee_sss_closure", label: "Processing Fee on SSS Closure" },
    ],
  },
  {
    group: "PhilHealth",
    items: [
      { key: "fee_philhealth_registration", label: "Processing Fee on PhilHealth Registration" },
      { key: "fee_philhealth_record_updating", label: "Processing Fee on PhilHealth Record Updating" },
      { key: "fee_philhealth_closure", label: "Processing Fee on PHIC Closure" },
    ],
  },
  {
    group: "Pag-IBIG",
    items: [
      { key: "fee_pagibig_registration", label: "Processing Fee on Pag-IBIG Registration" },
      { key: "fee_pagibig_record_updating", label: "Processing Fee on Pag-IBIG Record Updating" },
      { key: "fee_pagibig_closure", label: "Processing Fee on Pag-IBIG Closure" },
    ],
  },
  {
    group: "Retainer Fee",
    items: [
      { key: "fee_retainer_tax_filing", label: "Retainer Fee for Tax Filing and Compliance" },
      { key: "fee_retainer_govt_contributions", label: "Retainer Fee for Government Contributions" },
    ],
  },
  {
    group: "Others / Processing Fees",
    items: [
      { key: "fee_tin_card_existing", label: "Processing Fee on TIN Card Issuance (with existing number)" },
      { key: "fee_tin_card_new", label: "Processing Fee on TIN Card Issuance (no existing number)" },
      { key: "fee_admin_miscellaneous", label: "Processing Fee on Administrative/Miscellaneous" },
      { key: "fee_sap_support_monitoring", label: "SAP Support Monitoring" },
      { key: "fee_miscellaneous", label: "Miscellaneous Fee" },
      { key: "fee_expenses", label: "Expenses" },
    ],
  },
];

export default function Step7Fees({ formData, handleChange }) {
  // Keep every group collapsed by default; user opens the ones they need.
  const [openGroups, setOpenGroups] = useState(
    () => Object.fromEntries(FEE_GROUPS.map((g) => [g.group, false]))
  );

  const toggleGroup = (group) =>
    setOpenGroups((p) => ({ ...p, [group]: !p[group] }));

  const parseAmount = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  const subtotal = FEE_GROUPS.reduce(
    (sum, g) =>
      sum + g.items.reduce((s, item) => s + parseAmount(formData[item.key]), 0),
    0
  );

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-sm font-bold tracking-wide uppercase text-slate-500">
          Fees (Professional / Processing Fees)
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Set the client's specific rate for each service. Leave blank or 0 for services not applicable to this client.
        </p>
      </div>

      <div className="space-y-4">
        {FEE_GROUPS.map((g) => (
<div key={g.group} className="overflow-hidden border rounded-md border-slate-200">            <button
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
        <span className="text-sm font-semibold text-slate-600">Fees Subtotal</span>   
        <span className="text-lg font-bold" style={{ color: ACCENT }}>
          ₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}