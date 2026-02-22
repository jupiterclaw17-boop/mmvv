/**
 * logService — Serviço de logging de auditoria e erros.
 * Insere registros na tabela `logs` conforme PRD seção 12.
 */
import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'DELETE_FILE' | 'LOGIN';
  entity: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface ErrorLogParams {
  userId?: string;
  userName?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

const client = supabase as any;

export async function logAudit(params: AuditLogParams) {
  try {
    await client.from('logs').insert({
      log_type: 'audit',
      user_id: params.userId,
      user_name: params.userName,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId || null,
      description: params.description,
      metadata: params.metadata || null,
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}

export async function logError(params: ErrorLogParams) {
  try {
    await client.from('logs').insert({
      log_type: 'error',
      user_id: params.userId || null,
      user_name: params.userName || null,
      action: null,
      entity: null,
      entity_id: null,
      description: params.description,
      metadata: params.metadata || null,
    });
  } catch (e) {
    console.error('Failed to write error log:', e);
  }
}
