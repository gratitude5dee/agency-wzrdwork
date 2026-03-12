export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string;
          agent_id: string | null;
          company_id: string;
          created_at: string;
          details: string | null;
          id: string;
          issue_id: string | null;
        };
        Insert: {
          action: string;
          agent_id?: string | null;
          company_id: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          issue_id?: string | null;
        };
        Update: {
          action?: string;
          agent_id?: string | null;
          company_id?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          issue_id?: string | null;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          adapter_type: string;
          capabilities: string | null;
          company_id: string;
          created_at: string;
          id: string;
          name: string;
          reports_to: string | null;
          role: string;
          seat_index: number;
          status: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          adapter_type: string;
          capabilities?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          name: string;
          reports_to?: string | null;
          role: string;
          seat_index?: number;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          adapter_type?: string;
          capabilities?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          reports_to?: string | null;
          role?: string;
          seat_index?: number;
          status?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      approvals: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          issue_id: string | null;
          requested_by_agent_id: string | null;
          resolved_at: string | null;
          status: string;
          summary: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          issue_id?: string | null;
          requested_by_agent_id?: string | null;
          resolved_at?: string | null;
          status?: string;
          summary: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          issue_id?: string | null;
          requested_by_agent_id?: string | null;
          resolved_at?: string | null;
          status?: string;
          summary?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          brief: string;
          brand_color: string;
          company_type: string;
          created_at: string;
          description: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          brief?: string;
          brand_color?: string;
          company_type: string;
          created_at?: string;
          description?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          brief?: string;
          brand_color?: string;
          company_type?: string;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          owner_agent_id: string | null;
          status: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          owner_agent_id?: string | null;
          status?: string;
          summary?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          owner_agent_id?: string | null;
          status?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      issues: {
        Row: {
          assignee_agent_id: string | null;
          company_id: string;
          created_at: string;
          description: string | null;
          id: string;
          identifier: string | null;
          priority: string;
          project_id: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_agent_id?: string | null;
          company_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          identifier?: string | null;
          priority?: string;
          project_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_agent_id?: string | null;
          company_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          identifier?: string | null;
          priority?: string;
          project_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          name: string;
          priority: string;
          status: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          name: string;
          priority?: string;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          priority?: string;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          agent_id: string;
          company_id: string;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          issue_id: string | null;
          status: string;
          stderr_excerpt: string | null;
          stdout_excerpt: string | null;
          summary: string | null;
          total_cached_input_tokens: number | null;
          total_cost_usd: number | null;
          total_input_tokens: number | null;
          total_output_tokens: number | null;
        };
        Insert: {
          agent_id: string;
          company_id: string;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          issue_id?: string | null;
          status?: string;
          stderr_excerpt?: string | null;
          stdout_excerpt?: string | null;
          summary?: string | null;
          total_cached_input_tokens?: number | null;
          total_cost_usd?: number | null;
          total_input_tokens?: number | null;
          total_output_tokens?: number | null;
        };
        Update: {
          agent_id?: string;
          company_id?: string;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          issue_id?: string | null;
          status?: string;
          stderr_excerpt?: string | null;
          stdout_excerpt?: string | null;
          summary?: string | null;
          total_cached_input_tokens?: number | null;
          total_cost_usd?: number | null;
          total_input_tokens?: number | null;
          total_output_tokens?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
