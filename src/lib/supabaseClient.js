import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pxzaexutvuatdexgkavk.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4emFleHV0dnVhdGRleGdrYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTA4NjQsImV4cCI6MjA4NTg2Njg2NH0.t9n_8Up_Ybeq46tWWFpzn3TfuJMEe6krgdTSLh8xT9o'

export const supabase = createClient(supabaseUrl, supabaseKey);