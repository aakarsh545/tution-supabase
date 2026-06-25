import React, { useState, useEffect } from 'react';
import { getStudents, getSessionsToday, getMonthlyFees, seedStudents } from '../lib/db';
import { Users, Calendar, AlertCircle, PlusCircle, ArrowRight, RefreshCw } from 'lucide-react';

const SAMPLE_STUDENTS = [
  {
    name: "Rahul Shetty",
    standard: "9th",
    subjects: ["Science", "Kannada", "Maths", "Hindi", "Social", "English"],
    parent_name: "Suresh Shetty",
    parent_phone: "+919876543210",
    fee_amount: 1500
  },
  {
    name: "Priya Nair",
    standard: "10th",
    subjects: ["Social", "English", "Hindi", "Maths", "Science", "Kannada"],
    parent_name: "Ramesh Nair",
    parent_phone: "+919876543211",
    fee_amount: 1500
  },
  {
    name: "Arjun Bhat",
    standard: "8th",
    subjects: ["Science", "Kannada", "Maths", "Hindi", "Social", "English"],
    parent_name: "Mohan Bhat",
    parent_phone: "+919876543212",
    fee_amount: 1200
  },
  {
    name: "Sneha Rao",
    standard: "10th",
    subjects: ["Social", "English", "Hindi", "Maths", "Science", "Kannada"],
    parent_name: "Venkat Rao",
    parent_phone: "+919876543213",
    fee_amount: 1500
  },
  {
    name: "Kiran Kamath",
    standard: "9th",
    subjects: ["Science", "Kannada", "Maths", "Hindi", "Social", "English"],
    parent_name: "Dinesh Kamath",
    parent_phone: "+919876543214",
    fee_amount: 1500
  }
];

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    sessionLoggedToday: false,
    pendingFeesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const getCurrentMonthString = () => {
    const d = new Date();
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch students, today's sessions, and current month's fees
      const studentsList = await getStudents();
      const sessionsTodayList = await getSessionsToday();
      const currentMonth = getCurrentMonthString();
      const monthlyFeesList = await getMonthlyFees(currentMonth);

      // Calculate stats
      const totalStudents = studentsList.length;
      const sessionLoggedToday = sessionsTodayList.length > 0;

      // Pending fees: students who have not fully paid for the current month.
      // A student is pending if their monthly fee record is missing, 'unpaid', or 'partial'.
      let pendingCount = 0;
      studentsList.forEach(student => {
        const feeRecord = monthlyFeesList.find(f => f.student_id === student.id);
        if (!feeRecord || feeRecord.status === 'unpaid' || feeRecord.status === 'partial') {
          pendingCount++;
        }
      });

      setStats({
        totalStudents,
        sessionLoggedToday,
        pendingFeesCount: pendingCount,
      });
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Failed to fetch dashboard data. Please check your Supabase connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTestData = async () => {
    try {
      setSeedLoading(true);
      setError(null);
      await seedStudents(SAMPLE_STUDENTS);
      setSeedSuccess(true);
      await loadDashboardData();
    } catch (err) {
      console.error("Error seeding test data:", err);
      setError("Failed to load test data.");
    } finally {
      setSeedLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading dashboard stats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <div className="bg-red-50 p-3 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Error Connecting to DB</h3>
        <p className="text-slate-600 text-sm max-w-xs mb-6">{error}</p>
        <button
          onClick={loadDashboardData}
          className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-indigo-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TUITION PORTAL</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        {/* Load Test Data Button */}
        {!seedSuccess ? (
          <button
            onClick={handleLoadTestData}
            disabled={seedLoading}
            className="text-[10px] bg-slate-100 text-slate-500 font-semibold py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-200 transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            {seedLoading ? 'Loading...' : 'Load Test Data'}
          </button>
        ) : (
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 py-1.5 px-3 rounded-lg shrink-0 animate-pulse">
            Test data loaded ✓
          </span>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        {/* Total Students Card */}
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-sm font-semibold text-indigo-800/80 uppercase">Total Students</span>
            <h2 className="text-4xl font-extrabold text-indigo-950 mt-1">{stats.totalStudents}</h2>
          </div>
          <div className="bg-indigo-600 text-white p-3 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Session Status */}
        <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-sm transition ${
          stats.sessionLoggedToday 
            ? 'bg-emerald-50/50 border-emerald-100' 
            : 'bg-amber-50/50 border-amber-100'
        }`}>
          <div>
            <span className={`text-sm font-semibold uppercase ${stats.sessionLoggedToday ? 'text-emerald-800' : 'text-amber-800'}`}>
              Today's Session
            </span>
            <h2 className={`text-lg font-bold mt-1 ${stats.sessionLoggedToday ? 'text-emerald-950' : 'text-amber-950'}`}>
              {stats.sessionLoggedToday ? 'Logged' : 'Pending Log'}
            </h2>
          </div>
          <div className={`p-3 rounded-xl text-white ${stats.sessionLoggedToday ? 'bg-emerald-600' : 'bg-amber-500'}`}>
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Fees Count */}
        <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-sm ${
          stats.pendingFeesCount > 0 
            ? 'bg-red-50/40 border-red-100' 
            : 'bg-slate-50 border-slate-100'
        }`}>
          <div>
            <span className={`text-sm font-semibold uppercase ${stats.pendingFeesCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
              Pending Fees ({getCurrentMonthString().split(' ')[0]})
            </span>
            <h2 className={`text-4xl font-extrabold mt-1 ${stats.pendingFeesCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {stats.pendingFeesCount}
            </h2>
          </div>
          <div className={`p-3 rounded-xl text-white ${stats.pendingFeesCount > 0 ? 'bg-red-500' : 'bg-slate-400'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div>
        <h3 className="text-lg font-bold text-slate-700 mb-4 px-1">Quick Actions</h3>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('session-manager')}
            className="flex items-center justify-between bg-indigo-600 text-white font-semibold p-4 rounded-xl hover:bg-indigo-700 transition shadow-md shadow-indigo-100 active:scale-95"
          >
            <span className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              Start Session / Log Attendance
            </span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigate('add-student')}
            className="flex items-center justify-between bg-white text-slate-700 border border-slate-200 font-semibold p-4 rounded-xl hover:bg-slate-50 transition active:scale-95 shadow-sm"
          >
            <span className="flex items-center gap-3">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Add Student Profile
            </span>
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            onClick={() => navigate('tests', { action: 'log' })}
            className="flex items-center justify-between bg-white text-slate-700 border border-slate-200 font-semibold p-4 rounded-xl hover:bg-slate-50 transition active:scale-95 shadow-sm"
          >
            <span className="flex items-center gap-3">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Log Test Scores
            </span>
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
