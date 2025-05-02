"use server"

import { revalidatePath } from "next/cache"
import { parse } from "csv-parse/sync"
import type { Transaction, TransactionSummary, StatementParseResult } from "./types"
import { prisma } from "./db"

// Mock database for demo purposes
let transactions: Transaction[] = []

export async function processStatement(formData: FormData): Promise<StatementParseResult> {
  try {
    const file = formData.get("file") as File

    if (!file) {
      return { success: false, error: "No file provided" }
    }

    const fileContent = await file.text()

    if (!fileContent) {
      return { success: false, error: "Empty file content" }
    }

    // Extract filename without extension and sanitize it for use as account ID
    const fileName = file.name.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9-]/g, "-")
    console.log("Processing statement with filename:", fileName)

    let parsedTransactions: Transaction[] = []

    // First try to use LLM to parse the statement
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not found in environment variables. Falling back to traditional parsing.")
        throw new Error("Gemini API key not configured")
      }

      parsedTransactions = await parseStatementWithGemini(fileContent, fileName)

      if (parsedTransactions.length > 0) {
        console.log(`Successfully parsed ${parsedTransactions.length} transactions with Gemini`)
      } else {
        console.log("Gemini parsing returned no transactions, falling back to traditional parsing")
        parsedTransactions = parseStatement(fileContent, fileName)
      }
    } catch (llmError) {
      console.error("Error parsing with Gemini, falling back to traditional parsing:", llmError)
      parsedTransactions = parseStatement(fileContent, fileName)
    }

    // Ensure all transactions have the correct account ID
    const statementId = `statement-${Date.now()}`
    const transactionsToInsert = parsedTransactions.map((t) => ({
      ...t,
      accountId: t.accountId === "unknown-account" ? fileName : t.accountId,
      statementId,
    }))

    // Insert transactions into the database
    await prisma.transaction.createMany({
      data: transactionsToInsert,
    })

    revalidatePath("/")

    return {
      success: true,
      transactionsCount: transactionsToInsert.length,
    }
  } catch (error) {
    console.error("Error processing statement:", error)
    return {
      success: false,
      error: "Failed to process statement file",
    }
  }
}

async function parseStatementWithGemini(content: string, fileName: string): Promise<Transaction[]> {
  try {
    // First try to extract account numbers from the content
    const rows = content.split('\n')
    const accountNumbers = new Set<string>()
    const accountPattern = /\b\d{12}\b/  // Pattern for 12-digit account numbers
    
    rows.forEach(row => {
      const match = row.match(accountPattern)
      if (match) {
        accountNumbers.add(match[0])
      }
    })

    // Determine the type of statement for better prompting
    let statementType = "unknown"
    if (fileName.includes("savings")) {
      statementType = "savings account"
    } else if (fileName.includes("amex")) {
      statementType = "Amex credit card"
    } else if (fileName.includes("sampath")) {
      statementType = "Sampath credit card"
    } else if (fileName.includes("credit")) {
      statementType = "credit card"
    }

    // Limit content length to avoid token limits
    const truncatedContent = content.slice(0, 15000)

    // Create a prompt for the LLM
    const prompt = `
You are a financial data extraction expert. Extract all transactions from the following ${statementType} statement.

For each transaction, extract:
1. Date (in YYYY-MM-DD format)
2. Description
3. Amount (positive for income/credits, negative for expenses/debits)
4. Account number (if present in the transaction details)

Return the data as a JSON array of objects with these fields: date, description, amount, accountNumber.
Only return the JSON array, nothing else.

Here's the statement content:
${truncatedContent}
`

    console.log("Sending statement to Gemini for parsing...")

    // Direct API call to Gemini - updated to use the correct model and endpoint
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", errorText)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log("Received response from Gemini")

    // Extract the text from the response
    let text = ""
    try {
      text = data.candidates[0].content.parts[0].text
    } catch (e) {
      console.error("Error extracting text from Gemini response:", e)
      console.log("Gemini response:", JSON.stringify(data, null, 2))
      throw new Error("Failed to extract text from Gemini response")
    }

    // Parse the LLM response
    let extractedData
    try {
      // Find JSON in the response (in case the LLM adds explanatory text)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
      } else {
        extractedData = JSON.parse(text)
      }

      console.log(`Successfully extracted ${extractedData.length} transactions from Gemini response`)
    } catch (parseError) {
      console.error("Error parsing Gemini response as JSON:", parseError)
      console.log("Gemini response text:", text)
      return []
    }

    // Convert the extracted data to Transaction objects
    return extractedData
      .map((item: any) => {
        // Parse date
        let date: Date
        try {
          date = new Date(item.date)
          if (isNaN(date.getTime())) {
            date = new Date()
          }
        } catch (e) {
          date = new Date()
        }

        // Parse amount
        let amount = 0
        if (typeof item.amount === "number") {
          amount = item.amount
        } else if (typeof item.amount === "string") {
          // Remove any non-numeric characters except decimal point and minus sign
          const cleanedAmount = item.amount.replace(/[^\d.-]/g, "")
          amount = Number.parseFloat(cleanedAmount) || 0
        }

        // Get account number, fallback to the first account found in the statement
        const accountId = (item.accountNumber || Array.from(accountNumbers)[0] || "unknown-account").toString().trim()

        return {
          date: date.toISOString(),
          description: item.description || "Unknown transaction",
          amount: amount,
          categoryId: null,
          accountId,
        }
      })
      .filter((tx: Transaction) => !isNaN(tx.amount))
  } catch (error) {
    console.error("Error in Gemini parsing:", error)
    return []
  }
}

