import React, { useState, useEffect } from 'react';
import { getStudentById, getAttendanceForStudent, getTestsForStudent } from '../lib/db';
import { ArrowLeft, Edit, MessageCircle, Phone, Calendar, Award, RefreshCw, AlertCircle } from 'lucide-react';

export default function StudentProfile({ params, navigate }) {
  const studentId = params.id;
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!studentId) return;
      try {
        setLoading(true);
        setError(null);
        
        const [studentData, attendanceData, testsData] = await Promise.all([
          getStudentById(studentId),
          getAttendanceForStudent(studentId),
          getTestsForStudent(studentId)
        ]);

        setStudent(studentData);
        setAttendance(attendanceData);
        setTests(testsData);
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile details.");
      } finally {
        setLoading(false);
      }
    };
    loadProfileData();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
        <p className="text-slate-700 font-semibold mb-4">{error || "Student not found."}</p>
        <button
          onClick={() => navigate('students')}
          className="bg-indigo-600 text-white py-2 px-6 rounded-xl"
        >
          Back to Students
        </button>
      </div>
    );
  }

  const getWhatsAppLink = (phone, name) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const message = encodeURIComponent(`Hello, this is regarding ${name}'s tuition classes.`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const last5Attendance = attendance.slice(0, 5);

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto select-none">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('students')}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-base font-bold text-slate-800">Student Profile</h1>
        </div>
        <button
          onClick={() => navigate('edit-student', { id: student.id })}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Core Details Hero Card */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{student.name}</h2>
              {student.standard && (
                <span className="inline-block px-2 py-0.5 mt-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                  Standard {student.standard}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Fee Rate</span>
              <p className="text-lg font-extrabold text-slate-800">₹{student.fee_amount || 0}/mo</p>
            </div>
          </div>

          {/* Subjects */}
          {student.subjects && student.subjects.length > 0 && (
            <div className="border-t border-slate-100 pt-3 mt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Subjects</p>
              <div className="flex flex-wrap gap-1">
                {student.subjects.map((sub, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Parent Details */}
          {(student.parent_name || student.parent_phone) && (
            <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Parent Contact</p>
                <p className="font-semibold text-slate-700 mt-0.5">{student.parent_name || 'N/A'}</p>
                <p className="text-slate-500 text-[11px]">{student.parent_phone || 'No phone number'}</p>
              </div>
              {student.parent_phone && (
                <div className="flex gap-1.5">
                  <a
                    href={`tel:${student.parent_phone}`}
                    className="p-2 bg-slate-100 text-slate-600 rounded-lg"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={getWhatsAppLink(student.parent_phone, student.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-green-500 text-white rounded-lg flex items-center justify-center shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendance (Last 5 Tries) */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Last 5 Attendance Entries</span>
          </h3>

          {last5Attendance.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">No attendance logged yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {last5Attendance.map((rec) => (
                <div key={rec.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-semibold text-slate-800">{rec.sessions?.subject}</span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      {new Date(rec.sessions?.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    rec.status === 'present' 
                      ? 'bg-green-50 text-green-700 border border-green-150' 
                      : 'bg-red-50 text-red-700 border border-red-150'
                  }`}>
                    {rec.status === 'present' ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tests Log inline */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-slate-400" />
            <span>Test Scores</span>
          </h3>

          {tests.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">No test scores recorded.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
              {tests.slice().reverse().map((t) => {
                const pct = t.max_score > 0 ? Math.round((t.score / t.max_score) * 100) : 0;
                return (
                  <div key={t.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-slate-800 leading-tight">{t.test_name}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{t.subject} • {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-700">{t.score} / {t.max_score}</span>
                      <span className={`ml-2 text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
