import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Search, HelpCircle, AlertTriangle, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/* ── Shared look (same block is used in secret_question / user_role / status) ── */
const inputCls   = "w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200";
const labelCls   = "block mb-1 text-xs font-medium text-gray-500";
const btnPrimary = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-gray-900 rounded-md hover:bg-black disabled:opacity-50";
const btnGhost   = "px-3.5 py-2 text-sm font-medium text-gray-600 transition bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50";
const btnDanger  = "flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50";
const iconBtn    = "p-1.5 text-gray-400 transition rounded-md hover:bg-gray-100 hover:text-black";

const Toast = ({ toast }) =>
  toast && (
    <div
      className={`fixed z-50 flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border rounded-md shadow-lg bottom-6 right-6 ${
        toast.type === "error" ? "text-red-700 border-red-200" : "text-gray-800 border-gray-200"
      }`}
    >
      {toast.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />}
      {toast.msg}
    </div>
  );

const Modal = ({ title, subtitle, onClose, children }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-xl">
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className={iconBtn}>
          <X size={16} />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

const ConfirmDelete = ({ title, name, saving, onCancel, onConfirm }) => (
  <Modal title={title} subtitle="This action cannot be undone." onClose={onCancel}>
    <p className="px-3 py-2 mb-5 text-sm text-gray-700 border border-gray-200 rounded-md bg-gray-50">{name}</p>
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} disabled={saving} className={btnGhost}>Cancel</button>
      <button onClick={onConfirm} disabled={saving} className={btnDanger}>
        {saving ? "Deleting..." : <><Trash2 size={14} /> Delete</>}
      </button>
    </div>
  </Modal>
);

/* ════════════════════════════ */
const SecretQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [modal, setModal] = useState(null); // null | "add" | "edit" | "delete"
  const [activeRow, setActiveRow] = useState(null);
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Fetch ── */
  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("security_questions")
      .select("*")
      .order(sortField, { ascending: sortDir === "asc" });
    if (error) showToast("Failed to load questions.", "error");
    else setQuestions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, [sortField, sortDir]);

  /* ── Sort / filter ── */
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = questions.filter((q) =>
    q.question.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Modal helpers ── */
  const openAdd = () => {
    setFormQuestion(""); setFormAnswer(""); setFormError("");
    setShowAnswer(false); setModal("add");
  };
  const openEdit = (row) => {
    setActiveRow(row);
    setFormQuestion(row.question);
    setFormAnswer(row.answer || "");
    setFormError(""); setShowAnswer(false);
    setModal("edit");
  };
  const openDelete = (row) => { setActiveRow(row); setModal("delete"); };
  const closeModal = () => {
    setModal(null); setActiveRow(null);
    setFormQuestion(""); setFormAnswer(""); setFormError("");
    setShowAnswer(false);
  };

  /* ── CRUD ── */
  const handleAdd = async () => {
    const q = formQuestion.trim();
    const a = formAnswer.trim();
    if (!q) { setFormError("Question cannot be empty."); return; }
    if (q.length < 5) { setFormError("Question is too short."); return; }
    if (!a) { setFormError("Answer cannot be empty."); return; }
    setSaving(true);
    const { error } = await supabase.from("security_questions").insert({ question: q, answer: a });
    setSaving(false);
    if (error) {
      setFormError(error.code === "23505" ? "This question already exists." : "Failed to save. Please try again.");
      return;
    }
    showToast("Question added.");
    closeModal(); fetchQuestions();
  };

  const handleEdit = async () => {
    const q = formQuestion.trim();
    const a = formAnswer.trim();
    if (!q) { setFormError("Question cannot be empty."); return; }
    if (!a) { setFormError("Answer cannot be empty."); return; }
    if (q === activeRow.question && a === (activeRow.answer || "")) { closeModal(); return; }
    setSaving(true);
    const { error } = await supabase
      .from("security_questions")
      .update({ question: q, answer: a })
      .eq("id", activeRow.id);
    setSaving(false);
    if (error) {
      setFormError(error.code === "23505" ? "This question already exists." : "Failed to update. Please try again.");
      return;
    }
    showToast("Question updated.");
    closeModal(); fetchQuestions();
  };

  const handleDelete = async () => {
    setSaving(true);
    const { error } = await supabase.from("security_questions").delete().eq("id", activeRow.id);
    setSaving(false);
    if (error) { showToast("Failed to delete.", "error"); return; }
    showToast("Question deleted.");
    closeModal(); fetchQuestions();
  };

  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const sortTh = (label, field) => (
    <th className="px-4 py-2.5 text-left">
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-xs font-medium ${sortField === field ? "text-black" : "text-gray-500 hover:text-black"}`}
      >
        {label}
        {sortField === field
          ? sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <ChevronUp size={11} className="opacity-25" />}
      </button>
    </th>
  );

  /* ════════════ RENDER ════════════ */
  return (
    <div>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <HelpCircle size={26} strokeWidth={1.5} className="text-black" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Secret Questions</h2>
            <p className="text-xs text-gray-500">
              {questions.length} question{questions.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Add Question
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute text-gray-300 -translate-y-1/2 pointer-events-none left-3 top-1/2" />
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} pl-9`}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              {sortTh("Question", "question")}
              {sortTh("Answer", "answer")}
              {sortTh("Created", "created_at")}
              {sortTh("Updated", "updated_at")}
              <th className="px-4 py-2.5 text-xs font-medium text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  {search ? "No questions match your search." : "No secret questions yet."}
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{q.question}</td>
                  <td className="px-4 py-3 text-gray-400">{q.answer ? "••••••••" : <span className="italic">No answer</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(q.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(q.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(q)} title="Edit" className={iconBtn}><Pencil size={15} /></button>
                      <button onClick={() => openDelete(q)} title="Delete" className={iconBtn}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal
          title={modal === "add" ? "Add Secret Question" : "Edit Secret Question"}
          subtitle={modal === "add" ? "Define a new security question and answer." : "Update this security question and answer."}
          onClose={closeModal}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              modal === "add" ? handleAdd() : handleEdit();
            }}
          >
            <div className="mb-4">
              <label className={labelCls}>Question</label>
              <textarea
                value={formQuestion}
                onChange={(e) => { setFormQuestion(e.target.value); setFormError(""); }}
                placeholder="e.g. What was the name of your first pet?"
                rows={2}
                autoFocus
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="mb-4">
              <label className={labelCls}>Answer</label>
              <div className="relative">
                <input
                  type={showAnswer ? "text" : "password"}
                  value={formAnswer}
                  onChange={(e) => { setFormAnswer(e.target.value); setFormError(""); }}
                  placeholder="Enter the answer..."
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowAnswer((v) => !v)}
                  className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-black"
                >
                  {showAnswer ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {formError && (
              <p className="flex items-center gap-1 mb-4 text-xs font-medium text-red-600">
                <AlertTriangle size={13} /> {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={saving} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving..." : modal === "add" ? "Add Question" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {modal === "delete" && (
        <ConfirmDelete
          title="Delete question?"
          name={activeRow?.question}
          saving={saving}
          onCancel={closeModal}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

export default SecretQuestions;