export async function getTransactions(): Promise<Transaction[]> {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    include: { category: true }
  })

  return transactions.map(tx => ({
    ...tx,
    date: tx.date.toISOString()
  }))
}

export async function updateTransactionCategory(transactionId: string, categoryId: string): Promise<void> {
  try {
    console.log(`Updating transaction ${transactionId} with category ${categoryId}`)
    
    const result = await prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId }
    })
    
    console.log('Update successful:', result)
    revalidatePath("/")
  } catch (error) {
    console.error('Error updating transaction category:', error)
    // Try to find the transaction to see if it exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    })
    console.log('Transaction found?', transaction)
    throw error
  }
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await prisma.transaction.delete({
    where: { id: transactionId }
  })

  revalidatePath("/")
}

export async function deleteMultipleTransactions(transactionIds: string[]): Promise<void> {
  if (!transactionIds.length) return;
  
  await prisma.transaction.deleteMany({
    where: {
      id: {
        in: transactionIds
      }
    }
  })

  revalidatePath("/")
}

export async function deleteTransactionsByAccount(accountId: string): Promise<void> {
  await prisma.transaction.deleteMany({
    where: { accountId }
  })

  revalidatePath("/")
}

export async function clearTransactionsByMonth(monthOption: string): Promise<void> {
  const now = new Date()
  let deleteCondition: any

  switch (monthOption) {
    case "current":
      deleteCondition = {
        date: {
          lt: new Date(now.getFullYear(), now.getMonth(), 1)
        }
      }
      break
    case "previous":
      const previousMonth = now.getMonth() - 1
      const yearOfPreviousMonth = previousMonth < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const normalizedPreviousMonth = previousMonth < 0 ? 11 : previousMonth

      deleteCondition = {
        AND: [
          {
            date: {
              gte: new Date(yearOfPreviousMonth, normalizedPreviousMonth, 1)
            }
          },
          {
            date: {
              lt: new Date(now.getFullYear(), now.getMonth(), 1)
            }
          }
        ]
      }
      break
    case "2months":
      const twoMonthsAgo = now.getMonth() - 2
      const yearOfTwoMonthsAgo = twoMonthsAgo < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const normalizedTwoMonthsAgo = twoMonthsAgo < 0 ? 12 + twoMonthsAgo : twoMonthsAgo

      deleteCondition = {
        AND: [
          {
            date: {
              gte: new Date(yearOfTwoMonthsAgo, normalizedTwoMonthsAgo, 1)
            }
          },
          {
            date: {
              lt: new Date(yearOfTwoMonthsAgo, normalizedTwoMonthsAgo + 1, 1)
            }
          }
        ]
      }
      break
    case "3months":
      const threeMonthsAgo = now.getMonth() - 3
      const yearOfThreeMonthsAgo = threeMonthsAgo < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const normalizedThreeMonthsAgo = threeMonthsAgo < 0 ? 12 + threeMonthsAgo : threeMonthsAgo

      deleteCondition = {
        AND: [
          {
            date: {
              gte: new Date(yearOfThreeMonthsAgo, normalizedThreeMonthsAgo, 1)
            }
          },
          {
            date: {
              lt: new Date(yearOfThreeMonthsAgo, normalizedThreeMonthsAgo + 1, 1)
            }
          }
        ]
      }
      break
    case "older":
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - 3)
      deleteCondition = {
        date: {
          lt: cutoffDate
        }
      }
      break
    default:
      return
  }

  await prisma.transaction.deleteMany({
    where: deleteCondition
  })

  revalidatePath("/")
}

