import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Play, RefreshCw, AlertCircle, Users } from 'lucide-react';

export default function SessionsHistory({ navigate }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch sessions along with attendance counts
      const { data: sessionsData, error: sError } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false });

      if (sError) throw sError;

      // For each session, get attendance summary
      const { data: attendanceData, error: aError } = await supabase
        .from('attendance')
        .select('session_id, status');

      if (aError) throw aError;

      const sessionsWithStats = sessionsData.map(session => {
        const matchingAttendance = attendanceData.filter(a => a.session_id === session.id);
        const presentCount = matchingAttendance.filter(a => a.status === 'present').length;
        const absentCount = matchingAttendance.filter(a => a.status === 'absent').length;
        return {
          ...session,
          presentCount,
          absentCount
        };
      });

      setSessions(sessionsWithStats);
    } catch (err) {
      setError("Failed to fetch sessions history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading session logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
        <p className="text-slate-700 font-semibold mb-4">{error}</p>
        <button
          onClick={fetchSessions}
          className="bg-indigo-600 text-white py-2 px-6 rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sessions</h1>
          <p className="text-xs text-slate-500 font-medium">History of logged classes</p>
        </div>
        <button
          onClick={() => navigate('session-manager')}
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 text-xs font-bold active:scale-95 shadow-sm shadow-indigo-100"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>New Session</span>
        </button>
      </div>

      {/* History List */}
      {sessions.length === 0 ? (
        <div className="bg-white border border-slate-100 text-center py-12 rounded-2xl p-6 shadow-sm">
          <p className="text-slate-400 italic text-sm">No sessions recorded yet.</p>
          <button
            onClick={() => navigate('session-manager')}
            className="text-indigo-600 text-xs font-bold mt-2 hover:underline"
          >
            Start your first session now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">
                    {session.subject}
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm mt-1.5">
                    {session.topic_covered || 'General Tuition Class'}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase shrink-0">
                  {new Date(session.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Attendance metrics */}
              <div className="flex items-center gap-4 mt-2 border-t border-slate-50 pt-2.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Enrolled: {session.presentCount + session.absentCount}</span>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded">
                    {session.presentCount} Present
                  </span>
                  {session.absentCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded">
                      {session.absentCount} Absent
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
