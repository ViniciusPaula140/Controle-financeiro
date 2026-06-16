import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!user) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    const fetchReceivables = async () => {
      const { data, error } = await supabase
        .from('dinheiro_a_receber')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        console.error('Error fetching receivables:', error);
      } else {
        setReceivables(data || []);
      }
      setLoading(false);
    };

    fetchReceivables();

    const channel = supabase
      .channel('dinheiro_a_receber-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dinheiro_a_receber',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceivables((prev) => [...prev, payload.new as Receivable]);
          } else if (payload.eventType === 'UPDATE') {
            setReceivables((prev) =>
              prev.map((r) => (r.id === payload.new.id ? (payload.new as Receivable) : r))
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
  }, [user]);

  return { receivables, loading };
}

export async function addReceivable(receivable: Omit<Receivable, 'id' | 'user_id'>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('dinheiro_a_receber')
    .insert({ ...receivable, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateReceivable(id: string, patch: Partial<Omit<Receivable, 'id' | 'user_id'>>) {
  const { data, error } = await supabase
    .from('dinheiro_a_receber')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteReceivable(id: string) {
  const { error } = await supabase.from('dinheiro_a_receber').delete().eq('id', id);
  if (error) throw error;
}
