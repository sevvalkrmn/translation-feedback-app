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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      feedbacks: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          model_name: string
          raw_output: Json | null
          structured_output: Json
          task_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          model_name: string
          raw_output?: Json | null
          structured_output: Json
          task_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          model_name?: string
          raw_output?: Json | null
          structured_output?: Json
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "translation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      model_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          lease_expires_at: string | null
          locked_by: string | null
          max_attempts: number
          started_at: string | null
          status: string
          task_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          started_at?: string | null
          status?: string
          task_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          started_at?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_jobs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "translation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          access_token_hash: string
          completed_at: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          status: string
        }
        Insert: {
          access_token_hash: string
          completed_at?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          status?: string
        }
        Update: {
          access_token_hash?: string
          completed_at?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          status?: string
        }
        Relationships: []
      }
      translation_tasks: {
        Row: {
          created_at: string
          id: string
          initial_translation: string
          method: string
          revised_at: string | null
          revised_translation: string | null
          session_id: string
          source_text: string
          status: string
          submitted_at: string | null
          task_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          initial_translation: string
          method: string
          revised_at?: string | null
          revised_translation?: string | null
          session_id: string
          source_text: string
          status?: string
          submitted_at?: string | null
          task_number: number
        }
        Update: {
          created_at?: string
          id?: string
          initial_translation?: string
          method?: string
          revised_at?: string | null
          revised_translation?: string | null
          session_id?: string
          source_text?: string
          status?: string
          submitted_at?: string | null
          task_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "translation_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_model_job: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          lease_expires_at: string | null
          locked_by: string | null
          max_attempts: number
          started_at: string | null
          status: string
          task_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "model_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_model_job: {
        Args: {
          p_job_id: string
          p_model_name: string
          p_raw_output?: Json
          p_structured_output: Json
          p_worker_id: string
        }
        Returns: undefined
      }
      fail_model_job: {
        Args: { p_error: string; p_job_id: string; p_worker_id: string }
        Returns: undefined
      }
      submit_translation_task: {
        Args: {
          p_initial_translation: string
          p_session_id: string
          p_source_text: string
          p_task_number: number
        }
        Returns: {
          created_at: string
          id: string
          initial_translation: string
          method: string
          revised_at: string | null
          revised_translation: string | null
          session_id: string
          source_text: string
          status: string
          submitted_at: string | null
          task_number: number
        }
        SetofOptions: {
          from: "*"
          to: "translation_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
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
