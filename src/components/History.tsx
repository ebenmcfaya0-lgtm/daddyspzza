import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sale } from '../types';
import { ItemIcon } from './Dashboard';
import { Search, Filter, Trash2, CheckCircle2, XCircle } from 'lucide-react';

export default function History() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'sales'), 
      where('timestamp', '>=', today),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as any));
      setSales(salesData);
    });

    return () => unsubscribe();
  }, []);

  const filteredSales = sales.filter(sale => 
    sale.item_type.toLowerCase().includes(search.toLowerCase()) ||
    (sale.item_name && sale.item_name.toLowerCase().includes(search.toLowerCase())) ||
    sale.waiter.toLowerCase().includes(search.toLowerCase())
  );

  const togglePaidStatus = async (id: string, currentStatus: boolean) => {
    try {
      const saleRef = doc(db, 'sales', id);
      await updateDoc(saleRef, {
        is_paid: !currentStatus
      });
    } catch (error) {
      console.error('Failed to update sale:', error);
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sales', id));
      setIsDeleting(null);
    } catch (error) {
      console.error('Failed to delete sale:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Sales History</h2>
        
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input 
              type="text"
              placeholder="Search items or waiters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-black/5 rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <button className="w-12 h-12 bg-white border border-black/5 rounded-2xl flex items-center justify-center text-black/40 hover:text-black transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-black/5 text-center">
            <p className="text-black/40 text-sm italic">No transactions found.</p>
          </div>
        ) : (
          filteredSales.map((sale) => (
            <motion.div 
              key={sale.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 border border-black/5 flex items-center justify-between group hover:border-black/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                  <ItemIcon type={sale.item_type} className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">
                      {sale.item_type === 'Drink' && sale.item_name ? `${sale.item_name} (x${sale.quantity})` : sale.item_type}
                    </p>
                    <button 
                      onClick={() => togglePaidStatus(sale.id, sale.is_paid)}
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider transition-colors ${
                        sale.is_paid 
                        ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' 
                        : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                      }`}
                    >
                      {sale.is_paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </div>
                  <p className="text-xs text-black/40 font-medium">Served by {sale.waiter}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-sm">GHS {sale.price.toFixed(2)}</p>
                  <p className="text-[10px] text-black/30 font-bold uppercase tracking-tighter">
                    {new Date(sale.timestamp).toLocaleDateString()} {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button 
                  onClick={() => setIsDeleting(sale.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black/10 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting !== null && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleting(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[320px] bg-white rounded-[32px] p-8 z-[70] shadow-2xl"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Delete Transaction?</h3>
                  <p className="text-sm text-black/40 mt-1">This action cannot be undone and will affect your totals.</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={() => deleteSale(isDeleting)}
                    className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => setIsDeleting(null)}
                    className="w-full py-4 bg-[#F5F5F5] text-black rounded-2xl font-bold hover:bg-[#EEEEEE] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
