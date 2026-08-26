'use client';

import { useState, useEffect } from 'react';
import { discountsApi } from '@/lib/api';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

interface DiscountCode {
    _id: string;
    code: string;
    discountType: 'percentage' | 'flat';
    discountValue: number;
    maxUses: number | null;
    usedCount: number;
    validFrom: string;
    validUntil: string;
    isActive: boolean;
    createdAt: string;
}

interface DiscountCodesSectionProps {
    eventId: string;
    // Event date window (ISO strings). A discount code's validity must fall
    // inside [eventStart, eventEnd] — 11.14. Optional so the section still
    // renders if the parent hasn't loaded the event yet; the window check is
    // simply skipped when a bound is missing.
    eventStart?: string;
    eventEnd?: string;
}

// 11.14 — a discount is only valid within the event's own date window.
// Returns an error string for the offending field, or null when in-window.
// ponytail: date-only compare (slice to YYYY-MM-DD) because the form inputs
// are <input type="date">; time-of-day precision lives in the server check.
export function discountWindowError(
    validFrom: string,
    validUntil: string,
    eventStart?: string,
    eventEnd?: string,
): string | null {
    const day = (d: string) => d.slice(0, 10);
    if (eventStart && validFrom && day(validFrom) < day(eventStart)) {
        return `Valid from cannot be before the event start (${day(eventStart)})`;
    }
    if (eventEnd && validUntil && day(validUntil) > day(eventEnd)) {
        return `Valid until cannot be after the event end (${day(eventEnd)})`;
    }
    return null;
}

