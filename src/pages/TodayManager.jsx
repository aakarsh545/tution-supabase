import React, { useState, useEffect } from 'react';
import { getStudents, createSession, saveAttendance, seedStudents } from '../lib/db';
import { ArrowLeft, CheckCircle2, MessageCircle, AlertCircle, RefreshCw, Check, X } from 'lucide-react';

const SAMPLE_STUDENTS = [
  {
    name: "Rahul Shetty",
    standard: "9th",
    parent_name: "Suresh Shetty",
    parent_phone: "+919876543210",
    fee_amount: 1500
  },
  {
    name: "Priya Nair",
    standard: "10th",
    parent_name: "Ramesh Nair",
    parent_phone: "+919876543211",
    fee_amount: 1500
  },
  {
    name: "Arjun Bhat",
    standard: "8th",
    parent_name: "Mohan Bhat",
    parent_phone: "+919876543212",
    fee_amount: 1200
  },
  {
    name: "Sneha Rao",
    standard: "10th",
    parent_name: "Venkat Rao",
    parent_phone: "+919876543213",
    fee_amount: 1500
  },
  {
    name: "Kiran Kamath",
    standard: "9th",
    parent_name: "Dinesh Kamath",
    parent_phone: "+919876543214",
    fee_amount: 1500
  }
];

const TIMETABLE = {
  '8th-9th': {
    'Monday': 'Science',
    'Tuesday': 'Kannada',
    'Wednesday': 'Maths',
    'Thursday': 'Hindi',
    'Friday': 'Social',
    'Saturday': 'English',
    'Sunday': 'No Class'
  },
  '10th': {
    'Monday': 'Social',
    'Tuesday': 'English',
    'Wednesday': 'Hindi',
    'Thursday': 'Maths',
    'Friday': 'Science',
    'Saturday': 'Kannada',
    'Sunday': 'No Class'
  }
};

