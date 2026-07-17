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
    };
    Views: Record<string, never>;
    Functions: {
      create_project_with_settings: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_default_uncertainty_years: number;
          p_initial_start_year: number;
          p_initial_end_year: number;
          p_initial_zoom_preset: string;
          p_timeline_density: string;
          p_minimum_time_unit: string;
        };
        Returns: string;
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
