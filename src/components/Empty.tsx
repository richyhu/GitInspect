import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 空组件
export function Empty() {
  return (
    <div className={cn("flex h-full items-center justify-center")} onClick={() => toast('即将上线')}>空</div>
  );
}