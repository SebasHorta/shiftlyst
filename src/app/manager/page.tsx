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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 to-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg flex items-center justify-center">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Shifty Dashboard
              </h1>
              <p className="text-gray-400 text-sm">Manage your team's shifts</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-red-300 px-6 py-3 rounded-xl hover:bg-red-500/30 transition-all duration-300"
          >
            Logout
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Add Shift Form */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">+</span>
              </div>
              Add a New Shift
            </h2>

            <form onSubmit={handleAddShift} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Role
                </label>
                <input
                  type="text"
                  placeholder="e.g., Bartender, Server, Lifeguard"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                    className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                    className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Pay Rate ($/hr)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={payRate}
                  onChange={e => setPayRate(parseFloat(e.target.value))}
                  className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300"
                  placeholder="18.00"
                  required
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="includesTips"
                  checked={includesTips}
                  onChange={e => setIncludesTips(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white/90 border border-white/20 rounded focus:ring-2 focus:ring-blue-400/30 focus:ring-offset-0"
                />
                <label htmlFor="includesTips" className="text-sm font-medium text-gray-300">
                  Includes tips
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="bonusAvailable"
                  checked={bonusAvailable}
                  onChange={e => setBonusAvailable(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white/90 border border-white/20 rounded focus:ring-2 focus:ring-blue-400/30 focus:ring-offset-0"
                />
                <label htmlFor="bonusAvailable" className="text-sm font-medium text-gray-300">
                  Bonus available
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="overtimePay"
                  checked={overtimePay}
                  onChange={e => setOvertimePay(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-white/90 border border-white/20 rounded focus:ring-2 focus:ring-blue-400/30 focus:ring-offset-0"
                />
                <label htmlFor="overtimePay" className="text-sm font-medium text-gray-300">
                  Overtime pay after 8 hours
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g., Bring POS key, wear uniform"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-white/90 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-gray-900 placeholder-gray-600 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all duration-300 resize-none"
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
              >
                Create Shift
              </button>
            </form>
          </div>

          {/* Recent Shifts */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📅</span>
              </div>
              Recent Shifts
            </h2>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            )}

            {!loading && shifts.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400 text-2xl">📋</span>
                </div>
                <p className="text-gray-400">No shifts created yet</p>
                <p className="text-gray-500 text-sm mt-1">Create your first shift to get started</p>
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {shifts.map(shift => (
                <div
                  key={shift.id}
                  className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{shift.role}</h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        ${shift.payRate.toFixed(2)}/hr{shift.includesTips ? ' + tips' : ''}
                      </span>
                      {(shift.bonusAvailable || shift.overtimePay) && (
                        <div className="flex gap-1">
                          {shift.bonusAvailable && (
                            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              💰 Bonus
                            </span>
                          )}
                          {shift.overtimePay && (
                            <span className="bg-gradient-to-r from-purple-400 to-pink-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              ⏰ OT
                            </span>
                          )}
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="mt-2">
                        {shift.status === 'open' && (
                          <span className="bg-gradient-to-r from-red-400 to-pink-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            🔴 Open
                          </span>
                        )}
                        {shift.status === 'pending' && (
                          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            🟡 Pending
                          </span>
                        )}
                        {shift.status === 'confirmed' && (
                          <span className="bg-gradient-to-r from-green-400 to-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            🟢 Confirmed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-gray-700">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-500">📅</span>
                      {shift.date} • {shift.startTime} - {shift.endTime}
                    </p>
                    {shift.assignedTo && (
                      <p className="flex items-center gap-2">
                        <span className="text-gray-500">👤</span>
                        <span className="text-sm">Assigned to worker</span>
                      </p>
                    )}
                    {shift.notes && (
                      <p className="flex items-start gap-2">
                        <span className="text-gray-500 mt-1">📝</span>
                        <span className="text-sm">{shift.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
