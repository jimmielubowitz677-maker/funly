// Hand-authored types — regenerate from the live schema any time with:
//   npx supabase gen types typescript --project-id fmdlfhdrlraaiqqriffs > lib/supabase/database.types.ts

export type Database = {
  public: {
    Tables: {
      otp_codes: {
        Row: {
          id:         string
          email:      string
          code_hash:  string
          expires_at: string
          used:       boolean
          created_at: string
        }
        Insert: {
          id?:         string
          email:       string
          code_hash:   string
          expires_at?: string
          used?:       boolean
          created_at?: string
        }
        Update: {
          id?:         string
          email?:      string
          code_hash?:  string
          expires_at?: string
          used?:       boolean
          created_at?: string
        }
        Relationships: never[]
      }
      users: {
        Row: {
          id:                       string
          owner_id:                 string | null
          username:                 string
          display_name:             string | null
          email:                    string
          bio:                      string | null
          avatar_url:               string | null
          banner_url:               string | null
          is_creator:               boolean
          subscription_price_cents: number | null
          payout_account_id:        string | null
          is_verified:              boolean
          is_banned:                boolean
          display_subscriber_count:    number | null
          creator_terms_accepted_at:   string | null
          first_login_post_eligible:   boolean
          is_online:                   boolean
          online_status_updated_at:    string | null
          created_at:                  string
          updated_at:                  string
        }
        Insert: {
          id:                         string
          owner_id?:                  string | null
          username:                   string
          email:                      string
          display_name?:              string | null
          bio?:                       string | null
          avatar_url?:                string | null
          banner_url?:                string | null
          is_creator?:                boolean
          subscription_price_cents?:  number | null
          payout_account_id?:         string | null
          is_verified?:               boolean
          is_banned?:                 boolean
          display_subscriber_count?:   number | null
          creator_terms_accepted_at?:  string | null
          first_login_post_eligible?:  boolean
          is_online?:                  boolean
          online_status_updated_at?:   string | null
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: never[]
      }
      first_login_campaigns: {
        Row: { id: string; enabled: boolean; post_id: string | null; animation_delay_ms: number; created_at: string; updated_at: string }
        Insert: { id?: string; enabled?: boolean; post_id?: string | null; animation_delay_ms?: number; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['first_login_campaigns']['Insert']>
        Relationships: never[]
      }
      first_login_deliveries: {
        Row: { id: string; user_id: string; campaign_id: string; post_id: string | null; delivered_at: string; animation_shown_at: string | null; is_test: boolean }
        Insert: { id?: string; user_id: string; campaign_id: string; post_id?: string | null; delivered_at?: string; animation_shown_at?: string | null; is_test?: boolean }
        Update: Partial<Database['public']['Tables']['first_login_deliveries']['Insert']>
        Relationships: never[]
      }
      subscriptions: {
        Row: {
          id:                   string
          subscriber_id:        string
          creator_id:           string
          status:               'active' | 'cancelled' | 'expired' | 'past_due'
          price_paid_cents:     number
          currency:             string
          current_period_start: string
          current_period_end:   string
          cancelled_at:         string | null
          plan_id:              string | null
          created_at:           string
          updated_at:           string
        }
        Insert: {
          id?:                   string
          subscriber_id:         string
          creator_id:            string
          status?:               'active' | 'cancelled' | 'expired' | 'past_due'
          price_paid_cents:      number
          currency?:             string
          current_period_start?: string
          current_period_end:    string
          cancelled_at?:         string | null
          plan_id?:              string | null
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: never[]
      }
      posts: {
        Row: {
          id:                  string
          creator_id:          string
          title:               string | null
          body:                string | null
          post_type:           'free' | 'premium' | 'ppv'
          ppv_price_cents:     number | null
          is_premium:          boolean
          is_published:        boolean
          published_at:        string | null
          like_count:          number
          comment_count:       number
          tip_total_cents:     number
          comments_disabled:   boolean
          display_like_count:  number | null
          created_at:          string
          updated_at:          string
        }
        Insert: {
          id?:                  string
          creator_id:           string
          title?:               string | null
          body?:                string | null
          post_type?:           'free' | 'premium' | 'ppv'
          ppv_price_cents?:     number | null
          is_premium?:          boolean
          is_published?:        boolean
          published_at?:        string | null
          like_count?:          number
          comment_count?:       number
          tip_total_cents?:     number
          comments_disabled?:   boolean
          display_like_count?:  number | null
        }
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
        Relationships: never[]
      }
      likes: {
        Row: {
          user_id:    string
          post_id:    string
          created_at: string
        }
        Insert: {
          user_id:     string
          post_id:     string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['likes']['Insert']>
        Relationships: never[]
      }
      comments: {
        Row: {
          id:         string
          post_id:    string
          user_id:    string
          body:       string
          created_at: string
        }
        Insert: {
          id?:         string
          post_id:     string
          user_id:     string
          body:        string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
        Relationships: never[]
      }
      media: {
        Row: {
          id:               string
          post_id:          string | null
          uploader_id:      string
          media_type:       'image' | 'video' | 'audio' | 'document'
          url:              string
          thumbnail_url:    string | null
          file_name:        string | null
          file_size_bytes:  number | null
          duration_secs:    number | null
          width:            number | null
          height:           number | null
          sort_order:       number
          created_at:       string
        }
        Insert: {
          id?:              string
          post_id?:         string | null
          uploader_id:      string
          media_type:       'image' | 'video' | 'audio' | 'document'
          url:              string
          thumbnail_url?:   string | null
          file_name?:       string | null
          file_size_bytes?: number | null
          duration_secs?:   number | null
          width?:           number | null
          height?:          number | null
          sort_order?:      number
        }
        Update: Partial<Database['public']['Tables']['media']['Insert']>
        Relationships: never[]
      }
      messages: {
        Row: {
          id:               string
          sender_id:        string
          recipient_id:     string
          body:             string | null
          tip_amount_cents: number | null
          is_paid_content:  boolean
          status:           'sent' | 'delivered' | 'read'
          read_at:          string | null
          created_at:       string
        }
        Insert: {
          id?:               string
          sender_id:         string
          recipient_id:      string
          body?:             string | null
          tip_amount_cents?: number | null
          is_paid_content?:  boolean
          status?:           'sent' | 'delivered' | 'read'
          read_at?:          string | null
        }
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
        Relationships: never[]
      }
      payments: {
        Row: {
          id:                  string
          payer_id:            string
          payee_id:            string
          subscription_id:     string | null
          message_id:          string | null
          post_id:             string | null
          amount_cents:        number
          platform_fee_cents:  number
          currency:            string
          status:              'pending' | 'completed' | 'failed' | 'refunded'
          provider:            'stripe' | 'paypal' | 'crypto'
          provider_payment_id: string | null
          provider_fee_cents:  number | null
          refunded_at:         string | null
          refund_reason:       string | null
          original_amount_cents: number | null
          discount_amount_cents: number
          promo_code_id: string | null
          promo_code_snapshot: string | null
          discount_percent: number | null
          purchase_plan_id: string | null
          created_at:          string
          updated_at:          string
        }
        Insert: {
          id?:                  string
          payer_id:             string
          payee_id:             string
          subscription_id?:     string | null
          message_id?:          string | null
          post_id?:             string | null
          amount_cents:         number
          platform_fee_cents?:  number
          currency?:            string
          status?:              'pending' | 'completed' | 'failed' | 'refunded'
          provider:             'stripe' | 'paypal' | 'crypto'
          provider_payment_id?: string | null
          provider_fee_cents?:  number | null
          refunded_at?:         string | null
          refund_reason?:       string | null
          original_amount_cents?: number | null
          discount_amount_cents?: number
          promo_code_id?: string | null
          promo_code_snapshot?: string | null
          discount_percent?: number | null
          purchase_plan_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
        Relationships: never[]
      }
    }
    Views:     Record<string, never>
    Functions: {
      claim_first_login_delivery: {
        Args: Record<string, never>
        Returns: Array<{ delivery_id: string; campaign_id: string; post_id: string; delivered_at: string; animation_delay_ms: number; created: boolean }>
      }
    }
    Enums: {
      subscription_status: 'active' | 'cancelled' | 'expired' | 'past_due'
      payment_status:      'pending' | 'completed' | 'failed' | 'refunded'
      payment_provider:    'stripe' | 'paypal' | 'crypto'
      post_type:           'free' | 'premium' | 'ppv'
      media_type:          'image' | 'video' | 'audio' | 'document'
      message_status:      'sent' | 'delivered' | 'read'
    }
    CompositeTypes: Record<string, never>
  }
}
