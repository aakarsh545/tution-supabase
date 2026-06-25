import React, { useState, useEffect } from 'react';
import { getStudents, createSession, saveAttendance } from '../lib/db';
import { ArrowLeft, Calendar, ArrowRight, CheckCircle2, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function SessionManager({ navigate }) {
  const [step, setStep] = useState('form'); // 'form' | 'attendance' | 'success'
  const [students, setStudents] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  
  // Timetable definition
  const TIMETABLE = {
    '8th-9th': {
      'Monday': 'Science',
      'Tuesday': 'Kannada',
      'Wednesday': 'Maths',
      'Thursday': 'Hindi',
      'Friday': 'Social',
      'Saturday': 'English',
      'Sunday': ''
    },
    '10th': {
      'Monday': 'Social',
      'Tuesday': 'English',
      'Wednesday': 'Hindi',
      'Thursday': 'Maths',
      'Friday': 'Science',
      'Saturday': 'Kannada',
      'Sunday': ''
    }
  };

  const getDayOfWeek = (dateStr) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // Solve potential timezone offset issues by splitting date string
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return days[date.getDay()];
  };

  // Form states
  const [sessionDetails, setSessionDetails] = useState({
    date: new Date().toISOString().split('T')[0],
    subject: '',
  });

  const [selectedGroup, setSelectedGroup] = useState(''); // '8th-9th' or '10th'

  // Attendance logging states
  const [sessionStudents, setSessionStudents] = useState([]); // Students attending this subject
  const [attendanceState, setAttendanceState] = useState({}); // { studentId: 'present' | 'absent' }
  const [absentStudentsList, setAbsentStudentsList] = useState([]); // Saved absent students for WhatsApp alerts
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const allStudents = await getStudents();
        setStudents(allStudents);

        // Gather unique subjects across all students
        const subjectsSet = new Set();
        allStudents.forEach(student => {
          if (student.subjects && Array.isArray(student.subjects)) {
            student.subjects.forEach(sub => subjectsSet.add(sub));
          }
        });
        setAvailableSubjects([...subjectsSet]);
      } catch (err) {
        console.error("Error loading session initial data:", err);
        setError("Failed to fetch students data.");
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    const day = getDayOfWeek(sessionDetails.date);
    const subject = TIMETABLE[group][day] || '';
    setSessionDetails(prev => ({
      ...prev,
      subject
    }));
  };

  const handleDateChange = (date) => {
    setSessionDetails(prev => ({ ...prev, date }));
    if (selectedGroup) {
      const day = getDayOfWeek(date);
      const subject = TIMETABLE[selectedGroup][day] || '';
      setSessionDetails(prev => ({
        ...prev,
        date,
        subject
      }));
    }
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!selectedGroup) {
      setError("Please select a standard group.");
      return;
    }
    if (!sessionDetails.subject.trim()) {
      setError("Please select or enter a subject.");
      return;
    }

    // Filter students belonging only to the selected standard group
    const attending = students.filter(student => {
      if (selectedGroup === '8th-9th') {
        return student.standard === '8th' || student.standard === '9th';
      } else if (selectedGroup === '10th') {
        return student.standard === '10th';
      }
      return false;
    });

    if (attending.length === 0) {
      setError(`No students found enrolled in group ${selectedGroup === '8th-9th' ? '8th & 9th' : '10th'}.`);
      return;
    }

    setSessionStudents(attending);
    // Default everyone to present
    const initialAttendance = {};
    attending.forEach(s => { initialAttendance[s.id] = 'present'; });
    setAttendanceState(initialAttendance);
    setStep('attendance');
    setError(null);
  };

  const toggleAttendance = (studentId) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const handleSaveAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Create the session in DB (topic_covered field is omitted)
      const sessionPayload = {
        date: sessionDetails.date,
        subject: sessionDetails.subject.trim()
      };
      const savedSession = await createSession(sessionPayload);

      // 2. Map attendance records
      const attendanceRecords = sessionStudents.map(student => ({
        session_id: savedSession.id,
        student_id: student.id,
        status: attendanceState[student.id]
      }));

      // 3. Save attendance in DB
      await saveAttendance(attendanceRecords);

      // 4. Capture absent students details to generate WhatsApp links
      const absents = sessionStudents
        .filter(s => attendanceState[s.id] === 'absent')
        .map(s => ({
          id: s.id,
          name: s.name,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
          whatsappUrl: generateWhatsAppLink(s.parent_phone, s.name, sessionDetails.subject, sessionDetails.date)
        }));

      setAbsentStudentsList(absents);
      setStep('success');
    } catch (err) {
      console.error("Error saving attendance:", err);
      setError("Failed to log attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Generate pre-filled WhatsApp link
  const generateWhatsAppLink = (phone, studentName, subject, date) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, ''); // keep only digits
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Prefix India country code
    }
    
    // Format Date beautifully
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const message = `${studentName} was absent from ${subject} class on ${formattedDate}. Please ensure they cover the missed topic.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  if (loading && step === 'form') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading session manager...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
        <button 
          onClick={() => {
            if (step === 'attendance') setStep('form');
            else if (step === 'success') navigate('dashboard');
            else navigate('dashboard');
          }}
          className="p-1 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">Session Manager</h1>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        {/* STEP 1: SESSION INFO FORM */}
        {step === 'form' && (
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Start Class Session</h2>
            <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Session Date
                </label>
                <input
                  type="date"
                  value={sessionDetails.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Group Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Standard / Group
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGroupSelect('8th-9th')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all active:scale-95 flex items-center justify-center ${
                      selectedGroup === '8th-9th'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    8th & 9th
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGroupSelect('10th')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all active:scale-95 flex items-center justify-center ${
                      selectedGroup === '10th'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    10th
                  </button>
                </div>
              </div>

              {/* Subject Select / Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Subject {selectedGroup && `(Auto-detected ${getDayOfWeek(sessionDetails.date)} class)`}
                </label>
                <input
                  type="text"
                  placeholder={selectedGroup ? "Type to override subject..." : "Select standard group to auto-fill subject..."}
                  value={sessionDetails.subject}
                  onChange={(e) => setSessionDetails(prev => ({ ...prev, subject: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Next Button */}
              <button
                type="submit"
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Select Students & Log Attendance</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: ATTENDANCE TOGGLES */}
        {step === 'attendance' && (
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <div className="mb-4">
              <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2.5 py-0.5 rounded-md">
                {sessionDetails.subject}
              </span>
              <h2 className="text-lg font-bold text-slate-800 mt-2">Attendance Sheet</h2>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Group: {selectedGroup === '8th-9th' ? '8th & 9th Standard' : '10th Standard'}</p>
            </div>

            {/* Attendance Toggle Grid */}
            <div className="flex flex-col gap-3 my-4 max-h-[350px] overflow-y-auto pr-1">
              {sessionStudents.map(student => {
                const status = attendanceState[student.id];
                const isPresent = status === 'present';
                return (
                  <div key={student.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{student.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">Standard {student.standard || 'N/A'}</p>
                    </div>

                    {/* Present/Absent Big Toggle */}
                    <button
                      onClick={() => toggleAttendance(student.id)}
                      className={`w-28 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                        isPresent
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {isPresent ? 'Present' : 'Absent'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Submit Attendance Button */}
            <button
              onClick={handleSaveAttendance}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 active:scale-95"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Save & Log Attendance</span>
            </button>
          </div>
        )}

        {/* STEP 3: SUCCESS & WHATSAPP ALERTS */}
        {step === 'success' && (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm text-center">
            <div className="bg-green-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-xl font-extrabold text-slate-800">Session Logged!</h2>
            <p className="text-xs text-slate-500 mt-1.5">Attendance records successfully saved to database.</p>

            {/* WhatsApp Alerts Box */}
            <div className="border-t border-slate-100 pt-6 mt-6 text-left">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                <span>Parent WhatsApp Alerts ({absentStudentsList.length})</span>
              </h3>
              
              {absentStudentsList.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                  Everyone was present! No WhatsApp alerts needed.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-400 font-medium">
                    The following students were absent. Tap to open WhatsApp with pre-filled notification:
                  </p>
                  
                  {absentStudentsList.map((student) => (
                    <div key={student.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-700 text-xs truncate">{student.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">Parent: {student.parent_name || 'N/A'}</p>
                      </div>
                      
                      {student.parent_phone ? (
                        <a
                          href={student.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 shadow-sm shadow-green-100 whitespace-nowrap active:scale-95 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-white" />
                          <span>Send Alert</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-red-500 font-semibold uppercase bg-red-50 px-2 py-1 rounded">
                          No Phone
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Back to Dashboard Button */}
            <button
              onClick={() => navigate('dashboard')}
              className="mt-8 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl transition active:scale-95"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
