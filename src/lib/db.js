import { supabase } from './supabase';

function checkNetworkError(error) {
  if (error) {
    const msg = String(error.message || error).toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('failed to fetch')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('supabase-network-error'));
      }
    }
    throw error;
  }
}

// Students Queries
export async function getStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name', { ascending: true });
  if (error) checkNetworkError(error);
  return data;
}

export async function getStudentById(id) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();
  if (error) checkNetworkError(error);
  return data;
}

export async function addStudent(student) {
  const { data, error } = await supabase
    .from('students')
    .insert([student])
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

export async function updateStudent(id, student) {
  const { data, error } = await supabase
    .from('students')
    .update(student)
    .eq('id', id)
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

export async function deleteStudent(id) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);
  if (error) checkNetworkError(error);
  return true;
}

// Sessions & Attendance Queries
export async function createSession(session) {
  const { data, error } = await supabase
    .from('sessions')
    .insert([session])
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

export async function saveAttendance(records) {
  const { data, error } = await supabase
    .from('attendance')
    .insert(records)
    .select();
  if (error) checkNetworkError(error);
  return data;
}

export async function updateAttendance(records) {
  const { data, error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'session_id,student_id' })
    .select();
  if (error) checkNetworkError(error);
  return data;
}

export async function getAttendanceForSession(sessionId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('session_id', sessionId);
  if (error) checkNetworkError(error);
  return data;
}

export async function getSessionsToday() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', today);
  if (error) checkNetworkError(error);
  return data;
}

export async function getAttendanceForStudent(studentId) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      status,
      session_id,
      sessions (
        date,
        subject,
        topic_covered
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) checkNetworkError(error);
  return data;
}

// Tests Queries
export async function getTestsForStudent(studentId) {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('student_id', studentId)
    .order('date', { ascending: true });
  if (error) checkNetworkError(error);
  return data;
}

export async function getAllTests() {
  const { data, error } = await supabase
    .from('tests')
    .select(`
      *,
      students (
        name,
        standard
      )
    `)
    .order('date', { ascending: false })
    .limit(100);
  if (error) checkNetworkError(error);
  return data;
}

export async function logTest(testRecord) {
  const { data, error } = await supabase
    .from('tests')
    .insert([testRecord])
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

// Fees Queries
export async function getFeesForStudent(studentId) {
  const { data, error } = await supabase
    .from('fees')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) checkNetworkError(error);
  return data;
}

export async function getMonthlyFees(month) {
  const { data, error } = await supabase
    .from('fees')
    .select('*')
    .eq('month', month);
  if (error) checkNetworkError(error);
  return data;
}

export async function logFeePayment(feeRecord) {
  const { data, error } = await supabase
    .from('fees')
    .upsert(feeRecord, { onConflict: 'student_id,month' })
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

// Notes Queries & Behavior Logs
export async function getNotesForStudent(studentId) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) checkNetworkError(error);
  return data;
}

export async function addNoteForStudent(studentId, noteText) {
  const { data, error } = await supabase
    .from('notes')
    .insert([{ student_id: studentId, note: noteText }])
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}

export async function getBehaviourLogs(studentId) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('student_id', studentId)
    .like('note', 'behaviour:%')
    .order('created_at', { ascending: false });
  if (error) checkNetworkError(error);
  return data.map(log => {
    const parts = log.note.split(':');
    const status = parts[1] || '';
    const text = parts.slice(2).join(':') || '';
    return {
      ...log,
      status,
      text
    };
  });
}

export async function logBehaviour(studentId, status, description = '') {
  const { data, error } = await supabase
    .from('notes')
    .insert([{ student_id: studentId, note: `behaviour:${status}:${description.trim()}` }])
    .select()
    .single();
  if (error) checkNetworkError(error);
  return data;
}
