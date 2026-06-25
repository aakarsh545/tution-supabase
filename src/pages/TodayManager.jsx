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
  const [step, setStep] = useState('attendance'); // 'attendance' | 'success'
  const [selectedGroup, setSelectedGroup] = useState('8th-9th'); // '8th-9th' or '10th'
  
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

  // Automatically filter students and initialize attendance state when selectedGroup or students change
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

    // Initialize/reset attendance state to present for the filtered students
    const initialAttendance = {};
    filtered.forEach(s => {
      initialAttendance[s.id] = 'present';
    });
    setAttendanceState(initialAttendance);
  }, [selectedGroup, students]);

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

  const handleNotifyAll = () => {
    if (absentsList.length === 0) {
      setStep('attendance');
      setAbsentsList([]);
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const subject = selectedGroup === '8th-9th' ? sub89 : sub10;
    const namesList = absentsList.map(s => `${s.name} (${s.standard})`).join(', ');
    const messageText = `Absentees for ${subject} class today (${todayStr}):\n${namesList}`;
    
    // Open WhatsApp contact/group selector prefilled with the absentees list
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');

    setStep('attendance');
    setAbsentsList([]);
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
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
              <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                Attendance Register — {todayDay}
              </h2>
            </div>
            {/* Load Test Data Button */}
            {students.length === 0 && (
              <button
                onClick={handleLoadTestData}
                disabled={seedLoading}
                className="text-[9px] bg-slate-100 text-slate-500 font-bold py-1 px-2 border border-slate-200 hover:bg-slate-250 transition active:scale-95"
              >
                {seedLoading ? '...' : 'Load Data'}
              </button>
            )}
          </div>

          {/* Subject selector row before the table */}
          <div className="w-full flex items-center bg-slate-50 border-b border-slate-200 px-3 py-2 text-xs shrink-0 select-none">
            <span className="text-slate-500 font-bold uppercase tracking-wider mr-3">Subject:</span>
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
                {sub89} (8/9th)
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
                {sub10} (10th)
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 my-2 bg-red-50 text-red-600 text-xs font-semibold p-2 rounded border border-red-100 text-center shrink-0">
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
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider animate-none"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Done →</span>
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

          {/* Notify Parents button pinned to the bottom */}
          <button
            onClick={handleNotifyAll}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider"
          >
            Notify Parents
          </button>
        </div>
      )}
    </div>
  );
}
