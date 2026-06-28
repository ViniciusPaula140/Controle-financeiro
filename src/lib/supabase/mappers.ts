import type { Transaction } from './transactions';
import type { Budget } from './budgets';
import type { AccountBalance } from './account-balances';
import type { Goal } from './goals';
import type { FixedBill } from './fixed-bills';
import type { Receivable } from './receivables';
import type { Caixinha } from './caixinhas';

type DbRow = Record<string, unknown>;

export function mapTransactionFromDb(row: DbRow): Transaction {
  const obs = (row.observacao as string) ?? undefined;
  const nl = obs?.indexOf('\n') ?? -1;
  const description = nl >= 0 ? obs!.slice(0, nl) : obs;
  const note = nl >= 0 ? obs!.slice(nl + 1) : obs;
  return {
    id: row.id as string,
    amount: Number(row.valor),
    type: row.tipo === 'receita' ? 'income' : 'expense',
    category: row.categoria as string,
    account: row.conta_bancaria as string,
    date: row.data as string,
    note,
    description,
    recurring: Boolean(row.recorrente),
    fixedBillId: (row.conta_fixa_id as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapTransactionToDb(
  transaction: Partial<Omit<Transaction, 'id' | 'user_id'>>,
): DbRow {
  const row: DbRow = {};
  if (transaction.amount !== undefined) row.valor = transaction.amount;
  if (transaction.type !== undefined) {
    row.tipo = transaction.type === 'income' ? 'receita' : 'despesa';
  }
  if (transaction.category !== undefined) row.categoria = transaction.category;
  if (transaction.account !== undefined) row.conta_bancaria = transaction.account;
  if (transaction.date !== undefined) row.data = transaction.date;
  if (transaction.description !== undefined && transaction.note !== undefined) {
    row.observacao = `${transaction.description}\n${transaction.note}`;
  } else {
    const note = transaction.note ?? transaction.description;
    if (note !== undefined) row.observacao = note;
  }
  if (transaction.recurring !== undefined) row.recorrente = transaction.recurring;
  if (transaction.fixedBillId !== undefined) row.conta_fixa_id = transaction.fixedBillId;
  return row;
}

export function mapBudgetFromDb(row: DbRow): Budget {
  return {
    id: row.id as string,
    category: row.categoria as string,
    limit: Number(row.limite_mensal),
    name: (row.nomenclatura as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapBudgetToDb(budget: Partial<Omit<Budget, 'id' | 'user_id'>>): DbRow {
  const row: DbRow = {};
  if (budget.category !== undefined) row.categoria = budget.category;
  if (budget.limit !== undefined) row.limite_mensal = budget.limit;
  if (budget.name !== undefined) row.nomenclatura = budget.name;
  return row;
}

export function mapAccountFromDb(row: DbRow): AccountBalance {
  return {
    id: row.id as string,
    account: row.conta as string,
    balance: Number(row.saldo),
    note: (row.observacao as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapAccountToDb(
  account: Partial<Omit<AccountBalance, 'id' | 'user_id'>>,
): DbRow {
  const row: DbRow = {};
  if (account.account !== undefined) row.conta = account.account;
  if (account.balance !== undefined) row.saldo = account.balance;
  if (account.note !== undefined) row.observacao = account.note;
  return row;
}

export function mapGoalFromDb(row: DbRow): Goal {
  return {
    id: row.id as string,
    year: row.ano as number,
    month: row.mes as number,
    amount: Number(row.valor_alvo),
    note: (row.descricao as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapGoalToDb(goal: Partial<Omit<Goal, 'id' | 'user_id'>>): DbRow {
  const row: DbRow = {};
  if (goal.year !== undefined) row.ano = goal.year;
  if (goal.month !== undefined) row.mes = goal.month;
  if (goal.amount !== undefined) row.valor_alvo = goal.amount;
  if (goal.note !== undefined) row.descricao = goal.note;
  return row;
}

export function mapFixedBillFromDb(row: DbRow): FixedBill {
  return {
    id: row.id as string,
    year: row.ano as number,
    month: row.mes as number,
    item: row.item as string,
    amount: Number(row.valor),
    dueDay: row.vencimento as number,
    separated: row.separado as 'ok' | 'pendente',
    paid: Boolean(row.status_pago),
    paidAt: (row.pago_em as string) ?? undefined,
    account: (row.conta_bancaria as string) ?? undefined,
    txId: (row.transacao_id as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapFixedBillToDb(
  bill: Partial<Omit<FixedBill, 'id' | 'user_id'>> & {
    txId?: string | null;
    paidAt?: string | null;
  },
): DbRow {
  const row: DbRow = {};
  if (bill.year !== undefined) row.ano = bill.year;
  if (bill.month !== undefined) row.mes = bill.month;
  if (bill.item !== undefined) row.item = bill.item;
  if (bill.amount !== undefined) row.valor = bill.amount;
  if (bill.dueDay !== undefined) row.vencimento = bill.dueDay;
  if (bill.separated !== undefined) row.separado = bill.separated;
  if (bill.paid !== undefined) row.status_pago = bill.paid;
  if (bill.paidAt !== undefined) row.pago_em = bill.paidAt;
  if (bill.account !== undefined) row.conta_bancaria = bill.account;
  if (bill.txId !== undefined) row.transacao_id = bill.txId;
  return row;
}

export function mapReceivableFromDb(row: DbRow): Receivable {
  return {
    id: row.id as string,
    name: row.nome as string,
    amount: Number(row.valor),
    year: row.ano as number,
    month: row.mes as number,
    received: Boolean(row.recebido),
    receivedAt: (row.data_recebimento as string) ?? undefined,
    txId: (row.transacao_id as string) ?? undefined,
    user_id: row.user_id as string,
  };
}

export function mapReceivableToDb(
  receivable: Partial<Omit<Receivable, 'id' | 'user_id'>> & {
    txId?: string | null;
    receivedAt?: string | null;
  },
): DbRow {
  const row: DbRow = {};
  if (receivable.name !== undefined) row.nome = receivable.name;
  if (receivable.amount !== undefined) row.valor = receivable.amount;
  if (receivable.year !== undefined) row.ano = receivable.year;
  if (receivable.month !== undefined) row.mes = receivable.month;
  if (receivable.received !== undefined) row.recebido = receivable.received;
  if (receivable.receivedAt !== undefined) row.data_recebimento = receivable.receivedAt;
  if (receivable.txId !== undefined) row.transacao_id = receivable.txId;
  return row;
}

export function mapCaixinhaFromDb(row: DbRow): Caixinha {
  return {
    id: row.id as string,
    nome: row.nome as string,
    saldo_guardado: Number(row.saldo_guardado),
    user_id: row.user_id as string,
    created_at: (row.created_at as string) ?? undefined,
  };
}

export function mapCaixinhaToDb(caixinha: Partial<Omit<Caixinha, 'id' | 'user_id'>>): DbRow {
  const row: DbRow = {};
  if (caixinha.nome !== undefined) row.nome = caixinha.nome;
  if (caixinha.saldo_guardado !== undefined) row.saldo_guardado = caixinha.saldo_guardado;
  return row;
}
