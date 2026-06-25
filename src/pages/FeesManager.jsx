import React, { useState, useEffect } from 'react';
import { getStudents, getMonthlyFees, logFeePayment } from '../lib/db';
import { supabase } from '../lib/supabase';
import { IndianRupee, RefreshCw, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function FeesManager() {
  const [students, setStudents] = useState([]);
  const [feesList, setFeesList] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal states for logging payment
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount_due: '',
    amount_paid: '',
    paid_on: new Date().toISOString().split('T')[0],
    status: 'unpaid'
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Format month name (e.g. "June 2026")
  const getMonthString = (date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const loadFeeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const monthStr = getMonthString(currentDate);
      
      const [allStudents, allFees] = await Promise.all([
        getStudents(),
        getMonthlyFees(monthStr)
      ]);

      // Auto-create fee records for students missing them for this month
      const missingPayloads = [];
      allStudents.forEach(student => {
        const hasFee = allFees.some(f => f.student_id === student.id);
        if (!hasFee) {
          missingPayloads.push({
            student_id: student.id,
            month: monthStr,
            amount_due: student.fee_amount || 0,
            amount_paid: 0,
            status: 'unpaid'
          });
        }
      });

      let finalFees = allFees;
      if (missingPayloads.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('fees')
          .insert(missingPayloads)
          .select();
        
        if (insertErr) {
          console.error("Error auto-creating fee records:", insertErr);
        } else if (inserted) {
          finalFees = [...allFees, ...inserted];
        }
      }

      setStudents(allStudents);
      setFeesList(finalFees);
    } catch (err) {
      console.error("Error loading fees:", err);
      setError("Failed to load fee information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeeData();
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const openLogModal = (student) => {
    const existingFee = feesList.find(f => f.student_id === student.id);
    setSelectedStudent(student);
    setPaymentForm({
      amount_due: existingFee ? existingFee.amount_due : student.fee_amount,
      amount_paid: existingFee ? existingFee.amount_paid : student.fee_amount,
      paid_on: existingFee && existingFee.paid_on ? existingFee.paid_on : new Date().toISOString().split('T')[0],
      status: existingFee ? existingFee.status : 'paid'
    });
    setShowLogModal(true);
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto status calculation if modifying paid amount
      if (name === 'amount_paid' || name === 'amount_due') {
        const paid = parseFloat(updated.amount_paid) || 0;
        const due = parseFloat(updated.amount_due) || 0;
        
        if (paid >= due) {
          updated.status = 'paid';
        } else if (paid > 0) {
          updated.status = 'partial';
        } else {
          updated.status = 'unpaid';
        }
      }
      return updated;
    });
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        student_id: selectedStudent.id,
        month: getMonthString(currentDate),
        amount_due: parseFloat(paymentForm.amount_due) || 0,
        amount_paid: parseFloat(paymentForm.amount_paid) || 0,
        paid_on: paymentForm.status === 'unpaid' ? null : paymentForm.paid_on,
        status: paymentForm.status
      };

      await logFeePayment(payload);
      
      // Refresh fee logs list
      const refreshedFees = await getMonthlyFees(getMonthString(currentDate));
      setFeesList(refreshedFees);
      
      setShowLogModal(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving payment:", err);
      setError("Failed to save payment log.");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations for summary metrics
  const getSummaryMetrics = () => {
    let totalCollected = 0;
    let totalOutstanding = 0;
    
    students.forEach(student => {
      const fee = feesList.find(f => f.student_id === student.id);
      if (fee) {
        totalCollected += fee.amount_paid;
        totalOutstanding += Math.max(0, fee.amount_due - fee.amount_paid);
      } else {
        totalOutstanding += student.fee_amount || 0;
      }
    });

    return { totalCollected, totalOutstanding };
  };

  const { totalCollected, totalOutstanding } = getSummaryMetrics();

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading fees manager...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-800">Fees Manager</h1>
      </div>

      <div className="p-4">
        {success && (
          <div className="mb-4 bg-green-50 text-green-700 text-xs font-semibold p-3.5 rounded-xl border border-green-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            Fee payment logged successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        {/* Month Selector bar */}
        <div className="flex justify-between items-center bg-white border border-slate-150 p-3 rounded-2xl shadow-sm mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-slate-800 text-sm tracking-wide">
            {getMonthString(currentDate)}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Finance Summary Widget */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Collected</span>
            <p className="text-lg font-extrabold text-emerald-950 mt-0.5">₹{totalCollected}</p>
          </div>
          <div className="bg-red-50/40 border border-red-100 p-3.5 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Outstanding</span>
            <p className="text-lg font-extrabold text-red-950 mt-0.5">₹{totalOutstanding}</p>
          </div>
        </div>

        {/* Student Fee List */}
        <div>
          <h3 className="font-bold text-slate-700 text-sm mb-3 px-1">Payment Status List</h3>
          
          <div className="flex flex-col gap-3">
            {students.map((student) => {
              const fee = feesList.find(f => f.student_id === student.id);
              const status = fee ? fee.status : 'unpaid';
              const isOverdue = status === 'unpaid' || status === 'partial';
              const amountPaid = fee ? fee.amount_paid : 0;
              const amountDue = fee ? fee.amount_due : student.fee_amount;

              return (
                <div
                  key={student.id}
                  onClick={() => openLogModal(student)}
                  className={`bg-white border p-4 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex justify-between items-center active:scale-[0.99] ${
                    isOverdue ? 'border-red-100 hover:border-red-200' : 'border-slate-100 hover:border-indigo-100'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm truncate ${isOverdue ? 'text-red-700' : 'text-slate-800'}`}>
                        {student.name}
                      </p>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded">
                        {student.standard}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-500 mt-1">
                      Paid: <span className="font-semibold text-slate-700">₹{amountPaid}</span> / Due: <span className="font-semibold text-slate-700">₹{amountDue}</span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : status === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                    }`}>
                      {status}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold">Tap to log</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LOG PAYMENT MODAL BOTTOM SHEET */}
        {showLogModal && selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-slide-up pb-safe">
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-slate-100 px-5 py-4 bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Log Fee Payment</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{selectedStudent.name} ({getMonthString(currentDate)})</p>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSavePayment} className="p-5 flex flex-col gap-4">
                {/* Amount Due Rate */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-semibold">Standard Tuition Rate:</span>
                  <span className="font-extrabold text-slate-700 text-sm">₹{selectedStudent.fee_amount}/month</span>
                </div>

                {/* Amount Due Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Amount Due for Month (₹)
                  </label>
                  <input
                    type="number"
                    name="amount_due"
                    value={paymentForm.amount_due}
                    onChange={handlePaymentChange}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>

                {/* Amount Paid Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    name="amount_paid"
                    value={paymentForm.amount_paid}
                    onChange={handlePaymentChange}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>

                {/* Payment Date */}
                {paymentForm.status !== 'unpaid' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      name="paid_on"
                      value={paymentForm.paid_on}
                      onChange={handlePaymentChange}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                    />
                  </div>
                )}

                {/* Calculated Status Badge */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400 font-semibold">Calculated Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    paymentForm.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : paymentForm.status === 'partial'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-600'
                  }`}>
                    {paymentForm.status}
                  </span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Save Payment Log</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
