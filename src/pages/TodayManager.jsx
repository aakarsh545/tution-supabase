import React, { useState, useEffect } from 'react';
import { getStudents, createSession, saveAttendance } from '../lib/db';
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';

export default function TodayManager({ navigate }) {
  const [step, setStep] = useState('attendance'); // 'attendance' | 'success'
  const [students, setStudents] = useState([]);
  const [attendanceState, setAttendanceState] = useState({}); // { studentId: 'present' | 'late' | 'absent' }
  const [absentsList, setAbsentsList] = useState([]);
  const [lateArrivalsList, setLateArrivalsList] = useState([]);
  const [hasNotified, setHasNotified] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Helper to determine today's subject and day name
  const getTodaySubject = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    const dayName = dayNames[today.getDay()];
    const timetable = {
      "Monday": "Science",
      "Tuesday": "Kannada",
      "Wednesday": "Maths",
      "Thursday": "Hindi",
      "Friday": "Social",
      "Saturday": "English",
      "Sunday": "Science" // Fallback fallback
    };
    return {
      subject: timetable[dayName] || "Science",
      dayName
    };
  };

  const { subject: todaySubject, dayName: todayDayName } = getTodaySubject();

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
        setError("Failed to load students list.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDone = async () => {
    try {
      setSaving(true);
      setError(null);

      // 1. Create Session using the auto-selected today's subject
      const sessionPayload = {
        date: new Date().toISOString().split('T')[0],
        subject: todaySubject
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

      // 4. Filter absents for WhatsApp alerts
      const absents = students
        .filter(s => attendanceState[s.id] === 'absent')
        .map(s => ({
          id: s.id,
          name: s.name,
          standard: s.standard,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
          whatsappUrl: generateWhatsAppLink(s.parent_phone, s.name, todaySubject)
        }));

      // 5. Filter late arrivals to show in summary
      const lates = students
        .filter(s => attendanceState[s.id] === 'late')
        .map(s => ({
          id: s.id,
          name: s.name,
          standard: s.standard
        }));

      setAbsentsList(absents);
      setLateArrivalsList(lates);
      setStep('success');
      setHasNotified(absents.length === 0);
    } catch (err) {
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
    const messageText = `Absentees for ${todaySubject} class today (${todayStr}):\n${namesList}`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');

    setHasNotified(true);
  };

  const handleDoneDone = () => {
    setStep('attendance');
    setAbsentsList([]);
    setLateArrivalsList([]);
    setHasNotified(false);
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TUITION PORTAL</p>
                <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                  Register Attendance
                </h2>
              </div>
            </div>
          </div>

          {/* Timetable Auto Subject Text Display (Plain Label, Cannot Edit) */}
          <div className="w-full bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-700 font-bold uppercase shrink-0 select-none text-center tracking-wider">
            TODAY: {todaySubject.toUpperCase()} — {todayDayName}
          </div>

          {error && (
            <div className="mx-4 my-2 bg-red-50 text-red-650 text-xs font-semibold p-2 rounded border border-red-100 text-center shrink-0">
              {error}
            </div>
          )}

          {/* Roster List - Edge to edge, compact py-2, thin border */}
          <div className="flex-1 overflow-y-auto pb-28">
            {/* Headers row */}
            <div className="w-full flex items-stretch border-b border-slate-350 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
              <div className="flex-1 px-3 py-1.5 flex items-center">Name</div>
              <div className="w-16 px-2 py-1.5 border-l border-slate-250 flex items-center justify-center">Class</div>
              <div className="w-32 border-l border-slate-250 flex items-center justify-center">Status</div>
            </div>

            {students.map((student) => {
              const status = attendanceState[student.id] || 'present';
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
                  
                  {/* P / L / A toggles (Right) */}
                  <div className="w-32 border-l border-slate-200 flex items-stretch shrink-0">
                    {/* P Button */}
                    <button
                      type="button"
                      onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: 'present' }))}
                      className={`flex-1 py-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        status === 'present' 
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
                        status === 'absent' 
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
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 z-20 shrink-0">
            <button
              onClick={handleDone}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 text-base transition flex items-center justify-center gap-2 rounded-xl active:scale-95"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Done →</span>
            </button>
          </div>
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

          {/* Plain List of Absent Students and Late Arrivals */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 pb-28">
            {absentsList.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-sm italic bg-slate-50 border border-slate-200 rounded-xl">
                All students were present. No parents to notify.
              </div>
            ) : (
              <div className="flex flex-col border border-slate-200 divide-y divide-slate-200 rounded-xl overflow-hidden shadow-sm">
                {absentsList.map((student) => (
                  <div 
                    key={student.id} 
                    className="flex justify-between items-center py-2.5 text-sm px-3 bg-white"
                  >
                    <span className="text-slate-800 font-semibold text-xs">
                      {student.name} ({student.standard})
                    </span>
                    {student.parent_phone ? (
                      <a
                        href={student.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 font-bold flex items-center gap-1 active:scale-95 transition-all text-xs border border-green-200 bg-green-50 px-2.5 py-1.5 rounded-lg"
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

            {/* Late Arrivals Section */}
            {lateArrivalsList.length > 0 && (
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Late arrivals</p>
                <p className="text-xs text-slate-700 font-bold leading-relaxed">
                  {lateArrivalsList.map(s => `${s.name} (${s.standard})`).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Action button pinned to the bottom */}
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 z-20 shrink-0">
            {!hasNotified ? (
              <button
                onClick={handleNotifyAll}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 text-base transition flex items-center justify-center gap-2 rounded-xl active:scale-95"
              >
                Notify Parents
              </button>
            ) : (
              <button
                onClick={handleDoneDone}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 text-base transition flex items-center justify-center gap-2 rounded-xl active:scale-95"
              >
                Done →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
