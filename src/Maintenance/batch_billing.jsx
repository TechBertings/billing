import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  FaSearch,
  FaCheck,
  FaTimes,
  FaTrash,
  FaLayerGroup,
  FaBuilding,
  FaUser,
  FaArrowLeft,
  FaEye,
} from "react-icons/fa";
import { useContributionConfig } from "../utils/use_contributions";
import { computeSSS, computePHIC, computeHDMF } from "../utils/govt_contributions";
import { useSSSBrackets } from "../utils/use_sss_brackets";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition bg-white";
const selectCls =
  "px-2 py-1 text-[11px] border border-gray-200 rounded-md bg-white cursor-pointer";


export default function BatchBilling() {
  // ── CLIENT PICKER ────────────────────────────────────────────────────────
  const [clients, setClients] = useState([]);
  const [clientTotal, setClientTotal] = useState(0);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientSearch, setClientSearch] = useState("");
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClient, setActiveClient] = useState(null);
  const { config: contribCfg } = useContributionConfig();
  const [employees, setEmployees] = useState([]);

  // ── LEVEL 1: Groups (read-only nav, sourced from Chart of Accounts) ──────
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);

  // ── LEVEL 2: Agencies (read-only nav, scoped to active group) ────────────
  const [agencies, setAgencies] = useState([]);
  const [loadingAgencies, setLoadingAgencies] = useState(true);
  const [activeAgencyId, setActiveAgencyId] = useState(null);

  // ── LEVEL 3: Accounts (from chart_of_accounts) + this client's amounts ──
  const [coaList, setCoaList] = useState([]);
  const [loadingCoa, setLoadingCoa] = useState(true);
  const [feeItemsMap, setFeeItemsMap] = useState({}); // { [coa_id]: fee_items row }
  const [amounts, setAmounts] = useState({}); // { [coa_id]: string }
  const [rowSaving, setRowSaving] = useState({}); // { [coa_id]: boolean }
  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
  const activeAgency = agencies.find((a) => a.id === activeAgencyId) || null;
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [rentFeesList, setRentFeesList] = useState([]);
  const [loadingRentFees, setLoadingRentFees] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null); // { coa, feeItem }

  
  const [taxTypes, setTaxTypes] = useState([]); // from tax_setup (config)
  const [clientTaxMap, setClientTaxMap] = useState({}); // { [tax_type]: client_tax_setup row }
  const [taxEdits, setTaxEdits] = useState({}); // { [tax_type]: { fixed_amount, rate, sales_amount, purchase_amount } }
  const [taxRowSaving, setTaxRowSaving] = useState({});
  const [taxModalOpen, setTaxModalOpen] = useState(false);
const [taxModalTarget, setTaxModalTarget] = useState(null); // { coa, t }
const { brackets: sssBrackets } = useSSSBrackets();
  const flash = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  // ── FETCH: Clients (loads immediately, paginated, optional search) ───────
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    const from = (clientPage - 1) * clientPageSize;
    const to = from + clientPageSize - 1;

    let query = supabase
      .from("client_profile")
      .select("id, client_id, business_name, trade_name", { count: "exact" })
      .order("business_name", { ascending: true });

    if (clientSearch.trim()) {
      query = query.or(
        `business_name.ilike.%${clientSearch}%,trade_name.ilike.%${clientSearch}%,client_id.ilike.%${clientSearch}%`
      );
    }

    const { data, error, count } = await query.range(from, to);
    if (error) flash(`Error loading clients: ${error.message}`, "error");
    else {
      setClients(data || []);
      setClientTotal(count || 0);
    }
    setLoadingClients(false);
  }, [clientSearch, clientPage, clientPageSize]);

  useEffect(() => {
    const t = setTimeout(fetchClients, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  useEffect(() => {
    setClientPage(1);
  }, [clientSearch, clientPageSize]);

  const clientTotalPages = Math.max(1, Math.ceil(clientTotal / clientPageSize));

  const selectClient = (c) => {
    setActiveClient(c);
    setActiveClientId(c.id);
  };

  const changeClient = () => {
    setActiveClient(null);
    setActiveClientId(null);
  };

  // ── FETCH: Groups (read-only) ────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    const { data, error } = await supabase
      .from("fee_groups")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) flash(`Error loading groups: ${error.message}`, "error");
    else {
      setGroups(data || []);
      setActiveGroupId((prev) => prev ?? (data && data[0] ? data[0].id : null));
    }
    setLoadingGroups(false);
  }, []);

  // ── FETCH: Agencies (read-only, scoped to active group) ──────────────────
  const fetchAgencies = useCallback(async () => {
    if (!activeGroupId) {
      setAgencies([]);
      setActiveAgencyId(null);
      setLoadingAgencies(false);
      return;
    }
    setLoadingAgencies(true);
    const { data, error } = await supabase
      .from("government_agencies")
      .select("*")
      .eq("group_id", activeGroupId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) flash(`Error loading agencies: ${error.message}`, "error");
    else {
      setAgencies(data || []);
      setActiveAgencyId(data && data[0] ? data[0].id : null);
    }
    setLoadingAgencies(false);
  }, [activeGroupId]);

  // ── FETCH: Chart of Accounts (scoped to active agency) ───────────────────
