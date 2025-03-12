import Image from "next/image";
import AdminLogin from "./adminLogin";
import AdminDashboard from "./components/AdminDashboard";

export default function Home() {
  return (
    <div>
      {/* <AdminLogin /> */}
      <AdminDashboard />
    </div>
  );
}
