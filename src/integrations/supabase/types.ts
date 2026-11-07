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
      batch_losses: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          lost_on: string
          quantity: number
          reason: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          lost_on?: string
          quantity: number
          reason?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          lost_on?: string
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_losses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          crop: string
          expected_harvest: string | null
          germinated: number | null
          harvested_on: string | null
          id: string
          notes: string | null
          plant_count: number | null
          profile_id: string | null
          seeded_on: string
          seeds_sown: number | null
          sentinel_pot_ids: string[]
          status: string
          transplanted_on: string | null
          variety: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          crop?: string
          expected_harvest?: string | null
          germinated?: number | null
          harvested_on?: string | null
          id?: string
          notes?: string | null
          plant_count?: number | null
          profile_id?: string | null
          seeded_on?: string
          seeds_sown?: number | null
          sentinel_pot_ids?: string[]
          status?: string
          transplanted_on?: string | null
          variety?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          crop?: string
          expected_harvest?: string | null
          germinated?: number | null
          harvested_on?: string | null
          id?: string
          notes?: string | null
          plant_count?: number | null
          profile_id?: string | null
          seeded_on?: string
          seeds_sown?: number | null
          sentinel_pot_ids?: string[]
          status?: string
          transplanted_on?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "crop_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_profiles: {
        Row: {
          air_temp_max: number | null
          air_temp_min: number | null
          created_at: string
          created_by: string | null
          crop: string
          defect_tags: string[]
          ec_max: number | null
          ec_min: number | null
          grade_a_min_brix: number | null
          grade_a_min_g: number | null
          grade_a_min_leaves: number | null
          grade_b_min_brix: number | null
          grade_b_min_g: number | null
          grade_b_min_leaves: number | null
          grade_metric: string
          humidity_max: number | null
          humidity_min: number | null
          id: string
          name: string
          notes: string | null
          ph_max: number | null
          ph_min: number | null
          season: string | null
          stage_targets: Json
          water_temp_max: number | null
          water_temp_min: number | null
        }
        Insert: {
          air_temp_max?: number | null
          air_temp_min?: number | null
          created_at?: string
          created_by?: string | null
          crop?: string
          defect_tags?: string[]
          ec_max?: number | null
          ec_min?: number | null
          grade_a_min_brix?: number | null
          grade_a_min_g?: number | null
          grade_a_min_leaves?: number | null
          grade_b_min_brix?: number | null
          grade_b_min_g?: number | null
          grade_b_min_leaves?: number | null
          grade_metric?: string
          humidity_max?: number | null
          humidity_min?: number | null
          id?: string
          name: string
          notes?: string | null
          ph_max?: number | null
          ph_min?: number | null
          season?: string | null
          stage_targets?: Json
          water_temp_max?: number | null
          water_temp_min?: number | null
        }
        Update: {
          air_temp_max?: number | null
          air_temp_min?: number | null
          created_at?: string
          created_by?: string | null
          crop?: string
          defect_tags?: string[]
          ec_max?: number | null
          ec_min?: number | null
          grade_a_min_brix?: number | null
          grade_a_min_g?: number | null
          grade_a_min_leaves?: number | null
          grade_b_min_brix?: number | null
          grade_b_min_g?: number | null
          grade_b_min_leaves?: number | null
          grade_metric?: string
          humidity_max?: number | null
          humidity_min?: number | null
          id?: string
          name?: string
          notes?: string | null
          ph_max?: number | null
          ph_min?: number | null
          season?: string | null
          stage_targets?: Json
          water_temp_max?: number | null
          water_temp_min?: number | null
        }
        Relationships: []
      }
      daily_checks: {
        Row: {
          air_temp: number | null
          automation_ok: boolean
          batch_id: string | null
          check_date: string
          check_time: string
          created_at: string
          ec: number | null
          flow_ok: boolean
          germinated_count: number | null
          germination_issues: string[]
          germination_notes: string | null
          gh_defects: boolean
          gh_defects_notes: string | null
          growth_stage: string | null
          humidity: number | null
          id: string
          insects: boolean
          insects_notes: string | null
          leaks: boolean
          leaks_notes: string | null
          notes: string | null
          nursery_batch_id: string | null
          ph: number | null
          ppe_worn: boolean
          tank_debris: boolean
          tank_level: string | null
          tank_liters_actual: number | null
          user_id: string
          water_source: string
          water_temp: number | null
        }
        Insert: {
          air_temp?: number | null
          automation_ok?: boolean
          batch_id?: string | null
          check_date?: string
          check_time?: string
          created_at?: string
          ec?: number | null
          flow_ok?: boolean
          germinated_count?: number | null
          germination_issues?: string[]
          germination_notes?: string | null
          gh_defects?: boolean
          gh_defects_notes?: string | null
          growth_stage?: string | null
          humidity?: number | null
          id?: string
          insects?: boolean
          insects_notes?: string | null
          leaks?: boolean
          leaks_notes?: string | null
          notes?: string | null
          nursery_batch_id?: string | null
          ph?: number | null
          ppe_worn?: boolean
          tank_debris?: boolean
          tank_level?: string | null
          tank_liters_actual?: number | null
          user_id?: string
          water_source?: string
          water_temp?: number | null
        }
        Update: {
          air_temp?: number | null
          automation_ok?: boolean
          batch_id?: string | null
          check_date?: string
          check_time?: string
          created_at?: string
          ec?: number | null
          flow_ok?: boolean
          germinated_count?: number | null
          germination_issues?: string[]
          germination_notes?: string | null
          gh_defects?: boolean
          gh_defects_notes?: string | null
          growth_stage?: string | null
          humidity?: number | null
          id?: string
          insects?: boolean
          insects_notes?: string | null
          leaks?: boolean
          leaks_notes?: string | null
          notes?: string | null
          nursery_batch_id?: string | null
          ph?: number | null
          ppe_worn?: boolean
          tank_debris?: boolean
          tank_level?: string | null
          tank_liters_actual?: number | null
          user_id?: string
          water_source?: string
          water_temp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_checks_nursery_batch_id_fkey"
            columns: ["nursery_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_settings: {
        Row: {
          albert_ec_per_g_l: number
          grow_days: number
          id: number
          kg_per_crate: number
          nursery_days: number
          ph_down_ml: number
          ph_up_ml: number
          tank_liters: number
          total_slots: number
          updated_at: string
          vpd_max: number
          vpd_min: number
        }
        Insert: {
          albert_ec_per_g_l?: number
          grow_days?: number
          id?: number
          kg_per_crate?: number
          nursery_days?: number
          ph_down_ml?: number
          ph_up_ml?: number
          tank_liters?: number
          total_slots?: number
          updated_at?: string
          vpd_max?: number
          vpd_min?: number
        }
        Update: {
          albert_ec_per_g_l?: number
          grow_days?: number
          id?: number
          kg_per_crate?: number
          nursery_days?: number
          ph_down_ml?: number
          ph_up_ml?: number
          tank_liters?: number
          total_slots?: number
          updated_at?: string
          vpd_max?: number
          vpd_min?: number
        }
        Relationships: []
      }
      growth_measurements: {
        Row: {
          batch_id: string
          check_id: string | null
          created_at: string
          height_cm: number | null
          id: string
          leaf_count: number | null
          measured_on: string
          plant_no: number
          pot_id: string | null
          variety: string | null
          zone: string | null
        }
        Insert: {
          batch_id: string
          check_id?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          leaf_count?: number | null
          measured_on?: string
          plant_no: number
          pot_id?: string | null
          variety?: string | null
          zone?: string | null
        }
        Update: {
          batch_id?: string
          check_id?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          leaf_count?: number | null
          measured_on?: string
          plant_no?: number
          pot_id?: string | null
          variety?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_measurements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_measurements_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "daily_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      harvests: {
        Row: {
          avg_brix: number | null
          avg_leaf_count: number | null
          batch_id: string
          created_at: string
          created_by: string | null
          grade_a: number
          grade_b: number
          grade_c: number
          harvested_on: string
          id: string
          notes: string | null
          plants_harvested: number
          profile_id: string | null
          rejected: number
          total_weight_kg: number
        }
        Insert: {
          avg_brix?: number | null
          avg_leaf_count?: number | null
          batch_id: string
          created_at?: string
          created_by?: string | null
          grade_a?: number
          grade_b?: number
          grade_c?: number
          harvested_on?: string
          id?: string
          notes?: string | null
          plants_harvested?: number
          profile_id?: string | null
          rejected?: number
          total_weight_kg?: number
        }
        Update: {
          avg_brix?: number | null
          avg_leaf_count?: number | null
          batch_id?: string
          created_at?: string
          created_by?: string | null
          grade_a?: number
          grade_b?: number
          grade_c?: number
          harvested_on?: string
          id?: string
          notes?: string | null
          plants_harvested?: number
          profile_id?: string | null
          rejected?: number
          total_weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "harvests_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "crop_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          quantity: number
          reorder_level: number
          unit: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          quantity?: number
          reorder_level?: number
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          reorder_level?: number
          unit?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          change: number
          created_at: string
          id: string
          item_id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          change: number
          created_at?: string
          id?: string
          item_id: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          change?: number
          created_at?: string
          id?: string
          item_id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          done_at: string
          id: string
          kind: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          done_at?: string
          id?: string
          kind: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          done_at?: string
          id?: string
          kind?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quality_inspections: {
        Row: {
          batch_id: string | null
          check_id: string | null
          created_at: string
          defect_counts: Json
          disease: number
          healthy: number
          id: string
          insect_damage: number
          inspected_count: number
          inspected_on: string
          macro_deficiency: number
          micro_deficiency: number
          notes: string | null
          other: number
          tipburn: number
        }
        Insert: {
          batch_id?: string | null
          check_id?: string | null
          created_at?: string
          defect_counts?: Json
          disease?: number
          healthy?: number
          id?: string
          insect_damage?: number
          inspected_count?: number
          inspected_on?: string
          macro_deficiency?: number
          micro_deficiency?: number
          notes?: string | null
          other?: number
          tipburn?: number
        }
        Update: {
          batch_id?: string | null
          check_id?: string | null
          created_at?: string
          defect_counts?: Json
          disease?: number
          healthy?: number
          id?: string
          insect_damage?: number
          inspected_count?: number
          inspected_on?: string
          macro_deficiency?: number
          micro_deficiency?: number
          notes?: string | null
          other?: number
          tipburn?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_inspections_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "daily_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          batch_id: string | null
          category: string
          counterparty: string | null
          created_at: string
          description: string | null
          handled_by: string | null
          id: string
          inventory_item_id: string | null
          kind: string
          tx_date: string
          user_id: string | null
        }
        Insert: {
          amount: number
          batch_id?: string | null
          category: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: string
          inventory_item_id?: string | null
          kind: string
          tx_date?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string | null
          category?: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: string
          inventory_item_id?: string | null
          kind?: string
          tx_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_purchase: {
        Args: {
          _cost: number
          _date: string
          _item_id: string
          _notes: string
          _qty: number
          _vendor: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "worker"
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
    Enums: {
      app_role: ["admin", "worker"],
    },
  },
} as const
