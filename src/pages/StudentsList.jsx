import React, { useState, useEffect } from 'react';
import { getStudents } from '../lib/db';
import { Search, UserPlus, BookOpen, RefreshCw, AlertCircle } from 'lucide-react';

export default function StudentsList({ navigate }) {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandard, setSelectedStandard] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudents();
      setStudents(data);
      setFilteredStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students whenever search query or selected standard changes
  useEffect(() => {
    let filtered = students;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(query) ||
        (student.standard && student.standard.toLowerCase().includes(query))
      );
    }

    if (selectedStandard !== 'All') {
      filtered = filtered.filter(student => student.standard === selectedStandard);
    }

    setFilteredStudents(filtered);
  }, [searchQuery, selectedStandard, students]);

  // Extract unique standards for filtering dropdown
  const standards = ['All', ...new Set(students.map(s => s.standard).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Loading students list...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
        <p className="text-slate-700 font-semibold mb-4">{error}</p>
        <button
          onClick={fetchStudents}
          className="bg-indigo-600 text-white py-2 px-6 rounded-xl hover:bg-indigo-700 transition"
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
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-xs text-slate-500 font-medium">Total: {students.length} students enrolled</p>
        </div>
        <button
          onClick={() => navigate('add-student')}
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 text-sm font-semibold active:scale-95 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        {/* Standard filter pill select */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {standards.map((std) => (
            <button
              key={std}
              onClick={() => setSelectedStandard(std)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedStandard === std
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {std === 'All' ? 'All Classes' : std}
            </button>
          ))}
        </div>
      </div>

      {/* Student Cards List */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <p className="text-slate-500 font-medium">No students found matching filters.</p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedStandard('All'); }}
            className="text-indigo-600 text-sm font-semibold mt-2 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => navigate('student-profile', { id: student.id })}
              className="bg-white border border-slate-100 hover:border-indigo-100 p-4 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex justify-between items-center active:scale-[0.99]"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-800 truncate text-base">{student.name}</h3>
                  {student.standard && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      {student.standard}
                    </span>
                  )}
                </div>

              </div>

              {/* Fee info summary (Rupees symbol) */}
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold text-slate-400">Monthly</span>
                <p className="font-bold text-slate-700 text-sm">₹{student.fee_amount || 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
