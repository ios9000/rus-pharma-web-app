// Supabase клиент для студенческого фронтенда
// URL и anon key — те же, что в instructor/js/supabase-config.js
// anon key безопасен для клиентского кода — доступ ограничен RLS

(function() {
  'use strict';

  const SUPABASE_URL = 'https://otoxfxwwdbeblwpizlbi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90b3hmeHd3ZGJlYmx3cGl6bGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODcxMzUsImV4cCI6MjA4NjA2MzEzNX0.jVF_Pkli2QhF2f9TWWUE2FhKzuwVEneSYJJezshkQEM';

  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('[supabase-client] Supabase JS SDK не загружен. Функции Supabase недоступны.');
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
