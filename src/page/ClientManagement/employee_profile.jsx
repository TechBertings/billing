import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaSearch,
  FaUserPlus,
  FaArrowLeft,
  FaEdit,
  FaTrash,
  FaTimes,
  FaUsers,
  FaSave,
  FaUndo,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import {
  inputCls,
  selectCls,
  Field,
  ACCENT,
} from "../../client_steps/shared_ui";
import {
  computeSSS,
  computePHIC,
  computeHDMF,
} from "../../utils/govt_contributions";
import { useContributionConfig } from "../../utils/use_contributions";
import { useSSSBrackets } from "../../utils/use_sss_brackets";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getClientPrimaryName = (c) =>
  c.business_name ||
  [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ") ||
  c.client_id;

const composeEmpName = (f) => {
  const last = [f.last_name, f.suffix].filter(Boolean).join(" ");
  const first = [f.first_name, f.middle_name].filter(Boolean).join(" ");
  return [last, first].filter(Boolean).join(", ");
};

const emptyEmployee = {
  id: null,
  emp_code: "",
  emp_name: "",
  last_name: "",
  first_name: "",
  middle_name: "",
  suffix: "",
  position: "",
  salary_bracket: "",
  date_of_birth: "",
  start_of_employment: "",
  start_of_contribution: "",
  tin: "",
  sss_emp_no: "",
  phic_emp_no: "",
  hdmf_emp_no: "",
  sss_loan: "",
  pagibig_loan: "",
  remarks: "",
  status: "Active",
  sss_ee: "",
  sss_er: "",
  phic_ee: "",
  phic_er: "",
  hdmf_ee: "",
  hdmf_er: "",
};

const generateEmpCode = async (clientId) => {
  const { data } = await supabase
    .from("employee_profile")
    .select("emp_code")
    .eq("client_id", clientId)
    .order("emp_code", { ascending: false })
    .limit(1);
  const last = data?.[0]?.emp_code?.split("-").pop();
  const next = String((parseInt(last) || 0) + 1).padStart(3, "0");
  return `EMP-${next}`;
};


const recomputeContributions = (salary, sssBrackets, cfg) => {
  const s = computeSSS(salary, sssBrackets);
  const p = computePHIC(salary, cfg);
  const h = computeHDMF(salary, cfg);
  return {
    sss_ee: s.ee,
    sss_er: s.er,
    phic_ee: p.ee,
    phic_er: p.er,
    hdmf_ee: h.ee,
    hdmf_er: h.er,
  };
};

export default function EmployeeProfile() {
  const { config: cfg, loading: cfgLoading } = useContributionConfig();
  // SSS is fully separate now — sourced from sss_bracket_table, hindi na
  // galing sa contribution_config (see ContributionRates.jsx).
  const { brackets: sssBrackets, loading: sssLoading } = useSSSBrackets();

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [empCounts, setEmpCounts] = useState({});

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyEmployee);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    const { data, error } = await supabase
      .from("client_profile")
      .select(
        "id, client_id, business_name, trade_name, first_name, middle_name, last_name, tin, account, status, approval_status",
      )
      .eq("approval_status", "approved")
      .order("business_name", { ascending: true });
    if (!error) setClients(data || []);
    setClientsLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase
        .from("employee_profile")
        .select("client_id");
      const counts = {};
      (data || []).forEach((r) => {
        if (!r.client_id) return;
        counts[r.client_id] = (counts[r.client_id] || 0) + 1;
      });
      setEmpCounts(counts);
    };
    fetchCounts();
  }, [employees]);

  const filteredClients = clients.filter((c) => {
    const term = clientSearch.toLowerCase();
    if (!term) return true;
    return (
      getClientPrimaryName(c).toLowerCase().includes(term) ||
      (c.client_id || "").toLowerCase().includes(term) ||
      (c.trade_name || "").toLowerCase().includes(term) ||
      (c.tin || "").toLowerCase().includes(term)
    );
  });

  const fetchEmployees = useCallback(async (clientId) => {
    setEmpLoading(true);
    const { data, error } = await supabase
      .from("employee_profile")
      .select("*")
      .eq("client_id", clientId)
      .order("last_name", { ascending: true });
    if (!error) setEmployees(data || []);
    setEmpLoading(false);
  }, []);

  const openClient = (c) => {
    setSelectedClient(c);
    setEmpSearch("");
    fetchEmployees(c.client_id);
  };

  const backToClients = () => {
    setSelectedClient(null);
    setEmployees([]);
    fetchClients();
  };

  const filteredEmployees = employees.filter((e) => {
    const term = empSearch.toLowerCase();
    if (!term) return true;
    return (
      (e.emp_name || "").toLowerCase().includes(term) ||
      (e.last_name || "").toLowerCase().includes(term) ||
      (e.first_name || "").toLowerCase().includes(term) ||
      (e.position || "").toLowerCase().includes(term) ||
      (e.emp_code || "").toLowerCase().includes(term)
    );
  });

  const openAddModal = async () => {
    const code = await generateEmpCode(selectedClient.client_id);
    setForm({ ...emptyEmployee, emp_code: code });
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setForm({
      ...emptyEmployee,
      ...emp,
      sss_ee: emp.sss_ee ?? "",
      sss_er: emp.sss_er ?? "",
      phic_ee: emp.phic_ee ?? "",
      phic_er: emp.phic_er ?? "",
      hdmf_ee: emp.hdmf_ee ?? "",
      hdmf_er: emp.hdmf_er ?? "",
    });
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setForm(emptyEmployee);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      if (name === "salary_bracket") {
        const r = recomputeContributions(
          parseFloat(value) || 0,
          sssBrackets,
          cfg,
        );
        Object.assign(next, {
          sss_ee: String(r.sss_ee),
          sss_er: String(r.sss_er),
          phic_ee: String(r.phic_ee),
          phic_er: String(r.phic_er),
          hdmf_ee: String(r.hdmf_ee),
          hdmf_er: String(r.hdmf_er),
        });
      }
      return next;
    });
  };

  const handleRecalculate = () => {
    const r = recomputeContributions(
      parseFloat(form.salary_bracket) || 0,
      sssBrackets,
      cfg,
    );
    setForm((p) => ({
      ...p,
      sss_ee: String(r.sss_ee),
      sss_er: String(r.sss_er),
      phic_ee: String(r.phic_ee),
      phic_er: String(r.phic_er),
      hdmf_ee: String(r.hdmf_ee),
      hdmf_er: String(r.hdmf_er),
    }));
  };
  const salaryNum = parseFloat(form.salary_bracket) || 0;
  // SSS: bracket-table lookup na lang (2 args). PHIC/HDMF: cfg pa rin.
  const sss = useMemo(
    () => computeSSS(salaryNum, sssBrackets),
    [salaryNum, sssBrackets],
  );
  const phic = useMemo(() => computePHIC(salaryNum, cfg), [salaryNum, cfg]);
  const hdmf = useMemo(() => computeHDMF(salaryNum, cfg), [salaryNum, cfg]);
  const sssLoanNum = parseFloat(form.sss_loan) || 0;
  const pagibigLoanNum = parseFloat(form.pagibig_loan) || 0;
  const eeTotal =
    (parseFloat(form.sss_ee) || 0) +
    (parseFloat(form.phic_ee) || 0) +
    (parseFloat(form.hdmf_ee) || 0) +
    sssLoanNum +
    pagibigLoanNum;
  const erTotal =
    (parseFloat(form.sss_er) || 0) +
    (parseFloat(form.phic_er) || 0) +
    (parseFloat(form.hdmf_er) || 0);

  const handleSave = async () => {
    if (!form.last_name.trim() || !form.first_name.trim()) {
      setMessage("Please enter the employee's last name and first name.");
      setMessageType("error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: selectedClient.client_id,
        emp_code: form.emp_code,
        emp_name: composeEmpName(form),
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name,
        suffix: form.suffix,
        position: form.position,
        salary_bracket: parseFloat(form.salary_bracket) || 0,
        date_of_birth: form.date_of_birth || null,
        start_of_employment: form.start_of_employment || null,
        start_of_contribution: form.start_of_contribution || null,
        tin: form.tin,
        sss_emp_no: form.sss_emp_no,
        phic_emp_no: form.phic_emp_no,
        hdmf_emp_no: form.hdmf_emp_no,
        sss_loan: parseFloat(form.sss_loan) || 0,
        pagibig_loan: parseFloat(form.pagibig_loan) || 0,
        remarks: form.remarks,
        status: form.status || "Active",
        sss_ee: parseFloat(form.sss_ee) || 0,
        sss_er: parseFloat(form.sss_er) || 0,
        phic_ee: parseFloat(form.phic_ee) || 0,
        phic_er: parseFloat(form.phic_er) || 0,
        hdmf_ee: parseFloat(form.hdmf_ee) || 0,
        hdmf_er: parseFloat(form.hdmf_er) || 0,
      };

      if (form.id) {
        const { error } = await supabase
          .from("employee_profile")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_profile")
          .insert([payload]);
        if (error) throw error;
      }

      setMessage(form.id ? "Employee updated." : "Employee added.");
      setMessageType("success");
      closeModal();
      fetchEmployees(selectedClient.client_id);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType("error");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 4000);
  };

  const handleDelete = async (emp) => {
    if (
      !window.confirm(
        `Remove ${emp.emp_name} from this client's employee list?`,
      )
    )
      return;
    const { error } = await supabase
      .from("employee_profile")
      .delete()
      .eq("id", emp.id);
    if (!error) fetchEmployees(selectedClient.client_id);
  };

  const totals = employees.reduce(
    (acc, e) => {
      const sEc = computeSSS(e.salary_bracket, sssBrackets).ec; // EC hindi naka-store, kailangan pa rin i-compute
      const sEe = Number(e.sss_ee) || 0;
      const sEr = Number(e.sss_er) || 0;
      const pEe = Number(e.phic_ee) || 0;
      const pEr = Number(e.phic_er) || 0;
      const hEe = Number(e.hdmf_ee) || 0;
      const hEr = Number(e.hdmf_er) || 0;

      acc.salary += Number(e.salary_bracket) || 0;
      acc.sssEr += sEr;
      acc.sssEe += sEe;
      acc.sssEc += sEc;
      acc.sssTotal += sEe + sEr + sEc;
      acc.phicEr += pEr;
      acc.phicEe += pEe;
      acc.phicTotal += pEe + pEr;
      acc.hdmfEr += hEr;
      acc.hdmfEe += hEe;
      acc.hdmfTotal += hEe + hEr;
      acc.sssLoan += Number(e.sss_loan) || 0;
      acc.pagibigLoan += Number(e.pagibig_loan) || 0;
      return acc;
    },
    {
      salary: 0,
      sssEr: 0,
      sssEe: 0,
      sssEc: 0,
      sssTotal: 0,
      phicEr: 0,
      phicEe: 0,
      phicTotal: 0,
      hdmfEr: 0,
      hdmfEe: 0,
      hdmfTotal: 0,
      sssLoan: 0,
      pagibigLoan: 0,
    },
  );
  const totalEE =
    totals.sssEe +
    totals.phicEe +
    totals.hdmfEe +
    totals.sssLoan +
    totals.pagibigLoan;
  const totalER = totals.sssEr + totals.phicEr + totals.hdmfEr;

  const TOTAL_COLS = 24;

  if (!selectedClient) {
    return (
      <div className="px-6 py-6">
        <div className="pb-5 mb-6 border-b border-slate-200">
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-1">
            Employee Management
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Select a Client
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a client to view or manage their employees.
          </p>
        </div>

        <div className="relative max-w-md mb-4">
          <FaSearch
            className="absolute -translate-y-1/2 text-slate-300 left-3 top-1/2"
            size={12}
          />
          <input
            type="text"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search client name, ID, or TIN..."
            className={`${inputCls} pl-9`}
          />
        </div>

        <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase">
                  Client ID
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase">
                  Business Name
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase">
                  TIN
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase">
                  Account
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase">
                  Employees
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clientsLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading clients...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No active clients found.
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClient(c)}
                    className="transition cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {c.client_id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {getClientPrimaryName(c)}
                      </p>
                      {c.trade_name && (
                        <p className="text-xs text-slate-400">{c.trade_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.tin || "—"}</td>
                    <td className="px-4 py-3">
                      {c.account ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                          {c.account}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-right text-slate-700">
                      {empCounts[c.client_id] || 0}
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      <FaUsers size={12} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <button
        onClick={backToClients}
        className="flex items-center gap-2 mb-4 text-sm font-medium transition text-slate-500 hover:text-slate-700"
      >
        <FaArrowLeft size={11} /> Back to Clients
      </button>

      <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-1">
            Employee Management
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {getClientPrimaryName(selectedClient)}
          </h1>
          <p className="mt-1 font-mono text-sm text-slate-500">
            {selectedClient.client_id}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white transition rounded-md hover:opacity-90"
          style={{ background: ACCENT }}
        >
          <FaUserPlus size={12} /> Add Employee
        </button>
      </div>

      {!cfgLoading && !cfg && (
        <div className="px-4 py-3 mb-4 text-sm border-l-4 rounded-md bg-amber-50 border-amber-500 text-amber-700">
          No contribution rate schedule found. PhilHealth and Pag-IBIG
          contributions will show as ₱0.00 until you add one in Maintenance →
          Contribution Rates.
        </div>
      )}

      {!sssLoading && sssBrackets.length === 0 && (
        <div className="px-4 py-3 mb-4 text-sm border-l-4 rounded-md bg-amber-50 border-amber-500 text-amber-700">
          No SSS brackets found. SSS contributions will show as ₱0.00 until you
          set up the bracket table in Maintenance → SSS EE Bracket Table.
        </div>
      )}

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-md text-sm border-l-4
          ${messageType === "success" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}
        >
          {message}
        </div>
      )}

      <div className="relative max-w-sm mb-4">
        <FaSearch
          className="absolute -translate-y-1/2 text-slate-300 left-3 top-1/2"
          size={12}
        />
        <input
          type="text"
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          placeholder="Search employee name or position..."
          className={`${inputCls} pl-9`}
        />
      </div>

      <div className="overflow-x-auto bg-white border rounded-lg border-slate-200">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-400">
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th
                colSpan={4}
                className="px-3 py-1.5 text-center font-semibold uppercase bg-emerald-50/60 border-l border-emerald-100"
              >
                SSS
              </th>
              <th
                colSpan={3}
                className="px-3 py-1.5 text-center font-semibold uppercase bg-sky-50/60 border-l border-sky-100"
              >
                PHIC
              </th>
              <th
                colSpan={3}
                className="px-3 py-1.5 text-center font-semibold uppercase bg-amber-50/60 border-l border-amber-100"
              >
                HDMF
              </th>
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              <th
                colSpan={7}
                className="px-3 py-1.5 text-center font-semibold uppercase bg-slate-100 border-l border-slate-200"
              >
                Employee Details
              </th>
              <th className="w-16" />
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-400">
              <th className="px-3 py-2.5 text-left font-semibold uppercase">
                Full Name
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase">
                Salary Bracket
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-emerald-50/50 border-l border-emerald-100">
                ER Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-emerald-50/50">
                EE Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-emerald-50/50">
                EC
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-emerald-100/60">
                SSS Total
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-sky-50/50 border-l border-sky-100">
                ER Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-sky-50/50">
                EE Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-sky-100/60">
                PHIC Total
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-amber-50/50 border-l border-amber-100">
                ER Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-amber-50/50">
                EE Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase bg-amber-100/60">
                HDMF Total
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase">
                SSS Loan
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase">
                Pag-IBIG Loan
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase">
                EE Total Share
              </th>
              <th className="px-3 py-2.5 text-right font-semibold uppercase">
                ER Total Share
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50 border-l border-slate-200">
                SSS No.
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                PHIC No.
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                HDMF No.
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                Bday
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                TIN
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                Position
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase bg-slate-50">
                Remarks
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {empLoading || cfgLoading || sssLoading ? (
              <tr>
                <td
                  colSpan={TOTAL_COLS}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Loading employees...
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td
                  colSpan={TOTAL_COLS}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No employees yet. Click "Add Employee" to start.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((e) => {
                const sEc = computeSSS(e.salary_bracket, sssBrackets).ec; // EC lang ang kailangan pang i-compute
                const sEe = Number(e.sss_ee) || 0;
                const sEr = Number(e.sss_er) || 0;
                const pEe = Number(e.phic_ee) || 0;
                const pEr = Number(e.phic_er) || 0;
                const hEe = Number(e.hdmf_ee) || 0;
                const hEr = Number(e.hdmf_er) || 0;

                const sssLoan = Number(e.sss_loan) || 0;
                const pagibigLoan = Number(e.pagibig_loan) || 0;
                const eeT = sEe + pEe + hEe + sssLoan + pagibigLoan;
                const erT = sEr + pEr + hEr;

                return (
                  <tr
                    key={e.id}
                    className="transition hover:bg-slate-50/60 group"
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {e.emp_name || composeEmpName(e)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right">
                      {fmt(e.salary_bracket)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-emerald-50/30">
                      {fmt(sEr)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-emerald-50/30">
                      {fmt(sEe)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-emerald-50/30">
                      {fmt(sEc)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-right bg-emerald-100/40">
                      {fmt(sEe + sEr + sEc)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-sky-50/30">
                      {fmt(pEr)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-sky-50/30">
                      {fmt(pEe)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-right bg-sky-100/40">
                      {fmt(pEe + pEr)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-amber-50/30">
                      {fmt(hEr)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right bg-amber-50/30">
                      {fmt(hEe)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-right bg-amber-100/40">
                      {fmt(hEe + hEr)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right">
                      {sssLoan ? fmt(sssLoan) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right">
                      {pagibigLoan ? fmt(pagibigLoan) : "—"}
                    </td>
                    <td
                      className="px-3 py-2.5 font-mono font-semibold text-right"
                      style={{ color: ACCENT }}
                    >
                      {fmt(eeT)}
                    </td>
                    <td
                      className="px-3 py-2.5 font-mono font-semibold text-right"
                      style={{ color: ACCENT }}
                    >
                      {fmt(erT)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {e.sss_emp_no || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {e.phic_emp_no || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {e.hdmf_emp_no || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {e.date_of_birth || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {e.tin || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {e.position || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {e.remarks || "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-2 transition opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => openEditModal(e)}
                          className="text-slate-400 hover:text-blue-600"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {employees.length > 0 && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-slate-200 bg-slate-50 text-slate-700">
                <td className="px-3 py-3">TOTAL</td>
                <td className="px-3 py-3 font-mono text-right">
                  {fmt(totals.salary)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-emerald-50/30">
                  {fmt(totals.sssEr)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-emerald-50/30">
                  {fmt(totals.sssEe)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-emerald-50/30">
                  {fmt(totals.sssEc)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-emerald-100/40">
                  {fmt(totals.sssTotal)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-sky-50/30">
                  {fmt(totals.phicEr)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-sky-50/30">
                  {fmt(totals.phicEe)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-sky-100/40">
                  {fmt(totals.phicTotal)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-amber-50/30">
                  {fmt(totals.hdmfEr)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-amber-50/30">
                  {fmt(totals.hdmfEe)}
                </td>
                <td className="px-3 py-3 font-mono text-right bg-amber-100/40">
                  {fmt(totals.hdmfTotal)}
                </td>
                <td className="px-3 py-3 font-mono text-right">
                  {fmt(totals.sssLoan)}
                </td>
                <td className="px-3 py-3 font-mono text-right">
                  {fmt(totals.pagibigLoan)}
                </td>
                <td
                  className="px-3 py-3 font-mono text-right"
                  style={{ color: ACCENT }}
                >
                  {fmt(totalEE)}
                </td>
                <td
                  className="px-3 py-3 font-mono text-right"
                  style={{ color: ACCENT }}
                >
                  {fmt(totalER)}
                </td>
                <td colSpan={7} />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">
                {form.id ? "Edit Employee" : "Add Employee"} —{" "}
                {selectedClient.client_id}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Employee Code">
                  <input
                    type="text"
                    value={form.emp_code}
                    disabled
                    className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`}
                  />
                </Field>
                <Field label="Status">
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                    className={selectCls}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>

                <Field label="Last Name" required>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Molina"
                    className={inputCls}
                  />
                </Field>
                <Field label="Suffix (JR, SR, I, II)">
                  <input
                    type="text"
                    name="suffix"
                    value={form.suffix}
                    onChange={handleFormChange}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </Field>
                <Field label="First/Second Name" required>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Albert"
                    className={inputCls}
                  />
                </Field>
                <Field label="Middle Name">
                  <input
                    type="text"
                    name="middle_name"
                    value={form.middle_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Antonio"
                    className={inputCls}
                  />
                </Field>

                <Field label="Position">
                  <input
                    type="text"
                    name="position"
                    value={form.position}
                    onChange={handleFormChange}
                    placeholder="e.g. SoftwareDeveloper"
                    className={inputCls}
                  />
                </Field>
                <Field label="Salary Bracket (Monthly)">
                  <input
                    type="number"
                    name="salary_bracket"
                    value={form.salary_bracket}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    type="date"
                    name="date_of_birth"
                    value={form.date_of_birth || ""}
                    onChange={handleFormChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Start of Employment">
                  <input
                    type="date"
                    name="start_of_employment"
                    value={form.start_of_employment || ""}
                    onChange={handleFormChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Start of Contribution">
                  <input
                    type="date"
                    name="start_of_contribution"
                    value={form.start_of_contribution || ""}
                    onChange={handleFormChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="TIN">
                  <input
                    type="text"
                    name="tin"
                    value={form.tin}
                    onChange={handleFormChange}
                    placeholder="000-000-000-000"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="SSS No.">
                  <input
                    type="text"
                    name="sss_emp_no"
                    value={form.sss_emp_no}
                    onChange={handleFormChange}
                    placeholder="34-7527688-0"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="PHIC No.">
                  <input
                    type="text"
                    name="phic_emp_no"
                    value={form.phic_emp_no}
                    onChange={handleFormChange}
                    placeholder="0-102628786-65"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="HDMF No.">
                  <input
                    type="text"
                    name="hdmf_emp_no"
                    value={form.hdmf_emp_no}
                    onChange={handleFormChange}
                    placeholder="1212-2336-7443"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="SSS Loan (Monthly)">
                  <input
                    type="number"
                    name="sss_loan"
                    value={form.sss_loan}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Pag-IBIG Loan (Monthly)">
                  <input
                    type="number"
                    name="pagibig_loan"
                    value={form.pagibig_loan}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
                <Field label="Remarks" span2>
                  <input
                    type="text"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleFormChange}
                    placeholder="Optional notes"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="overflow-hidden border rounded-lg border-slate-200">
                <div className="px-4 py-2 text-xs font-semibold tracking-wide uppercase border-b text-slate-500 bg-slate-50 border-slate-200 flex items-center justify-between">
                  <span>Government Contributions</span>
                  <button
                    type="button"
                    onClick={handleRecalculate}
                    className="flex items-center gap-1 text-[10px] font-medium normal-case text-blue-600 hover:text-blue-800"
                    title="Restore to the current SSS/PhilHealth/Pag-IBIG rates"
                  >
                    <FaUndo size={9} /> Recalculate
                  </button>
                </div>
                <div className="grid grid-cols-3 text-sm divide-x divide-slate-100">
                  <div className="p-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                      SSS
                    </p>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>ER Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.sss_er}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sss_er: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>EE Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.sss_ee}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, sss_ee: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>EC</span>
                      <span className="font-mono">{fmt(sss.ec)}</span>
                    </div>
                    <div className="flex justify-between pt-1 mt-1 font-semibold border-t text-slate-800 border-slate-100">
                      <span>Total</span>
                      <span className="font-mono">
                        {fmt(
                          (parseFloat(form.sss_ee) || 0) +
                            (parseFloat(form.sss_er) || 0) +
                            sss.ec,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                      PhilHealth
                    </p>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>ER Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.phic_er}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phic_er: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>EE Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.phic_ee}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phic_ee: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex justify-between pt-1 mt-1 font-semibold border-t text-slate-800 border-slate-100">
                      <span>Total</span>
                      <span className="font-mono">
                        {fmt(
                          (parseFloat(form.phic_ee) || 0) +
                            (parseFloat(form.phic_er) || 0),
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">
                      Pag-IBIG
                    </p>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>ER Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.hdmf_er}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, hdmf_er: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex items-center justify-between mb-1 text-slate-600">
                      <span>EE Share</span>
                      <input
                        type="number"
                        step="0.01"
                        value={form.hdmf_ee}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, hdmf_ee: e.target.value }))
                        }
                        className="w-24 px-1.5 py-0.5 text-right font-mono text-xs border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                    </div>
                    <div className="flex justify-between pt-1 mt-1 font-semibold border-t text-slate-800 border-slate-100">
                      <span>Total</span>
                      <span className="font-mono">
                        {fmt(
                          (parseFloat(form.hdmf_ee) || 0) +
                            (parseFloat(form.hdmf_er) || 0),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-sm font-semibold">
                  <span style={{ color: ACCENT }}>
                    EE Total Share: ₱{fmt(eeTotal)}
                  </span>
                  <span style={{ color: ACCENT }}>
                    ER Total Share: ₱{fmt(erTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 text-sm font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-md transition disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                <FaSave size={12} /> {saving ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
