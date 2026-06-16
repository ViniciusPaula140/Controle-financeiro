import { supabase } from './supabaseClient';
import { mapFixedBillFromDb, mapFixedBillToDb } from './mappers';
import type { FixedBill } from './fixed-bills';

export const FIXED_BILL_CATEGORY = 'Conta fixa';
export const DEFAULT_PAYMENT_METHOD = 'Dinheiro';

export async function findFixedBillByTransactionId(txId: string): Promise<FixedBill | null> {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { data, error } = await supabase
    .from('contas_fixas')
    .select('*')
    .eq('transacao_id', txId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapFixedBillFromDb(data) : null;
}

/** Keeps the fixed bill row but clears payment link (used when deleting from Transações). */
export async function unlinkFixedBillFromTransaction(txId: string) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const { error } = await supabase
    .from('contas_fixas')
    .update({
      status_pago: false,
      pago_em: null,
      transacao_id: null,
    })
    .eq('transacao_id', txId);

  if (error) throw error;
}

export async function syncFixedBillFromTransaction(
  txId: string,
  patch: { amount?: number; account?: string; description?: string },
) {
  if (!supabase) throw new Error('Supabase client is not configured');

  const bill = await findFixedBillByTransactionId(txId);
  if (!bill) return;

  const dbPatch = mapFixedBillToDb({
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.account !== undefined ? { account: patch.account } : {}),
    ...(patch.description !== undefined ? { item: patch.description } : {}),
  });

  if (Object.keys(dbPatch).length === 0) return;

  const { error } = await supabase.from('contas_fixas').update(dbPatch).eq('id', bill.id);
  if (error) throw error;
}

export function fixedBillPaymentMethod(bill: Pick<FixedBill, 'account'>): string {
  return bill.account?.trim() || DEFAULT_PAYMENT_METHOD;
}

export function buildFixedBillTransaction(
  bill: Pick<FixedBill, 'item' | 'amount' | 'account'>,
  paidAt: string,
) {
  const dateStr = new Date(paidAt).toLocaleDateString('pt-BR');
  return {
    amount: bill.amount,
    type: 'expense' as const,
    category: FIXED_BILL_CATEGORY,
    account: fixedBillPaymentMethod(bill),
    date: paidAt,
    description: bill.item,
    note: `Conta fixa — pago em ${dateStr}`,
    fixedBillId: undefined as string | undefined,
  };
}
