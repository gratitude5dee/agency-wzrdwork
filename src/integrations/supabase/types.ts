export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string
          agent_id: string | null
          company_id: string
          created_at: string
          details: string | null
          id: string
          issue_id: string | null
        }
        Insert: {
          action: string
          agent_id?: string | null
          company_id: string
          created_at?: string
          details?: string | null
          id?: string
          issue_id?: string | null
        }
        Update: {
          action?: string
          agent_id?: string | null
          company_id?: string
          created_at?: string
          details?: string | null
          id?: string
          issue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_config_revisions: {
        Row: {
          adapter_config: Json | null
          adapter_type: string | null
          agent_id: string
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          prompt_template: string | null
          revision_number: number
        }
        Insert: {
          adapter_config?: Json | null
          adapter_type?: string | null
          agent_id: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          prompt_template?: string | null
          revision_number?: number
        }
        Update: {
          adapter_config?: Json | null
          adapter_type?: string | null
          agent_id?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          prompt_template?: string | null
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_revisions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_config_revisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_execution_logs: {
        Row: {
          agent_id: string
          company_id: string
          content: Json
          created_at: string
          id: string
          log_type: string
          run_id: string | null
        }
        Insert: {
          agent_id: string
          company_id: string
          content?: Json
          created_at?: string
          id?: string
          log_type?: string
          run_id?: string | null
        }
        Update: {
          agent_id?: string
          company_id?: string
          content?: Json
          created_at?: string
          id?: string
          log_type?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_identities: {
        Row: {
          agent_id: string
          chain_tx_hash: string | null
          company_id: string
          created_at: string
          id: string
          manifest: Json
          operator_wallet: string | null
          registered_on_chain: boolean
          updated_at: string
        }
        Insert: {
          agent_id: string
          chain_tx_hash?: string | null
          company_id: string
          created_at?: string
          id?: string
          manifest?: Json
          operator_wallet?: string | null
          registered_on_chain?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string
          chain_tx_hash?: string | null
          company_id?: string
          created_at?: string
          id?: string
          manifest?: Json
          operator_wallet?: string | null
          registered_on_chain?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_identities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_identities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_integrations: {
        Row: {
          agent_id: string
          company_id: string
          config: Json | null
          created_at: string
          enabled: boolean | null
          id: string
          integration_key: string
        }
        Insert: {
          agent_id: string
          company_id: string
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          integration_key: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          integration_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_integrations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_invoices: {
        Row: {
          agent_id: string | null
          amount_usdc: number
          buyer_wallet: string | null
          chain_id: number
          company_id: string
          created_at: string
          description: string
          id: string
          line_items: Json
          paid: boolean
          paid_at: string | null
          seller_wallet: string
          tx_hash: string | null
        }
        Insert: {
          agent_id?: string | null
          amount_usdc?: number
          buyer_wallet?: string | null
          chain_id?: number
          company_id: string
          created_at?: string
          description?: string
          id?: string
          line_items?: Json
          paid?: boolean
          paid_at?: string | null
          seller_wallet: string
          tx_hash?: string | null
        }
        Update: {
          agent_id?: string | null
          amount_usdc?: number
          buyer_wallet?: string | null
          chain_id?: number
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          line_items?: Json
          paid?: boolean
          paid_at?: string | null
          seller_wallet?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runtime_state: {
        Row: {
          agent_id: string
          company_id: string
          id: string
          state_data: Json | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          company_id: string
          id?: string
          state_data?: Json | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          id?: string
          state_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runtime_state_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runtime_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          id: string
          skill_id: string
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          id?: string
          skill_id: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_task_sessions: {
        Row: {
          agent_id: string
          company_id: string
          ended_at: string | null
          id: string
          issue_id: string | null
          metadata: Json | null
          run_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          agent_id: string
          company_id: string
          ended_at?: string | null
          id?: string
          issue_id?: string | null
          metadata?: Json | null
          run_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          agent_id?: string
          company_id?: string
          ended_at?: string | null
          id?: string
          issue_id?: string | null
          metadata?: Json | null
          run_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_task_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_task_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_task_sessions_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_task_sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_wakeup_requests: {
        Row: {
          agent_id: string
          attempt_count: number
          claimed_at: string | null
          claimed_by: string | null
          company_id: string
          created_at: string
          heartbeat_run_id: string | null
          id: string
          last_error: string | null
          payload: Json
          reason: string
          resolved_at: string | null
          run_id: string | null
          status: string
          trigger_type: string
        }
        Insert: {
          agent_id: string
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          company_id: string
          created_at?: string
          heartbeat_run_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          reason?: string
          resolved_at?: string | null
          run_id?: string | null
          status?: string
          trigger_type?: string
        }
        Update: {
          agent_id?: string
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          company_id?: string
          created_at?: string
          heartbeat_run_id?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          reason?: string
          resolved_at?: string | null
          run_id?: string | null
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_wakeup_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_wakeup_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_wakeup_requests_heartbeat_run_id_fkey"
            columns: ["heartbeat_run_id"]
            isOneToOne: false
            referencedRelation: "heartbeat_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_wakeup_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          adapter_config: Json | null
          adapter_overrides: Json | null
          adapter_type: string
          budget_usd: number | null
          capabilities: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          private_cognition_enabled: boolean
          prompt_template: string | null
          reports_to: string | null
          role: string
          seat_index: number
          status: string
          title: string | null
          updated_at: string
          venice_model: string | null
          wallet_address: string | null
        }
        Insert: {
          adapter_config?: Json | null
          adapter_overrides?: Json | null
          adapter_type: string
          budget_usd?: number | null
          capabilities?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          private_cognition_enabled?: boolean
          prompt_template?: string | null
          reports_to?: string | null
          role: string
          seat_index?: number
          status?: string
          title?: string | null
          updated_at?: string
          venice_model?: string | null
          wallet_address?: string | null
        }
        Update: {
          adapter_config?: Json | null
          adapter_overrides?: Json | null
          adapter_type?: string
          budget_usd?: number | null
          capabilities?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          private_cognition_enabled?: boolean
          prompt_template?: string | null
          reports_to?: string | null
          role?: string
          seat_index?: number
          status?: string
          title?: string | null
          updated_at?: string
          venice_model?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          company_id: string
          created_at: string
          details: string | null
          id: string
          issue_id: string | null
          requested_by_agent_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          summary: string
        }
        Insert: {
          company_id: string
          created_at?: string
          details?: string | null
          id?: string
          issue_id?: string | null
          requested_by_agent_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          summary?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          details?: string | null
          id?: string
          issue_id?: string | null
          requested_by_agent_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_by_agent_id_fkey"
            columns: ["requested_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_challenges: {
        Row: {
          consumed_at: string | null
          expires_at: string
          id: string
          issued_at: string
          message: string
          nonce: string
          wallet_address: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at: string
          id?: string
          issued_at?: string
          message: string
          nonce: string
          wallet_address: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          message?: string
          nonce?: string
          wallet_address?: string
        }
        Relationships: []
      }
      auth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          session_token_sha256: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_token_sha256: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_token_sha256?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_incidents: {
        Row: {
          agent_id: string | null
          company_id: string
          created_at: string
          details: string | null
          id: string
          incident_type: string
          policy_id: string | null
          resolved: boolean | null
        }
        Insert: {
          agent_id?: string | null
          company_id: string
          created_at?: string
          details?: string | null
          id?: string
          incident_type: string
          policy_id?: string | null
          resolved?: boolean | null
        }
        Update: {
          agent_id?: string | null
          company_id?: string
          created_at?: string
          details?: string | null
          id?: string
          incident_type?: string
          policy_id?: string | null
          resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_incidents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_incidents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "budget_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_policies: {
        Row: {
          agent_id: string | null
          auto_pause_on_breach: boolean | null
          company_id: string
          created_at: string
          id: string
          max_runs_per_day: number | null
          max_spend_usd: number | null
          max_tokens_per_run: number | null
        }
        Insert: {
          agent_id?: string | null
          auto_pause_on_breach?: boolean | null
          company_id: string
          created_at?: string
          id?: string
          max_runs_per_day?: number | null
          max_spend_usd?: number | null
          max_tokens_per_run?: number | null
        }
        Update: {
          agent_id?: string | null
          auto_pause_on_breach?: boolean | null
          company_id?: string
          created_at?: string
          id?: string
          max_runs_per_day?: number | null
          max_spend_usd?: number | null
          max_tokens_per_run?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_policies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          content_blocks: Json | null
          created_at: string
          id: string
          model: string | null
          role: string
          session_id: string
          tokens_used: number | null
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content?: string | null
          content_blocks?: Json | null
          created_at?: string
          id?: string
          model?: string | null
          role: string
          session_id: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string | null
          content_blocks?: Json | null
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          session_id?: string
          tokens_used?: number | null
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          agent_id: string | null
          company_id: string
          created_at: string
          id: string
          model: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          model?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          model?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          brand_color: string
          brief: string
          company_type: string
          created_at: string
          description: string
          id: string
          name: string
          slug: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          brand_color?: string
          brief?: string
          company_type: string
          created_at?: string
          description?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          brand_color?: string
          brief?: string
          company_type?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          permissions: Json
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          permissions?: Json
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_plugins: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          installed_by_user_id: string | null
          plugin_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          installed_by_user_id?: string | null
          plugin_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          installed_by_user_id?: string | null
          plugin_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_plugins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_plugins_installed_by_user_id_fkey"
            columns: ["installed_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_plugins_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
      }
      company_secret_versions: {
        Row: {
          algorithm: string
          auth_tag: string
          ciphertext: string
          created_at: string
          id: string
          iv: string
          key_id: string | null
          secret_id: string
          value_sha256: string
          version: number
        }
        Insert: {
          algorithm?: string
          auth_tag: string
          ciphertext: string
          created_at?: string
          id?: string
          iv: string
          key_id?: string | null
          secret_id: string
          value_sha256: string
          version: number
        }
        Update: {
          algorithm?: string
          auth_tag?: string
          ciphertext?: string
          created_at?: string
          id?: string
          iv?: string
          key_id?: string | null
          secret_id?: string
          value_sha256?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_secret_versions_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "company_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      company_secrets: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          latest_version: number
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          id?: string
          latest_version?: number
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          latest_version?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_events: {
        Row: {
          agent_id: string | null
          amount_usd: number
          company_id: string
          created_at: string
          description: string
          event_type: string
          id: string
          model: string | null
          run_id: string | null
          token_count: number | null
        }
        Insert: {
          agent_id?: string | null
          amount_usd?: number
          company_id: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          model?: string | null
          run_id?: string | null
          token_count?: number | null
        }
        Update: {
          agent_id?: string | null
          amount_usd?: number
          company_id?: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          model?: string | null
          run_id?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          created_by_agent_id: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_events: {
        Row: {
          agent_id: string | null
          amount_usd: number | null
          chain: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          token: string | null
          tx_hash: string | null
        }
        Insert: {
          agent_id?: string | null
          amount_usd?: number | null
          chain?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          token?: string | null
          tx_hash?: string | null
        }
        Update: {
          agent_id?: string | null
          amount_usd?: number | null
          chain?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          token?: string | null
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          id: string
          owner_agent_id: string | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          owner_agent_id?: string | null
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          owner_agent_id?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_agent_id_fkey"
            columns: ["owner_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat_run_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          run_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          run_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "heartbeat_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat_runs: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          run_id: string | null
          started_at: string | null
          status: string
          summary: string | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          trigger_payload: Json
          trigger_type: string
          wakeup_request_id: string | null
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          run_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          trigger_payload?: Json
          trigger_type?: string
          wakeup_request_id?: string | null
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          run_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          trigger_payload?: Json
          trigger_type?: string
          wakeup_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeat_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeat_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeat_runs_wakeup_request_id_fkey"
            columns: ["wakeup_request_id"]
            isOneToOne: false
            referencedRelation: "agent_wakeup_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_settings: {
        Row: {
          created_at: string
          experimental: Json
          id: string
          singleton_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          experimental?: Json
          id?: string
          singleton_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          experimental?: Json
          id?: string
          singleton_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      instance_user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          company_id: string
          config: Json | null
          created_at: string
          enabled: boolean
          id: string
          integration_key: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          integration_key: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          integration_key?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_comments: {
        Row: {
          author_agent_id: string | null
          body: string
          company_id: string
          created_at: string
          id: string
          issue_id: string
          updated_at: string
        }
        Insert: {
          author_agent_id?: string | null
          body?: string
          company_id: string
          created_at?: string
          id?: string
          issue_id: string
          updated_at?: string
        }
        Update: {
          author_agent_id?: string | null
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          issue_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_comments_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_documents: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by_agent_id: string | null
          id: string
          issue_id: string
          mime_type: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          issue_id: string
          mime_type?: string
          title?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by_agent_id?: string | null
          id?: string
          issue_id?: string
          mime_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_documents_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_documents_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assignee_agent_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          identifier: string | null
          priority: string
          project_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_agent_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          identifier?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_agent_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          identifier?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_assignee_agent_id_fkey"
            columns: ["assignee_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string | null
          entrypoint: string | null
          id: string
          manifest: Json
          name: string
          package_name: string | null
          slug: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          entrypoint?: string | null
          id?: string
          manifest?: Json
          name: string
          package_name?: string | null
          slug: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          entrypoint?: string | null
          id?: string
          manifest?: Json
          name?: string
          package_name?: string | null
          slug?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "plugins_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workspaces: {
        Row: {
          cleanup_command: string | null
          company_id: string
          created_at: string
          cwd: string | null
          default_ref: string | null
          id: string
          is_primary: boolean
          metadata: Json | null
          name: string
          project_id: string
          remote_provider: string | null
          remote_workspace_ref: string | null
          repo_ref: string | null
          repo_url: string | null
          setup_command: string | null
          shared_workspace_key: string | null
          source_type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          cleanup_command?: string | null
          company_id: string
          created_at?: string
          cwd?: string | null
          default_ref?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json | null
          name: string
          project_id: string
          remote_provider?: string | null
          remote_workspace_ref?: string | null
          repo_ref?: string | null
          repo_url?: string | null
          setup_command?: string | null
          shared_workspace_key?: string | null
          source_type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          cleanup_command?: string | null
          company_id?: string
          created_at?: string
          cwd?: string | null
          default_ref?: string | null
          id?: string
          is_primary?: boolean
          metadata?: Json | null
          name?: string
          project_id?: string
          remote_provider?: string | null
          remote_workspace_ref?: string | null
          repo_ref?: string | null
          repo_url?: string | null
          setup_command?: string | null
          shared_workspace_key?: string | null
          source_type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workspaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workspaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          priority: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          priority?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          priority?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          agent_id: string
          company_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          issue_id: string | null
          status: string
          stderr_excerpt: string | null
          stdout_excerpt: string | null
          summary: string | null
          total_cached_input_tokens: number | null
          total_cost_usd: number | null
          total_input_tokens: number | null
          total_output_tokens: number | null
        }
        Insert: {
          agent_id: string
          company_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          issue_id?: string | null
          status?: string
          stderr_excerpt?: string | null
          stdout_excerpt?: string | null
          summary?: string | null
          total_cached_input_tokens?: number | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
        }
        Update: {
          agent_id?: string
          company_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          issue_id?: string | null
          status?: string
          stderr_excerpt?: string | null
          stdout_excerpt?: string | null
          summary?: string | null
          total_cached_input_tokens?: number | null
          total_cost_usd?: number | null
          total_input_tokens?: number | null
          total_output_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      service_accounts: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
          scopes: Json
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          scopes?: Json
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          scopes?: Json
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          level: string | null
          metadata: Json
          name: string
          prerequisite_integration: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          level?: string | null
          metadata?: Json
          name: string
          prerequisite_integration?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          level?: string | null
          metadata?: Json
          name?: string
          prerequisite_integration?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          company_id: string
          created_at: string
          current_step: number
          id: string
          metadata: Json | null
          onboarding_completed: boolean
          updated_at: string
          wallet_address: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          onboarding_completed?: boolean
          updated_at?: string
          wallet_address: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_step?: number
          id?: string
          metadata?: Json | null
          onboarding_completed?: boolean
          updated_at?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enqueue_agent_wakeup: {
        Args: {
          p_agent_id: string
          p_company_id: string
          p_payload?: Json
          p_reason?: string
          p_trigger_type?: string
        }
        Returns: {
          heartbeat_run_id: string
          wakeup_request_id: string
        }[]
      }
      rotate_company_secret: {
        Args: {
          p_algorithm: string
          p_auth_tag: string
          p_ciphertext: string
          p_company_id: string
          p_description: string
          p_iv: string
          p_key_id: string
          p_name: string
          p_value_sha256: string
        }
        Returns: {
          secret_id: string
          version: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
