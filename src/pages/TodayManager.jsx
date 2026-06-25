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

      {/* 2. ATTENDANCE ROSTER SCREEN (No scrolling) */}
      {step === 'attendance' && (
        <div className="flex-1 flex flex-col justify-between p-4 h-screen max-h-screen overflow-hidden">
          {/* Header with back button */}
          <div className="bg-white border-b border-slate-200 flex items-center gap-3 px-3 py-3 rounded-2xl shadow-sm shrink-0">
            <button 
              onClick={() => setStep('select-group')}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Attendance: {selectedGroup === '8th-9th' ? '8th & 9th' : '10th'}
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                {selectedGroup === '8th-9th' ? sub89 : sub10} class • {todayDay}
              </p>
            </div>
          </div>

          {error && (
            <div className="my-2 bg-red-50 text-red-600 text-xs font-semibold p-2.5 rounded-lg border border-red-100 text-center shrink-0">
              {error}
            </div>
          )}

          {/* Compact Students list containing no scrolling */}
          <div className="flex-1 flex flex-col justify-center gap-1.5 my-3 overflow-hidden">
            {groupStudents.map(student => {
              const status = attendanceState[student.id];
              const isPresent = status === 'present';
              return (
                <div 
                  key={student.id} 
                  className="bg-white border border-slate-100 px-3 py-2 rounded-xl flex justify-between items-center shadow-sm select-none"
                >
                  <span className="font-bold text-slate-800 text-xs truncate max-w-[180px]">
                    {student.name}
                  </span>
                  
                  {/* PRESENT / ABSENT toggle switch */}
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleAttendance(student.id)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                        isPresent 
                          ? 'bg-green-500 text-white shadow-sm' 
                          : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAttendance(student.id)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase transition ${
                        !isPresent 
                          ? 'bg-red-500 text-white shadow-sm' 
                          : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Done Button */}
          <button
            onClick={handleDone}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 active:scale-95 mb-14"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Done</span>
          </button>
        </div>
      )}

      {/* 3. SUCCESS / WHATSAPP ALERTS SCREEN */}
      {step === 'success' && (
        <div className="flex-1 flex flex-col justify-between p-5 h-full">
          <div className="my-auto text-center">
            <div className="bg-green-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-green-100">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-xl font-extrabold text-slate-800">Session Logged!</h2>
            <p className="text-xs text-slate-500 mt-1">Attendance records saved successfully.</p>

            {/* WhatsApp Alerts */}
            <div className="border-t border-slate-100 pt-5 mt-6 text-left max-w-sm mx-auto">
              <h3 className="text-xs font-bold text-slate-800 mb-3.5 flex items-center gap-1.5 uppercase tracking-wide">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span>WhatsApp Alerts ({absentsList.length})</span>
              </h3>
              
              {absentsList.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 italic text-center">
                  All students were present. No alerts needed!
                </p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                  {absentsList.map((student) => (
                    <div key={student.id} className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-700 text-xs truncate">{student.name}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">Phone: {student.parent_phone}</p>
                      </div>
                      
                      {student.parent_phone ? (
                        <a
                          href={student.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1 shadow-sm active:scale-95 transition-all shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-white" />
                          <span>Alert</span>
                        </a>
                      ) : (
                        <span className="text-[9px] text-red-500 font-semibold uppercase bg-red-50 px-1.5 py-0.5 rounded shrink-0">
                          No Phone
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setStep('select-group');
              setSelectedGroup('');
              setGroupStudents([]);
              setAttendanceState({});
              setAbsentsList([]);
            }}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition active:scale-95 mb-14"
          >
            Back to Today Screen
          </button>
        </div>
      )}
    </div>
  );
}
