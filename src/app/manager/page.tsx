'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth , db } from './../lib/firebase'
import { signOut } from 'firebase/auth'
import { useAuth } from './../contexts/AuthContext'
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
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
  assignedStaff: string[]
  createdAt: Timestamp
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
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }
  return date.toLocaleDateString('en-US', options)
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

// Navigation Items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', color: 'from-blue-500 to-blue-600' },
  { id: 'calendar', label: 'Calendar', icon: '📅', color: 'from-green-500 to-green-600' },
  { id: 'shifts', label: 'Shifts', icon: '📋', color: 'from-purple-500 to-purple-600' },
  { id: 'staff', label: 'Staff', icon: '👥', color: 'from-orange-500 to-orange-600' },
  { id: 'analytics', label: 'Analytics', icon: '📈', color: 'from-indigo-500 to-indigo-600' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', color: 'from-red-500 to-red-600' },
  { id: 'settings', label: 'Settings', icon: '⚙️', color: 'from-gray-500 to-gray-600' },
  { id: 'profile', label: 'Profile', icon: '👤', color: 'from-pink-500 to-pink-600' },
]

export default function ManagerDashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Form states
  const [role, setRole] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [payRate, setPayRate] = useState(18)
  const [includesTips, setIncludesTips] = useState(false)
  const [bonusAvailable, setBonusAvailable] = useState(false)
  const [overtimePay, setOvertimePay] = useState(false)
  const [hidePay, setHidePay] = useState(false)
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState(1)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  // Data states
  const [shifts, setShifts] = useState<Shift[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sortBy, setSortBy] = useState<'closest' | 'date' | 'role' | 'status'>('closest')
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, shiftId: string | null, shiftRole: string}>({
    show: false,
    shiftId: null,
    shiftRole: ''
  })
  const [cancelConfirm, setCancelConfirm] = useState<{show: boolean, shiftId: string | null, shiftRole: string}>({
    show: false,
    shiftId: null,
    shiftRole: ''
  })

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const commonRoles = [
    'Bartender', 'Server', 'Host/Hostess', 'Kitchen Staff', 'Barista',
    'Cashier', 'Lifeguard', 'Receptionist', 'Security', 'Cleaner',
    'Delivery Driver', 'Manager'
  ]

  useEffect(() => {
    if (loading) return
    
    if (!user) {
      router.push('/')
      return
    }

    const q = query(collection(db, 'shifts'), orderBy('createdAt', 'desc'))
    
    const unsubscribeShifts = onSnapshot(
      q,
      snapshot => {
        const shiftsData: Shift[] = []
        
        snapshot.forEach(doc => {
          const data = doc.data()
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
          }
          shiftsData.push(shiftData)
        })
        
        setShifts(shiftsData)
        setDataLoading(false)
      },
      err => {
        console.error('Firebase query error:', err)
        setError('Failed to load shifts: ' + err.message)
        setDataLoading(false)
      }
    )

    return () => unsubscribeShifts()
  }, [user, loading, router])

  // Click outside handler for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      if (!target.closest('.role-dropdown-container')) {
        setShowRoleDropdown(false)
      }
      if (!target.closest('.profile-dropdown-container')) {
        setProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Form handlers
  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const shiftData = {
        role,
        date,
        startTime,
        endTime,
        payRate,
        includesTips,
        bonusAvailable,
        overtimePay,
        hidePay,
        notes,
        slots,
        status: 'open',
        filledSlots: 0,
        assignedStaff: [],
        createdAt: Timestamp.now(),
      }

      await addDoc(collection(db, 'shifts'), shiftData)
      
      // Reset form
      setRole('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setPayRate(18)
      setIncludesTips(false)
      setBonusAvailable(false)
      setOvertimePay(false)
      setHidePay(false)
      setNotes('')
      setSlots(1)
      
      setSuccess('Shift created successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding shift:', error)
      setError('Failed to create shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  async function handleDeleteShift(shiftId: string) {
    try {
      await deleteDoc(doc(db, 'shifts', shiftId))
      setSuccess('Shift deleted successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error deleting shift:', error)
      setError('Failed to delete shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  async function handleCancelShift(shiftId: string) {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        status: 'open',
        assignedTo: null,
        assignedStaff: [],
        filledSlots: 0
      })
      setSuccess('Shift cancelled successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error cancelling shift:', error)
      setError('Failed to cancel shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  async function handleApproveShift(shiftId: string) {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), { status: 'confirmed' })
      setSuccess('Shift approved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error approving shift:', error)
      setError('Failed to approve shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  async function handleRejectShift(shiftId: string) {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        status: 'open',
        assignedTo: null,
        assignedStaff: [],
        filledSlots: 0
      })
      setSuccess('Shift rejected successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error rejecting shift:', error)
      setError('Failed to reject shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  function confirmDelete(shiftId: string, shiftRole: string) {
    setDeleteConfirm({ show: true, shiftId, shiftRole })
  }

  function cancelDelete() {
    setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' })
  }

  function confirmCancel(shiftId: string, shiftRole: string) {
    setCancelConfirm({ show: true, shiftId, shiftRole })
  }

  function cancelCancel() {
    setCancelConfirm({ show: false, shiftId: null, shiftRole: '' })
  }

  function selectRole(selectedRole: string) {
    setRole(selectedRole)
    setShowRoleDropdown(false)
  }

  function sortShifts(shiftsToSort: Shift[]): Shift[] {
    function parseDate(dateString: string): Date {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    return [...shiftsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'closest':
          const now = new Date()
          const aDate = parseDate(a.date)
          const bDate = parseDate(b.date)
          const aDiff = Math.abs(aDate.getTime() - now.getTime())
          const bDiff = Math.abs(bDate.getTime() - now.getTime())
          return aDiff - bDiff
        case 'date':
          return parseDate(a.date).getTime() - parseDate(b.date).getTime()
        case 'role':
          return a.role.localeCompare(b.role)
        case 'status':
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })
  }

  async function handleLogout() {
    try {
      await signOut(auth)
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Filter shifts by status
  const openShifts = shifts.filter(shift => shift.status === 'open')
  const pendingShifts = shifts.filter(shift => shift.status === 'pending')
  const confirmedShifts = shifts.filter(shift => shift.status === 'confirmed')
  
  // Calculate stats
  const totalSlots = shifts.reduce((total, shift) => total + (shift.slots || 1), 0)
  const totalFilledSlots = shifts.reduce((total, shift) => total + (shift.filledSlots || 0), 0)
  const fillRate = totalSlots > 0 ? ((totalFilledSlots / totalSlots) * 100).toFixed(1) : '0'

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getShiftsForDate = (date: string) => {
    return shifts.filter(shift => shift.date === date)
  }

  const formatCalendarDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Render different tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab shifts={shifts} openShifts={openShifts} pendingShifts={pendingShifts} confirmedShifts={confirmedShifts} totalSlots={totalSlots} totalFilledSlots={totalFilledSlots} fillRate={fillRate} />
      case 'calendar':
        return <CalendarTab shifts={shifts} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} getShiftsForDate={getShiftsForDate} formatCalendarDate={formatCalendarDate} getDaysInMonth={getDaysInMonth} getFirstDayOfMonth={getFirstDayOfMonth} />
      case 'shifts':
        return <ShiftsTab shifts={shifts} sortBy={sortBy} setSortBy={setSortBy} dataLoading={dataLoading} sortShifts={sortShifts} formatDate={formatDate} formatTime={formatTime} confirmDelete={confirmDelete} confirmCancel={confirmCancel} setSuccess={setSuccess} setError={setError} />
      case 'staff':
        return <StaffTab />
      case 'analytics':
        return <AnalyticsTab shifts={shifts} />
      case 'notifications':
        return <NotificationsTab />
      case 'settings':
        return <SettingsTab />
      case 'profile':
        return <ProfileTab user={user} handleLogout={handleLogout} />
      default:
        return <DashboardTab shifts={shifts} openShifts={openShifts} pendingShifts={pendingShifts} confirmedShifts={confirmedShifts} totalSlots={totalSlots} totalFilledSlots={totalFilledSlots} fillRate={fillRate} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`bg-gray-800 text-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden lg:block`}>
        <div className="p-6 w-64">
          <div className="flex items-center gap-3 mb-8">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <ShiftLystLogo size={40} />
              <div>
                <h1 className="text-xl font-bold">Shift<span className="text-[#D5001C]">Lyst</span></h1>
                <p className="text-gray-400 text-sm">Manager Dashboard</p>
              </div>
            </button>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="relative profile-dropdown-container">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-10 h-10 bg-[#D5001C] rounded-full flex items-center justify-center text-white font-bold hover:bg-[#B0001A] transition-colors cursor-pointer"
                title="Profile menu"
              >
                {user.email?.charAt(0).toUpperCase()}
              </button>
              
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#D5001C] rounded-full flex items-center justify-center text-white font-bold">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Manager</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        setActiveTab('profile')
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        setActiveTab('settings')
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
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
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg z-50">
          {error}
        </div>
      )}

      {/* Confirmation Dialogs */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Delete Shift</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete the {deleteConfirm.shiftRole} shift?</p>
            <div className="flex gap-4">
              <button onClick={cancelDelete} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg">
                Cancel
              </button>
              <button 
                onClick={() => {
                  setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' })
                  if (deleteConfirm.shiftId) handleDeleteShift(deleteConfirm.shiftId)
                }}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Cancel Shift</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to cancel the {cancelConfirm.shiftRole} shift?</p>
            <div className="flex gap-4">
              <button onClick={cancelCancel} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg">
                Keep Shift
              </button>
              <button 
                onClick={() => {
                  setCancelConfirm({ show: false, shiftId: null, shiftRole: '' })
                  if (cancelConfirm.shiftId) handleCancelShift(cancelConfirm.shiftId)
                }}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg"
              >
                Cancel Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Tab Components
function DashboardTab({ shifts, openShifts, pendingShifts, confirmedShifts, totalSlots, totalFilledSlots, fillRate }: any) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Open Shifts</p>
              <p className="text-3xl font-bold text-blue-600">{openShifts.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingShifts.length}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Confirmed</p>
              <p className="text-3xl font-bold text-green-600">{confirmedShifts.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Fill Rate</p>
              <p className="text-3xl font-bold text-[#D5001C]">{fillRate}%</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {shifts.slice(0, 5).map((shift: any) => (
            <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{shift.role}</p>
                <p className="text-sm text-gray-600">{formatDate(shift.date)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {shift.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CalendarTab({ shifts, currentMonth, setCurrentMonth, getShiftsForDate, formatCalendarDate, getDaysInMonth, getFirstDayOfMonth }: any) {
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth)
  const days = []

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dateString = formatCalendarDate(date)
    const dayShifts = getShiftsForDate(dateString)
    days.push({ day, date: dateString, shifts: dayShifts })
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Calendar View</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            ←
          </button>
          <span className="px-4 py-2 font-medium">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-600">
            {day}
          </div>
        ))}
        
        {days.map((dayData, index) => (
          <div
            key={index}
            className={`p-2 min-h-[80px] border border-gray-200 ${
              dayData ? 'bg-white' : 'bg-gray-50'
            }`}
          >
            {dayData && (
              <>
                <div className="text-sm font-medium mb-1">{dayData.day}</div>
                <div className="space-y-1">
                  {dayData.shifts.map((shift: any) => (
                    <div
                      key={shift.id}
                      className={`text-xs p-1 rounded ${
                        shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                        shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}
                    >
                      {shift.role}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ShiftsTab({ shifts, sortBy, setSortBy, dataLoading, sortShifts, formatDate, formatTime, confirmDelete, confirmCancel, setSuccess, setError }: any) {
  // Form states for shift creation
  const [role, setRole] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [payRate, setPayRate] = useState(18)
  const [includesTips, setIncludesTips] = useState(false)
  const [bonusAvailable, setBonusAvailable] = useState(false)
  const [overtimePay, setOvertimePay] = useState(false)
  const [hidePay, setHidePay] = useState(false)
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState(1)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const commonRoles = [
    'Bartender', 'Server', 'Host/Hostess', 'Kitchen Staff', 'Barista',
    'Cashier', 'Lifeguard', 'Receptionist', 'Security', 'Cleaner',
    'Delivery Driver', 'Manager'
  ]

  // Form handlers
  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const shiftData = {
        role,
        date,
        startTime,
        endTime,
        payRate,
        includesTips,
        bonusAvailable,
        overtimePay,
        hidePay,
        notes,
        slots,
        status: 'open',
        filledSlots: 0,
        assignedStaff: [],
        createdAt: Timestamp.now(),
      }

      await addDoc(collection(db, 'shifts'), shiftData)
      
      // Reset form
      setRole('')
      setDate('')
      setStartTime('')
      setEndTime('')
      setPayRate(18)
      setIncludesTips(false)
      setBonusAvailable(false)
      setOvertimePay(false)
      setHidePay(false)
      setNotes('')
      setSlots(1)
      setShowForm(false)
      
      setSuccess('Shift created successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding shift:', error)
      setError('Failed to create shift')
      setTimeout(() => setError(''), 3000)
    }
  }

  function selectRole(selectedRole: string) {
    setRole(selectedRole)
    setShowRoleDropdown(false)
  }

  return (
    <div className="space-y-6">
      {/* Add Shift Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">All Shifts</h3>
        <div className="flex gap-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="closest">Closest Upcoming</option>
            <option value="date">Date</option>
            <option value="role">Role</option>
            <option value="status">Status</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#D5001C] text-white px-4 py-2 rounded-lg hover:bg-[#B0001A] transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Shift'}
          </button>
        </div>
      </div>

      {/* Add Shift Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold mb-4">Create New Shift</h4>
          <form onSubmit={handleAddShift} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g., Bartender, Server"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    onFocus={() => setShowRoleDropdown(true)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRoleDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {commonRoles.map((commonRole) => (
                        <button
                          key={commonRole}
                          type="button"
                          onClick={() => selectRole(commonRole)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        >
                          {commonRole}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pay Rate ($/hr)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payRate}
                  onChange={e => setPayRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Positions</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={slots}
                  onChange={e => setSlots(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includesTips}
                  onChange={e => setIncludesTips(e.target.checked)}
                  className="text-[#D5001C]"
                />
                <span className="text-sm">Tips Included</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={bonusAvailable}
                  onChange={e => setBonusAvailable(e.target.checked)}
                  className="text-[#D5001C]"
                />
                <span className="text-sm">Bonus Available</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overtimePay}
                  onChange={e => setOvertimePay(e.target.checked)}
                  className="text-[#D5001C]"
                />
                <span className="text-sm">Overtime Pay</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hidePay}
                  onChange={e => setHidePay(e.target.checked)}
                  className="text-[#D5001C]"
                />
                <span className="text-sm">Hide Pay</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional details about this shift..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-[#D5001C] text-white px-6 py-2 rounded-lg hover:bg-[#B0001A] transition-colors"
              >
                Create Shift
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts List */}
      {dataLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin mx-auto"></div>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No shifts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortShifts(shifts).map((shift: any) => (
            <div key={shift.id} className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold">{shift.role}</h4>
                  <p className="text-gray-600">{formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                  <p className="text-sm text-gray-500">${shift.payRate}/hr • {shift.filledSlots}/{shift.slots} filled</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                    shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {shift.status}
                  </span>
                  {shift.status === 'open' ? (
                    <button
                      onClick={() => confirmDelete(shift.id, shift.role)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      onClick={() => confirmCancel(shift.id, shift.role)}
                      className="px-3 py-1 bg-orange-500 text-white rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffTab() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4">Staff Management</h3>
      <p className="text-gray-600">Staff management features coming soon...</p>
    </div>
  )
}

function AnalyticsTab({ shifts }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4">Analytics</h3>
      <p className="text-gray-600">Analytics dashboard coming soon...</p>
    </div>
  )
}

function NotificationsTab() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4">Notifications</h3>
      <p className="text-gray-600">Notifications center coming soon...</p>
    </div>
  )
}

function SettingsTab() {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4">Settings</h3>
      <p className="text-gray-600">Settings panel coming soon...</p>
    </div>
  )
}

function ProfileTab({ user, handleLogout }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4">Profile</h3>
      <div className="space-y-4">
        <div>
          <p className="text-gray-600">Email</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
