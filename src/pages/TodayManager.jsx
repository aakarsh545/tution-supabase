import React, { useState, useEffect } from 'react';
import { getStudents, createSession, saveAttendance } from '../lib/db';
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';

export default function TodayManager({ navigate }) {
  const [step, setStep] = useState('attendance'); // 'attendance' | 'success'
  const [students, setStudents] = useState([]);
  const [attendanceState, setAttendanceState] = useState({}); // { studentId: 'present' | 'absent' }
  const [selectedSubject, setSelectedSubject] = useState('');
  const [absentsList, setAbsentsList] = useState([]);
  const [hasNotified, setHasNotified] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allStudents = await getStudents();
        setStudents(allStudents);
        
        // Default everyone to present
        const initialAttendance = {};
        allStudents.forEach(s => {
          initialAttendance[s.id] = 'present';
        });
        setAttendanceState(initialAttendance);
      } catch (err) {
        console.error("Error loading students:", err);
        setError("Failed to load students list.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDone = async () => {
    if (!selectedSubject) {
      alert("Please select a subject first.");
      return;
    }
    
    try {
      setSaving(true);
      setError(null);

      // 1. Create Session
      const sessionPayload = {
        date: new Date().toISOString().split('T')[0],
        subject: selectedSubject
      };
      const savedSession = await createSession(sessionPayload);

      // 2. Prepare Attendance Records
      const attendanceRecords = students.map(student => ({
        session_id: savedSession.id,
        student_id: student.id,
        status: attendanceState[student.id] || 'present'
      }));

      // 3. Save to DB
      await saveAttendance(attendanceRecords);

      // 4. Filter absents for alerts
      const absents = students
        .filter(s => attendanceState[s.id] === 'absent')
        .map(s => ({
          id: s.id,
          name: s.name,
          standard: s.standard,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
          whatsappUrl: generateWhatsAppLink(s.parent_phone, s.name, selectedSubject)
        }));

      setAbsentsList(absents);
      setStep('success');
      setHasNotified(absents.length === 0);
    } catch (err) {
      console.error("Error saving attendance:", err);
      setError("Failed to save attendance records.");
    } finally {
      setSaving(false);
    }
  };

  const generateWhatsAppLink = (phone, studentName, subject) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const message = `${studentName} was absent from ${subject} class on ${todayStr}. Please ensure they cover the missed topic.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleNotifyAll = () => {
    if (absentsList.length === 0) {
      setHasNotified(true);
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const namesList = absentsList.map(s => `${s.name} (${s.standard})`).join(', ');
    const messageText = `Absentees for ${selectedSubject} class today (${todayStr}):\n${namesList}`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');

    setHasNotified(true);
  };

  const handleDoneDone = () => {
    setStep('attendance');
    setAbsentsList([]);
    setHasNotified(false);
    setSelectedSubject('');
    navigate('dashboard');
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
      
      {/* 1. ATTENDANCE ROSTER VIEW */}
      {step === 'attendance' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 flex justify-between items-center px-4 py-3 shrink-0">
            <div className="text-left flex items-center gap-2">
              <button 
                onClick={() => navigate('dashboard')}
                className="p-1 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
                <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                  Register Attendance
                </h2>
              </div>
            </div>
          </div>

          {/* Subject Dropdown Selector */}
          <div className="w-full flex items-center bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs shrink-0 select-none">
            <span className="text-slate-500 font-bold uppercase tracking-wider mr-3">Select Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1.5 font-bold text-xs focus:outline-none focus:border-indigo-500 flex-1 cursor-pointer"
            >
              <option value="">-- Choose Subject --</option>
              <option value="Maths">Maths</option>
              <option value="Science">Science</option>
              <option value="Hindi">Hindi</option>
              <option value="English">English</option>
              <option value="Social">Social</option>
              <option value="Kannada">Kannada</option>
            </select>
          </div>

          {error && (
            <div className="mx-4 my-2 bg-red-50 text-red-650 text-xs font-semibold p-2 rounded border border-red-100 text-center shrink-0">
              {error}
            </div>
          )}

          {/* Roster List - Edge to edge, compact py-2, thin border */}
          <div className="flex-1 overflow-y-auto">
            {/* Headers row */}
            <div className="w-full flex items-stretch border-b border-slate-350 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
              <div className="flex-1 px-3 py-1.5 flex items-center">Name</div>
              <div className="w-16 px-2 py-1.5 border-l border-slate-250 flex items-center justify-center">Class</div>
              <div className="w-24 border-l border-slate-250 flex items-center justify-center">Status</div>
            </div>

            {students.map((student) => {
              const status = attendanceState[student.id] || 'present';
              const isPresent = status === 'present';
              return (
                <div 
                  key={student.id} 
                  className="w-full flex items-stretch border-b border-slate-200 text-sm select-none"
                >
                  {/* Name (Left) */}
                  <div className="flex-1 px-3 py-2 flex items-center truncate text-slate-800 font-medium text-xs">
                    {student.name}
                  </div>

                  {/* Class (Middle) */}
                  <div className="w-16 border-l border-slate-200 flex items-center justify-center text-xs text-slate-500">
                    {student.standard}
                  </div>
                  
                  {/* P / A toggles (Right) */}
                  <div className="w-24 border-l border-slate-200 flex items-stretch shrink-0">
                    {/* P Button */}
                    <button
                      type="button"
                      onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: 'present' }))}
                      className={`flex-1 py-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        isPresent 
                          ? 'bg-green-600 text-white font-extrabold' 
                          : 'bg-white text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      P
                    </button>
                    {/* A Button */}
                    <button
                      type="button"
                      onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: 'absent' }))}
                      className={`flex-1 py-2 border-l border-slate-200 flex items-center justify-center text-xs font-bold transition-colors ${
                        !isPresent 
                          ? 'bg-red-600 text-white font-extrabold' 
                          : 'bg-white text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      A
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pinned done button at the very bottom */}
          <button
            onClick={handleDone}
            disabled={saving || !selectedSubject}
            className={`w-full text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider ${
              selectedSubject ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{selectedSubject ? 'Done →' : 'Select Subject First'}</span>
          </button>
        </div>
      )}

      {/* 2. SUCCESS / WHATSAPP ALERTS VIEW */}
      {step === 'success' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0">
            <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              ABSENT STUDENTS LIST
            </h1>
            <p className="text-sm font-bold text-slate-800">
              Send parent alerts on WhatsApp
            </p>
          </div>

          {/* Plain List of Absent Students */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
            {absentsList.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-sm italic">
                All students were present. No parents to notify.
              </div>
            ) : (
              <div className="flex flex-col border border-slate-250 divide-y divide-slate-200 rounded-none">
                {absentsList.map((student) => (
                  <div 
                    key={student.id} 
                    className="flex justify-between items-center py-2 text-sm px-3 bg-white"
                  >
                    <span className="text-slate-800 font-medium text-xs">
                      {student.name} ({student.standard})
                    </span>
                    {student.parent_phone ? (
                      <a
                        href={student.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 font-bold flex items-center gap-1 active:scale-95 transition-all text-xs border border-green-200 bg-green-50 px-2.5 py-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-green-600 text-green-600" />
                        <span>Send Alert</span>
                      </a>
                    ) : (
                      <span className="text-xs text-red-500 font-medium italic">
                        No phone
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action button pinned to the bottom */}
          {!hasNotified ? (
            <button
              onClick={handleNotifyAll}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider"
            >
              Notify Parents
            </button>
          ) : (
            <button
              onClick={handleDoneDone}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider"
            >
              Done →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
