-- ========================================================
-- SKRIP HAPUS TOTAL SEMUA TABEL DATABASE SUPABASE
-- Jalankan di: https://supabase.com/dashboard/project/xgrhsebsrhwmcnpjizhx/sql/new
-- ========================================================

DROP TABLE IF EXISTS public.attendances CASCADE;
DROP TABLE IF EXISTS public.journals CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.reset_requests CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.app_data CASCADE;

-- Selesai! Seluruh tabel dan relasi di Supabase telah terhapus total.
