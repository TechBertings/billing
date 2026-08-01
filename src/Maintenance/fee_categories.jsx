import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../lib/supabaseClient";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaLayerGroup } from 'react-icons/fa';

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition bg-white";

// Top-level maintenance: "Fees", "Government Remittances", etc.
// This is the parent of Government Agencies, which is the parent of Chart of Accounts.
export default function FeeCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const emptyForm = { name: '', sort_order: 0, is_active: true };
  const [form, setForm] = useState(emptyForm);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fee_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) { setMessage(`Error: ${error.message}`); setMessageType('error'); }
    else setCategories(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const flash = (msg, type = 'success') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: categories.length + 1 });
    setShowModal(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name || '', sort_order: c.sort_order ?? 0, is_active: c.is_active });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { flash('Category name is required.', 'error'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('fee_categories').update(payload).eq('id', editing.id)
      : await supabase.from('fee_categories').insert([payload]);

    if (error) { flash(`Error: ${error.message}`, 'error'); }
    else {
      flash(editing ? '✓ Category updated.' : '✓ Category added.');
      setShowModal(false);
      fetchCategories();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    // government_agencies.category_id has a FK, so this will fail loudly
    // if any agency still belongs to this category — which is what we want.
    const { error } = await supabase.from('fee_categories').delete().eq('id', id);
    if (error) flash(`Cannot delete: ${error.message}`, 'error');
    else { flash('✓ Category deleted.'); fetchCategories(); }
    setDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen px-6 py-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-indigo-600 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Fee Categories</h1>
              <p className="text-xs text-gray-400">Top level · e.g. "Fees", "Government Remittances" · parent of Government Agencies</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white transition bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 shadow-indigo-200">
            <FaPlus size={10} /> Add Category
          </button>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm border-l-4 flex items-center justify-between
            ${messageType === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
            {message}
            <button onClick={() => setMessage('')}><FaTimes size={11} /></button>
          </div>
        )}

        <div className="overflow-hidden bg-white border border-gray-200 shadow-sm rounded-xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-indigo-600 rounded-full border-t-transparent animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center">
              <FaLayerGroup size={26} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">No categories yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Order</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Category Name</th>
                  <th className="w-24 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="w-20 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map((c, idx) => (
                  <tr key={c.id} className={`group transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-indigo-50/40`}>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.sort_order}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 transition opacity-0 group-hover:opacity-100">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition" title="Edit">
                          <FaEdit size={12} />
                        </button>
                        <button onClick={() => setDeleteConfirm(c)} className="p-1.5 text-red-400 hover:bg-red-100 rounded-lg transition" title="Delete">
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-indigo-600 to-violet-600">
              <h2 className="text-base font-bold text-white">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white"><FaTimes /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                  Category Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Fees" maxLength={100} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-gray-600">{form.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" /> : <FaCheck size={12} />}
                {editing ? 'Save Changes' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 bg-white shadow-2xl rounded-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-800">Delete Category?</h3>
            <p className="mb-2 text-sm text-gray-500">
              "<span className="font-semibold text-gray-700">{deleteConfirm.name}</span>" will be permanently removed.
            </p>
            <p className="px-3 py-2 mb-5 text-xs border rounded-lg text-amber-600 bg-amber-50 border-amber-100">
              ⚠ Deletion will fail if any Government Agency is still linked to this category.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}