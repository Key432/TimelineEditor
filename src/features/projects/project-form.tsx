"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProject,
  projectKeys,
  updateProject,
} from "@/features/projects/api";
import {
  PROJECT_TEMPLATES,
  PROJECT_TEMPLATE_LABELS,
  type Project,
} from "@/features/projects/types";
import {
  createProjectSchema,
  type ProjectFormInput,
  type ProjectFormValues,
} from "@/features/projects/validation";

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const subscribeToClient = () => () => undefined;

type ProjectFormProps =
  | { mode: "create"; currentYear: number; project?: never }
  | { mode: "edit"; currentYear: number; project: Project };

function defaults(props: ProjectFormProps): ProjectFormInput {
  if (props.mode === "edit") {
    return {
      name: props.project.name,
      description: props.project.description ?? "",
      template: "empty",
      settings: props.project.settings,
    };
  }

  return {
    name: "",
    description: "",
    template: "general",
    settings: {
      defaultUncertaintyYears: 5,
      initialStartYear: 1800,
      initialEndYear: props.currentYear,
      initialZoomPreset: "fit-range",
      timelineDensity: "comfortable",
      minimumTimeUnit: "day",
    },
  };
}

export function ProjectForm(props: ProjectFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formId = useId();
  const isHydrated = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormInput, undefined, ProjectFormValues>({
    resolver: standardSchemaResolver(createProjectSchema),
    defaultValues: defaults(props),
  });

  const mutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      if (props.mode === "create") return createProject(values);
      const input = {
        name: values.name,
        description: values.description,
        settings: values.settings,
      };
      return updateProject(props.project.id, input);
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      router.push(`/projects/${project.id}/settings`);
      router.refresh();
    },
  });

  return (
    <form
      aria-label={
        props.mode === "create" ? "プロジェクト作成" : "プロジェクト設定"
      }
      className="space-y-6"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>プロジェクト名</Label>
        <Input
          id={`${formId}-name`}
          aria-invalid={Boolean(errors.name)}
          autoComplete="off"
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-description`}>説明（任意）</Label>
        <Textarea
          id={`${formId}-description`}
          rows={4}
          {...register("description")}
        />
        {errors.description ? (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      {props.mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-template`}>テンプレート</Label>
          <select
            id={`${formId}-template`}
            className={selectClassName}
            {...register("template")}
          >
            {PROJECT_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {PROJECT_TEMPLATE_LABELS[template]}
              </option>
            ))}
          </select>
          <p className="text-xs leading-5 text-muted-foreground">
            用途に合う対象種別を初期登録します。作成後に自由に変更できます。
          </p>
        </div>
      ) : null}

      <details
        className="rounded-lg border bg-muted/30 p-4"
        open={props.mode === "edit"}
      >
        <summary className="cursor-pointer font-medium">詳細設定</summary>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-start-year`}>初期表示開始年</Label>
            <Input
              id={`${formId}-start-year`}
              inputMode="numeric"
              type="number"
              {...register("settings.initialStartYear", {
                valueAsNumber: true,
              })}
            />
            {errors.settings?.initialStartYear ? (
              <p className="text-sm text-destructive">
                {errors.settings.initialStartYear.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-end-year`}>初期表示終了年</Label>
            <Input
              id={`${formId}-end-year`}
              inputMode="numeric"
              type="number"
              {...register("settings.initialEndYear", { valueAsNumber: true })}
            />
            {errors.settings?.initialEndYear ? (
              <p className="text-sm text-destructive">
                {errors.settings.initialEndYear.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-uncertainty`}>
              曖昧期間の既定値（年）
            </Label>
            <Input
              id={`${formId}-uncertainty`}
              inputMode="numeric"
              min={0}
              type="number"
              {...register("settings.defaultUncertaintyYears", {
                valueAsNumber: true,
              })}
            />
            {errors.settings?.defaultUncertaintyYears ? (
              <p className="text-sm text-destructive">
                {errors.settings.defaultUncertaintyYears.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-zoom`}>初期ズーム</Label>
            <select
              id={`${formId}-zoom`}
              className={selectClassName}
              {...register("settings.initialZoomPreset")}
            >
              <option value="fit-range">表示範囲に合わせる</option>
              <option value="century">世紀</option>
              <option value="decade">10年</option>
              <option value="year">1年</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-density`}>表示密度</Label>
            <select
              id={`${formId}-density`}
              className={selectClassName}
              {...register("settings.timelineDensity")}
            >
              <option value="comfortable">ゆったり</option>
              <option value="compact">コンパクト</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-unit`}>最小時間単位</Label>
            <select
              id={`${formId}-unit`}
              className={selectClassName}
              {...register("settings.minimumTimeUnit")}
            >
              <option value="day">日</option>
              <option value="month">月</option>
              <option value="year">年</option>
            </select>
          </div>
        </div>
      </details>

      {mutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={!isHydrated || mutation.isPending} type="submit">
          <Save aria-hidden="true" className="size-4" />
          {mutation.isPending
            ? "保存中…"
            : props.mode === "create"
              ? "プロジェクトを作成"
              : "設定を保存"}
        </Button>
      </div>
    </form>
  );
}
