import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default categories
  const categories = [
    { id: 'groceries', name: 'Groceries', color: '#10B981' }, // emerald-500
    { id: 'dining', name: 'Dining', color: '#F59E0B' }, // amber-500
    { id: 'transportation', name: 'Transportation', color: '#3B82F6' }, // blue-500
    { id: 'utilities', name: 'Utilities', color: '#8B5CF6' }, // violet-500
    { id: 'healthcare', name: 'Healthcare', color: '#EC4899' }, // pink-500
    { id: 'shopping', name: 'Shopping', color: '#F97316' }, // orange-500
    { id: 'entertainment', name: 'Entertainment', color: '#EF4444' }, // red-500
    { id: 'housing', name: 'Housing', color: '#6366F1' }, // indigo-500
    { id: 'education', name: 'Education', color: '#06B6D4' }, // cyan-500
    { id: 'other', name: 'Other', color: '#6B7280' }, // gray-500
  ]

  console.log('Creating categories...')
  
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    })
  }

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })