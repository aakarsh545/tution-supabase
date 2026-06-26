import React, { useState, useEffect } from 'react';
import { getStudents, getMonthlyFees } from '../lib/db';
import { RefreshCw, Users, CheckCircle, XCircle, AlertCircle, ArrowLeft, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: null,
    absentToday: null,
    pendingFees: 0,
    presentList: [],
    absentList: [],
    unpaidList: [],
    isHoliday: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldownType, setDrilldownType] = useState(null); // null | 'present' | 'absent' | 'unpaid'

  const getCurrentMonthString = () => {
    const d = new Date();
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch total students
      const studentsList = await getStudents();
      const totalStudents = studentsList.length;

      // 2. Fetch today's sessions and attendance
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: sessionsToday, error: sessErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('date', todayStr);
      
      if (sessErr) throw sessErr;

      let presentToday = null;
      let absentToday = null;
      let presentList = [];
      let absentList = [];
      let isHoliday = false;

      if (sessionsToday && sessionsToday.length > 0) {
        // Check if today was marked as a holiday
        isHoliday = sessionsToday.some(s => s.subject === 'holiday');

        if (!isHoliday) {
          const sessionIds = sessionsToday.map(s => s.id);
          const { data: attendanceData, error: attErr } = await supabase
            .from('attendance')
            .select('status, student_id, students(name, standard)')
            .in('session_id', sessionIds);
          
          if (attErr) throw attErr;

          if (attendanceData && attendanceData.length > 0) {
            const presents = attendanceData.filter(r => r.status === 'present');
            const absents = attendanceData.filter(r => r.status === 'absent');
            
            presentToday = presents.length;
            absentToday = absents.length;

            // Build unique lists of students marked present/absent today
            const seenP = new Set();
            presentList = presents
              .map(r => ({ id: r.student_id, name: r.students?.name, standard: r.students?.standard }))
              .filter(item => {
                if (seenP.has(item.id)) return false;
                seenP.add(item.id);
                return true;
              });

            const seenA = new Set();
            absentList = absents
              .map(r => ({ id: r.student_id, name: r.students?.name, standard: r.students?.standard }))
              .filter(item => {
                if (seenA.has(item.id)) return false;
                seenA.add(item.id);
                return true;
              });
          }
        }
      }

      // 3. Fetch pending fees for current month
      const currentMonth = getCurrentMonthString();
      const monthlyFeesList = await getMonthlyFees(currentMonth);
      
      let pendingFees = 0;
      const unpaidList = [];
      studentsList.forEach(student => {
        const feeRecord = monthlyFeesList.find(f => f.student_id === student.id);
        if (!feeRecord || feeRecord.status === 'unpaid') {
          pendingFees++;
          unpaidList.push({ id: student.id, name: student.name, standard: student.standard });
        }
      });

      setStats({
        totalStudents,
        presentToday,
        absentToday,
        pendingFees,
        presentList,
        absentList,
        unpaidList,
        isHoliday
      });
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleMarkHoliday = async () => {
    const confirm = window.confirm("Mark today as a holiday?");
    if (!confirm) return;

    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('sessions')
        .insert([{ subject: 'holiday', date: todayStr }]);
      
      if (error) throw error;
      await loadDashboardData();
    } catch (err) {
      console.error("Error marking holiday:", err);
      setError("Failed to mark holiday.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  // Drilldown View rendering
  if (drilldownType) {
    let title = "";
    let list = [];
    if (drilldownType === 'present') {
      title = "Present Today";
      list = stats.presentList;
    } else if (drilldownType === 'absent') {
      title = "Absent Today";
      list = stats.absentList;
    } else if (drilldownType === 'unpaid') {
      title = "Pending Fees List";
      list = stats.unpaidList;
    }

    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none p-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 flex items-center gap-3 px-4 py-3 shrink-0">
            <button 
              onClick={() => setDrilldownType(null)}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Dashboard Drill-down
              </h1>
              <p className="text-sm font-bold text-slate-800">
                {title} ({list.length})
              </p>
            </div>
          </div>

          {/* Simple List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {list.length === 0 ? (
              <p className="p-6 text-center text-slate-400 italic text-sm">No students in this list.</p>
            ) : (
              list.map((student) => (
                <div 
                  key={student.id} 
                  className="px-4 py-3 flex justify-between items-center bg-white text-sm"
                >
                  <span className="font-semibold text-slate-800">
                    {student.name}
                  </span>
                  <span className="text-xs text-slate-500 font-bold uppercase">
                    {student.standard} Std
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const isSessionLoggedToday = stats.presentToday !== null || stats.absentToday !== null;
  const isHolidayToday = stats.isHoliday;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none p-4">
      {/* Header */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shrink-0 flex justify-between items-center mb-4">
        <div className="text-left">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TUITION PORTAL</p>
          <h2 className="text-sm font-bold text-slate-800 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => navigate('calendar')}
            className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-indigo-650 flex items-center justify-center"
            title="View Attendance Calendar"
          >
            <Calendar className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={loadDashboardData}
            className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-indigo-600 flex items-center justify-center"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-650 text-xs font-semibold p-3.5 border border-red-100 text-center rounded-xl mb-4 shrink-0">
          {error}
        </div>
      )}

      {/* 4 Stat Cards in 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 my-auto max-h-[360px] shrink-0">
        {/* Total Students Card */}
        <button
          onClick={() => navigate('students')}
          className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl text-left hover:border-slate-350 transition active:scale-[0.98]"
        >
          <div>
            <Users className="w-5 h-5 text-indigo-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Students</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{stats.totalStudents}</h2>
        </button>

        {/* Present Today Card */}
        <button
          onClick={() => isSessionLoggedToday && !isHolidayToday && setDrilldownType('present')}
          disabled={!isSessionLoggedToday || isHolidayToday}
          className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl text-left hover:border-slate-350 transition active:scale-[0.98] disabled:active:scale-100 disabled:opacity-90"
        >
          <div>
            <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present Today</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">
            {isHolidayToday ? '—' : (stats.presentToday !== null ? stats.presentToday : '—')}
          </h2>
        </button>

        {/* Absent Today Card */}
        <button
          onClick={() => isSessionLoggedToday && !isHolidayToday && setDrilldownType('absent')}
          disabled={!isSessionLoggedToday || isHolidayToday}
          className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl text-left hover:border-slate-350 transition active:scale-[0.98] disabled:active:scale-100 disabled:opacity-90"
        >
          <div>
            <XCircle className="w-5 h-5 text-red-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent Today</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">
            {isHolidayToday ? '—' : (stats.absentToday !== null ? stats.absentToday : '—')}
          </h2>
        </button>

        {/* Pending Fees Card */}
        <button
          onClick={() => setDrilldownType('unpaid')}
          className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl text-left hover:border-slate-350 transition active:scale-[0.98]"
        >
          <div>
            <AlertCircle className="w-5 h-5 text-amber-500 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Fees</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{stats.pendingFees}</h2>
        </button>
      </div>

      {/* Action Buttons at the Bottom */}
      {isHolidayToday ? (
        <div className="w-full bg-slate-100 text-slate-500 font-bold py-4 text-center text-sm uppercase tracking-wider select-none shrink-0 border border-slate-200 mt-4 rounded-xl">
          Holiday marked ✓
        </div>
      ) : isSessionLoggedToday ? (
        <div className="w-full bg-slate-100 text-slate-500 font-bold py-4 text-center text-sm uppercase tracking-wider select-none shrink-0 border border-slate-200 mt-4 rounded-xl">
          Session logged ✓
        </div>
      ) : (
        <div className="flex gap-3 mt-4 shrink-0 w-full">
          <button
            onClick={() => navigate('today')}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wider rounded-xl active:scale-95"
          >
            <span>Start Session →</span>
          </button>
          <button
            onClick={handleMarkHoliday}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-5 transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider rounded-xl border border-slate-200 active:scale-95"
          >
            <span>Mark Holiday</span>
          </button>
        </div>
      )}
    </div>
  );
}
