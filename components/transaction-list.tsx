"use client"

import { useState, useEffect } from "react"
import { ArrowDownIcon, ArrowUpIcon, SearchIcon, FilterIcon, Trash2Icon, CalendarIcon, CheckIcon, CheckSquareIcon, SquareIcon } from "lucide-react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getTransactions, updateTransactionCategory, deleteTransaction, deleteTransactionsByAccount, deleteMultipleTransactions } from "@/lib/actions"
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
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
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
      // Reset selection when reloading transactions
      setSelectedTransactions(new Set())
      setSelectMode(false)
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

  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    // Clear selections when toggling mode
    setSelectedTransactions(new Set())
  }

  const toggleSelectTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions)
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId)
    } else {
      newSelected.add(transactionId)
    }
    setSelectedTransactions(newSelected)
  }

  const selectAllTransactions = () => {
    const allIds = filteredTransactions.map(t => t.id)
    setSelectedTransactions(new Set(allIds))
  }

  const deselectAllTransactions = () => {
    setSelectedTransactions(new Set())
  }

  const confirmDeleteMultiple = () => {
    if (selectedTransactions.size === 0) return
    setDeleteMultipleDialogOpen(true)
  }

  const handleDeleteMultiple = async () => {
    if (selectedTransactions.size === 0) return

    try {
      await deleteMultipleTransactions(Array.from(selectedTransactions))

      // Update local state
      setTransactions((prev) => prev.filter((t) => !selectedTransactions.has(t.id)))
      setSelectedTransactions(new Set())
      setSelectMode(false)

      toast({
        title: "Transactions deleted",
        description: `Successfully deleted ${selectedTransactions.size} transactions`,
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete the selected transactions",
        variant: "destructive",
      })
    } finally {
      setDeleteMultipleDialogOpen(false)
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

  // Filter transactions by date range
  const isInDateRange = (date: string | Date) => {
    if (dateFilter === 'all') return true;
    
    // Ensure we're working with a proper Date object
    const transactionDate = new Date(date);
    const now = new Date();
    
    // Log for debugging
    // console.log('Checking date:', transactionDate.toISOString(), 'for filter:', dateFilter);
    
    switch (dateFilter) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return transactionDate >= today;
      
      case 'week':
        const weekStart = new Date();
        weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        return transactionDate >= weekStart;
      
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactionDate >= monthStart;
      
      case 'custom':
        if (!startDate) return true;
        
        // Create date objects for comparison and normalize them to start/end of day
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          
          // Get date components for better comparison
          const txYear = transactionDate.getFullYear();
          const txMonth = transactionDate.getMonth();
          const txDay = transactionDate.getDate();
          
          const startYear = start.getFullYear();
          const startMonth = start.getMonth();
          const startDay = start.getDate();
          
          const endYear = end.getFullYear();
          const endMonth = end.getMonth();
          const endDay = end.getDate();
          
          // Compare date components instead of timestamp
          const isAfterOrEqualStart = 
            (txYear > startYear) || 
            (txYear === startYear && txMonth > startMonth) || 
            (txYear === startYear && txMonth === startMonth && txDay >= startDay);
          
          const isBeforeOrEqualEnd = 
            (txYear < endYear) || 
            (txYear === endYear && txMonth < endMonth) || 
            (txYear === endYear && txMonth === endMonth && txDay <= endDay);
          
          return isAfterOrEqualStart && isBeforeOrEqualEnd;
        }
        
        return transactionDate >= start;
      
      default:
        return true;
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Handle special category filters
    let matchesCategory = false;
    if (categoryFilter === 'all') {
      matchesCategory = true;
    } else if (categoryFilter === 'uncategorized') {
      matchesCategory = transaction.categoryId === null;
    } else {
      matchesCategory = transaction.categoryId === categoryFilter;
    }
    
    const matchesAccount = accountFilter === 'all' || transaction.accountId === accountFilter
    const matchesDate = isInDateRange(transaction.date)
    return matchesSearch && matchesCategory && matchesAccount && matchesDate
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
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Account Filter */}
          <Select value={accountFilter} onValueChange={(value) => setAccountFilter(value)}>
            <SelectTrigger className="w-full sm:w-[150px]">
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

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(value) => {
            setDateFilter(value);
            if (value === 'custom') {
              setShowCustomDateRange(true);
              // Initialize with current month if not already set
              if (!startDate) {
                const now = new Date();
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setEndDate(new Date());
              }
            } else {
              setShowCustomDateRange(false);
            }
          }}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Custom Date Range */}
          {showCustomDateRange && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <div className="grid gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : <span>Start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <span>to</span>
              
              <div className="grid gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : <span>End date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(date) => startDate ? date < startDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Reset Filters Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSearchTerm("")
              setCategoryFilter("all")
              setAccountFilter("all")
              setDateFilter("all")
              setShowCustomDateRange(false)
            }}
            title="Reset all filters"
          >
            <FilterIcon className="h-4 w-4" />
          </Button>
          
          {/* Select Mode Toggle */}
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={toggleSelectMode}
            className="ml-2"
          >
            {selectMode ? "Cancel Selection" : "Select Multiple"}
          </Button>
          
          {/* Delete Selected Button */}
          {selectMode && selectedTransactions.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteMultiple}
            >
              Delete Selected ({selectedTransactions.size})
            </Button>
          )}
          
          {/* Select All / Deselect All Buttons */}
          {selectMode && filteredTransactions.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllTransactions}
              >
                Select All
              </Button>
              
              {selectedTransactions.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllTransactions}
                >
                  Deselect All
                </Button>
              )}
            </>
          )}
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
                {selectMode && <TableHead className="w-[40px]"></TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {!selectMode && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow 
                  key={transaction.id} 
                  className={selectedTransactions.has(transaction.id) ? "bg-muted/50" : ""}
                >
                  {selectMode && (
                    <TableCell className="w-[40px] p-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => toggleSelectTransaction(transaction.id)}
                      >
                        {selectedTransactions.has(transaction.id) ? (
                          <CheckSquareIcon className="h-5 w-5" />
                        ) : (
                          <SquareIcon className="h-5 w-5" />
                        )}
                      </Button>
                    </TableCell>
                  )}
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
                  {!selectMode && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => confirmDelete(transaction.id)}>
                        <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
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

      <Dialog open={deleteMultipleDialogOpen} onOpenChange={setDeleteMultipleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple Transactions</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTransactions.size} selected transactions? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMultipleDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMultiple}>
              Delete Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
