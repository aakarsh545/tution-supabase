import React, { useState, useEffect } from 'react';
import { getStudentById, getAttendanceForStudent, getTestsForStudent, getBehaviourLogs, deleteStudent, logTest } from '../lib/db';
import { ArrowLeft, Edit, MessageCircle, Phone, Calendar, Award, RefreshCw, AlertCircle } from 'lucide-react';

export default function StudentProfile({ params, navigate }) {
  const studentId = params.id;
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  const [behaviourLogs, setBehaviourLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllAttendance, setShowAllAttendance] = useState(false);

  // States for logging a test score for this student only
  const [isLoggingTest, setIsLoggingTest] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formTestName, setFormTestName] = useState('');
  const [formMaxScore, setFormMaxScore] = useState('50');
  const [formScore, setFormScore] = useState('');
  const [formIsPresent, setFormIsPresent] = useState(true);
  const [submittingTest, setSubmittingTest] = useState(false);

  const loadProfileData = async () => {
    if (!studentId) return;
    try {
      setLoading(true);
      setError(null);
      
      const [studentData, attendanceData, testsData, behaviourData] = await Promise.all([
        getStudentById(studentId),
        getAttendanceForStudent(studentId),
        getTestsForStudent(studentId),
        getBehaviourLogs(studentId)
      ]);

      setStudent(studentData);
      setAttendance(attendanceData);
      setTests(testsData);
      setBehaviourLogs(behaviourData);
    } catch (err) {
      setError("Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [studentId]);

  const reloadTests = async () => {
    try {
      const testsData = await getTestsForStudent(studentId);
      setTests(testsData);
    } catch (err) {
    }
  };

  if (loading && !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center bg-white max-w-md mx-auto">
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

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove ${student.name}? This will permanently delete their record, attendance entries, and test scores.`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteStudent(studentId);
      navigate('students');
    } catch (err) {
      setError("Failed to delete student.");
      setLoading(false);
    }
  };

  const handleSaveSingleTest = async (e) => {
    e.preventDefault();
    if (!formSubject) {
      alert("Please select a subject.");
      return;
    }
    if (!formTestName.trim()) {
      alert("Please enter a test name.");
      return;
    }
    const max = parseFloat(formMaxScore);
    if (isNaN(max) || max <= 0) {
      alert("Please enter a valid maximum score.");
      return;
    }
    
    let score = null;
    if (formIsPresent) {
      if (formScore === '') {
        alert("Please enter a score.");
        return;
      }
      score = parseFloat(formScore);
      if (isNaN(score) || score < 0 || score > max) {
        alert(`Please enter a valid score (between 0 and ${max}).`);
        return;
      }
    }

    try {
      setSubmittingTest(true);
      await logTest({
        student_id: studentId,
        subject: formSubject,
        test_name: formTestName.trim(),
        max_score: max,
        score: score,
        date: new Date().toISOString().split('T')[0]
      });

      await reloadTests();
      setIsLoggingTest(false);
      
      // Reset form
      setFormSubject('');
      setFormTestName('');
      setFormMaxScore('50');
      setFormScore('');
      setFormIsPresent(true);
    } catch (err) {
      alert("Failed to save test score.");
    } finally {
      setSubmittingTest(false);
    }
  };

  // Calculate majority behavior
  const getMajorityBehaviour = () => {
    if (behaviourLogs.length === 0) return { label: 'No logs', color: 'bg-slate-100 text-slate-500' };
    
    let goodCount = 0;
    let badCount = 0;
    
    behaviourLogs.forEach(log => {
      if (log.status === 'good') goodCount++;
      if (log.status === 'bad') badCount++;
    });

    if (goodCount > badCount) {
      return { label: 'Majority: Good Behaviour', color: 'bg-green-100 text-green-800 border border-green-200' };
    } else if (badCount > goodCount) {
      return { label: 'Majority: Bad Behaviour', color: 'bg-red-100 text-red-850 border border-red-200' };
    } else if (goodCount > 0) {
      return { label: 'Neutral Behaviour', color: 'bg-amber-100 text-amber-800 border border-amber-200' };
    }
    return { label: 'No behaviour logs', color: 'bg-slate-100 text-slate-500' };
  };

  const behaviourTag = getMajorityBehaviour();
  const last5Attendance = attendance.slice(0, 5);

  if (isLoggingTest) {
    return (
      <div className="bg-white min-h-screen max-w-md mx-auto flex flex-col justify-between select-none">
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-4 flex items-center gap-3">
            <button 
              onClick={() => setIsLoggingTest(false)}
              className="p-1 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">LOG INDIVIDUAL TEST</p>
              <h1 className="text-sm font-bold text-slate-800 mt-0.5">Log Score for {student.name}</h1>
            </div>
          </div>

          <form onSubmit={handleSaveSingleTest} className="p-4 flex flex-col gap-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Subject
              </label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                required
                className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="">-- Choose Subject --</option>
                <option value="Maths">Maths</option>
                <option value="Science">Science</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Social">Social</option>
                <option value="Kannada">Kannada</option>
              </select>
            </div>

            {/* Test Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Test Name
              </label>
              <input
                type="text"
                placeholder="e.g. Unit Test 1"
                value={formTestName}
                onChange={(e) => setFormTestName(e.target.value)}
                required
                className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            {/* Max Score */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Maximum Score
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={formMaxScore}
                onChange={(e) => setFormMaxScore(e.target.value)}
                required
                className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 font-semibold text-center"
              />
            </div>

            {/* Took test check */}
            <div className="flex items-center gap-2.5 bg-slate-50 p-3.5 border border-slate-200 rounded-xl select-none mt-2">
              <input
                type="checkbox"
                id="formIsPresent"
                checked={formIsPresent}
                onChange={(e) => setFormIsPresent(e.target.checked)}
                className="w-4 h-4 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="formIsPresent" className="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-wider">
                Student took the test / attended
              </label>
            </div>

            {/* Score (conditional) */}
            {formIsPresent && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Score Achieved
                </label>
                <input
                  type="number"
                  placeholder="e.g. 42"
                  value={formScore}
                  onChange={(e) => setFormScore(e.target.value)}
                  required={formIsPresent}
                  className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 font-semibold text-center"
                />
              </div>
            )}
          </form>
        </div>

        {/* Buttons at bottom */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2 shrink-0">
          <button
            onClick={handleSaveSingleTest}
            disabled={submittingTest}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm uppercase tracking-wider active:scale-95 shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            {submittingTest && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Save score</span>
          </button>
          <button
            onClick={() => setIsLoggingTest(false)}
            disabled={submittingTest}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

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
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {student.standard && (
                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                    Standard {student.standard}
                  </span>
                )}
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${behaviourTag.color}`}>
                  {behaviourTag.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Fee Rate</span>
              <p className="text-lg font-extrabold text-slate-800">₹{student.fee_amount || 0}/mo</p>
            </div>
          </div>

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
                    className="p-2 bg-slate-100 text-slate-655 rounded-lg"
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
        </div>        {/* Attendance Entries (Clickable to show calendar) */}
        <div
          onClick={() => navigate('student-attendance-calendar', { id: student.id })}
          className="w-full text-left bg-white border border-slate-150 rounded-2xl p-4 shadow-sm block focus:outline-none transition hover:border-slate-350 cursor-pointer"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Attendance History</span>
            </h3>
            <span className="text-[10px] font-bold text-indigo-650 uppercase">
              View Calendar
            </span>
          </div>

          {attendance.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">No attendance logged yet.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[160px] overflow-hidden pr-1">
              {attendance.slice(0, 3).map((rec) => (
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
                      : rec.status === 'late'
                      ? 'bg-amber-50 text-amber-700 border border-amber-250'
                      : 'bg-red-50 text-red-700 border border-red-150'
                  }`}>
                    {rec.status}
                  </span>
                </div>
              ))}
              {attendance.length > 3 && (
                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider pt-1">
                  + {attendance.length - 3} more entries (Tap to view calendar)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Test Scores Section */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Award className="w-4 h-4 text-slate-400" />
              <span>Test Scores</span>
            </h3>
            <button
              onClick={() => setIsLoggingTest(true)}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 border border-indigo-150 transition-colors"
            >
              Log Test Score
            </button>
          </div>

          {tests.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-2">No test scores recorded.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {tests.slice().reverse().map((t) => {
                const pct = t.max_score > 0 ? Math.round((t.score / t.max_score) * 100) : 0;
                const isAbsent = t.score === null || t.score === undefined;
                return (
                  <div key={t.id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-slate-800 truncate">{t.test_name}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold uppercase mt-0.5">
                        <span className="text-indigo-650">{t.subject}</span>
                        <span>•</span>
                        <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {isAbsent ? (
                        <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-1.5 py-0.5 border border-red-150 rounded">Absent</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800">{t.score}/{t.max_score}</span>
                          <span className={`text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                            ({pct}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Remove Student Button */}
        <div className="mt-2 shrink-0">
          <button
            onClick={handleDelete}
            className="w-full bg-white border border-red-200 hover:bg-red-50 text-red-655 font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-xs"
          >
            <span>Remove Student</span>
          </button>
        </div>
      </div>
    </div>
  );
}
