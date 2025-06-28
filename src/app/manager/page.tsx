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
import React from 'react'
import { DateTime } from 'luxon'

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

interface Staff {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  payRate: number
  isActive: boolean
  hireDate: string
  emergencyContact: {
    name: string
    phone: string
    relationship: string
  }
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
  const [activeTab, setActiveTab] = useState(() => {
    // Get the active tab from localStorage on initial load
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTab') || 'dashboard'
    }
    return 'dashboard'
  })
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

  // Settings state
  const [timezone, setTimezone] = useState('America/New_York')

  // Data states
  const [shifts, setShifts] = useState<Shift[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
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

  // Handle tab change and persist to localStorage
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', tab)
    }
  }

  useEffect(() => {
    if (loading) return
    
    if (!user) {
      router.push('/')
      return
    }
    
    const q = query(collection(db, 'shifts'), orderBy('createdAt', 'desc'))
    const staffQ = query(collection(db, 'staff'), orderBy('createdAt', 'desc'))
    
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
      },
      err => {
        console.error('Firebase query error:', err)
        setError('Failed to load shifts: ' + err.message)
      }
    )

    const unsubscribeStaff = onSnapshot(
      staffQ,
      snapshot => {
        const staffData: Staff[] = []
        
        snapshot.forEach(doc => {
          const data = doc.data()
          const staffMember: Staff = {
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            role: data.role || '',
            payRate: data.payRate || 0,
            isActive: data.isActive !== undefined ? data.isActive : true,
            hireDate: data.hireDate || '',
            emergencyContact: {
              name: data.emergencyContact?.name || '',
              phone: data.emergencyContact?.phone || '',
              relationship: data.emergencyContact?.relationship || ''
            },
            createdAt: data.createdAt || Timestamp.now(),
          }
          staffData.push(staffMember)
        })
        
        setStaff(staffData)
        setDataLoading(false)
      },
      err => {
        console.error('Firebase staff query error:', err)
        setError('Failed to load staff: ' + err.message)
        setDataLoading(false)
      }
    )

    return () => {
      unsubscribeShifts()
      unsubscribeStaff()
    }
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
        return <CalendarTab shifts={shifts} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} getShiftsForDate={getShiftsForDate} formatCalendarDate={formatCalendarDate} getDaysInMonth={getDaysInMonth} getFirstDayOfMonth={getFirstDayOfMonth} formatDate={formatDate} formatTime={formatTime} confirmDelete={confirmDelete} confirmCancel={confirmCancel} setSuccess={setSuccess} setError={setError} timezone={timezone} />
      case 'shifts':
        return <ShiftsTab shifts={shifts} sortBy={sortBy} setSortBy={setSortBy} dataLoading={dataLoading} sortShifts={sortShifts} formatDate={formatDate} formatTime={formatTime} confirmDelete={confirmDelete} confirmCancel={confirmCancel} setSuccess={setSuccess} setError={setError} />
      case 'staff':
        return <StaffTab staff={staff} dataLoading={dataLoading} setSuccess={setSuccess} setError={setError} />
      case 'analytics':
        return <AnalyticsTab shifts={shifts} />
      case 'notifications':
        return <NotificationsTab />
      case 'settings':
        return <SettingsTab timezone={timezone} setTimezone={setTimezone} />
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
                <p className="text-gray-400 text-sm">Manager Dashboard</p>
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
                        handleTabChange('profile')
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
                        handleTabChange('settings')
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
            <h3 className="text-xl font-bold mb-4 text-gray-900">Delete Shift</h3>
            <p className="text-gray-800 mb-6">Are you sure you want to delete the {deleteConfirm.shiftRole} shift?</p>
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
            <h3 className="text-xl font-bold mb-4 text-gray-900">Cancel Shift</h3>
            <p className="text-gray-800 mb-6">Are you sure you want to cancel the {cancelConfirm.shiftRole} shift?</p>
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
  // Get today's date for filtering
  const today = new Date().toISOString().split('T')[0]
  const todaysShifts = shifts.filter((shift: any) => shift.date === today)
  
  // Get recent activity (last 5 shifts)
  const recentActivity = shifts.slice(0, 5)
  
  // Quick stats calculations
  const totalShifts = shifts.length
  const upcomingShifts = shifts.filter((shift: any) => shift.date > today).length
  const pastShifts = shifts.filter((shift: any) => shift.date < today).length

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-2xl font-bold mb-2">Welcome back, Manager!</h1>
            <p className="text-red-100">Here's what's happening today</p>
            </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{todaysShifts.length}</div>
            <div className="text-red-100 text-sm">Today's Shifts</div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium">Open Shifts</p>
              <p className="text-3xl font-bold text-blue-600">{openShifts.length}</p>
              <p className="text-xs text-gray-600 mt-1">Ready to fill</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingShifts.length}</p>
              <p className="text-xs text-gray-600 mt-1">Awaiting approval</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium">Confirmed</p>
              <p className="text-3xl font-bold text-green-600">{confirmedShifts.length}</p>
              <p className="text-xs text-gray-600 mt-1">Ready to go</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-[#D5001C]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium">Fill Rate</p>
              <p className="text-3xl font-bold text-[#D5001C]">{fillRate}%</p>
              <p className="text-xs text-gray-600 mt-1">Overall efficiency</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Today's Summary</h3>
            <span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          
          {todaysShifts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-gray-400">📅</span>
              </div>
              <p className="text-gray-600 font-medium">No shifts scheduled for today</p>
              <p className="text-sm text-gray-500 mt-1">All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysShifts.map((shift: any) => (
                <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      shift.status === 'open' ? 'bg-blue-500' :
                      shift.status === 'pending' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{shift.role}</p>
                      <p className="text-sm text-gray-600">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                      shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {shift.status}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">{shift.filledSlots}/{shift.slots} filled</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">+</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Create Shift</p>
                <p className="text-xs text-gray-700">Add new shift</p>
              </div>
            </button>
            
            <button className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">👥</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Manage Staff</p>
                <p className="text-xs text-gray-700">View team</p>
              </div>
            </button>
            
            <button className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">View Analytics</p>
                <p className="text-xs text-gray-700">Performance data</p>
              </div>
            </button>
            
            <button className="w-full flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">🔔</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Notifications</p>
                <p className="text-xs text-gray-700">View alerts</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
          <button className="text-sm text-[#D5001C] hover:text-[#B0001A] font-medium">View All</button>
        </div>
        
        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentActivity.map((shift: any, index: number) => (
              <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{shift.role}</p>
                    <p className="text-sm text-gray-600">{formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                    shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {shift.status}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">${shift.payRate}/hr</p>
                    <p className="text-xs text-gray-500">{shift.filledSlots}/{shift.slots} filled</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Shift Overview</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Shifts</span>
              <span className="font-bold text-gray-900">{totalShifts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Upcoming</span>
              <span className="font-bold text-blue-600">{upcomingShifts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Completed</span>
              <span className="font-bold text-green-600">{pastShifts}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Staffing</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Slots</span>
              <span className="font-bold text-gray-900">{totalSlots}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Filled</span>
              <span className="font-bold text-green-600">{totalFilledSlots}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Available</span>
              <span className="font-bold text-blue-600">{totalSlots - totalFilledSlots}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Efficiency</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Fill Rate</span>
              <span className="font-bold text-gray-900">{fillRate}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Avg Shift Duration</span>
              <span className="font-bold text-gray-900">6.2 hrs</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Response Time</span>
              <span className="font-bold text-gray-900">2.4 hrs</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Completion Rate</span>
              <span className="font-bold text-gray-900">94.2%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarTab({ shifts, currentMonth, setCurrentMonth, getShiftsForDate, formatCalendarDate, getDaysInMonth, getFirstDayOfMonth, formatDate, formatTime, confirmDelete, confirmCancel, setSuccess, setError, timezone }: any) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState<any>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Get current time in user's timezone
  const getCurrentTimeInTimezone = () => {
    return DateTime.now().setZone(timezone)
  }

  // Calculate current time position for day view (0-23 hours) in user's timezone
  const getCurrentTimePosition = () => {
    const nowInTimezone = getCurrentTimeInTimezone()
    const hours = nowInTimezone.hour
    const minutes = nowInTimezone.minute
    const position = hours + (minutes / 60)
    console.log('Current time position:', { hours, minutes, position, timezone })
    return position
  }

  // Check if current time line should be visible
  const shouldShowCurrentTimeLine = () => {
    const nowInTimezone = getCurrentTimeInTimezone()
    const selectedDateStr = formatCalendarDate(selectedDate)
    const todayStr = formatCalendarDate(nowInTimezone.toJSDate())
    
    if (viewMode === 'day') {
      const shouldShow = selectedDateStr === todayStr
      console.log('Day view time line check:', { selectedDateStr, todayStr, shouldShow, viewMode })
      return shouldShow
    } else if (viewMode === 'week') {
      const weekStart = new Date(currentMonth)
      weekStart.setDate(currentMonth.getDate() - currentMonth.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      const weekStartInTimezone = DateTime.fromJSDate(weekStart).setZone(timezone)
      const weekEndInTimezone = DateTime.fromJSDate(weekEnd).setZone(timezone)
      
      const shouldShow = nowInTimezone >= weekStartInTimezone && nowInTimezone <= weekEndInTimezone
      console.log('Week view time line check:', { 
        weekStart: weekStartInTimezone.toISO(), 
        weekEnd: weekEndInTimezone.toISO(), 
        now: nowInTimezone.toISO(), 
        shouldShow, 
        viewMode 
      })
      return shouldShow
    }
    return false
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          e.preventDefault()
          setViewMode('week')
          break
        case 'm':
          e.preventDefault()
          setViewMode('month')
          break
        case 'd':
          e.preventDefault()
          setViewMode('day')
          break
        case 't':
          e.preventDefault()
          goToToday()
          break
        case 'arrowleft':
          e.preventDefault()
          if (viewMode === 'month') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
          } else if (viewMode === 'week') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - 7))
          } else if (viewMode === 'day') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))
          }
          break
        case 'arrowright':
          e.preventDefault()
          if (viewMode === 'month') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
          } else if (viewMode === 'week') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 7))
          } else if (viewMode === 'day') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))
          }
          break
        case 'arrowup':
          e.preventDefault()
          if (viewMode === 'week') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - 7))
          } else if (viewMode === 'day') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7))
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7))
          }
          break
        case 'arrowdown':
          e.preventDefault()
          if (viewMode === 'week') {
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 7))
          } else if (viewMode === 'day') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7))
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7))
          }
          break
        case 'home':
          e.preventDefault()
          goToToday()
          break
        case 'escape':
          e.preventDefault()
          if (showShiftModal) {
            setShowShiftModal(false)
          }
          if (showDatePicker) {
            setShowDatePicker(false)
          }
          break
        case 'enter':
          e.preventDefault()
          if (showDatePicker) {
            setShowDatePicker(false)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, currentMonth, selectedDate, showShiftModal, showDatePicker, setCurrentMonth])

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

  // Get today's date for highlighting
  const today = new Date()
  const isToday = (dayData: any) => {
    if (!dayData) return false
    
    // Parse the date string and convert to user's timezone
    const [year, month, day] = dayData.date.split('-').map(Number)
    const dayDate = DateTime.fromObject({ year, month, day }, { zone: timezone })
    const nowInTimezone = getCurrentTimeInTimezone()
    
    // Compare dates in the same timezone
    return dayDate.hasSame(nowInTimezone, 'day')
  }

  // Handle shift click
  const handleShiftClick = (shift: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedShift(shift)
    setShowShiftModal(true)
  }

  // Quick actions
  const handleQuickAction = async (action: string, shift: any) => {
    try {
      switch (action) {
        case 'delete':
          confirmDelete(shift.id, shift.role)
          break
        case 'cancel':
          confirmCancel(shift.id, shift.role)
          break
        case 'approve':
          // Add approve logic here
          setSuccess('Shift approved!')
          break
        case 'reject':
          // Add reject logic here
          setSuccess('Shift rejected!')
          break
      }
      setShowShiftModal(false)
    } catch (error) {
      setError('Action failed')
    }
  }

  // Navigate to today
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  // Get week view data
  const getWeekData = () => {
    const weekStart = new Date(currentMonth)
    weekStart.setDate(currentMonth.getDate() - currentMonth.getDay())
    const weekDays = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      const dateString = formatCalendarDate(date)
      const dayShifts = getShiftsForDate(dateString)
      weekDays.push({
        day: date.getDate(),
        date: dateString,
        shifts: dayShifts,
        isToday: (() => {
          const [year, month, day] = dateString.split('-').map(Number)
          const dayDate = DateTime.fromObject({ year, month, day }, { zone: timezone })
          const nowInTimezone = getCurrentTimeInTimezone()
          return dayDate.hasSame(nowInTimezone, 'day')
        })()
      })
    }
    return weekDays
  }

  const weekDays = getWeekData()

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Calendar View</h3>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['month', 'week', 'day'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-[#D5001C] text-white rounded-lg hover:bg-[#B0001A] transition-colors text-sm font-medium"
            >
              Today
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 font-medium"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 font-medium"
            >
              →
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="px-4 py-2 font-medium text-gray-900 w-48 text-center">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            
            {/* Date Picker */}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              📅
            </button>

            {/* Help Button */}
                <div className="relative">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Keyboard shortcuts"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {/* Help Tooltip */}
              {showHelp && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Keyboard Shortcuts</h4>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                </div>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium text-gray-700 mb-1">View</div>
                        <div className="space-y-1 text-gray-600">
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">W</kbd> Week view</div>
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">M</kbd> Month view</div>
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">D</kbd> Day view</div>
              </div>
            </div>
            <div>
                        <div className="font-medium text-gray-700 mb-1">Navigation</div>
                        <div className="space-y-1 text-gray-600">
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">← →</kbd> Navigate</div>
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↑ ↓</kbd> Week/Day</div>
                          <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">T</kbd> Today</div>
            </div>
          </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-gray-600">
                        <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> Close modal
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <div className="absolute top-20 right-6 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-10">
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = new Date(e.target.value)
                setCurrentMonth(newDate)
                setSelectedDate(newDate)
                setShowDatePicker(false)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent text-gray-900"
            />
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center font-medium text-gray-700">
                {day}
              </div>
            ))}
            
            {days.map((dayData, index) => (
              <div
                key={index}
                className={`p-2 min-h-[100px] border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                  dayData ? 'bg-white' : 'bg-gray-50'
                } ${isToday(dayData) ? 'ring-2 ring-[#D5001C] ring-opacity-50' : ''}`}
                onClick={() => {
                  if (dayData) {
                    setSelectedDate(new Date(dayData.date))
                    setViewMode('day')
                  }
                }}
              >
                {dayData && (
                  <>
                    <div className={`text-sm font-medium mb-1 ${isToday(dayData) ? 'text-[#D5001C] font-bold' : 'text-gray-900'}`}>
                      {dayData.day}
                    </div>
                    <div className="space-y-1">
                      {dayData.shifts.map((shift: any) => (
                        <div
                          key={shift.id}
                          onClick={(e) => handleShiftClick(shift, e)}
                          className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                            shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                            shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}
                        >
                          <div className="font-medium">{shift.role}</div>
                          <div className="text-xs opacity-75">
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                          <div className="text-xs opacity-75">
                            {shift.filledSlots}/{shift.slots} filled
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'week' && (
          <div className="grid grid-cols-8 gap-1 relative">
            <div className="p-2 text-center font-medium text-gray-700">Time</div>
            {weekDays.map((dayData, index) => (
              <div key={index} className="p-2 text-center font-medium text-gray-700">
                <div className={`text-sm ${dayData.isToday ? 'text-[#D5001C] font-bold' : ''}`}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]}
                </div>
                <div className={`text-lg ${dayData.isToday ? 'text-[#D5001C] font-bold' : 'text-gray-900'}`}>
                  {dayData.day}
                </div>
              </div>
            ))}
            
            {/* Current Time Line for Week View */}
            {shouldShowCurrentTimeLine() && (
              <div 
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{
                  top: `${(getCurrentTimePosition() * 60) + 80}px`, // 60px per hour + header height
                  height: '2px',
                  background: 'linear-gradient(90deg, #D5001C 0%, #D5001C 50%, transparent 50%, transparent 100%)',
                  backgroundSize: '8px 2px'
                }}
              >
                <div className="absolute -left-2 -top-1 w-4 h-4 bg-[#D5001C] rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            )}
            
            {/* Time slots */}
            {Array.from({ length: 24 }, (_, hour) => (
              <React.Fragment key={hour}>
                <div className="p-2 text-xs text-gray-500 border-t border-gray-200">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                {weekDays.map((dayData, dayIndex) => (
                  <div key={dayIndex} className="p-1 border-t border-gray-200 min-h-[60px]">
                    {dayData.shifts.filter((shift: any) => {
                      const startHour = parseInt(shift.startTime.split(':')[0])
                      return startHour === hour
                    }).map((shift: any) => (
                      <div
                        key={shift.id}
                        onClick={(e) => handleShiftClick(shift, e)}
                        className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity mb-1 ${
                          shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}
                      >
                        <div className="font-medium">{shift.role}</div>
                        <div className="text-xs opacity-75">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}

        {viewMode === 'day' && (
          <div className="space-y-4 relative">
            <div className="text-center mb-4">
              <h4 className="text-lg font-bold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h4>
            </div>
            
            {/* Current Time Line */}
            {shouldShowCurrentTimeLine() && (
              <div 
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{
                  top: `${(getCurrentTimePosition() * 60) + 80}px`, // 60px per hour + header height
                  height: '2px',
                  background: 'linear-gradient(90deg, #D5001C 0%, #D5001C 50%, transparent 50%, transparent 100%)',
                  backgroundSize: '8px 2px'
                }}
              >
                <div className="absolute -left-2 -top-1 w-4 h-4 bg-[#D5001C] rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {Array.from({ length: 24 }, (_, hour) => {
                const hourShifts = getShiftsForDate(formatCalendarDate(selectedDate))
                  .filter((shift: any) => parseInt(shift.startTime.split(':')[0]) === hour)
                
                return (
                  <div key={hour} className="flex items-center border-b border-gray-200 py-2">
                    <div className="w-16 text-sm text-gray-500">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                    <div className="flex-1 flex gap-2">
                      {hourShifts.map((shift: any) => (
                        <div
                          key={shift.id}
                          onClick={(e) => handleShiftClick(shift, e)}
                          className={`flex-1 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                            shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                            shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}
                        >
                          <div className="font-medium">{shift.role}</div>
                          <div className="text-sm opacity-75">
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                          <div className="text-sm opacity-75">
                            ${shift.payRate}/hr • {shift.filledSlots}/{shift.slots} filled
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Shift Details Modal */}
      {showShiftModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Shift Details</h3>
        <button
                onClick={() => setShowShiftModal(false)}
                className="text-gray-400 hover:text-gray-600"
        >
                ✕
        </button>
      </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>
                <p className="text-gray-900 font-medium">{selectedShift.role}</p>
          </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Date & Time</label>
                <p className="text-gray-900">{formatDate(selectedShift.date)}</p>
                <p className="text-gray-900">{formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)}</p>
          </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Pay Rate</label>
                <p className="text-gray-900">${selectedShift.payRate}/hr</p>
          </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedShift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                  selectedShift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {selectedShift.status}
                </span>
          </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Staffing</label>
                <p className="text-gray-900">{selectedShift.filledSlots}/{selectedShift.slots} positions filled</p>
        </div>

              {selectedShift.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <p className="text-gray-900">{selectedShift.notes}</p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                {selectedShift.status === 'open' && (
                  <>
                    <button
                      onClick={() => handleQuickAction('delete', selectedShift)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleQuickAction('approve', selectedShift)}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Approve
                    </button>
                  </>
                )}
                
                {selectedShift.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleQuickAction('cancel', selectedShift)}
                      className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleQuickAction('approve', selectedShift)}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Approve
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <h4 className="text-lg font-bold mb-4 text-gray-900">Create New Shift</h4>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none placeholder-gray-400 text-gray-900"
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
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-900"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none text-gray-900 placeholder-gray-400"
                  />
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none text-gray-900 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none placeholder-gray-900 text-gray-400"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none text-gray-900"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none text-gray-900"
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
                <span className="text-sm font-medium text-gray-900">Tips Included</span>
                </label>
              <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bonusAvailable}
                    onChange={e => setBonusAvailable(e.target.checked)}
                  className="text-[#D5001C]"
                  />
                <span className="text-sm font-medium text-gray-900">Bonus Available</span>
                </label>
              <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overtimePay}
                    onChange={e => setOvertimePay(e.target.checked)}
                  className="text-[#D5001C]"
                  />
                <span className="text-sm font-medium text-gray-900">Overtime Pay</span>
                </label>
              <label className="flex items-center gap-2">
        <input
                    type="checkbox"
                    checked={hidePay}
                    onChange={e => setHidePay(e.target.checked)}
                  className="text-[#D5001C]"
                  />
                <span className="text-sm font-medium text-gray-900">Hide Pay</span>
                </label>
              </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional details about this shift..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#D5001C] focus:outline-none resize-none placeholder-gray-400 text-gray-900"
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
                  <h4 className="text-lg font-bold text-gray-900">{shift.role}</h4>
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

function StaffTab({ staff, dataLoading, setSuccess, setError }: any) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<any>(null)

  const roles = ['all', 'Server', 'Bartender', 'Host', 'Kitchen Staff', 'Manager']

  // Staff management functions
  const handleAddStaff = async (staffData: any) => {
    try {
      await addDoc(collection(db, 'staff'), {
        ...staffData,
        createdAt: Timestamp.now()
      })
      setSuccess('Staff member added successfully!')
      setShowAddStaff(false)
    } catch (error) {
      console.error('Error adding staff:', error)
      setError('Failed to add staff member')
    }
  }

  const handleUpdateStaff = async (staffId: string, staffData: any) => {
    try {
      await updateDoc(doc(db, 'staff', staffId), staffData)
      setSuccess('Staff member updated successfully!')
      setSelectedStaff(null)
    } catch (error) {
      console.error('Error updating staff:', error)
      setError('Failed to update staff member')
    }
  }

  const handleDeleteStaff = async (staffId: string) => {
    try {
      await deleteDoc(doc(db, 'staff', staffId))
      setSuccess('Staff member deleted successfully!')
      setSelectedStaff(null)
    } catch (error) {
      console.error('Error deleting staff:', error)
      setError('Failed to delete staff member')
    }
  }

  // Filter staff based on search and filters
  const filteredStaff = staff.filter((member: Staff) => {
    const matchesSearch = member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = filterRole === 'all' || member.role === filterRole
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && member.isActive) ||
                         (filterStatus === 'inactive' && !member.isActive)
    
    return matchesSearch && matchesRole && matchesStatus
  })

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading staff...</div>
                  </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold text-white">Staff Directory</h1>
        <p className="text-orange-100">Manage your team members and their information</p>
                            </div>

      {/* Controls */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Add Staff Button */}
          <button
            onClick={() => setShowAddStaff(true)}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-lg">
        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No staff members found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || filterRole !== 'all' || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first staff member'
              }
            </p>
            {!searchTerm && filterRole === 'all' && filterStatus === 'all' && (
              <button
                onClick={() => setShowAddStaff(true)}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Add First Staff Member
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pay Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.map((member: Staff) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-orange-800">
                              {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                              </span>
                            </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            Hired: {member.hireDate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.role}
                              </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                      <div className="text-sm text-gray-500">{member.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${member.payRate}/hr
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedStaff(member)}
                        className="text-orange-600 hover:text-orange-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                            </div>
        )}
                          </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Staff Member</h3>
              <button
                onClick={() => setShowAddStaff(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
                          </div>
            
            <AddStaffForm 
              onSubmit={handleAddStaff}
              onCancel={() => setShowAddStaff(false)}
            />
                        </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Staff Member</h3>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <EditStaffForm 
              staff={selectedStaff}
              onSubmit={(data) => handleUpdateStaff(selectedStaff.id, data)}
              onCancel={() => setSelectedStaff(null)}
            />
          </div>
                          </div>
                        )}
                      </div>
  )
}

function AnalyticsTab({ shifts }: any) {
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('fillRate')

  // Calculate analytics data
  const totalShifts = shifts.length
  const totalSlots = shifts.reduce((sum: number, shift: any) => sum + shift.slots, 0)
  const totalFilledSlots = shifts.reduce((sum: number, shift: any) => sum + shift.filledSlots, 0)
  const fillRate = totalSlots > 0 ? Math.round((totalFilledSlots / totalSlots) * 100) : 0
  
  // Revenue calculations (mock data)
  const totalRevenue = shifts.reduce((sum: number, shift: any) => {
    const hours = (parseInt(shift.endTime) - parseInt(shift.startTime)) / 100
    return sum + (shift.filledSlots * shift.payRate * hours)
  }, 0)
  
  // Role distribution
  const roleDistribution = shifts.reduce((acc: any, shift: any) => {
    acc[shift.role] = (acc[shift.role] || 0) + 1
    return acc
  }, {})
  
  // Monthly trends (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = date.toISOString().slice(0, 7)
    const monthShifts = shifts.filter((shift: any) => shift.date.startsWith(monthKey))
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      shifts: monthShifts.length,
      fillRate: monthShifts.length > 0 ? 
        Math.round((monthShifts.reduce((sum: number, s: any) => sum + s.filledSlots, 0) / 
                   monthShifts.reduce((sum: number, s: any) => sum + s.slots, 0)) * 100) : 0
    }
  }).reverse()

  // Performance metrics
  const performanceMetrics = [
    {
      label: 'Fill Rate',
      value: `${fillRate}%`,
      change: '+5.2%',
      changeType: 'positive',
      icon: '📊'
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: '+12.8%',
      changeType: 'positive',
      icon: '💰'
    },
    {
      label: 'Avg Shift Duration',
      value: '6.2 hrs',
      change: '-2.1%',
      changeType: 'negative',
      icon: '⏱️'
    },
    {
      label: 'Staff Satisfaction',
      value: '4.7/5',
      change: '+0.3',
      changeType: 'positive',
      icon: '😊'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-300">Track performance and identify trends</p>
                </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <button className="bg-[#D5001C] hover:bg-[#B0001A] text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {performanceMetrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">{metric.icon}</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                metric.changeType === 'positive' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {metric.change}
                            </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</h3>
            <p className="text-gray-700 text-sm font-medium">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fill Rate Trend */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Fill Rate Trend</h3>
                  <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D5001C] focus:border-transparent text-gray-900"
            >
              <option value="fillRate">Fill Rate</option>
              <option value="shifts">Shifts</option>
              <option value="revenue">Revenue</option>
                  </select>
                </div>
          
          <div className="h-64 flex items-end justify-between gap-2">
            {monthlyData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-200 rounded-t-lg relative">
                  <div 
                    className="bg-[#D5001C] rounded-t-lg transition-all duration-300"
                    style={{ 
                      height: `${selectedMetric === 'fillRate' ? data.fillRate : 
                              selectedMetric === 'shifts' ? (data.shifts / 20) * 100 : 
                              (data.shifts * 15)}%` 
                    }}
                  />
                </div>
                <span className="text-xs text-gray-600 mt-2">{data.month}</span>
              </div>
            ))}
              </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              {selectedMetric === 'fillRate' ? 'Average fill rate per month' :
               selectedMetric === 'shifts' ? 'Total shifts per month' :
               'Revenue per month'}
            </p>
                </div>
                  </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Role Distribution</h3>
          
          <div className="space-y-4">
            {Object.entries(roleDistribution).map(([role, count]: [string, any]) => {
              const percentage = Math.round((count / totalShifts) * 100)
              return (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-[#D5001C] rounded-full"></div>
                    <span className="font-medium text-gray-900">{role}</span>
                </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#D5001C] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                            </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {percentage}%
                            </span>
                            </div>
                            </div>
              )
            })}
                          </div>
                            </div>
                        </div>
                        
      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift Status Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Shift Status</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">Open</span>
                          </div>
              <span className="font-bold text-gray-900">
                {shifts.filter((s: any) => s.status === 'open').length}
                            </span>
                        </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">Pending</span>
              </div>
              <span className="font-bold text-gray-900">
                {shifts.filter((s: any) => s.status === 'pending').length}
                            </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">Confirmed</span>
              </div>
              <span className="font-bold text-gray-900">
                {shifts.filter((s: any) => s.status === 'confirmed').length}
                            </span>
                        </div>
          </div>
        </div>

        {/* Top Performing Roles */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Top Performing Roles</h4>
          
          <div className="space-y-4">
            {Object.entries(roleDistribution)
              .sort(([,a]: any, [,b]: any) => b - a)
              .slice(0, 3)
              .map(([role, count]: [string, any]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">{role}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{count}</span>
                    <span className="text-sm text-gray-600">shifts</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Efficiency Metrics</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Avg Fill Rate</span>
              <span className="font-bold text-gray-900">{fillRate}%</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Avg Shift Duration</span>
              <span className="font-bold text-gray-900">6.2 hrs</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Response Time</span>
              <span className="font-bold text-gray-900">2.4 hrs</span>
            </div>
            
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Completion Rate</span>
              <span className="font-bold text-gray-900">94.2%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Insights & Recommendations</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                ✓
              </div>
                            <div>
                <h4 className="font-medium text-green-900">Strong Performance</h4>
                <p className="text-sm text-green-700 mt-1">Fill rate has improved by 5.2% this month compared to last month.</p>
                            </div>
                          </div>
            
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                💡
                        </div>
              <div>
                <h4 className="font-medium text-blue-900">Opportunity</h4>
                <p className="text-sm text-blue-700 mt-1">Kitchen Staff roles have the highest demand. Consider hiring more staff.</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                ⚠️
              </div>
              <div>
                <h4 className="font-medium text-yellow-900">Attention Needed</h4>
                <p className="text-sm text-yellow-700 mt-1">Weekend shifts have lower fill rates. Consider adjusting pay rates.</p>
              </div>
                        </div>
                        
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                📈
              </div>
              <div>
                <h4 className="font-medium text-purple-900">Trend</h4>
                <p className="text-sm text-purple-700 mt-1">Revenue has increased 12.8% due to better shift optimization.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">📊</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Generate Report</p>
              <p className="text-sm text-gray-600">Export detailed analytics</p>
            </div>
                            </button>
          
          <button className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">📧</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Share Insights</p>
              <p className="text-sm text-gray-600">Email to stakeholders</p>
            </div>
          </button>
          
          <button className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">⚙️</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Configure Alerts</p>
              <p className="text-sm text-gray-600">Set up notifications</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationsTab() {
  const [filterType, setFilterType] = useState('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  // Mock notifications data
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'shift',
      title: 'New shift request',
      message: 'Sarah Johnson requested to pick up the Server shift on Dec 15th',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      priority: 'high',
      action: 'approve'
    },
    {
      id: '2',
      type: 'staff',
      title: 'Staff availability updated',
      message: 'Mike Chen updated their availability for next week',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: false,
      priority: 'medium',
      action: 'view'
    },
    {
      id: '3',
      type: 'system',
      title: 'System maintenance',
      message: 'Scheduled maintenance will occur tonight at 2 AM',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      read: true,
      priority: 'low',
      action: 'dismiss'
    },
    {
      id: '4',
      type: 'shift',
      title: 'Shift filled',
      message: 'The Bartender shift on Dec 14th has been filled by Emma Rodriguez',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      read: true,
      priority: 'medium',
      action: 'view'
    },
    {
      id: '5',
      type: 'alert',
      title: 'Low fill rate alert',
      message: 'Weekend shifts have a fill rate below 70%',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
      read: false,
      priority: 'high',
      action: 'review'
    },
    {
      id: '6',
      type: 'staff',
      title: 'New staff member',
      message: 'Lisa Thompson has completed their profile setup',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      read: true,
      priority: 'medium',
      action: 'view'
    }
  ])

  const notificationTypes = [
    { value: 'all', label: 'All', icon: '🔔' },
    { value: 'shift', label: 'Shifts', icon: '📋' },
    { value: 'staff', label: 'Staff', icon: '👥' },
    { value: 'system', label: 'System', icon: '⚙️' },
    { value: 'alert', label: 'Alerts', icon: '⚠️' }
  ]

  const filteredNotifications = notifications.filter(notification => {
    const matchesType = filterType === 'all' || notification.type === filterType
    const matchesRead = !showUnreadOnly || !notification.read
    return matchesType && matchesRead
  })

  const unreadCount = notifications.filter(n => !n.read).length
  const highPriorityCount = notifications.filter(n => n.priority === 'high' && !n.read).length

  function markAsRead(notificationId: string) {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
  }

  function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function deleteNotification(notificationId: string) {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  function getTimeAgo(timestamp: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'shift': return '📋'
      case 'staff': return '👥'
      case 'system': return '⚙️'
      case 'alert': return '⚠️'
      default: return '🔔'
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-gray-300">Stay updated with important alerts and updates</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
                            <button
              onClick={markAllAsRead}
              className="text-sm text-[#D5001C] hover:text-[#B0001A] font-medium"
                            >
              Mark all as read
                            </button>
                          )}
          <button className="bg-[#D5001C] hover:bg-[#B0001A] text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Settings
          </button>
                        </div>
                      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between">
                            <div>
              <p className="text-gray-700 text-sm font-medium">Unread</p>
              <p className="text-3xl font-bold text-red-600">{unreadCount}</p>
                            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔔</span>
                          </div>
                        </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium">High Priority</p>
              <p className="text-3xl font-bold text-orange-600">{highPriorityCount}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Today</p>
              <p className="text-3xl font-bold text-blue-600">
                {notifications.filter(n => {
                  const today = new Date()
                  const notificationDate = new Date(n.timestamp)
                  return notificationDate.toDateString() === today.toDateString()
                }).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total</p>
              <p className="text-3xl font-bold text-green-600">{notifications.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex flex-wrap gap-2">
            {notificationTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterType === type.value
                    ? 'bg-[#D5001C] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
                  ))}
                </div>
          
          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => setShowUnreadOnly(e.target.checked)}
                className="rounded border-gray-300 text-[#D5001C] focus:ring-[#D5001C]"
              />
              Show unread only
            </label>
            </div>
          </div>
        </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-gray-400">🔔</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-600">You're all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`bg-white rounded-xl shadow-lg border-l-4 transition-all duration-200 hover:shadow-xl ${
                getPriorityColor(notification.priority)
              } ${!notification.read ? 'ring-2 ring-[#D5001C] ring-opacity-20' : ''}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-xl">{getNotificationIcon(notification.type)}</span>
      </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-[#D5001C] rounded-full"></span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                          notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {notification.priority}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{notification.message}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{getTimeAgo(notification.timestamp)}</span>
                        <span>•</span>
                        <span className="capitalize">{notification.type}</span>
              </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {!notification.read && (
                        <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Mark as read"
                        >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        </button>
                    )}
                    
                        <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Delete notification"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                </button>
              </div>
            </div>
                
                {/* Action Buttons */}
                <div className="mt-4 flex gap-2">
                  {notification.action === 'approve' && (
                    <>
                      <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
                          Approve
                        </button>
                      <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Decline
                      </button>
                    </>
                  )}
                  
                  {notification.action === 'view' && (
                    <button className="px-4 py-2 bg-[#D5001C] hover:bg-[#B0001A] text-white rounded-lg text-sm font-medium transition-colors">
                      View Details
                    </button>
                  )}
                  
                  {notification.action === 'review' && (
                    <button className="px-4 py-2 bg-[#D5001C] hover:bg-[#B0001A] text-white rounded-lg text-sm font-medium transition-colors">
                      Review
                    </button>
                  )}
                  
                  {notification.action === 'dismiss' && (
                    <button className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                      Dismiss
                    </button>
                  )}
                      </div>
                    </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Settings Preview */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Notification Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Shift Notifications</p>
                <p className="text-sm text-gray-700">New shift requests and updates</p>
              </div>
              <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Staff Updates</p>
                <p className="text-sm text-gray-700">Staff availability and profile changes</p>
              </div>
              <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">System Alerts</p>
                <p className="text-sm text-gray-700">Maintenance and system updates</p>
              </div>
              <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Performance Alerts</p>
                <p className="text-sm text-gray-700">Low fill rates and efficiency warnings</p>
              </div>
              <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button className="text-[#D5001C] hover:text-[#B0001A] font-medium">
            Configure all notification settings →
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ timezone, setTimezone }: any) {
  const [activeSection, setActiveSection] = useState('general')
  const [businessName, setBusinessName] = useState('ShiftLyst Restaurant')
  const [currency, setCurrency] = useState('USD')
  const [autoApprove, setAutoApprove] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)

  const settingsSections = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'business', label: 'Business', icon: '🏢' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'billing', label: 'Billing', icon: '💳' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-300">Manage your account and business preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <nav className="space-y-2">
              {settingsSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-[#D5001C] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </nav>
                </div>
              </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-lg p-6">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">General Settings</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent text-gray-900"
                    />
                </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                      <option value="Europe/Paris">Paris (CET/CEST)</option>
                      <option value="Europe/Madrid">Madrid (CET/CEST)</option>
                      <option value="Europe/Rome">Rome (CET/CEST)</option>
                      <option value="Europe/Amsterdam">Amsterdam (CET/CEST)</option>
                      <option value="Europe/Brussels">Brussels (CET/CEST)</option>
                      <option value="Europe/Vienna">Vienna (CET/CEST)</option>
                      <option value="Europe/Zurich">Zurich (CET/CEST)</option>
                      <option value="Europe/Stockholm">Stockholm (CET/CEST)</option>
                      <option value="Europe/Oslo">Oslo (CET/CEST)</option>
                      <option value="Europe/Copenhagen">Copenhagen (CET/CEST)</option>
                      <option value="Europe/Helsinki">Helsinki (EET/EEST)</option>
                      <option value="Europe/Warsaw">Warsaw (CET/CEST)</option>
                      <option value="Europe/Prague">Prague (CET/CEST)</option>
                      <option value="Europe/Budapest">Budapest (CET/CEST)</option>
                  </select>
                </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900 "
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (C$)</option>
                    </select>
                </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Auto-approve shift requests</p>
                      <p className="text-sm text-gray-700">Automatically approve shift requests from trusted staff</p>
              </div>
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${
                      autoApprove ? 'bg-[#D5001C]' : 'bg-gray-300'
                    }`}>
                      <div 
                        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                          autoApprove ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                      <input
                        type="checkbox"
                        checked={autoApprove}
                        onChange={(e) => setAutoApprove(e.target.checked)}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Shift requests</p>
                          <p className="text-sm text-gray-700">When staff request to pick up shifts</p>
                </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                  </div>
                </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Low fill rate alerts</p>
                          <p className="text-sm text-gray-700">When shifts have low fill rates</p>
                            </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                            </div>
                            </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Weekly reports</p>
                          <p className="text-sm text-gray-700">Performance summaries and insights</p>
                          </div>
                        <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
                            </div>
                      </div>
                    </div>
                        </div>
                        
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Push Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Urgent alerts</p>
                          <p className="text-sm text-gray-700">Critical notifications and emergencies</p>
                        </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Shift updates</p>
                          <p className="text-sm text-gray-700">When shifts are modified or cancelled</p>
                        </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                          </div>
                        )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Security Settings</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-700">Add an extra layer of security to your account</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative transition-colors ${
                      twoFactorAuth ? 'bg-[#D5001C]' : 'bg-gray-300'
                    }`}>
                      <div 
                        className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                          twoFactorAuth ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                      <input
                        type="checkbox"
                        checked={twoFactorAuth}
                        onChange={(e) => setTwoFactorAuth(e.target.checked)}
                        className="sr-only"
                      />
                    </div>
                      </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                        placeholder="Enter current password"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                        placeholder="Enter new password"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                        placeholder="Confirm new password"
                      />
                    </div>
                    
                    <button className="bg-[#D5001C] hover:bg-[#B0001A] text-white px-6 py-3 rounded-lg font-medium transition-colors">
                      Update Password
                </button>
              </div>
                  
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Active Sessions</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">Current Session</p>
                          <p className="text-sm text-gray-600">MacBook Air • Chrome • New York, NY</p>
            </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">iPhone 14</p>
                          <p className="text-sm text-gray-600">Safari • New York, NY • 2 hours ago</p>
                        </div>
                        <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
          </div>
        </div>
      )}

            {activeSection === 'business' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Business Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business Address</label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                          placeholder="123 Main St, New York, NY"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business Hours</label>
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900">
                          <option>9:00 AM - 10:00 PM</option>
                          <option>8:00 AM - 11:00 PM</option>
                          <option>10:00 AM - 9:00 PM</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D5001C] focus:border-transparent placeholder-gray-400 text-gray-900 ">
                          <option>Restaurant</option>
                          <option>Retail</option>
                          <option>Healthcare</option>
                          <option>Hospitality</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Shift Management</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Allow shift swapping</p>
                          <p className="text-sm text-gray-700">Let staff swap shifts with each other</p>
                        </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Require manager approval</p>
                          <p className="text-sm text-gray-600">All shift changes require approval</p>
                        </div>
                        <div className="w-12 h-6 bg-[#D5001C] rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Overtime warnings</p>
                          <p className="text-sm text-gray-600">Alert when staff approach overtime</p>
                        </div>
                        <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                        </div>
                      )}

            {activeSection === 'integrations' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">Q</span>
                      </div>
                            <div>
                        <h3 className="font-medium text-gray-900">QuickBooks</h3>
                        <p className="text-sm text-gray-600">Sync payroll and accounting data</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#D5001C] hover:bg-[#B0001A] text-white rounded-lg font-medium transition-colors">
                      Connect
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">S</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Slack</h3>
                        <p className="text-sm text-gray-600">Send notifications to Slack channels</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors">
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">Z</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Zapier</h3>
                        <p className="text-sm text-gray-600">Automate workflows with 5000+ apps</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-[#D5001C] hover:bg-[#B0001A] text-white rounded-lg font-medium transition-colors">
                      Connect
                    </button>
                            </div>
                          </div>
                        </div>
                      )}

            {activeSection === 'billing' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Billing & Subscription</h2>
                
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-[#D5001C] to-[#B0001A] rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-2">Professional Plan</h3>
                        <p className="text-red-100">$29/month • Up to 50 staff members</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">$29</p>
                        <p className="text-red-100 text-sm">per month</p>
                      </div>
                    </div>
                        </div>
                        
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Method</h3>
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                            <span className="text-white text-sm font-bold">V</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Visa ending in 4242</p>
                            <p className="text-sm text-gray-600">Expires 12/25</p>
                          </div>
                        </div>
                        <button className="text-[#D5001C] hover:text-[#B0001A] font-medium">
                          Update
                            </button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Billing History</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Dec 1, 2024</p>
                            <p className="text-sm text-gray-600">Professional Plan</p>
                          </div>
                          <span className="font-medium text-gray-900">$29.00</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">Nov 1, 2024</p>
                            <p className="text-sm text-gray-600">Professional Plan</p>
                          </div>
                          <span className="font-medium text-gray-900">$29.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-6">
                    <button className="text-red-600 hover:text-red-800 font-medium">
                      Cancel Subscription
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ user, handleLogout }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg">
      <h3 className="text-xl font-bold text-gray-900">Profile</h3>
      <div className="space-y-4">
        <div>
          <p className="text-gray-600">Email</p>
          <p className="font-medium text-gray-600">{user?.email}</p>
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

// Add Staff Form Component
function AddStaffForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    payRate: 0,
    hireDate: '',
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          />
                    </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            required
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          />
                </div>
            </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
          </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
        </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          required
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        >
          <option value="">Select Role</option>
          <option value="Server">Server</option>
          <option value="Bartender">Bartender</option>
          <option value="Host">Host</option>
          <option value="Kitchen Staff">Kitchen Staff</option>
          <option value="Manager">Manager</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pay Rate ($/hr)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={formData.payRate}
          onChange={(e) => setFormData({...formData, payRate: parseFloat(e.target.value)})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
        <input
          type="date"
          required
          value={formData.hireDate}
          onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
              </div>

      <div className="flex gap-3 pt-4">
                <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
          type="submit"
          className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          Add Staff
                </button>
              </div>
    </form>
  )
}

// Edit Staff Form Component
function EditStaffForm({ staff, onSubmit, onCancel }: { staff: Staff; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    payRate: staff.payRate,
    hireDate: staff.hireDate,
    isActive: staff.isActive,
    emergencyContact: staff.emergencyContact
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          />
            </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            required
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          />
          </div>
        </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
              </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          required
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        >
          <option value="Server">Server</option>
          <option value="Bartender">Bartender</option>
          <option value="Host">Host</option>
          <option value="Kitchen Staff">Kitchen Staff</option>
          <option value="Manager">Manager</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pay Rate ($/hr)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={formData.payRate}
          onChange={(e) => setFormData({...formData, payRate: parseFloat(e.target.value)})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
        <input
          type="date"
          required
          value={formData.hireDate}
          onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
        />
        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
          Active Staff Member
        </label>
      </div>

      <div className="flex gap-3 pt-4">
                <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
          Cancel
                </button>
                <button
          type="submit"
          className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          Update Staff
                </button>
              </div>
    </form>
  )
}
