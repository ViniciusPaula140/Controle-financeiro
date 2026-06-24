import { supabase } from './supabaseClient';
import { mapReceivableFromDb, mapReceivableToDb } from './mappers';
import type { Receivable } from './receivables';
import { updateTransactionRaw } from './transactions';

export const RECEIVABLE_TX_NOTE = 'Recebido via "Receber dinheiro"';

export async function findReceivableByTransactionId(txId: string): Promise<Receivable | null> {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('dinheiro_receber')
    .select('*')
    .eq('transacao_id', txId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapReceivableFromDb(data) : null;
}

/** Keeps the receivable row but clears payment link (used when deleting from Transações). */
export async function unlinkReceivableFromTransaction(txId: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase
    .from('dinheiro_receber')
    .update({
      recebido: false,
      data_recebimento: null,
      transacao_id: null,
    })
    .eq('transacao_id', txId);

  if (error) throw error;
}

export async function findReceivablesByTransactionIds(txIds: string[]): Promise<Receivable[]> {
  if (!supabase) throw new Error('Supabase client is not configured');
  if (!txIds.length) return [];

  const { data, error } = await supabase
    .from('dinheiro_receber')
    .select('*')
    .in('transacao_id', txIds);

  if (error) throw error;
  return (data ?? []).map(mapReceivableFromDb);
}

export async function unlinkReceivablesByIds(receivableIds: string[]) {
  if (!supabase) throw new Error('Supabase client is not configured');
  if (!receivableIds.length) return;

  const { error } = await supabase
    .from('dinheiro_receber')
    .update({
      recebido: false,
      data_recebimento: null,
      transacao_id: null,
    })
    .in('id', receivableIds);

  if (error) throw error;
}

export function receivableDateISO(receivable: Pick<Receivable, 'year' | 'month' | 'receivedAt'>) {
  const ref = receivable.receivedAt ? new Date(receivable.receivedAt) : new Date();
  const day = ref.getDate();
  const lastDay = new Date(receivable.year, receivable.month + 1, 0).getDate();
  return new Date(receivable.year, receivable.month, Math.min(day, lastDay)).toISOString();
}

export function txDateParts(iso: string) {
  const d = new Date(iso);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export async function syncTransactionFromReceivable(receivable: Receivable) {
  if (!receivable.txId || !receivable.received) return;

  await updateTransactionRaw(receivable.txId, {
    amount: receivable.amount,
    description: receivable.name,
    date: receivableDateISO(receivable),
  });
}

export async function syncReceivableFromTransaction(
  txId: string,
  patch: { amount?: number; description?: string; date?: string },
) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const receivable = await findReceivableByTransactionId(txId);
  if (!receivable) return;

  const dbPatch = mapReceivableToDb({
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.description !== undefined ? { name: patch.description } : {}),
    ...(patch.date !== undefined
      ? {
          year: txDateParts(patch.date).year,
          month: txDateParts(patch.date).month,
        }
      : {}),
  });

  if (Object.keys(dbPatch).length === 0) return;

  const { error } = await supabase.from('dinheiro_receber').update(dbPatch).eq('id', receivable.id);
  if (error) throw error;
}
