'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from './../lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { ShiftTemplate } from '../lib/types'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Template form state
  const [templateName, setTemplateName] = useState('')
  const [role, setRole] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [payRate, setPayRate] = useState(18)
  const [includesTips, setIncludesTips] = useState(false)
  const [bonusAvailable, setBonusAvailable] = useState(false)
  const [overtimePay, setOvertimePay] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        router.push('/')
        return
      }
    })

    // Get templates
    const templatesQuery = query(collection(db, 'templates'))
    
    const unsubscribeTemplates = onSnapshot(templatesQuery, snapshot => {
      const templatesData: ShiftTemplate[] = []
      snapshot.forEach(doc => {
        const data = doc.data()
        templatesData.push({
          id: doc.id,
          name: data.name,
          role: data.role,
          startTime: data.startTime,
          endTime: data.endTime,
          payRate: data.payRate,
          includesTips: data.includesTips || false,
          bonusAvailable: data.bonusAvailable || false,
          overtimePay: data.overtimePay || false,
          notes: data.notes,
          daysOfWeek: data.daysOfWeek || [],
          createdAt: data.createdAt?.toDate() || new Date(),
        })
      })
      setTemplates(templatesData)
      setLoading(false)
    })

    return () => {
      unsubscribeAuth()
      unsubscribeTemplates()
    }
  }, [router])

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateName || !role || !startTime || !endTime) {
      alert('Please fill out all required fields')
      return
    }

    try {
      await addDoc(collection(db, 'templates'), {
        name: templateName,
        role,
        startTime,
        endTime,
        payRate,
        includesTips,
        bonusAvailable,
        overtimePay,
        notes,
        daysOfWeek: selectedDays,
        createdAt: Timestamp.now(),
      })

      // Reset form
      setTemplateName('')
      setRole('')
      setStartTime('')
      setEndTime('')
      setPayRate(18)
      setIncludesTips(false)
      setBonusAvailable(false)
      setOvertimePay(false)
      setNotes('')
      setSelectedDays([])
      setShowCreateForm(false)
    } catch (err) {
      console.error('Failed to create template:', err)
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteDoc(doc(db, 'templates', templateId))
      } catch (err) {
        console.error('Failed to delete template:', err)
      }
    }
  }

  function toggleDay(dayValue: number) {
    setSelectedDays(prev => 
      prev.includes(dayValue) 
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D5001C]"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6 relative overflow-hidden">
      {/* Porsche-style subtle background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D5001C]/4 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D5001C]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
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
                ShiftLyst Templates
              </h1>
              <p className="text-gray-300 text-lg font-light tracking-wide">Save time with reusable shift patterns</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-[#D5001C] hover:bg-[#B0001A] text-white font-semibold px-8 py-4 rounded-xl shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300 tracking-wide"
            >
              {showCreateForm ? 'Cancel' : 'Create Template'}
            </button>
            <button
              onClick={() => router.push('/manager')}
              className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-xl hover:bg-white/20 hover:border-[#D5001C]/30 transition-all duration-300 font-medium tracking-wide"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Create Template Form */}
        {showCreateForm && (
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">+</span>
              </div>
              Create New Template
            </h2>

            <form onSubmit={handleCreateTemplate} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    Template Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Weekend Bartender"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    Role
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Bartender, Server, Lifeguard"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                    Pay Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={payRate}
                    onChange={e => setPayRate(parseFloat(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300"
                    required
                  />
                </div>
              </div>

              {/* Pay Options */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="includesTips"
                    checked={includesTips}
                    onChange={e => setIncludesTips(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-[#D5001C]/20 focus:ring-offset-0"
                  />
                  <label htmlFor="includesTips" className="text-sm font-medium text-gray-700">
                    Includes tips
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="bonusAvailable"
                    checked={bonusAvailable}
                    onChange={e => setBonusAvailable(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-[#D5001C]/20 focus:ring-offset-0"
                  />
                  <label htmlFor="bonusAvailable" className="text-sm font-medium text-gray-700">
                    Bonus available
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="overtimePay"
                    checked={overtimePay}
                    onChange={e => setOvertimePay(e.target.checked)}
                    className="w-5 h-5 text-[#D5001C] bg-gray-50 border border-gray-200 rounded focus:ring-1 focus:ring-[#D5001C]/20 focus:ring-offset-0"
                  />
                  <label htmlFor="overtimePay" className="text-sm font-medium text-gray-700">
                    Overtime pay
                  </label>
                </div>
              </div>

              {/* Days of Week */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                  Days of Week
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`p-3 rounded-lg border transition-all duration-300 ${
                        selectedDays.includes(day.value)
                          ? 'bg-[#D5001C] border-[#D5001C] text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-[#D5001C]/30'
                      }`}
                    >
                      {day.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g., Bring POS key, wear uniform"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 placeholder-gray-500 focus:border-[#D5001C] focus:outline-none focus:ring-1 focus:ring-[#D5001C]/20 transition-all duration-300 resize-none"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#D5001C] hover:bg-[#B0001A] text-white font-semibold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300"
              >
                Create Template
              </button>
            </form>
          </div>
        )}

        {/* Templates List */}
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">📋</span>
            </div>
            Saved Templates
          </h2>

          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📋</span>
              </div>
              <p className="text-gray-500">No templates created yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first template to save time</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-[#D5001C]/30 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{template.name}</h3>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <span>👤</span>
                        <span className="font-medium">{template.role}</span>
                        <span>•</span>
                        <span>{template.startTime} - {template.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <span>📅</span>
                        <span>
                          {template.daysOfWeek.length > 0 
                            ? template.daysOfWeek.map(d => daysOfWeek[d].label.slice(0, 3)).join(', ')
                            : 'No specific days'
                          }
                        </span>
                      </div>
                      {template.notes && (
                        <p className="text-gray-600 text-sm flex items-start gap-2">
                          <span className="mt-1">📝</span>
                          <span>{template.notes}</span>
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      {/* Pay Display */}
                      <div className="text-right">
                        <div className="bg-[#D5001C] text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
                          ${template.payRate.toFixed(2)}/hr{template.includesTips ? ' + tips' : ''}
                        </div>
                        {(template.bonusAvailable || template.overtimePay) && (
                          <div className="flex gap-1 justify-end">
                            {template.bonusAvailable && (
                              <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                                💰 Bonus
                              </span>
                            )}
                            {template.overtimePay && (
                              <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                                ⏰ OT
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // TODO: Implement use template functionality
                            alert('Use template functionality coming soon!')
                          }}
                          className="bg-[#D5001C] hover:bg-[#B0001A] text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-[1.01] transition-all duration-300 text-sm"
                        >
                          Use Template
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-all duration-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
} 