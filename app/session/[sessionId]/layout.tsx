import { SessionHistoryGuard } from "@/components/SessionHistoryGuard";

export default function SessionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    <SessionHistoryGuard />
    {children}
  </>;
}
