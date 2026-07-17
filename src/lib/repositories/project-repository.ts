import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Project,
  ProjectSettings,
  ProjectSummary,
} from "@/features/projects/types";
import type {
  createProjectSchema,
  updateProjectSchema,
} from "@/features/projects/validation";
import type { Database } from "@/lib/supabase/database.types";
import type { z } from "zod";

type Client = SupabaseClient<Database>;
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type SettingsRow = Database["public"]["Tables"]["project_settings"]["Row"];
type CreateProject = z.output<typeof createProjectSchema>;
type UpdateProject = z.output<typeof updateProjectSchema>;

function mapSettings(row: SettingsRow): ProjectSettings {
  return {
    defaultUncertaintyYears: row.default_uncertainty_years,
    initialStartYear: row.initial_start_year,
    initialEndYear: row.initial_end_year,
    initialZoomPreset: row.initial_zoom_preset,
    timelineDensity: row.timeline_density,
    minimumTimeUnit: row.minimum_time_unit,
  };
}

function mapSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    updatedAt: row.updated_at,
  };
}

function mapProject(row: ProjectRow, settings: SettingsRow): Project {
  return {
    ...mapSummary(row),
    createdAt: row.created_at,
    settings: mapSettings(settings),
  };
}

function rpcArgs(input: CreateProject | UpdateProject) {
  return {
    p_name: input.name,
    p_description: input.description,
    p_default_uncertainty_years: input.settings.defaultUncertaintyYears,
    p_initial_start_year: input.settings.initialStartYear,
    p_initial_end_year: input.settings.initialEndYear,
    p_initial_zoom_preset: input.settings.initialZoomPreset,
    p_timeline_density: input.settings.timelineDensity,
    p_minimum_time_unit: input.settings.minimumTimeUnit,
  };
}

export class ProjectRepository {
  constructor(private readonly client: Client) {}

  async list(): Promise<ProjectSummary[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data.map(mapSummary);
  }

  async findById(projectId: string): Promise<Project | null> {
    const [projectResult, settingsResult] = await Promise.all([
      this.client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle(),
      this.client
        .from("project_settings")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

    if (projectResult.error) throw projectResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (!projectResult.data || !settingsResult.data) return null;

    return mapProject(projectResult.data, settingsResult.data);
  }

  async create(input: CreateProject): Promise<Project> {
    const { data: projectId, error } = await this.client.rpc(
      "create_project_with_settings",
      rpcArgs(input),
    );
    if (error) throw error;

    const project = await this.findById(projectId);
    if (!project) throw new Error("Created project could not be loaded.");
    return project;
  }

  async update(projectId: string, input: UpdateProject): Promise<Project> {
    const { error } = await this.client.rpc("update_project_with_settings", {
      p_project_id: projectId,
      ...rpcArgs(input),
    });
    if (error) throw error;

    const project = await this.findById(projectId);
    if (!project) throw new Error("Updated project could not be loaded.");
    return project;
  }

  async delete(projectId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select("id");
    if (error) throw error;
    return data.length === 1;
  }
}
