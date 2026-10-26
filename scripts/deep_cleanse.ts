import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xgrhsebsrhwmcnpjizhx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncmhzZWJzcmh3bWNucGppemh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk5NDAsImV4cCI6MjEwODI1NTk0MH0.3icsxBUmzhl4YGoIlgkIfeGDsyQsRrMzVR9LycvogbM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DATA_FILE = path.resolve('data/app-data.json');

const CLASS_ID_MAPPINGS: Record<string, string> = {
  'class-1791863472104': 'class-1792254260221',
  'class-1791863490831': 'class-1792254265056',
  'class-1791863974635': 'class-1792255708602',
  'class-1791863987740': 'class-1792255716293',
  'class-1791864003058': 'class-1792255716293',
  'class-1791864006775': 'class-1792255742330',
  'class-1791864016698': 'class-1792255742330',
  'class-1791864016245': 'class-1792255751594',
  'class-1791864030610': 'class-1792255751594',
  'class-1791864030121': 'class-1792255763208',
  'class-1791864041762': 'class-1792255763208',
  'class-1791864037531': 'class-1792255772326',
  'class-1791864052329': 'class-1792255772326',
  'class-1791864084404': 'class-1792257653360',
};

const SCHOOL_ID_MAPPINGS: Record<string, string> = {
  'school-1791863112941': 'school-1792252027826', // Old SD -> New SD
  'school-1791863155621': 'school-1792252068779', // Old SMP -> New SMP
  'school-1791863224916': 'school-1792252179195', // Old SMA -> New SMA
};

function canonicalizeSchoolId(schoolId?: string): string {
  if (!schoolId) return '';
  return SCHOOL_ID_MAPPINGS[schoolId] || schoolId;
}

function canonicalizeClassId(schoolId?: string, classId?: string): string {
  if (!classId) return '';
  if (classId === 'persekolah') return 'persekolah';
  
  // Use the effective school ID for class mapping
  const effectiveSchoolId = canonicalizeSchoolId(schoolId);
  
  if (CLASS_ID_MAPPINGS[classId]) return CLASS_ID_MAPPINGS[classId];
  
  if (effectiveSchoolId === 'school-1792252068779' && classId === 'class-1792254260221') {
    return 'class-1792255708602';
  }
  if (effectiveSchoolId === 'school-1792252179195' && classId !== 'persekolah') {
    return 'class-1792257653360';
  }
  return classId;
}

async function deepCleanse() {
  console.log('Starting deep cleanse...');

  // 1. Load Local JSON
  if (!fs.existsSync(DATA_FILE)) {
    console.error('Data file not found');
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  console.log('Local data loaded.');

  // 2. Clear deletedIds
  const oldDeletedCount = data.deletedIds?.length || 0;
  data.deletedIds = [];
  console.log(`Cleared ${oldDeletedCount} deletedIds.`);

  // 3. Cleanse Journals and Attendances in JSON
  let journalFixCount = 0;
  data.journals = (data.journals || []).map((j: any) => {
    const newSchoolId = canonicalizeSchoolId(j.schoolId);
    const newClassId = canonicalizeClassId(newSchoolId, j.classId);
    if (newSchoolId !== j.schoolId || newClassId !== j.classId) journalFixCount++;
    return { ...j, schoolId: newSchoolId, classId: newClassId };
  });

  let attendanceFixCount = 0;
  data.attendances = (data.attendances || []).map((a: any) => {
    const newSchoolId = canonicalizeSchoolId(a.schoolId);
    const newClassId = canonicalizeClassId(newSchoolId, a.classId);
    if (newSchoolId !== a.schoolId || newClassId !== a.classId) attendanceFixCount++;
    return { ...a, schoolId: newSchoolId, classId: newClassId };
  });

  console.log(`JSON: Fixed ${journalFixCount} journals and ${attendanceFixCount} attendances.`);

  // 4. Save JSON
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('JSON saved.');

  // 5. Cleanse Supabase Relational Tables
  console.log('Syncing with Supabase Relational Tables...');

  const { data: dbJournals, error: jErr } = await supabase.from('journals').select('*');
  if (!jErr && dbJournals) {
    const updates = dbJournals.map(j => {
      const newSchoolId = canonicalizeSchoolId(j.school_id);
      const newClassId = canonicalizeClassId(newSchoolId, j.class_id);
      if (newSchoolId !== j.school_id || newClassId !== j.class_id) {
        return { ...j, school_id: newSchoolId, class_id: newClassId };
      }
      return null;
    }).filter(Boolean);

    if (updates.length > 0) {
      const { error: upErr } = await supabase.from('journals').upsert(updates);
      if (upErr) console.error('Supabase Journal Update Error:', upErr);
      else console.log(`Supabase: Updated ${updates.length} journals.`);
    }
  }

  const { data: dbAttendances, error: aErr } = await supabase.from('attendances').select('*');
  if (!aErr && dbAttendances) {
    const updates = dbAttendances.map(a => {
      const newSchoolId = canonicalizeSchoolId(a.school_id);
      const newClassId = canonicalizeClassId(newSchoolId, a.class_id);
      if (newSchoolId !== a.school_id || newClassId !== a.class_id) {
        return { ...a, school_id: newSchoolId, class_id: newClassId };
      }
      return null;
    }).filter(Boolean);

    if (updates.length > 0) {
      const { error: upErr } = await supabase.from('attendances').upsert(updates);
      if (upErr) console.error('Supabase Attendance Update Error:', upErr);
      else console.log(`Supabase: Updated ${updates.length} attendances.`);
    }
  }

  // 6. Update app_data payload in Supabase
  const { error: payloadErr } = await supabase.from('app_data').upsert({
    id: 'main',
    payload: data,
    updated_at: new Date().toISOString()
  });


  if (payloadErr) console.error('Supabase app_data payload update error:', payloadErr);
  else console.log('Supabase app_data payload updated.');

  console.log('Deep cleanse completed.');
}

deepCleanse().catch(console.error);
