import {
  BookOpen,
  Brain,
  CircleDot,
  GalleryHorizontal,
  ImageIcon,
  Landmark,
  Newspaper,
  Sparkles,
  Swords,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "user-round": UserRound,
  brain: Brain,
  sparkles: Sparkles,
  newspaper: Newspaper,
  "users-round": UsersRound,
  "book-open": BookOpen,
  image: ImageIcon,
  swords: Swords,
  landmark: Landmark,
  "gallery-horizontal": GalleryHorizontal,
  "circle-dot": CircleDot,
};

export const ITEM_TYPE_ICON_LABELS: Record<string, string> = {
  "user-round": "人物",
  brain: "思想",
  sparkles: "運動",
  newspaper: "雑誌",
  "users-round": "団体",
  "book-open": "書籍",
  image: "作品",
  swords: "戦争",
  landmark: "政治・社会",
  "gallery-horizontal": "展覧会・公演",
  "circle-dot": "その他",
};

export function ItemTypeIcon({
  icon,
  color,
  className,
}: {
  icon: string | null;
  color: string;
  className?: string;
}) {
  const Icon = ICONS[icon ?? ""] ?? CircleDot;
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      style={{ color }}
    />
  );
}

export function ItemTypeIconPicker({
  value,
  color,
  onChange,
}: {
  value: string | null;
  color: string;
  onChange: (icon: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-muted-foreground">アイコン</legend>
      <div className="grid grid-cols-6 gap-2">
        {Object.keys(ICONS).map((icon) => (
          <button
            key={icon}
            aria-label={`${ITEM_TYPE_ICON_LABELS[icon]}アイコン`}
            aria-pressed={value === icon}
            className="flex h-9 items-center justify-center rounded border aria-pressed:ring-2 aria-pressed:ring-primary"
            type="button"
            onClick={() => onChange(icon)}
          >
            <ItemTypeIcon className="size-5" color={color} icon={icon} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
