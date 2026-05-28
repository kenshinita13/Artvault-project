import { supabase } from './supabaseClient';

export async function logAudit(action: string, details: string = '', explicitUserId: string | null = null) {
  try {
    let userId = explicitUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }
    }
    
    if (!userId) return;
    
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
