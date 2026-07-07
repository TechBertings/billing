import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { inputCls, selectCls, Field, RadioGroup, btnPrimaryCls, btnPrimaryStyle, btnOutlineCls } from "./shared_ui";

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatMoney = (val) =>
  Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Step4AddressLocation({
  formData,
  handleChange,
  setFormData,
  dropdowns,
  mapInput,
  setMapInput,
  mapQuery,
  setMapQuery,
}) {
  const [scheduleRows, setScheduleRows] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Pull in the full rental schedule whenever a Rent Fee code is picked,
  // so employees without Maintenance access can still see what's inside it.
  useEffect(() => {
    const fetchSchedule = async () => {
      if (formData.renting !== "Yes" || !formData.renting_rent_fee) {
        setScheduleRows([]);
        return;
      }
      setScheduleLoading(true);
      const { data, error } = await supabase
        .from("rent_fees")
        .select("id, rf_code, rent_fee_details(*)")
        .eq("rf_code", formData.renting_rent_fee)
        .single();

      if (!error && data) {
        const rows = (data.rent_fee_details || []).slice().sort((a, b) => a.year - b.year);
        setScheduleRows(rows);
      } else {
        setScheduleRows([]);
      }
      setScheduleLoading(false);
    };
    fetchSchedule();
  }, [formData.renting, formData.renting_rent_fee]);

  const handleMapSearch = () => {
    if (!mapInput.trim()) return;
    setMapQuery(mapInput.trim());
    setFormData((p) => ({ ...p, google_map_location: mapInput.trim() }));
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <Field label="Registered Business Address" span2>
        <input
          type="text"
          name="registered_business_address"
          value={formData.registered_business_address}
          onChange={handleChange}
          placeholder="Enter registered business address"
          className={inputCls}
        />
      </Field>

  <Field label="Renting" span2>
        <div className="flex items-center gap-4 mt-1">
          <RadioGroup
            name="renting"
            value={formData.renting}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                renting: e.target.value,
                renting_rent_fee: e.target.value === "No" ? "" : p.renting_rent_fee,
              }))
            }
            options={["No", "Yes"]}
            inline
          />
          {formData.renting === "Yes" && (
            <select
              name="renting_rent_fee"
              value={formData.renting_rent_fee}
              onChange={handleChange}
              className={`${selectCls} flex-1`}
            >
              <option value="">— Rent Fee —</option>
              {dropdowns.rent_fees.map((o) => (
                <option key={o.id} value={o.rf_code}>
                  {o.rf_code}
                </option>
              ))}
            </select>
          )}
        </div>

        {formData.renting === "Yes" && formData.renting_rent_fee && (
<div className="mt-3 overflow-hidden border rounded-md border-slate-200">
            <div className="px-4 py-2 text-xs font-semibold tracking-wide uppercase border-b bg-slate-50 border-slate-200 text-slate-500">
              Rental Schedule — {formData.renting_rent_fee}
            </div>
            {scheduleLoading ? (
              <div className="px-4 py-4 text-sm text-center text-slate-400">Loading schedule...</div>
            ) : scheduleRows.length === 0 ? (
              <div className="px-4 py-4 text-sm text-center text-slate-400">
                No schedule rows found for this rent fee.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="px-4 py-2 font-bold text-left">Year</th>
                      <th className="px-4 py-2 font-bold text-left">Period</th>
                      <th className="px-4 py-2 font-bold text-right">Net of VAT</th>
                      <th className="px-4 py-2 font-bold text-right">VAT</th>
                      <th className="px-4 py-2 font-bold text-right">WTAX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-bold text-slate-700">{r.year}</td>
                        <td className="px-4 py-2 font-medium text-slate-600">
                          {formatDisplayDate(r.period_start)} - {formatDisplayDate(r.period_end)}
                        </td>
                        <td className="px-4 py-2 font-semibold text-right text-slate-700">
                          {formatMoney(r.net_of_vat)}
                        </td>
                        <td className="px-4 py-2 font-semibold text-right text-slate-700">
                          {formatMoney(r.vat)}
                        </td>
                        <td className="px-4 py-2 font-semibold text-right text-slate-700">
                          {formatMoney(r.wtax)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Field>

      <Field label="RDO">
        <input
          type="text"
          name="rdo"
          value={formData.rdo}
          onChange={handleChange}
          placeholder="Enter RDO"
          className={inputCls}
        />
      </Field>

      <Field label="District">
        <input
          type="text"
          name="district"
          value={formData.district}
          onChange={handleChange}
          placeholder="Enter district"
          className={inputCls}
        />
      </Field>

      <Field label="Zip Code">
        <input
          type="text"
          name="zip_code"
          value={formData.zip_code}
          onChange={handleChange}
          placeholder="Enter zip code"
          className={inputCls}
        />
      </Field>

      <Field label="Office Location (Map)" span2>
   <div className="overflow-hidden border rounded-md border-slate-200">
          <div className="flex gap-2 p-3 border-b bg-slate-50 border-slate-200">
            <input
              type="text"
              value={mapInput}
              onChange={(e) => setMapInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMapSearch(); }}
              placeholder="Type address then press Enter or click Search..."
              className={inputCls}
            />  
            <button type="button" onClick={handleMapSearch} className={btnPrimaryCls} style={btnPrimaryStyle}>
              Search
            </button>
            {formData.google_map_location && (
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(formData.google_map_location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnOutlineCls} border-slate-300 text-slate-700`}
              >
                Open ↗
              </a>
            )}
          </div>
          <iframe
            key={mapQuery}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&z=16`}
            width="100%"
            height="350"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Office Location Map"
          />
          <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 border-slate-200">
            <p className="text-xs text-slate-400">
              💡 Type an address above then press <strong>Enter</strong> or click <strong>Search</strong>
            </p>
            {formData.google_map_location && (
              <span className="text-xs font-semibold text-blue-600">
                📍 {formData.google_map_location}
              </span>
            )}
          </div>
        </div>
      </Field>

    </div>
  );
}