export async function clearAllTransactions(): Promise<void> {
  await prisma.transaction.deleteMany()
  revalidatePath("/")
}

export async function clearAllData(): Promise<void> {
  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.category.deleteMany()
  ])

  revalidatePath("/")
}

export async function getTransactionsByCategory(categoryId: string, timeRange: string, customStartDate?: string, customEndDate?: string) {
  try {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    // Set date ranges based on time range
    switch (timeRange) {
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(customEndDate)
          endDate.setHours(23, 59, 59, 999) // Include the entire end day
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        }
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'all':
        startDate = new Date(2000, 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Query for transactions in the specified category and date range
    let whereClause = {}
    
    if (timeRange === 'all') {
      whereClause = { categoryId }
    } else {
      whereClause = {
        categoryId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: { category: true }
    })

    return transactions
  } catch (error) {
    console.error('Error fetching transactions by category:', error)
    throw error
  }
}

export async function getTransactionSummary(timeRange: string, customStartDate?: string, customEndDate?: string): Promise<TransactionSummary> {
  try {
    console.log('Getting transaction summary for timeRange:', timeRange)
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    switch (timeRange) {
      case 'custom':
        // Handle custom date range if provided
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          // For the previous period, use the same duration before the start date
          const duration = new Date(customEndDate).getTime() - startDate.getTime()
          previousEndDate = new Date(startDate.getTime() - 1)
          previousStartDate = new Date(startDate.getTime() - duration - 1)
        } else {
          // Fallback to current month if custom dates aren't provided
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
        }
        break
      case 'month':
        // This month: from 1st of current month to now
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        // Previous month: from 1st to last day of previous month
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'quarter':
        // Current quarter
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        // Previous quarter
        previousStartDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1)
        previousEndDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0)
        break
      case 'year':
        // Current year: from Jan 1st to now
        startDate = new Date(now.getFullYear(), 0, 1)
        // Previous year: all of last year
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1)
        previousEndDate = new Date(now.getFullYear(), 0, 0)
        break
      case 'all':
        // For 'all time', use a very old start date
        startDate = new Date(2000, 0, 1)
        previousStartDate = new Date(1999, 0, 1)
        previousEndDate = new Date(1999, 11, 31)
        break
      default:
        // Default to current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
    }

    console.log('Date ranges:', {
      startDate: startDate.toISOString(),
      previousStartDate: previousStartDate.toISOString(),
      previousEndDate: previousEndDate.toISOString()
    })

    // First, check if there are any transactions in the database at all
    const totalCount = await prisma.transaction.count()
    console.log('Total transactions in database:', totalCount)
    
    // If there are no transactions at all, return empty data
    if (totalCount === 0) {
      return createEmptySummary()
    }

    // Get all transactions for the dashboard regardless of time range
    // The issue is that the transactions have dates from Feb-Mar 2024, but we're filtering for May 2025
    let currentTransactionsQuery = {}
    let previousTransactionsQuery = {}
    
    // Log a sample transaction to check its date format
    const sampleTransaction = await prisma.transaction.findFirst()
    if (sampleTransaction) {
      console.log('Sample transaction date:', sampleTransaction.date)
    }
    
    // Set up the date filters based on the time range
    if (timeRange === 'all') {
      // For 'all time', don't filter by date at all
      currentTransactionsQuery = {}
      previousTransactionsQuery = {}
    } else if (timeRange === 'custom' && customStartDate && customEndDate) {
      // For custom date range
      const customStart = new Date(customStartDate)
      const customEnd = new Date(customEndDate)
      customEnd.setHours(23, 59, 59, 999) // Include the entire end day
      
      // Calculate the previous period with the same duration
      const duration = customEnd.getTime() - customStart.getTime()
      const prevPeriodEnd = new Date(customStart.getTime() - 1)
      const prevPeriodStart = new Date(prevPeriodEnd.getTime() - duration)
      
      currentTransactionsQuery = {
        date: {
          gte: customStart,
          lte: customEnd
        }
      }
      
      previousTransactionsQuery = {
        date: {
          gte: prevPeriodStart,
          lte: prevPeriodEnd
        }
      }
    } else {
      // For standard time ranges (month, quarter, year)
      currentTransactionsQuery = {
        date: {
          gte: startDate,
          lte: now
        }
      }
      
      previousTransactionsQuery = {
        date: {
          gte: previousStartDate,
          lte: previousEndDate
        }
      }
    }

    const [
      currentTransactions,
      previousTransactions
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: currentTransactionsQuery,
        include: { category: true }
      }),
      prisma.transaction.findMany({
        where: previousTransactionsQuery
      })
    ])

    console.log('Current transactions found:', currentTransactions.length)
    console.log('Previous transactions found:', previousTransactions.length)
    
    // Log a few sample transactions if available
    if (currentTransactions.length > 0) {
      console.log('Sample current transaction:', JSON.stringify(currentTransactions[0]))
    }

    const expenses = currentTransactions.filter(t => t.amount < 0)
    console.log('Expense transactions found:', expenses.length)
    
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0))
    const totalIncome = currentTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const netBalance = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0

    console.log('Summary calculations:', {
      totalExpenses,
      totalIncome,
      netBalance,
      savingsRate
    })

    const previousExpenses = Math.abs(previousTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
    const previousIncome = previousTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)

    const expenseChange = previousExpenses ? ((totalExpenses - previousExpenses) / previousExpenses) * 100 : 0
    const incomeChange = previousIncome ? ((totalIncome - previousIncome) / previousIncome) * 100 : 0

    const expensesByCategory = Object.entries(
      expenses.reduce((acc, transaction) => {
        const categoryName = transaction.category?.name || 'Other'
        acc[categoryName] = (acc[categoryName] || 0) + Math.abs(transaction.amount)
        return acc
      }, {} as Record<string, number>)
    ).map(([category, amount]) => ({
      category,
      amount
    }))

    const monthlyData = Array.from(
      currentTransactions.reduce((acc, transaction) => {
        const date = new Date(transaction.date)
        const monthKey = date.toLocaleString('default', { month: 'short' })
        
        if (!acc.has(monthKey)) {
          acc.set(monthKey, { month: monthKey, income: 0, expenses: 0 })
        }
        
        const monthData = acc.get(monthKey)!
        if (transaction.amount > 0) {
          monthData.income += transaction.amount
        } else {
          monthData.expenses += Math.abs(transaction.amount)
        }
        
        return acc
      }, new Map<string, { month: string; income: number; expenses: number }>())
    ).map(([_, data]) => data)

    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    monthlyData.sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month))

    const result = {
      totalIncome,
      totalExpenses,
      netBalance,
      incomeChange,
      expenseChange,
      savingsRate,
      expensesByCategory,
      monthlyData,
    }
    
    console.log('Returning summary result:', JSON.stringify(result))
    return result
  } catch (error) {
    console.error('Error in getTransactionSummary:', error)
    return createEmptySummary()
  }
}

