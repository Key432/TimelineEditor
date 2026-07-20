export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          visibility: "private" | "public";
          public_id: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          visibility?: "private" | "public";
          public_id?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          visibility?: "private" | "public";
          public_id?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_settings: {
        Row: {
          project_id: string;
          default_uncertainty_years: number;
          initial_start_year: number;
          initial_end_year: number;
          initial_zoom_preset: "fit-range" | "century" | "decade" | "year";
          timeline_density: "comfortable" | "compact";
          minimum_time_unit: "year" | "month" | "day";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          default_uncertainty_years?: number;
          initial_start_year?: number;
          initial_end_year: number;
          initial_zoom_preset?: "fit-range" | "century" | "decade" | "year";
          timeline_density?: "comfortable" | "compact";
          minimum_time_unit?: "year" | "month" | "day";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          default_uncertainty_years?: number;
          initial_start_year?: number;
          initial_end_year?: number;
          initial_zoom_preset?: "fit-range" | "century" | "decade" | "year";
          timeline_density?: "comfortable" | "compact";
          minimum_time_unit?: "year" | "month" | "day";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timeline_item_types: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          normalized_name: string;
          default_color: string;
          icon: string | null;
          sort_order: number;
          is_visible: boolean;
          is_system_seed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          normalized_name?: string;
          default_color: string;
          icon?: string | null;
          sort_order: number;
          is_visible?: boolean;
          is_system_seed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          normalized_name?: string;
          default_color?: string;
          icon?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          is_system_seed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timeline_items: {
        Row: {
          id: string;
          project_id: string;
          type_id: string;
          title: string;
          summary: string | null;
          description: string | null;
          source_text: string | null;
          external_url: string | null;
          temporal_type: "range" | "point";
          color_override: string | null;
          manual_order: number;
          is_visible: boolean;
          start_year: number | null;
          start_month: number | null;
          start_day: number | null;
          is_start_approximate: boolean;
          start_uncertainty_years: number | null;
          end_date_status: "specified" | "ongoing" | "unknown" | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          is_end_approximate: boolean;
          end_uncertainty_years: number | null;
          last_confirmed_year: number | null;
          last_confirmed_month: number | null;
          last_confirmed_day: number | null;
          point_year: number | null;
          point_month: number | null;
          point_day: number | null;
          is_point_approximate: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type_id: string;
          title: string;
          summary?: string | null;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
          temporal_type: "range" | "point";
          color_override?: string | null;
          manual_order: number;
          is_visible?: boolean;
          start_year?: number | null;
          start_month?: number | null;
          start_day?: number | null;
          is_start_approximate?: boolean;
          start_uncertainty_years?: number | null;
          end_date_status?: "specified" | "ongoing" | "unknown" | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          is_end_approximate?: boolean;
          end_uncertainty_years?: number | null;
          last_confirmed_year?: number | null;
          last_confirmed_month?: number | null;
          last_confirmed_day?: number | null;
          point_year?: number | null;
          point_month?: number | null;
          point_day?: number | null;
          is_point_approximate?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type_id?: string;
          title?: string;
          summary?: string | null;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
          temporal_type?: "range" | "point";
          color_override?: string | null;
          manual_order?: number;
          is_visible?: boolean;
          start_year?: number | null;
          start_month?: number | null;
          start_day?: number | null;
          is_start_approximate?: boolean;
          start_uncertainty_years?: number | null;
          end_date_status?: "specified" | "ongoing" | "unknown" | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          is_end_approximate?: boolean;
          end_uncertainty_years?: number | null;
          last_confirmed_year?: number | null;
          last_confirmed_month?: number | null;
          last_confirmed_day?: number | null;
          point_year?: number | null;
          point_month?: number | null;
          point_day?: number | null;
          is_point_approximate?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_project_with_settings: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_template: string;
          p_default_uncertainty_years: number;
          p_initial_start_year: number;
          p_initial_end_year: number;
          p_initial_zoom_preset: string;
          p_timeline_density: string;
          p_minimum_time_unit: string;
        };
        Returns: string;
      };
      move_timeline_item_type: {
        Args: {
          p_project_id: string;
          p_type_id: string;
          p_new_position: number;
        };
        Returns: undefined;
      };
      move_timeline_item: {
        Args: {
          p_project_id: string;
          p_item_id: string;
          p_new_position: number;
          p_new_type_id?: string | null;
        };
        Returns: undefined;
      };
      update_project_with_settings: {
        Args: {
          p_project_id: string;
          p_name: string;
          p_description: string | null;
          p_default_uncertainty_years: number;
          p_initial_start_year: number;
          p_initial_end_year: number;
          p_initial_zoom_preset: string;
          p_timeline_density: string;
          p_minimum_time_unit: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
