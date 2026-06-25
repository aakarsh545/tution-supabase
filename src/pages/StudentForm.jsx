import React, { useState, useEffect } from 'react';
import { addStudent, getStudentById, updateStudent, deleteStudent } from '../lib/db';
import { supabase } from '../lib/supabase';
import { ArrowLeft, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';



export default function StudentForm({ params, navigate }) {
  const studentId = params?.id;
  const isEditMode = !!studentId;

  const [formData, setFormData] = useState({
    name: '',
    standard: '10th',
    parent_name: '',
    parent_phone: '',
    fee_amount: '',
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEditMode) {
      const loadStudent = async () => {
        try {
          setFetching(true);
          const data = await getStudentById(studentId);
          setFormData({
            name: data.name || '',
            standard: data.standard || '10th',
            parent_name: data.parent_name || '',
            parent_phone: data.parent_phone || '',
            fee_amount: data.fee_amount || '',
          });
        } catch (err) {
          console.error("Error loading student:", err);
          setError("Failed to fetch student details.");
        } finally {
          setFetching(false);
        }
      };
      loadStudent();
    }
  }, [studentId, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Student Name is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Clean monthly fee to number
      const payload = {
        name: formData.name.trim(),
        standard: formData.standard,
        parent_name: formData.parent_name.trim(),
        parent_phone: formData.parent_phone.trim(),
        fee_amount: parseFloat(formData.fee_amount) || 0,
      };

      if (isEditMode) {
        await updateStudent(studentId, payload);
      } else {
        const newStudent = await addStudent(payload);
        const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const { error: feeErr } = await supabase
          .from('fees')
          .insert([{
            student_id: newStudent.id,
            month: currentMonthStr,
            amount_due: payload.fee_amount,
            amount_paid: 0,
            status: 'unpaid'
          }]);
        if (feeErr) console.error("Error creating auto fee record for new student:", feeErr);
      }

      // Navigate back to student list / profile
      if (isEditMode) {
        navigate('student-profile', { id: studentId });
      } else {
        navigate('students');
      }
    } catch (err) {
      console.error("Error saving student:", err);
      setError("Failed to save student profile. Please verify your fields.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${formData.name}? This will delete all their records (attendance, tests, fees, notes) permanently.`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteStudent(studentId);
      navigate('students');
    } catch (err) {
      console.error("Error deleting student:", err);
      setError("Failed to delete student.");
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => isEditMode ? navigate('student-profile', { id: studentId }) : navigate('students')}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditMode ? 'Edit Profile' : 'Add Student'}
          </h1>
        </div>
        {isEditMode && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition"
            title="Delete Student"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Form Card */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-600 rounded-full shrink-0"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Student Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Student Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Rahul Shenoy"
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {/* Standard / Class Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Standard / Class
              </label>
              <select
                name="standard"
                value={formData.standard}
                onChange={handleChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
              >
                {['8th', '9th', '10th', '11th', '12th', 'Other'].map(std => (
                  <option key={std} value={std}>{std}</option>
                ))}
              </select>
            </div>



            {/* Parent Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Parent / Guardian Name
              </label>
              <input
                type="text"
                name="parent_name"
                value={formData.parent_name}
                onChange={handleChange}
                placeholder="e.g. Kishore Shenoy"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>

            {/* Parent Phone / WhatsApp */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Parent WhatsApp Phone (with Country Code)
              </label>
              <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 bg-white focus-within:border-indigo-500 transition-all">
                <span className="bg-slate-50 text-slate-500 text-sm font-semibold flex items-center px-3 border-r border-slate-200">
                  +91
                </span>
                <input
                  type="tel"
                  name="parent_phone"
                  value={formData.parent_phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  className="w-full bg-white rounded-r-xl px-4 py-3 text-sm focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Provide 10-digit number. Messages will deep-link via WhatsApp.</p>
            </div>

            {/* Monthly Fee Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Monthly Fee Amount (₹)
              </label>
              <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 bg-white focus-within:border-indigo-500 transition-all">
                <span className="bg-slate-50 text-slate-500 text-sm font-semibold flex items-center px-3 border-r border-slate-200">
                  ₹
                </span>
                <input
                  type="number"
                  name="fee_amount"
                  value={formData.fee_amount}
                  onChange={handleChange}
                  placeholder="e.g. 1500"
                  className="w-full bg-white rounded-r-xl px-4 py-3 text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{isEditMode ? 'Save Changes' : 'Enroll Student'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
