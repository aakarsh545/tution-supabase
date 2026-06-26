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
  const [selectedDateDetail, setSelectedDateDetail] = useState(null); // { dateStr, status }

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
    setSelectedDateDetail(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDateDetail(null);
  };

  // Determine attendance status and color metadata for a date cell
  const getDateStatus = (dateStr) => {
    const daySessions = sessions.filter(s => s.date === dateStr);
    if (daySessions.length === 0) return { type: 'empty', dateStr };

    const hasHoliday = daySessions.some(s => s.subject === 'holiday');
    if (hasHoliday) return { type: 'holiday', dateStr, sessions: daySessions };

    const daySessionIds = daySessions.map(s => s.id);
    const dayAttendance = attendance.filter(a => daySessionIds.includes(a.session_id));

    if (dayAttendance.length === 0) return { type: 'empty', dateStr };

    const presents = dayAttendance.filter(a => a.status === 'present');
    const lates = dayAttendance.filter(a => a.status === 'late');
    const absents = dayAttendance.filter(a => a.status === 'absent');

    if (presents.length + lates.length + absents.length === 0) return { type: 'empty', dateStr };

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
    const total = presentCount + lateCount + absentCount;

    const overallPresentCount = presentCount + lateCount;

    if (overallPresentCount < absentCount) {
      return { 
        type: 'red', 
        dateStr, 
        presentCount, 
        lateCount,
        absentCount, 
        total, 
        sessions: daySessions, 
        presents: uniquePresents, 
        lates: uniqueLates,
        absents: uniqueAbsents 
      };
    } else if (overallPresentCount / total > 0.7) {
      return { 
        type: 'green', 
        dateStr, 
        presentCount, 
        lateCount,
        absentCount, 
        total, 
        sessions: daySessions, 
        presents: uniquePresents, 
        lates: uniqueLates,
        absents: uniqueAbsents 
      };
    } else {
      return { 
        type: 'yellow', 
        dateStr, 
        presentCount, 
        lateCount,
        absentCount, 
        total, 
        sessions: daySessions, 
        presents: uniquePresents, 
        lates: uniqueLates,
        absents: uniqueAbsents 
      };
    }
  };

  const getCellClassName = (status) => {
    const baseClass = "relative aspect-square border border-slate-200 transition select-none p-1 rounded-lg flex flex-col justify-between ";
    
    const colorClass = "bg-white text-slate-700";
    const cursorClass = status.type !== 'empty' 
      ? "cursor-pointer hover:bg-slate-50 active:scale-95" 
      : "cursor-default opacity-60";

    return `${baseClass} ${colorClass} ${cursorClass}`;
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
    if (cell.status.type === 'empty') return;
    setSelectedDateDetail(cell);
  };

  // Chronological traversal list for left/right arrows inside detail view
  const getSessionDatesList = () => {
    return Array.from(
      new Set(
        sessions
          .filter(s => {
            const dayAttendance = attendance.filter(a => a.session_id === s.id);
            return s.subject === 'holiday' || dayAttendance.length > 0;
          })
          .map(s => s.date)
      )
    ).sort();
  };

  const sessionDatesList = getSessionDatesList();

  const getPrevNextSessionDates = (currentDateStr) => {
    const idx = sessionDatesList.indexOf(currentDateStr);
    return {
      prevSessionDate: idx > 0 ? sessionDatesList[idx - 1] : null,
      nextSessionDate: idx < sessionDatesList.length - 1 ? sessionDatesList[idx + 1] : null
    };
  };

  // Detail view navigation handlers
  const handleGoToPrevSession = (prevDate) => {
    if (prevDate) {
      const status = getDateStatus(prevDate);
      setSelectedDateDetail({ dateStr: prevDate, status });
    }
  };

  const handleGoToNextSession = (nextDate) => {
    if (nextDate) {
      const status = getDateStatus(nextDate);
      setSelectedDateDetail({ dateStr: nextDate, status });
    }
  };

  // 1. DATE DETAIL SCREEN VIEW
  if (selectedDateDetail) {
    const { status, dateStr } = selectedDateDetail;
    const isHoliday = status.type === 'holiday';
    const subjectsList = !isHoliday ? status.sessions?.map(s => s.subject).join(', ') : '';

    const { prevSessionDate, nextSessionDate } = getPrevNextSessionDates(dateStr);

    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none p-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedDateDetail(null)}
                className="p-1 hover:bg-slate-200 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Date Detail</p>
                <h2 className="text-sm font-bold text-slate-800 mt-0.5">
                  {new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </h2>
              </div>
            </div>

            {/* Traversal Arrows */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              <button
                disabled={!prevSessionDate}
                onClick={() => handleGoToPrevSession(prevSessionDate)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700 disabled:opacity-20 transition-all"
                title="Previous Session Date"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                disabled={!nextSessionDate}
                onClick={() => handleGoToNextSession(nextSessionDate)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700 disabled:opacity-20 transition-all"
                title="Next Session Date"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!isHoliday && (
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 text-xs text-indigo-850 font-bold shrink-0 uppercase">
              Subject: {subjectsList}
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {isHoliday ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none">
                <Calendar className="w-12 h-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-black text-slate-750">Holiday ✓</h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">{new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1">
                {/* Present Section */}
                <div className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden max-h-[140px]">
                  <div className="bg-green-50 border-b border-green-200 px-3 py-1.5 text-left text-xs font-bold text-green-700 uppercase tracking-wide shrink-0">
                    Present ({status.presents?.length || 0})
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1 bg-white">
                    {(!status.presents || status.presents.length === 0) ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">None present</p>
                    ) : (
                      status.presents.map((std, idx) => (
                        <div key={idx} className="px-3 py-1.5 text-xs flex justify-between items-center">
                          <span className="font-semibold text-slate-800 truncate">{std.name}</span>
                          <span className="text-[10px] font-bold text-slate-450 uppercase shrink-0 ml-1">{std.standard}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Late Section */}
                <div className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden max-h-[140px]">
                  <div className="bg-amber-50 border-b border-amber-250 px-3 py-1.5 text-left text-xs font-bold text-amber-700 uppercase tracking-wide shrink-0">
                    Late ({status.lates?.length || 0})
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1 bg-white">
                    {(!status.lates || status.lates.length === 0) ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">None late</p>
                    ) : (
                      status.lates.map((std, idx) => (
                        <div key={idx} className="px-3 py-1.5 text-xs flex justify-between items-center">
                          <span className="font-semibold text-slate-800 truncate">{std.name}</span>
                          <span className="text-[10px] font-bold text-slate-450 uppercase shrink-0 ml-1">{std.standard}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Absent Section */}
                <div className="flex flex-col border border-slate-200 bg-white rounded-xl overflow-hidden max-h-[140px]">
                  <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 text-left text-xs font-bold text-red-700 uppercase tracking-wide shrink-0">
                    Absent ({status.absents?.length || 0})
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1 bg-white">
                    {(!status.absents || status.absents.length === 0) ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">None absent</p>
                    ) : (
                      status.absents.map((std, idx) => (
                        <div key={idx} className="px-3 py-1.5 text-xs flex justify-between items-center">
                          <span className="font-semibold text-slate-800 truncate">{std.name}</span>
                          <span className="text-[10px] font-bold text-slate-455 uppercase shrink-0 ml-1">{std.standard}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Summary / Done button */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex flex-col items-center justify-center">
          {!isHoliday && (
            <p className="text-xs text-slate-550 font-bold mb-3 uppercase tracking-wide">
              {status.presentCount} present, {status.lateCount} late, {status.absentCount} absent out of {status.total}
            </p>
          )}
          <button
            onClick={() => setSelectedDateDetail(null)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md"
          >
            Back to Calendar
          </button>
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
                const hasSession = cell.status.type !== 'empty';
                return (
                  <button
                    key={cell.key}
                    disabled={!hasSession}
                    onClick={() => handleCellClick(cell)}
                    className={getCellClassName(cell.status)}
                  >
                    <span className={`absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      isToday ? 'bg-indigo-600 text-white font-extrabold shadow-sm' : ''
                    }`}>
                      {cell.day}
                    </span>
                    {cell.status.type === 'holiday' ? (
                      <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[9px] font-bold text-slate-400 lowercase tracking-tighter">
                        hol
                      </span>
                    ) : cell.status.type === 'green' ? (
                      <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full" />
                    ) : cell.status.type === 'yellow' ? (
                      <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    ) : cell.status.type === 'red' ? (
                      <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Compact Legend */}
            <div className="border-t border-slate-100 mt-5 pt-3.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide justify-center select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span>Good (&gt;70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                <span>Low (&le;70%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                <span>Poor (Maj. Absent)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[9px] font-bold lowercase tracking-tighter">hol</span>
                <span>Holiday</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
