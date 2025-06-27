'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth , db } from './../lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
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
  createdAt: Timestamp
}

export default function ManagerDashboardPage() {
  const router = useRouter()

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
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, shiftId: string | null, shiftRole: string}>({
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
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (!user) router.push('/')
    })

    // Listen for shifts collection changes
    const q = query(
      collection(db, 'shifts'),
      orderBy('createdAt', 'desc')
    )
    const unsubscribeShifts = onSnapshot(
      q,
      snapshot => {
        const shiftsData: Shift[] = []
        snapshot.forEach(doc => {
          const data = doc.data()
          shiftsData.push({
            id: doc.id,
            role: data.role,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            payRate: data.payRate,
            includesTips: data.includesTips || false,
            bonusAvailable: data.bonusAvailable || false,
            overtimePay: data.overtimePay || false,
            hidePay: data.hidePay || false,
            notes: data.notes,
            status: data.status || 'open',
            assignedTo: data.assignedTo,
            createdAt: data.createdAt,
          })
        })
        setShifts(shiftsData)
        setLoading(false)
      },
      err => {
        setError('Failed to load shifts')
        setLoading(false)
      }
    )

    return () => {
      unsubscribeAuth()
      unsubscribeShifts()
    }
  }, [router])

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

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!role || !date || !startTime || !endTime) {
      setError('Please fill out all required fields')
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
        assignedTo: null
      })
    } catch (err) {
      setError('Failed to cancel shift')
    }
  }

  function confirmDelete(shiftId: string, shiftRole: string) {
    setDeleteConfirm({ show: true, shiftId, shiftRole })
  }

  function cancelDelete() {
    setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' })
  }

  function selectRole(selectedRole: string) {
    setRole(selectedRole)
    setShowRoleDropdown(false)
  }

  async function handleLogout() {
    await signOut(auth)
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
      {/* Porsche-style subtle background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Success Toast */}
        {success && (
          <div className="fixed bottom-6 right-6 bg-green-500/90 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 z-[100] animate-fade-in">
            {success}
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#D5001C] to-[#B0001A] rounded-2xl shadow-xl flex items-center justify-center relative overflow-hidden">
              {/* Logo design - stylized "S" with shift arrow */}
              <div className="relative z-10 flex items-center justify-center">
                <div className="relative">
                  <div className="text-white font-bold text-xl tracking-tight">S</div>
                  {/* Shift arrow overlay */}
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t border-r border-white transform rotate-45"></div>
                </div>
              </div>
              {/* Geometric accents */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
              <div className="absolute bottom-1 left-1 w-1 h-1 bg-white/15 rounded-full"></div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                ShiftLyst Dashboard
              </h1>
              <p className="text-gray-300 text-lg font-light tracking-wide">Manage your team's shifts</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-medium tracking-wide"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Add Shift Form */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#D5001C] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">+</span>
              </div>
              Add a New Shift
            </h2>

            <form onSubmit={handleAddShift} className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300 pr-12"
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
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      <div className="p-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">
                          Common Roles
                        </div>
                        {commonRoles.map((commonRole) => (
                          <button
                            key={commonRole}
                            type="button"
                            onClick={() => selectRole(commonRole)}
                            className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
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
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    Pay Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payRate}
                    onChange={e => setPayRate(parseFloat(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                  Additional Benefits
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includesTips}
                      onChange={e => setIncludesTips(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Tips</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bonusAvailable}
                      onChange={e => setBonusAvailable(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Bonus</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overtimePay}
                      onChange={e => setOvertimePay(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Overtime</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                  Hide Pay
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hidePay}
                      onChange={e => setHidePay(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Hide Pay</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Any additional details about this shift..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-semibold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300"
              >
                Post Shift
              </button>
            </form>
          </div>

          {/* Shifts List */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#D5001C] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">📋</span>
              </div>
              All Shifts
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">📅</span>
                </div>
                <p className="text-gray-500 text-lg">No shifts posted yet</p>
                <p className="text-gray-400 text-sm mt-2">Create your first shift above</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-190 overflow-y-auto">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:border-[#D5001C]/30 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{shift.role}</h3>
                        <div className="flex items-center gap-4 text-gray-600 mb-2">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="font-medium">{shift.date}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg">⏰</span>
                            <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                          </span>
                        </div>
                        {shift.notes && (
                          <p className="text-gray-600 text-sm flex items-start gap-2">
                            <span className="mt-1">📝</span>
                            <span>{shift.notes}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-3">
                        {!shift.hidePay && (
                          <div className="bg-[#D5001C] text-white text-sm font-bold px-4 py-2 rounded-full">
                            ${shift.payRate.toFixed(2)}/hr
                          </div>
                        )}
                        <div className="flex gap-2">
                          {shift.includesTips && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              💰 Tips
                            </span>
                          )}
                          {shift.bonusAvailable && (
                            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎁 Bonus
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏰ OT
                            </span>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          shift.status === 'open' 
                            ? 'bg-blue-100 text-blue-700' 
                            : shift.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                        </div>
                        {shift.status === 'open' ? (
                          <button
                            onClick={() => confirmDelete(shift.id, shift.role)}
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300 text-sm"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCancelShift(shift.id)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300 text-sm"
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Shift</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the <span className="font-semibold">{deleteConfirm.shiftRole}</span> shift? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={cancelDelete}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Close dialog immediately
                    setDeleteConfirm({ show: false, shiftId: null, shiftRole: '' });
                    if (deleteConfirm.shiftId) handleDeleteShift(deleteConfirm.shiftId);
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
