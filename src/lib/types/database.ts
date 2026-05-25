// Hand-written types for the ChoreSync Supabase schema.
// Regenerate with: npx supabase gen types typescript --linked > src/lib/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── Raw database shape ─────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_by: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code?: string
          created_by?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          invite_code?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          id: string
          user_id: string
          household_id: string
          role: 'admin' | 'member' | 'kids'
          color_theme: string
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          household_id: string
          role?: 'admin' | 'member' | 'kids'
          color_theme?: string
          joined_at?: string
        }
        Update: {
          role?: 'admin' | 'member' | 'kids'
          color_theme?: string
        }
        Relationships: []
      }
      chores: {
        Row: {
          id: string
          household_id: string
          name: string
          description: string | null
          assigned_to: string | null
          due_date: string | null          // ISO date 'YYYY-MM-DD'
          frequency: ChoreFrequency
          priority: ChorePriority
          category: ChoreCategory
          estimated_mins: number | null
          status: ChoreStatus
          completed_at: string | null
          completed_by: string | null
          photo_proof_url: string | null
          last_completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          // Rotation & points (migration 003)
          rotation_enabled: boolean
          rotation_members: string[]       // ordered user_id array
          rotation_index: number
          points: number                   // 0–100
          subtasks: Json
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          description?: string | null
          assigned_to?: string | null
          due_date?: string | null
          frequency?: ChoreFrequency
          priority?: ChorePriority
          category?: ChoreCategory
          estimated_mins?: number | null
          status?: ChoreStatus
          completed_at?: string | null
          completed_by?: string | null
          photo_proof_url?: string | null
          last_completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          rotation_enabled?: boolean
          rotation_members?: string[]
          rotation_index?: number
          points?: number
          subtasks?: Json
        }
        Update: {
          name?: string
          description?: string | null
          assigned_to?: string | null
          due_date?: string | null
          frequency?: ChoreFrequency
          priority?: ChorePriority
          category?: ChoreCategory
          estimated_mins?: number | null
          status?: ChoreStatus
          completed_at?: string | null
          completed_by?: string | null
          photo_proof_url?: string | null
          last_completed_at?: string | null
          updated_at?: string
          rotation_enabled?: boolean
          rotation_members?: string[]
          rotation_index?: number
          points?: number
          subtasks?: Json
        }
        Relationships: []
      }
      swap_requests: {
        Row: {
          id: string
          chore_id: string
          household_id: string
          requester_id: string
          requestee_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chore_id: string
          household_id: string
          requester_id: string
          requestee_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'accepted' | 'declined'
          updated_at?: string
        }
        Relationships: []
      }
      point_events: {
        Row: {
          id: string
          user_id: string
          household_id: string
          chore_id: string | null
          chore_name: string
          points: number
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          household_id: string
          chore_id?: string | null
          chore_name?: string
          points: number
          earned_at?: string
        }
        Update: {
          points?: number
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          user_id: string
          household_id: string
          badge_type: BadgeType
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          household_id: string
          badge_type: BadgeType
          earned_at?: string
        }
        Update: {
          badge_type?: BadgeType
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          id: string
          user_id: string
          household_id: string
          current_streak: number
          longest_streak: number
          last_active_date: string | null
          total_completions: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          household_id: string
          current_streak?: number
          longest_streak?: number
          last_active_date?: string | null
          total_completions?: number
          updated_at?: string
        }
        Update: {
          current_streak?: number
          longest_streak?: number
          last_active_date?: string | null
          total_completions?: number
          updated_at?: string
        }
        Relationships: []
      }
      chore_completions: {
        Row: {
          id: string
          household_id: string
          chore_id: string | null
          chore_name: string
          category: string
          priority: string
          completed_by: string
          completed_at: string
          due_date: string | null
          was_on_time: boolean | null
          points: number
          photo_proof_url: string | null
        }
        Insert: {
          id?: string
          household_id: string
          chore_id?: string | null
          chore_name: string
          category?: string
          priority?: string
          completed_by: string
          completed_at?: string
          due_date?: string | null
          was_on_time?: boolean | null
          points?: number
          photo_proof_url?: string | null
        }
        Update: {
          photo_proof_url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          household_id: string
          user_id: string
          content: string
          created_at: string
          edited_at: string | null
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          content: string
          created_at?: string
          edited_at?: string | null
        }
        Update: {
          content?: string
          edited_at?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          emoji?: string
        }
        Relationships: []
      }
      chore_comments: {
        Row: {
          id: string
          chore_id: string
          household_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          chore_id: string
          household_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          content?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          household_id: string
          created_by: string
          content: string
          is_pinned: boolean
          pinned_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          created_by: string
          content: string
          is_pinned?: boolean
          pinned_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          is_pinned?: boolean
          pinned_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id:           string
          user_id:      string
          household_id: string
          endpoint:     string
          p256dh:       string
          auth:         string
          created_at:   string
        }
        Insert: {
          id?:          string
          user_id:      string
          household_id: string
          endpoint:     string
          p256dh:       string
          auth:         string
          created_at?:  string
        }
        Update: {
          endpoint?:    string
          p256dh?:      string
          auth?:        string
        }
        Relationships: []
      }
      user_notification_prefs: {
        Row: {
          id:              string
          user_id:         string
          household_id:    string
          notify_due:      boolean
          notify_overdue:  boolean
          notify_assigned: boolean
          notify_nudge:    boolean
          quiet_start:     string | null
          quiet_end:       string | null
          updated_at:      string
        }
        Insert: {
          id?:             string
          user_id:         string
          household_id:    string
          notify_due?:     boolean
          notify_overdue?: boolean
          notify_assigned?: boolean
          notify_nudge?:   boolean
          quiet_start?:    string | null
          quiet_end?:      string | null
          updated_at?:     string
        }
        Update: {
          notify_due?:     boolean
          notify_overdue?: boolean
          notify_assigned?: boolean
          notify_nudge?:   boolean
          quiet_start?:    string | null
          quiet_end?:      string | null
          updated_at?:     string
        }
        Relationships: []
      }
      nudge_log: {
        Row: {
          id:          string
          chore_id:    string
          sender_id:   string
          receiver_id: string
          sent_at:     string
        }
        Insert: {
          id?:         string
          chore_id:    string
          sender_id:   string
          receiver_id: string
          sent_at?:    string
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      generate_invite_code:   { Args: Record<string, never>; Returns: string }
      is_household_admin:     { Args: { p_household_id: string }; Returns: boolean }
      my_household_id:        { Args: Record<string, never>; Returns: string | null }
      next_chore_due_date:    { Args: { p_due_date: string; p_frequency: string }; Returns: string }
    }
    Enums: Record<string, never>
  }
}

