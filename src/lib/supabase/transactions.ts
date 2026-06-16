import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapTransactionFromDb, mapTransactionToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';
import {
  syncFixedBillFromTransaction,
  unlinkFixedBillFromTransaction,
} from './fixed-bill-sync';

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  account: string;
  date: string;
  description?: string;
  note?: string;
  recurring?: boolean;
  fixedBillId?: string;
  user_id: string;
}

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      console.error('Supabase client is not configured');
      setTransactions([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('transacoes')
          .select('*')
          .eq('user_id', user.id)
          .order('data', { ascending: false });

        if (error) {
          console.error('Error fetching transactions:', error);
          setError(error);
        } else {
          setTransactions((data ?? []).map(mapTransactionFromDb));
          setError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching transactions:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    const channelName = realtimeChannelName('transacoes', user.id);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transacoes',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped = mapTransactionFromDb(payload.new);
            setTransactions((prev) =>
              prev.some((t) => t.id === mapped.id) ? prev : [mapped, ...prev],
            );
          } else if (payload.eventType === 'UPDATE') {
            setTransactions((prev) =>
              prev.map((t) => (t.id === payload.new.id ? mapTransactionFromDb(payload.new) : t)),
            );
          } else if (payload.eventType === 'DELETE') {
            setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { transactions, loading, error };
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('transacoes')
    .insert({ ...mapTransactionToDb(transaction), user_id: user.id })
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapTransactionFromDb(requireRow(data, 'inserção de transação'));
}

/** Updates without syncing back to linked fixed bills (internal use). */
export async function updateTransactionRaw(
  id: string,
  patch: Partial<Omit<Transaction, 'id' | 'user_id'>>,
) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('transacoes')
    .update(mapTransactionToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapTransactionFromDb(requireRow(data, 'atualização de transação'));
}

export async function updateTransaction(
  id: string,
  patch: Partial<Omit<Transaction, 'id' | 'user_id'>>,
) {
  const updated = await updateTransactionRaw(id, patch);

  await syncFixedBillFromTransaction(id, {
    amount: patch.amount,
    account: patch.account,
    description: patch.description,
  });

  return updated;
}

/** Deletes without unlinking fixed bills (internal use). */
export async function deleteTransactionRaw(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('transacoes').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  await unlinkFixedBillFromTransaction(id);
  await deleteTransactionRaw(id);
}
