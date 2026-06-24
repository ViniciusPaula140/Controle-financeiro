import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapReceivableFromDb, mapReceivableToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';
import { addTransaction, deleteTransactionRaw } from './transactions';
import {
  syncTransactionFromReceivable,
  receivableDateISO,
} from './receivable-sync';

export const RECEIVABLE_ALREADY_RECEIVED_DELETE_MSG =
  'Não é possível excluir um registro já recebido. Desmarque-o primeiro.';

type ReceivablePatch = Partial<Omit<Receivable, 'id' | 'user_id'>> & {
  txId?: string | null;
  receivedAt?: string | null;
};

export interface Receivable {
  id: string;
  name: string;
  amount: number;
  year: number;
  month: number;
  received: boolean;
  receivedAt?: string;
  txId?: string;
  user_id: string;
}

export function useReceivables() {
  const { user } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setReceivables([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      console.error('Supabase client is not configured');
      setReceivables([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchReceivables = async () => {
      try {
        const { data, error } = await supabase
          .from('dinheiro_receber')
          .select('*')
          .eq('user_id', user.id)
          .order('ano', { ascending: false })
          .order('mes', { ascending: false });

        if (error) {
          console.error('Error fetching receivables:', error);
          setError(error);
        } else {
          setReceivables((data ?? []).map(mapReceivableFromDb));
          setError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching receivables:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchReceivables();

    const channelName = realtimeChannelName('dinheiro_receber', user.id);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dinheiro_receber',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped = mapReceivableFromDb(payload.new);
            setReceivables((prev) =>
              prev.some((r) => r.id === mapped.id) ? prev : [...prev, mapped],
            );
          } else if (payload.eventType === 'UPDATE') {
            setReceivables((prev) =>
              prev.map((r) => (r.id === payload.new.id ? mapReceivableFromDb(payload.new) : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setReceivables((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { receivables, loading, error };
}

export async function addReceivable(receivable: Omit<Receivable, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('dinheiro_receber')
    .insert({ ...mapReceivableToDb(receivable), user_id: user.id })
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapReceivableFromDb(requireRow(data, 'inserção de recebível'));
}

export async function updateReceivable(id: string, patch: ReceivablePatch) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: existingRow, error: fetchError } = await supabase
    .from('dinheiro_receber')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  const existing = existingRow ? mapReceivableFromDb(existingRow) : null;
  if (!existing) throw new Error('Recebível não encontrado');

  const nextReceived = patch.received ?? existing.received;

  if (nextReceived && !existing.received) {
    const merged = { ...existing, ...patch, received: false, txId: undefined, receivedAt: undefined };
    const { received: _r, receivedAt: _ra, txId: _tx, ...fieldPatch } = patch;
    if (Object.keys(fieldPatch).length > 0) {
      await supabase
        .from('dinheiro_receber')
        .update(mapReceivableToDb(fieldPatch))
        .eq('id', id);
    }
    return markReceivableReceived({ ...merged, ...fieldPatch } as Receivable, true);
  }

  if (!nextReceived && existing.received && existing.txId) {
    await deleteTransactionRaw(existing.txId);
    patch = { ...patch, received: false, receivedAt: null, txId: null };
  }

  const { data, error } = await supabase
    .from('dinheiro_receber')
    .update(mapReceivableToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  const updated = mapReceivableFromDb(requireRow(data, 'atualização de recebível'));

  if (updated.received && updated.txId) {
    await syncTransactionFromReceivable(updated);
  }

  return updated;
}

export async function markReceivableReceived(receivable: Receivable, received: boolean) {
  if (!received) {
    if (receivable.txId) {
      await deleteTransactionRaw(receivable.txId);
    }
    const { data, error } = await supabase!
      .from('dinheiro_receber')
      .update(
        mapReceivableToDb({
          received: false,
          receivedAt: null,
          txId: null,
        }),
      )
      .eq('id', receivable.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return mapReceivableFromDb(requireRow(data, 'atualização de recebível'));
  }

  if (receivable.received && receivable.txId) return receivable;

  const receivedAt = new Date().toISOString();
  const tx = await addTransaction({
    amount: receivable.amount,
    type: 'income',
    category: 'Outros',
    account: 'Nubank',
    date: receivableDateISO({ ...receivable, receivedAt }),
    description: receivable.name,
    note: 'Recebido via "Receber dinheiro"',
  });

  const { data, error } = await supabase!
    .from('dinheiro_receber')
    .update(
      mapReceivableToDb({
        received: true,
        receivedAt,
        txId: tx.id,
      }),
    )
    .eq('id', receivable.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapReceivableFromDb(requireRow(data, 'atualização de recebível'));
}

export async function deleteReceivable(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error: fetchError } = await supabase
    .from('dinheiro_receber')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const receivable = data ? mapReceivableFromDb(data) : null;
  if (receivable?.received) {
    throw new Error(RECEIVABLE_ALREADY_RECEIVED_DELETE_MSG);
  }

  const { error } = await supabase.from('dinheiro_receber').delete().eq('id', id);
  if (error) throw error;
}
