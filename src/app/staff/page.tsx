'use client'

import { useState, useEffect, useCallback } from 'react'
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
  getDoc,
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
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const [sortBy, setSortBy] = useState<'closest' | 'date' | 'role'>('closest')
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Load active tab from localStorage on client side only
  useEffect(() => {
    const savedTab = localStorage.getItem('staffActiveTab')
    if (savedTab) {
      setActiveTab(savedTab)
    }
  }, [])

  // Clear any existing errors when component mounts
  useEffect(() => {
    setError('')
  }, [])

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

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
      setIsAuthenticating(false)
      
      // Load user profile data
      const loadUserProfile = async () => {
        try {
          const userRef = doc(db, 'users', user.uid)
          const userDoc = await getDoc(userRef)
          if (userDoc.exists() && userDoc.data().profile) {
            const profileData = userDoc.data().profile
            setUserProfile(prev => ({
              ...prev,
              ...profileData,
              // Ensure availability has default values
              availability: {
                monday: { available: true, startTime: '09:00', endTime: '17:00' },
                tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
                wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
                thursday: { available: true, startTime: '09:00', endTime: '17:00' },
                friday: { available: true, startTime: '09:00', endTime: '17:00' },
                saturday: { available: true, startTime: '09:00', endTime: '17:00' },
                sunday: { available: true, startTime: '09:00', endTime: '17:00' },
                ...profileData.availability
              }
            }))
          }
        } catch (err) {
          console.error('Failed to load user profile:', err)
        }
      }
      
      loadUserProfile()
    })

    // Only set up shift listeners if user is authenticated
    if (!currentUser) {
      return () => {
        unsubscribeAuth()
      }
    }

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
        // Clear any previous errors when data loads successfully
        setError('')
      },
      err => {
        console.error('Error loading shifts:', err)
        // Only set error for critical failures, not during normal loading states
        if (!isAuthenticating) {
          if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
            setError('Network error - please check your connection')
          } else if (err.code !== 'permission-denied' && 
                     err.code !== 'unauthenticated' && 
                     err.code !== 'not-found' &&
                     !err.message?.includes('permission')) {
            // Only show error for unexpected failures
            setError('Failed to load shifts')
          }
        }
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
        // Only log the error, don't show it to the user as it's not critical
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

  // Wrapper function to safely update user profile
  const updateUserProfile = useCallback((updater: (prev: any) => any) => {
    setUserProfile(prev => {
      const newState = updater(prev)
      // Only create new object if state actually changed
      return newState
    })
  }, [])

  // Individual field update functions to prevent unnecessary re-renders
  const updateName = useCallback((name: string) => {
    setUserProfile(prev => ({ ...prev, name }))
  }, [])

  const updateEmail = useCallback((email: string) => {
    setUserProfile(prev => ({ ...prev, email }))
  }, [])

  const updatePhone = useCallback((phone: string) => {
    setUserProfile(prev => ({ ...prev, phone }))
  }, [])

  const updatePreferredRoles = useCallback((roles: string) => {
    const roleArray = roles.split(',').map((role: string) => role.trim()).filter((role: string) => role)
    setUserProfile(prev => ({ ...prev, preferredRoles: roleArray }))
  }, [])

  // Individual availability update functions
  const updateAvailability = useCallback((availability: any) => {
    setUserProfile(prev => ({ ...prev, availability }))
  }, [])

  const updateTimeRange = useCallback((day: string, field: 'startTime' | 'endTime', value: string) => {
    setUserProfile(prev => {
      const newAvailability = { ...prev.availability }
      newAvailability[day as keyof typeof prev.availability] = {
        ...newAvailability[day as keyof typeof prev.availability],
        [field]: value
      }
      return {
        ...prev,
        availability: newAvailability
      }
    })
  }, [])

  const toggleDayAvailability = useCallback((day: string) => {
    setUserProfile(prev => {
      const newAvailability = { ...prev.availability }
      newAvailability[day as keyof typeof prev.availability] = {
        ...newAvailability[day as keyof typeof prev.availability],
        available: !newAvailability[day as keyof typeof prev.availability].available
      }
      return {
        ...prev,
        availability: newAvailability
      }
    })
  }, [])

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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab shifts={myShifts} availableShifts={shifts} />
      case 'available':
        return <AvailableShiftsTab shifts={shifts} sortBy={sortBy} setSortBy={setSortBy} loading={loading} />
      case 'schedule':
        return <ScheduleTab shifts={myShifts} viewMode={viewMode} setViewMode={setViewMode} />
      case 'profile':
        return <ProfileTab userProfile={userProfile} saveProfile={saveProfile} />
      case 'notifications':
        return <NotificationsTab />
      default:
        return <DashboardTab shifts={myShifts} availableShifts={shifts} />
    }
  }

  // Dashboard Tab Component
  function DashboardTab({ shifts, availableShifts }: { shifts: Shift[], availableShifts: Shift[] }) {
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]
    
    // Get next shift
    const nextShift = shifts
      .filter(shift => shift.date >= todayString)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    
    // Calculate total earnings this month
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const monthShifts = shifts.filter(shift => {
      const [year, month] = shift.date.split('-').map(Number)
      return year === currentYear && month === currentMonth + 1
    })
    
    const totalEarnings = monthShifts.reduce((total, shift) => {
      const hours = (timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) / 60
      return total + (shift.payRate * hours)
    }, 0)
    
    // Get upcoming shifts (next 7 days)
    const upcomingShifts = shifts
      .filter(shift => {
        const shiftDate = new Date(shift.date)
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        return shiftDate >= today && shiftDate <= weekFromNow
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
    
    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Shifts</p>
                <p className="text-3xl font-bold text-gray-900">{shifts.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">This Month</p>
                <p className="text-3xl font-bold text-gray-900">${totalEarnings.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Available</p>
                <p className="text-3xl font-bold text-gray-900">{availableShifts.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💼</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-gray-900">
                  {shifts.filter(s => s.status === 'pending').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Shift Card */}
        {nextShift && (
          <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Next Shift</h3>
                <p className="text-2xl font-bold mb-1">{nextShift.role}</p>
                <p className="text-lg opacity-90">{formatDate(nextShift.date)} • {formatTime(nextShift.startTime)} - {formatTime(nextShift.endTime)}</p>
                <p className="text-lg font-bold mt-2">${nextShift.payRate.toFixed(2)}/hr</p>
              </div>
              <div className="text-right">
                <button
                  onClick={() => openShiftModal(nextShift)}
                  className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Shifts */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Shifts</h3>
          {upcomingShifts.length > 0 ? (
            <div className="space-y-4">
              {upcomingShifts.map(shift => (
                <div
                  key={shift.id}
                  onClick={() => openShiftModal(shift)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-bold text-gray-900">{shift.role}</p>
                    <p className="text-gray-600">{formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${shift.payRate.toFixed(2)}/hr</p>
                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                      shift.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {shift.status === 'pending' ? 'Pending' : 'Confirmed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No upcoming shifts</p>
          )}
        </div>
      </div>
    )
  }

  // Available Shifts Tab Component
  function AvailableShiftsTab({ shifts, sortBy, setSortBy, loading }: { shifts: Shift[], sortBy: string, setSortBy: (value: any) => void, loading: boolean }) {
    return (
      <div className="space-y-6">
        {/* Sort Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'closest' | 'date' | 'role')}
              className="bg-white border-2 border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
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
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin"></div>
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-gray-400 text-3xl">🔍</span>
            </div>
            <p className="text-gray-600 text-xl font-bold mb-2">No shifts available</p>
            <p className="text-gray-400 text-sm">Check back later for new opportunities</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {sortShifts(shifts).map((shift) => {
              const conflictingShift = checkForConflicts(shift)
              const hasConflict = conflictingShift !== null
              
              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => openShiftModal(shift)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                      <div className="flex items-center gap-4 text-gray-600">
                        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
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
                    <div className="flex gap-2 mb-4">
                      {shift.includesTips && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                          <span>💰</span>
                          <span>Tips Included</span>
                        </span>
                      )}
                      {shift.bonusAvailable && (
                        <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-2 rounded-xl border border-yellow-200 flex items-center gap-1">
                          <span>🎁</span>
                          <span>Bonus Available</span>
                        </span>
                      )}
                      {shift.overtimePay && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1">
                          <span>⏰</span>
                          <span>Overtime Pay</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action button */}
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
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
    )
  }

  // Schedule Tab Component
  function ScheduleTab({ shifts, viewMode, setViewMode }: { shifts: Shift[], viewMode: string, setViewMode: (value: any) => void }) {
    return (
      <div className="space-y-6">
        {/* View Toggle */}
        <div className="flex justify-between items-center">
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
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-gray-400 text-3xl">📅</span>
            </div>
            <p className="text-gray-600 text-xl font-bold mb-2">No shifts scheduled</p>
            <p className="text-gray-400 text-sm">Accept a shift from Available Shifts to get started</p>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView shifts={shifts} />
        ) : (
          <div className="grid gap-6">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => openShiftModal(shift)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold text-sm">{formatDate(shift.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
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

                {/* Status badge */}
                <div className="flex justify-end">
                  <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                    shift.status === 'pending' 
                      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      : 'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    {shift.status === 'pending' ? '⏳ Pending Approval' : '✅ Confirmed'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Profile Tab Component
  function ProfileTab({ userProfile, saveProfile }: { userProfile: any, saveProfile: any }) {
    // Use local state for form data to prevent re-render issues
    const [formData, setFormData] = useState<{
      name: string;
      email: string;
      phone: string;
      preferredRoles: string[];
      availability: any;
    }>({
      name: userProfile.name || '',
      email: userProfile.email || '',
      phone: userProfile.phone || '',
      preferredRoles: userProfile.preferredRoles || [],
      availability: userProfile.availability || {
        monday: { available: true, startTime: '09:00', endTime: '17:00' },
        tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
        thursday: { available: true, startTime: '09:00', endTime: '17:00' },
        friday: { available: true, startTime: '09:00', endTime: '17:00' },
        saturday: { available: true, startTime: '09:00', endTime: '17:00' },
        sunday: { available: true, startTime: '09:00', endTime: '17:00' },
      }
    })

    // Update local state when userProfile changes
    useEffect(() => {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        preferredRoles: userProfile.preferredRoles || [],
        availability: userProfile.availability || {
          monday: { available: true, startTime: '09:00', endTime: '17:00' },
          tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
          wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
          thursday: { available: true, startTime: '09:00', endTime: '17:00' },
          friday: { available: true, startTime: '09:00', endTime: '17:00' },
          saturday: { available: true, startTime: '09:00', endTime: '17:00' },
          sunday: { available: true, startTime: '09:00', endTime: '17:00' },
        }
      })
    }, [userProfile])

    // Handle form submission
    const handleSaveProfile = async () => {
      try {
        // Update the global userProfile state first
        setUserProfile(formData)
        
        // Save to Firestore
        if (currentUser) {
          const userRef = doc(db, 'users', currentUser.uid)
          await updateDoc(userRef, {
            profile: formData,
            updatedAt: Timestamp.now()
          })
          setSuccess('Profile updated successfully!')
          setTimeout(() => setSuccess(''), 3000)
        }
      } catch (err) {
        setError('Failed to update profile')
        console.error('Error saving profile:', err)
      }
    }

    // Add error boundary
    if (!userProfile) {
      console.error('userProfile is null or undefined')
      return (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Profile</h3>
          <p className="text-red-600">Error loading profile data. Please refresh the page.</p>
        </div>
      )
    }

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Enter your phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Preferred Roles</label>
              <input
                type="text"
                value={formData.preferredRoles.join(', ')}
                onChange={(e) => setFormData({
                  ...formData, 
                  preferredRoles: e.target.value.split(',').map((role: string) => role.trim()).filter((role: string) => role)
                })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                placeholder="Server, Bartender, Host (comma separated)"
              />
            </div>
          </div>
        </div>

        {/* Availability Schedule */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Weekly Availability</h3>
          <div className="space-y-4">
            {Object.entries(formData.availability).map(([day, schedule]: [string, any]) => (
              <div key={day} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-24">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={schedule.available}
                      onChange={() => setFormData({
                        ...formData,
                        availability: {
                          ...formData.availability,
                          [day]: {
                            ...formData.availability[day],
                            available: !formData.availability[day].available
                          }
                        }
                      })}
                      className="w-4 h-4 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="font-bold text-gray-900 capitalize">{day}</span>
                  </label>
                </div>
                {schedule.available && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={schedule.startTime || '09:00'}
                      onChange={(e) => setFormData({
                        ...formData,
                        availability: {
                          ...formData.availability,
                          [day]: {
                            ...formData.availability[day],
                            startTime: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none bg-white text-gray-900"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={schedule.endTime || '17:00'}
                      onChange={(e) => setFormData({
                        ...formData,
                        availability: {
                          ...formData.availability,
                          [day]: {
                            ...formData.availability[day],
                            endTime: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none bg-white text-gray-900"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setFormData({
                ...formData,
                availability: {
                  monday: { available: true, startTime: '09:00', endTime: '17:00' },
                  tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
                  wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
                  thursday: { available: true, startTime: '09:00', endTime: '17:00' },
                  friday: { available: true, startTime: '09:00', endTime: '17:00' },
                  saturday: { available: false, startTime: '09:00', endTime: '17:00' },
                  sunday: { available: false, startTime: '09:00', endTime: '17:00' },
                }
              })}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
            >
              Weekdays Only
            </button>
            <button
              onClick={() => setFormData({
                ...formData,
                availability: {
                  monday: { available: true, startTime: '09:00', endTime: '17:00' },
                  tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
                  wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
                  thursday: { available: true, startTime: '09:00', endTime: '17:00' },
                  friday: { available: true, startTime: '09:00', endTime: '17:00' },
                  saturday: { available: true, startTime: '09:00', endTime: '17:00' },
                  sunday: { available: true, startTime: '09:00', endTime: '17:00' },
                }
              })}
              className="bg-green-100 hover:bg-green-200 text-green-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
            >
              All Days
            </button>
            <button
              onClick={() => setFormData({
                ...formData,
                availability: {
                  monday: { available: false, startTime: '09:00', endTime: '17:00' },
                  tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
                  wednesday: { available: false, startTime: '09:00', endTime: '17:00' },
                  thursday: { available: false, startTime: '09:00', endTime: '17:00' },
                  friday: { available: false, startTime: '09:00', endTime: '17:00' },
                  saturday: { available: false, startTime: '09:00', endTime: '17:00' },
                  sunday: { available: false, startTime: '09:00', endTime: '17:00' },
                }
              })}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveProfile}
            className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 hover:shadow-xl transform hover:scale-[1.02]"
          >
            Save Profile
          </button>
        </div>
      </div>
    )
  }

  // Notifications Tab Component
  function NotificationsTab() {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Notifications</h3>
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-gray-400 text-3xl">🔔</span>
          </div>
          <p className="text-gray-600 text-xl font-bold mb-2">No notifications yet</p>
          <p className="text-gray-400 text-sm">You'll see shift updates and messages here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Hover area for sidebar */}
      <div 
        className={`fixed left-0 top-0 w-2 h-full z-10 transition-opacity duration-300 ${sidebarOpen ? 'opacity-0' : 'opacity-100'}`}
        onMouseEnter={() => setSidebarOpen(true)}
      />
      
      {/* Sidebar */}
      <div className={`bg-gray-800 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden lg:block`}>
        <div className="p-6 w-64">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => handleTabChange('dashboard')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <ShiftLystLogo size={40} />
              <div>
                <h1 className="text-xl font-bold">Shift<span className="text-[#D5001C]">Lyst</span></h1>
                <p className="text-gray-400 text-sm">Staff Portal</p>
              </div>
            </button>
            
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title="Collapse sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                  activeTab === item.id
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-white p-2 rounded-lg hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-white">
              {navItems.find(item => item.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Show expand button when sidebar is collapsed */}
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                title="Expand sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            )}
            
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-10 h-10 bg-[#D5001C] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#B0001A] transition-colors cursor-pointer"
                title="Profile menu"
              >
                {currentUser?.email?.charAt(0).toUpperCase() || 'S'}
              </button>
              
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#D5001C] rounded-full flex items-center justify-center text-white font-bold">
                        {currentUser?.email?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Staff Member</p>
                        <p className="text-sm text-gray-500">{currentUser?.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        handleTabChange('profile')
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    
                    <div className="border-t border-gray-100 my-2"></div>
                    
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        handleLogout()
                      }}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          {renderTabContent()}
        </div>
      </div>

      {/* Success Toast */}
      {success && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg z-50">
          {success}
        </div>
      )}
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg z-50 flex items-center gap-3">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="text-white hover:text-red-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
    </div>
  )
} 