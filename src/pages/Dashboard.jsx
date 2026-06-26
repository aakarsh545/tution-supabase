import React, { useState, useEffect } from 'react';
import { getStudents, getMonthlyFees } from '../lib/db';
import { RefreshCw, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: null, // null shows '—'
    absentToday: null,  // null shows '—'
    pendingFees: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        .select('id')
        .eq('date', todayStr);
      
      if (sessErr) throw sessErr;

      let presentToday = null;
      let absentToday = null;

      if (sessionsToday && sessionsToday.length > 0) {
        const sessionIds = sessionsToday.map(s => s.id);
        const { data: attendanceData, error: attErr } = await supabase
          .from('attendance')
          .select('status')
          .in('session_id', sessionIds);
        
        if (attErr) throw attErr;

        if (attendanceData) {
          presentToday = attendanceData.filter(r => r.status === 'present').length;
          absentToday = attendanceData.filter(r => r.status === 'absent').length;
        } else {
          presentToday = 0;
          absentToday = 0;
        }
      }

      // 3. Fetch pending fees for current month
      const currentMonth = getCurrentMonthString();
      const monthlyFeesList = await getMonthlyFees(currentMonth);
      
      let pendingFees = 0;
      studentsList.forEach(student => {
        const feeRecord = monthlyFeesList.find(f => f.student_id === student.id);
        if (!feeRecord || feeRecord.status === 'unpaid') {
          pendingFees++;
        }
      });

      setStats({
        totalStudents,
        presentToday,
        absentToday,
        pendingFees
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none p-4">
      {/* Header */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shrink-0 flex justify-between items-center mb-4">
        <div className="text-left">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TUITION PORTAL</p>
          <h2 className="text-sm font-bold text-slate-800 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h2>
        </div>
        <button 
          onClick={loadDashboardData}
          className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-indigo-600"
          title="Refresh statistics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-650 text-xs font-semibold p-3.5 border border-red-100 text-center rounded-xl mb-4 shrink-0">
          {error}
        </div>
      )}

      {/* 4 Stat Cards in 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3 my-auto max-h-[360px] shrink-0">
        {/* Total Students Card */}
        <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl">
          <div>
            <Users className="w-5 h-5 text-indigo-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Students</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{stats.totalStudents}</h2>
        </div>

        {/* Present Today Card */}
        <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl">
          <div>
            <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present Today</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">
            {stats.presentToday !== null ? stats.presentToday : '—'}
          </h2>
        </div>

        {/* Absent Today Card */}
        <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl">
          <div>
            <XCircle className="w-5 h-5 text-red-600 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent Today</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">
            {stats.absentToday !== null ? stats.absentToday : '—'}
          </h2>
        </div>

        {/* Pending Fees Card */}
        <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between rounded-xl">
          <div>
            <AlertCircle className="w-5 h-5 text-amber-500 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Fees</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{stats.pendingFees}</h2>
        </div>
      </div>

      {/* Action Button at the Bottom */}
      <button
        onClick={() => navigate('today')}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 transition flex items-center justify-center gap-2 shrink-0 text-sm uppercase tracking-wider mt-4"
      >
        <span>Start Session →</span>
      </button>
    </div>
  );
}
