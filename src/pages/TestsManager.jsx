import React, { useState, useEffect } from 'react';
import { getStudents, logTest, getAllTests } from '../lib/db';
import { PlusCircle, Award, Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TestsManager({ params, navigate }) {
  // Determine if we should open the log test form directly from dashboard quick action
  const initialMode = params?.action === 'log' ? 'log' : 'history';
  
  const [activeTab, setActiveTab] = useState(initialMode); // 'history' | 'log'
  const [students, setStudents] = useState([]);
  const [recentTests, setRecentTests] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Log test form states
  const [testDetails, setTestDetails] = useState({
    date: new Date().toISOString().split('T')[0],
    subject: '',
    test_name: '',
    max_score: '50'
  });

  // Batch scores: { studentId: score }
  const [studentScores, setStudentScores] = useState({});
  const [filteredStudents, setFilteredStudents] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allStudents, allTests] = await Promise.all([
        getStudents(),
        getAllTests()
      ]);
      
      setStudents(allStudents);
      setRecentTests(allTests);
      setAvailableSubjects(['Maths', 'Science', 'Hindi', 'English', 'Social', 'Kannada']);
    } catch (err) {
      console.error("Error loading test data:", err);
      setError("Failed to fetch tests data from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update list of students when subject changes in log form
  useEffect(() => {
    if (testDetails.subject) {
      setFilteredStudents(students);

      // Reset scores
      const initialScores = {};
      students.forEach(s => {
        initialScores[s.id] = '';
      });
      setStudentScores(initialScores);
    } else {
      setFilteredStudents([]);
      setStudentScores({});
    }
  }, [testDetails.subject, students]);

  const handleScoreChange = (studentId, value) => {
    setStudentScores(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleLogTestSubmit = async (e) => {
    e.preventDefault();
    if (!testDetails.subject) {
      setError("Please select or enter a subject.");
      return;
    }
    if (!testDetails.test_name.trim()) {
      setError("Test name is required.");
      return;
    }

    const max = parseFloat(testDetails.max_score);
    if (isNaN(max) || max <= 0) {
      setError("Invalid maximum score.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create promises to log tests in parallel for students with entered scores
      const promises = [];
      filteredStudents.forEach(student => {
        const rawScore = studentScores[student.id];
        if (rawScore !== undefined && rawScore !== '') {
          const score = parseFloat(rawScore);
          if (!isNaN(score)) {
            promises.push(
              logTest({
                student_id: student.id,
                subject: testDetails.subject,
                test_name: testDetails.test_name.trim(),
                max_score: max,
                score: score,
                date: testDetails.date
              })
            );
          }
        }
      });

      if (promises.length === 0) {
        setError("Please enter a test score for at least one student.");
        setLoading(false);
        return;
      }

      await Promise.all(promises);
      
      // Refresh list, reset form
      const updatedTests = await getAllTests();
      setRecentTests(updatedTests);
      
      setTestDetails(prev => ({
        ...prev,
        test_name: '',
      }));
      setStudentScores({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setActiveTab('history');
    } catch (err) {
      console.error("Error saving test scores:", err);
      setError("Failed to save test scores.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && recentTests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading test records...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-800">Tests Center</h1>
        <div className="flex border border-slate-200 bg-slate-50 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'log' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Log Test
          </button>
        </div>
      </div>

      <div className="p-4">
        {success && (
          <div className="mb-4 bg-green-50 text-green-700 text-xs font-semibold p-3.5 rounded-xl border border-green-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            Test scores logged successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        {/* TAB 1: TEST HISTORY */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-3.5">Recent Tests Logged</h2>
            {recentTests.length === 0 ? (
              <div className="bg-white border border-slate-100 text-center py-12 rounded-2xl p-6 shadow-sm">
                <p className="text-slate-400 italic text-sm">No test scores recorded yet.</p>
                <button
                  onClick={() => setActiveTab('log')}
                  className="text-indigo-600 text-xs font-bold mt-2 hover:underline"
                >
                  Log your first test score
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentTests.map((t) => {
                  const pct = t.max_score > 0 ? Math.round((t.score / t.max_score) * 100) : 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => navigate('student-profile', { id: t.student_id })}
                      className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex justify-between items-center active:scale-[0.99]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-800 text-sm truncate">{t.students?.name}</p>
                          {t.students?.standard && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                              {t.students.standard}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">{t.test_name}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          <span>{t.subject}</span>
                          <span>•</span>
                          <span>{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-slate-800 text-base">{t.score} <span className="text-xs text-slate-400 font-medium">/ {t.max_score}</span></p>
                        <span className={`text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LOG TEST FORM */}
        {activeTab === 'log' && (
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-800 mb-4">Log Test Scores</h2>
            <form onSubmit={handleLogTestSubmit} className="flex flex-col gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Test Date
                </label>
                <input
                  type="date"
                  value={testDetails.date}
                  onChange={(e) => setTestDetails(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Subject
                </label>
                {availableSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {availableSubjects.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setTestDetails(prev => ({ ...prev, subject: sub }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          testDetails.subject === sub
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Or type subject name..."
                  value={testDetails.subject}
                  onChange={(e) => setTestDetails(prev => ({ ...prev, subject: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Test Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Test / Exam Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 1, Monthly Assessment"
                  value={testDetails.test_name}
                  onChange={(e) => setTestDetails(prev => ({ ...prev, test_name: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Max Score */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Maximum Marks (Max Score)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={testDetails.max_score}
                  onChange={(e) => setTestDetails(prev => ({ ...prev, max_score: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                />
              </div>

              {/* Student Scores Batch Entry */}
              {testDetails.subject && (
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                    Student Scores ({filteredStudents.length})
                  </h3>
                  
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {filteredStudents.map(student => (
                      <div key={student.id} className="flex justify-between items-center border-b border-slate-50 pb-2.5 last:border-0">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm">{student.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
                            {student.standard}
                          </span>
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={testDetails.max_score}
                            step="any"
                            placeholder="Score"
                            value={studentScores[student.id] || ''}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-xs text-slate-400">/ {testDetails.max_score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit scores button */}
              <button
                type="submit"
                disabled={loading || !testDetails.subject}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Save Test Scores</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
