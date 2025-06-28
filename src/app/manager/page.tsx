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
  const recentActivity = shifts.slice(0, 5)
  const totalShifts = shifts.length
  const upcomingShifts = shifts.filter((shift: any) => shift.date > today).length
  const pastShifts = shifts.filter((shift: any) => shift.date < today).length

  // For animated numbers (simple fade-in)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  // Security/Uptime indicator
  const securityIndicators = [
    { icon: '🔒', label: 'SOC 2' },
    { icon: '⚡', label: '99.9% Uptime' },
    { icon: '🛡️', label: 'Bank-level Security' },
  ]

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-[#D5001C]/90 to-[#B0001A]/90 shadow-xl">
        {/* Subtle animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Welcome back, Manager!</h1>
            <p className="text-red-100 text-lg font-light">Here's what's happening today</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              {securityIndicators.map((item, i) => (
                <span key={i} className="flex items-center gap-1 text-white/80 text-xs font-semibold bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                  <span>{item.icon}</span> {item.label}
                </span>
              ))}
            </div>
            <div className="text-right">
              <div className={`text-4xl font-black transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>{todaysShifts.length}</div>
              <div className="text-red-100 text-sm">Today's Shifts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Open Shifts */}
        <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-blue-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-blue-100 rounded-full blur-2xl opacity-60 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium flex items-center gap-1">Open Shifts <span className="ml-1" title="Shifts not yet filled">🛈</span></p>
              <p className={`text-3xl font-black text-blue-600 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>{openShifts.length}</p>
              <p className="text-xs text-gray-500 mt-1">Ready to fill</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl text-blue-600">📋</span>
            </div>
          </div>
        </div>
        {/* Pending */}
        <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-yellow-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-yellow-100 rounded-full blur-2xl opacity-60 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium flex items-center gap-1">Pending <span className="ml-1" title="Shifts awaiting approval">🛈</span></p>
              <p className={`text-3xl font-black text-yellow-600 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>{pendingShifts.length}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl text-yellow-600">⏳</span>
            </div>
          </div>
        </div>
        {/* Confirmed */}
        <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-green-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-green-100 rounded-full blur-2xl opacity-60 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium flex items-center gap-1">Confirmed <span className="ml-1" title="Shifts ready to go">🛈</span></p>
              <p className={`text-3xl font-black text-green-600 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>{confirmedShifts.length}</p>
              <p className="text-xs text-gray-500 mt-1">Ready to go</p>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl text-green-600">✅</span>
            </div>
          </div>
        </div>
        {/* Fill Rate */}
        <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-red-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-red-100 rounded-full blur-2xl opacity-60 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 text-sm font-medium flex items-center gap-1">Fill Rate <span className="ml-1" title="% of shifts filled">🛈</span></p>
              <p className={`text-3xl font-black text-[#D5001C] transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>{fillRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Overall efficiency</p>
            </div>
            <div className="w-12 h-12 bg-[#D5001C]/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl text-[#D5001C]">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Today's Summary Timeline */}
        <div className="lg:col-span-2 bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Today's Timeline</h3>
            <span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          {todaysShifts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl text-gray-400">📅</span>
              </div>
              <p className="text-gray-600 font-semibold text-lg">No shifts scheduled for today</p>
              <p className="text-sm text-gray-500 mt-2">All clear! Enjoy your day.</p>
            </div>
          ) : (
            <ol className="relative border-l-4 border-[#D5001C]/20 ml-4 space-y-8">
              {todaysShifts.map((shift: any, idx: number) => (
                <li key={shift.id} className="ml-4 flex items-center gap-6 group">
                  <span className={`absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center border-4 ${
                    shift.status === 'open' ? 'bg-blue-100 border-blue-400' :
                    shift.status === 'pending' ? 'bg-yellow-100 border-yellow-400' :
                    'bg-green-100 border-green-400'
                  }`}>
                    {shift.status === 'open' ? '📋' : shift.status === 'pending' ? '⏳' : '✅'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-lg">{shift.role}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ml-2 ${
                        shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                        shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">{formatTime(shift.startTime)} - {formatTime(shift.endTime)} &bull; {shift.filledSlots}/{shift.slots} filled</p>
                    {shift.notes && <p className="text-sm text-gray-600 mt-2 font-medium">"{shift.notes}"</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-xs">${shift.payRate}/hr</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl flex flex-col gap-6 justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h3>
            <div className="space-y-4">
              <button className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-left group shadow-sm">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-white text-2xl">+</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Create Shift</p>
                  <p className="text-xs text-gray-700">Add new shift</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors text-left group shadow-sm">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-white text-2xl">👥</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Manage Staff</p>
                  <p className="text-xs text-gray-700">View team</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-left group shadow-sm">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-white text-2xl">📊</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">View Analytics</p>
                  <p className="text-xs text-gray-700">Performance data</p>
                </div>
              </button>
              <button className="w-full flex items-center gap-4 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors text-left group shadow-sm">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-white text-2xl">🔔</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Notifications</p>
                  <p className="text-xs text-gray-700">View alerts</p>
                </div>
              </button>
            </div>
          </div>
          <div className="mt-8 text-center">
            <span className="text-xs text-gray-400">Enterprise-grade security • 99.9% uptime</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Recent Activity</h3>
          <button className="text-sm text-[#D5001C] hover:text-[#B0001A] font-medium">View All</button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-6">
            {recentActivity.map((shift: any, index: number) => (
              <div key={shift.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg font-bold text-gray-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{shift.role}</p>
                    <p className="text-sm text-gray-600">{formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                    shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${shift.payRate}/hr</p>
                    <p className="text-xs text-gray-500">{shift.filledSlots}/{shift.slots} filled</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
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
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
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
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
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

  // Calculate stats for header
  const totalShifts = shifts.length
  const todayShifts = getShiftsForDate(formatCalendarDate(new Date())).length
  const weekShifts = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return getShiftsForDate(formatCalendarDate(date)).length
  }).reduce((sum, count) => sum + count, 0)

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
          // Handle approve action
          setSuccess('Shift approved successfully!')
          break
        default:
          break
      }
      setShowShiftModal(false)
    } catch (error) {
      console.error('Error performing quick action:', error)
      setError('Failed to perform action')
    }
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDate(today)
    setViewMode('day')
  }

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
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-blue-500/90 to-blue-600/90 shadow-xl">
        {/* Subtle animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Calendar View</h1>
            <p className="text-blue-100 text-lg font-light">Visualize and manage your shifts across time</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">{totalShifts}</div>
              <div className="text-blue-100 text-sm">Total Shifts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{todayShifts}</div>
              <div className="text-blue-100 text-sm">Today</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{weekShifts}</div>
              <div className="text-blue-100 text-sm">This Week</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {['month', 'week', 'day'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    viewMode === mode
                      ? 'bg-white text-blue-600 shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
              >
                →
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="px-6 py-3 font-bold text-gray-900 text-lg bg-gray-50 rounded-xl">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            
            <button
              onClick={goToToday}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
            >
              Today
            </button>

            {/* Date Picker */}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-700 transition-colors"
            >
              📅
            </button>

            {/* Help Button */}
            <div className="relative">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-3 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                title="Keyboard shortcuts"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {/* Help Tooltip */}
              {showHelp && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 z-20">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900">Keyboard Shortcuts</h4>
                    <button
                      onClick={() => setShowHelp(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-semibold text-gray-700 mb-2">View</div>
                        <div className="space-y-2 text-gray-600">
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">W</kbd> Week view</div>
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">M</kbd> Month view</div>
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">D</kbd> Day view</div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-700 mb-2">Navigation</div>
                        <div className="space-y-2 text-gray-600">
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">← →</kbd> Navigate</div>
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">↑ ↓</kbd> Week/Day</div>
                          <div><kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">T</kbd> Today</div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <div className="text-gray-600">
                        <kbd className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-mono">Esc</kbd> Close modal
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
          <div className="absolute top-20 right-6 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-10">
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = new Date(e.target.value)
                setCurrentMonth(newDate)
                setSelectedDate(newDate)
                setShowDatePicker(false)
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 font-medium"
            />
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-4 text-center font-bold text-gray-700 text-lg">
                {day}
              </div>
            ))}
            
            {days.map((dayData, index) => (
              <div
                key={index}
                className={`p-3 min-h-[120px] border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-all duration-300 ${
                  dayData ? 'bg-white hover:shadow-lg hover:-translate-y-1' : 'bg-gray-50'
                } ${isToday(dayData) ? 'ring-2 ring-blue-500 ring-opacity-50 shadow-lg' : ''}`}
                onClick={() => {
                  if (dayData) {
                    setSelectedDate(new Date(dayData.date))
                    setViewMode('day')
                  }
                }}
              >
                {dayData && (
                  <>
                    <div className={`text-lg font-bold mb-2 ${isToday(dayData) ? 'text-blue-600' : 'text-gray-900'}`}>
                      {dayData.day}
                    </div>
                    <div className="space-y-2">
                      {dayData.shifts.map((shift: any) => (
                        <div
                          key={shift.id}
                          onClick={(e) => handleShiftClick(shift, e)}
                          className={`text-xs p-2 rounded-lg cursor-pointer hover:opacity-80 transition-all duration-300 shadow-sm ${
                            shift.status === 'open' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-green-100 text-green-800 border border-green-200'
                          }`}
                        >
                          <div className="font-semibold">{shift.role}</div>
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
          <div className="grid grid-cols-8 gap-2 relative">
            <div className="p-4 text-center font-bold text-gray-700 text-lg">Time</div>
            {weekDays.map((dayData, index) => (
              <div key={index} className="p-4 text-center">
                <div className={`text-sm font-semibold ${dayData.isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]}
                </div>
                <div className={`text-2xl font-bold ${dayData.isToday ? 'text-blue-600' : 'text-gray-900'}`}>
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
                  height: '3px',
                  background: 'linear-gradient(90deg, #3B82F6 0%, #3B82F6 50%, transparent 50%, transparent 100%)',
                  backgroundSize: '12px 3px'
                }}
              >
                <div className="absolute -left-3 -top-1.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
            )}
            
            {/* Time slots */}
            {Array.from({ length: 24 }, (_, hour) => (
              <React.Fragment key={hour}>
                <div className="p-2 text-xs text-gray-500 border-t border-gray-200 font-medium">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                {weekDays.map((dayData, dayIndex) => (
                  <div key={dayIndex} className="p-2 border-t border-gray-200 min-h-[60px]">
                    {dayData.shifts.filter((shift: any) => {
                      const startHour = parseInt(shift.startTime.split(':')[0])
                      return startHour === hour
                    }).map((shift: any) => (
                      <div
                        key={shift.id}
                        onClick={(e) => handleShiftClick(shift, e)}
                        className={`text-xs p-2 rounded-lg cursor-pointer hover:opacity-80 transition-all duration-300 mb-1 shadow-sm ${
                          shift.status === 'open' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                          'bg-green-100 text-green-800 border border-green-200'
                        }`}
                      >
                        <div className="font-semibold">{shift.role}</div>
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
          <div className="space-y-6 relative">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-gray-900">
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
                  height: '3px',
                  background: 'linear-gradient(90deg, #3B82F6 0%, #3B82F6 50%, transparent 50%, transparent 100%)',
                  backgroundSize: '12px 3px'
                }}
              >
                <div className="absolute -left-3 -top-1.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {Array.from({ length: 24 }, (_, hour) => {
                const hourShifts = getShiftsForDate(formatCalendarDate(selectedDate))
                  .filter((shift: any) => parseInt(shift.startTime.split(':')[0]) === hour)
                
                return (
                  <div key={hour} className="flex items-center border-b border-gray-200 py-3">
                    <div className="w-20 text-sm text-gray-500 font-medium">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                    <div className="flex-1 flex gap-3">
                      {hourShifts.map((shift: any) => (
                        <div
                          key={shift.id}
                          onClick={(e) => handleShiftClick(shift, e)}
                          className={`flex-1 p-4 rounded-xl cursor-pointer hover:opacity-80 transition-all duration-300 shadow-sm ${
                            shift.status === 'open' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-green-100 text-green-800 border border-green-200'
                          }`}
                        >
                          <div className="font-semibold">{shift.role}</div>
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
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Shift Details</h3>
              <button
                onClick={() => setShowShiftModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700">Role</label>
                <p className="text-gray-900 font-bold text-lg">{selectedShift.role}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-700">Date & Time</label>
                <p className="text-gray-900 font-medium">{formatDate(selectedShift.date)}</p>
                <p className="text-gray-900 font-medium">{formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)}</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-700">Pay Rate</label>
                <p className="text-gray-900 font-bold text-lg">${selectedShift.payRate}/hr</p>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedShift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                  selectedShift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {selectedShift.status.charAt(0).toUpperCase() + selectedShift.status.slice(1)}
                </span>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-gray-700">Staffing</label>
                <p className="text-gray-900 font-medium">{selectedShift.filledSlots}/{selectedShift.slots} positions filled</p>
              </div>

              {selectedShift.notes && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Notes</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedShift.notes}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                {selectedShift.status === 'open' && (
                  <>
                    <button
                      onClick={() => handleQuickAction('delete', selectedShift)}
                      className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleQuickAction('approve', selectedShift)}
                      className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
                    >
                      Approve
                    </button>
                  </>
                )}
                
                {selectedShift.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleQuickAction('cancel', selectedShift)}
                      className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleQuickAction('approve', selectedShift)}
                      className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
                    >
                      Approve
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => setShowShiftModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
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

  // Calculate stats for header
  const totalShifts = shifts.length
  const openShifts = shifts.filter((s: any) => s.status === 'open').length
  const pendingShifts = shifts.filter((s: any) => s.status === 'pending').length
  const confirmedShifts = shifts.filter((s: any) => s.status === 'confirmed').length

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
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-purple-500/90 to-purple-600/90 shadow-xl">
        {/* Subtle animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Shift Management</h1>
            <p className="text-purple-100 text-lg font-light">Create, manage, and track all your shifts</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">{totalShifts}</div>
              <div className="text-purple-100 text-sm">Total Shifts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{openShifts}</div>
              <div className="text-purple-100 text-sm">Open</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{pendingShifts}</div>
              <div className="text-purple-100 text-sm">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-gray-50 text-gray-900 font-medium"
            >
              <option value="closest">Closest Upcoming</option>
              <option value="date">Date</option>
              <option value="role">Role</option>
              <option value="status">Status</option>
            </select>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
          >
            {showForm ? 'Cancel' : '+ Create Shift'}
          </button>
        </div>
      </div>

      {/* Add Shift Form */}
      {showForm && (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-purple-100">
          <h4 className="text-2xl font-bold mb-6 text-gray-900">Create New Shift</h4>
          <form onSubmit={handleAddShift} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g., Bartender, Server"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    onFocus={() => setShowRoleDropdown(true)}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 placeholder-gray-400 text-gray-900 bg-gray-50 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRoleDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                      {commonRoles.map((commonRole) => (
                        <button
                          key={commonRole}
                          type="button"
                          onClick={() => selectRole(commonRole)}
                          className="w-full text-left px-4 py-3 hover:bg-purple-50 text-gray-900 font-medium"
                        >
                          {commonRole}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 placeholder-gray-400 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 placeholder-gray-400 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 placeholder-gray-400 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pay Rate ($/hr)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payRate}
                  onChange={e => setPayRate(parseFloat(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 bg-gray-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Positions</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={slots}
                  onChange={e => setSlots(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 bg-gray-50 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesTips}
                  onChange={e => setIncludesTips(e.target.checked)}
                  className="text-purple-500 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-900">Tips Included</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={bonusAvailable}
                  onChange={e => setBonusAvailable(e.target.checked)}
                  className="text-purple-500 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-900">Bonus Available</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={overtimePay}
                  onChange={e => setOvertimePay(e.target.checked)}
                  className="text-purple-500 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-900">Overtime Pay</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePay}
                  onChange={e => setHidePay(e.target.checked)}
                  className="text-purple-500 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-900">Hide Pay</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional details about this shift..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none placeholder-gray-400 text-gray-900 bg-gray-50 font-medium"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
              >
                Create Shift
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts List */}
      {dataLoading ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading shifts...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-gray-400">📋</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No shifts found</h3>
          <p className="text-gray-600 mb-6">Get started by creating your first shift</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
          >
            Create First Shift
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortShifts(shifts).map((shift: any) => (
            <div key={shift.id} className="group bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xl font-bold text-gray-900">{shift.role}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      shift.status === 'open' ? 'bg-blue-100 text-blue-800' :
                      shift.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-600 font-medium mb-1">{formatDate(shift.date)} • {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
                  <p className="text-sm text-gray-500">${shift.payRate}/hr • {shift.filledSlots}/{shift.slots} filled</p>
                  {shift.notes && <p className="text-sm text-gray-600 mt-2 font-medium">"{shift.notes}"</p>}
                </div>
                <div className="flex gap-3">
                  {shift.status === 'open' ? (
                    <button
                      onClick={() => confirmDelete(shift.id, shift.role)}
                      className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      onClick={() => confirmCancel(shift.id, shift.role)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
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

  // Calculate stats for header
  const totalStaff = staff.length
  const activeStaff = staff.filter((s: any) => s.isActive).length
  const inactiveStaff = staff.filter((s: any) => !s.isActive).length

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
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-orange-500/90 to-orange-600/90 shadow-xl">
        {/* Subtle animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Staff Directory</h1>
            <p className="text-orange-100 text-lg font-light">Manage your team members and their information</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">{totalStaff}</div>
              <div className="text-orange-100 text-sm">Total Staff</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{activeStaff}</div>
              <div className="text-orange-100 text-sm">Active</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{inactiveStaff}</div>
              <div className="text-orange-100 text-sm">Inactive</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900 bg-gray-50 font-medium"
              />
              <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900 bg-gray-50 font-medium"
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
                className="px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-gray-900 bg-gray-50 font-medium"
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
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
          >
            + Add Staff Member
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl">
        {filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-gray-400">👥</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No staff members found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterRole !== 'all' || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first staff member'
              }
            </p>
            {!searchTerm && filterRole === 'all' && filterStatus === 'all' && (
              <button
                onClick={() => setShowAddStaff(true)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-300 font-semibold"
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
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pay Rate</th>
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStaff.map((member: Staff) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <span className="text-lg font-bold text-orange-800">
                              {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-lg font-semibold text-gray-900">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            Hired: {member.hireDate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.role}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.email}</div>
                      <div className="text-sm text-gray-500">{member.phone}</div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-lg font-semibold text-gray-900">
                      ${member.payRate}/hr
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedStaff(member)}
                        className="text-orange-600 hover:text-orange-900 mr-4 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="text-red-600 hover:text-red-900 font-semibold"
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
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Staff Member</h3>
              <button
                onClick={() => setShowAddStaff(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
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
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Edit Staff Member</h3>
              <button
                onClick={() => setSelectedStaff(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
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
      icon: '📊',
      description: 'Average shift completion rate'
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: '+12.8%',
      changeType: 'positive',
      icon: '💰',
      description: 'Total revenue generated'
    },
    {
      label: 'Avg Shift Duration',
      value: '6.2 hrs',
      change: '-2.1%',
      changeType: 'negative',
      icon: '⏱️',
      description: 'Average shift length'
    },
    {
      label: 'Staff Satisfaction',
      value: '4.7/5',
      change: '+0.3',
      changeType: 'positive',
      icon: '😊',
      description: 'Staff satisfaction score'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-purple-500/90 to-purple-600/90 shadow-xl">
        {/* Subtle animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Analytics Dashboard</h1>
            <p className="text-purple-100 text-lg font-light">Track performance and identify trends</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">{totalShifts}</div>
              <div className="text-purple-100 text-sm">Total Shifts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{fillRate}%</div>
              <div className="text-purple-100 text-sm">Fill Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">${totalRevenue.toLocaleString()}</div>
              <div className="text-purple-100 text-sm">Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium text-gray-900 bg-white"
            >
              <option value="7d" className="text-gray-900">Last 7 days</option>
              <option value="30d" className="text-gray-900">Last 30 days</option>
              <option value="90d" className="text-gray-900">Last 90 days</option>
              <option value="1y" className="text-gray-900">Last year</option>
            </select>
          </div>
          
          <button className="bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg transform hover:scale-105 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300">
            Export Report
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {performanceMetrics.map((metric, index) => (
          <div key={index} className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">{metric.icon}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                metric.changeType === 'positive' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {metric.change}
              </span>
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-2">{metric.value}</h3>
            <p className="text-gray-700 font-semibold mb-1">{metric.label}</p>
            <p className="text-gray-500 text-sm">{metric.description}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fill Rate Trend */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-gray-900">Fill Rate Trend</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium text-gray-900 bg-white"
            >
              <option value="fillRate" className="text-gray-900">Fill Rate</option>
              <option value="shifts" className="text-gray-900">Shifts</option>
              <option value="revenue" className="text-gray-900">Revenue</option>
            </select>
          </div>
          
          <div className="h-80 flex items-end justify-between gap-3">
            {monthlyData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-100 rounded-t-xl relative h-full">
                  <div 
                    className="bg-gradient-to-t from-purple-500 to-purple-600 rounded-t-xl transition-all duration-500 shadow-lg"
                    style={{ 
                      height: `${selectedMetric === 'fillRate' ? data.fillRate : 
                              selectedMetric === 'shifts' ? (data.shifts / 20) * 100 : 
                              (data.shifts * 15)}%` 
                    }}
                  />
                </div>
                <span className="text-sm text-gray-600 mt-3 font-medium">{data.month}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 font-medium">
              {selectedMetric === 'fillRate' ? 'Average fill rate per month' :
               selectedMetric === 'shifts' ? 'Total shifts per month' :
               'Revenue per month'}
            </p>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">Role Distribution</h3>
          
          <div className="space-y-6">
            {Object.entries(roleDistribution).map(([role, count]: [string, any]) => {
              const percentage = Math.round((count / totalShifts) * 100)
              return (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full shadow-sm"></div>
                    <span className="font-semibold text-gray-900">{role}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-40 bg-gray-100 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-16 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationsTab() {
  // Mock notifications data
  const notifications = [
    {
      id: 1,
      type: 'success',
      title: 'Shift Approved',
      message: 'Your shift for Friday evening has been approved by management.',
      time: '2 hours ago',
      read: false
    },
    {
      id: 2,
      type: 'warning',
      title: 'Low Staff Alert',
      message: 'Saturday morning shift is currently understaffed. Consider adding more slots.',
      time: '4 hours ago',
      read: true
    },
    {
      id: 3,
      type: 'info',
      title: 'System Update',
      message: 'ShiftLyst has been updated with new features. Check out the latest improvements.',
      time: '1 day ago',
      read: true
    }
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-teal-500/90 to-teal-600/90 shadow-xl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Notifications</h1>
            <p className="text-teal-100 text-lg font-light">Stay updated with important alerts and updates</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">{notifications.length}</div>
              <div className="text-teal-100 text-sm">Total</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">{unreadCount}</div>
              <div className="text-teal-100 text-sm">Unread</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">3</div>
              <div className="text-teal-100 text-sm">This Week</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-lg transform hover:scale-105 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300">
              Mark All Read
            </button>
            <button className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors">
              Clear All
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <select className="px-4 py-3 border border-gray-200 rounded-xl focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-medium text-gray-900 bg-white">
              <option value="all" className="text-gray-900">All Notifications</option>
              <option value="unread" className="text-gray-900">Unread Only</option>
              <option value="success" className="text-gray-900">Success</option>
              <option value="warning" className="text-gray-900">Warnings</option>
              <option value="info" className="text-gray-900">Info</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                !notification.read ? 'ring-2 ring-teal-500/20' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                  notification.type === 'success' ? 'bg-gradient-to-br from-green-100 to-green-200' :
                  notification.type === 'warning' ? 'bg-gradient-to-br from-yellow-100 to-yellow-200' :
                  'bg-gradient-to-br from-blue-100 to-blue-200'
                }`}>
                  <span className="text-xl">
                    {notification.type === 'success' ? '✅' :
                     notification.type === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{notification.title}</h3>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                      )}
                      <span className="text-sm text-gray-500 font-medium">{notification.time}</span>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-4">{notification.message}</p>
                  <div className="flex items-center gap-3">
                    <button className="text-teal-600 hover:text-teal-700 font-semibold text-sm transition-colors">
                      View Details
                    </button>
                    <button className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-3xl">🔔</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Notifications</h3>
            <p className="text-gray-600 font-medium">You're all caught up! Check back later for updates.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsTab({ timezone, setTimezone }: any) {
  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-green-500/90 to-green-600/90 shadow-xl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Settings</h1>
            <p className="text-green-100 text-lg font-light">Configure your preferences and system settings</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">3</div>
              <div className="text-green-100 text-sm">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">12</div>
              <div className="text-green-100 text-sm">Settings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">2</div>
              <div className="text-green-100 text-sm">Updated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* General Settings */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">General</h3>
              <p className="text-gray-600 text-sm">Basic system preferences</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium text-gray-900 bg-white"
              >
                <option value="America/New_York" className="text-gray-900 bg-white">Eastern Time (ET)</option>
                <option value="America/Chicago" className="text-gray-900 bg-white">Central Time (CT)</option>
                <option value="America/Denver" className="text-gray-900 bg-white">Mountain Time (MT)</option>
                <option value="America/Los_Angeles" className="text-gray-900 bg-white">Pacific Time (PT)</option>
              </select>
              <p className="text-gray-500 text-sm mt-2">This affects all time displays in the application</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Language</label>
              <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium text-gray-900 bg-white">
                <option value="en" className="text-gray-900 bg-white">English</option>
                <option value="es" className="text-gray-900 bg-white">Spanish</option>
                <option value="fr" className="text-gray-900 bg-white">French</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Date Format</label>
              <select className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium text-gray-900 bg-white">
                <option value="MM/DD/YYYY" className="text-gray-900 bg-white">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY" className="text-gray-900 bg-white">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD" className="text-gray-900 bg-white">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🔔</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Notifications</h3>
              <p className="text-gray-600 text-sm">Manage your alerts</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">Email Notifications</label>
                <p className="text-gray-500 text-sm">Receive updates via email</p>
              </div>
              <button className="w-12 h-6 bg-green-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 transition-transform"></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">Push Notifications</label>
                <p className="text-gray-500 text-sm">Browser push notifications</p>
              </div>
              <button className="w-12 h-6 bg-gray-300 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-700">Shift Reminders</label>
                <p className="text-gray-500 text-sm">Remind before shifts</p>
              </div>
              <button className="w-12 h-6 bg-green-500 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 transition-transform"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Security</h3>
              <p className="text-gray-600 text-sm">Account security settings</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Change Password</div>
              <div className="text-gray-500 text-sm">Update your account password</div>
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Two-Factor Authentication</div>
              <div className="text-gray-500 text-sm">Add extra security layer</div>
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Login History</div>
              <div className="text-gray-500 text-sm">View recent login activity</div>
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Save Changes</h3>
            <p className="text-gray-600 text-sm">Your settings will be applied immediately</p>
          </div>
          <button className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg transform hover:scale-105 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ user, handleLogout }: any) {
  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-r from-pink-500/90 to-pink-600/90 shadow-xl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-white">{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight text-white drop-shadow">Profile</h1>
              <p className="text-pink-100 text-lg font-light">Manage your account and preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-black text-white">Manager</div>
              <div className="text-pink-100 text-sm">Role</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">Active</div>
              <div className="text-pink-100 text-sm">Status</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white">30d</div>
              <div className="text-pink-100 text-sm">Member</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
              <p className="text-gray-600 text-sm">Your basic account details</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="px-4 py-3 bg-gray-50 rounded-xl font-medium text-gray-900">
                {user?.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                defaultValue="Manager User"
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 font-medium text-gray-900 bg-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                defaultValue="+1 (555) 123-4567"
                placeholder="Enter your phone number"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 font-medium text-gray-900 bg-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title</label>
              <input
                type="text"
                defaultValue="Restaurant Manager"
                placeholder="Enter your job title"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 font-medium text-gray-900 bg-white placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚙️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Account Settings</h3>
              <p className="text-gray-600 text-sm">Manage your account preferences</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Change Password</div>
              <div className="text-gray-500 text-sm">Update your account password</div>
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Two-Factor Authentication</div>
              <div className="text-gray-500 text-sm">Add extra security layer</div>
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Privacy Settings</div>
              <div className="text-gray-500 text-sm">Manage your privacy preferences</div>
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors text-left">
              <div className="font-semibold text-gray-700">Notification Preferences</div>
              <div className="text-gray-500 text-sm">Customize your notifications</div>
            </button>
          </div>
        </div>
      </div>

      {/* Activity & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Activity</h3>
              <p className="text-gray-600 text-sm">Recent account activity</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Login</span>
              <span className="text-sm font-semibold text-gray-900">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Sessions This Week</span>
              <span className="text-sm font-semibold text-gray-900">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account Created</span>
              <span className="text-sm font-semibold text-gray-900">30 days ago</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📈</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Performance</h3>
              <p className="text-gray-600 text-sm">Your management stats</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Shifts Managed</span>
              <span className="text-sm font-semibold text-gray-900">156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Staff Supervised</span>
              <span className="text-sm font-semibold text-gray-900">24</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Fill Rate</span>
              <span className="text-sm font-semibold text-gray-900">87%</span>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Achievements</h3>
              <p className="text-gray-600 text-sm">Your accomplishments</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥇</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Perfect Week</div>
                <div className="text-xs text-gray-500">100% fill rate for a week</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Efficiency Master</div>
                <div className="text-xs text-gray-500">Optimized 50+ shifts</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Team Leader</div>
                <div className="text-xs text-gray-500">Managed 20+ staff members</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Account Actions</h3>
            <p className="text-gray-600 text-sm">Manage your account settings and preferences</p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors">
              Cancel Changes
            </button>
            <button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:shadow-lg transform hover:scale-105 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300">
              Save Changes
            </button>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg transform hover:scale-105 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300"
            >
              Sign Out
            </button>
          </div>
        </div>
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