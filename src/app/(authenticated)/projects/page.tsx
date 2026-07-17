import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            プロジェクト
          </h1>
          <p className="text-sm text-muted-foreground">
            年表プロジェクトを管理します。
          </p>
        </div>
        <Badge className="border-primary/30 bg-brand-primary-soft text-brand-primary-active">
          認証済み
        </Badge>
      </div>

      <Card className="max-w-2xl border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">基盤の準備ができました</CardTitle>
          <CardDescription>
            プロジェクトの作成・編集・削除はPhase 2で実装します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            現在は認証、保護レイアウト、基本ナビゲーションが利用できます。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
