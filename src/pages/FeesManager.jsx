import React, { useState, useEffect } from 'react';
import { getStudents, getMonthlyFees, logFeePayment } from '../lib/db';
import { IndianRupee, RefreshCw, AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function FeesManager() {
  const [students, setStudents] = useState([]);
  const [feesList, setFeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showPopup, setShowPopup] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Compute current month (e.g. "June 2026")
  const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [allStudents, allFees] = await Promise.all([
        getStudents(),
        getMonthlyFees(currentMonthStr)
      ]);

      setStudents(allStudents);
      setFeesList(allFees);
    } catch (err) {
      setError("Failed to load fees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPopup = (student) => {
    setSelectedStudent(student);
    setAmountPaid(student.fee_amount || '');
    setShowPopup(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    const paid = parseFloat(amountPaid);
    if (isNaN(paid) || paid < 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const feeRate = selectedStudent.fee_amount || 0;
      // Status is 'paid' if paid >= due, otherwise 'unpaid' / 'partial'
      // But let's simplify: if paid >= feeRate, it is 'paid', else 'partial' (which counts as unpaid/red in this simple view)
      const status = paid >= feeRate ? 'paid' : 'partial';

      await logFeePayment({
        student_id: selectedStudent.id,
        month: currentMonthStr,
        amount_due: feeRate,
        amount_paid: paid,
        paid_on: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        status: status
      });

      // Reload
      const updatedFees = await getMonthlyFees(currentMonthStr);
      setFeesList(updatedFees);
      
      setShowPopup(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError("Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading fees...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto flex flex-col justify-between overflow-hidden select-none">
      
      {/* Main Content (Fits in height, no scrolling) */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 rounded-2xl shadow-sm text-center shrink-0 mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEES MANAGEMENT</p>
          <h2 className="text-sm font-extrabold text-slate-800 mt-1">
            Status for {currentMonthStr}
          </h2>
        </div>

        {success && (
          <div className="mb-2 bg-green-50 text-green-700 text-xs font-semibold p-2.5 rounded-xl border border-green-100 flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            Payment recorded successfully!
          </div>
        )}

        {error && (
          <div className="mb-2 bg-red-50 text-red-600 text-xs font-semibold p-2.5 rounded-xl border border-red-100 flex items-center gap-1.5 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        {/* Compact Grid of Student Badges (2-column layout to fit on screen without scrolling) */}
        {students.length === 0 ? (
          <div className="bg-white border border-slate-100 p-6 rounded-2xl text-center shadow-sm my-auto shrink-0">
            <p className="text-slate-400 italic text-sm">No students enrolled yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 my-auto max-h-[460px] overflow-hidden py-2 shrink-0">
            {students.map((student) => {
              const fee = feesList.find(f => f.student_id === student.id);
              const isPaid = fee?.status === 'paid';
              
              return (
                <button
                  key={student.id}
                  onClick={() => !isPaid && handleOpenPopup(student)}
                  disabled={isPaid}
                  className={`p-3 rounded-xl border flex flex-col justify-center items-center text-center transition-all duration-200 active:scale-95 ${
                    isPaid
                      ? 'bg-green-500 text-white border-green-600 shadow-sm shadow-green-100 cursor-default'
                      : 'bg-white text-slate-700 border-red-200 hover:border-red-400 cursor-pointer shadow-sm hover:bg-red-50/20'
                  }`}
                >
                  <span className="font-extrabold text-[11px] truncate max-w-[140px] leading-tight">
                    {student.name}
                  </span>
                  
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${isPaid ? 'text-green-100' : 'text-red-500 font-extrabold'}`}>
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className={`text-[9px] ${isPaid ? 'opacity-85' : 'text-slate-400'}`}>
                      • ₹{student.fee_amount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pop-up modal for payment entry */}
      {showPopup && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-scale-up border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 px-4 py-3 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Record Fee Payment</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedStudent.name}</p>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-4 flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Amount Paid (₹)
                </label>
                <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 bg-white focus-within:border-indigo-500 transition-all">
                  <span className="bg-slate-50 text-slate-500 text-xs font-semibold flex items-center px-3 border-r border-slate-200">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                    autoFocus
                    placeholder={selectedStudent.fee_amount}
                    className="w-full bg-white rounded-r-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs active:scale-95"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Payment</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer Helper */}
      <div className="text-center pb-20 shrink-0">
        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">
          Tap unpaid student to clear dues
        </span>
      </div>
    </div>
  );
}
