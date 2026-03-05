import React from "react";

const inputCls =
  "w-full px-4 py-2.5 text-sm border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none transition bg-white text-slate-800 placeholder-slate-400";

const Field = ({ label, children, span2 }) => (
  <div className={span2 ? "md:col-span-2" : ""}>
    <label className="block mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-500">
      {label}
    </label>
    {children}
  </div>
);

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
        <div className="flex items-center gap-3 mt-1">
          {["No", "Yes"].map((opt) => (
            <label
              key={opt}
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  renting: opt,
                  renting_vat_type: opt === "No" ? "" : p.renting_vat_type,
                }))
              }
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all
                ${formData.renting === opt
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-slate-200 hover:border-blue-300 text-slate-600"}`}
            >
              <div
                className={`w-2 h-2 rounded-full border-2 flex items-center justify-center transition
                  ${formData.renting === opt ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}
              />
              <span className="text-sm font-semibold">{opt}</span>
            </label>
          ))}
          {formData.renting === "Yes" && (
            <select
              name="renting_vat_type"
              value={formData.renting_vat_type}
              onChange={handleChange}
              className="flex-1 px-3 py-2 text-sm bg-white border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">— VAT Type —</option>
              {dropdowns.vat_type.map((o) => (
                <option key={o.id} value={o.vat_type}>
                  {o.vat_type}
                </option>
              ))}
            </select>
          )}
        </div>
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
        <div className="overflow-hidden border-2 border-slate-200 rounded-xl">
          <div className="flex gap-2 p-3 border-b bg-slate-50 border-slate-200">
            <input
              type="text"
              value={mapInput}
              onChange={(e) => setMapInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMapSearch(); }}
              placeholder="Type address then press Enter or click Search..."
              className="flex-1 px-3 py-2 text-sm transition border-2 rounded-lg border-slate-200 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleMapSearch}
              className="px-4 py-2 text-sm font-semibold text-white transition rounded-lg shadow-md whitespace-nowrap hover:opacity-90 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30"
            >
              Search
            </button>
            {formData.google_map_location && (
              <a
                href={`https://maps.google.com/maps?q=${encodeURIComponent(formData.google_map_location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-semibold text-blue-600 transition border-2 border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap"
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