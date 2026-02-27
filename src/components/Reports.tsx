import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Download, FileText, PieChart as PieIcon, BarChart3, TrendingUp, RefreshCw, AlertTriangle, User, Users } from 'lucide-react';
import { ItemIcon } from './Dashboard';

interface ReportData {
  hourlySales: { hour: string; total: number }[];
  waiterSales: { waiter: string; total: number; count: number }[];
  categorySales: { category: string; total: number; count: number }[];
  paymentStatus: { status: string; total: number }[];
  tagBreakdown: { tag: string; total: number }[];
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

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
        if (!waiterMap[s.waiter]) waiterMap[s.waiter] = { waiter: s.waiter, total: 0, count: 0 };
        waiterMap[s.waiter].total += s.price;
        waiterMap[s.waiter].count += 1;
      });
      const waiterSales = Object.values(waiterMap) as any[];

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
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Drink', 'Cocktail', 'Ice Cream'].map((type) => {
          const catData = data?.categorySales.find(s => s.category === type);
          return (
            <motion.div 
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] p-6 border border-black/5 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <ItemIcon type={type} className="w-5 h-5 text-black/60" />
                </div>
                <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">{type}</span>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  GHS {catData?.total.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider mt-1">
                  {catData?.count || 0} items sold
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Hourly Sales - Line Chart */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-black/40 leading-none mb-1">Sales Trend</h3>
            <p className="text-xs font-medium">Last 24 Hours</p>
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.hourlySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="hour" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#999' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#999' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category Breakdown - Pie Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <PieIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-black/40 leading-none mb-1">Category Breakdown</h3>
              <p className="text-xs font-medium">Sales by Item Type</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.categorySales}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="category"
                >
                  {data?.categorySales.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Waiter Performance - Bar Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-black/40 leading-none mb-1">Waiter Performance</h3>
              <p className="text-xs font-medium">Total Revenue per Waiter</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.waiterSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="waiter" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#999' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#999' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Payment Status - Pie Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
              <PieIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-black/40 leading-none mb-1">Collection Status</h3>
              <p className="text-xs font-medium">Paid vs Unpaid Revenue</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.paymentStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="status"
                >
                  {data?.paymentStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.status === 'Paid' ? '#10b981' : '#f59e0b'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Tag Breakdown - Pie Chart */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-black/40 leading-none mb-1">Consumption Tag</h3>
              <p className="text-xs font-medium">Internal vs Customer Sales</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.tagBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="tag"
                >
                  {data?.tagBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      {/* Detailed Waitress Table */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-black/40">Waitress Performance Table</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/5">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">Waitress</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">Orders</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data?.waiterSales.map((w) => (
                <tr key={w.waiter} className="hover:bg-black/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold">
                        {w.waiter.charAt(0)}
                      </div>
                      <span className="font-bold text-sm">{w.waiter}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-black/60">{w.count} items</td>
                  <td className="px-6 py-4 text-sm font-bold text-right">GHS {w.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

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
            <p className="text-white/60 text-sm mb-6 max-w-[240px]">Download all transactions in CSV format for detailed accounting and bookkeeping.</p>
            <button 
              onClick={exportToCSV}
              className="bg-white text-black px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Download Full CSV</span>
            </button>
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
