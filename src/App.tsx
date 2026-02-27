import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { UserRole } from './types';

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Safety timeout: If auth doesn't respond in 5 seconds, stop loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth state check timed out');
        setIsLoading(false);
      }
    }, 5000);

    // Check for Demo Mode bypass
    if (localStorage.getItem('demo_mode') === 'true') {
      setRole('grounds_manager'); 
      setIsLoading(false);
      clearTimeout(timeout);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const fetchedRole = userData.role as UserRole;
            
            const intendedRole = localStorage.getItem('intended_role');
            
            if (intendedRole && intendedRole !== fetchedRole) {
              console.error(`Role mismatch: Intended ${intendedRole}, but account is ${fetchedRole}`);
              await signOut(auth);
              setRole(null);
              alert(`Access Denied: This account is registered as a ${fetchedRole.replace('_', ' ')}. You cannot log in as a ${intendedRole.replace('_', ' ')}.`);
            } else {
              setRole(fetchedRole);
            }
          } else {
            console.warn('No Firestore profile found for user:', user.uid);
            setRole(null);
          }
        } catch (error) {
          console.error('Auth state error:', error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      
      localStorage.removeItem('intended_role');
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRole(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!role) {
    return <Login />;
  }

  return (
    <Router>
      <Layout role={role} onLogout={handleLogout}>
        <Routes>
          {role === 'grounds_manager' ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/history" element={<History />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : role === 'administrator' ? (
            <>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/history" element={<History />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/inventory" element={<Inventory />} />
              <Route path="*" element={<Navigate to="/inventory" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </Router>
  );
}
