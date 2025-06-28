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

export default function ManagerDashboardPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

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
  const [shifts, setShifts] = useState<Shift[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
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

  const commonRoles = [
    'Bartender',
    'Server',
    'Host/Hostess',
    'Kitchen Staff',
    'Barista',
    'Cashier',
    'Lifeguard',
    'Receptionist',
    'Security',
    'Cleaner',
    'Delivery Driver',
    'Manager'
  ]

  useEffect(() => {
    console.log('=== MANAGER PAGE MOUNTED ===')
    console.log('Auth loading:', loading, 'User:', user ? `logged in: ${user.uid}` : 'not logged in')
    
    // Wait for auth to be determined
    if (loading) {
      console.log('Waiting for auth to be determined...')
      return
    }
    
    // Check if user is authenticated
    if (!user) {
      console.log('No user, redirecting to login')
      router.push('/')
      return
    }
    
    console.log('User authenticated, setting up Firebase listener...')

    // Listen for shifts collection changes
    const q = query(
      collection(db, 'shifts'),
      orderBy('createdAt', 'desc')
    )
    
    const unsubscribeShifts = onSnapshot(
      q,
      snapshot => {
        console.log(`Firebase snapshot received: ${snapshot.size} documents`)
        const shiftsData: Shift[] = []
        
        snapshot.forEach(doc => {
          const data = doc.data()
          console.log(`Processing shift: ${doc.id}`, data)
          
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
          }
          
          shiftsData.push(shiftData)
        })
        
        console.log(`Setting ${shiftsData.length} shifts to state`)
        setShifts(shiftsData)
        setDataLoading(false)
        console.log('Loading set to false, shifts should be visible now')
      },
      err => {
        console.error('Firebase query error:', err)
        setError('Failed to load shifts: ' + err.message)
        setDataLoading(false)
      }
    )

    return () => {
      console.log('Cleaning up Firebase listener')
      unsubscribeShifts()
    }
  }, [loading, user, router])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      if (!target.closest('.role-dropdown-container')) {
        setShowRoleDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Monitor shifts state changes
  useEffect(() => {
    console.log(`Shifts state changed: ${shifts.length} shifts`)
    if (shifts.length > 0) {
      console.log('Shifts in state:', shifts.map(s => `${s.role} on ${s.date}`))
    }
  }, [shifts])

  // Monitor loading state changes
  useEffect(() => {
    console.log(`Loading state changed: ${dataLoading}`)
  }, [dataLoading])

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!role || !date || !startTime || !endTime) {
      setError('Please fill out all required fields')
      return
    }

    // Check for duplicate shifts
    const existingShift = shifts.find(shift => 
      shift.role === role && 
      shift.date === date && 
      shift.startTime === startTime && 
      shift.endTime === endTime
    )

    if (existingShift) {
      setError(`A ${role} shift already exists for ${formatDate(date)} from ${formatTime(startTime)} to ${formatTime(endTime)}. Please use the existing shift with ${existingShift.slots || 1} slots instead.`)
      return
    }

    try {
      await addDoc(collection(db, 'shifts'), {
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
        filledSlots: 0,
        assignedStaff: [],
        status: 'open',
        createdAt: Timestamp.now(),
      })
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
    } catch (err) {
      setError('Failed to add shift')
    }
  }

  async function handleDeleteShift(shiftId: string) {
    try {
      await deleteDoc(doc(db, 'shifts', shiftId))
      setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' })
      setSuccess('Shift deleted successfully')
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to delete shift')
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
      setCancelConfirm({ show: false, shiftId: null, shiftRole: '' })
      setSuccess('Shift canceled successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to cancel shift')
    }
  }

  async function handleApproveShift(shiftId: string) {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        status: 'confirmed',
        approvedAt: Timestamp.now()
      })
      setSuccess('Shift approved successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to approve shift')
    }
  }

  async function handleRejectShift(shiftId: string) {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        status: 'open',
        assignedTo: null,
        assignedStaff: [],
        filledSlots: 0,
        rejectedAt: Timestamp.now()
      })
      setSuccess('Shift rejected successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to reject shift')
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
          
        case 'status':
          // Sort by status (open, pending, confirmed), then by date
          const statusOrder = { 'open': 0, 'pending': 1, 'confirmed': 2 }
          const statusA = statusOrder[a.status] || 0
          const statusB = statusOrder[b.status] || 0
          const statusCompare = statusA - statusB
          return statusCompare !== 0 ? statusCompare : a.date.localeCompare(b.date)
          
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
  
  // Calculate total slots across all shifts
  const totalSlots = shifts.reduce((total, shift) => total + (shift.slots || 1), 0)
  const totalFilledSlots = shifts.reduce((total, shift) => total + (shift.filledSlots || 0), 0)

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

      <div className="relative z-10 max-w-7xl mx-auto">
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
                Shift<span className="text-[#D5001C]">Lyst</span> Dashboard
              </h1>
              <p className="text-gray-300 text-xl font-light tracking-wide mb-1">Manage your team's shifts</p>
              <p className="text-gray-400 text-sm font-medium tracking-wider uppercase">Premium Management • Real-time Updates</p>
            </div>
          </div>
        <button
          onClick={handleLogout}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-2xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-bold tracking-wide transform hover:scale-[1.02]"
        >
          Logout
        </button>
      </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-6 mb-12">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="text-3xl font-bold text-gray-900 mb-2">{openShifts.length}</div>
            <div className="text-gray-600 font-medium">Open Shifts</div>
          </div>
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{pendingShifts.length}</div>
            <div className="text-gray-600 font-medium">Pending Approval</div>
          </div>
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="text-3xl font-bold text-green-600 mb-2">{confirmedShifts.length}</div>
            <div className="text-gray-600 font-medium">Confirmed Shifts</div>
          </div>
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="text-3xl font-bold text-[#D5001C] mb-2">{totalSlots}</div>
            <div className="text-gray-600 font-medium">Total Slots</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Enhanced Add Shift Form */}
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle form glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">+</span>
              </div>
              Add a New Shift
            </h2>

            <form onSubmit={handleAddShift} className="space-y-6 relative z-10">
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Role
                </label>
                <div className="relative role-dropdown-container">
        <input
          type="text"
                    placeholder="e.g., Bartender, Server, Lifeguard"
          value={role}
          onChange={e => setRole(e.target.value)}
                    onFocus={() => setShowRoleDropdown(true)}
          required
                    className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 pr-12 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#D5001C] transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showRoleDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-xl border-2 border-gray-200 rounded-2xl shadow-2xl z-10 max-h-48 overflow-y-auto">
                      <div className="p-3">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3 py-2">
                          Common Roles
                        </div>
                        {commonRoles.map((commonRole) => (
                          <button
                            key={commonRole}
                            type="button"
                            onClick={() => selectRole(commonRole)}
                            className="w-full text-left px-3 py-3 text-gray-700 hover:bg-gray-50/80 rounded-xl transition-all duration-200 font-medium hover:text-[#D5001C]"
                          >
                            {commonRole}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                    Date
                  </label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
                    onKeyUp={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.value.length === 10) { // YYYY-MM-DD format
                        const nextInput = target.parentElement?.parentElement?.nextElementSibling?.querySelector('input');
                        if (nextInput) nextInput.focus();
                      }
                    }}
          required
                    className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                    Pay Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payRate}
                    onChange={e => setPayRate(parseFloat(e.target.value))}
                    className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Number of Positions Available
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={slots}
                  onChange={e => setSlots(parseInt(e.target.value))}
                  className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  placeholder="e.g., 3 for 3 bartender positions"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                    Start Time
                  </label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
                    onKeyUp={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.value.length === 5) { // HH:MM format
                        const nextInput = target.parentElement?.parentElement?.nextElementSibling?.querySelector('input');
                        if (nextInput) nextInput.focus();
                      }
                    }}
            required
                    className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                    End Time
                  </label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            required
                    className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-4 bg-gray-50/80 border-2 border-gray-200 rounded-2xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includesTips}
                    onChange={e => setIncludesTips(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                  />
                  <span className="text-gray-700 font-bold group-hover:text-[#D5001C] transition-colors duration-300">Tips</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-gray-50/80 border-2 border-gray-200 rounded-2xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={bonusAvailable}
                    onChange={e => setBonusAvailable(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                  />
                  <span className="text-gray-700 font-bold group-hover:text-[#D5001C] transition-colors duration-300">Bonus</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-gray-50/80 border-2 border-gray-200 rounded-2xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={overtimePay}
                    onChange={e => setOvertimePay(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                  />
                  <span className="text-gray-700 font-bold group-hover:text-[#D5001C] transition-colors duration-300">Overtime</span>
                </label>
        </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-gray-50/80 border-2 border-gray-200 rounded-2xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer group">
        <input
                    type="checkbox"
                    checked={hidePay}
                    onChange={e => setHidePay(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                  />
                  <span className="text-gray-700 font-bold group-hover:text-[#D5001C] transition-colors duration-300">Hide pay information from staff</span>
                </label>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Notes (Optional)
                </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional details about this shift..."
          rows={3}
                  className="w-full bg-gray-50/80 border-2 border-gray-200 rounded-2xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium resize-none"
        />
              </div>

        <button
          type="submit"
                className="w-full bg-gradient-to-r from-[#D5001C] to-[#B0001A] hover:from-[#B0001A] hover:to-[#8B0015] text-white font-bold py-5 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group"
        >
                <span>Create Shift</span>
                {/* Button glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        </button>
      </form>
          </div>

          {/* Enhanced Shifts Management */}
          <div className="space-y-8">
            {/* Pending Approvals Section */}
            {pendingShifts.length > 0 && (
              <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
                {/* Subtle form glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl font-bold">⏳</span>
                  </div>
                  Pending Approvals ({pendingShifts.length})
                </h2>

                <div className="space-y-6 relative z-10">
                  {pendingShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="bg-gradient-to-br from-yellow-50/90 to-white/90 backdrop-blur-sm border-2 border-yellow-200/80 rounded-3xl p-8 hover:border-yellow-300/80 hover:shadow-xl transition-all duration-300 group"
                    >
                      {/* Header with role and pay */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors duration-300">
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
                                {shift.filledSlots || 0}/{shift.slots || 1} filled
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 bg-blue-50/80 rounded-xl px-3 py-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-blue-700 font-semibold text-sm">Assigned to: {shift.assignedTo}</span>
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

                      {/* Approval actions */}
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleRejectShift(shift.id)}
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveShift(shift.id)}
                          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-sm"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Shifts Section */}
            <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
              {/* Subtle form glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#D5001C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl font-bold">📋</span>
                </div>
                All Shifts
              </h2>

              {/* Sort Controls */}
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-widest">
                    Sort by:
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'closest' | 'date' | 'role' | 'status')}
                    className="bg-gray-50/80 border-2 border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 focus:bg-white transition-all duration-300 font-medium"
                  >
                    <option value="closest">Closest Upcoming</option>
                    <option value="date">Date</option>
                    <option value="role">Role</option>
                    <option value="status">Status</option>
                  </select>
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {totalSlots} slot{totalSlots !== 1 ? 's' : ''} total
                </div>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-12 relative z-10">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-[#D5001C] rounded-full animate-spin"></div>
                </div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-12 relative z-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <span className="text-gray-400 text-3xl">📅</span>
                  </div>
                  <p className="text-gray-600 text-xl font-bold mb-2">No shifts posted yet</p>
                  <p className="text-gray-400 text-sm font-medium tracking-wide">Create your first shift above</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-96 overflow-y-auto relative z-10">
                  {sortShifts(shifts).map((shift) => (
                    <div
              key={shift.id}
                      className="bg-gradient-to-br from-gray-50/90 to-white/90 backdrop-blur-sm border-2 border-gray-200/80 rounded-3xl p-8 hover:border-[#D5001C]/40 hover:shadow-xl transition-all duration-300 group"
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
                                {shift.filledSlots || 0}/{shift.slots || 1} filled
                              </span>
                            </div>
                          </div>
                          {shift.assignedTo && (
                            <div className="mt-3 flex items-center gap-2 bg-blue-50/80 rounded-xl px-3 py-2">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="text-blue-700 font-semibold text-sm">Assigned to: {shift.assignedTo}</span>
                            </div>
                          )}
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

                      {/* Status and actions */}
                      <div className="flex justify-between items-center">
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
                          shift.status === 'open' 
                            ? 'bg-blue-100/80 text-blue-700 border-blue-200' 
                            : shift.status === 'pending'
                            ? 'bg-yellow-100/80 text-yellow-700 border-yellow-200'
                            : 'bg-green-100/80 text-green-700 border-green-200'
                        }`}>
                          {shift.status === 'open' ? '🔍 Open' : shift.status === 'pending' ? '⏳ Pending' : '✅ Confirmed'}
                        </div>
                        
                        <div className="flex gap-2">
                          {shift.status === 'open' ? (
                            <button
                              onClick={() => confirmDelete(shift.id, shift.role)}
                              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-sm"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => confirmCancel(shift.id, shift.role)}
                              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-sm"
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
          </div>
        </div>
      </div>

      {/* Enhanced Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl relative overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent"></div>
            
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-red-500 text-3xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Delete Shift</h3>
              <p className="text-gray-600 mb-8 font-medium">
                Are you sure you want to delete the <span className="font-bold text-[#D5001C]">{deleteConfirm.shiftRole}</span> shift? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={cancelDelete}
                  className="flex-1 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 font-bold py-4 px-6 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-300 transform hover:scale-[1.02]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Close dialog immediately
                    setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' });
                    if (deleteConfirm.shiftId) handleDeleteShift(deleteConfirm.shiftId);
                  }}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Cancel Confirmation Dialog */}
      {cancelConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl relative overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent"></div>
            
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-orange-500 text-3xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Cancel Shift</h3>
              <p className="text-gray-600 mb-8 font-medium">
                Are you sure you want to cancel the <span className="font-bold text-[#D5001C]">{cancelConfirm.shiftRole}</span> shift? This will return it to open status and remove any assigned staff.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={cancelCancel}
                  className="flex-1 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 font-bold py-4 px-6 rounded-2xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-300 transform hover:scale-[1.02]"
                >
                  Keep Shift
                </button>
                <button
                  onClick={() => {
                    // Close dialog immediately
                    setCancelConfirm({ show: false, shiftId: null, shiftRole: '' });
                    if (cancelConfirm.shiftId) handleCancelShift(cancelConfirm.shiftId);
                  }}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                >
                  Cancel Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
