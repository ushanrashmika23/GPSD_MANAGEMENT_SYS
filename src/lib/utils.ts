export const cn = (...c: (string | boolean | undefined | null)[]): string =>
  c.filter(Boolean).join(" ");

export const fmtCur = (n: number): string => `LKR ${n.toLocaleString()}`;

export const fmtDate = (d: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

export const fmtMonth = (m: string): string => {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const initials = (name: string): string =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
