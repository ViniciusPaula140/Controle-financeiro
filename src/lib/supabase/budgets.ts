import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';

export interface Budget {
  id: string;
  category: string;
  limit: number;
  name?: string;
  user_id: string;
}

export function useBudgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    const fetchBudgets = async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching budgets:', error);
      } else {
        setBudgets(data || []);
      }
      setLoading(false);
    };

    fetchBudgets();

    const channel = supabase
      .channel('orcamentos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orcamentos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBudgets((prev) => [...prev, payload.new as Budget]);
          } else if (payload.eventType === 'UPDATE') {
            setBudgets((prev) =>
              prev.map((b) => (b.id === payload.new.id ? (payload.new as Budget) : b))
            );
          } else if (payload.eventType === 'DELETE') {
            setBudgets((prev) => prev.filter((b) => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { budgets, loading };
}

export async function addBudget(budget: Omit<Budget, 'id' | 'user_id'>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('orcamentos')
    .insert({ ...budget, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudget(id: string, patch: Partial<Omit<Budget, 'id' | 'user_id'>>) {
  const { data, error } = await supabase
    .from('orcamentos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from('orcamentos').delete().eq('id', id);
  if (error) throw error;
}
