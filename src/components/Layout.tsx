import { ReactNode } from 'react';
import { User, LayoutDashboard, History as HistoryIcon, Package, BarChart3, LogOut, Shield, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole } from '../types';

interface LayoutProps {
  children: ReactNode;
  role: UserRole;
  onLogout: () => void;
}

export default function Layout({ children, role, onLogout }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = location.pathname !== '/';

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center hover:bg-black/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              {role === 'grounds_manager' ? <LayoutDashboard className="text-white w-5 h-5" /> : 
               role === 'administrator' ? <Shield className="text-white w-5 h-5" /> :
               <Package className="text-white w-5 h-5" />}
            </div>
          )}
          <div>
            <h1 className="font-semibold text-lg leading-tight">Grounds Manager</h1>
            <p className="text-xs text-black/40 font-medium uppercase tracking-wider">
              {role === 'grounds_manager' ? 'Sales Manager' : 
               role === 'administrator' ? 'Administrator' :
               'Inventory Keeper'}
            </p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-4 flex justify-around items-center z-10">
        {role === 'grounds_manager' ? (
          <>
            <Link 
              to="/" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-black' : 'text-black/30'}`}
            >
              <LayoutDashboard className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
            </Link>
            <Link 
              to="/reports" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/reports' ? 'text-black' : 'text-black/30'}`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Reports</span>
            </Link>
            <Link 
              to="/history" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/history' ? 'text-black' : 'text-black/30'}`}
            >
              <HistoryIcon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
            </Link>
          </>
        ) : role === 'administrator' ? (
          <>
            <Link 
              to="/" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-black' : 'text-black/30'}`}
            >
              <Shield className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
            </Link>
            <Link 
              to="/inventory" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/inventory' ? 'text-black' : 'text-black/30'}`}
            >
              <Package className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Stock</span>
            </Link>
            <Link 
              to="/reports" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/reports' ? 'text-black' : 'text-black/30'}`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Reports</span>
            </Link>
            <Link 
              to="/history" 
              className={`flex flex-col items-center gap-1 ${location.pathname === '/history' ? 'text-black' : 'text-black/30'}`}
            >
              <HistoryIcon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Sales</span>
            </Link>
          </>
        ) : (
          <Link 
            to="/inventory" 
            className={`flex flex-col items-center gap-1 ${location.pathname === '/inventory' ? 'text-black' : 'text-black/30'}`}
          >
            <Package className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Inventory</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
