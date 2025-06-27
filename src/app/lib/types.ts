export interface User {
  id: string
  email: string
  name: string
  role: 'manager' | 'staff'
  reliabilityScore: number
  totalShifts: number
  completedShifts: number
  noShows: number
  averageRating: number
  badges: Badge[]
  createdAt: Date
}

export interface Shift {
  id: string
  role: string
  date: string
  startTime: string
  endTime: string
  payRate: number
  includesTips: boolean
  bonusAvailable: boolean
  overtimePay: boolean
  urgent: boolean
  dynamicPricing: boolean
  notes: string
  status: 'open' | 'pending' | 'confirmed' | 'completed' | 'no-show'
  assignedTo?: string
  assignedAt?: Date
  checkedInAt?: Date
  completedAt?: Date
  rating?: number
  feedback?: string
  createdAt: Date
  templateId?: string
}

export interface ShiftTemplate {
  id: string
  name: string
  role: string
  startTime: string
  endTime: string
  payRate: number
  includesTips: boolean
  bonusAvailable: boolean
  overtimePay: boolean
  notes: string
  daysOfWeek: number[] // 0-6 (Sunday-Saturday)
  createdAt: Date
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  unlockedAt: Date
}

export interface Analytics {
  totalShifts: number
  completedShifts: number
  noShows: number
  totalLaborCost: number
  averagePayRate: number
  reliabilityScore: number
  topPerformers: User[]
  recentActivity: Activity[]
}

export interface Activity {
  id: string
  type: 'shift_created' | 'shift_accepted' | 'shift_completed' | 'no_show' | 'rating_given'
  userId: string
  shiftId: string
  message: string
  timestamp: Date
}

export interface Notification {
  id: string
  userId: string
  type: 'shift_available' | 'shift_reminder' | 'no_show_alert' | 'achievement_unlocked'
  title: string
  message: string
  read: boolean
  createdAt: Date
} 