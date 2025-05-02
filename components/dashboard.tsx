"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getTransactionSummary, getTransactionsByCategory } from "@/lib/actions"
import type { TransactionSummary, Transaction } from "@/lib/types"
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const COLORS = [
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#3B82F6", // blue-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#F97316", // orange-500
  "#EF4444", // red-500
  "#6366F1", // indigo-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
  "#6B7280", // gray-500
]

export default function Dashboard() {
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("month")  // Default to 'month' to show current month
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSummary()
  }, [timeRange, startDate, endDate])

  const loadSummary = async () => {
    setLoading(true)
    try {
      let data;
      if (timeRange === 'custom') {
        if (startDate && endDate) {
          // Format dates as ISO strings for the API
          const startDateStr = startDate.toISOString();
          const endDateStr = endDate.toISOString();
          data = await getTransactionSummary(timeRange, startDateStr, endDateStr);
        } else {
          // Use selected month and year
          const startDateObj = new Date(selectedYear, selectedMonth, 1);
          const endDateObj = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
          const startDateStr = startDateObj.toISOString();
          const endDateStr = endDateObj.toISOString();
          data = await getTransactionSummary(timeRange, startDateStr, endDateStr);
        }
      } else {
        data = await getTransactionSummary(timeRange);
      }
      console.log('Loaded summary:', data);
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
      toast({
        title: "Error loading summary",
        description: "Failed to load your financial summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
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
  
  const toggleCategory = async (categoryId: string) => {
    if (expandedCategory === categoryId) {
      // If already expanded, collapse it
      setExpandedCategory(null);
      setCategoryTransactions([]);
      return;
    }
    
    // Otherwise, expand it and load transactions
    setExpandedCategory(categoryId);
    setLoadingTransactions(true);
    
    try {
      let transactions;
      if (timeRange === 'custom' && startDate && endDate) {
        transactions = await getTransactionsByCategory(
          categoryId, 
          timeRange, 
          startDate.toISOString(), 
          endDate.toISOString()
        );
      } else {
        transactions = await getTransactionsByCategory(categoryId, timeRange);
      }
      
      setCategoryTransactions(transactions);
    } catch (error) {
      console.error('Error loading category transactions:', error);
      toast({
        title: "Error loading transactions",
        description: "Failed to load transactions for this category.",
        variant: "destructive",
      });
    } finally {
      setLoadingTransactions(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading summary...</div>
  }

  if (!summary) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available. Please upload some statements to see your financial summary.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Financial Summary</h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <Select value={timeRange} onValueChange={(value) => {
            setTimeRange(value);
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {showCustomDateRange && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {/* Month Selector */}
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">January</SelectItem>
                  <SelectItem value="1">February</SelectItem>
                  <SelectItem value="2">March</SelectItem>
                  <SelectItem value="3">April</SelectItem>
                  <SelectItem value="4">May</SelectItem>
                  <SelectItem value="5">June</SelectItem>
                  <SelectItem value="6">July</SelectItem>
                  <SelectItem value="7">August</SelectItem>
                  <SelectItem value="8">September</SelectItem>
                  <SelectItem value="9">October</SelectItem>
                  <SelectItem value="10">November</SelectItem>
                  <SelectItem value="11">December</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Year Selector */}
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button onClick={loadSummary} size="sm">Apply</Button>
              
              {/* Advanced Date Range Toggle */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Toggle between month/year selector and specific date picker
                  if (startDate && endDate) {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  } else {
                    // Initialize with first and last day of selected month
                    setStartDate(new Date(selectedYear, selectedMonth, 1));
                    setEndDate(new Date(selectedYear, selectedMonth + 1, 0));
                  }
                }}
              >
                {startDate && endDate ? "Use Month/Year" : "Use Specific Dates"}
              </Button>
              
              {/* Show date pickers if specific dates are being used */}
              {startDate && endDate && (
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
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
            <CardTitle className="text-green-600">{formatCurrency(summary.totalIncome)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {summary.incomeChange > 0 ? (
                <span className="text-green-600">+{summary.incomeChange}% from previous period</span>
              ) : (
                <span className="text-red-600">{summary.incomeChange}% from previous period</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-red-600">{formatCurrency(summary.totalExpenses)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {summary.expenseChange < 0 ? (
                <span className="text-green-600">{summary.expenseChange}% from previous period</span>
              ) : (
                <span className="text-red-600">+{summary.expenseChange}% from previous period</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Balance</CardDescription>
            <CardTitle className={summary.netBalance >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrency(summary.netBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {summary.savingsRate > 0 ? (
                <span>Saving {summary.savingsRate}% of income</span>
              ) : (
                <span className="text-red-600">Spending more than earning</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Your spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                    nameKey="category"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {summary.expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Monthly Trend</CardTitle>
            <CardDescription>Income vs. Expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.monthlyData}>
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `Rs ${value}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10B981" />
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Category-wise Spending</CardTitle>
            <CardDescription>Total amount spent in each category</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.expensesByCategory
                  .sort((a, b) => b.amount - a.amount) // Sort by amount in descending order
                  .map((category, index) => (
                    <>
                      <TableRow 
                        key={`category-${index}`} 
                        className={"cursor-pointer hover:bg-muted/50 "}
                        onClick={() => toggleCategory(category.category.toLowerCase())}
                      >
                        <TableCell className="font-medium">{category.category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(category.amount)}</TableCell>
                        <TableCell className="text-right">
                          {((category.amount / summary.totalExpenses) * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {expandedCategory === category.category.toLowerCase() ? (
                            <ChevronUpIcon className="h-4 w-4" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded transactions view */}
                      {expandedCategory === category.category.toLowerCase() && (
                        <TableRow key={`transactions-${index}`}>
                          <TableCell colSpan={4} className="p-0">
                            <div className="bg-muted/30 px-4 py-2">
                              <div className="font-medium mb-2 flex items-center justify-between">
                                <span>Transactions in {category.category}</span>
                                <Badge variant="outline">{categoryTransactions.length} items</Badge>
                              </div>
                              
                              {loadingTransactions ? (
                                <div className="text-center py-4">Loading transactions...</div>
                              ) : categoryTransactions.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">No transactions found in this category</div>
                              ) : (
                                <div className="max-h-[300px] overflow-y-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {categoryTransactions.map((transaction) => (
                                        <TableRow key={transaction.id}>
                                          <TableCell>{formatDate(transaction.date)}</TableCell>
                                          <TableCell>{transaction.description}</TableCell>
                                          <TableCell className={`text-right font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                            {transaction.amount > 0 ? (
                                              <span className="flex items-center justify-end">
                                                <ArrowUpIcon className="h-3 w-3 mr-1" />
                                                {formatCurrency(transaction.amount)}
                                              </span>
                                            ) : (
                                              <span className="flex items-center justify-end">
                                                <ArrowDownIcon className="h-3 w-3 mr-1" />
                                                {formatCurrency(Math.abs(transaction.amount))}
                                              </span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
