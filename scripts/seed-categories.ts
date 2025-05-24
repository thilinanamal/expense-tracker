import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = [
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

async function main() {
  console.log('Seeding categories...')
  
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: {
        ...category,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    console.log(`Upserted category: ${category.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
