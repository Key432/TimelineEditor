export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
      timeline_events: {
        Row: {
          id: string;
          project_id: string;
          timeline_item_id: string;
          title: string;
          event_year: number;
          event_month: number | null;
          event_day: number | null;
          is_approximate: boolean;
          description: string | null;
          source_text: string | null;
          external_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          timeline_item_id: string;
          title: string;
          event_year: number;
          event_month?: number | null;
          event_day?: number | null;
          is_approximate?: boolean;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          timeline_item_id?: string;
          title?: string;
          event_year?: number;
          event_month?: number | null;
          event_day?: number | null;
          is_approximate?: boolean;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
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
          is_point_approximate: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type_id: string;
          title: string;
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
          is_point_approximate?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type_id?: string;
          title?: string;
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
          is_point_approximate?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entity_relationships: {
        Row: {
          id: string;
          project_id: string;
          source_type: "timeline_item" | "timeline_event";
          source_id: string;
          target_type: "timeline_item" | "timeline_event";
          target_id: string;
          relation_type: "influence" | "reference" | "collaboration" | "other";
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_type: "timeline_item" | "timeline_event";
          source_id: string;
          target_type: "timeline_item" | "timeline_event";
          target_id: string;
          relation_type: "influence" | "reference" | "collaboration" | "other";
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          source_type?: "timeline_item" | "timeline_event";
          source_id?: string;
          target_type?: "timeline_item" | "timeline_event";
          target_id?: string;
          relation_type?: "influence" | "reference" | "collaboration" | "other";
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      search_documents: {
        Row: {
          entity_type: "project" | "timeline_item" | "timeline_event";
          entity_id: string;
          project_id: string;
          owner_id: string;
          is_public: boolean;
          title: string;
          project_name: string;
          content: string;
          detail_path: string;
          start_year: number | null;
          start_month: number | null;
          start_day: number | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          end_date_status: "specified" | "ongoing" | "unknown" | null;
          is_start_approximate: boolean;
          is_end_approximate: boolean;
          updated_at: string;
        };
        Insert: {
          entity_type: "project" | "timeline_item" | "timeline_event";
          entity_id: string;
          project_id: string;
          owner_id: string;
          is_public?: boolean;
          title: string;
          project_name: string;
          content: string;
          detail_path: string;
          start_year?: number | null;
          start_month?: number | null;
          start_day?: number | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          end_date_status?: "specified" | "ongoing" | "unknown" | null;
          is_start_approximate?: boolean;
          is_end_approximate?: boolean;
          updated_at: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["search_documents"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      import_project_data: {
        Args: {
          p_target_project_id: string | null;
          p_mode: string;
          p_payload: Json;
        };
        Returns: string;
      };
      create_timeline_item_with_events: {
        Args: {
          p_project_id: string;
          p_item: Json;
          p_events?: Json;
        };
        Returns: {
          item_id: string;
          created_event_ids: string[];
          failed_events: Json;
        }[];
      };
      publish_project: {
        Args: { p_project_id: string };
        Returns: string;
      };
      unpublish_project: {
        Args: { p_project_id: string };
        Returns: undefined;
      };
      regenerate_project_public_id: {
        Args: { p_project_id: string };
        Returns: string;
      };
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
      search_global_documents: {
        Args: {
          p_query: string;
          p_entity_type?: string | null;
          p_page?: number;
          p_page_size?: number;
        };
        Returns: {
          entity_type: string;
          entity_id: string;
          project_id: string;
          title: string;
          project_name: string;
          content: string;
          detail_path: string;
          start_year: number | null;
          start_month: number | null;
          start_day: number | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          end_date_status: "specified" | "ongoing" | "unknown" | null;
          is_start_approximate: boolean;
          is_end_approximate: boolean;
          total_count: number;
        }[];
      };
      match_project_search_documents: {
        Args: { p_project_id: string; p_query: string };
        Returns: { entity_type: string; entity_id: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
