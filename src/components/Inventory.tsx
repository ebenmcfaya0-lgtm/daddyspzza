import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Package, Edit2, Save, X, Trash2, Search } from 'lucide-react';
import { InventoryItem } from '../types';

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // Form state
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryItems = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as any));
      setItems(inventoryItems);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const itemData = {
      name,
      price: Number(price),
      quantity: Number(quantity)
    };

    try {
      if (editingItem && editingItem.id) {
        const itemRef = doc(db, 'inventory', editingItem.id.toString());
        await setDoc(itemRef, itemData, { merge: true });
      } else {
        await addDoc(collection(db, 'inventory'), itemData);
      }
      setIsFormOpen(false);
      setEditingItem(null);
      setName('');
      setPrice('');
      setQuantity('');
    } catch (error) {
      console.error('Failed to save inventory item:', error);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setPrice(item.price.toString());
    setQuantity(item.quantity.toString());
    setIsFormOpen(true);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Drink Inventory</h2>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input 
              type="text"
              placeholder="Search drinks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-black/5 rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-black transition-all"
            />
          </div>
          <button 
            onClick={() => {
              setEditingItem(null);
              setName('');
              setPrice('');
              setQuantity('');
              setIsFormOpen(true);
            }}
            className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-black/5 text-center">
            <p className="text-black/40 text-sm italic">No items in inventory.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 border border-black/5 flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm">{item.name}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-black/40 font-medium">GHS {item.price.toFixed(2)}</p>
                    <span className="w-1 h-1 bg-black/10 rounded-full" />
                    <p className={`text-xs font-bold ${item.quantity < 5 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {item.quantity} in stock
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => startEdit(item)}
                className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-black/40 hover:bg-black hover:text-white transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
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
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] z-50 p-8 max-w-md mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {editingItem ? 'Edit Item' : 'Add New Drink'}
                </h2>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Drink Name</label>
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Coca Cola"
                    className="w-full bg-[#F5F5F5] border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-black transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Price (GHS)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#F5F5F5] border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-black transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 ml-1">Initial Stock</label>
                    <input 
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#F5F5F5] border-none rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-black transition-all"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-black text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10"
                >
                  <Save className="w-5 h-5" />
                  <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
