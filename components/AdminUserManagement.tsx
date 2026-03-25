import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Profile, UserRole } from '../types';
import { ensurePrimaryRoleIncluded, normalizeUserRoles } from '../utils/roles';
import ScreenStatusNotice from './ui/ScreenStatusNotice';

interface AdminUserManagementProps {
    onClose: () => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onClose }) => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusTone, setStatusTone] = useState<'error' | 'success'>('success');
    const ALL_ASSIGNABLE_ROLES: UserRole[] = ['resident', 'fellow', 'consultant', 'training_officer', 'moderator', 'admin'];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setStatusMessage(null);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;

            const profileRows = (data as Profile[] | null) || [];
            const userIds = profileRows.map((user) => user.id);
            let roleAssignments = new Map<string, UserRole[]>();

            if (userIds.length > 0) {
                const { data: roleRows, error: roleError } = await supabase
                    .from('user_roles')
                    .select('user_id, role')
                    .in('user_id', userIds);

                if (!roleError) {
                    for (const row of (roleRows || []) as Array<{ user_id: string; role: UserRole | null }>) {
                        const current = roleAssignments.get(row.user_id) || [];
                        roleAssignments.set(row.user_id, normalizeUserRoles([...current, row.role]));
                    }
                }
            }

            setUsers(profileRows.map((user) => ({
                ...user,
                roles: ensurePrimaryRoleIncluded(roleAssignments.get(user.id), user.role),
            })));
        } catch (error) {
            console.error('Error fetching users:', error);
            setStatusTone('error');
            setStatusMessage('Failed to load users.');
        } finally {
            setLoading(false);
        }
    };

    const updateUserRoles = async (userId: string, primaryRole: UserRole, nextRoles: UserRole[]) => {
        try {
            const normalizedRoles = ensurePrimaryRoleIncluded(nextRoles, primaryRole);

            // Optimistic update
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: primaryRole, roles: normalizedRoles } : u));

            const { error } = await supabase
                .from('profiles')
                .update({ role: primaryRole })
                .eq('id', userId);

            if (error) throw error;

            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);

            if (deleteError) {
                const message = String(deleteError.message || '').toLowerCase();
                if (!message.includes('relation') && !message.includes('does not exist') && !message.includes('schema cache')) {
                    throw deleteError;
                }
                return;
            }

            const { error: insertError } = await supabase
                .from('user_roles')
                .insert(normalizedRoles.map((role) => ({
                    user_id: userId,
                    role,
                })));

            if (insertError) throw insertError;
        } catch (error: any) {
            console.error('Error updating roles:', error);
            setStatusTone('error');
            setStatusMessage(`Failed to update roles: ${error.message}`);
            fetchUsers(); // Revert on error
            return;
        }

        setStatusTone('success');
        setStatusMessage('Roles updated.');
    };

    const filteredUsers = users.filter(user =>
    (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getRoleTone = (role?: UserRole | null) => (
        role === 'admin' ? 'text-rose-400 border-rose-500/30' :
            role === 'moderator' ? 'text-violet-300 border-violet-500/30' :
                role === 'training_officer' ? 'text-emerald-400 border-emerald-500/30' :
                    role === 'consultant' ? 'text-amber-400 border-amber-500/30' :
                        'text-slate-400'
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">User Management</h2>
                        <p className="text-xs text-slate-400 mt-1">Manage user roles and permissions</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-white/5 bg-black/20">
                    <div className="relative group flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
                        <span className="material-icons absolute left-5 top-1/2 -translate-y-1/2 text-[19px] text-slate-500 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Search users by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 bg-transparent border-0 rounded-xl pl-[2.75rem] pr-3 text-[13px] font-bold text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
                        />
                    </div>
                    {statusMessage ? (
                        <ScreenStatusNotice
                            message={statusMessage}
                            tone={statusTone}
                            className="mt-3"
                        />
                    ) : null}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-xs text-slate-500">Loading users...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>No users found.</p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} className="rounded-xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-white/10">
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-start">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.username || 'User'} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                    <span className="material-icons text-lg">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-slate-200 truncate">{user.full_name || 'Unnamed User'}</h3>
                                            <p className="text-[10px] text-slate-500 break-all">@{user.username || 'unknown'} ?{user.year_level || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Primary role</p>
                                                </div>
                                                <p className="text-[10px] leading-4 text-slate-500">Default identity.</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {ALL_ASSIGNABLE_ROLES.map((roleOption) => {
                                                        const isPrimaryRole = (user.role || 'resident') === roleOption;
                                                        return (
                                                            <button
                                                                key={`primary-${roleOption}`}
                                                                type="button"
                                                                onClick={() => updateUserRoles(user.id, roleOption, ensurePrimaryRoleIncluded(user.roles, roleOption))}
                                                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                                                                    isPrimaryRole
                                                                        ? `${getRoleTone(roleOption)} bg-white/5`
                                                                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                                                                }`}
                                                            >
                                                                {roleOption.replace('_', ' ')}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Additional roles</p>
                                                </div>
                                                <p className="text-[10px] leading-4 text-slate-500">Active roles control permissions.</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {ALL_ASSIGNABLE_ROLES.map((roleOption) => {
                                                        const currentRoles = ensurePrimaryRoleIncluded(user.roles, user.role);
                                                        const isActive = currentRoles.includes(roleOption);
                                                        const isPrimaryRole = (user.role || 'resident') === roleOption;
                                                        return (
                                                            <button
                                                                key={roleOption}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isPrimaryRole) return;
                                                                    const nextRoles = isActive
                                                                        ? currentRoles.filter((role) => role !== roleOption)
                                                                        : [...currentRoles, roleOption];
                                                                    updateUserRoles(user.id, user.role || 'resident', nextRoles);
                                                                }}
                                                                disabled={isPrimaryRole}
                                                                title={isPrimaryRole ? 'Primary role is always active.' : undefined}
                                                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                                                                    isPrimaryRole
                                                                        ? `cursor-default ${getRoleTone(roleOption)} bg-white/5`
                                                                        : isActive
                                                                            ? 'border-primary/40 bg-primary/15 text-primary'
                                                                            : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                                                                }`}
                                                            >
                                                                {roleOption.replace('_', ' ')}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] leading-4 text-slate-500">
                                                    The primary role stays active automatically. Add roles like <span className="text-slate-400">resident + moderator</span> to combine permissions.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUserManagement;

