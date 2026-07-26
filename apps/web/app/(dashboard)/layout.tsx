import { RequireAuth } from "@/components/auth/require-auth";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
