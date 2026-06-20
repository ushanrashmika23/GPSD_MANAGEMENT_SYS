import { cn, initials } from "../../lib/utils";

type AvatarSize = "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, string> = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

const colors = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-primary/10 text-primary",
];

interface AvatarProps {
  name: string;
  size?: AvatarSize;
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const colorIndex = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold shrink-0",
        sizeMap[size],
        colors[colorIndex]
      )}
    >
      {initials(name)}
    </div>
  );
}
