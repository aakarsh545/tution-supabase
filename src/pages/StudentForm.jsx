import React, { useState, useEffect } from 'react';
import { addStudent, getStudentById, updateStudent, deleteStudent } from '../lib/db';
import { ArrowLeft, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

const PRESET_SUBJECTS = ['Mathematics', 'Science', 'Social Studies', 'English', 'Kannada', 'Hindi'];

export default function StudentForm({ params, navigate }) {
  const studentId = params?.id;
  const isEditMode = !!studentId;

  const [formData, setFormData] = useState({
    name: '',
    standard: '10th',
    subjects: [],
    customSubject: '',
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
            subjects: data.subjects || [],
            customSubject: '',
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

  const handleSubjectToggle = (subj) => {
    setFormData(prev => {
      const subjects = [...prev.subjects];
      const index = subjects.indexOf(subj);
      if (index > -1) {
        subjects.splice(index, 1);
      } else {
        subjects.push(subj);
      }
      return { ...prev, subjects };
    });
  };

  const handleAddCustomSubject = (e) => {
    e.preventDefault();
    const cleanSubj = formData.customSubject.trim();
    if (cleanSubj && !formData.subjects.includes(cleanSubj)) {
      setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, cleanSubj],
        customSubject: ''
      }));
    }
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
        subjects: formData.subjects,
        parent_name: formData.parent_name.trim(),
        parent_phone: formData.parent_phone.trim(),
        fee_amount: parseFloat(formData.fee_amount) || 0,
      };

      if (isEditMode) {
        await updateStudent(studentId, payload);
      } else {
        await addStudent(payload);
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

            {/* Subjects Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                Attending Subjects
              </label>
              
              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {PRESET_SUBJECTS.map((subj) => {
                  const isSelected = formData.subjects.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleSubjectToggle(subj)}
                      className={`text-left text-xs font-semibold py-2.5 px-3 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{subj}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 ml-1.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Subject Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  name="customSubject"
                  value={formData.customSubject}
                  onChange={handleChange}
                  placeholder="Or type custom subject..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSubject}
                  className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold px-4 py-2 rounded-xl transition border border-indigo-200 shadow-sm"
                >
                  Add
                </button>
              </div>

              {/* Selected subjects tags */}
              {formData.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {formData.subjects.map((sub, i) => (
                    <span 
                      key={i} 
                      onClick={() => handleSubjectToggle(sub)}
                      className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-red-500 transition-all flex items-center gap-1.5"
                    >
                      {sub} <span className="text-[9px] opacity-70">×</span>
                    </span>
                  ))}
                </div>
              )}
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
