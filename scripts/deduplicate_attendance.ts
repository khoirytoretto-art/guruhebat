import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xgrhsebsrhwmcnpjizhx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncmhzZWJzcmh3bWNucGppemh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk5NDAsImV4cCI6MjEwODI1NTk0MH0.3icsxBUmzhl4YGoIlgkIfeGDsyQsRrMzVR9LycvogbM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DATA_FILE = path.resolve('data/app-data.json');

async function deduplicateAttendance() {
  console.log('Starting attendance deduplication...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Data file not found');
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  const attendances = data.attendances || [];
  const initialCount = attendances.length;
  const uniqueMap = new Map<string, any>();
  const toDeleteIds: string[] = [];

  const processedAttendances = attendances.filter((a: any) => {
    // Generate a unique key for logical duplicates
    // Same teacher, school, class, date, role, and time
    const key = `${a.teacherId || a.teacherName}_${a.schoolId}_${a.classId}_${a.date}_${a.roleUsed}_${a.jamMasuk}_${a.jamKeluar}_${a.timeRangeFormatted}`;
    
    if (uniqueMap.has(key)) {
      toDeleteIds.push(a.id);
      return false;
    }
    
    uniqueMap.set(key, a);
    return true;
  });

  const removedCount = initialCount - processedAttendances.length;
  console.log(`Identified ${removedCount} duplicate attendances in JSON.`);

  if (removedCount > 0) {
    data.attendances = processedAttendances;
    // Also add to deletedIds if they were already synced
    data.deletedIds = Array.from(new Set([...(data.deletedIds || []), ...toDeleteIds]));
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('JSON updated and saved.');

    // 2. Sync with Supabase
    console.log(`Removing ${toDeleteIds.length} records from Supabase...`);
    
    // Batch delete in Supabase
    if (toDeleteIds.length > 0) {
      // Split into chunks of 100 to avoid URL length issues or payload limits
      for (let i = 0; i < toDeleteIds.length; i += 100) {
        const chunk = toDeleteIds.slice(i, i + 100);
        const { error } = await supabase.from('attendances').delete().in('id', chunk);
        if (error) console.error('Supabase Delete Error:', error);
      }
    }

    // Update app_data payload
    const { error: payloadErr } = await supabase.from('app_data').upsert({
      id: 'main',
      payload: data,
      updated_at: new Date().toISOString()
    });

    if (payloadErr) console.error('Supabase app_data payload update error:', payloadErr);
    else console.log('Supabase app_data payload updated.');
  } else {
    console.log('No duplicates found.');
  }

  console.log('Deduplication completed.');
}

deduplicateAttendance().catch(console.error);
