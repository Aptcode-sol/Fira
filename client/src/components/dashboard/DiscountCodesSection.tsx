'use client';

import { useState, useEffect } from 'react';
import { discountsApi } from '@/lib/api';
import { Button, Input, Modal, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

const DISCOUNT_TYPES = [
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'flat', label: 'Flat (₹)' },
];

/**
 * States the validity window instead of asking for it. Removing the two date fields
 * without saying what replaced them would leave the organizer guessing how long their
 * code lasts.
 */
function ValidityNote({ eventEnd }: { eventEnd?: string }) {
    const until = eventEnd
        ? new Date(eventEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;
    return (
        <p className="text-xs text-gray-400">
            Valid as soon as it is created, until the event ends{until ? ` (${until})` : ''}.
        </p>
    );
}

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
    /**
     * Event end (ISO). Display only - it is what the code's validity is derived
     * from server-side, so the form states it rather than asking for it.
     */
    eventEnd?: string;
}

/**
 * The validity window is no longer entered here.
 *
 * The form used to collect "Valid From" / "Valid Until" and constrain both to
 * [eventStart, eventEnd]. But a code is checked at PURCHASE time, and tickets sell
 * before the event runs - so an organizer creating a code for next month's event was
 * forced to start it on the event's own start date, leaving it unusable for the whole
 * selling period. Two fields whose only correct value was implied by the event.
 *
 * discountService.discountWindow now derives it: usable from creation until the event
 * ends. The server ignores any dates in the request, so this is not just a hidden
 * field with a default.
 */
export default function DiscountCodesSection({ eventId, eventEnd }: DiscountCodesSectionProps) {
    const { showToast } = useToast();
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Add form state
    const [addForm, setAddForm] = useState({
        code: '',
        discountType: 'percentage' as 'percentage' | 'flat',
        discountValue: '',
        maxUses: '',
    });

    // Edit form state
    const [editForm, setEditForm] = useState({
        discountType: 'percentage' as 'percentage' | 'flat',
        discountValue: '',
        maxUses: '',
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
        setAddForm({ code: '', discountType: 'percentage', discountValue: '', maxUses: '' });
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

        setIsSaving(true);
        try {
            const maxUses = addForm.maxUses ? Number(addForm.maxUses) : null;
            const created = await discountsApi.create(eventId, {
                code,
                discountType: addForm.discountType,
                discountValue,
                maxUses,
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
        });
        setShowEditModal(true);
    };

    const handleEdit = async () => {
        if (!editingCode) return;
        const discountValue = Number(editForm.discountValue);
        if (!discountValue || discountValue <= 0) {
            showToast('Discount value must be a positive number', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const data: Record<string, unknown> = {
                discountType: editForm.discountType,
                discountValue,
            };
            if (editForm.maxUses) data.maxUses = Number(editForm.maxUses);
            else data.maxUses = null;

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
                {/* Every field is the shared <Input>/<Select>.
                    These were hand-rolled inputs with their own geometry - a `mb-1`
                    label and a `px-4 py-2 rounded-lg` control - while <Select> uses
                    `mb-2` and `px-4 py-3 rounded-xl`. Put side by side in a 2-column
                    grid, the two controls had different heights and their labels sat on
                    different baselines. Sharing the primitives is what keeps a row
                    aligned; matching the numbers by hand only holds until one changes. */}
                <div className="space-y-4">
                    <Input
                        label="Code (3-20 alphanumeric characters)"
                        type="text"
                        value={addForm.code}
                        onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                        maxLength={20}
                        placeholder="e.g. SAVE20"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        {/* The native <select> rendered its option list with the
                            platform's own colours - white background, blue highlight -
                            which ignored every dark style on the control above it. The
                            shared Select draws the list itself, so it matches. */}
                        <Select
                            label="Discount Type"
                            value={addForm.discountType}
                            onChange={(next) => setAddForm({ ...addForm, discountType: next as 'percentage' | 'flat' })}
                            options={DISCOUNT_TYPES}
                        />
                        <Input
                            label={`Value ${addForm.discountType === 'percentage' ? '(1-99)' : '(₹)'}`}
                            type="number"
                            value={addForm.discountValue}
                            onChange={(e) => setAddForm({ ...addForm, discountValue: e.target.value })}
                            min={1}
                            max={addForm.discountType === 'percentage' ? 99 : 99999}
                            placeholder={addForm.discountType === 'percentage' ? '10' : '500'}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                    </div>

                    <Input
                        label="Max Uses (leave empty for unlimited)"
                        type="number"
                        value={addForm.maxUses}
                        onChange={(e) => setAddForm({ ...addForm, maxUses: e.target.value })}
                        min={1}
                        placeholder="Unlimited"
                        onWheel={(e) => e.currentTarget.blur()}
                    />

                    <ValidityNote eventEnd={eventEnd} />

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
                        <Select
                            label="Discount Type"
                            value={editForm.discountType}
                            onChange={(next) => setEditForm({ ...editForm, discountType: next as 'percentage' | 'flat' })}
                            options={DISCOUNT_TYPES}
                        />
                        <Input
                            label={`Value ${editForm.discountType === 'percentage' ? '(1-99)' : '(₹)'}`}
                            type="number"
                            value={editForm.discountValue}
                            onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })}
                            min={1}
                            max={editForm.discountType === 'percentage' ? 99 : 99999}
                            onWheel={(e) => e.currentTarget.blur()}
                        />
                    </div>

                    <Input
                        label="Max Uses (leave empty for unlimited)"
                        type="number"
                        value={editForm.maxUses}
                        onChange={(e) => setEditForm({ ...editForm, maxUses: e.target.value })}
                        min={1}
                        placeholder="Unlimited"
                        onWheel={(e) => e.currentTarget.blur()}
                    />

                    <ValidityNote eventEnd={eventEnd} />

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
