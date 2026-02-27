import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserRole, Waitress } from '../types';
import { 
  Users, UserPlus, Trash2, Shield, UserCheck, 
  Settings, Plus, X, Check, Search, AlertCircle,
  UserCircle, Briefcase, Crown, User
} from 'lucide-react';

interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: any;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [waitresses, setWaitresses] = useState<Waitress[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'waitresses'>('users');
  const [isWaitressModalOpen, setIsWaitressModalOpen] = useState(false);
  const [newWaitressName, setNewWaitressName] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setUsers(items);
      setIsLoading(false);
    }, (error) => {
      console.error('Users fetch error:', error);
      setIsLoading(false);
    });

    // Fetch Waitresses
    const unsubscribeWaitresses = onSnapshot(collection(db, 'waitresses'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setWaitresses(items);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeWaitresses();
    };
  }, []);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleAddWaitress = async (e: FormEvent) => {
    e.preventDefault();
    if (!newWaitressName.trim()) return;
    setError(null);
    try {
      await addDoc(collection(db, 'waitresses'), {
        name: newWaitressName.trim(),
        active: true
      });
      setNewWaitressName('');
      setIsWaitressModalOpen(false);
    } catch (err: any) {
      console.error('Failed to add waitress:', err);
      if (err.code === 'permission-denied') {
        setError('Permission Denied: Your Firebase Security Rules are blocking this action. Ensure you have published the rules I provided.');
      } else {
        setError(`Error: ${err.message}`);
      }
    }
  };

  const toggleWaitressStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'waitresses', id), { active: !currentStatus });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const deleteWaitress = async (id: string) => {
    if (!confirm('Are you sure you want to delete this waitress?')) return;
    try {
      await deleteDoc(doc(db, 'waitresses', id));
    } catch (err) {
      console.error('Failed to delete waitress:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredWaitresses = waitresses.filter(w => 
    (w.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin" />
        <p className="text-sm font-bold text-black/40 uppercase tracking-widest">Loading Admin Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Administration</h2>
          <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
            <Settings className="w-6 h-6" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-black/5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'users' ? 'bg-white text-black shadow-sm' : 'text-black/40'
            }`}
          >
            <Users className="w-4 h-4" />
            System Users
          </button>
          <button 
            onClick={() => setActiveTab('waitresses')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'waitresses' ? 'bg-white text-black shadow-sm' : 'text-black/40'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Waitresses
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input 
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-black transition-all"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'users' ? (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 bg-white rounded-[32px] border border-black/5">
                <p className="text-black/40 italic text-sm">No users found.</p>
              </div>
            )}
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-white rounded-[32px] p-6 border border-black/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-black/40" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{user.email}</p>
                      <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">UID: {user.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    user.role === 'administrator' ? 'bg-purple-100 text-purple-600' :
                    user.role === 'grounds_manager' ? 'bg-blue-100 text-blue-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {user.role.replace('_', ' ')}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  {(['administrator', 'grounds_manager', 'inventory_keeper'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => updateUserRole(user.id, role)}
                      className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${
                        user.role === role 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 text-black/40 hover:border-black/20'
                      }`}
                    >
                      Set {role.split('_')[0]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="waitresses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <button 
              onClick={() => setIsWaitressModalOpen(true)}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-black/10"
            >
              <Plus className="w-5 h-5" />
              Add New Waitress
            </button>

            {filteredWaitresses.length === 0 && (
              <div className="text-center py-12 bg-white rounded-[32px] border border-black/5">
                <p className="text-black/40 italic text-sm">No waitresses found.</p>
              </div>
            )}

            {filteredWaitresses.map((waitress) => (
              <div key={waitress.id} className="bg-white rounded-[32px] p-6 border border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${waitress.active ? 'bg-emerald-100 text-emerald-600' : 'bg-black/5 text-black/20'}`}>
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{waitress.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${waitress.active ? 'text-emerald-500' : 'text-black/20'}`}>
                      {waitress.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleWaitressStatus(waitress.id, waitress.active)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      waitress.active ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {waitress.active ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => deleteWaitress(waitress.id)}
                    className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Waitress Modal */}
      <AnimatePresence>
        {isWaitressModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWaitressModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-[60] p-6 max-w-md mx-auto max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Add Waitress</h2>
                <button onClick={() => setIsWaitressModalOpen(false)} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddWaitress} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Full Name</label>
                  <input 
                    type="text"
                    value={newWaitressName}
                    onChange={(e) => setNewWaitressName(e.target.value)}
                    placeholder="Enter waitress name..."
                    className="w-full bg-black/5 border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-black transition-all"
                    autoFocus
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-black text-white rounded-2xl font-bold shadow-xl shadow-black/20"
                >
                  Confirm Addition
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Admin Info Card */}
      <div className="bg-purple-600 rounded-[32px] p-8 text-white shadow-2xl shadow-purple-600/30 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-xl">Admin Control</h3>
            <p className="text-white/60 text-xs">Manage system access and staff</p>
          </div>
        </div>
        
        <div className="space-y-4 text-sm text-white/80 leading-relaxed">
          <p>
            As an administrator, you can promote users to managers or keepers. New users must sign up first, then you can assign their roles here.
          </p>
          
          <div className="bg-black/20 rounded-2xl p-4 space-y-2 font-mono text-[10px]">
            <p className="uppercase text-white/40 font-bold tracking-widest">System Diagnostics</p>
            <p><span className="text-white/40">Project ID:</span> {import.meta.env.VITE_FIREBASE_PROJECT_ID}</p>
            <p><span className="text-white/40">Your UID:</span> {auth.currentUser?.uid}</p>
            <p><span className="text-white/40">Role:</span> Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
