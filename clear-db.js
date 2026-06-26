import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client by parsing .env manually
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

async function clearAll() {
  console.log('Clearing database tables...');
  try {
    // 1. Clear attendance
    const { count: countAtt, error: errAtt } = await supabase
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAtt) throw errAtt;
    console.log('Cleared attendance table.');

    // 2. Clear sessions
    const { error: errSess } = await supabase
      .from('sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errSess) throw errSess;
    console.log('Cleared sessions table.');

    // 3. Clear fees
    const { error: errFees } = await supabase
      .from('fees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errFees) throw errFees;
    console.log('Cleared fees table.');

    // 4. Clear notes
    const { error: errNotes } = await supabase
      .from('notes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errNotes) throw errNotes;
    console.log('Cleared notes table.');

    // 5. Clear tests
    const { error: errTests } = await supabase
      .from('tests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errTests) throw errTests;
    console.log('Cleared tests table.');

    // 6. Clear students
    const { error: errStud } = await supabase
      .from('students')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errStud) throw errStud;
    console.log('Cleared students table.');

    // Verify all counts are 0
    const { data: students } = await supabase.from('students').select('id');
    const { data: sessions } = await supabase.from('sessions').select('id');
    const { data: attendance } = await supabase.from('attendance').select('id');
    const { data: fees } = await supabase.from('fees').select('id');
    const { data: notes } = await supabase.from('notes').select('id');
    const { data: tests } = await supabase.from('tests').select('id');

    console.log('\nVerification Summary:');
    console.log(`Students: ${students?.length || 0}`);
    console.log(`Sessions: ${sessions?.length || 0}`);
    console.log(`Attendance: ${attendance?.length || 0}`);
    console.log(`Fees: ${fees?.length || 0}`);
    console.log(`Notes: ${notes?.length || 0}`);
    console.log(`Tests: ${tests?.length || 0}`);
    
    if (
      (students?.length || 0) === 0 &&
      (sessions?.length || 0) === 0 &&
      (attendance?.length || 0) === 0 &&
      (fees?.length || 0) === 0 &&
      (notes?.length || 0) === 0 &&
      (tests?.length || 0) === 0
    ) {
      console.log('Database cleared completely successfully!');
    } else {
      console.error('Warning: Database is not fully empty!');
    }

  } catch (error) {
    console.error('Error clearing database:', error);
  }
}

clearAll();
