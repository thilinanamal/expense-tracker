# Income & Expense Tracker

A modern web application for tracking personal finances, managing transactions, and visualizing spending patterns.

![Income & Expense Tracker](https://github.com/thilinanamal/expense-tracker/assets/screenshot.png)

## Features

### Dashboard
- **Financial Summary**: View total income, expenses, and net balance
- **Expense Breakdown**: Visualize spending by category with interactive charts
- **Monthly Trends**: Track income and expense patterns over time
- **Custom Date Filtering**: Select specific date ranges for financial analysis
- **Category Drill-down**: Click on categories to see individual transactions

### Transaction Management
- **Transaction List**: View, search, and filter all transactions
- **Multi-select Operations**: Select and delete multiple transactions at once
- **Categorization**: Assign categories to transactions for better organization
- **Advanced Filtering**:
  - Filter by account, category, date range
  - Special filter for uncategorized transactions
  - Custom date range selection

### Statement Import
- **Automatic Parsing**: Upload bank statements in CSV format
- **Smart Date Handling**: Automatically assigns current year to transactions when year is not specified
- **Multiple Bank Support**: Compatible with various bank statement formats

### Data Management
- **Categories**: Pre-defined categories with color coding
- **Accounts**: Manage multiple bank accounts in one place

## Installation

### Prerequisites
- Node.js (v16 or later)
- pnpm (v7 or later)
- PostgreSQL database

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/expense-tracker.git
cd expense-tracker
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL="mysql://root@localhost:3306/expense_tracker"
GEMINI_API_KEY=your_gemini_api_key_here
```

The `GEMINI_API_KEY` is required for smart statement parsing and can be obtained from [Google AI Studio](https://aistudio.google.com/).

4. **Set up the database**

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

## Running the Application

### Development Mode

```bash
pnpm dev
```

This will start the development server at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
pnpm build
pnpm start
```

## Usage Guide

### Importing Transactions

1. Navigate to the "Upload Statements" tab
2. Select your bank statement file (CSV format)
3. Click "Upload" to process the statement
4. Review imported transactions in the "Manage Transactions" tab

### Managing Transactions

1. Use the search bar to find specific transactions
2. Filter by account, category, or date range
3. Assign categories to transactions using the dropdown menu
4. Use the "Select Multiple" button to enable bulk operations

### Analyzing Finances

1. Visit the Dashboard to see your financial summary
2. Use the time range selector to view data for different periods
3. Click on category segments in the pie chart to see detailed transactions
4. Track your monthly income and expenses in the bar chart

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts

## License

MIT
