import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Calendar } from 'lucide-react';

export default function CalendarView({ navigate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date Detail overlay state
  const [selectedDateStr, setSelectedDateStr] = useState(null); // 'YYYY-MM-DD'

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const loadMonthData = async () => {
    try {
      setLoading(true);
      setError(null);

      const days = getDaysInMonth(year, month);
      const startOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

      // 1. Fetch sessions for the visible month
      const { data: sessionsData, error: sessErr } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', startOfMonthStr)
        .lte('date', endOfMonthStr);
      
      if (sessErr) throw sessErr;

      setSessions(sessionsData || []);

      if (sessionsData && sessionsData.length > 0) {
        // 2. Fetch all attendance records for these sessions
        const sessionIds = sessionsData.map(s => s.id);
        const { data: attendanceData, error: attErr } = await supabase
          .from('attendance')
          .select('session_id, status, student_id, students(name, standard)')
          .in('session_id', sessionIds);
        
        if (attErr) throw attErr;
        setAttendance(attendanceData || []);
      } else {
        setAttendance([]);
      }

    } catch (err) {
      console.error("Error loading calendar data:", err);
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  // Determine attendance status and metadata for a date cell
  const getDateStatus = (dateStr) => {
    const daySessions = sessions.filter(s => s.date === dateStr);
    if (daySessions.length === 0) return { type: 'empty', dateStr };

    const hasHoliday = daySessions.some(s => s.subject === 'holiday');
    if (hasHoliday) return { type: 'holiday', dateStr, sessions: daySessions };

    const daySessionIds = daySessions.map(s => s.id);
    const dayAttendance = attendance.filter(a => daySessionIds.includes(a.session_id));

    const presents = dayAttendance.filter(a => a.status === 'present');
    const lates = dayAttendance.filter(a => a.status === 'late');
    const absents = dayAttendance.filter(a => a.status === 'absent');

    // Deduplicate lists of students for visual detail overlay
    const seenP = new Set();
    const uniquePresents = presents
      .map(p => ({ name: p.students?.name, standard: p.students?.standard, id: p.student_id }))
      .filter(p => {
        if (!p.id || seenP.has(p.id)) return false;
        seenP.add(p.id);
        return true;
      });

    const seenL = new Set();
    const uniqueLates = lates
      .map(l => ({ name: l.students?.name, standard: l.students?.standard, id: l.student_id }))
      .filter(l => {
        if (!l.id || seenL.has(l.id)) return false;
        seenL.add(l.id);
        return true;
      });

    const seenA = new Set();
    const uniqueAbsents = absents
      .map(a => ({ name: a.students?.name, standard: a.students?.standard, id: a.student_id }))
      .filter(a => {
        if (!a.id || seenA.has(a.id)) return false;
        seenA.add(a.id);
        return true;
      });

    const presentCount = uniquePresents.length;
    const lateCount = uniqueLates.length;
    const absentCount = uniqueAbsents.length;

    // Present includes present + late (P + L)
    const overallPresentCount = presentCount + lateCount;
    const total = overallPresentCount + absentCount;

    return {
      type: 'session',
      dateStr,
      sessions: daySessions,
      presentCount: overallPresentCount, // X present
      absentCount: absentCount,          // Y absent
      total: total,                      // Z students
      presents: uniquePresents,
      lates: uniqueLates,
      absents: uniqueAbsents
    };
  };

  const getCellClassName = (status) => {
    const baseClass = "relative aspect-square border border-slate-200 transition select-none p-1 rounded-lg flex flex-col justify-between ";
    const colorClass = "bg-white text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer";
    return `${baseClass} ${colorClass}`;
  };

  // Generate grid cells
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);
  const cells = [];

  // Previous month filler days (empty grey cells)
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ isFiller: true, key: `filler-lead-${i}` });
  }

  // Active month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = getDateStatus(dateStr);
    cells.push({ isFiller: false, day, dateStr, status, key: dateStr });
  }

  // Trailing filler days of next month to complete rows of 7 cells
  const totalCellsCount = firstDayIndex + daysInMonth;
  const trailingFillerCount = (7 - (totalCellsCount % 7)) % 7;
  for (let i = 0; i < trailingFillerCount; i++) {
    cells.push({ isFiller: true, key: `filler-trail-${i}` });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const handleCellClick = (cell) => {
    if (cell.isFiller) return;
    setSelectedDateStr(cell.dateStr);
  };

  // Traversal to prev/next day
  const getOffsetDateStr = (dateStr, offset) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offset);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    const newD = String(date.getDate()).padStart(2, '0');
    return `${newY}-${newM}-${newD}`;
  };

  const handleNavigateDay = (offset) => {
    if (!selectedDateStr) return;
    const newDateStr = getOffsetDateStr(selectedDateStr, offset);
    
    // Parse month/year of newDateStr
    const [newY, newM] = newDateStr.split('-').map(Number);
    // currentDate month is 0-indexed, so newM - 1
    if (newY !== currentDate.getFullYear() || (newM - 1) !== currentDate.getMonth()) {
      setCurrentDate(new Date(newY, newM - 1, 1));
    }
    setSelectedDateStr(newDateStr);
  };

  // 1. DATE DETAIL SCREEN VIEW
  if (selectedDateStr) {
    const status = getDateStatus(selectedDateStr);
    const isHoliday = status.type === 'holiday';
    const isSession = status.type === 'session';
    
    const formattedDate = new Date(selectedDateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const subjectsList = isSession ? status.sessions.map(s => s.subject).join(', ') : '';

    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none p-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedDateStr(null)}
                className="p-1 hover:bg-slate-200 rounded-lg transition animate-click"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Date Detail</p>
                <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                  {formattedDate}
                </h2>
              </div>
            </div>

            {/* Traversal Arrows */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              <button
                onClick={() => handleNavigateDay(-1)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-all active:scale-90"
                title="Previous Date"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleNavigateDay(1)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700 transition-all active:scale-90"
                title="Next Date"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <RefreshCw className="w-8 h-8 text-indigo-650 animate-spin mb-2" />
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Loading details...</p>
              </div>
            ) : isHoliday ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none">
                <h3 className="text-lg font-black text-slate-750">Holiday</h3>
              </div>
            ) : isSession ? (
              <div className="flex flex-col gap-4 flex-1">
                {/* Subject at Top */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-850 font-bold shrink-0 uppercase tracking-wide">
                  Subject: {subjectsList}
                </div>

                {/* X present, Y absent out of Z students */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 tracking-wide text-center shrink-0">
                  {status.presentCount} present, {status.absentCount} absent out of {status.total} students
                </div>

                {/* Present List */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Present</h4>
                  <div className="flex flex-col gap-1.5">
                    {status.presents.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-1">No students present</p>
                    ) : (
                      status.presents.map((std, idx) => (
                        <div key={idx} className="border-l-4 border-green-500 pl-3 py-2 bg-slate-50 rounded-r-lg text-xs font-semibold text-slate-800">
                          {std.name} | {std.standard}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Late List */}
                {status.lates.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Late</h4>
                    <div className="flex flex-col gap-1.5">
                      {status.lates.map((std, idx) => (
                        <div key={idx} className="border-l-4 border-amber-500 pl-3 py-2 bg-slate-50 rounded-r-lg text-xs font-semibold text-slate-800">
                          {std.name} | {std.standard}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Absent List */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Absent</h4>
                  <div className="flex flex-col gap-1.5">
                    {status.absents.length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-1">No students absent</p>
                    ) : (
                      status.absents.map((std, idx) => (
                        <div key={idx} className="border-l-4 border-red-500 pl-3 py-2 bg-slate-50 rounded-r-lg text-xs font-semibold text-slate-800">
                          {std.name} | {std.standard}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none">
                <h3 className="text-lg font-black text-slate-750">No session recorded</h3>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN CALENDAR GRID MONTH VIEW
  return (
    <div className="h-[calc(100vh-56px)] flex flex-col justify-start overflow-hidden bg-white max-w-md mx-auto select-none p-0">
      
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('dashboard')}
            className="p-1 hover:bg-slate-200 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">ATTENDANCE SUMMARY</p>
            <h1 className="text-sm font-bold text-slate-800 mt-0.5">Attendance Calendar</h1>
          </div>
        </div>
        <button 
          onClick={loadMonthData}
          className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500"
          title="Refresh calendar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Month Navigation Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 shrink-0 flex items-center justify-between">
        <button 
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-655"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button 
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-655"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="m-4 bg-red-50 text-red-650 text-xs font-semibold p-3 border border-red-155 text-center rounded-xl shrink-0">
          {error}
        </div>
      )}

      {/* Calendar Grid Container (Fixed month layout, fits entirely without scroll) */}
      <div className="flex-1 flex flex-col justify-start px-4 py-3 shrink-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Loading Month Grid...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Weekdays row */}
            <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-405 uppercase tracking-wider text-center select-none mb-1">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell) => {
                if (cell.isFiller) {
                  return (
                    <div 
                      key={cell.key} 
                      className="aspect-square bg-slate-100 border border-slate-200 opacity-60 rounded-lg" 
                    />
                  );
                }
                const isToday = cell.dateStr === todayStr;
                return (
                  <button
                    key={cell.key}
                    onClick={() => handleCellClick(cell)}
                    className={getCellClassName(cell.status)}
                  >
                    <span className={`absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold pointer-events-none ${
                      isToday ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : ''
                    }`}>
                      {cell.day}
                    </span>
                    {cell.status.type === 'holiday' && (
                      <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[9px] font-bold text-slate-400 lowercase tracking-tighter pointer-events-none">
                        hol
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
