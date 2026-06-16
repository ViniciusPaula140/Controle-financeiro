import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapAccountFromDb, mapAccountToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';

export interface AccountBalance {
  id: string;
  account: string;
  balance: number;
  note?: string;
  user_id: string;
}

export function useAccountBalances() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      console.error('Supabase client is not configured');
      setAccounts([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('contas_bancarias')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching account balances:', error);
          setError(error);
        } else {
          setAccounts((data ?? []).map(mapAccountFromDb));
          setError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching account balances:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();

    const channelName = realtimeChannelName('contas_bancarias', user.id);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contas_bancarias',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAccounts((prev) => [...prev, mapAccountFromDb(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setAccounts((prev) =>
              prev.map((a) => (a.id === payload.new.id ? mapAccountFromDb(payload.new) : a))
            );
          } else if (payload.eventType === 'DELETE') {
            setAccounts((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { accounts, loading, error };
}

export async function addAccountBalance(account: Omit<AccountBalance, 'id' | 'user_id'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas_bancarias')
    .insert({ ...mapAccountToDb(account), user_id: user.id })
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapAccountFromDb(requireRow(data, 'inserção de conta bancária'));
}

export async function updateAccountBalance(id: string, patch: Partial<Omit<AccountBalance, 'id' | 'user_id'>>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('contas_bancarias')
    .update(mapAccountToDb(patch))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapAccountFromDb(requireRow(data, 'atualização de conta bancária'));
}

export async function deleteAccountBalance(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase.from('contas_bancarias').delete().eq('id', id);
  if (error) throw error;
}
