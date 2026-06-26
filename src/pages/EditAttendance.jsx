import React, { useState, useEffect } from 'react';
import { getStudents, getSessionsToday, getAttendanceForSession, updateAttendance } from '../lib/db';
import { ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function EditAttendance({ navigate }) {
  const [students, setStudents] = useState([]);
  const [session, setSession] = useState(null);
  const [attendanceState, setAttendanceState] = useState({}); // { studentId: 'present' | 'late' | 'absent' }
  const [originalRecords, setOriginalRecords] = useState({}); // { studentId: recordId }
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Day Name Helper
  const getDayName = () => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
  };

  useEffect(() => {
    const loadTodayData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Load today's session
        const sessionsToday = await getSessionsToday();
        if (!sessionsToday || sessionsToday.length === 0) {
          setError("No session logged for today yet.");
          setLoading(false);
          return;
        }

        // Use the first session found today
        const todaySession = sessionsToday[0];
        setSession(todaySession);

        // 2. Load all students and their attendance for this session
        const [allStudents, sessionAttendance] = await Promise.all([
          getStudents(),
          getAttendanceForSession(todaySession.id)
        ]);

        setStudents(allStudents);

        // Map existing attendance records
        const initialStates = {};
        const origRecs = {};
        
        // Default all students to present in case some new student has no record yet
        allStudents.forEach(s => {
          initialStates[s.id] = 'present';
        });

        // Overlay with DB status
        sessionAttendance.forEach(rec => {
          initialStates[rec.student_id] = rec.status;
          origRecs[rec.student_id] = rec.id;
        });

        setAttendanceState(initialStates);
        setOriginalRecords(origRecs);

      } catch (err) {
        setError("Failed to load attendance records.");
      } finally {
        setLoading(false);
      }
    };

    loadTodayData();
  }, []);

  const handleSave = async () => {
    if (!session) return;
    try {
      setSaving(true);
      setError(null);

      // Prepare upsert payload
      const payload = students.map(student => {
        const record = {
          session_id: session.id,
          student_id: student.id,
          status: attendanceState[student.id] || 'present'
        };
        // Include existing primary key ID to update the exact row if it exists
        if (originalRecords[student.id]) {
          record.id = originalRecords[student.id];
        }
        return record;
      });

      await updateAttendance(payload);
      
      // Navigate back to dashboard
      navigate('dashboard');
    } catch (err) {
      setError("Failed to update attendance records.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading attendance records...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
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
                Edit Today's Attendance
              </h2>
            </div>
          </div>
        </div>

        {/* Timetable Auto Subject Text Display */}
        {session && (
          <div className="w-full bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-700 font-bold uppercase shrink-0 select-none text-center tracking-wider">
            EDIT TODAY: {session.subject.toUpperCase()} — {getDayName()}
          </div>
        )}

        {error && (
          <div className="mx-4 my-2 bg-red-50 text-red-650 text-xs font-semibold p-2 rounded border border-red-100 text-center shrink-0">
            {error}
          </div>
        )}

        {/* Roster List */}
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
                {/* Name */}
                <div className="flex-1 px-3 py-2 flex items-center truncate text-slate-800 font-medium text-xs">
                  {student.name}
                </div>

                {/* Class */}
                <div className="w-16 border-l border-slate-200 flex items-center justify-center text-xs text-slate-500">
                  {student.standard}
                </div>
                
                {/* P / L / A toggles */}
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
                  {/* L Button (Late) */}
                  <button
                    type="button"
                    onClick={() => setAttendanceState(prev => ({ ...prev, [student.id]: 'late' }))}
                    className={`flex-1 py-2 border-l border-slate-200 flex items-center justify-center text-xs font-bold transition-colors ${
                      status === 'late' 
                        ? 'bg-amber-500 text-white font-extrabold' 
                        : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    L
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

        {/* Pinned Save button */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 z-20 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !session}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 text-base transition flex items-center justify-center gap-2 rounded-xl active:scale-95 disabled:opacity-50"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
