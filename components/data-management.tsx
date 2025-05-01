"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, Calendar, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { clearAllTransactions, clearTransactionsByMonth, clearAllData } from "@/lib/actions"

export default function DataManagement() {
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"month" | "all" | "everything">("all")
  const [isClearing, setIsClearing] = useState(false)
  const { toast } = useToast()

  const months = [
    { value: "current", label: "Current Month" },
    { value: "previous", label: "Previous Month" },
    { value: "2months", label: "2 Months Ago" },
    { value: "3months", label: "3 Months Ago" },
    { value: "older", label: "Older Than 3 Months" },
  ]

  const handleClearByMonth = () => {
    if (!selectedMonth) {
      toast({
        title: "No month selected",
        description: "Please select a month to clear data for",
        variant: "destructive",
      })
      return
    }
    setConfirmAction("month")
    setConfirmDialogOpen(true)
  }

  const handleClearAll = () => {
    setConfirmAction("all")
    setConfirmDialogOpen(true)
  }

  const handleClearEverything = () => {
    setConfirmAction("everything")
    setConfirmDialogOpen(true)
  }

  const executeDataClear = async () => {
    setIsClearing(true)
    try {
      let result

      if (confirmAction === "month") {
        result = await clearTransactionsByMonth(selectedMonth)
        toast({
          title: "Data cleared",
          description: `Successfully cleared transactions for ${getMonthLabel(selectedMonth)}`,
        })
      } else if (confirmAction === "all") {
        result = await clearAllTransactions()
        toast({
          title: "All transactions cleared",
          description: "Successfully cleared all transaction data",
        })
      } else if (confirmAction === "everything") {
        result = await clearAllData()
        toast({
          title: "All data cleared",
          description: "Successfully cleared all data including transactions, categories, and settings",
        })
      }

      setConfirmDialogOpen(false)
    } catch (error) {
      toast({
        title: "Error clearing data",
        description: "There was an error clearing the data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }

  const getMonthLabel = (value: string): string => {
    return months.find((m) => m.value === value)?.label || value
  }

  const getConfirmationMessage = (): string => {
    if (confirmAction === "month") {
      return `Are you sure you want to clear all transactions for ${getMonthLabel(selectedMonth)}? This action cannot be undone.`
    } else if (confirmAction === "all") {
      return "Are you sure you want to clear ALL transactions? This will remove all transaction data from the system. This action cannot be undone."
    } else {
      return "Are you sure you want to clear ALL DATA? This will remove all transactions, categories, and settings. This action cannot be undone."
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clear Monthly Data</CardTitle>
          <CardDescription>Clear transaction data for a specific month or time period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleClearByMonth}
              disabled={!selectedMonth || isClearing}
              className="w-full sm:w-auto"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Clear Selected Month
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clear All Transactions</CardTitle>
          <CardDescription>Remove all transaction data from the system</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This will delete all transaction data but keep your categories and settings intact.
          </p>
          <Button variant="outline" onClick={handleClearAll} disabled={isClearing} className="w-full sm:w-auto">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All Transactions
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Reset Everything</CardTitle>
          <CardDescription>Clear all data and reset the application to its initial state</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This will delete all transactions, categories, and settings. Use with extreme caution.
          </p>
          <Button
            variant="destructive"
            onClick={handleClearEverything}
            disabled={isClearing}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Everything
          </Button>
        </CardContent>
        <CardFooter className="bg-red-50 border-t border-red-100">
          <div className="flex items-start gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <p>Warning: This action is irreversible and will delete all your data.</p>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Data Deletion</DialogTitle>
            <DialogDescription>{getConfirmationMessage()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={isClearing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDataClear} disabled={isClearing}>
              {isClearing ? "Clearing..." : "Yes, Clear Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
