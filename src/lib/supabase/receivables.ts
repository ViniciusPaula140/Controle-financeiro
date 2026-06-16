import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapReceivableFromDb, mapReceivableToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';

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

export async function updateReceivable(id: string, patch: Partial<Omit<Receivable, 'id' | 'user_id'>>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('dinheiro_receber')
    .update(mapReceivableToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapReceivableFromDb(requireRow(data, 'atualização de recebível'));
}

export async function deleteReceivable(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('dinheiro_receber').delete().eq('id', id);
  if (error) throw error;
}