// Helper function to create an empty summary when no data is available
function createEmptySummary(): TransactionSummary {
  return {
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    incomeChange: 0,
    expenseChange: 0,
    savingsRate: 0,
    expensesByCategory: [],
    monthlyData: [],
  }
}

// Helper function to find matching field names in CSV records
function findField(record: any, possibleNames: string[]): string {
  for (const name of possibleNames) {
    if (record[name] !== undefined) {
      return name
    }
  }
  return Object.keys(record)[0] || ""
}

// Regular expression for detecting account numbers
const accountPattern = /\b\d{8,}\b/  // Matches 8 or more consecutive digits

function getAccountNumberFromCSV(csvContent: string): string | null {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      skip_records_with_error: true,
      from_line: 1,
      to_line: 5, // Only check first few lines for account number
    })

    // Look for account number in specific columns or first column
    for (const record of records) {
      // Common account number column names
      const accountFields = [
        "Account No",
        "Account Number",
        "AccountNumber",
        "Account",
        "acc_no",
        "account_no",
      ]

      // Check each possible field name
      for (const field of accountFields) {
        if (record[field]) {
          return record[field].toString().trim()
        }
      }

      // If no specific account field found, check if first column contains an account number
      const firstValue = Object.values(record)[0]
      if (firstValue && /^\d{8,}$/.test(firstValue.toString().trim())) {
        return firstValue.toString().trim()
      }
    }
  } catch (error) {
    console.error("Error parsing CSV for account number:", error)
  }
  return null
}

