import { supabase } from './supabaseClient';
import { useAuth } from './auth-context';
import { useEffect, useState } from 'react';
import { mapCaixinhaFromDb, mapCaixinhaToDb } from './mappers';
import { realtimeChannelName, requireRow } from './realtime-utils';

export interface Caixinha {
  id: string;
  nome: string;
  saldo_guardado: number;
  user_id: string;
  created_at?: string;
}

export function useCaixinhas() {
  const { user } = useAuth();
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setCaixinhas([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!supabase) {
      setCaixinhas([]);
      setLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    const fetchCaixinhas = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('caixinhas')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (fetchError) {
          setError(fetchError);
        } else {
          setCaixinhas((data ?? []).map(mapCaixinhaFromDb));
          setError(null);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchCaixinhas();

    const channelName = realtimeChannelName('caixinhas', user.id);
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'caixinhas',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCaixinhas((prev) => [...prev, mapCaixinhaFromDb(payload.new)]);
          } else if (payload.eventType === 'UPDATE') {
            setCaixinhas((prev) =>
              prev.map((c) => (c.id === payload.new.id ? mapCaixinhaFromDb(payload.new) : c)),
            );
          } else if (payload.eventType === 'DELETE') {
            setCaixinhas((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { caixinhas, loading, error };
}

export async function addCaixinha(caixinha: Pick<Caixinha, 'nome'>) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const nome = caixinha.nome.trim();
  if (!nome) throw new Error('Informe o nome da caixinha');

  const { data, error } = await supabase
    .from('caixinhas')
    .insert({ ...mapCaixinhaToDb({ nome, saldo_guardado: 0 }), user_id: user.id })
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapCaixinhaFromDb(requireRow(data, 'inserção de caixinha'));
}

async function getCaixinhaRow(id: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase.from('caixinhas').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return mapCaixinhaFromDb(requireRow(data, 'caixinha'));
}

export async function depositToCaixinha(id: string, amount: number) {
  if (amount <= 0) throw new Error('Informe um valor maior que zero');

  const current = await getCaixinhaRow(id);
  const { data, error } = await supabase!
    .from('caixinhas')
    .update(mapCaixinhaToDb({ saldo_guardado: current.saldo_guardado + amount }))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapCaixinhaFromDb(requireRow(data, 'depósito na caixinha'));
}

export async function withdrawFromCaixinha(id: string, amount: number) {
  if (amount <= 0) throw new Error('Informe um valor maior que zero');

  const current = await getCaixinhaRow(id);
  if (amount > current.saldo_guardado) {
    throw new Error('Saldo insuficiente na caixinha');
  }

  const { data, error } = await supabase!
    .from('caixinhas')
    .update(mapCaixinhaToDb({ saldo_guardado: current.saldo_guardado - amount }))
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return mapCaixinhaFromDb(requireRow(data, 'resgate da caixinha'));
}
