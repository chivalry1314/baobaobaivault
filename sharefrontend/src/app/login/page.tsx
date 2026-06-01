import { Suspense } from "react";
import { AuthPage } from "@/components/share/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  );
}