const fetchCoaList = useCallback(async () => {
  if (!activeAgencyId) {
    setCoaList([]);
    setLoadingCoa(false);
    return;
  }
  setLoadingCoa(true);
  const { data, error } = await supabase
    .from("chart_of_accounts")
  .select("id, code, account_name, billing_mode, contribution_key, tax_setup_id, tax_setup(id, tax_type, label, computation_type, default_fixed_amount, default_rate)")
    .eq("agency_id", activeAgencyId)
    .eq("is_active", true)
    .order("code", { ascending: true, nullsFirst: false });
  if (error) flash(`Error loading accounts: ${error.message}`, "error");
  else setCoaList(data || []);
  setLoadingCoa(false);
}, [activeAgencyId]);

  // ── FETCH: this client's existing fee_items for the active agency ────────
const fetchFeeItems = useCallback(async () => {
    if (!activeAgencyId || !activeClientId) {
      setFeeItemsMap({});
      return;
    }
    const { data, error } = await supabase
      .from("fee_items")
      .select("*, rent_fees(rf_code, term, rent_fee_details(*))")
      .eq("agency_id", activeAgencyId)
      .eq("client_id", activeClientId);
    if (error) {
      flash(`Error loading billing: ${error.message}`, "error");
      return;
    }
    const map = {};
    (data || []).forEach((fi) => {
      map[fi.coa_id] = fi;
    });
    setFeeItemsMap(map);
  }, [activeAgencyId, activeClientId]);


 const fetchClientTaxes = useCallback(async () => {
    if (!activeClientId) {
      setClientTaxMap({});
      return;
    }
    const { data, error } = await supabase
      .from("client_tax_setup")
      .select("*")
      .eq("client_id", activeClientId);
    if (error) {
      flash(`Error loading taxes: ${error.message}`, "error");
      return;
    }
    const map = {};
    (data || []).forEach((r) => { map[r.tax_type] = r; });
    setClientTaxMap(map);
  }, [activeClientId]);


const fetchClientEmployees = useCallback(async () => {
  if (!activeClient?.client_id) { setEmployees([]); return; }
  const { data, error } = await supabase
    .from("employee_profile")
    .select("sss_ee, sss_er, phic_ee, phic_er, hdmf_ee, hdmf_er, sss_loan, pagibig_loan, salary_bracket") 

    .eq("client_id", activeClient.client_id);
  if (!error) setEmployees(data || []);
}, [activeClient?.client_id]);


useEffect(() => { fetchClientEmployees(); }, [fetchClientEmployees]);


// 3. I-add ang EC sa contributionTotals
const contributionTotals = useMemo(() => {
  const acc = { sss_total: 0, phic_total: 0, hdmf_total: 0, sss_loan: 0, pagibig_loan: 0 };
  employees.forEach((e) => {
    const ec = computeSSS(e.salary_bracket, sssBrackets).ec;
    acc.sss_total += (Number(e.sss_ee) || 0) + (Number(e.sss_er) || 0) + ec; // ← + ec
    acc.phic_total += (Number(e.phic_ee) || 0) + (Number(e.phic_er) || 0);
    acc.hdmf_total += (Number(e.hdmf_ee) || 0) + (Number(e.hdmf_er) || 0);
    acc.sss_loan += Number(e.sss_loan) || 0;
    acc.pagibig_loan += Number(e.pagibig_loan) || 0;
  });
  return acc;
}, [employees, sssBrackets]); // ← dagdag dependency


