import { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, History, TrendingUp, User, Coffee, IceCream, GlassWater, ArrowRight, CheckCircle2, X, Wallet, ChevronRight, Minus, Bell } from 'lucide-react';
import { Sale, Stats, InventoryItem, Waitress } from '../types';
import { Link } from 'react-router-dom';

const ITEM_TYPES = ['Drink', 'Cocktail', 'Ice Cream'] as const;

export const ItemIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'Drink': return <GlassWater className={className} />;
    case 'Cocktail': return <Coffee className={className} />;
    case 'Ice Cream': return <IceCream className={className} />;
    default: return <GlassWater className={className} />;
  }
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [waitresses, setWaitresses] = useState<Waitress[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDrinkModalOpen, setIsDrinkModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [itemType, setItemType] = useState<typeof ITEM_TYPES[number]>('Drink');
  const [selectedDrink, setSelectedDrink] = useState<InventoryItem | null>(null);
  const [drinkQuantity, setDrinkQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [waiter, setWaiter] = useState<string>('');
  const [isPaid, setIsPaid] = useState(true);
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null);
  const prevInventoryRef = useRef<InventoryItem[]>([]);

  useEffect(() => {
    if (localStorage.getItem('demo_mode') === 'true') {
      const localInv = JSON.parse(localStorage.getItem('demo_inventory') || '[]');
      setInventory(localInv);
      
      const localSales = JSON.parse(localStorage.getItem('demo_sales') || '[]');
      const total = localSales.reduce((acc: any, s: any) => acc + s.price, 0);
      setStats({ total, unpaid: 0, byItem: [], recent: localSales.slice(0, 5) });
      return;
    }

    // Fetch Inventory
    const qInv = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribeInv = onSnapshot(qInv, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Check for stock updates (increases)
      if (prevInventoryRef.current.length > 0) {
        items.forEach(newItem => {
          const oldItem = prevInventoryRef.current.find(i => i.id === newItem.id);
          if (oldItem && newItem.quantity > oldItem.quantity) {
            const diff = newItem.quantity - oldItem.quantity;
            setNotification({
              message: `${diff} pieces of ${newItem.name} was just stocked`,
              id: Date.now()
            });
            // Auto-hide after 5 seconds
            setTimeout(() => setNotification(null), 5000);
          }
        });
      }
      
      prevInventoryRef.current = items;
      setInventory(items);
    });

    // Fetch Stats & Recent Sales (Daily)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qSales = query(
      collection(db, 'sales'), 
      where('timestamp', '>=', today),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        timestamp: doc.data().timestamp?.toDate() || new Date() 
      } as any));
      
      const total = sales.reduce((acc, s) => acc + s.price, 0);
      const unpaid = sales.reduce((acc, s) => acc + (s.is_paid ? 0 : s.price), 0);
      
      const byItemMap: any = {};
      sales.forEach(s => {
        if (!byItemMap[s.item_type]) byItemMap[s.item_type] = { item_type: s.item_type, total: 0, count: 0 };
        byItemMap[s.item_type].total += s.price;
        byItemMap[s.item_type].count += 1;
      });

      setStats({
        total,
        unpaid,
        byItem: Object.values(byItemMap),
        recent: sales.slice(0, 5)
      });
    });

    // Fetch Waitresses
    const qWaitresses = query(collection(db, 'waitresses'), where('active', '==', true));
    const unsubscribeWaitresses = onSnapshot(qWaitresses, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setWaitresses(items);
      if (items.length > 0 && !waiter) setWaiter(items[0].name);
    });

    return () => {
      unsubscribeInv();
      unsubscribeSales();
      unsubscribeWaitresses();
    };
  }, [waiter]);

  const handleRecordSale = async (e: FormEvent) => {
    e.preventDefault();
    const finalPrice = itemType === 'Drink' && selectedDrink 
      ? selectedDrink.price * drinkQuantity 
      : Number(price);

    if (!finalPrice || isNaN(finalPrice)) return;

    setIsLoading(true);

    if (localStorage.getItem('demo_mode') === 'true') {
      const newSale = {
        id: Date.now(),
        item_type: itemType,
        item_name: itemType === 'Drink' ? selectedDrink?.name : null,
        quantity: itemType === 'Drink' ? drinkQuantity : 1,
        price: finalPrice,
        waiter,
        is_paid: isPaid,
        timestamp: new Date()
      };
      const sales = JSON.parse(localStorage.getItem('demo_sales') || '[]');
      localStorage.setItem('demo_sales', JSON.stringify([newSale, ...sales]));
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsFormOpen(false);
        window.location.reload();
      }, 1000);
      return;
    }

    try {
      await addDoc(collection(db, 'sales'), {
        item_type: itemType,
        item_name: itemType === 'Drink' ? selectedDrink?.name : null,
        quantity: itemType === 'Drink' ? drinkQuantity : 1,
        price: finalPrice,
        waiter,
        is_paid: isPaid,
        timestamp: serverTimestamp()
      });

      // Update inventory if it's a drink
      if (itemType === 'Drink' && selectedDrink) {
        const drinkRef = doc(db, 'inventory', selectedDrink.id.toString());
        await updateDoc(drinkRef, {
          quantity: increment(-drinkQuantity)
        });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsFormOpen(false);
        setPrice('');
        setSelectedDrink(null);
        setDrinkQuantity(1);
      }, 1500);
    } catch (error) {
      console.error('Failed to record sale:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold flex-1">{notification.message}</p>
              <button onClick={() => setNotification(null)}>
                <X className="w-4 h-4 opacity-60" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-black/40 uppercase tracking-widest">Total Sales</span>
          <Wallet className="w-5 h-5 text-black/20" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tracking-tight">GHS</span>
          <span className="text-4xl font-semibold tracking-tighter">
            {stats?.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </span>
        </div>
        
        <div className="mt-8">
          <div className="bg-[#F9F9F9] rounded-2xl p-6 border border-black/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <History className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">Unpaid Total</span>
                <p className="text-2xl font-bold text-amber-600">
                  GHS {stats?.unpaid.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/20">Pending Collection</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-black/40">Categories</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ITEM_TYPES.map((type) => {
            const catStats = stats?.byItem.find(s => s.item_type === type);
            return (
              <div key={type} className="bg-white rounded-2xl p-4 border border-black/5 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                  <ItemIcon type={type} className="w-5 h-5 text-black/60" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-black/40 uppercase leading-none mb-1">{type}</p>
                  <p className="text-sm font-bold">GHS {catStats?.total.toFixed(0) || '0'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md px-6">
        <button 
          onClick={() => setIsFormOpen(true)}
          className="w-full bg-black text-white rounded-2xl py-5 font-bold flex items-center justify-center gap-3 shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-6 h-6" />
          <span>Record New Sale</span>
        </button>
      </div>

      {/* Record Sale Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-50 p-8 max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Record Sale</h2>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordSale} className="space-y-8">
                {/* Item Type Selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Item</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ITEM_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setItemType(type)}
                        className={`py-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                          itemType === type 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-white border-black/5 text-black/60 hover:border-black/20'
                        }`}
                      >
                        <ItemIcon type={type} className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price or Drink Selection */}
                {itemType === 'Drink' ? (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Drink & Quantity</label>
                    <div 
                      onClick={() => setIsDrinkModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-6 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-lg">{selectedDrink ? selectedDrink.name : 'Choose a drink...'}</p>
                        {selectedDrink && (
                          <p className="text-sm text-black/40 font-medium">GHS {selectedDrink.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-black/20" />
                    </div>

                    {selectedDrink && (
                      <div className="flex items-center justify-between bg-black text-white p-6 rounded-2xl">
                        <div className="flex items-center gap-6">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="text-2xl font-bold w-8 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-xl font-bold">GHS {(selectedDrink.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Price (GHS)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-black/40">GHS</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#F5F5F5] border-none rounded-2xl py-6 pl-16 pr-6 text-2xl font-bold focus:ring-2 focus:ring-black transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Waiter Selector */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Served By</label>
                  <div className="grid grid-cols-3 gap-2">
                    {waitresses.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWaiter(w.name)}
                        className={`py-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                          waiter === w.name 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-white border-black/5 text-black/60 hover:border-black/20'
                        }`}
                      >
                        <User className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase">{w.name}</span>
                      </button>
                    ))}
                    {waitresses.length === 0 && (
                      <p className="col-span-3 text-center text-xs text-black/40 italic py-2">No active waitresses found.</p>
                    )}
                  </div>
                </div>

                {/* Paid Toggle */}
                <div className="flex items-center justify-between bg-[#F5F5F5] p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPaid ? 'bg-emerald-500 text-white' : 'bg-black/10 text-black/40'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Payment Status</p>
                      <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider">{isPaid ? 'Paid in Full' : 'Pending Payment'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPaid(!isPaid)}
                    className={`w-14 h-8 rounded-full relative transition-colors ${isPaid ? 'bg-emerald-500' : 'bg-black/20'}`}
                  >
                    <motion.div 
                      animate={{ x: isPaid ? 24 : 4 }}
                      className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit"
                  disabled={isLoading || success}
                  className={`w-full py-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${
                    success 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-black text-white hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Sale Recorded!</span>
                    </>
                  ) : (
                    <>
                      <span>Record Sale</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Drink Selection Sub-Modal */}
      <AnimatePresence>
        {isDrinkModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrinkModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Drink</h2>
                <button 
                  onClick={() => setIsDrinkModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No drinks in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedDrink(item);
                        setIsDrinkModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedDrink?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedDrink?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedDrink?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
