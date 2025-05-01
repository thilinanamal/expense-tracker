export interface Transaction {
  id: string
  date: string | Date
  description: string
  amount: number
  categoryId: string | null
  accountId: string
  statementId: string
  category?: {
    id: string
    name: string
    color: string
  } | null
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface TransactionSummary {
  totalIncome: number
  totalExpenses: number
  netBalance: number
  incomeChange: number
  expenseChange: number
  savingsRate: number
  expensesByCategory: {
    category: string
    amount: number
  }[]
  monthlyData: {
    month: string
    income: number
    expenses: number
  }[]
}

export interface StatementParseResult {
  success: boolean
  transactionsCount?: number
  error?: string
}