export default function DiscountCodesSection({ eventId, eventStart, eventEnd }: DiscountCodesSectionProps) {
    const { showToast } = useToast();
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    // Inline date-window error rendered inside the modal (11.14) — never a
    // toast, so the message sits on the visible layer next to the field.
    const [addDateError, setAddDateError] = useState<string | null>(null);
    const [editDateError, setEditDateError] = useState<string | null>(null);

    // Add form state
    const [addForm, setAddForm] = useState({
        code: '',
        discountType: 'percentage' as 'percentage' | 'flat',
        discountValue: '',
        maxUses: '',
        validFrom: '',
        validUntil: '',
    });

    // Edit form state
    const [editForm, setEditForm] = useState({
        discountType: 'percentage' as 'percentage' | 'flat',
        discountValue: '',
        maxUses: '',
        validFrom: '',
        validUntil: '',
    });

    useEffect(() => {
        fetchCodes();
    }, [eventId]);

    const fetchCodes = async () => {
        try {
            setIsLoading(true);
            const data = await discountsApi.list(eventId);
            setCodes(data);
        } catch (error) {
            console.error('Failed to fetch discount codes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetAddForm = () => {
        setAddForm({ code: '', discountType: 'percentage', discountValue: '', maxUses: '', validFrom: '', validUntil: '' });
        setAddDateError(null);
        setShowAddModal(false);
    };

    const handleAdd = async () => {
        // Client-side validation
        const code = addForm.code.trim().toUpperCase();
        if (code.length < 3 || code.length > 20 || !/^[A-Z0-9]+$/.test(code)) {
            showToast('Code must be 3-20 alphanumeric characters', 'error');
            return;
        }
        const discountValue = Number(addForm.discountValue);
        if (!discountValue || discountValue <= 0) {
            showToast('Discount value must be a positive number', 'error');
            return;
        }
        if (!addForm.validFrom || !addForm.validUntil) {
            showToast('Valid from and valid until dates are required', 'error');
            return;
        }
        if (new Date(addForm.validUntil) <= new Date(addForm.validFrom)) {
            showToast('Valid until must be after valid from', 'error');
            return;
        }
        // 11.14 — reject dates outside the event window with an inline error.
        const windowErr = discountWindowError(addForm.validFrom, addForm.validUntil, eventStart, eventEnd);
        if (windowErr) {
            setAddDateError(windowErr);
            return;
        }
        setAddDateError(null);

        setIsSaving(true);
        try {
            const maxUses = addForm.maxUses ? Number(addForm.maxUses) : null;
            const created = await discountsApi.create(eventId, {
                code,
                discountType: addForm.discountType,
                discountValue,
                maxUses,
                validFrom: addForm.validFrom,
                validUntil: addForm.validUntil,
            });
            setCodes(prev => [created as DiscountCode, ...prev]);
            resetAddForm();
            showToast('Discount code created!', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to create code', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (code: DiscountCode) => {
        setEditingCode(code);
        setEditForm({
            discountType: code.discountType,
            discountValue: String(code.discountValue),
            maxUses: code.maxUses != null ? String(code.maxUses) : '',
            validFrom: code.validFrom ? code.validFrom.slice(0, 10) : '',
            validUntil: code.validUntil ? code.validUntil.slice(0, 10) : '',
        });
        setEditDateError(null);
        setShowEditModal(true);
    };

    const handleEdit = async () => {
        if (!editingCode) return;
        const discountValue = Number(editForm.discountValue);
        if (!discountValue || discountValue <= 0) {
            showToast('Discount value must be a positive number', 'error');
            return;
        }
        if (editForm.validFrom && editForm.validUntil && new Date(editForm.validUntil) <= new Date(editForm.validFrom)) {
            showToast('Valid until must be after valid from', 'error');
            return;
        }
        // 11.14 — reject dates outside the event window with an inline error.
        const windowErr = discountWindowError(editForm.validFrom, editForm.validUntil, eventStart, eventEnd);
        if (windowErr) {
            setEditDateError(windowErr);
            return;
        }
        setEditDateError(null);

        setIsSaving(true);
        try {
            const data: Record<string, unknown> = {
                discountType: editForm.discountType,
                discountValue,
            };
            if (editForm.maxUses) data.maxUses = Number(editForm.maxUses);
            else data.maxUses = null;
            if (editForm.validFrom) data.validFrom = editForm.validFrom;
            if (editForm.validUntil) data.validUntil = editForm.validUntil;

            const updated = await discountsApi.edit(editingCode._id, data);
            setCodes(prev => prev.map(c => c._id === editingCode._id ? (updated as DiscountCode) : c));
            setShowEditModal(false);
            setEditingCode(null);
            showToast('Discount code updated!', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to update code', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeactivate = async (codeId: string) => {
        try {
            await discountsApi.deactivate(codeId);
            setCodes(prev => prev.map(c => c._id === codeId ? { ...c, isActive: false } : c));
            setConfirmDeactivate(null);
            showToast('Discount code deactivated', 'success');
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Failed to deactivate', 'error');
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getStatus = (code: DiscountCode) => {
        if (!code.isActive) return { label: 'Inactive', color: 'bg-gray-500/20 text-gray-400' };
        const now = new Date();
        if (new Date(code.validUntil) < now) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' };
        if (new Date(code.validFrom) > now) return { label: 'Scheduled', color: 'bg-yellow-500/20 text-yellow-400' };
        if (code.maxUses && code.usedCount >= code.maxUses) return { label: 'Exhausted', color: 'bg-orange-500/20 text-orange-400' };
        return { label: 'Active', color: 'bg-green-500/20 text-green-400' };
    };

    return (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Discount Codes</h3>
                <Button size="sm" onClick={() => setShowAddModal(true)}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Code
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
            ) : codes.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No discount codes yet. Create one to offer promotions.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 text-left border-b border-white/10">
                                <th className="pb-2 pr-4">Code</th>
                                <th className="pb-2 pr-4">Type</th>
                                <th className="pb-2 pr-4">Value</th>
                                <th className="pb-2 pr-4">Uses</th>
                                <th className="pb-2 pr-4">Status</th>
                                <th className="pb-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codes.map(code => {
                                const status = getStatus(code);
                                return (
                                    <tr key={code._id} className="border-b border-white/5">
                                        <td className="py-3 pr-4 font-mono text-white">{code.code}</td>
                                        <td className="py-3 pr-4 text-gray-300 capitalize">{code.discountType}</td>
                                        <td className="py-3 pr-4 text-gray-300">
                                            {code.discountType === 'percentage' ? `${code.discountValue}%` : `₹${code.discountValue}`}
                                        </td>
                                        <td className="py-3 pr-4 text-gray-300">
                                            {code.usedCount}{code.maxUses != null ? `/${code.maxUses}` : '/∞'}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>{status.label}</span>
                                        </td>
                                        <td className="py-3">
                                            <div className="flex gap-2">
                                                {code.isActive && (
                                                    <>
                                                        <button
                                                            onClick={() => openEdit(code)}
                                                            className="text-gray-400 hover:text-white transition-colors"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeactivate(code._id)}
                                                            className="text-gray-400 hover:text-red-400 transition-colors"
                                                            title="Deactivate"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728l-12.728-12.728" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Code Modal */}
            <Modal isOpen={showAddModal} onClose={resetAddForm} title="Add Discount Code" size="md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Code (3-20 alphanumeric characters)</label>
                        <input
                            type="text"
                            value={addForm.code}
                            onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                            maxLength={20}
                            placeholder="e.g. SAVE20"
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Discount Type</label>
                            <select
                                value={addForm.discountType}
                                onChange={(e) => setAddForm({ ...addForm, discountType: e.target.value as 'percentage' | 'flat' })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">
                                Value {addForm.discountType === 'percentage' ? '(1-99)' : '(₹)'}
                            </label>
                            <input
                                type="number"
                                value={addForm.discountValue}
                                onChange={(e) => setAddForm({ ...addForm, discountValue: e.target.value })}
                                min={1}
                                max={addForm.discountType === 'percentage' ? 99 : 99999}
                                placeholder={addForm.discountType === 'percentage' ? '10' : '500'}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Max Uses (leave empty for unlimited)</label>
                        <input
                            type="number"
                            value={addForm.maxUses}
                            onChange={(e) => setAddForm({ ...addForm, maxUses: e.target.value })}
                            min={1}
                            placeholder="Unlimited"
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Valid From</label>
                            <input
                                type="date"
                                value={addForm.validFrom}
                                min={eventStart ? eventStart.slice(0, 10) : undefined}
                                max={eventEnd ? eventEnd.slice(0, 10) : undefined}
                                onChange={(e) => { setAddForm({ ...addForm, validFrom: e.target.value }); setAddDateError(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Valid Until</label>
                            <input
                                type="date"
                                value={addForm.validUntil}
                                min={eventStart ? eventStart.slice(0, 10) : undefined}
                                max={eventEnd ? eventEnd.slice(0, 10) : undefined}
                                onChange={(e) => { setAddForm({ ...addForm, validUntil: e.target.value }); setAddDateError(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {(eventStart || eventEnd) && (
                        <p className="text-xs text-gray-400">
                            Dates must fall within the event window
                            {eventStart ? ` (${eventStart.slice(0, 10)}` : ' ('}
                            {eventEnd ? ` – ${eventEnd.slice(0, 10)})` : ')'}.
                        </p>
                    )}
                    {addDateError && (
                        <p className="text-sm text-red-400">{addDateError}</p>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={resetAddForm}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={isSaving}>
                            {isSaving ? 'Creating...' : 'Create Code'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Code Modal */}
            <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingCode(null); }} title="Edit Discount Code" size="md">
                <div className="space-y-4">
                    {editingCode && (
                        <div className="bg-white/5 rounded-lg px-3 py-2 text-sm text-gray-300">
                            Editing: <span className="font-mono text-white">{editingCode.code}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Discount Type</label>
                            <select
                                value={editForm.discountType}
                                onChange={(e) => setEditForm({ ...editForm, discountType: e.target.value as 'percentage' | 'flat' })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">
                                Value {editForm.discountType === 'percentage' ? '(1-99)' : '(₹)'}
                            </label>
                            <input
                                type="number"
                                value={editForm.discountValue}
                                onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })}
                                min={1}
                                max={editForm.discountType === 'percentage' ? 99 : 99999}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Max Uses (leave empty for unlimited)</label>
                        <input
                            type="number"
                            value={editForm.maxUses}
                            onChange={(e) => setEditForm({ ...editForm, maxUses: e.target.value })}
                            min={1}
                            placeholder="Unlimited"
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Valid From</label>
                            <input
                                type="date"
                                value={editForm.validFrom}
                                min={eventStart ? eventStart.slice(0, 10) : undefined}
                                max={eventEnd ? eventEnd.slice(0, 10) : undefined}
                                onChange={(e) => { setEditForm({ ...editForm, validFrom: e.target.value }); setEditDateError(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Valid Until</label>
                            <input
                                type="date"
                                value={editForm.validUntil}
                                min={eventStart ? eventStart.slice(0, 10) : undefined}
                                max={eventEnd ? eventEnd.slice(0, 10) : undefined}
                                onChange={(e) => { setEditForm({ ...editForm, validUntil: e.target.value }); setEditDateError(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {(eventStart || eventEnd) && (
                        <p className="text-xs text-gray-400">
                            Dates must fall within the event window
                            {eventStart ? ` (${eventStart.slice(0, 10)}` : ' ('}
                            {eventEnd ? ` – ${eventEnd.slice(0, 10)})` : ')'}.
                        </p>
                    )}
                    {editDateError && (
                        <p className="text-sm text-red-400">{editDateError}</p>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingCode(null); }}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Deactivate Confirmation Modal */}
            <Modal isOpen={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} title="Deactivate Code" size="sm">
                <div className="space-y-4">
                    <p className="text-gray-300 text-sm">
                        Are you sure you want to deactivate this discount code? Users will no longer be able to use it.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
                        <Button
                            className="!bg-red-500 hover:!bg-red-600"
                            onClick={() => confirmDeactivate && handleDeactivate(confirmDeactivate)}
                        >
                            Deactivate
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
