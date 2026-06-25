import React, { useState, useEffect } from 'react';
import { 
  getStudentById, 
  getAttendanceForStudent, 
  getTestsForStudent, 
  getFeesForStudent, 
  getNotesForStudent, 
  addNoteForStudent 
} from '../lib/db';
import { 
  ArrowLeft, Edit, MessageCircle, Phone, Calendar, 
  Award, IndianRupee, FileText, Send, RefreshCw, AlertCircle, Trash2 
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

export default function StudentProfile({ params, navigate }) {
  const studentId = params.id;
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  const [fees, setFees] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance');
  
  // Loading & states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Note input state
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Subject selector for tests chart
  const [selectedSubjectChart, setSelectedSubjectChart] = useState('All');

  const loadProfileData = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      
      // Load all details in parallel
      const [
        studentData, 
        attendanceData, 
        testsData, 
        feesData, 
        notesData
      ] = await Promise.all([
        getStudentById(studentId),
        getAttendanceForStudent(studentId),
        getTestsForStudent(studentId),
        getFeesForStudent(studentId),
        getNotesForStudent(studentId)
      ]);

      setStudent(studentData);
      setAttendance(attendanceData);
      setTests(testsData);
      setFees(feesData);
      setNotes(notesData);

      // Pre-select first available subject for tests chart
      if (testsData.length > 0) {
        const uniqueSubjects = [...new Set(testsData.map(t => t.subject))];
        if (uniqueSubjects.length > 0) {
          setSelectedSubjectChart(uniqueSubjects[0]);
        }
      }
    } catch (err) {
      console.error("Error loading student profile:", err);
      setError("Failed to load student profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [studentId]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    try {
      setSubmittingNote(true);
      const added = await addNoteForStudent(studentId, newNote.trim());
      setNotes(prev => [added, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Failed to save note.");
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading profile...</p>
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
          className="bg-indigo-600 text-white py-2 px-6 rounded-xl hover:bg-indigo-700 transition"
        >
          Back to Students
        </button>
      </div>
    );
  }

  // Format parent phone number to wa.me structure
  // Ensures country code is prepended
  const getWhatsAppLink = (phone, name) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, ''); // keep only numbers
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Default to India country code
    }
    const message = encodeURIComponent(`Hello, this is regarding ${name}'s tuition classes.`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  // Recharts score over time calculations
  const getChartData = () => {
    const filteredTests = tests.filter(t => t.subject === selectedSubjectChart);
    return filteredTests.map(t => {
      const percentage = t.max_score > 0 ? Math.round((t.score / t.max_score) * 100) : 0;
      return {
        date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        score: t.score,
        maxScore: t.max_score,
        percentage,
        name: t.test_name
      };
    });
  };

  const testSubjects = [...new Set(tests.map(t => t.subject))];
  const chartData = getChartData();

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto">
      {/* Profile Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('students')}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Student Profile</h1>
        </div>
        <button
          onClick={() => navigate('edit-student', { id: student.id })}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      {/* Hero card details */}
      <div className="p-4">
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight">{student.name}</h2>
              {student.standard && (
                <span className="inline-block px-2.5 py-0.5 mt-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md uppercase tracking-wider">
                  Standard {student.standard}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-semibold uppercase">Fee Rate</span>
              <p className="text-xl font-extrabold text-slate-800">₹{student.fee_amount || 0}/mo</p>
            </div>
          </div>

          {/* Subjects */}
          {student.subjects && student.subjects.length > 0 && (
            <div className="border-t border-slate-100 pt-3 mt-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Enrolled Subjects</p>
              <div className="flex flex-wrap gap-1.5">
                {student.subjects.map((sub, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Parent details */}
          {(student.parent_name || student.parent_phone) && (
            <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Parent / Contact</p>
                <p className="font-semibold text-slate-700 text-sm mt-0.5">{student.parent_name || 'N/A'}</p>
                <p className="text-xs text-slate-500">{student.parent_phone || 'No phone number'}</p>
              </div>
              {student.parent_phone && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${student.parent_phone}`}
                    className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition"
                    title="Call Parent"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={getWhatsAppLink(student.parent_phone, student.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition flex items-center justify-center shadow-sm shadow-green-100"
                    title="Chat via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 mb-4 shadow-sm">
          {[
            { id: 'attendance', label: 'Attendance', icon: Calendar },
            { id: 'tests', label: 'Tests', icon: Award },
            { id: 'fees', label: 'Fees', icon: IndianRupee },
            { id: 'notes', label: 'Notes', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm min-h-[300px]">
          {/* 1. Attendance Tab */}
          {activeTab === 'attendance' && (
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-3">Attendance History</h3>
              {attendance.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm italic">No attendance records found.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {attendance.map((rec) => (
                    <div key={rec.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{rec.sessions?.subject || 'Class'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(rec.sessions?.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {rec.sessions?.topic_covered && (
                          <p className="text-xs text-slate-600 italic mt-0.5">Topic: {rec.sessions.topic_covered}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        rec.status === 'present' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {rec.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Tests Tab */}
          {activeTab === 'tests' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Test Scores</h3>
                {testSubjects.length > 0 && (
                  <select
                    value={selectedSubjectChart}
                    onChange={(e) => setSelectedSubjectChart(e.target.value)}
                    className="border border-slate-200 text-xs rounded-lg p-1.5 focus:outline-none"
                  >
                    {testSubjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                )}
              </div>

              {tests.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm italic">No test scores recorded.</div>
              ) : (
                <div>
                  {/* Recharts Chart for Selected Subject */}
                  {chartData.length > 0 && (
                    <div className="w-full h-48 mb-6 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                          <Tooltip 
                            contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            formatter={(value, name) => [`${value}%`, 'Score']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="#4f46e5" 
                            strokeWidth={2.5}
                            activeDot={{ r: 6 }} 
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                        Progress chart for {selectedSubjectChart} (%)
                      </p>
                    </div>
                  )}

                  {/* Test Scores List */}
                  <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                    {tests.slice().reverse().map((t) => {
                      const pct = t.max_score > 0 ? Math.round((t.score / t.max_score) * 100) : 0;
                      return (
                        <div key={t.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{t.test_name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">{t.subject}</p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-700 text-sm">{t.score} / {t.max_score}</span>
                            <p className={`text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                              {pct}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Fees Tab */}
          {activeTab === 'fees' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-sm">Fee Payments</h3>
                <button
                  onClick={() => navigate('fees')}
                  className="bg-indigo-50 text-indigo-600 text-xs font-bold py-1 px-2.5 rounded-lg hover:bg-indigo-100 transition"
                >
                  Log Fee
                </button>
              </div>

              {fees.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm italic">No fee history found.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {fees.map((f) => (
                    <div key={f.id} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{f.month}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Paid: ₹{f.amount_paid} / Due: ₹{f.amount_due}
                        </p>
                        {f.paid_on && (
                          <p className="text-[10px] text-slate-400 italic">Paid on: {new Date(f.paid_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        f.status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : f.status === 'partial' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-3">Add / View Notes</h3>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a quick note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  disabled={submittingNote}
                />
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shrink-0 flex items-center justify-center shadow-md shadow-indigo-100"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Notes List */}
              {notes.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm italic">No notes added.</div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div key={n.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                      <p className="text-xs text-slate-700 font-medium leading-normal">{n.note}</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
