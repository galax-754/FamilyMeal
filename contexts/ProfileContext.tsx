'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface ProfileContextValue {
  profile: Profile | null
  familyId: string | null
  userId: string | null
  isAdmin: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  familyId: null,
  userId: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  return (
    <ProfileContext.Provider value={{
      profile,
      familyId: profile?.family_id ?? null,
      userId,
      isAdmin: profile?.role === 'admin',
      loading,
      refresh: fetchProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
