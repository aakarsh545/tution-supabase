import React, { useState, useEffect } from 'react';
import { getStudents, logTest, getAllTests } from '../lib/db';
import { ArrowLeft, Award, Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TestsManager({ params, navigate }) {
  const [viewMode, setViewMode] = useState('form'); // 'form' | 'summary' | 'detail'
  
  const [students, setStudents] = useState([]);
  const [recentTests, setRecentTests] = useState([]);
  
  // Checklist form states
  const [testDetails, setTestDetails] = useState({
    subject: '',
    test_name: '',
    max_score: '50',
    date: new Date().toISOString().split('T')[0] // auto-set to today
  });

  // State mapping student_id to checked boolean (attended/took the test)
  const [checkedStudents, setCheckedStudents] = useState({});
  // State mapping student_id to score string
  const [studentScores, setStudentScores] = useState({});

  // Breakdown/Detail and Summary states
  const [selectedTest, setSelectedTest] = useState(null);
  const [savedSummary, setSavedSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    } catch (err) {
      setError("Failed to fetch test data from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Initialize checklist state when students are loaded
  useEffect(() => {
    if (students.length > 0) {
      const initialChecked = {};
      const initialScores = {};
      students.forEach(s => {
        initialChecked[s.id] = true;
        initialScores[s.id] = '';
      });
      setCheckedStudents(initialChecked);
      setStudentScores(initialScores);
    }
  }, [students]);

  const handleScoreChange = (studentId, value) => {
    setStudentScores(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  // Helper to group flat test records by test_name, subject, and date
  const getGroupedTests = (allRecords) => {
    const groups = {};
    allRecords.forEach(rec => {
      const key = `${rec.test_name.trim()}||${rec.subject.trim()}||${rec.date}`;
      if (!groups[key]) {
        groups[key] = {
          test_name: rec.test_name,
          subject: rec.subject,
          date: rec.date,
          max_score: rec.max_score,
          records: []
        };
      }
      groups[key].records.push(rec);
    });

    return Object.values(groups).map(group => {
      const validScores = group.records.filter(r => r.score !== null && r.score !== undefined);
      const sum = validScores.reduce((acc, r) => acc + Number(r.score), 0);
      const avgScore = validScores.length > 0 ? (sum / validScores.length) : 0;
      
      return {
        ...group,
        avgScore: parseFloat(avgScore.toFixed(1)),
        totalStudents: group.records.length,
        attendedStudents: validScores.length
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleSaveTest = async () => {
    if (!testDetails.subject) {
      alert("Please select a subject.");
      return;
    }
    if (!testDetails.test_name.trim()) {
      alert("Please enter a test name.");
      return;
    }
    const max = parseFloat(testDetails.max_score);
    if (isNaN(max) || max <= 0) {
      alert("Please enter a valid maximum score.");
      return;
    }

    // Build the insert payload
    const recordsToInsert = [];
    let validationFailed = false;

    for (const student of students) {
      const isChecked = checkedStudents[student.id] !== false; // default true
      const rawScore = studentScores[student.id];

      let score = null;
      if (isChecked) {
        if (rawScore === undefined || rawScore === '') {
          alert(`Please enter a score for ${student.name}.`);
          validationFailed = true;
          break;
        }
        score = parseFloat(rawScore);
        if (isNaN(score) || score < 0 || score > max) {
          alert(`Please enter a valid score (between 0 and ${max}) for ${student.name}.`);
          validationFailed = true;
          break;
        }
      }

      recordsToInsert.push({
        student_id: student.id,
        subject: testDetails.subject,
        test_name: testDetails.test_name.trim(),
        max_score: max,
        score: score,
        date: testDetails.date,
        students: {
          name: student.name,
          standard: student.standard
        }
      });
    }

    if (validationFailed) return;

    try {
      setSaving(true);
      setError(null);

      // Save records in parallel
      const insertPromises = recordsToInsert.map(rec => {
        const { students, ...payload } = rec;
        return logTest(payload);
      });

      await Promise.all(insertPromises);

      // Calculate class average
      const validScores = recordsToInsert.filter(r => r.score !== null);
      const sum = validScores.reduce((acc, r) => acc + r.score, 0);
      const avgScore = validScores.length > 0 ? parseFloat((sum / validScores.length).toFixed(1)) : 0;

      // Prepare summary structure
      const newSummary = {
        test_name: testDetails.test_name.trim(),
        subject: testDetails.subject,
        date: testDetails.date,
        max_score: max,
        avgScore: avgScore,
        records: recordsToInsert
      };

      setSavedSummary(newSummary);

      // Fetch fresh history
      const updatedTests = await getAllTests();
      setRecentTests(updatedTests);

      // Switch view mode to summary
      setViewMode('summary');

      // Clear the form
      setTestDetails(prev => ({
        ...prev,
        test_name: '',
      }));
      setStudentScores(prev => {
        const reset = {};
        students.forEach(s => { reset[s.id] = ''; });
        return reset;
      });
      setCheckedStudents(prev => {
        const reset = {};
        students.forEach(s => { reset[s.id] = true; });
        return reset;
      });

    } catch (err) {
      setError("Failed to save test scores.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewPastTest = (group) => {
    setSelectedTest(group);
    setViewMode('detail');
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 bg-white max-w-md mx-auto">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading tests data...</p>
      </div>
    );
  }

  // 1. MAIN CHECKLIST FORM + HISTORY VIEW
  if (viewMode === 'form') {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex justify-between items-center">
          <div className="text-left flex items-center gap-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TUITION PORTAL</p>
              <h2 className="text-sm font-bold text-slate-800 mt-0.5">Tests Register</h2>
            </div>
          </div>
        </div>

        {/* Scrollable Container for Form and History */}
        <div className="flex-1 overflow-y-auto">
          {/* Form fields: Subject, Name, Max Score */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 border-b border-slate-200 text-xs shrink-0 select-none">
            <div>
              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Subject</label>
              <select
                value={testDetails.subject}
                onChange={(e) => setTestDetails(prev => ({ ...prev, subject: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-bold text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Choose...</option>
                <option value="Maths">Maths</option>
                <option value="Science">Science</option>
                <option value="Hindi">Hindi</option>
                <option value="English">English</option>
                <option value="Social">Social</option>
                <option value="Kannada">Kannada</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Test Name</label>
              <input
                type="text"
                placeholder="e.g. Unit Test 1"
                value={testDetails.test_name}
                onChange={(e) => setTestDetails(prev => ({ ...prev, test_name: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-bold text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Max Score</label>
              <input
                type="number"
                placeholder="Max"
                value={testDetails.max_score}
                onChange={(e) => setTestDetails(prev => ({ ...prev, max_score: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-bold text-xs focus:outline-none focus:border-indigo-500 text-center"
              />
            </div>
          </div>

          {error && (
            <div className="mx-3 my-2 bg-red-50 text-red-650 text-xs font-semibold p-2.5 rounded border border-red-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              {error}
            </div>
          )}

          {/* Student Roster checklist (Internal scrolling list) */}
          <div className="border-b border-slate-200">
            {/* Headers Row */}
            <div className="w-full flex items-stretch border-b border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
              <div className="flex-1 px-3 py-1.5 flex items-center">Name</div>
              <div className="w-14 px-1.5 py-1.5 border-l border-slate-250 flex items-center justify-center">Class</div>
              <div className="w-12 px-1.5 py-1.5 border-l border-slate-250 flex items-center justify-center">✓</div>
              <div className="w-20 border-l border-slate-250 flex items-center justify-center">Score</div>
            </div>

            {/* Students List */}
            <div className="max-h-[190px] overflow-y-auto divide-y divide-slate-150">
              {students.map((student) => {
                const isChecked = checkedStudents[student.id] !== false;
                const score = studentScores[student.id] || '';
                return (
                  <div key={student.id} className="w-full flex items-stretch text-xs hover:bg-slate-50 select-none">
                    {/* Name */}
                    <div className="flex-1 px-3 py-2.5 flex items-center truncate text-slate-800 font-semibold">
                      {student.name}
                    </div>

                    {/* Class */}
                    <div className="w-14 border-l border-slate-200 flex items-center justify-center text-slate-500 text-center font-medium">
                      {student.standard}
                    </div>

                    {/* Checkbox */}
                    <div className="w-12 border-l border-slate-200 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCheckedStudents(prev => ({ ...prev, [student.id]: val }));
                        }}
                        className="w-4 h-4 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>

                    {/* Score / Absent */}
                    <div className="w-20 border-l border-slate-200 flex items-center justify-center px-1.5 py-1 shrink-0">
                      {isChecked ? (
                        <input
                          type="number"
                          min="0"
                          max={testDetails.max_score || 100}
                          step="any"
                          placeholder="Score"
                          value={score}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-center text-xs font-extrabold focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-1 py-0.5 border border-red-150 rounded">Absent</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tests History Section */}
          <div className="p-3">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>TESTS HISTORY</span>
            </h3>

            {recentTests.length === 0 ? (
              <div className="text-center text-slate-450 text-xs italic py-6 bg-slate-50 border border-dashed border-slate-200 rounded">
                No recent tests recorded.
              </div>
            ) : (
              <div className="flex flex-col border border-slate-200 divide-y divide-slate-150 bg-white">
                {getGroupedTests(recentTests).map((group) => {
                  const key = `${group.test_name}||${group.subject}||${group.date}`;
                  return (
                    <div
                      key={key}
                      onClick={() => handleViewPastTest(group)}
                      className="flex justify-between items-center py-2 px-3 hover:bg-slate-50 cursor-pointer text-xs active:scale-[0.99] transition-all"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-bold text-slate-800 truncate">{group.test_name}</p>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold uppercase mt-0.5">
                          <span className="text-indigo-650">{group.subject}</span>
                          <span>•</span>
                          <span>{new Date(group.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium">Avg: </span>
                        <span className="font-bold text-slate-800">{group.avgScore}</span>
                        <span className="text-[10px] text-slate-400">/{group.max_score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Save button pinned at the bottom */}
        <div className="bg-white border-t border-slate-200 shrink-0 p-3">
          <button
            onClick={handleSaveTest}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-sm uppercase tracking-wider active:scale-95 shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>Save Test →</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. SAVED SUMMARY VIEW
  if (viewMode === 'summary') {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TEST LOGGED SUCCESSFULLY</p>
            <h2 className="text-sm font-bold text-slate-800 mt-0.5">{savedSummary.test_name}</h2>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs shrink-0 font-semibold select-none">
          <span className="text-indigo-650 uppercase">Subject: {savedSummary.subject}</span>
          <span className="text-slate-400">{new Date(savedSummary.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        </div>

        {/* Roster list of scores */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="border border-slate-200 divide-y divide-slate-150 bg-white">
            {savedSummary.records.map((rec) => {
              const isAbsent = rec.score === null || rec.score === undefined;
              return (
                <div key={rec.student_id} className="flex justify-between items-center py-2.5 px-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{rec.students?.name}</span>
                    {rec.students?.standard && (
                      <span className="text-[9px] font-bold text-slate-400 ml-2 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                        {rec.students.standard}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {isAbsent ? (
                      <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-1.5 py-0.5 border border-red-150 rounded">Absent</span>
                    ) : (
                      <span className="font-extrabold text-slate-800">{rec.score} <span className="text-slate-450 font-medium text-[10px]">/ {rec.max_score}</span></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with average and Done button */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-center justify-center shrink-0">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Class Average</p>
          <p className="text-2xl font-black text-slate-850 mt-1">{savedSummary.avgScore} <span className="text-sm font-medium text-slate-400">/ {savedSummary.max_score}</span></p>
          
          <button
            onClick={() => setViewMode('form')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl mt-4 text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-indigo-100"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // 3. PAST TEST DETAIL/BREAKDOWN VIEW
  if (viewMode === 'detail' && selectedTest) {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden bg-white max-w-md mx-auto select-none">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center gap-2">
          <button 
            onClick={() => setViewMode('form')} 
            className="p-1 hover:bg-slate-200 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">TEST BREAKDOWN</p>
            <h2 className="text-sm font-bold text-slate-800 mt-0.5">{selectedTest.test_name}</h2>
          </div>
        </div>

        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs shrink-0 font-semibold select-none">
          <span className="text-indigo-650 uppercase">Subject: {selectedTest.subject}</span>
          <span className="text-slate-400">{new Date(selectedTest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>

        {/* List of scores */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="border border-slate-200 divide-y divide-slate-150 bg-white">
            {selectedTest.records.map((rec) => {
              const isAbsent = rec.score === null || rec.score === undefined;
              const pct = !isAbsent && rec.max_score > 0 ? Math.round((rec.score / rec.max_score) * 100) : 0;
              return (
                <div key={rec.id} className="flex justify-between items-center py-2.5 px-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{rec.students?.name}</span>
                    {rec.students?.standard && (
                      <span className="text-[9px] font-bold text-slate-400 ml-2 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                        {rec.students.standard}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {isAbsent ? (
                      <span className="text-[9px] font-bold text-red-500 uppercase bg-red-50 px-1.5 py-0.5 border border-red-150 rounded">Absent</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-800">{rec.score} <span className="text-slate-450 font-medium text-[10px]">/ {rec.max_score}</span></span>
                        <span className={`text-[10px] font-bold ${pct >= 75 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with average and Done button */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col items-center justify-center shrink-0">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Class Average</p>
          <p className="text-2xl font-black text-slate-850 mt-1">{selectedTest.avgScore} <span className="text-sm font-medium text-slate-400">/ {selectedTest.max_score}</span></p>
          
          <button
            onClick={() => setViewMode('form')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl mt-4 text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-indigo-100"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
