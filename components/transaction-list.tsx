"use client"

import { useState, useEffect } from "react"
import { ArrowDownIcon, ArrowUpIcon, SearchIcon, FilterIcon, Trash2Icon } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { getTransactions, updateTransactionCategory, deleteTransaction, deleteTransactionsByAccount } from "@/lib/actions"
import type { Transaction, Category } from "@/lib/types"

const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", color: "green" },
  { id: "dining", name: "Dining", color: "yellow" },
  { id: "transportation", name: "Transportation", color: "blue" },
  { id: "utilities", name: "Utilities", color: "purple" },
  { id: "entertainment", name: "Entertainment", color: "pink" },
  { id: "shopping", name: "Shopping", color: "orange" },
  { id: "healthcare", name: "Healthcare", color: "red" },
  { id: "cash", name: "Cash", color: "indigo" },
  { id: "education", name: "Education", color: "cyan" },
  { id: "income", name: "Income", color: "emerald" },
  { id: "other", name: "Other", color: "gray" },
]

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [accountFilter, setAccountFilter] = useState<string>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  // Format account number for display
  const formatAccountNumber = (accountId: string) => {
    // If it's a long number, show only first 6 and last 4 digits
    if (/^\d{10,}$/.test(accountId)) {
      return `${accountId.slice(0, 6)}...${accountId.slice(-4)}`
    }
    return accountId
  }

  // Get unique account numbers from transactions
  const accountNumbers = [...new Set(transactions.map(t => t.accountId))].sort()

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const data = await getTransactions()
      setTransactions(data)
    } catch (error) {
      toast({
        title: "Error loading transactions",
        description: "Failed to load your transactions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = async (transactionId: string, categoryId: string) => {
    try {
      await updateTransactionCategory(transactionId, categoryId)

      // Update local state
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, categoryId } : t)))

      toast({
        title: "Category updated",
        description: "Transaction category has been updated successfully",
      })
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update transaction category",
        variant: "destructive",
      })
    }
  }

  const confirmDelete = (transactionId: string) => {
    setTransactionToDelete(transactionId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!transactionToDelete) return

    try {
      await deleteTransaction(transactionToDelete)

      // Update local state
      setTransactions((prev) => prev.filter((t) => t.id !== transactionToDelete))

      toast({
        title: "Transaction deleted",
        description: "Transaction has been removed successfully",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete transaction",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    }
  }

  const confirmDeleteAccount = (accountId: string) => {
    setAccountToDelete(accountId)
    setDeleteAccountDialogOpen(true)
  }

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return

    try {
      await deleteTransactionsByAccount(accountToDelete)

      // Update local state
      setTransactions((prev) => prev.filter((t) => t.accountId !== accountToDelete))

      toast({
        title: "Account transactions deleted",
        description: "All transactions for this account have been removed successfully",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete account transactions",
        variant: "destructive",
      })
    } finally {
      setDeleteAccountDialogOpen(false)
      setAccountToDelete(null)
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || transaction.categoryId === categoryFilter
    const matchesAccount = accountFilter === "all" || transaction.accountId === accountFilter
    return matchesSearch && matchesCategory && matchesAccount
  })

  const getCategoryBadge = (categoryId: string | null) => {
    const category = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES.find((c) => c.id === "other")

    if (!category) return null

    return (
      <Badge
        variant="outline"
        className={`bg-${category.color}-100 text-${category.color}-800 border-${category.color}-200`}
      >
        {category.name}
      </Badge>
    )
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("si-LK", {
      style: "currency",
      currency: "LKR",
    }).format(amount)
  }

  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading transactions...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={accountFilter} onValueChange={(value) => setAccountFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accountNumbers.map((accountId) => (
                <SelectItem key={accountId} value={accountId}>
                  {formatAccountNumber(accountId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {accountFilter !== "all" && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => confirmDeleteAccount(accountFilter)}
              title="Delete all transactions for this account"
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          )}

          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSearchTerm("")
              setCategoryFilter("all")
              setAccountFilter("all")
            }}
          >
            <FilterIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No transactions found. Try adjusting your filters or upload some statements.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{formatAccountNumber(transaction.accountId)}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>
                    <Select
                      value={transaction.categoryId || ""}
                      onValueChange={(value) => handleCategoryChange(transaction.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Category">
                          {transaction.categoryId
                            ? CATEGORIES.find((c) => c.id === transaction.categoryId)?.name
                            : "Select Category"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {transaction.amount > 0 ? (
                      <span className="flex items-center justify-end">
                        <ArrowUpIcon className="h-3 w-3 mr-1" />
                        {formatAmount(transaction.amount)}
                      </span>
                    ) : (
                      <span className="flex items-center justify-end">
                        <ArrowDownIcon className="h-3 w-3 mr-1" />
                        {formatAmount(Math.abs(transaction.amount))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(transaction.id)}>
                      <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account Transactions</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all transactions for account {accountToDelete ? formatAccountNumber(accountToDelete) : ""}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccountDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