// ── Domain literal types ──────────────────────────────────────────────────────
export type MessageEmoji  = '👍' | '❤️' | '😂' | '😮' | '🎉' | '🔥'
export type ChoreFrequency = 'one-time' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
export type ChorePriority  = 'low' | 'medium' | 'high'
export type ChoreCategory  = 'kitchen' | 'bathroom' | 'bedroom' | 'outdoor' | 'laundry' | 'general'
export type ChoreStatus    = 'incomplete' | 'completed'
export type BadgeType      = 'first_chore' | 'chores_10' | 'chores_100' | 'streak_7' | 'streak_30' | 'top_contributor'

// ── Convenience row aliases ────────────────────────────────────────────────────
export type UserRow             = Database['public']['Tables']['users']['Row']
export type HouseholdRow        = Database['public']['Tables']['households']['Row']
export type HouseholdMemberRow  = Database['public']['Tables']['household_members']['Row']
export type ChoreRow            = Database['public']['Tables']['chores']['Row']
export type SwapRequestRow      = Database['public']['Tables']['swap_requests']['Row']
export type PointEventRow       = Database['public']['Tables']['point_events']['Row']
export type BadgeRow            = Database['public']['Tables']['badges']['Row']
export type UserStreakRow        = Database['public']['Tables']['user_streaks']['Row']

// ── Enriched / joined types ────────────────────────────────────────────────────

