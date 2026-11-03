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
      case: {
        Row: {
          created_at: string
          description: string | null
          id: string
          owner_user_id: string | null
          tenente_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          tenente_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          tenente_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tenente_id_fkey"
            columns: ["tenente_id"]
            isOneToOne: false
            referencedRelation: "tenentes"
            referencedColumns: ["id"]
          },
        ]
      }
      case_access: {
        Row: {
          case_id: string
          created_at: string
          granted_by: string
          role: "editor" | "viewer"
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          granted_by: string
          role: "editor" | "viewer"
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          granted_by?: string
          role?: "editor" | "viewer"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_access_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
        ]
      }
      case_participants: {
        Row: {
          case_id: string
          created_at: string
          id: string
          notes: string | null
          role: "client" | "plaintiff" | "defendant" | "lawyer" | "responsible" | "partner" | "witness" | "expert" | "other"
          tenente_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role: "client" | "plaintiff" | "defendant" | "lawyer" | "responsible" | "partner" | "witness" | "expert" | "other"
          tenente_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: "client" | "plaintiff" | "defendant" | "lawyer" | "responsible" | "partner" | "witness" | "expert" | "other"
          tenente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_participants_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_participants_tenente_id_fkey"
            columns: ["tenente_id"]
            isOneToOne: false
            referencedRelation: "tenentes"
            referencedColumns: ["id"]
          },
        ]
      }
      CASE: {
        Row: {
          created_at: string
          id: number
          Name: string | null
        }
        Insert: {
          created_at: string
          id?: number
          Name?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          Name?: string | null
        }
        Relationships: []
      }
      document: {
        Row: {
          case_id: string
          created_at: string
          file_name: string
          file_path: string | null
          id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          file_name: string
          file_path?: string | null
          id?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding: {
        Row: {
          content: string
          created_at: string
          document_id: string
          id: string
          vector: string | null
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          id?: string
          vector?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string | null
          id?: string
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
        ]
      }
      tenentes: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
