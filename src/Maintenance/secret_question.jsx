import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Search, HelpCircle, AlertTriangle, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

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
  const [showAnswer, setShowAnswer] = useState(false); // toggle answer visibility in modal

  const [toast, setToast] = useState(null);

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

  /* ── Toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Sort ── */
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  /* ── Filter ── */
  const filtered = questions.filter(q =>
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
    const { error } = await supabase
      .from("security_questions")
      .insert({ question: q, answer: a });
    setSaving(false);
    if (error) {
      setFormError(error.code === "23505" ? "This question already exists." : "Failed to save. Please try again.");
      return;
    }
    showToast("Question added successfully.");
    closeModal(); fetchQuestions();
  };

  const handleEdit = async () => {
    const q = formQuestion.trim();
    const a = formAnswer.trim();
    if (!q) { setFormError("Question cannot be empty."); return; }
    if (!a) { setFormError("Answer cannot be empty."); return; }
    const unchanged = q === activeRow.question && a === (activeRow.answer || "");
    if (unchanged) { closeModal(); return; }
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
    showToast("Question updated successfully.");
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

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  /* ════════════════════════════
     RENDER
  ═════════════════════════════ */
  return (
    <div className="font-sans">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold shadow-lg
          ${toast.type === "success"
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"}`}
        >
          {toast.type === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Modal: Add / Edit ── */}
      {(modal === "add" || modal === "edit") && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-8 w-full max-w-md mx-4">
            {/* Modal header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  {modal === "add" ? "Add Secret Question" : "Edit Secret Question"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {modal === "add" ? "Define a new security question and answer." : "Update this security question and answer."}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Question field */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Question
              </label>
              <textarea
                value={formQuestion}
                onChange={(e) => { setFormQuestion(e.target.value); setFormError(""); }}
                placeholder="e.g. What was the name of your first pet?"
                rows={2}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium
                           placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                           resize-none leading-relaxed transition-all"
              />
            </div>

            {/* Answer field */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Answer
              </label>
              <div className="relative">
                <input
                  type={showAnswer ? "text" : "password"}
                  value={formAnswer}
                  onChange={(e) => { setFormAnswer(e.target.value); setFormError(""); }}
                  placeholder="Enter the answer…"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium
                             placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                             transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowAnswer(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showAnswer ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {formError && (
              <p className="mb-4 text-xs text-red-600 font-semibold flex items-center gap-1">
                <AlertTriangle size={13} /> {formError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200
                           hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={modal === "add" ? handleAdd : handleEdit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                           bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                           shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : modal === "add"
                    ? <><Plus size={15} /> Add Question</>
                    : <><Check size={15} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete ── */}
      {modal === "delete" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-8 w-full max-w-sm mx-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 border border-red-100 mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-base font-black text-slate-800 mb-1.5">Delete Question?</h2>
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
              This action cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold italic text-left leading-relaxed mb-6">
              "{activeRow?.question}"
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200
                           hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                           bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                           shadow-sm transition-all disabled:opacity-60"
              >
                {saving ? "Deleting…" : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════
          Main Panel
      ═════════════════════════ */}

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-8 py-5 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
            <HelpCircle size={24} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Secret Questions</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {questions.length} question{questions.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white
                     bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                     shadow-sm hover:-translate-y-0.5 transition-all"
        >
          <Plus size={15} /> Add Question
        </button>
      </div>

      {/* Search toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700
                       placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
          />
        </div>
        {search && (
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr_140px_140px_90px] px-6 py-3 bg-slate-50 border-b border-slate-200">
          {[
            { label: "QUESTION", field: "question" },
            { label: "ANSWER", field: "answer" },
            { label: "CREATED", field: "created_at" },
            { label: "UPDATED", field: "updated_at" },
          ].map(({ label, field }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 text-xs font-bold tracking-widest transition-colors w-fit
                ${sortField === field ? "text-blue-600" : "text-slate-400 hover:text-blue-500"}`}
            >
              {label}
              {sortField === field
                ? sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                : <ChevronUp size={11} className="opacity-25" />}
            </button>
          ))}
          <span className="text-xs font-bold tracking-widest text-slate-400">ACTIONS</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-semibold">
            Loading questions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <HelpCircle size={38} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-semibold">
              {search ? "No questions match your search." : "No secret questions yet. Add one to get started."}
            </p>
          </div>
        ) : (
          filtered.map((q, idx) => (
            <div
              key={q.id}
              className="grid grid-cols-[1fr_1fr_140px_140px_90px] items-center px-6 py-3.5
                         border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-colors"
            >
              {/* Question */}
              <div className="flex items-center gap-3 pr-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-50 border border-blue-100
                                 flex items-center justify-center text-xs font-black text-blue-500">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-slate-700 leading-snug">
                  {q.question}
                </span>
              </div>

              {/* Answer — masked */}
              <div className="pr-4">
                {q.answer ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold tracking-widest">
                    <span>••••••••</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 font-medium italic">No answer</span>
                )}
              </div>

              {/* Created */}
              <span className="text-xs text-slate-400 font-medium">{fmtDate(q.created_at)}</span>

              {/* Updated */}
              <span className="text-xs text-slate-400 font-medium">{fmtDate(q.updated_at)}</span>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEdit(q)}
                  title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50
                             border border-transparent hover:border-blue-100 transition-all"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => openDelete(q)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50
                             border border-transparent hover:border-red-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SecretQuestions;