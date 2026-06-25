import React, { useState, useEffect } from 'react';
import { getStudents, logBehaviour } from '../lib/db';
import { RefreshCw, Smile, Frown, MessageSquare, ArrowLeft } from 'lucide-react';

export default function BehaviourManager({ navigate }) {
  const [step, setStep] = useState('options'); // 'options' | 'log-detail'
  const [selectedType, setSelectedType] = useState(''); // 'good' | 'bad' | 'inform'
  
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [description, setDescription] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allStudents = await getStudents();
        setStudents(allStudents);
      } catch (err) {
        console.error("Error loading students for behaviour:", err);
        setError("Failed to load students list.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleOptionSelect = (type) => {
    setSelectedType(type);
    setSelectedStudentId('');
    setDescription('');
    setStep('log-detail');
  };

  const getStudentName = () => {
    const s = students.find(x => x.id === selectedStudentId);
    return s ? s.name : "[Student Name]";
  };

  // Generate the formatted message based on type
  const formatMessage = () => {
    const name = getStudentName();
    const desc = description.trim() || "[what they did]";
    
    if (selectedType === 'good') {
      return `Dear parent, I am happy to share that your child ${name} did exceptionally well in class today: ${desc}.`;
    } else if (selectedType === 'bad') {
      return `Dear parent, this is to bring to your notice that your child ${name} was ${desc} during class today.`;
    } else if (selectedType === 'inform') {
      return `Dear parent, this is to inform you that your child ${name} was ${desc} during class today. Please speak with them regarding this.`;
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Please select a student.");
      return;
    }
    if (!description.trim()) {
      alert("Please describe what they did.");
      return;
    }

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    try {
      setSaving(true);
      
      // 1. Save behavior to DB
      await logBehaviour(student.id, selectedType, description.trim());

      // 2. If Inform Parent, launch WhatsApp
      if (selectedType === 'inform') {
        const messageText = formatMessage();
        const phone = student.parent_phone;
        
        if (phone) {
          let cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
          }
          const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
          window.open(url, '_blank');
        } else {
          alert(`Logged behaviour, but no parent phone number was found for ${student.name}.`);
        }
      } else {
        alert("Behaviour logged successfully!");
      }

      // Go back to entry cards screen
      setStep('options');
    } catch (err) {
      console.error("Error logging behaviour:", err);
      alert("Failed to save behaviour entry.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading behaviour tools...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
      
      {/* 1. OPTIONS CARDS VIEW (Fills the page, 3 options) */}
      {step === 'options' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
            <h2 className="text-sm font-bold text-slate-800 mt-0.5">Student Behaviour</h2>
          </div>

          {/* Cards List */}
          <div className="flex-1 flex flex-col p-4 gap-4 bg-slate-50 overflow-y-auto">
            {/* Good behavior card */}
            <button
              onClick={() => handleOptionSelect('good')}
              className="flex-1 bg-gradient-to-r from-emerald-50 to-green-50/30 border border-green-200 rounded-2xl p-6 transition active:scale-[0.98] flex flex-col justify-center items-start text-left shadow-sm group hover:border-green-400"
            >
              <Smile className="w-10 h-10 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-green-950">Good Behavior</h3>
              <p className="text-xs text-green-700 font-medium mt-1">Log exceptional performance, helpfulness, or focus in class.</p>
            </button>

            {/* Bad behavior card */}
            <button
              onClick={() => handleOptionSelect('bad')}
              className="flex-1 bg-gradient-to-r from-rose-50 to-red-50/30 border border-red-200 rounded-2xl p-6 transition active:scale-[0.98] flex flex-col justify-center items-start text-left shadow-sm group hover:border-red-400"
            >
              <Frown className="w-10 h-10 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-red-950">Bad Behavior</h3>
              <p className="text-xs text-red-700 font-medium mt-1">Log disruptions, lack of homework, or poor focus in class.</p>
            </button>

            {/* Inform Parent card */}
            <button
              onClick={() => handleOptionSelect('inform')}
              className="flex-1 bg-gradient-to-r from-indigo-50 to-blue-50/30 border border-indigo-200 rounded-2xl p-6 transition active:scale-[0.98] flex flex-col justify-center items-start text-left shadow-sm group hover:border-indigo-400"
            >
              <MessageSquare className="w-10 h-10 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold text-indigo-950">Inform Parent</h3>
              <p className="text-xs text-indigo-700 font-medium mt-1">Compose a complaint message and send it directly to their WhatsApp.</p>
            </button>
          </div>
        </div>
      )}

      {/* 2. LOG DETAIL VIEW ("What did they do?" page) */}
      {step === 'log-detail' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 flex items-center gap-3 px-4 py-3 shrink-0">
            <button 
              onClick={() => setStep('options')}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {selectedType === 'good' ? 'Polite Feedback' : selectedType === 'bad' ? 'Corrective Log' : 'Complain to Parent'}
              </h1>
              <p className="text-sm font-bold text-slate-800">
                What did they do?
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Student Dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Student
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                >
                  <option value="">-- Choose student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.standard})</option>
                  ))}
                </select>
              </div>

              {/* Behavior Description Textarea */}
              <div className="flex-1 flex flex-col min-h-[140px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 shrink-0">
                  Describe what they did
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    selectedType === 'good' 
                      ? "e.g. helped a peer understand a complex maths logic" 
                      : selectedType === 'bad' 
                      ? "e.g. failed to submit homework and was talking in class"
                      : "e.g. was talking constantly and distracting others today"
                  }
                  className="w-full flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm resize-none"
                />
              </div>

              {/* Live Preview of Note / Message */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-1 shrink-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Message / Log Preview</p>
                <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                  "{formatMessage()}"
                </p>
              </div>
            </div>

            {/* Pinned submit button */}
            <button
              type="submit"
              disabled={saving}
              className={`w-full text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider ${
                selectedType === 'good' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : selectedType === 'bad' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{selectedType === 'inform' ? 'Send WhatsApp Alert' : 'Log Behavior'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
