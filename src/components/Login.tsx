import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';
import { ShieldCheck, User, Lock, AlertCircle, LayoutDashboard, Package, ChevronLeft, Shield } from 'lucide-react';

type LoginStep = 'role_selection' | 'credentials';

export default function Login() {
  const [step, setStep] = useState<LoginStep>('role_selection');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [needsProfile, setNeedsProfile] = useState<{ uid: string, email: string } | null>(null);
  const [currentFirestoreRole, setCurrentFirestoreRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (user && !needsProfile) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            setNeedsProfile({ uid: user.uid, email: user.email || '' });
            setError('Your account is authenticated, but no role is assigned in the database.');
            setStep('credentials'); 
          } else {
            setCurrentFirestoreRole(userDoc.data().role);
          }
        } catch (err) {
          console.error('Auth check error:', err);
        }
      }
    };
    checkAuth();
  }, [needsProfile]);

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  };

  const missingKeys = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);

  const configMissing = missingKeys.length > 0;

  const handleCreateProfile = async () => {
    if (!needsProfile || !selectedRole) return;
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'users', needsProfile.uid), {
        email: needsProfile.email,
        role: selectedRole,
        createdAt: new Date()
      });
      // Success will trigger App.tsx onAuthStateChanged or we can reload
      window.location.reload();
    } catch (err: any) {
      console.error('Profile creation error:', err);
      setError(`Failed to create profile: ${err.message}. Ensure your Firestore rules allow writing to the "users" collection.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    localStorage.setItem('demo_mode', 'true');
    window.location.reload();
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    localStorage.setItem('intended_role', role);
    setStep('credentials');
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify the role matches what was selected
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userRole = userDoc.data().role;
          if (userRole !== selectedRole) {
            await auth.signOut();
            setError(`Access Denied: This account is registered as a ${userRole.replace('_', ' ')}. You cannot log in as a ${selectedRole?.replace('_', ' ')}.`);
            setIsLoading(false);
            return;
          }
        } else {
          // User exists in Auth but not in Firestore
          setNeedsProfile({ uid: user.uid, email: user.email || '' });
          setError('Your account exists, but no role is assigned yet.');
        }
      } catch (firestoreErr: any) {
        console.error('Firestore error:', firestoreErr);
        if (firestoreErr.code === 'permission-denied') {
          setError('Permission Denied: Please check your Firestore Security Rules. The app cannot read your user profile.');
        } else {
          setError(`Database Error: ${firestoreErr.message}`);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorCode = err.code || 'unknown';
      const errorMessage = err.message || 'An unexpected error occurred';
      
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (errorCode === 'auth/invalid-api-key' || errorCode === 'auth/network-request-failed') {
        setError(`Firebase Configuration Error: ${errorCode}. Please check your API Key and internet connection.`);
      } else {
        setError(`Login failed (${errorCode}): ${errorMessage}. Please check your Firebase configuration.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-black rounded-[24px] flex items-center justify-center mx-auto shadow-2xl shadow-black/20">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Grounds Manager</h1>
            <p className="text-black/40 font-medium">
              {step === 'role_selection' ? 'Select your role to continue' : 'Sign in to your account'}
            </p>
          </div>
        </div>

        {configMissing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 p-6 rounded-[32px] space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-700 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>Configuration Incomplete</span>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-amber-800/70 font-medium uppercase tracking-wider">Missing Variables:</p>
              <div className="flex flex-wrap gap-2">
                {missingKeys.map(key => (
                  <code key={key} className="bg-amber-100 px-2 py-1 rounded text-[10px] text-amber-900 font-bold border border-amber-200">
                    {key}
                  </code>
                ))}
              </div>
            </div>
            <button 
              onClick={handleDemoLogin}
              className="w-full py-3 bg-amber-600 text-white rounded-2xl text-xs font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
            >
              Enter Demo Mode (Bypass Firebase)
            </button>
          </motion.div>
        )}

        {!configMissing && error && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-2">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
            >
              {showDebug ? 'Hide Diagnostics' : 'Show Diagnostics'}
            </button>
            {showDebug && (
              <div className="text-[10px] text-blue-800/60 font-mono space-y-1 break-all">
                <p>Current Domain: {window.location.hostname}</p>
                <p>Auth Domain: {config.authDomain}</p>
                <p>User UID: {auth.currentUser?.uid || 'Not logged in'}</p>
                <p>Firestore Role: {currentFirestoreRole || 'None found'}</p>
                <p className="pt-2 font-bold text-blue-700">Add this to Firebase Authorized Domains:</p>
                <code className="bg-blue-100 p-1 rounded select-all">{window.location.hostname}</code>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 'role_selection' ? (
            <motion.div 
              key="roles"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 gap-4"
            >
              <button 
                onClick={() => handleRoleSelect('administrator')}
                className="group bg-white p-8 rounded-[32px] border border-black/5 flex items-center gap-6 hover:border-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-left shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-purple-600/20">
                  <Shield className="text-white w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Administrator</h3>
                  <p className="text-sm text-black/40">Manage users, staff & system settings</p>
                </div>
              </button>

              <button 
                onClick={() => handleRoleSelect('grounds_manager')}
                className="group bg-white p-8 rounded-[32px] border border-black/5 flex items-center gap-6 hover:border-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-left shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="text-white w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Grounds Sale Manager</h3>
                  <p className="text-sm text-black/40">Record sales, view reports & history</p>
                </div>
              </button>

              <button 
                onClick={() => handleRoleSelect('inventory_keeper')}
                className="group bg-white p-8 rounded-[32px] border border-black/5 flex items-center gap-6 hover:border-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-left shadow-sm"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Package className="text-white w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Inventory Keeper</h3>
                  <p className="text-sm text-black/40">Manage drinks & stock levels</p>
                </div>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setStep('role_selection')}
                className="flex items-center gap-2 text-black/40 hover:text-black transition-colors text-xs font-bold uppercase tracking-widest ml-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to roles
              </button>

              <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-black/5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedRole === 'administrator' ? 'bg-purple-600' :
                    selectedRole === 'grounds_manager' ? 'bg-black' : 
                    'bg-emerald-500'
                  }`}>
                    {selectedRole === 'administrator' ? <Shield className="text-white w-4 h-4" /> :
                     selectedRole === 'grounds_manager' ? <LayoutDashboard className="text-white w-4 h-4" /> : 
                     <Package className="text-white w-4 h-4" />}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-black/60">
                    Logging in as {selectedRole?.replace('_', ' ')}
                  </span>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-red-50 text-red-600 p-4 rounded-2xl space-y-3 text-sm font-medium"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                    
                    {needsProfile && (
                      <div className="space-y-2 pt-2">
                        <button 
                          onClick={handleCreateProfile}
                          className="w-full py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
                        >
                          Initialize My {selectedRole?.replace('_', ' ')} Profile
                        </button>
                        <button 
                          onClick={() => {
                            auth.signOut();
                            setNeedsProfile(null);
                            setError('');
                            window.location.reload();
                          }}
                          className="w-full py-2 bg-black/5 text-black/60 rounded-xl text-xs font-bold hover:bg-black/10 transition-colors"
                        >
                          Sign Out & Try Different Account
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-4">Email</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/20" />
                      <input 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full bg-[#F9F9F9] border border-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-black transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-4">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/20" />
                      <input 
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-[#F9F9F9] border border-black/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-black transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/20">
            Firebase Authentication Active
          </p>
          <p className="text-[10px] text-black/30 max-w-[280px] mx-auto">
            Please ensure you have configured your Firebase project and added users to the 'users' collection with their UID as the document ID.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
