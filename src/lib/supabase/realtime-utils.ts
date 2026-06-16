/** Unique channel name per mount — avoids Strict Mode collision on resubscribe. */
export function realtimeChannelName(table: string, userId: string): string {
  return `${table}-changes-${userId}-${Math.random()}`;
}

/** PGRST116-safe: returns row or throws a clear error after insert/update. */
export function requireRow<T>(data: T | null, action: string): T {
  if (data == null) {
    throw new Error(`Nenhum registro retornado após ${action}`);
  }
  return data;
}

export function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  if (err instanceof Error) return err.message;
  return 'Erro desconhecido';
}