// Helper function to parse any statement format
function parseStatement(csvContent: string, fileName: string = ""): Transaction[] {
  try {
    if (!csvContent || typeof csvContent !== "string") {
      console.error("Invalid content provided to parseStatement")
      return []
    }

    // First try to get account number from CSV
    const accountFromCSV = getAccountNumberFromCSV(csvContent)
    console.log("Account from CSV:", accountFromCSV)

    // Use filename as the account identifier if no account number found
    const accountIdentifier = accountFromCSV || fileName || "unknown-account"
    console.log("Using account identifier:", accountIdentifier)

    // Try parsing as CSV first
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        skip_records_with_error: true,
        trim: true,
      })

      console.log("Successfully parsed CSV with columns:", records.length > 0 ? Object.keys(records[0]) : [])

      return records
        .map((record: any) => {
          // Look for common field names for each data point
          const accountField = findField(record, [
            "Account No",
            "Account Number",
            "AccountNumber",
            "Account",
            "acc_no",
            "account_no"
          ])
          const dateField = findField(record, ["date", "transaction_date", "trans_date", "Date", "Trans Date"])
          const descriptionField = findField(record, ["description", "desc", "narrative", "details", "Description", "Merchant"])
          const amountField = findField(record, ["amount", "value", "Amount", "Transaction Amount", "Amount (USD)", "Deposits", "Withdrawals"])
          const typeField = findField(record, ["type", "transaction_type", "dc", "Type", "Transaction Type"])

          // Get the account number from the CSV record, falling back to our determined account identifier
          const recordAccountNumber = record[accountField] || Object.values(record)[0]
          const finalAccountId = recordAccountNumber || accountIdentifier

          // Rest of the parsing logic...
          let date = new Date()
          if (record[dateField]) {
            try {
              date = new Date(record[dateField])
              if (isNaN(date.getTime())) {
                // Check for date formats with and without year
                let dateMatch = record[dateField].match(/(\d{2})[/-](\d{2})[/-](\d{2,4})/)
                
                // If no year in the format, try matching just day and month
                if (!dateMatch) {
                  dateMatch = record[dateField].match(/(\d{2})[/-](\d{2})/)
                }
                
                if (dateMatch) {
                  const day = dateMatch[1]
                  const month = dateMatch[2]
                  
                  // If we have a year in the match, use it; otherwise use current year
                  const year = dateMatch[3] ? 
                    (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : 
                    new Date().getFullYear().toString()
                  
                  date = new Date(`${year}-${month}-${day}`)
                }
              }
            } catch (e) {
              date = new Date()
            }
          }

          let amount = 0
          if (record[amountField]) {
            try {
              const cleanedAmount = record[amountField].toString().replace(/[^\d.-]/g, "")
              amount = Number.parseFloat(cleanedAmount) || 0
            } catch (e) {
              amount = 0
            }
          }

          let isCredit = false
          if (record[typeField]) {
            const type = record[typeField].toString().toLowerCase()
            isCredit = type.includes("credit") || type.includes("c") || type === "cr"
          }
          
          const description = record[descriptionField] || "Unknown transaction"
          if (!isCredit) {
            isCredit = description.toLowerCase().includes("payment") ||
                      description.toLowerCase().includes("refund") ||
                      description.toLowerCase().includes("credit") ||
                      description.toLowerCase().includes("deposit")
          }

          if (record["Deposits"] && Number.parseFloat(record["Deposits"]) > 0) {
            isCredit = true
            amount = Number.parseFloat(record["Deposits"])
          }

          if (record["Withdrawals"] && Number.parseFloat(record["Withdrawals"]) > 0) {
            isCredit = false
            amount = Number.parseFloat(record["Withdrawals"])
          }

          const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount)

          return {
            id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            date: date.toISOString(),
            description,
            amount: finalAmount,
            categoryId: null,
            accountId: finalAccountId,
            statementId: `statement-${Date.now()}`
          }
        })
        .filter((tx: Transaction) => !isNaN(tx.amount) && tx.amount !== 0)

    } catch (csvError) {
      console.log("CSV parsing failed, trying plain text parsing:", csvError)
      const lines = csvContent.split("\n")
      const transactions: Transaction[] = []

      lines.forEach((line, i) => {
        const accountMatch = line.match(accountPattern)
        if (accountMatch) {
          return
        }

        // Try to match date with year first
        let dateMatch = line.match(/(\d{2})[/-](\d{2})[/-](\d{2,4})/)
        
        // If no match with year, try matching just day and month
        if (!dateMatch) {
          dateMatch = line.match(/(\d{2})[/-](\d{2})/)
        }
        
        if (dateMatch) {
          const descriptionLine = lines[i + 1] || ""
          const amountLine = lines[i + 2] || ""

          const amountMatch = amountLine.match(/[\d,]+\.\d{2}/)
          if (amountMatch) {
            const amount = Number.parseFloat(amountMatch[0].replace(/,/g, ""))
            const description = descriptionLine.trim() || "Unknown transaction"
            const isCredit = description.toLowerCase().includes("cr") ||
                           description.toLowerCase().includes("credit") ||
                           description.toLowerCase().includes("payment") ||
                           description.toLowerCase().includes("refund") ||
                           description.toLowerCase().includes("deposit")

            transactions.push({
              id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              date: new Date(
                // If we have a year (dateMatch[3]), use it (with 20 prefix if it's 2 digits)
                // Otherwise use the current year
                dateMatch[3] ? 
                  `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : 
                  `${new Date().getFullYear()}-${dateMatch[2]}-${dateMatch[1]}`
              ).toISOString(),
              description,
              amount: isCredit ? Math.abs(amount) : -Math.abs(amount),
              categoryId: null,
              accountId: accountIdentifier,
              statementId: `statement-${Date.now()}`
            })
          }
        }
      })

      return transactions
    }
  } catch (error) {
    console.error("Error parsing statement:", error)
    return []
  }
}
