import { AuthProvider } from "@/context/AuthContext";
import Mainlayout from "@/components/layout/Mainlayout";
import SubscriptionSuccessPage from "@/components/SubscriptionSuccessPage";

export default function Page() {
  return (
    <AuthProvider>
      <Mainlayout currentPage="subscription">
        <SubscriptionSuccessPage />
      </Mainlayout>
    </AuthProvider>
  );
}