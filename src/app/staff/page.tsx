'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
  arrayUnion,
  increment,
} from 'firebase/firestore'
import Image from 'next/image'

interface Shift {
  id: string
  role: string
  date: string
  startTime: string
  endTime: string
  payRate: number
  includesTips: boolean
  bonusAvailable: boolean
  overtimePay: boolean
  hidePay: boolean
  notes: string
  status: 'open' | 'pending' | 'confirmed'
  assignedTo?: string
  slots: number
  filledSlots: number
  assignedStaff: string[] // Array of user IDs who have accepted slots
  createdAt: Timestamp
  location?: string // Optional location field
  managerContact?: string // Optional manager contact field
}

// Utility function to format time with AM/PM
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Utility function to format date
function formatDate(dateString: string): string {
  // Parse the date string and ensure it's treated as local time
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed in Date constructor
  
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }
  return date.toLocaleDateString('en-US', options)
}

// Utility function to check if two shifts overlap
function shiftsOverlap(shift1: Shift, shift2: Shift): boolean {
  // If different dates, no overlap
  if (shift1.date !== shift2.date) return false
  
  // Convert times to minutes for easier comparison
  const start1 = timeToMinutes(shift1.startTime)
  const end1 = timeToMinutes(shift1.endTime)
  const start2 = timeToMinutes(shift2.startTime)
  const end2 = timeToMinutes(shift2.endTime)
  
  // Check for overlap: one shift starts before another ends
  return (start1 < end2 && start2 < end1)
}

// Utility function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Reusable Logo Component
const ShiftLystLogo = ({ size = 80, className = '' }: { size?: number; className?: string }) => (
  <div className={`relative ${className}`} style={{ width: size, height: size }}>
    <Image
      src="/assets/shiftlyst_logo.png"
      alt="ShiftLyst Logo"
      width={size}
      height={size}
      className="object-contain rounded-lg"
      priority
    />
  </div>
)

// Navigation Items for Staff
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', color: 'from-blue-500 to-blue-600' },
  { id: 'available', label: 'Available Shifts', icon: '💼', color: 'from-green-500 to-green-600' },
  { id: 'schedule', label: 'My Schedule', icon: '📅', color: 'from-purple-500 to-purple-600' },
  { id: 'profile', label: 'Profile', icon: '👤', color: 'from-orange-500 to-orange-600' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', color: 'from-red-500 to-red-600' },
]

