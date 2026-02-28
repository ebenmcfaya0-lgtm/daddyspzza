import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Download, FileText, TrendingUp, 
  RefreshCw, AlertTriangle, User, Users, ChevronDown, ChevronRight,
  Clock, Tag, CreditCard, FileDown
} from 'lucide-react';
import { ItemIcon, ITEM_TYPES } from './Dashboard';
import { Sale } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  hourlySales: { hour: string; total: number }[];
  waiterSales: { 
    waiter: string; 
    total: number; 
    count: number;
    sales: Sale[];
  }[];
  categorySales: { category: string; total: number; count: number }[];
  itemSales: {
    name: string;
    type: string;
    total: number;
    count: number;
    sales: Sale[];
  }[];
  paymentStatus: { status: string; total: number }[];
  tagBreakdown: { tag: string; total: number }[];
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'waiters' | 'items'>('waiters');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReportData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'sales'), 
        where('timestamp', '>=', today),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const sales = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as any));

      // Process Hourly Sales
      const hourlyMap: any = {};
      sales.forEach(s => {
        const hour = s.timestamp.getHours() + ':00';
        hourlyMap[hour] = (hourlyMap[hour] || 0) + s.price;
      });
      const hourlySales = Object.entries(hourlyMap).map(([hour, total]) => ({ hour, total: total as number }));

      // Process Waiter Sales
      const waiterMap: any = {};
      sales.forEach(s => {
        if (!waiterMap[s.waiter]) waiterMap[s.waiter] = { waiter: s.waiter, total: 0, count: 0, sales: [] };
        waiterMap[s.waiter].total += s.price;
        waiterMap[s.waiter].count += 1;
        waiterMap[s.waiter].sales.push(s);
      });
      const waiterSales = Object.values(waiterMap) as any[];

      // Process Item Sales
      const itemMap: any = {};
      sales.forEach(s => {
        const key = `${s.item_type}-${s.item_name || 'Generic'}`;
        if (!itemMap[key]) itemMap[key] = { 
          name: s.item_name || s.item_type, 
          type: s.item_type,
          total: 0, 
          count: 0, 
          sales: [] 
        };
        itemMap[key].total += s.price;
        itemMap[key].count += (s.quantity || 1);
        itemMap[key].sales.push(s);
      });
      const itemSales = Object.values(itemMap) as any[];

      // Process Category Sales
      const categoryMap: any = {};
      sales.forEach(s => {
        const cat = s.item_type;
        if (!categoryMap[cat]) categoryMap[cat] = { category: cat, total: 0, count: 0 };
        categoryMap[cat].total += s.price;
        categoryMap[cat].count += 1;
      });
      const categorySales = Object.values(categoryMap) as any[];

      // Process Payment Status
      const paidTotal = sales.reduce((acc, s) => acc + (s.is_paid ? s.price : 0), 0);
      const unpaidTotal = sales.reduce((acc, s) => acc + (s.is_paid ? 0 : s.price), 0);
      const paymentStatus = [
        { status: 'Paid', total: paidTotal },
        { status: 'Unpaid', total: unpaidTotal }
      ];

      // Process Tag Breakdown
      const tagMap: any = {};
      sales.forEach(s => {
        const tag = s.tag || 'Customer';
        tagMap[tag] = (tagMap[tag] || 0) + s.price;
      });
      const tagBreakdown = Object.entries(tagMap).map(([tag, total]) => ({ tag, total: total as number }));

      setData({
        hourlySales,
        waiterSales,
        categorySales,
        itemSales,
        paymentStatus,
        tagBreakdown
      });
    } catch (error) {
      console.error('Failed to fetch report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleReset = async () => {
    try {
      const batch = writeBatch(db);
      
      // Delete all sales
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      salesSnapshot.forEach(d => batch.delete(d.ref));

      // Reset inventory quantities
      const invSnapshot = await getDocs(collection(db, 'inventory'));
      invSnapshot.forEach(d => batch.update(d.ref, { quantity: 0 }));

      await batch.commit();
      
      setIsResetModalOpen(false);
      fetchReportData();
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  const exportToPDF = async () => {
    if (!data) return;
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleString();
      const fileName = `grounds_manager_report_${new Date().toISOString().split('T')[0]}.pdf`;

      // Header
      doc.setFontSize(20);
      doc.text('Grounds Manager - Financial Report', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Export Date: ${dateStr}`, 14, 30);

      // 1. Waiter Breakdown
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Waiter Performance Breakdown', 14, 45);
      
      const waiterRows = data.waiterSales.map(w => [
        w.waiter,
        w.count.toString(),
        `GHS ${w.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['Waiter Name', 'Transactions', 'Total Revenue']],
        body: waiterRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });

      // 2. Category Breakdown
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Category Summary', 14, finalY);

      const categoryRows = data.categorySales.map(c => [
        c.category,
        c.count.toString(),
        `GHS ${c.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Category', 'Items Sold', 'Total Revenue']],
        body: categoryRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });

      // 3. Item Breakdown
      const itemY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Item Sales Breakdown', 14, itemY);

      const itemRows = data.itemSales
        .sort((a, b) => b.total - a.total)
        .map(i => [
          i.name,
          i.type,
          i.count.toString(),
          `GHS ${i.total.toFixed(2)}`
        ]);

      autoTable(doc, {
        startY: itemY + 5,
        head: [['Item Name', 'Category', 'Quantity Sold', 'Total Revenue']],
        body: itemRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });

      // Payment Summary
      const payY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Payment Summary', 14, payY);

      const payRows = data.paymentStatus.map(p => [
        p.status,
        `GHS ${p.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: payY + 5,
        head: [['Status', 'Total Amount']],
        body: payRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });

      doc.save(fileName);
    } catch (error) {
      console.error('PDF Export failed:', error);
    }
  };

  const exportToCSV = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'sales'));
      const sales = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as any));
      
      const headers = ['ID', 'Type', 'Item Name', 'Quantity', 'Price', 'Waiter', 'Status', 'Tag', 'Timestamp'];
      const rows = sales.map((s: any) => [
        s.id,
        s.item_type,
        s.item_name || 'N/A',
        s.quantity || 1,
        s.price.toFixed(2),
        s.waiter,
        s.is_paid ? 'Paid' : 'Unpaid',
        s.tag || 'Customer',
        s.timestamp.toLocaleString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((r: any) => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `grounds_manager_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-black/10 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Financial Reports</h2>
        <div className="flex gap-2">
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white border border-black/5 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-black/5 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ITEM_TYPES.map((type) => {
          const catData = data?.categorySales.find(s => s.category === type);
          return (
            <motion.div 
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] p-4 border border-black/5 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                  <ItemIcon type={type} className="w-4 h-4 text-black/60" />
                </div>
                <span className="text-[8px] font-bold text-black/20 uppercase tracking-widest">{type}</span>
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">
                  GHS {catData?.total.toLocaleString(undefined, { minimumFractionDigits: 0 }) || '0'}
                </p>
                <p className="text-[8px] font-bold text-black/40 uppercase tracking-wider mt-0.5">
                  {catData?.count || 0} sold
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detailed Breakdown Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/5 p-1 rounded-2xl">
            <button 
              onClick={() => { setActiveTab('waiters'); setExpandedId(null); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'waiters' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black/60'
              }`}
            >
              By Waitress
            </button>
            <button 
              onClick={() => { setActiveTab('items'); setExpandedId(null); }}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === 'items' ? 'bg-white text-black shadow-sm' : 'text-black/40 hover:text-black/60'
              }`}
            >
              By Item
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {activeTab === 'waiters' ? (
            data?.waiterSales.map((w) => (
              <div key={w.waiter} className="bg-white rounded-[24px] border border-black/5 overflow-hidden shadow-sm transition-all">
                <button 
                  onClick={() => setExpandedId(expandedId === w.waiter ? null : w.waiter)}
                  className="w-full p-5 flex items-center justify-between hover:bg-black/[0.01] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {w.waiter.charAt(0)}
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-base">{w.waiter}</h4>
                      <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{w.count} Transactions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-base">GHS {w.total.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Total Revenue</p>
                    </div>
                    {expandedId === w.waiter ? <ChevronDown className="w-5 h-5 text-black/20" /> : <ChevronRight className="w-5 h-5 text-black/20" />}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === w.waiter && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-black/5 bg-black/[0.01]"
                    >
                      <div className="p-4 space-y-2">
                        {w.sales.map((sale, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-black/5 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                              <ItemIcon type={sale.item_type} className="w-4 h-4 text-black/40" />
                              <div>
                                <p className="font-bold text-xs">{sale.item_name || sale.item_type} {sale.quantity && `(x${sale.quantity})`}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                                    sale.is_paid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    {sale.is_paid ? 'Paid' : 'Unpaid'}
                                  </span>
                                  {sale.tag && (
                                    <span className="text-[8px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-1">
                                      <Tag className="w-2 h-2" />
                                      {sale.tag}
                                    </span>
                                  )}
                                  <span className="text-[8px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-1">
                                    <Clock className="w-2 h-2" />
                                    {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="font-bold text-xs">GHS {sale.price.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          ) : (
            data?.itemSales.sort((a, b) => b.total - a.total).map((item) => (
              <div key={`${item.type}-${item.name}`} className="bg-white rounded-[24px] border border-black/5 overflow-hidden shadow-sm transition-all">
                <button 
                  onClick={() => setExpandedId(expandedId === `${item.type}-${item.name}` ? null : `${item.type}-${item.name}`)}
                  className="w-full p-5 flex items-center justify-between hover:bg-black/[0.01] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                      <ItemIcon type={item.type as any} className="w-6 h-6 text-black/60" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-base">{item.name}</h4>
                      <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{item.type} • {item.count} Sold</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-base">GHS {item.total.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Total Revenue</p>
                    </div>
                    {expandedId === `${item.type}-${item.name}` ? <ChevronDown className="w-5 h-5 text-black/20" /> : <ChevronRight className="w-5 h-5 text-black/20" />}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === `${item.type}-${item.name}` && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-black/5 bg-black/[0.01]"
                    >
                      <div className="p-4 space-y-2">
                        {item.sales.map((sale, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-black/5 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold">
                                {sale.waiter.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-xs">Served by {sale.waiter} {sale.quantity && `(x${sale.quantity})`}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                                    sale.is_paid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    {sale.is_paid ? 'Paid' : 'Unpaid'}
                                  </span>
                                  {sale.tag && (
                                    <span className="text-[8px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-1">
                                      <Tag className="w-2 h-2" />
                                      {sale.tag}
                                    </span>
                                  )}
                                  <span className="text-[8px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-1">
                                    <Clock className="w-2 h-2" />
                                    {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="font-bold text-xs">GHS {sale.price.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Export Summary Card */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-black text-white p-8 rounded-[32px] shadow-xl shadow-black/20 relative overflow-hidden"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">Need a full report?</h3>
            <p className="text-white/60 text-sm mb-6 max-w-[240px]">Download all transactions in PDF or CSV format for detailed accounting and bookkeeping.</p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={exportToPDF}
                className="bg-white text-black px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF Report</span>
              </button>
              <button 
                onClick={exportToCSV}
                className="bg-white/10 text-white border border-white/10 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-white/20 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>CSV Export</span>
              </button>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -left-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-red-50 border border-red-100 p-8 rounded-[32px] relative overflow-hidden"
        >
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-red-600 mb-2">Daily Reset</h3>
            <p className="text-red-600/60 text-sm mb-6 max-w-[240px]">Clear all sales history and reset inventory quantities for a new day of tracking.</p>
            <button 
              onClick={() => setIsResetModalOpen(true)}
              className="bg-red-500 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset for New Day</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetModalOpen(false)}
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
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Start New Day?</h3>
                  <p className="text-sm text-black/40 mt-1">This will permanently delete all sales and reset your inventory stock to zero. Make sure you've exported your report first!</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={handleReset}
                    className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors"
                  >
                    Yes, Reset Everything
                  </button>
                  <button 
                    onClick={() => setIsResetModalOpen(false)}
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