const handleSaveTax = async (t) => {
  const e = taxEdits[t.tax_type] || {};
  const isManual = t.computation_type === "manual";
  const rate = isManual ? (parseFloat(e.rate) || 0) : (parseFloat(t.default_rate) || 0);
  const sales = parseFloat(e.sales_amount) || 0;
  const purchase = parseFloat(e.purchase_amount) || 0;
  const fixedAmt = parseFloat(e.fixed_amount) || 0;

  setTaxRowSaving((p) => ({ ...p, [t.tax_type]: true }));
  const existing = clientTaxMap[t.tax_type];

  let payload = {
    client_id: activeClientId,
    tax_type: t.tax_type,
    computation_type: t.computation_type,
    is_active: true,
    updated_at: new Date().toISOString(),
    fixed_amount: null,
    rate: null,
    sales_amount: null,
    purchase_amount: null,
    output_tax: null,
    input_tax: null,
    payable: null,
  };

  if (t.computation_type === "fixed") {
    payload.fixed_amount = fixedAmt;
 } else if (t.computation_type === "percentage") {
  const outputTax = sales * (rate / 100);
  payload.rate = rate;
  payload.sales_amount = sales;
  payload.output_tax = outputTax;
  payload.payable = sales + outputTax; // ✅ ngayon Total (base + tax) na ang laman ng payable
} else if (t.computation_type === "table") {
    const outputTax = sales * (rate / 100);
    const inputTax = purchase * (rate / 100);
    payload.rate = rate;
    payload.sales_amount = sales;
    payload.purchase_amount = purchase;
    payload.output_tax = outputTax;
    payload.input_tax = inputTax;
    payload.payable = outputTax - inputTax;
  } else if (t.computation_type === "manual") {
    payload.rate = rate;
    payload.fixed_amount = fixedAmt;
  }

  const { error } = existing
    ? await supabase.from("client_tax_setup").update(payload).eq("id", existing.id)
    : await supabase.from("client_tax_setup").insert([payload]);

  if (error) flash(`Error: ${error.message}`, "error");
  else {
    flash(`✓ ${t.label} saved.`);
    fetchClientTaxes();
  }
  setTaxRowSaving((p) => ({ ...p, [t.tax_type]: false }));
};

   // ── PREVIEW: kung ano ang lalabas sa Create Billing ──────────────────────
  const [previewRows, setPreviewRows] = useState([]);
  const [previewSchedules, setPreviewSchedules] = useState([]);
  const [previewIssues, setPreviewIssues] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!activeClientId) {
      setPreviewRows([]);
      setPreviewSchedules([]);
      setPreviewIssues([]);
      return;
    }
    setLoadingPreview(true);
    // Same query + rules as CreateBilling.selectClient
    const { data, error } = await supabase
      .from("fee_items")
      .select(
        "amount, item_name, agency_id, coa_id, rent_fee_id, chart_of_accounts(code, account_name, billing_mode), government_agencies(name, fee_groups(category)), rent_fees(rf_code, rent_fee_details(*))"
      )
      .eq("client_id", activeClientId)
      .eq("is_active", true)
      .eq("chart_of_accounts.is_active", true);

    if (!error && data) {
      const flat = [];
      const sched = [];
      const issues = [];

      data.forEach((fi) => {
        const agencyName = fi.government_agencies?.name || "";
        const isSchedule = fi.chart_of_accounts?.billing_mode === "schedule";

        // same skip rule as CreateBilling
        if (!isSchedule && agencyName.toUpperCase() === "RETAINER" && !Number(fi.amount)) return;

        const code = fi.chart_of_accounts?.code || "";
        const name = fi.chart_of_accounts?.account_name || fi.item_name || "";
        const category =
          fi.government_agencies?.fee_groups?.category === "remittance" ? "remittance" : "income";

        if (isSchedule && fi.rent_fees) {
          const details = (fi.rent_fees.rent_fee_details || [])
            .slice()
            .sort((a, b) => a.year - b.year);
          const total = details.reduce(
            (s, d) =>
              s + (parseFloat(d.net_of_vat) || 0) + (parseFloat(d.vat) || 0) - (parseFloat(d.wtax) || 0),
            0
          );
          sched.push({ description: name, rf_code: fi.rent_fees.rf_code, details, category, total });
        } else {
          const amount = Number(fi.amount) || 0;
          flat.push({ code, agency: agencyName, description: name, amount, category });
              if (isSchedule) {
            issues.push({ level: "warn", text: `${name}: no schedule selected` });
          } else if (amount === 0) {
            issues.push({ level: "warn", text: `${name} (${agencyName || "no agency"}): amount is 0` });
          }
        }
      });
            // Taxes (client_tax_setup) — same as Create Billing
      const { data: taxes } = await supabase
        .from("client_tax_setup")
        .select("*")
        .eq("client_id", activeClientId)
        .eq("is_active", true);
      const { data: taxCoas } = await supabase
        .from("chart_of_accounts")
        .select("code, account_name, tax_setup(tax_type), government_agencies(name, fee_groups(category))")
        .eq("is_active", true)
        .not("tax_setup_id", "is", null);
      const coaByTax = {};
      (taxCoas || []).forEach((c) => {
        if (c.tax_setup?.tax_type) coaByTax[c.tax_setup.tax_type] = c;
      });
         (taxes || []).forEach((t) => {
        const coa = coaByTax[t.tax_type];
        const amount =
          t.computation_type === "fixed" || t.computation_type === "manual"
            ? Number(t.fixed_amount) || 0
            : Number(t.payable) || 0;
        if (!coa) {
          issues.push({ level: "warn", text: `${t.tax_type}: no account linked in Chart of Accounts` });
        }
        if (amount === 0) {
          issues.push({ level: "warn", text: `${t.tax_type}: amount is 0` });
          return;
        } 
        flat.push({
          code: coa?.code || "",
          agency: coa?.government_agencies?.name || "",
          description: coa?.account_name || t.tax_type,
          amount,
          category:
            coa?.government_agencies?.fee_groups?.category === "remittance" ? "remittance" : "income",
        });
      });

      setPreviewRows(flat);
      setPreviewSchedules(sched);
      setPreviewIssues(issues);
    }
    setLoadingPreview(false);
  }, [activeClientId]);

  // feeItemsMap nagbabago after every save/remove → auto refresh
  useEffect(() => { fetchPreview(); }, [fetchPreview, feeItemsMap, clientTaxMap]);
  // Totals per category
  const previewTotals = useMemo(() => {
    const t = { income: 0, remittance: 0 };
    previewRows.forEach((r) => { t[r.category] += r.amount; });
    previewSchedules.forEach((s) => { t[s.category] += s.total; });
    return { ...t, subtotal: t.income + t.remittance };
  }, [previewRows, previewSchedules]);

  const previewCount = previewRows.length + previewSchedules.length;
  const previewWarnCount = previewIssues.length;

  const peso = (n) =>
    "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  useEffect(() => { fetchClientTaxes(); }, [fetchClientTaxes]);
