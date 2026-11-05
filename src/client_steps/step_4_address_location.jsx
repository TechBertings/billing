import React from "react";
import { inputCls, Field, btnPrimaryCls, btnPrimaryStyle, btnOutlineCls } from "./shared_ui";

export default function Step4AddressLocation({
  formData,
  handleChange,
  setFormData,
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