export default function StaffPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [sortBy, setSortBy] = useState<'closest' | 'date' | 'role'>('closest')
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  
  // Navigation state
  const [activeTab, setActiveTab] = useState(() => {
    // Get the active tab from localStorage on initial load
    if (typeof window !== 'undefined') {
      return localStorage.getItem('staffActiveTab') || 'dashboard'
    }
    return 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    phone: '',
    preferredRoles: [] as string[],
    availability: {
      monday: { available: true, startTime: '09:00', endTime: '17:00' },
      tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
      wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
      thursday: { available: true, startTime: '09:00', endTime: '17:00' },
      friday: { available: true, startTime: '09:00', endTime: '17:00' },
      saturday: { available: true, startTime: '09:00', endTime: '17:00' },
      sunday: { available: true, startTime: '09:00', endTime: '17:00' },
    }
  })

  // Handle tab change and persist to localStorage
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('staffActiveTab', tab)
    }
  }

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        router.push('/')
        return
      }
      setCurrentUser(user)
    })

    // Listen for open shifts
    const openShiftsQuery = query(
      collection(db, 'shifts'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeOpenShifts = onSnapshot(
      openShiftsQuery,
      snapshot => {
        const shiftsData: Shift[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          // Handle missing fields gracefully for existing data
          const shiftData: Shift = {
            id: doc.id,
            role: data.role || '',
            date: data.date || '',
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            payRate: data.payRate || 0,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes || '',
            status: data.status || 'open',
            assignedTo: data.assignedTo || undefined,
            slots: data.slots || 1,
            filledSlots: data.filledSlots || 0,
            assignedStaff: data.assignedStaff || [],
            createdAt: data.createdAt || Timestamp.now(),
            location: data.location || undefined,
            managerContact: data.managerContact || undefined,
          }
          shiftsData.push(shiftData)
        })
        setShifts(shiftsData)
        setLoading(false)
      },
      err => {
        setError('Failed to load shifts')
        setLoading(false)
      }
    )

    // Listen for user's accepted shifts (pending and confirmed)
    const myShiftsQuery = query(
      collection(db, 'shifts'),
      where('assignedStaff', 'array-contains', currentUser?.uid || ''),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeMyShifts = onSnapshot(
      myShiftsQuery,
      snapshot => {
        const myShiftsData: Shift[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          myShiftsData.push({
            id: doc.id,
            role: data.role || '',
            date: data.date || '',
            startTime: data.startTime || '',
            endTime: data.endTime || '',
            payRate: data.payRate || 0,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes || '',
            status: data.status || 'open',
            assignedTo: data.assignedTo || undefined,
            slots: data.slots || 1,
            filledSlots: data.filledSlots || 0,
            assignedStaff: data.assignedStaff || [],
            createdAt: data.createdAt || Timestamp.now(),
            location: data.location || undefined,
            managerContact: data.managerContact || undefined,
          })
        })
        setMyShifts(myShiftsData)
      },
      err => {
        console.error('Failed to load my shifts:', err)
      }
    )

    return () => {
      unsubscribeAuth()
      unsubscribeOpenShifts()
      unsubscribeMyShifts()
    }
  }, [router, currentUser?.uid])

  // Function to check if a shift conflicts with existing shifts
  function checkForConflicts(newShift: Shift): Shift | null {
    for (const existingShift of myShifts) {
      if (shiftsOverlap(newShift, existingShift)) {
        return existingShift
      }
    }
    return null
  }

  // Function to sort shifts based on selected criteria
  function sortShifts(shiftsToSort: Shift[]): Shift[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison

    // Helper function to parse date string consistently
    function parseDate(dateString: string): Date {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day) // month is 0-indexed
    }

    return [...shiftsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'closest':
          // Sort by closest upcoming date, then by start time
          const dateA = parseDate(a.date)
          const dateB = parseDate(b.date)
          const timeDiffA = dateA.getTime() - today.getTime()
          const timeDiffB = dateB.getTime() - today.getTime()
          
          // If both dates are in the past, sort by most recent first
          if (timeDiffA < 0 && timeDiffB < 0) {
            return timeDiffB - timeDiffA
          }
          // If one is in the past and one is in the future, future comes first
          if (timeDiffA < 0) return 1
          if (timeDiffB < 0) return -1
          // If both are in the future, closest comes first
          if (timeDiffA !== timeDiffB) {
            return timeDiffA - timeDiffB
          }
          // If same date, sort by start time
          return a.startTime.localeCompare(b.startTime)
          
        case 'date':
          // Sort by date, then by start time
          const dateCompare = a.date.localeCompare(b.date)
          return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime)
          
        case 'role':
          // Sort by role, then by date
          const roleCompare = a.role.localeCompare(b.role)
          return roleCompare !== 0 ? roleCompare : a.date.localeCompare(b.date)
          
        default:
          return 0
      }
    })
  }

  async function handleAcceptShift(shiftId: string) {
    if (!currentUser) return
    
    // Find the shift to accept
    const shiftToAccept = shifts.find(s => s.id === shiftId)
    if (!shiftToAccept) {
      setError('Shift not found')
      return
    }
    
    // Check if user has already accepted this shift
    const assignedStaff = shiftToAccept.assignedStaff || []
    if (assignedStaff.includes(currentUser.uid)) {
      setError('You have already accepted this shift.')
      return
    }
    
    // Check if slots are available
    const currentFilledSlots = shiftToAccept.filledSlots || 0
    const totalSlots = shiftToAccept.slots || 1
    if (currentFilledSlots >= totalSlots) {
      setError('Sorry, all positions for this shift have been filled.')
      return
    }
    
    // Check for conflicts
    const conflictingShift = checkForConflicts(shiftToAccept)
    if (conflictingShift) {
      setError(`Schedule conflict! You already have a ${conflictingShift.role} shift on ${formatDate(conflictingShift.date)} from ${formatTime(conflictingShift.startTime)} to ${formatTime(conflictingShift.endTime)}.`)
      return
    }
    
    try {
      const shiftRef = doc(db, 'shifts', shiftId)
      await updateDoc(shiftRef, {
        filledSlots: currentFilledSlots + 1,
        assignedStaff: [...assignedStaff, currentUser.uid],
        status: 'pending',
        assignedAt: Timestamp.now()
      })
      setError('') // Clear any previous errors
      setSuccess(`Successfully accepted ${shiftToAccept.role} shift!`)
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to accept shift')
    }
  }

  async function handleLogout() {
    await signOut(auth)
    router.push('/')
  }

  // Function to open shift details modal
  function openShiftModal(shift: Shift) {
    setSelectedShift(shift)
    setShowShiftModal(true)
  }

  // Function to close shift details modal
  function closeShiftModal() {
    setSelectedShift(null)
    setShowShiftModal(false)
  }

  // Function to handle shift acceptance from modal
  async function handleAcceptShiftFromModal() {
    if (selectedShift) {
      await handleAcceptShift(selectedShift.id)
      closeShiftModal()
    }
  }

  // Function to open profile modal
  function openProfileModal() {
    setShowProfileModal(true)
  }

  // Function to close profile modal
  function closeProfileModal() {
    setShowProfileModal(false)
  }

  // Function to save profile
  async function saveProfile() {
    if (!currentUser) return
    
    try {
      const userRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userRef, {
        profile: userProfile,
        updatedAt: Timestamp.now()
      })
      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
      closeProfileModal()
    } catch (err) {
      setError('Failed to update profile')
    }
  }

  // Function to toggle day availability
  function toggleDayAvailability(day: string) {
    setUserProfile(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day as keyof typeof prev.availability],
          available: !prev.availability[day as keyof typeof prev.availability].available
        }
      }
    }))
  }

  // Function to update time range
  function updateTimeRange(day: string, field: 'startTime' | 'endTime', value: string) {
    setUserProfile(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day as keyof typeof prev.availability],
          [field]: value
        }
      }
    }))
  }

  // Calendar view component
  function CalendarView({ shifts }: { shifts: Shift[] }) {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    // Generate calendar days
    const calendarDays = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null)
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day)
    }
    
    // Get shifts for current month
    const monthShifts = shifts.filter(shift => {
      const [year, month] = shift.date.split('-').map(Number)
      return year === currentYear && month === currentMonth + 1
    })
    
    // Group shifts by day
    const shiftsByDay = monthShifts.reduce((acc, shift) => {
      const day = parseInt(shift.date.split('-')[2])
      if (!acc[day]) acc[day] = []
      acc[day].push(shift)
      return acc
    }, {} as Record<number, Shift[]>)
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="p-2 text-center text-sm font-bold text-gray-600">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`min-h-[80px] p-2 border border-gray-100 ${
                day === today.getDate() ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
              }`}
            >
              {day && (
                <>
                  <div className={`text-sm font-bold mb-1 ${
                    day === today.getDate() ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {day}
                  </div>
                  {shiftsByDay[day] && (
                    <div className="space-y-1">
                      {shiftsByDay[day].map(shift => (
                        <div
                          key={shift.id}
                          onClick={() => openShiftModal(shift)}
                          className="bg-[#D5001C] text-white text-xs p-1 rounded cursor-pointer hover:bg-[#B0001A] transition-colors"
                          title={`${shift.role} - ${formatTime(shift.startTime)}-${formatTime(shift.endTime)}`}
                        >
                          <div className="font-bold truncate">{shift.role}</div>
                          <div className="text-[10px] opacity-90">
                            {formatTime(shift.startTime)}-{formatTime(shift.endTime)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
      {/* Enhanced Porsche-style background with animated particles */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        
        {/* Animated floating particles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        
        {/* Additional subtle particles */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-[#D5001C]/2 rounded-full blur-2xl animate-pulse" style={{animationDelay: '3s'}}></div>
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Success Toast */}
        {success && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold transition-all duration-300 z-[100] animate-fade-in backdrop-blur-sm border border-green-400/20">
            {success}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold transition-all duration-300 z-[100] animate-fade-in backdrop-blur-sm border border-red-400/20">
            {error}
          </div>
        )}
        
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <ShiftLystLogo size={60} className="mr-0" />
            <div>
              <h1 className="text-5xl font-black text-white mb-3 tracking-tight">
                Shift<span className="text-[#D5001C]">Lyst</span> Staff
              </h1>
              <p className="text-gray-300 text-xl font-light tracking-wide mb-1">Find and claim your next shift</p>
              <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Premium Opportunities • Real-time Updates</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openProfileModal}
              className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-6 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02] flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
            <button
              onClick={handleLogout}
              className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Shift Details Modal */}
        {showShiftModal && selectedShift && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white rounded-t-3xl p-8 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedShift.role}</h2>
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold text-sm">{formatDate(selectedShift.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold text-sm">
                          {formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeShiftModal}
                    className="bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6">
                {/* Pay Rate Section */}
                {!selectedShift.hidePay && (
                  <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white rounded-2xl p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium opacity-90 mb-1">Pay Rate</div>
                        <div className="text-3xl font-bold">${selectedShift.payRate.toFixed(2)}/hr</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium opacity-90 mb-1">Estimated Total</div>
                        <div className="text-2xl font-bold">
                          ${(selectedShift.payRate * (timeToMinutes(selectedShift.endTime) - timeToMinutes(selectedShift.startTime)) / 60).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Benefits Section */}
                {(selectedShift.includesTips || selectedShift.bonusAvailable || selectedShift.overtimePay) && (
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Benefits & Perks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedShift.includesTips && (
                        <div className="bg-green-100 text-green-700 rounded-xl p-4 text-center">
                          <div className="text-2xl mb-2">💰</div>
                          <div className="font-bold text-sm">Tips Included</div>
                        </div>
                      )}
                      {selectedShift.bonusAvailable && (
                        <div className="bg-yellow-100 text-yellow-700 rounded-xl p-4 text-center">
                          <div className="text-2xl mb-2">🎁</div>
                          <div className="font-bold text-sm">Bonus Available</div>
                        </div>
                      )}
                      {selectedShift.overtimePay && (
                        <div className="bg-purple-100 text-purple-700 rounded-xl p-4 text-center">
                          <div className="text-2xl mb-2">⏰</div>
                          <div className="font-bold text-sm">Overtime Pay</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location Section */}
                {selectedShift.location && (
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </h3>
                    <p className="text-gray-700 font-medium">{selectedShift.location}</p>
                  </div>
                )}

                {/* Manager Contact Section */}
                {selectedShift.managerContact && (
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Manager Contact
                    </h3>
                    <p className="text-gray-700 font-medium">{selectedShift.managerContact}</p>
                  </div>
                )}

                {/* Notes Section */}
                {selectedShift.notes && (
                  <div className="bg-gray-50 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Additional Notes
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{selectedShift.notes}</p>
                  </div>
                )}

                {/* Availability Section */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Availability
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-700 rounded-xl px-4 py-2">
                      <span className="font-bold text-sm">
                        {selectedShift.filledSlots || 0}/{selectedShift.slots || 1} positions filled
                      </span>
                    </div>
                    {selectedShift.status === 'open' && (
                      <div className="bg-green-100 text-green-700 rounded-xl px-4 py-2">
                        <span className="font-bold text-sm">Open for applications</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white rounded-b-3xl p-8 border-t border-gray-100">
                <div className="flex gap-4">
                  <button
                    onClick={closeShiftModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-xl transition-colors duration-200"
                  >
                    Close
                  </button>
                  {selectedShift.status === 'open' && !selectedShift.hidePay && (
                    <button
                      onClick={handleAcceptShiftFromModal}
                      disabled={
                        checkForConflicts(selectedShift) !== null ||
                        (selectedShift.filledSlots || 0) >= (selectedShift.slots || 1) ||
                        (selectedShift.assignedStaff || []).includes(currentUser?.uid || '')
                      }
                      className={`flex-1 font-bold py-4 px-6 rounded-xl transition-all duration-200 ${
                        checkForConflicts(selectedShift) !== null ||
                        (selectedShift.filledSlots || 0) >= (selectedShift.slots || 1) ||
                        (selectedShift.assignedStaff || []).includes(currentUser?.uid || '')
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white hover:shadow-xl transform hover:scale-[1.02]'
                      }`}
                    >
                      {checkForConflicts(selectedShift) !== null 
                        ? 'Schedule Conflict' 
                        : (selectedShift.filledSlots || 0) >= (selectedShift.slots || 1)
                        ? 'All Positions Filled'
                        : (selectedShift.assignedStaff || []).includes(currentUser?.uid || '')
                        ? 'Already Accepted'
                        : 'Accept Shift'
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white rounded-t-3xl p-8 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Profile & Availability</h2>
                    <p className="text-gray-600">Manage your profile and set your availability preferences</p>
                  </div>
                  <button
                    onClick={closeProfileModal}
                    className="bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-8">
                {/* Personal Information */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={userProfile.name}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={userProfile.email}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={userProfile.phone}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200"
                        placeholder="Enter your phone number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Preferred Roles</label>
                      <input
                        type="text"
                        value={userProfile.preferredRoles.join(', ')}
                        onChange={(e) => setUserProfile(prev => ({ 
                          ...prev, 
                          preferredRoles: e.target.value.split(',').map(role => role.trim()).filter(role => role)
                        }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200"
                        placeholder="Server, Bartender, Host (comma separated)"
                      />
                    </div>
                  </div>
                </div>

                {/* Availability Schedule */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Weekly Availability</h3>
                  <div className="space-y-4">
                    {Object.entries(userProfile.availability).map(([day, schedule]) => (
                      <div key={day} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
                        <div className="w-24">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={schedule.available}
                              onChange={() => toggleDayAvailability(day)}
                              className="w-4 h-4 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                            />
                            <span className="font-bold text-gray-900 capitalize">{day}</span>
                          </label>
                        </div>
                        {schedule.available && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={schedule.startTime}
                              onChange={(e) => updateTimeRange(day, 'startTime', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                              type="time"
                              value={schedule.endTime}
                              onChange={(e) => updateTimeRange(day, 'endTime', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => {
                        setUserProfile(prev => ({
                          ...prev,
                          availability: {
                            monday: { available: true, startTime: '09:00', endTime: '17:00' },
                            tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
                            wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
                            thursday: { available: true, startTime: '09:00', endTime: '17:00' },
                            friday: { available: true, startTime: '09:00', endTime: '17:00' },
                            saturday: { available: false, startTime: '09:00', endTime: '17:00' },
                            sunday: { available: false, startTime: '09:00', endTime: '17:00' },
                          }
                        }))
                      }}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
                    >
                      Weekdays Only
                    </button>
                    <button
                      onClick={() => {
                        setUserProfile(prev => ({
                          ...prev,
                          availability: {
                            monday: { available: true, startTime: '09:00', endTime: '17:00' },
                            tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
                            wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
                            thursday: { available: true, startTime: '09:00', endTime: '17:00' },
                            friday: { available: true, startTime: '09:00', endTime: '17:00' },
                            saturday: { available: true, startTime: '09:00', endTime: '17:00' },
                            sunday: { available: true, startTime: '09:00', endTime: '17:00' },
                          }
                        }))
                      }}
                      className="bg-green-100 hover:bg-green-200 text-green-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
                    >
                      All Days
                    </button>
                    <button
                      onClick={() => {
                        setUserProfile(prev => ({
                          ...prev,
                          availability: {
                            monday: { available: false, startTime: '09:00', endTime: '17:00' },
                            tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
                            wednesday: { available: false, startTime: '09:00', endTime: '17:00' },
                            thursday: { available: false, startTime: '09:00', endTime: '17:00' },
                            friday: { available: false, startTime: '09:00', endTime: '17:00' },
                            saturday: { available: false, startTime: '09:00', endTime: '17:00' },
                            sunday: { available: false, startTime: '09:00', endTime: '17:00' },
                          }
                        }))
                      }}
                      className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white rounded-b-3xl p-8 border-t border-gray-100">
                <div className="flex gap-4">
                  <button
                    onClick={closeProfileModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-xl transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfile}
                    className="flex-1 bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    Save Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Enhanced Available Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle form glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">💼</span>
              </div>
              Available Shifts
            </h2>

            {/* Sort Controls */}
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Sort by:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'closest' | 'date' | 'role')}
                  className="bg-gray-50/80 border-2 border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                >
                  <option value="closest">Closest Upcoming</option>
                  <option value="date">Date</option>
                  <option value="role">Role</option>
                </select>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {shifts.length} shift{shifts.length !== 1 ? 's' : ''} available
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 relative z-10">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-gray-400 text-3xl">🔍</span>
                </div>
                <p className="text-gray-600 text-xl font-bold mb-2">No shifts available</p>
                <p className="text-gray-400 text-sm font-medium tracking-wide">Check back later for new opportunities</p>
              </div>
            ) : (
              <div className="space-y-6 relative z-10 max-h-96 overflow-y-auto pr-2">
                {sortShifts(shifts).map((shift) => {
                  const conflictingShift = checkForConflicts(shift)
                  const hasConflict = conflictingShift !== null
                  
                  return (
                    <div
                      key={shift.id}
                      className={`bg-gradient-to-br from-gray-50/90 to-white/90 backdrop-blur-sm border-2 rounded-3xl p-8 transition-all duration-300 group cursor-pointer ${
                        hasConflict 
                          ? 'border-red-200/80 hover:border-red-300/80 bg-red-50/30' 
                          : 'border-gray-200/80 hover:border-[#D5001C]/40 hover:shadow-xl'
                      }`}
                      onClick={() => openShiftModal(shift)}
                    >
                      {/* Header with role and pay */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">
                            {shift.role}
                          </h3>
                          <div className="flex items-center gap-4 text-gray-600">
                            <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-semibold text-sm">
                                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-50/80 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="text-blue-700 font-semibold text-sm">
                                {shift.filledSlots || 0}/{shift.slots || 1} positions filled
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {!shift.hidePay && (
                          <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-4 py-2 rounded-xl shadow-lg">
                            <div className="text-xs font-medium opacity-90">Pay Rate</div>
                            <div className="text-lg font-bold">${shift.payRate.toFixed(2)}/hr</div>
                          </div>
                        )}
                      </div>

                      {/* Conflict warning */}
                      {hasConflict && (
                        <div className="bg-red-50/80 border-2 border-red-200 rounded-2xl p-4 mb-6">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div>
                              <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Schedule Conflict</div>
                              <p className="text-red-700 text-sm font-medium">
                                You already have a {conflictingShift!.role} shift on {formatDate(conflictingShift!.date)} from {formatTime(conflictingShift!.startTime)} to {formatTime(conflictingShift!.endTime)}.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Benefits badges */}
                      {(shift.includesTips || shift.bonusAvailable || shift.overtimePay) && (
                        <div className="flex gap-2 mb-6">
                          {shift.includesTips && (
                            <span className="bg-green-100/80 text-green-700 text-xs font-bold px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                              <span>💰</span>
                              <span>Tips Included</span>
                            </span>
                          )}
                          {shift.bonusAvailable && (
                            <span className="bg-yellow-100/80 text-yellow-700 text-xs font-bold px-3 py-2 rounded-xl border border-yellow-200 flex items-center gap-1">
                              <span>🎁</span>
                              <span>Bonus Available</span>
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-purple-100/80 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1">
                              <span>⏰</span>
                              <span>Overtime Pay</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes section */}
                      {shift.notes && (
                        <div className="bg-white/70 rounded-2xl p-4 mb-6 border border-gray-100">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</div>
                              <p className="text-gray-700 font-medium">{shift.notes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action button */}
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Click to view details
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation() // Prevent modal from opening
                            handleAcceptShift(shift.id)
                          }}
                          disabled={hasConflict || (shift.filledSlots || 0) >= (shift.slots || 1) || (shift.assignedStaff || []).includes(currentUser?.uid || '')}
                          className={`font-bold py-3 px-8 rounded-xl shadow-lg transition-all duration-300 text-sm ${
                            hasConflict || (shift.filledSlots || 0) >= (shift.slots || 1) || (shift.assignedStaff || []).includes(currentUser?.uid || '')
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white hover:shadow-xl transform hover:scale-[1.02]'
                          }`}
                        >
                          {hasConflict 
                            ? 'Schedule Conflict' 
                            : (shift.filledSlots || 0) >= (shift.slots || 1)
                            ? 'All Positions Filled'
                            : (shift.assignedStaff || []).includes(currentUser?.uid || '')
                            ? 'Already Accepted'
                            : 'Accept Shift'
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Enhanced My Shifts */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle form glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">📋</span>
              </div>
              My Shifts
            </h2>

            {/* View Toggle */}
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  View:
                </label>
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-white text-[#D5001C] shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                      viewMode === 'calendar'
                        ? 'bg-white text-[#D5001C] shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-500 font-medium">
                {myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} accepted
              </div>
            </div>

            {myShifts.length === 0 ? (
              <div className="text-center py-12 relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-gray-400 text-3xl">📅</span>
                </div>
                <p className="text-gray-600 text-xl font-bold mb-2">No shifts accepted yet</p>
                <p className="text-gray-400 text-sm font-medium tracking-wide">Accept a shift from the left to get started</p>
              </div>
            ) : viewMode === 'calendar' ? (
              <div className="relative z-10">
                <CalendarView shifts={myShifts} />
              </div>
            ) : (
              <div className="space-y-6 relative z-10">
                {myShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gradient-to-br from-gray-50/90 to-white/90 backdrop-blur-sm border-2 border-gray-200/80 rounded-3xl p-8 hover:border-[#D5001C]/40 hover:shadow-xl transition-all duration-300 group cursor-pointer"
                    onClick={() => openShiftModal(shift)}
                  >
                    {/* Header with role and pay */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#D5001C] transition-colors duration-300">
                          {shift.role}
                        </h3>
                        <div className="flex items-center gap-4 text-gray-600">
                          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-sm">
                              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {!shift.hidePay && (
                        <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] text-white px-4 py-2 rounded-xl shadow-lg">
                          <div className="text-xs font-medium opacity-90">Pay Rate</div>
                          <div className="text-lg font-bold">${shift.payRate.toFixed(2)}/hr</div>
                        </div>
                      )}
                    </div>

                    {/* Benefits badges */}
                    {(shift.includesTips || shift.bonusAvailable || shift.overtimePay) && (
                      <div className="flex gap-2 mb-6">
                        {shift.includesTips && (
                          <span className="bg-green-100/80 text-green-700 text-xs font-bold px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                            <span>💰</span>
                            <span>Tips Included</span>
                          </span>
                        )}
                        {shift.bonusAvailable && (
                          <span className="bg-yellow-100/80 text-yellow-700 text-xs font-bold px-3 py-2 rounded-xl border border-yellow-200 flex items-center gap-1">
                            <span>🎁</span>
                            <span>Bonus Available</span>
                          </span>
                        )}
                        {shift.overtimePay && (
                          <span className="bg-purple-100/80 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1">
                            <span>⏰</span>
                            <span>Overtime Pay</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Notes section */}
                    {shift.notes && (
                      <div className="bg-white/70 rounded-2xl p-4 mb-6 border border-gray-100">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</div>
                            <p className="text-gray-700 font-medium">{shift.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Click to view details
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                        shift.status === 'pending' 
                          ? 'bg-yellow-100/80 text-yellow-700 border-yellow-200'
                          : 'bg-green-100/80 text-green-700 border-green-200'
                      }`}>
                        {shift.status === 'pending' ? '⏳ Pending Approval' : '✅ Confirmed'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
} 