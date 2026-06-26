import React, { useState, useEffect } from 'react';
import { getStudentById, getAttendanceForStudent } from '../lib/db';
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Calendar, AlertCircle } from 'lucide-react';

export default function StudentAttendanceCalendar({ params, navigate }) {
  const studentId = params.id;
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Available navigation months state
  const [monthsList, setMonthsList] = useState([]);
  const [currentMonthIdx, setCurrentMonthIdx] = useState(-1);

  // Details popup state
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!studentId) return;
      try {
        setLoading(true);
        setError(null);

        const [studentData, attendanceData] = await Promise.all([
          getStudentById(studentId),
          getAttendanceForStudent(studentId)
        ]);

        setStudent(studentData);
        setAttendance(attendanceData || []);

        // Calculate months that have records, default to current month
        const records = attendanceData || [];
        const recordMonths = records.map(rec => {
          const d = new Date(rec.sessions?.date);
          return { year: d.getFullYear(), month: d.getMonth() };
        });

        const today = new Date();
        const currentMonthObj = { year: today.getFullYear(), month: today.getMonth() };

        // Ensure current month is in the navigation list
        const hasCurrentMonth = recordMonths.some(
          m => m.year === currentMonthObj.year && m.month === currentMonthObj.month
        );

        let list = [...recordMonths];
        if (!hasCurrentMonth) {
          list.push(currentMonthObj);
        }

        // Deduplicate
        const unique = [];
        const seenKeys = new Set();
        list.forEach(m => {
          const key = `${m.year}-${m.month}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            unique.push(m);
          }
        });

        // Sort chronologically
        unique.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
        setMonthsList(unique);

        // Set index to current month
        const initialIdx = unique.findIndex(
          m => m.year === currentMonthObj.year && m.month === currentMonthObj.month
        );
        setCurrentMonthIdx(initialIdx >= 0 ? initialIdx : unique.length - 1);

      } catch (err) {
        setError("Failed to load attendance records.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  if (loading && !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading calendar...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center bg-white max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
        <p className="text-slate-700 font-semibold mb-4">{error || "Student not found."}</p>
        <button
          onClick={() => navigate('student-profile', { id: studentId })}
          className="bg-indigo-600 text-white py-2 px-6 rounded-xl"
        >
          Back to Profile
        </button>
      </div>
    );
  }

  // Active month year and index
  const activeMonthObj = monthsList[currentMonthIdx] || { year: new Date().getFullYear(), month: new Date().getMonth() };
  const { year, month } = activeMonthObj;

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);
  
  // Create mapping of date string YYYY-MM-DD -> record
  const recordsMap = {};
  attendance.forEach(rec => {
    if (rec.sessions?.date) {
      recordsMap[rec.sessions.date] = {
        subject: rec.sessions.subject,
        status: rec.status,
        date: rec.sessions.date
      };
    }
  });

  const cells = [];
  // Filler lead days
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ isFiller: true, key: `filler-lead-${i}` });
  }
  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = recordsMap[dateStr];
    cells.push({ isFiller: false, day, dateStr, record, key: dateStr });
  }
  // Filler trail days to complete row
  const trailingFillerCount = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailingFillerCount; i++) {
    cells.push({ isFiller: true, key: `filler-trail-${i}` });
  }

  const handlePrev = () => {
    if (currentMonthIdx > 0) {
      setCurrentMonthIdx(currentMonthIdx - 1);
    }
  };

  const handleNext = () => {
    if (currentMonthIdx < monthsList.length - 1) {
      setCurrentMonthIdx(currentMonthIdx + 1);
    }
  };

  const getCellStyles = (record) => {
    const base = "relative aspect-square border border-slate-200 transition-all select-none p-1 rounded-lg flex items-center justify-center font-bold text-xs ";
    if (!record) {
      return base + "bg-white text-slate-400 cursor-default opacity-50";
    }
    if (record.status === 'present') {
      return base + "bg-green-500 text-white cursor-pointer active:scale-95 hover:bg-green-600";
    }
    if (record.status === 'absent') {
      return base + "bg-red-500 text-white cursor-pointer active:scale-95 hover:bg-red-600";
    }
    if (record.status === 'late') {
      return base + "bg-amber-500 text-white cursor-pointer active:scale-95 hover:bg-amber-600";
    }
    return base + "bg-white text-slate-700 cursor-default";
  };

  const activeDateDisplay = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col justify-start overflow-hidden bg-white max-w-md mx-auto select-none p-0">
      
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('student-profile', { id: studentId })}
            className="p-1 hover:bg-slate-200 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Attendance Calendar</p>
            <h1 className="text-sm font-bold text-slate-800 mt-0.5 truncate max-w-[200px]">{student.name}</h1>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 shrink-0 flex items-center justify-between">
        <button 
          onClick={handlePrev}
          disabled={currentMonthIdx <= 0}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-655 disabled:opacity-20 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {activeDateDisplay}
        </span>
        <button 
          onClick={handleNext}
          disabled={currentMonthIdx >= monthsList.length - 1}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-655 disabled:opacity-20 transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col justify-start px-4 py-4 shrink-0 overflow-hidden">
        <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-405 uppercase tracking-wider text-center select-none mb-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

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
            return (
              <button
                key={cell.key}
                disabled={!cell.record}
                onClick={() => setSelectedRecord(cell.record)}
                className={getCellStyles(cell.record)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="border-t border-slate-100 mt-6 pt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide justify-center select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-green-500 rounded"></span>
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded"></span>
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-500 rounded"></span>
            <span>Absent</span>
          </div>
        </div>
      </div>

      {/* Popup Overlay Modal */}
      {selectedRecord && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setSelectedRecord(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xl max-w-xs w-full text-center" 
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Attendance Record</p>
            <h3 className="text-base font-black text-slate-800 uppercase">{selectedRecord.subject}</h3>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              {new Date(selectedRecord.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <div className="mt-3">
              <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                selectedRecord.status === 'present' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : selectedRecord.status === 'late'
                  ? 'bg-amber-50 text-amber-700 border border-amber-250'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {selectedRecord.status}
              </span>
            </div>
            <button 
              onClick={() => setSelectedRecord(null)}
              className="w-full mt-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
