import { AuthProvider } from "@/context/AuthContext";
import Mainlayout from "@/components/layout/Mainlayout";
import SubscriptionPlansPage from "@/components/SubscriptionPlansPage";

export default function Page() {
  return (
    <AuthProvider>
      <Mainlayout>
        <SubscriptionPlansPage />
      </Mainlayout>
    </AuthProvider>
  );
}
