/**
 * System Default Categories and Subcategories (Section 8)
 * Available to all users automatically with user_id = NULL
 */

const SYSTEM_CATEGORIES = [
  // Income Categories
  {
    name: 'Salary',
    type: 'INCOME',
    icon: 'AccountBalance',
    color: '#10B981',
    subcategories: ['Base Salary', 'Performance Bonus', 'Overtime', 'Incentives'],
  },
  {
    name: 'Freelance & Business',
    type: 'INCOME',
    icon: 'LaptopMac',
    color: '#06B6D4',
    subcategories: ['Client Projects', 'Consulting', 'Product Sales', 'Affiliate'],
  },
  {
    name: 'Investments & Returns',
    type: 'INCOME',
    icon: 'TrendingUp',
    color: '#8B5CF6',
    subcategories: ['Dividends', 'Interest Income', 'Capital Gains', 'Rental Income'],
  },
  {
    name: 'Other Income',
    type: 'INCOME',
    icon: 'CardGiftcard',
    color: '#EC4899',
    subcategories: ['Gifts', 'Tax Refund', 'Cashback', 'Miscellaneous'],
  },

  // Expense Categories
  {
    name: 'Housing',
    type: 'EXPENSE',
    icon: 'Home',
    color: '#4F46E5',
    subcategories: [
      'House Rent',
      'Maintenance',
      'Society Charges',
      'Property Tax',
      'Home Repair',
      'Furniture',
    ],
  },
  {
    name: 'Food & Dining',
    type: 'EXPENSE',
    icon: 'Restaurant',
    color: '#F97316',
    subcategories: ['Groceries', 'Restaurant', 'Food Delivery', 'Snacks', 'Beverages'],
  },
  {
    name: 'Utilities',
    type: 'EXPENSE',
    icon: 'Lightbulb',
    color: '#F59E0B',
    subcategories: [
      'Electricity Bill',
      'Gas Bill',
      'Water Bill',
      'Mobile Bill',
      'Internet Bill',
      'DTH / Cable',
    ],
  },
  {
    name: 'Transportation',
    type: 'EXPENSE',
    icon: 'DirectionsCar',
    color: '#3B82F6',
    subcategories: [
      'Fuel',
      'Car Maintenance',
      'Bike Maintenance',
      'Taxi & Auto',
      'Public Transport',
      'Parking',
      'Toll',
    ],
  },
  {
    name: 'Loans & EMI',
    type: 'EXPENSE',
    icon: 'AccountBalance',
    color: '#EF4444',
    subcategories: [
      'Home Loan EMI',
      'Car EMI',
      'Bike EMI',
      'Personal Loan EMI',
      'Education Loan',
      'Credit Card EMI',
    ],
  },
  {
    name: 'Healthcare',
    type: 'EXPENSE',
    icon: 'LocalHospital',
    color: '#14B8A6',
    subcategories: ['Doctor Consultation', 'Medicine', 'Hospitalization', 'Health Insurance'],
  },
  {
    name: 'Education',
    type: 'EXPENSE',
    icon: 'School',
    color: '#6366F1',
    subcategories: ['School Fees', 'College Fees', 'Online Courses', 'Books', 'Certifications'],
  },
  {
    name: 'Lifestyle & Entertainment',
    type: 'EXPENSE',
    icon: 'SportsEsports',
    color: '#D946EF',
    subcategories: ['Shopping', 'Movies & Events', 'Travel & Vacation', 'Gym & Fitness', 'Hobbies'],
  },
  {
    name: 'Financial & Savings',
    type: 'EXPENSE',
    icon: 'Savings',
    color: '#10B981',
    subcategories: ['Life Insurance', 'Mutual Funds SIP', 'Stock Purchases', 'Gold', 'Savings Transfer'],
  },
  {
    name: 'Subscriptions',
    type: 'EXPENSE',
    icon: 'Subscriptions',
    color: '#A855F7',
    subcategories: ['Streaming (Netflix, Prime)', 'Music (Spotify)', 'Software & Cloud', 'Memberships'],
  },
  {
    name: 'Miscellaneous',
    type: 'EXPENSE',
    icon: 'MoreHoriz',
    color: '#64748B',
    subcategories: ['Gifts & Celebrations', 'Donations & Charity', 'Other Expenses'],
  },
];

module.exports = SYSTEM_CATEGORIES;
