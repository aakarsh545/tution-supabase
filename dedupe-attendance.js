import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function dedupeTodayAttendance() {
  console.log('Running attendance deduplication...');
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, subject, date')
      .eq('date', todayStr);
    
    if (sessErr) throw sessErr;
    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for today. Nothing to deduplicate.');
      return;
    }

    console.log(`Found ${sessions.length} session(s) today.`);
    
    for (const session of sessions) {
      console.log(`Processing session ID: ${session.id} (${session.subject})`);
      
      const { data: attendanceRecords, error: attErr } = await supabase
        .from('attendance')
        .select('id, student_id, created_at')
        .eq('session_id', session.id);
      
      if (attErr) throw attErr;
      if (!attendanceRecords || attendanceRecords.length === 0) {
        console.log('No attendance records found for this session.');
        continue;
      }

      console.log(`Found ${attendanceRecords.length} attendance records.`);

      // Group records by student_id
      const recordsByStudent = {};
      attendanceRecords.forEach(rec => {
        if (!recordsByStudent[rec.student_id]) {
          recordsByStudent[rec.student_id] = [];
        }
        recordsByStudent[rec.student_id].push(rec);
      });

      const idsToDelete = [];
      
      Object.keys(recordsByStudent).forEach(studentId => {
        const studentRecs = recordsByStudent[studentId];
        if (studentRecs.length > 1) {
          // Sort by created_at descending (latest first)
          studentRecs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          // Keep the first one (latest), mark others for deletion
          const keep = studentRecs[0];
          const duplicates = studentRecs.slice(1);
          console.log(`Student ${studentId} has ${studentRecs.length} records. Keeping latest ID: ${keep.id} (created at ${keep.created_at}).`);
          duplicates.forEach(dup => {
            idsToDelete.push(dup.id);
          });
        }
      });

      if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} duplicate records...`);
        const { error: delErr } = await supabase
          .from('attendance')
          .delete()
          .in('id', idsToDelete);
        
        if (delErr) throw delErr;
        console.log('Successfully deleted duplicates.');
      } else {
        console.log('No duplicate attendance records found for this session.');
      }
    }
  } catch (error) {
    console.error('Error during deduplication:', error);
  }
}

dedupeTodayAttendance();
