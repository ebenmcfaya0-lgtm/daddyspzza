import { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, History, TrendingUp, User, Coffee, IceCream, GlassWater, ArrowRight, CheckCircle2, X, Wallet, ChevronRight, Minus, Bell, Cake, MoreHorizontal } from 'lucide-react';
import { Sale, Stats, InventoryItem, Waitress } from '../types';
import { Link } from 'react-router-dom';

export const ITEM_TYPES = ['Drink', 'Cocktail', 'Ice Cream', 'Teas', 'Cakes', 'Others'] as const;

const COCKTAIL_ITEMS = [
  { id: 'c1', name: 'Juice', price: 35 },
  { id: 'c2', name: 'Alcohol Cocktail', price: 80 },
  { id: 'c3', name: 'Cocktail', price: 70 },
  { id: 'c4', name: 'Tzepao', price: 50 },
];

export const ItemIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'Drink': return <GlassWater className={className} />;
    case 'Cocktail': return <Coffee className={className} />;
    case 'Ice Cream': return <IceCream className={className} />;
    case 'Teas': return <Coffee className={className} />;
    case 'Cakes': return <Cake className={className} />;
    case 'Others': return <MoreHorizontal className={className} />;
    default: return <GlassWater className={className} />;
  }
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [waitresses, setWaitresses] = useState<Waitress[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDrinkModalOpen, setIsDrinkModalOpen] = useState(false);
  const [isCocktailModalOpen, setIsCocktailModalOpen] = useState(false);
  const [isIceCreamModalOpen, setIsIceCreamModalOpen] = useState(false);
  const [isTeasModalOpen, setIsTeasModalOpen] = useState(false);
  const [isCakesModalOpen, setIsCakesModalOpen] = useState(false);
  const [isOthersModalOpen, setIsOthersModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [itemType, setItemType] = useState<typeof ITEM_TYPES[number]>('Drink');
  const [selectedDrink, setSelectedDrink] = useState<InventoryItem | null>(null);
  const [selectedCocktail, setSelectedCocktail] = useState<typeof COCKTAIL_ITEMS[number] | null>(null);
  const [selectedIceCream, setSelectedIceCream] = useState<InventoryItem | null>(null);
  const [selectedTea, setSelectedTea] = useState<InventoryItem | null>(null);
  const [selectedCake, setSelectedCake] = useState<InventoryItem | null>(null);
  const [selectedOther, setSelectedOther] = useState<InventoryItem | null>(null);
  const [drinkQuantity, setDrinkQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [waiter, setWaiter] = useState<string>('');
  const [isPaid, setIsPaid] = useState(true);
  const [tag, setTag] = useState<'Customer' | 'Staff' | 'Boss'>('Customer');
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
      
      // Only set default waiter if one isn't already selected
      setWaiter(current => {
        if (!current && items.length > 0) return items[0].name;
        return current;
      });
    });

    return () => {
      unsubscribeInv();
      unsubscribeSales();
      unsubscribeWaitresses();
    };
  }, []);

  const handleRecordSale = async (e: FormEvent) => {
    e.preventDefault();
    let finalPrice = 0;
    let itemName = null;

    if (itemType === 'Drink' && selectedDrink) {
      finalPrice = selectedDrink.price * drinkQuantity;
      itemName = selectedDrink.name;
    } else if (itemType === 'Cocktail' && selectedCocktail) {
      finalPrice = selectedCocktail.price * drinkQuantity;
      itemName = selectedCocktail.name;
    } else if (itemType === 'Ice Cream' && selectedIceCream) {
      finalPrice = selectedIceCream.price * drinkQuantity;
      itemName = selectedIceCream.name;
    } else if (itemType === 'Teas' && selectedTea) {
      finalPrice = selectedTea.price * drinkQuantity;
      itemName = selectedTea.name;
    } else if (itemType === 'Cakes' && selectedCake) {
      finalPrice = selectedCake.price * drinkQuantity;
      itemName = selectedCake.name;
    } else if (itemType === 'Others' && selectedOther) {
      finalPrice = selectedOther.price * drinkQuantity;
      itemName = selectedOther.name;
    } else {
      finalPrice = Number(price);
    }

    if (!finalPrice || isNaN(finalPrice)) return;

    setIsLoading(true);

    if (localStorage.getItem('demo_mode') === 'true') {
      const newSale = {
        id: Date.now(),
        item_type: itemType,
        item_name: itemName,
        quantity: drinkQuantity,
        price: finalPrice,
        waiter,
        is_paid: isPaid,
        tag,
        timestamp: new Date()
      };
      const sales = JSON.parse(localStorage.getItem('demo_sales') || '[]');
      localStorage.setItem('demo_sales', JSON.stringify([newSale, ...sales]));
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsFormOpen(false);
        // Reset form
        setPrice('');
        setSelectedDrink(null);
        setSelectedCocktail(null);
        setSelectedIceCream(null);
        setSelectedTea(null);
        setSelectedCake(null);
        setSelectedOther(null);
        setDrinkQuantity(1);
        setTag('Customer');
        setIsPaid(true);
      }, 1000);
      return;
    }

    try {
      await addDoc(collection(db, 'sales'), {
        item_type: itemType,
        item_name: itemName,
        quantity: drinkQuantity,
        price: finalPrice,
        waiter,
        is_paid: isPaid,
        tag,
        timestamp: serverTimestamp()
      });

      // Update inventory if it's a tracked item type
      if (
        (itemType === 'Drink' && selectedDrink) || 
        (itemType === 'Cocktail' && selectedCocktail) || 
        (itemType === 'Ice Cream' && selectedIceCream) ||
        (itemType === 'Teas' && selectedTea) ||
        (itemType === 'Cakes' && selectedCake) ||
        (itemType === 'Others' && selectedOther)
      ) {
        let itemId = null;
        if (itemType === 'Drink') itemId = selectedDrink?.id;
        else if (itemType === 'Cocktail') itemId = selectedCocktail?.id;
        else if (itemType === 'Ice Cream') itemId = selectedIceCream?.id;
        else if (itemType === 'Teas') itemId = selectedTea?.id;
        else if (itemType === 'Cakes') itemId = selectedCake?.id;
        else if (itemType === 'Others') itemId = selectedOther?.id;

        if (itemId && !itemId.toString().startsWith('c')) { // Don't try to decrement hardcoded IDs
          const itemRef = doc(db, 'inventory', itemId.toString());
          await updateDoc(itemRef, {
            quantity: increment(-drinkQuantity)
          });
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsFormOpen(false);
        setPrice('');
        setSelectedDrink(null);
        setSelectedCocktail(null);
        setSelectedIceCream(null);
        setSelectedTea(null);
        setSelectedCake(null);
        setSelectedOther(null);
        setDrinkQuantity(1);
        setTag('Customer');
        setIsPaid(true);
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
        
        <div className="grid grid-cols-2 gap-3 mt-8">
          {/* Paid Total Card */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/60">Paid Total</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">
              GHS {((stats?.total || 0) - (stats?.unpaid || 0)).toFixed(2)}
            </p>
          </div>

          {/* Unpaid Total Card */}
          <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <History className="w-3 h-3 text-amber-600" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/60">Unpaid Total</span>
            </div>
            <p className="text-xl font-bold text-amber-700">
              GHS {stats?.unpaid.toFixed(2) || '0.00'}
            </p>
          </div>

          {/* Miscellaneous Card */}
          <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100 flex flex-col gap-1 col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MoreHorizontal className="w-3 h-3 text-indigo-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/60">Miscellaneous</span>
              </div>
              <div className="flex gap-1 opacity-20">
                <GlassWater className="w-3 h-3" />
                <Coffee className="w-3 h-3" />
                <IceCream className="w-3 h-3" />
                <Cake className="w-3 h-3" />
              </div>
            </div>
            <p className="text-xl font-bold text-indigo-700">
              GHS {stats?.byItem
                .filter(s => ['Drink', 'Teas', 'Ice Cream', 'Cakes', 'Others'].includes(s.item_type))
                .reduce((acc, s) => acc + s.total, 0).toFixed(2) || '0.00'}
            </p>
            <p className="text-[8px] font-medium text-indigo-600/40 uppercase tracking-widest">
              Drinks, Teas, Ice Cream, Cakes & Others
            </p>
          </div>
        </div>
      </motion.div>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-black/40">Categories</h2>
        </div>
        
        <div className="space-y-6">
          {/* Main Categories */}
          <div className="grid grid-cols-1 gap-3">
            {['Cocktail'].map((type) => {
              const catStats = stats?.byItem.find(s => s.item_type === type);
              return (
                <div key={type} className="bg-white rounded-2xl p-5 border border-black/5 flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                    <ItemIcon type={type} className="w-6 h-6 text-black/60" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mb-0.5">{type}</p>
                    <p className="text-lg font-bold">GHS {catStats?.total.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Miscellaneous Section */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/20 ml-2">Miscellaneous Breakdown</h3>
            <div className="grid grid-cols-2 gap-3">
              {['Drink', 'Teas', 'Ice Cream', 'Cakes', 'Others'].map((type) => {
                const catStats = stats?.byItem.find(s => s.item_type === type);
                return (
                  <div key={type} className="bg-white/50 rounded-2xl p-4 border border-black/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center">
                      <ItemIcon type={type} className="w-4 h-4 text-black/40" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-black/40 uppercase tracking-wider leading-tight">{type}</p>
                      <p className="text-sm font-bold">GHS {catStats?.total.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-28 right-6 z-30">
        <button 
          onClick={() => {
            setSelectedDrink(null);
            setSelectedCocktail(null);
            setSelectedIceCream(null);
            setSelectedTea(null);
            setSelectedCake(null);
            setSelectedOther(null);
            setPrice('');
            setDrinkQuantity(1);
            setIsFormOpen(true);
          }}
          className="w-14 h-14 bg-black text-white rounded-xl flex items-center justify-center shadow-2xl shadow-black/40 hover:scale-110 active:scale-90 transition-all"
        >
          <Plus className="w-7 h-7" />
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
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-50 p-6 max-w-md mx-auto max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Record Sale</h2>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordSale} className="space-y-6">
                {/* Item Type Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Item</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ITEM_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setItemType(type);
                          setSelectedDrink(null);
                          setSelectedCocktail(null);
                          setSelectedIceCream(null);
                          setSelectedTea(null);
                          setSelectedCake(null);
                          setSelectedOther(null);
                          setPrice('');
                          setDrinkQuantity(1);
                        }}
                        className={`py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                          itemType === type 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-white border-black/5 text-black/60 hover:border-black/20'
                        }`}
                      >
                        <ItemIcon type={type} className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price or Selection */}
                {itemType === 'Drink' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Drink & Quantity</label>
                    <div 
                      onClick={() => setIsDrinkModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedDrink ? selectedDrink.name : 'Choose a drink...'}</p>
                        {selectedDrink && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedDrink.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedDrink && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedDrink.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : itemType === 'Cocktail' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Cocktail & Quantity</label>
                    <div 
                      onClick={() => setIsCocktailModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedCocktail ? selectedCocktail.name : 'Choose a cocktail...'}</p>
                        {selectedCocktail && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedCocktail.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedCocktail && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedCocktail.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : itemType === 'Ice Cream' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Ice Cream & Quantity</label>
                    <div 
                      onClick={() => setIsIceCreamModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedIceCream ? selectedIceCream.name : 'Choose ice cream...'}</p>
                        {selectedIceCream && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedIceCream.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedIceCream && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedIceCream.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : itemType === 'Teas' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Tea & Quantity</label>
                    <div 
                      onClick={() => setIsTeasModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedTea ? selectedTea.name : 'Choose tea...'}</p>
                        {selectedTea && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedTea.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedTea && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedTea.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : itemType === 'Cakes' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Cake & Quantity</label>
                    <div 
                      onClick={() => setIsCakesModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedCake ? selectedCake.name : 'Choose cake...'}</p>
                        {selectedCake && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedCake.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedCake && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedCake.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : itemType === 'Others' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Select Item & Quantity</label>
                    <div 
                      onClick={() => setIsOthersModalOpen(true)}
                      className="w-full bg-[#F5F5F5] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#EEEEEE] transition-all"
                    >
                      <div>
                        <p className="font-bold text-base">{selectedOther ? selectedOther.name : 'Choose item...'}</p>
                        {selectedOther && (
                          <p className="text-xs text-black/40 font-medium">GHS {selectedOther.price.toFixed(2)} each</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-black/20" />
                    </div>

                    {selectedOther && (
                      <div className="flex items-center justify-between bg-black text-white p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(Math.max(1, drinkQuantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-xl font-bold w-6 text-center">{drinkQuantity}</span>
                          <button 
                            type="button"
                            onClick={() => setDrinkQuantity(drinkQuantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Price</p>
                          <p className="text-lg font-bold">GHS {(selectedOther.price * drinkQuantity).toFixed(2)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Price (GHS)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-black/40">GHS</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#F5F5F5] border-none rounded-2xl py-4 pl-16 pr-6 text-xl font-bold focus:ring-2 focus:ring-black transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Tag Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Tag / Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Customer', 'Staff', 'Boss'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTag(t);
                          if (t !== 'Customer') setIsPaid(false);
                          else setIsPaid(true);
                        }}
                        className={`py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                          tag === t 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-white border-black/5 text-black/60 hover:border-black/20'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Waiter Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Served By</label>
                  <div className="grid grid-cols-3 gap-2">
                    {waitresses.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWaiter(w.name)}
                        className={`py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                          waiter === w.name 
                          ? 'bg-black border-black text-white shadow-lg' 
                          : 'bg-white border-black/5 text-black/60 hover:border-black/20'
                        }`}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">{w.name}</span>
                      </button>
                    ))}
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
                  disabled={
                    isLoading || 
                    success || 
                    (itemType === 'Drink' && !selectedDrink) || 
                    (itemType === 'Cocktail' && !selectedCocktail) || 
                    (itemType === 'Ice Cream' && !selectedIceCream) ||
                    (itemType === 'Teas' && !selectedTea) ||
                    (itemType === 'Cakes' && !selectedCake) ||
                    (itemType === 'Others' && !selectedOther) ||
                    (!ITEM_TYPES.includes(itemType as any) && !price)
                  }
                  className={`w-full py-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${
                    success 
                    ? 'bg-emerald-500 text-white' 
                    : (isLoading || 
                       (itemType === 'Drink' && !selectedDrink) || 
                       (itemType === 'Cocktail' && !selectedCocktail) || 
                       (itemType === 'Ice Cream' && !selectedIceCream) ||
                       (itemType === 'Teas' && !selectedTea) ||
                       (itemType === 'Cakes' && !selectedCake) ||
                       (itemType === 'Others' && !selectedOther))
                      ? 'bg-black/20 text-black/40 cursor-not-allowed'
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
                {inventory.filter(i => i.type === 'Drink' || !i.type).length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No drinks in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.filter(i => i.type === 'Drink' || !i.type).map((item) => (
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
      {/* Cocktail Selection Sub-Modal */}
      <AnimatePresence>
        {isCocktailModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCocktailModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Cocktail</h2>
                <button 
                  onClick={() => setIsCocktailModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.filter(i => i.type === 'Cocktail').length === 0 ? (
                  // Fallback to hardcoded if inventory is empty
                  COCKTAIL_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedCocktail(item as any);
                        setIsCocktailModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedCocktail?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedCocktail?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedCocktail?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                ) : (
                  inventory.filter(i => i.type === 'Cocktail').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedCocktail(item as any);
                        setIsCocktailModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedCocktail?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedCocktail?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedCocktail?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Ice Cream Selection Sub-Modal */}
      <AnimatePresence>
        {isIceCreamModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsIceCreamModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Ice Cream</h2>
                <button 
                  onClick={() => setIsIceCreamModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.filter(i => i.type === 'Ice Cream').length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No ice cream in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.filter(i => i.type === 'Ice Cream').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedIceCream(item);
                        setIsIceCreamModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedIceCream?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedIceCream?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedIceCream?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Teas Selection Sub-Modal */}
      <AnimatePresence>
        {isTeasModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTeasModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Tea</h2>
                <button 
                  onClick={() => setIsTeasModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.filter(i => i.type === 'Teas').length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No teas in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.filter(i => i.type === 'Teas').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedTea(item);
                        setIsTeasModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedTea?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedTea?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedTea?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cakes Selection Sub-Modal */}
      <AnimatePresence>
        {isCakesModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCakesModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Cake</h2>
                <button 
                  onClick={() => setIsCakesModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.filter(i => i.type === 'Cakes').length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No cakes in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.filter(i => i.type === 'Cakes').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedCake(item);
                        setIsCakesModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedCake?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedCake?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedCake?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Others Selection Sub-Modal */}
      <AnimatePresence>
        {isOthersModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOthersModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-6 bg-white rounded-[40px] z-[70] p-8 overflow-hidden flex flex-col max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Select Item</h2>
                <button 
                  onClick={() => setIsOthersModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {inventory.filter(i => i.type === 'Others').length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-black/40 italic">No items in inventory.</p>
                    <Link to="/inventory" className="text-sm font-bold text-black underline mt-2 inline-block">Go to Inventory</Link>
                  </div>
                ) : (
                  inventory.filter(i => i.type === 'Others').map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedOther(item);
                        setIsOthersModalOpen(false);
                      }}
                      className={`w-full p-6 rounded-3xl border text-left transition-all flex items-center justify-between ${
                        selectedOther?.id === item.id 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black/5 hover:border-black/20'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className={`text-xs ${selectedOther?.id === item.id ? 'text-white/60' : 'text-black/40'}`}>
                          GHS {item.price.toFixed(2)} • {item.quantity} in stock
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedOther?.id === item.id ? 'text-white/40' : 'text-black/10'}`} />
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
