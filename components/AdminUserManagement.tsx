import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Profile, UserRole } from '../types';

interface AdminUserManagementProps {
    onClose: () => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onClose }) => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setUsers(data as Profile[] || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const updateUserRole = async (userId: string, newRole: UserRole) => {
        try {
            // Optimistic update
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) {
                throw error;
            }
            // Success feedback could be helpful here
        } catch (error: any) {
            console.error('Error updating role:', error);
            alert('Failed to update role: ' + error.message);
            fetchUsers(); // Revert on error
        }
    };

    const filteredUsers = users.filter(user =>
    (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const ROLES: UserRole[] = ['resident', 'fellow' as any, 'consultant', 'faculty', 'admin']; // Add fellow if needed, mostly matching types

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">

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
                    <div className="relative">
                        <span className="material-icons absolute left-3 top-2.5 text-slate-500 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Search users by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#050B14] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 outline-none transition-colors"
                        />
                    </div>
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
                            <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt={user.username || 'User'} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                <span className="material-icons text-lg">person</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-200">{user.full_name || 'Unnamed User'}</h3>
                                        <p className="text-[10px] text-slate-500">@{user.username || 'unknown'} • {user.year_level || 'N/A'}</p>
                                    </div>
                                </div>

                                <select
                                    value={user.role || 'resident'}
                                    onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                                    className={`bg-black/40 border border-white/10 rounded-lg py-1.5 px-3 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary transition-colors cursor-pointer
                                        ${user.role === 'admin' ? 'text-rose-400 border-rose-500/30' :
                                            user.role === 'faculty' ? 'text-indigo-400 border-indigo-500/30' :
                                                user.role === 'consultant' ? 'text-amber-400 border-amber-500/30' :
                                                    'text-slate-400'}`}
                                >
                                    <option value="resident">Resident</option>
                                    <option value="fellow">Fellow</option>
                                    <option value="consultant">Consultant</option>
                                    <option value="faculty">Faculty</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUserManagement;