export interface HouseholdMember extends HouseholdMemberRow {
  user: UserRow
}

export interface HouseholdWithMembers extends HouseholdRow {
  members: HouseholdMember[]
}

export interface ChoreWithAssignee extends ChoreRow {
  assignee: UserRow | null
}

/** Safely cast ChoreRow.subtasks (Json) to the typed array at runtime. */
export function parseSubtasks(json: Json): SubtaskItem[] {
  if (!Array.isArray(json)) return []
  return (json as unknown[]).filter((x): x is SubtaskItem =>
    typeof x === 'object' && x !== null && !Array.isArray(x) &&
    typeof (x as Record<string, unknown>).id === 'string' &&
    typeof (x as Record<string, unknown>).title === 'string'
  )
}

/** Swap request enriched with chore name and requester profile */
export interface SwapRequestWithDetails extends SwapRequestRow {
  chore:     { id: string; name: string } | null
  requester: UserRow | null
}

/** A row in the weekly leaderboard */
export interface LeaderboardEntry {
  userId:         string
  name:           string | null
  avatarUrl:      string | null
  color:          string
  pointsThisWeek: number
  pointsAllTime:  number
}

// ── Household settings (stored as JSONB) ──────────────────────────────────────
export interface HouseholdSettings {
  resetDay?: 'sunday' | 'monday'
  darkMode?: boolean
  customCategories?: string[]
  pointValues?: {
    low?: number
    medium?: number
    high?: number
  }
  notificationsEnabled?: boolean
}

// ── History / completion log types ───────────────────────────────────────────

export interface ChoreCompletionRow {
  id:              string
  household_id:    string
  chore_id:        string | null
  chore_name:      string
  category:        string
  priority:        string
  completed_by:    string
  completed_at:    string
  due_date:        string | null
  was_on_time:     boolean | null
  points:          number
  photo_proof_url: string | null
}

export interface ChoreCompletionWithMember extends ChoreCompletionRow {
  member: {
    id:        string
    name:      string | null
    avatarUrl: string | null
    color:     string
  } | null
}

// Analytics summaries computed server-side
export interface MemberStat {
  userId:      string
  name:        string | null
  avatarUrl:   string | null
  color:       string
  completions: number
  onTime:      number
  late:        number
  points:      number
}

export interface CategoryStat {
  category: string
  count:    number
}

export interface WeeklyTrend {
  weekLabel: string        // "Apr 28"
  weekStart: string        // ISO date
  count:     number
}

export interface AnalyticsSummary {
  total:         number
  onTime:        number
  late:          number
  noDueDate:     number
  totalPoints:   number
  byMember:      MemberStat[]
  byCategory:    CategoryStat[]
  weeklyTrend:   WeeklyTrend[]
}

// ── Social row types ──────────────────────────────────────────────────────────

export interface MessageRow {
  id:           string
  household_id: string
  user_id:      string
  content:      string
  created_at:   string
  edited_at:    string | null
}

export interface MessageReactionRow {
  id:         string
  message_id: string
  user_id:    string
  emoji:      MessageEmoji
  created_at: string
}

export interface ChoreCommentRow {
  id:           string
  chore_id:     string
  household_id: string
  user_id:      string
  content:      string
  created_at:   string
}

export interface AnnouncementRow {
  id:           string
  household_id: string
  created_by:   string
  content:      string
  is_pinned:    boolean
  pinned_at:    string | null
  created_at:   string
  updated_at:   string
}

// ── Social enriched types ─────────────────────────────────────────────────────

export interface MessageWithMeta extends MessageRow {
  author:    UserRow | null
  reactions: MessageReactionRow[]
}

export interface ChoreCommentWithAuthor extends ChoreCommentRow {
  author: UserRow | null
}

export interface SubtaskItem {
  id:        string
  title:     string
  completed: boolean
}

export interface AnnouncementWithAuthor extends AnnouncementRow {
  author: UserRow | null
}

// ── Supabase Auth user shape ──────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  user_metadata: {
    full_name?: string
    name?: string
    avatar_url?: string
  }
}
