import React, { useState, useEffect } from 'react';
import { getStudents, logBehaviour, getBehaviourLogs } from '../lib/db';
import { RefreshCw, Smile, Frown, MessageSquare, AlertCircle } from 'lucide-react';

export default function BehaviourManager({ navigate }) {
  const [students, setStudents] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('8th-9th'); // '8th-9th' or '10th'
  const [groupStudents, setGroupStudents] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Local state to keep track of what was logged during this session
  // format: { [studentId]: 'good' | 'bad' | 'inform' }
  const [sessionLogs, setSessionLogs] = useState({});

  const getDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

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

  // Filter students based on standard group
  useEffect(() => {
    if (students.length === 0) return;
    
    const filtered = students.filter(student => {
      if (selectedGroup === '8th-9th') {
        return student.standard === '8th' || student.standard === '9th';
      } else {
        return student.standard === '10th';
      }
    });
    setGroupStudents(filtered);
  }, [selectedGroup, students]);

  const handleLog = async (student, type) => {
    try {
      // Optimistic update
      setSessionLogs(prev => ({
        ...prev,
        [student.id]: type
      }));

      await logBehaviour(student.id, type);

      if (type === 'inform') {
        // Open WhatsApp link to parent
        const phone = student.parent_phone;
        if (phone) {
          let cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
          }
          const message = `Hello, this is regarding ${student.name}'s behaviour in tuition class today. Please speak with them.`;
          const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
        } else {
          alert(`No parent phone number recorded for ${student.name}.`);
        }
      }
    } catch (err) {
      console.error("Error logging behaviour:", err);
      alert("Failed to log behaviour to database.");
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading students...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 flex justify-between items-center px-4 py-3 shrink-0">
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
            <h2 className="text-sm font-bold text-slate-800 mt-0.5">
              Student Behaviour Register
            </h2>
          </div>
        </div>

        {/* Group Filter */}
        <div className="w-full flex items-center bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs shrink-0 select-none">
          <span className="text-slate-500 font-bold uppercase tracking-wider mr-3">Class Group:</span>
          <div className="flex-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup('8th-9th')}
              className={`px-3 py-1.5 border transition-all text-xs font-bold ${
                selectedGroup === '8th-9th'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-extrabold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              8th/9th Std
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('10th')}
              className={`px-3 py-1.5 border transition-all text-xs font-bold ${
                selectedGroup === '10th'
                  ? 'bg-indigo-600 text-white border-indigo-700 font-extrabold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              10th Std
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 my-2 bg-red-50 text-red-600 text-xs font-semibold p-2 rounded border border-red-100 text-center shrink-0">
            {error}
          </div>
        )}

        {/* Student Behaviour List */}
        <div className="flex-1 overflow-y-auto">
          {/* Headers row */}
          <div className="w-full flex items-stretch border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
            <div className="flex-1 px-3 py-1.5 flex items-center">Name</div>
            <div className="w-16 px-2 py-1.5 border-l border-slate-250 flex items-center justify-center">Class</div>
            <div className="w-36 border-l border-slate-250 flex items-center justify-center">Action</div>
          </div>

          {groupStudents.map((student) => {
            const activeStatus = sessionLogs[student.id];
            
            return (
              <div 
                key={student.id} 
                className="w-full flex items-stretch border-b border-slate-200 text-sm select-none"
              >
                {/* Name */}
                <div className="flex-1 px-3 py-2 flex items-center truncate text-slate-800 font-medium text-xs">
                  {student.name}
                </div>

                {/* Class */}
                <div className="w-16 border-l border-slate-200 flex items-center justify-center text-xs text-slate-500">
                  {student.standard}
                </div>
                
                {/* Action Buttons: Good, Bad, Inform Parent */}
                <div className="w-36 border-l border-slate-200 flex items-stretch shrink-0">
                  {/* Good Button */}
                  <button
                    type="button"
                    onClick={() => handleLog(student, 'good')}
                    className={`flex-1 py-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      activeStatus === 'good'
                        ? 'bg-green-600 text-white font-extrabold'
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                    title="Log Good Behavior"
                  >
                    G
                  </button>
                  {/* Bad Button */}
                  <button
                    type="button"
                    onClick={() => handleLog(student, 'bad')}
                    className={`flex-1 py-2 border-l border-slate-200 flex items-center justify-center text-xs font-bold transition-colors ${
                      activeStatus === 'bad'
                        ? 'bg-red-600 text-white font-extrabold'
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                    title="Log Bad Behavior"
                  >
                    B
                  </button>
                  {/* Inform Parent Button */}
                  <button
                    type="button"
                    onClick={() => handleLog(student, 'inform')}
                    className={`flex-1 py-2 border-l border-slate-200 flex items-center justify-center text-xs font-bold transition-colors ${
                      activeStatus === 'inform'
                        ? 'bg-amber-500 text-white font-extrabold'
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                    title="Inform Parent"
                  >
                    I
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
