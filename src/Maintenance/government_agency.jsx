import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../lib/supabaseClient";
import {
  FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSearch,
  FaSort, FaSortUp, FaSortDown, FaBuilding
} from 'react-icons/fa';

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition bg-white";

export default function GovernmentAgency() {
  const [agencies,      setAgencies]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [sortField,     setSortField]     = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [message,       setMessage]       = useState('');
  const [messageType,   setMessageType]   = useState('');

  const emptyForm = { name: '', description: '', is_active: true };
  const [form, setForm] = useState(emptyForm);

  // ── FETCH ────────────────────────────────────────────────────────────────
  const fetchAgencies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('government_agencies')
      .select('*')
      .order('name');

    if (error) {
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
    } else {
      setAgencies(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAgencies(); }, [fetchAgencies]);

  // ── FILTER + SORT ────────────────────────────────────────────────────────
  const filtered = agencies.filter(a => {
    const q = search.toLowerCase();
    return !q || [a.name, a.description].some(v => (v || '').toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortField] || '').toString().toLowerCase();
    const bv = (b[sortField] || '').toString().toLowerCase();
    const cmp = av.localeCompare(bv);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <FaSort size={9} className="ml-1 text-gray-300" />;
    return sortDir === 'asc'
      ? <FaSortUp   size={9} className="ml-1 text-green-600" />
      : <FaSortDown size={9} className="ml-1 text-green-600" />;
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ name: a.name || '', description: a.description || '', is_active: a.is_active });
    setShowModal(true);
  };

  const flash = (msg, type = 'success') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { flash('Agency name is required.', 'error'); return; }
    setSaving(true);
    const payload = {
      name:        form.name.trim(),
      description: form.description.trim(),
      is_active:   form.is_active,
    };
    const { error } = editing
      ? await supabase.from('government_agencies').update(payload).eq('id', editing.id)
      : await supabase.from('government_agencies').insert([payload]);

    if (error) { flash(`Error: ${error.message}`, 'error'); }
    else {
      flash(editing ? '✓ Agency updated.' : '✓ Agency added.');
      setShowModal(false);
      fetchAgencies();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('government_agencies').delete().eq('id', id);
    if (error) {
      flash(`Cannot delete: ${error.message}`, 'error');
    } else {
      flash('✓ Agency deleted.');
      fetchAgencies();
    }
    setDeleteConfirm(null);
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-6 py-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">

        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-green-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Government Agencies</h1>
              <p className="text-xs text-gray-400">{agencies.length} agencies · used as tabs in Chart of Accounts</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white transition bg-green-600 rounded-lg shadow-sm hover:bg-green-700 shadow-green-200">
            <FaPlus size={10} /> Add Agency
          </button>
        </div>

        {/* MESSAGE */}
        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm border-l-4 flex items-center justify-between
            ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
            {message}
            <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
          </div>
        )}

        {/* MAIN CARD */}
        <div className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">

          {/* SEARCH */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">{sorted.length} of {agencies.length} shown</span>
            <div className="relative w-64">
              <FaSearch className="absolute text-gray-300 -translate-y-1/2 left-3 top-1/2" size={11} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search agencies..."
                className="w-full py-2 pl-8 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute text-gray-300 -translate-y-1/2 right-3 top-1/2 hover:text-gray-500">
                  <FaTimes size={10} />
                </button>
              )}
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-green-600 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-20 text-center">
              <FaBuilding size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">No agencies found</p>
              <p className="mt-1 text-xs text-gray-300">Add your first agency to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {[
                    { label: 'Agency Name', field: 'name',        w: 'min-w-[180px]' },
                    { label: 'Description', field: 'description', w: 'min-w-[200px]' },
                    { label: 'Status',      field: 'is_active',   w: 'w-24'          },
                  ].map(col => (
                    <th key={col.field} onClick={() => handleSort(col.field)}
                      className={`${col.w} px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-green-600 select-none`}>
                      <span className="flex items-center">{col.label}<SortIcon field={col.field} /></span>
                    </th>
                  ))}
                  <th className="w-20 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((agency, idx) => (
                  <tr key={agency.id}
                    className={`group transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-green-50/40`}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{agency.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{agency.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${agency.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'}`}>
                        {agency.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 transition opacity-0 group-hover:opacity-100">
                        <button onClick={() => openEdit(agency)}
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition" title="Edit">
                          <FaEdit size={12} />
                        </button>
                        <button onClick={() => setDeleteConfirm(agency)}
                          className="p-1.5 text-red-400 hover:bg-red-100 rounded-lg transition" title="Delete">
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {sorted.length > 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
              {sorted.length} agenc{sorted.length !== 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-green-600 to-emerald-600">
              <h2 className="text-base font-bold text-white">{editing ? 'Edit Agency' : 'Add New Agency'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white"><FaTimes /></button>
            </div>
            <div className="p-6 space-y-4">

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Agency Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. BIR - Tax Dues" maxLength={100} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Description <span className="font-normal text-gray-300">(optional)</span>
                </label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Short description of this agency" className={inputCls} />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-gray-600">{form.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving
                  ? <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                  : <FaCheck size={12} />}
                {editing ? 'Save Changes' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 bg-white shadow-2xl rounded-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-800">Delete Agency?</h3>
            <p className="mb-2 text-sm text-gray-500">
              "<span className="font-semibold text-gray-700">{deleteConfirm.name}</span>" will be permanently removed.
            </p>
            <p className="px-3 py-2 mb-5 text-xs border rounded-lg text-amber-600 bg-amber-50 border-amber-100">
              ⚠ This may affect accounts linked to this agency.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}