import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

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
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching transactions:', error);
          setError(error);
        } else {
          setTransactions(data || []);
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

    const channel = supabase
      .channel('transacoes-changes')
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
            setTransactions((prev) => [payload.new as Transaction, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTransactions((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Transaction) : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { transactions, loading, error };
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('transacoes')
    .insert({ ...transaction, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, 'id' | 'user_id'>>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('transacoes')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('transacoes').delete().eq('id', id);
  if (error) throw error;
}
