import { Navigate } from "react-router-dom";

export default function MemberDashboard() {
  return <Navigate to="/community?view=my-space" replace />;
}