useEffect(() => { fetchClientEmployees(); }, [fetchClientEmployees]);



 useEffect(() => {
  const next = {};
  coaList.forEach((coa) => {
    const t = coa.tax_setup;
    if (!t) return;
    const existing = clientTaxMap[t.tax_type];
    next[t.tax_type] = {
      fixed_amount: existing?.fixed_amount ?? t.default_fixed_amount ?? "",
      rate: existing?.rate ?? t.default_rate ?? "",
      sales_amount: existing?.sales_amount ?? "",
      purchase_amount: existing?.purchase_amount ?? "",
    };
  });
  setTaxEdits(next);
}, [coaList, clientTaxMap]);


  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);
  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);
  useEffect(() => {
    fetchCoaList();
  }, [fetchCoaList]);
  useEffect(() => {
    fetchFeeItems();
  }, [fetchFeeItems]);
useEffect(() => {
  if (!activeAgencyId || !activeClientId) return;
  coaList.forEach(async (coa) => {
    if (coa.billing_mode !== "contribution" || !coa.contribution_key) return;
    const computed = contributionTotals[coa.contribution_key];
    if (computed === undefined) return;
    const rounded = Number(computed.toFixed(2));
    const existing = feeItemsMap[coa.id];
    if (existing && Number(existing.amount) === rounded) return;
    const payload = {
      group_id: activeGroupId,
      agency_id: activeAgencyId,
      client_id: activeClientId,
      coa_id: coa.id,
      item_name: coa.account_name,
      amount: rounded,
      is_active: true,
    };
    const { error } = existing
      ? await supabase.from("fee_items").update(payload).eq("id", existing.id)
      : await supabase.from("fee_items").insert([payload]);
    if (!error) fetchFeeItems();
  });
}, [coaList, contributionTotals, feeItemsMap, activeAgencyId, activeClientId, activeGroupId]);
  // Seed the editable amount inputs whenever the account list or the
  // client's saved amounts change.
  useEffect(() => {
    const next = {};
    coaList.forEach((c) => {
      next[c.id] = feeItemsMap[c.id]?.amount ?? "";
    });
    setAmounts(next);
  }, [coaList, feeItemsMap]);

  const filteredCoa = useMemo(() => {
    const q = search.toLowerCase();
    return coaList.filter(
      (c) => !q || [c.code, c.account_name].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [coaList, search]);

  const availedCount = coaList.filter((c) => feeItemsMap[c.id]).length;

  // ── SAVE / REMOVE a single account's amount for this client ─────────────
  const handleSaveRow = async (coa) => {
    const raw = amounts[coa.id];
    if (raw === "" || raw === null || raw === undefined || isNaN(Number(raw))) {
      flash("Enter a valid amount first.", "error");
      return;
    }
    setRowSaving((p) => ({ ...p, [coa.id]: true }));
    const existing = feeItemsMap[coa.id];
    const payload = {
      group_id: activeGroupId,
      agency_id: activeAgencyId,
      client_id: activeClientId,
      coa_id: coa.id,
      item_name: coa.account_name,
      amount: Number(raw),
      is_active: true,
    };
    const { error } = existing
      ? await supabase.from("fee_items").update(payload).eq("id", existing.id)
      : await supabase.from("fee_items").insert([payload]);

    if (error) {
      flash(`Error: ${error.message}`, "error");
    } else {
      flash(`✓ ${coa.account_name} saved for ${activeClient?.business_name || "client"}.`);
      fetchFeeItems();
    }
    setRowSaving((p) => ({ ...p, [coa.id]: false }));
  };

  const handleRemoveRow = async (coa) => {
    const existing = feeItemsMap[coa.id];
    if (!existing) return;
    if (!window.confirm(`Remove "${coa.account_name}" from this client's billing?`)) return;
    const { error } = await supabase.from("fee_items").delete().eq("id", existing.id);
    if (error) flash(`Error: ${error.message}`, "error");
    else {
      flash("✓ Removed.");
      fetchFeeItems();
    }
  };

 const openScheduleModal = async (coa) => {
  // 1. Ensure may fee_items row muna (parent record) para sa client+account na ito
  let feeItem = feeItemsMap[coa.id];
  if (!feeItem) {
    const { data, error } = await supabase
      .from("fee_items")
      .insert([{
        group_id: activeGroupId,
        agency_id: activeAgencyId,
        client_id: activeClientId,
        coa_id: coa.id,
        item_name: coa.account_name,
        amount: null,
        is_active: true,
      }])
      .select()
      .single();
    if (error) return flash(`Error: ${error.message}`, "error");
    feeItem = data;
    fetchFeeItems();
  }

  // 2. Fetch lahat ng existing Rent Fee schedules (para sa picker)
  setLoadingRentFees(true);
  const { data: rfData, error: rfError } = await supabase
    .from("rent_fees")
    .select("*, rent_fee_details(*)")
    .order("rf_code", { ascending: true });
  setLoadingRentFees(false);

  if (rfError) return flash(`Error loading rent fees: ${rfError.message}`, "error");

  setScheduleTarget({ coa, feeItem });
  setRentFeesList(rfData || []);
  setScheduleModalOpen(true);
};  
const handleSelectRentFee = async (rentFee) => {
  const { error } = await supabase
    .from("fee_items")
    .update({ rent_fee_id: rentFee.id })
    .eq("id", scheduleTarget.feeItem.id);

  if (error) flash(`Error: ${error.message}`, "error");
  else {
    flash(`✓ ${rentFee.rf_code} linked to ${scheduleTarget.coa.account_name}.`);
    setScheduleModalOpen(false);
    fetchFeeItems();
  }
};

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">Batch Billing</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Pick a client, then set per-account amounts sourced from the Chart of Accounts
            </p>
          </div>
        </div>

        {/* MESSAGE */}
        {message && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-lg text-xs flex items-center justify-between border
            ${
              messageType === "success"
                ? "bg-white border-gray-200 text-gray-700"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            <span className="flex items-center gap-2">
              {messageType === "success" && <FaCheck size={9} className="text-gray-400" />}
              {message}
            </span>
            <button onClick={() => setMessage("")} className="ml-4 text-gray-300 hover:text-gray-500">
              <FaTimes size={10} />
            </button>
          </div>
        )}

        {/* STEP 1: CLIENT PICKER */}
        {!activeClientId ? (
          <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative w-full max-w-sm">
                <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={10} />
                <input
                  type="text"
                  autoFocus
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search by business name, trade name, or client ID…"
                  className="w-full py-2 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100"
                />
              </div>
            </div>

            {loadingClients ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-5 h-5 border border-gray-300 rounded-full border-t-gray-700 animate-spin" />
              </div>
            ) : clients.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-gray-300">No clients found</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c)}
                      className="flex items-center justify-between w-full px-4 py-3 text-left transition hover:bg-gray-50/60"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {c.business_name || c.trade_name || "—"}
                        </p>
                        {c.trade_name && c.business_name && (
                          <p className="text-xs text-gray-400">{c.trade_name}</p>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-gray-400">{c.client_id}</span>
                    </button>
                  ))}
                </div>

                {/* PAGINATION */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-50 text-[11px] text-gray-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Showing {(clientPage - 1) * clientPageSize + 1}–
                      {Math.min(clientPage * clientPageSize, clientTotal)} of {clientTotal}
                    </span>
                    <select
                      value={clientPageSize}
                      onChange={(e) => setClientPageSize(Number(e.target.value))}
                      className={selectCls}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n} / page
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                      disabled={clientPage === 1}
                      className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    <span className="px-2">
                      Page {clientPage} of {clientTotalPages}
                    </span>
                    <button
                      onClick={() => setClientPage((p) => Math.min(clientTotalPages, p + 1))}
                      disabled={clientPage === clientTotalPages}
                      className="px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        
      ) : (
          <>
            {/* ACTIVE CLIENT BAR */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 mb-5 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 text-gray-500 bg-gray-100 rounded-full">
                  <FaUser size={12} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {activeClient?.business_name || activeClient?.trade_name}
                  </p>
                  <p className="font-mono text-[11px] text-gray-400">{activeClient?.client_id}</p>
                </div>
              </div>
                          <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewOpen(true)}
                  title="Preview Create Billing"
                  className="relative flex items-center justify-center w-8 h-8 text-gray-600 transition border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-blue-600"
                >
                  <FaEye size={13} />
                               {previewCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white bg-black rounded-full">
                      {previewCount}
                    </span>
                  )}
                  {previewWarnCount > 0 && (
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-3 h-3 text-[8px] font-bold text-black bg-white border border-black rounded-full">
                      !
                    </span>
                  )}
                
                </button>
                <button
                  onClick={changeClient}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <FaArrowLeft size={9} /> Change client
                </button>
              </div>
            </div>
       

            {/* LEVEL 1: GROUP TABS (read-only) */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {loadingGroups ? (
                <span className="text-xs text-gray-400">Loading groups…</span>
              ) : groups.length === 0 ? (
                <span className="text-xs text-gray-400">No groups yet — add one in Chart of Accounts.</span>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2
                      ${
                        activeGroupId === g.id
                          ? "bg-gray-900 text-white shadow-sm"
                          : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                      }`}
                  >
                    <FaLayerGroup size={11} /> {g.label}
                  </button>
                ))
              )}
            </div>

            {/* LEVEL 2: AGENCY TABS (read-only) */}
            <div className="flex flex-wrap items-center gap-1.5 mb-5 p-1.5 bg-white border border-gray-200 rounded-xl">
              {loadingAgencies ? (
                <span className="px-2 text-xs text-gray-400">Loading agencies…</span>
              ) : agencies.length === 0 ? (
                <span className="px-2 text-xs text-gray-400">
                  No agencies under {activeGroup?.label || "this group"} yet — add one in Chart of Accounts.
                </span>
              ) : (
                agencies.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setActiveAgencyId(a.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition
                      ${
                        activeAgencyId === a.id
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                  >
                    {a.name}
                  </button>
                ))
              )}
            </div>

            {/* LEVEL 3: ACCOUNTS + AMOUNT PER CLIENT */}
            <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <FaBuilding size={12} className="text-gray-400" />
                    {activeGroup ? activeGroup.label : "—"} {activeAgency ? `→ ${activeAgency.name}` : ""}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {availedCount} of {coaList.length} account{coaList.length !== 1 ? "s" : ""} availed
                  </span>
                </div>
                <div className="relative w-56">
                  <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={10} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search account…"
                    className="w-full py-1.5 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 bg-white"
                  />
                </div>
              </div>

              {!activeAgencyId ? (
                <div className="py-24 text-center">
                  <p className="text-sm font-medium text-gray-300">Pick a group and an agency above</p>
                </div>
              ) : loadingCoa ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-5 h-5 border border-gray-300 rounded-full border-t-gray-700 animate-spin" />
                </div>
              ) : filteredCoa.length === 0 ? (
                <div className="py-24 text-center">
                  <p className="text-sm font-medium text-gray-300">No accounts under this agency yet</p>
                  <p className="mt-1 text-xs text-gray-200">Add accounts from the Chart of Accounts page</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
<thead>
  <tr className="border-b border-gray-100">
    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      Account
    </th>
    <th className="w-48 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      Amount
    </th>
    <th className="w-20 px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      Actions
    </th>
  </tr>
</thead>
<tbody>
{filteredCoa.map((coa) => {
  const availed = !!feeItemsMap[coa.id];
  const saving = !!rowSaving[coa.id];
  const t = coa.tax_setup;
  const taxSaving = t ? !!taxRowSaving[t.tax_type] : false;
  const saved = t ? clientTaxMap[t.tax_type] : null;
  const e = t ? (taxEdits[t.tax_type] || {}) : {};

  return (
    <tr key={coa.id} className="transition-colors border-b border-gray-50 hover:bg-gray-50/60">
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-gray-800">{coa.account_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
            {coa.code || "—"}
          </span>
          {t ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${saved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              {saved ? "Set" : "Not set"}
            </span>
          ) : (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${availed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              {availed ? "Availed" : "Not availed"}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        {coa.billing_mode === "contribution" ? (
  <div className="flex flex-col items-end gap-1">
    <span className="font-mono text-sm font-semibold text-gray-800">
      ₱{Number(contributionTotals[coa.contribution_key] || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
    </span>
    <span className="text-[10px] text-gray-400">Auto from Employee Mgmt</span>
  </div>
) : coa.billing_mode === "schedule" ? (
          <div className="flex justify-end">
            <button
              onClick={() => openScheduleModal(coa)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              {feeItemsMap[coa.id]?.rent_fees?.rf_code
                ? `${feeItemsMap[coa.id].rent_fees.rf_code} · Change`
                : "Select Schedule"}
            </button>
          </div>
        ) : t && t.computation_type === "fixed" ? (
          // ── FIXED: direct inline input, walang modal ──
          <input
            type="number" step="0.01"
            value={e.fixed_amount ?? ""}
            onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], fixed_amount: ev.target.value } }))}
            placeholder="0.00"
            className={`${inputCls} text-right`}
          />
        ) : t ? (
          // ── PERCENTAGE / TABLE / MANUAL: button na nagbubukas ng modal ──
          (() => {
              const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
      const displayAmount =
    t.computation_type === "manual" ? saved?.fixed_amount
    : t.computation_type === "percentage" ? saved?.payable  // ngayon Total na ito
    : t.computation_type === "table" ? saved?.payable
    : null;
            return (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => { setTaxModalTarget({ coa, t }); setTaxModalOpen(true); }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  {saved ? "Edit Amount" : "Compute Tax"}
                </button>
                {saved && displayAmount != null && (
                  <span className="font-mono text-sm font-semibold text-gray-800">
                    ₱{fmt(displayAmount)}
                  </span>
                )}
              </div>
            );
          })()
        ) : (
          // ── PLAIN MANUAL AMOUNT (walang tax config) ──
          <input
            type="number"
            step="0.01"
            value={amounts[coa.id] ?? ""}
            onChange={(e) => setAmounts((p) => ({ ...p, [coa.id]: e.target.value }))}
            placeholder="0.00"
            className={`${inputCls} text-right`}
          />
        )}
      </td>

      <td className="px-4 py-3 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          {t && t.computation_type === "fixed" ? (
            <button
              onClick={() => handleSaveTax(t)}
              disabled={taxSaving}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-40"
              title="Save"
            >
              {taxSaving ? <span className="block w-3 h-3 border border-gray-400 rounded-full border-t-transparent animate-spin" /> : <FaCheck size={11} />}
            </button>
                ) : !t && coa.billing_mode !== "schedule" && coa.billing_mode !== "contribution" ? (            <>
              <button onClick={() => handleSaveRow(coa)} disabled={saving} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-40" title="Save amount">
                {saving ? <span className="block w-3 h-3 border border-gray-400 rounded-full border-t-transparent animate-spin" /> : <FaCheck size={11} />}
              </button>
              {(amounts[coa.id] ?? "") !== "" && (
                <button onClick={() => setAmounts((p) => ({ ...p, [coa.id]: "" }))} className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Clear amount">
                  <FaTimes size={10} />
                </button>
              )}
              {availed && (
                <button onClick={() => handleRemoveRow(coa)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Remove from client billing">
                  <FaTrash size={10} />
                </button>
              )}
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
})}
</tbody>
                  </table>
                </div>
              )}
                    </div>

       
               {/* PREVIEW MODAL: Create Billing */}
            {previewOpen && (() => {
              const renderGroup = (title, category) => {
                const rows = previewRows.filter((r) => r.category === category);
                const scheds = previewSchedules.filter((s) => s.category === category);
                if (rows.length === 0 && scheds.length === 0) return null;
                return (
                  <div className="border-t border-gray-200 first:border-t-0">
                    <div className="flex items-center justify-between px-6 py-2 bg-gray-100">
                      <span className="text-[11px] font-bold tracking-widest text-black uppercase">{title}</span>
                      <span className="font-mono text-xs font-semibold text-black">
                        {peso(previewTotals[category])}
                      </span>
                    </div>

                    {rows.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 text-[11px] border-b border-gray-200">
                            <th className="px-6 py-2 font-semibold text-left w-28">Code</th>
                            <th className="px-3 py-2 font-semibold text-left w-36">Agency</th>
                            <th className="px-3 py-2 font-semibold text-left">Description</th>
                            <th className="px-6 py-2 font-semibold text-right w-36">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((r, i) => (
                            <tr key={i}>
                              <td className="px-6 py-2 font-mono text-gray-600">{r.code || "—"}</td>
                              <td className="px-3 py-2 text-gray-600">{r.agency}</td>
                              <td className="px-3 py-2 text-black">{r.description}</td>
                              <td className="px-6 py-2 font-mono text-right text-black">
                                {r.amount === 0 ? <span className="text-gray-400">{peso(r.amount)}</span> : peso(r.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {scheds.map((acc, idx) => (
                      <div key={idx} className="px-6 py-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-black">
                            {acc.description}{" "}
                            <span className="ml-1 font-normal text-gray-500">({acc.rf_code})</span>
                          </p>
                          <span className="font-mono text-xs font-semibold text-black">{peso(acc.total)}</span>
                        </div>
                        <table className="w-full text-[11px] border border-gray-200">
                          <thead>
                            <tr className="text-gray-500 bg-gray-50">
                              <th className="px-3 py-1.5 text-left font-semibold">Year</th>
                              <th className="px-3 py-1.5 text-left font-semibold">Period</th>
                              <th className="px-3 py-1.5 text-right font-semibold">Net of VAT</th>
                              <th className="px-3 py-1.5 text-right font-semibold">VAT</th>
                              <th className="px-3 py-1.5 text-right font-semibold">WTAX</th>
                            </tr>
                          </thead>
                          <tbody>
                            {acc.details.map((d, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 font-bold text-black">{d.year}</td>
                                <td className="px-3 py-1.5 text-gray-600">
                                  {d.period_start} – {d.period_end}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-right">{peso(d.net_of_vat)}</td>
                                <td className="px-3 py-1.5 font-mono text-right">{peso(d.vat)}</td>
                                <td className="px-3 py-1.5 font-mono text-right">{peso(d.wtax)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              };

              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="flex flex-col w-full max-w-3xl overflow-hidden bg-white border border-gray-300 shadow-xl rounded-xl max-h-[88vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                      <div>
                        <h2 className="text-sm font-semibold text-black">Billing Preview</h2>
                        <p className="text-xs text-gray-500">
                          {activeClient?.business_name || activeClient?.trade_name} ·{" "}
                          <span className="font-mono">{activeClient?.client_id}</span> · {previewCount} item
                          {previewCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={fetchPreview}
                          disabled={loadingPreview}
                          className="px-2.5 py-1 text-[11px] font-medium text-black border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-40"
                        >
                          {loadingPreview ? "Refreshing…" : "Refresh"}
                        </button>
                        <button onClick={() => setPreviewOpen(false)} className="text-gray-500 hover:text-black">
                          <FaTimes size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto">
                                            {previewIssues.length > 0 && (
                        <div className="px-6 py-3 space-y-1.5 border-b border-gray-200">
                          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Checks</p>
                          {previewIssues.map((iss, i) => (
                            <div key={i} className="px-3 py-2 text-xs text-black border border-gray-300 rounded-md">
                              ! {iss.text}
                            </div>
                          ))}
                        </div>
                      )}

                      {previewCount === 0 ? (
                        <div className="py-16 text-center">
                          <p className="text-sm text-gray-400">No billing items for this client yet</p>
                        </div>
                      ) : (
                        <>
                          {renderGroup("Income", "income")}
                          {renderGroup("Remittances", "remittance")}
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
                      <div className="flex items-end justify-between gap-4">
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between gap-8">
                            <span>Income</span>
                            <span className="font-mono text-black">{peso(previewTotals.income)}</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span>Remittances</span>
                            <span className="font-mono text-black">{peso(previewTotals.remittance)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Subtotal</p>
                          <p className="font-mono text-xl font-bold text-black">{peso(previewTotals.subtotal)}</p>
                        </div>
                        <button
                          onClick={() => setPreviewOpen(false)}
                          className="px-4 py-2 text-sm font-semibold text-white bg-black rounded-lg hover:bg-gray-800"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
{taxModalOpen && taxModalTarget && (() => {
  const { coa, t } = taxModalTarget;
  const e = taxEdits[t.tax_type] || {};
  const saving = !!taxRowSaving[t.tax_type];
  const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const rate = parseFloat(t.default_rate) || 0;
  const sales = parseFloat(e.sales_amount) || 0;
  const purchase = parseFloat(e.purchase_amount) || 0;
  const outputTax = sales * (rate / 100);
  const inputTax = purchase * (rate / 100);
  const payable = outputTax - inputTax;
  const total = sales + outputTax;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-sm overflow-hidden bg-white shadow-xl rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Compute Tax</h2>
            <p className="text-xs text-gray-400">{coa.account_name}</p>
          </div>
          <button onClick={() => setTaxModalOpen(false)} className="text-gray-400 hover:text-gray-600">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* ── FIXED ── */}
          {t.computation_type === "fixed" && (
            <div>
              <label className="block mb-1.5 text-sm font-medium text-gray-600">Amount</label>
              <input
                type="number" step="0.01"
                value={e.fixed_amount ?? ""}
                onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], fixed_amount: ev.target.value } }))}
                placeholder="0.00"
                className={`${inputCls} text-right text-lg`}
                autoFocus
              />
            </div>
          )}

          {/* ── MANUAL ── */}
          {t.computation_type === "manual" && (
            <div className="space-y-3">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-600">Rate (%)</label>
                <input
                  type="number" step="0.01"
                  value={e.rate ?? ""}
                  onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], rate: ev.target.value } }))}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-600">Amount</label>
                <input
                  type="number" step="0.01"
                  value={e.fixed_amount ?? ""}
                  onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], fixed_amount: ev.target.value } }))}
                  placeholder="0.00"
                  className={`${inputCls} text-right`}
                />
              </div>
            </div>
          )}

          {/* ── PERCENTAGE ── */}
          {t.computation_type === "percentage" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 text-xs border border-gray-100 rounded-lg bg-gray-50">
                <span className="text-gray-500">Rate</span>
                <span className="font-mono font-semibold text-gray-800">{rate}%</span>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-600">Base Amount</label>
                <input
                  type="number" step="0.01"
                  value={e.sales_amount ?? ""}
                  onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], sales_amount: ev.target.value } }))}
                  placeholder="0.00"
                  className={`${inputCls} text-right text-lg`}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 py-2 text-xs border border-gray-100 rounded-lg bg-gray-50">
                <div className="text-right">
                  <span className="block text-gray-400">Tax</span>
                  <span className="font-mono font-semibold text-gray-800">₱{fmt(outputTax)}</span>
                </div>
                <div className="text-right">
                  <span className="block text-gray-400">Total (with Tax)</span>
                  <span className="font-mono font-semibold text-blue-700">₱{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── TABLE ── */}
          {t.computation_type === "table" && (
            <>
              <div className="flex items-center justify-between px-3 py-2 text-xs border border-gray-100 rounded-lg bg-gray-50">
                <span className="text-gray-500">Rate</span>
                <span className="font-mono font-semibold text-gray-800">{rate}%</span>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3">
                <label className="text-sm font-medium text-gray-600">Sales</label>
                <input
                  type="number" step="0.01"
                  value={e.sales_amount ?? ""}
                  onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], sales_amount: ev.target.value } }))}
                  placeholder="0.00"
                  className={`${inputCls} w-32 text-right`}
                />

                <label className="text-sm text-gray-500">Output Tax</label>
                <span className="w-32 font-mono text-sm font-semibold text-right text-gray-800">₱{fmt(outputTax)}</span>

                <div className="col-span-2 my-1 border-t border-gray-100" />

                <label className="text-sm font-medium text-gray-600">Purchase</label>
                <input
                  type="number" step="0.01"
                  value={e.purchase_amount ?? ""}
                  onChange={(ev) => setTaxEdits((p) => ({ ...p, [t.tax_type]: { ...p[t.tax_type], purchase_amount: ev.target.value } }))}
                  placeholder="0.00"
                  className={`${inputCls} w-32 text-right`}
                />

                <label className="text-sm text-gray-500">Input Tax</label>
                <span className="w-32 font-mono text-sm font-semibold text-right text-gray-800">₱{fmt(inputTax)}</span>

                <div className="col-span-2 my-1 border-t border-gray-100" />

                <label className="text-sm font-bold text-gray-800">Payable</label>
                <span className={`w-32 font-mono text-base font-bold text-right ${payable < 0 ? "text-red-600" : "text-gray-900"}`}>
                  ₱{fmt(payable)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setTaxModalOpen(false)}
            className="flex-1 py-2 text-sm font-medium text-gray-600 transition border border-gray-200 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await handleSaveTax(t);
              setTaxModalOpen(false);
            }}
            disabled={saving}
            className="flex items-center justify-center flex-1 gap-2 py-2 text-sm font-semibold text-white transition bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? <span className="w-3.5 h-3.5 border border-white rounded-full border-t-transparent animate-spin" /> : <FaCheck size={11} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
})()}
{scheduleModalOpen && scheduleTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div className="w-full max-w-lg overflow-hidden bg-white shadow-xl rounded-2xl max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">
          Select Rent Fee Schedule — {scheduleTarget.coa.account_name}
        </h2>
        <button
          onClick={() => setScheduleModalOpen(false)}
          className="text-sm font-semibold text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 px-6 py-5 space-y-2 overflow-y-auto">
        {loadingRentFees ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border border-gray-300 rounded-full border-t-gray-700 animate-spin" />
          </div>
        ) : rentFeesList.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-gray-400">No rent fee schedules yet.</p>
            <p className="mt-1 text-xs text-gray-300">
              Set one up first in the Rent Fees maintenance page.
            </p>
          </div>
        ) : (
          rentFeesList.map((rf) => {
            const details = (rf.rent_fee_details || []).slice().sort((a, b) => a.year - b.year);
            const isSelected = scheduleTarget.feeItem.rent_fee_id === rf.id;
            return (
              <button
                key={rf.id}
                onClick={() => handleSelectRentFee(rf)}
                className={`w-full text-left px-4 py-3 border rounded-xl transition
                  ${isSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-700">{rf.rf_code}</span>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Selected</span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {details.map((d) => (
                    <p key={d.id} className="text-xs text-gray-500">
                      Year {d.year}: {d.period_start} – {d.period_end} · ₱{Number(d.net_of_vat || 0).toLocaleString()}
                    </p>
                  ))}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
        <button
          onClick={() => setScheduleModalOpen(false)}
          className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
          </>
        )}
      </div>
    </div>
  );
}