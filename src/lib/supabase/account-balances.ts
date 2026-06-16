import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching account balances:', error);
      } else {
        setAccounts(data || []);
      }
      setLoading(false);
    };

    fetchAccounts();

    const channel = supabase
      .channel('contas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contas',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAccounts((prev) => [...prev, payload.new as AccountBalance]);
          } else if (payload.eventType === 'UPDATE') {
            setAccounts((prev) =>
              prev.map((a) => (a.id === payload.new.id ? (payload.new as AccountBalance) : a))
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

  return { accounts, loading };
}

export async function addAccountBalance(account: Omit<AccountBalance, 'id' | 'user_id'>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas')
    .insert({ ...account, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccountBalance(id: string, patch: Partial<Omit<AccountBalance, 'id' | 'user_id'>>) {
  const { data, error } = await supabase
    .from('contas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccountBalance(id: string) {
  const { error } = await supabase.from('contas').delete().eq('id', id);
  if (error) throw error;
}
