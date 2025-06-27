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
  const [notes, setNotes] = useState('')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      setNotes('')
    } catch (err) {
      setError('Failed to add shift')
    }
  }

  async function handleLogout() {
    await signOut(auth)
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-black p-6 relative overflow-hidden">
      {/* Porsche-style background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[#D5001C] rounded-2xl shadow-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-tight">S</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Shifty Dashboard
              </h1>
              <p className="text-gray-400 text-lg font-light tracking-wide">Manage your team's shifts</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-semibold tracking-wide"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Add Shift Form */}
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-10 shadow-2xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-[#D5001C] rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">+</span>
              </div>
              Add a New Shift
            </h2>

            <form onSubmit={handleAddShift} className="space-y-8">
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                  Role
                </label>
                <input
                  type="text"
                  placeholder="e.g., Bartender, Server, Lifeguard"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                    Pay Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payRate}
                    onChange={e => setPayRate(parseFloat(e.target.value))}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                  Additional Benefits
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includesTips}
                      onChange={e => setIncludesTips(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Tips</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bonusAvailable}
                      onChange={e => setBonusAvailable(e.target.checked)}
                      className="w-5 h-5 text-[#D5001C] border-gray-300 rounded focus:ring-[#D5001C]"
                    />
                    <span className="text-gray-700 font-medium">Bonus</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-[#D5001C]/30 transition-all duration-300 cursor-pointer">
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

              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-600 uppercase tracking-widest">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Any additional details about this shift..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-2 focus:ring-[#D5001C]/20 transition-all duration-300 text-lg resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-bold py-5 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 text-lg tracking-wide"
              >
                Post Shift
              </button>
            </form>
          </div>

          {/* Shifts List */}
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-10 shadow-2xl">
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
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 hover:border-[#D5001C]/30 transition-all duration-300"
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
                        <div className="bg-[#D5001C] text-white text-sm font-bold px-4 py-2 rounded-full">
                          ${shift.payRate.toFixed(2)}/hr
                        </div>
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