export default function TodayManager({ navigate }) {
  const [step, setStep] = useState('select-group'); // 'select-group' | 'attendance' | 'success'
  const [selectedGroup, setSelectedGroup] = useState(''); // '8th-9th' or '10th'
  
  const [students, setStudents] = useState([]);
  const [groupStudents, setGroupStudents] = useState([]);
  const [attendanceState, setAttendanceState] = useState({}); // { studentId: 'present' | 'absent' }
  const [absentsList, setAbsentsList] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const handleLoadTestData = async () => {
    try {
      setSeedLoading(true);
      setError(null);
      await seedStudents(SAMPLE_STUDENTS);
      setSeedSuccess(true);
      const allStudents = await getStudents();
      setStudents(allStudents);
    } catch (err) {
      console.error("Error seeding test data:", err);
      setError("Failed to load test data.");
    } finally {
      setSeedLoading(false);
    }
  };

  // Time calculations
  const getDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const todayDay = getDayName();
  const sub89 = TIMETABLE['8th-9th'][todayDay];
  const sub10 = TIMETABLE['10th'][todayDay];

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const allStudents = await getStudents();
        setStudents(allStudents);
      } catch (err) {
        console.error("Error loading students:", err);
        setError("Failed to load students list.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleGroupPick = (group) => {
    setSelectedGroup(group);
    
    // Filter students by group standard
    const filtered = students.filter(student => {
      if (group === '8th-9th') {
        return student.standard === '8th' || student.standard === '9th';
      } else {
        return student.standard === '10th';
      }
    });

    setGroupStudents(filtered);
    
    // Default everyone to present
    const initialAttendance = {};
    filtered.forEach(s => {
      initialAttendance[s.id] = 'present';
    });
    setAttendanceState(initialAttendance);
    
    if (filtered.length === 0) {
      setError(`No students enrolled in standard group ${group === '8th-9th' ? '8th & 9th' : '10th'}.`);
    } else {
      setError(null);
      setStep('attendance');
    }
  };

  const toggleAttendance = (studentId) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const handleDone = async () => {
    try {
      setLoading(true);
      setError(null);

      const activeSubject = selectedGroup === '8th-9th' ? sub89 : sub10;

      // 1. Create Session
      const sessionPayload = {
        date: new Date().toISOString().split('T')[0],
        subject: activeSubject
      };
      const savedSession = await createSession(sessionPayload);

      // 2. Prepare Attendance Records
      const attendanceRecords = groupStudents.map(student => ({
        session_id: savedSession.id,
        student_id: student.id,
        status: attendanceState[student.id]
      }));

      // 3. Save to DB
      await saveAttendance(attendanceRecords);

      // 4. Filter absents for alerts
      const absents = groupStudents
        .filter(s => attendanceState[s.id] === 'absent')
        .map(s => ({
          id: s.id,
          name: s.name,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
          whatsappUrl: generateWhatsAppLink(s.parent_phone, s.name, activeSubject)
        }));

      setAbsentsList(absents);
      setStep('success');
    } catch (err) {
      console.error("Error saving attendance:", err);
      setError("Failed to save attendance records.");
    } finally {
      setLoading(false);
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

  if (loading && step === 'select-group') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto flex flex-col justify-between select-none">
      
      {/* 1. SELECT GROUP SCREEN */}
      {step === 'select-group' && (
        <div className="flex-1 flex flex-col justify-between p-5 h-full">
          {/* Header */}
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center shrink-0">
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
              <h2 className="text-[11px] font-bold text-slate-700 mt-1 bg-indigo-50/50 py-1.5 px-2.5 rounded-lg border border-indigo-100/30 inline-block leading-normal">
                {todayDay} — 8/9th: <span className="text-indigo-600 font-extrabold">{sub89}</span> | 10th: <span className="text-indigo-600 font-extrabold">{sub10}</span>
              </h2>
            </div>
            {/* Load Test Data Button */}
            {!seedSuccess ? (
              <button
                onClick={handleLoadTestData}
                disabled={seedLoading}
                className="text-[9px] bg-slate-100 text-slate-500 font-bold py-1.5 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-200 transition active:scale-95 disabled:opacity-50 shrink-0 shadow-sm"
              >
                {seedLoading ? '...' : 'Load Data'}
              </button>
            ) : (
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 py-1.5 px-2.5 rounded-lg shrink-0 animate-pulse">
                Loaded ✓
              </span>
            )}
          </div>

          {error && (
            <div className="my-4 bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 text-center">
              {error}
            </div>
          )}

          {/* Group Buttons */}
          <div className="my-auto flex flex-col gap-5 py-6">
            <button
              onClick={() => handleGroupPick('8th-9th')}
              className="bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50/30 p-8 rounded-3xl transition-all duration-200 active:scale-95 shadow-sm flex flex-col items-center justify-center gap-2 group"
            >
              <span className="text-3xl font-extrabold text-indigo-950">8th & 9th Standard</span>
              <span className="text-xs font-bold text-indigo-600/80 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider group-hover:bg-indigo-100/70">
                Subject: {sub89}
              </span>
            </button>

            <button
              onClick={() => handleGroupPick('10th')}
              className="bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50/30 p-8 rounded-3xl transition-all duration-200 active:scale-95 shadow-sm flex flex-col items-center justify-center gap-2 group"
            >
              <span className="text-3xl font-extrabold text-indigo-950">10th Standard</span>
              <span className="text-xs font-bold text-indigo-600/80 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider group-hover:bg-indigo-100/70">
                Subject: {sub10}
              </span>
            </button>
          </div>

          {/* Bottom spacer / aesthetic helper */}
          <div className="text-center">
            <span className="text-[10px] font-semibold text-slate-400">Tuition manager tool • mangalore</span>
          </div>
        </div>
      )}

      {/* 2. ATTENDANCE ROSTER SCREEN (No scrolling, edge-to-edge, paper register style) */}
      {step === 'attendance' && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between max-w-md mx-auto h-screen max-h-screen overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 flex items-center gap-3 px-4 py-3 shrink-0">
            <button 
              onClick={() => setStep('select-group')}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Attendance Register
              </h1>
              <p className="text-sm font-bold text-slate-800">
                {selectedGroup === '8th-9th' ? '8th & 9th Standard' : '10th Standard'} • {selectedGroup === '8th-9th' ? sub89 : sub10}
              </p>
            </div>
          </div>

          {error && (
            <div className="mx-4 my-2 bg-red-50 text-red-600 text-xs font-semibold p-2.5 rounded border border-red-100 text-center shrink-0">
              {error}
            </div>
          )}

          {/* Roster List - Edge to edge, compact py-2, thin border */}
          <div className="flex-1 overflow-y-auto">
            {/* Headers row */}
            <div className="w-full flex items-stretch border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
              <div className="flex-1 px-3 py-1.5 flex items-center">Name</div>
              <div className="w-16 px-2 py-1.5 border-l border-slate-250 flex items-center justify-center">Class</div>
              <div className="w-24 border-l border-slate-250 flex items-center justify-center">Status</div>
            </div>

            {groupStudents.map((student) => {
              const status = attendanceState[student.id];
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
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Done →</span>
          </button>
        </div>
      )}

      {/* 3. SUCCESS / WHATSAPP ALERTS SCREEN */}
      {step === 'success' && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between max-w-md mx-auto h-screen max-h-screen overflow-hidden select-none">
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

          {/* Back button pinned to the bottom */}
          <button
            onClick={() => {
              setStep('select-group');
              setSelectedGroup('');
              setGroupStudents([]);
              setAttendanceState({});
              setAbsentsList([]);
            }}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
