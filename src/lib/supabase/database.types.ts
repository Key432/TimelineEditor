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
      timeline_saved_views: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          configuration: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          configuration: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          configuration?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cloud_drafts: {
        Row: {
          id: string;
          project_id: string;
          owner_id: string;
          entity_type: "timeline_item" | "timeline_event";
          draft_scope: string;
          payload: Json;
          base_version: string | null;
          fingerprint: string;
          writer_id: string;
          draft_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          owner_id?: string;
          entity_type: "timeline_item" | "timeline_event";
          draft_scope: string;
          payload: Json;
          base_version?: string | null;
          fingerprint: string;
          writer_id: string;
          draft_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cloud_drafts"]["Insert"]>;
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
      entity_history: {
        Row: {
          id: string;
          project_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          revision: number;
          operation_group_id: string;
          changes: Json;
          operation: "update" | "restore" | "checkpoint";
          is_checkpoint: boolean;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          revision: number;
          operation_group_id?: string;
          changes?: Json;
          operation?: "update" | "restore" | "checkpoint";
          is_checkpoint?: boolean;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          entity_type?: "timeline_item" | "timeline_event";
          entity_id?: string;
          revision?: number;
          operation_group_id?: string;
          changes?: Json;
          operation?: "update" | "restore" | "checkpoint";
          is_checkpoint?: boolean;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      internal_links: {
        Row: {
          project_id: string;
          source_entity_type: "timeline_item" | "timeline_event";
          source_entity_id: string;
          target_entity_type: "timeline_item" | "timeline_event";
          target_entity_id: string;
        };
        Insert: {
          project_id: string;
          source_entity_type: "timeline_item" | "timeline_event";
          source_entity_id: string;
          target_entity_type: "timeline_item" | "timeline_event";
          target_entity_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["internal_links"]["Insert"]
        >;
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          authors: string[];
          publisher: string | null;
          publication_year: number | null;
          isbn: string | null;
          url: string | null;
          accessed_on: string | null;
          citation_key: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          authors?: string[];
          publisher?: string | null;
          publication_year?: number | null;
          isbn?: string | null;
          url?: string | null;
          accessed_on?: string | null;
          citation_key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      source_citations: {
        Row: {
          id: string;
          project_id: string;
          source_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          pages: string | null;
          chapter: string | null;
          quote: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          pages?: string | null;
          chapter?: string | null;
          quote?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["source_citations"]["Insert"]
        >;
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          normalized_name: string;
          color: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          color?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      event_types: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          normalized_name: string;
          color: string;
          marker_shape:
            "circle" | "square" | "diamond" | "triangle" | "star" | "hexagon";
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          color?: string;
          marker_shape?:
            "circle" | "square" | "diamond" | "triangle" | "star" | "hexagon";
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_types"]["Insert"]>;
        Relationships: [];
      };
      timeline_item_tags: {
        Row: {
          project_id: string;
          timeline_item_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          timeline_item_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["timeline_item_tags"]["Insert"]
        >;
        Relationships: [];
      };
      timeline_event_tags: {
        Row: {
          project_id: string;
          timeline_event_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          timeline_event_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["timeline_event_tags"]["Insert"]
        >;
        Relationships: [];
      };
      custom_field_definitions: {
        Row: {
          id: string;
          project_id: string;
          entity_type: "timeline_item" | "timeline_event";
          scope: "project" | "type";
          target_type_id: string | null;
          name: string;
          normalized_name: string;
          field_type:
            | "text"
            | "multiline"
            | "number"
            | "boolean"
            | "single_select"
            | "multi_select"
            | "url"
            | "historical_date"
            | "entity_reference";
          is_required: boolean;
          options: string[];
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          entity_type: "timeline_item" | "timeline_event";
          scope?: "project" | "type";
          target_type_id?: string | null;
          name: string;
          field_type:
            | "text"
            | "multiline"
            | "number"
            | "boolean"
            | "single_select"
            | "multi_select"
            | "url"
            | "historical_date"
            | "entity_reference";
          is_required?: boolean;
          options?: string[];
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["custom_field_definitions"]["Insert"]
        >;
        Relationships: [];
      };
      custom_field_values: {
        Row: {
          project_id: string;
          field_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          text_value: string | null;
          number_value: number | null;
          boolean_value: boolean | null;
          multi_value: string[] | null;
          date_era: "ce" | "bce" | null;
          date_precision:
            "day" | "month" | "year" | "decade" | "century" | null;
          date_year: number | null;
          date_month: number | null;
          date_day: number | null;
          date_original_text: string | null;
          date_calendar: string | null;
          reference_entity_type: "timeline_item" | "timeline_event" | null;
          reference_entity_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          field_id: string;
          entity_type: "timeline_item" | "timeline_event";
          entity_id: string;
          text_value?: string | null;
          number_value?: number | null;
          boolean_value?: boolean | null;
          multi_value?: string[] | null;
          date_era?: "ce" | "bce" | null;
          date_precision?:
            "day" | "month" | "year" | "decade" | "century" | null;
          date_year?: number | null;
          date_month?: number | null;
          date_day?: number | null;
          date_original_text?: string | null;
          date_calendar?: string | null;
          reference_entity_type?: "timeline_item" | "timeline_event" | null;
          reference_entity_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["custom_field_values"]["Insert"]
        >;
        Relationships: [];
      };
      timeline_events: {
        Row: {
          id: string;
          project_id: string;
          timeline_item_id: string;
          event_type_id: string | null;
          title: string;
          aliases: string[];
          event_year: number;
          event_month: number | null;
          event_day: number | null;
          event_era: "ce" | "bce";
          event_precision: "day" | "month" | "year" | "decade" | "century";
          event_original_text: string | null;
          event_calendar: string;
          event_normalized_min: number;
          event_normalized_max: number;
          is_approximate: boolean;
          description: string | null;
          source_text: string | null;
          external_url: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          trash_group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          timeline_item_id: string;
          event_type_id?: string | null;
          title: string;
          aliases?: string[];
          event_year: number;
          event_month?: number | null;
          event_day?: number | null;
          event_era?: "ce" | "bce";
          event_precision?: "day" | "month" | "year" | "decade" | "century";
          event_original_text?: string | null;
          event_calendar?: string;
          is_approximate?: boolean;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          trash_group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          timeline_item_id?: string;
          event_type_id?: string | null;
          title?: string;
          aliases?: string[];
          event_year?: number;
          event_month?: number | null;
          event_day?: number | null;
          event_era?: "ce" | "bce";
          event_precision?: "day" | "month" | "year" | "decade" | "century";
          event_original_text?: string | null;
          event_calendar?: string;
          is_approximate?: boolean;
          description?: string | null;
          source_text?: string | null;
          external_url?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          trash_group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timeline_event_item_links: {
        Row: {
          project_id: string;
          timeline_event_id: string;
          timeline_item_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          project_id: string;
          timeline_event_id: string;
          timeline_item_id: string;
          sort_order: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["timeline_event_item_links"]["Insert"]
        >;
        Relationships: [];
      };
      timeline_items: {
        Row: {
          id: string;
          project_id: string;
          type_id: string;
          title: string;
          aliases: string[];
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
          start_era: "ce" | "bce";
          start_precision: "day" | "month" | "year" | "decade" | "century";
          start_original_text: string | null;
          start_calendar: string;
          start_normalized_min: number | null;
          start_normalized_max: number | null;
          is_start_approximate: boolean;
          start_uncertainty_years: number | null;
          end_date_status: "specified" | "ongoing" | "unknown" | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          end_era: "ce" | "bce";
          end_precision: "day" | "month" | "year" | "decade" | "century";
          end_original_text: string | null;
          end_calendar: string;
          end_normalized_min: number | null;
          end_normalized_max: number | null;
          is_end_approximate: boolean;
          end_uncertainty_years: number | null;
          is_point_approximate: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          trash_group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type_id: string;
          title: string;
          aliases?: string[];
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
          start_era?: "ce" | "bce";
          start_precision?: "day" | "month" | "year" | "decade" | "century";
          start_original_text?: string | null;
          start_calendar?: string;
          is_start_approximate?: boolean;
          start_uncertainty_years?: number | null;
          end_date_status?: "specified" | "ongoing" | "unknown" | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          end_era?: "ce" | "bce";
          end_precision?: "day" | "month" | "year" | "decade" | "century";
          end_original_text?: string | null;
          end_calendar?: string;
          is_end_approximate?: boolean;
          end_uncertainty_years?: number | null;
          is_point_approximate?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          trash_group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type_id?: string;
          title?: string;
          aliases?: string[];
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
          start_era?: "ce" | "bce";
          start_precision?: "day" | "month" | "year" | "decade" | "century";
          start_original_text?: string | null;
          start_calendar?: string;
          is_start_approximate?: boolean;
          start_uncertainty_years?: number | null;
          end_date_status?: "specified" | "ongoing" | "unknown" | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          end_era?: "ce" | "bce";
          end_precision?: "day" | "month" | "year" | "decade" | "century";
          end_original_text?: string | null;
          end_calendar?: string;
          is_end_approximate?: boolean;
          end_uncertainty_years?: number | null;
          is_point_approximate?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          trash_group_id?: string | null;
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
          start_era: "ce" | "bce" | null;
          start_precision:
            "day" | "month" | "year" | "decade" | "century" | null;
          start_original_text: string | null;
          start_calendar: string | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          end_era: "ce" | "bce" | null;
          end_precision: "day" | "month" | "year" | "decade" | "century" | null;
          end_original_text: string | null;
          end_calendar: string | null;
          normalized_min: number | null;
          normalized_max: number | null;
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
          start_era?: "ce" | "bce" | null;
          start_precision?:
            "day" | "month" | "year" | "decade" | "century" | null;
          start_original_text?: string | null;
          start_calendar?: string | null;
          end_year?: number | null;
          end_month?: number | null;
          end_day?: number | null;
          end_era?: "ce" | "bce" | null;
          end_precision?:
            "day" | "month" | "year" | "decade" | "century" | null;
          end_original_text?: string | null;
          end_calendar?: string | null;
          normalized_min?: number | null;
          normalized_max?: number | null;
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
      replace_timeline_event_parents: {
        Args: {
          p_project_id: string;
          p_event_id: string;
          p_timeline_item_ids: string[];
        };
        Returns: undefined;
      };
      merge_tags: {
        Args: {
          p_project_id: string;
          p_source_tag_id: string;
          p_target_tag_id: string;
        };
        Returns: undefined;
      };
      replace_source_citations: {
        Args: {
          p_project_id: string;
          p_entity_type: "timeline_item" | "timeline_event";
          p_entity_id: string;
          p_citations?: Json;
        };
        Returns: undefined;
      };
      get_internal_link_candidates: {
        Args: { p_project_id: string; p_query?: string };
        Returns: {
          entity_type: "item" | "event";
          entity_id: string;
          title: string;
          aliases: string[];
          kind_label: string;
          date_label: string | null;
          parent_title: string | null;
        }[];
      };
      resolve_internal_links: {
        Args: {
          p_project_id: string;
          p_item_ids?: string[];
          p_event_ids?: string[];
        };
        Returns: {
          entity_type: "item" | "event";
          entity_id: string;
          title: string;
        }[];
      };
      create_entity_checkpoint: {
        Args: {
          p_project_id: string;
          p_entity_type: "timeline_item" | "timeline_event";
          p_entity_id: string;
        };
        Returns: Database["public"]["Tables"]["entity_history"]["Row"];
      };
      purge_trashed_entity: {
        Args: {
          p_project_id: string;
          p_entity_type: "timeline_item" | "timeline_event";
          p_entity_id: string;
        };
        Returns: boolean;
      };
      restore_entity_history: {
        Args: {
          p_project_id: string;
          p_history_id: string;
        };
        Returns: boolean;
      };
      restore_trashed_entity: {
        Args: {
          p_project_id: string;
          p_entity_type: "timeline_item" | "timeline_event";
          p_entity_id: string;
        };
        Returns: boolean;
      };
      run_timeline_retention_cleanup: {
        Args: never;
        Returns: undefined;
      };
      run_cloud_draft_cleanup: {
        Args: never;
        Returns: undefined;
      };
      trash_timeline_event: {
        Args: {
          p_project_id: string;
          p_event_id: string;
        };
        Returns: boolean;
      };
      trash_timeline_item: {
        Args: {
          p_project_id: string;
          p_item_id: string;
        };
        Returns: boolean;
      };
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
          start_era: "ce" | "bce" | null;
          start_precision:
            "day" | "month" | "year" | "decade" | "century" | null;
          start_original_text: string | null;
          start_calendar: string | null;
          end_year: number | null;
          end_month: number | null;
          end_day: number | null;
          end_era: "ce" | "bce" | null;
          end_precision: "day" | "month" | "year" | "decade" | "century" | null;
          end_original_text: string | null;
          end_calendar: string | null;
          end_date_status: "specified" | "ongoing" | "unknown" | null;
          is_start_approximate: boolean;
          is_end_approximate: boolean;
          normalized_min: number | null;
          normalized_max: number | null;
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
