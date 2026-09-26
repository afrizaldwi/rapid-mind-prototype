import { Navigate, Outlet } from "react-router-dom";
import { useAssessment } from "../hooks/useAssessment";

export default function AssessmentRoute() {
  const { patient } = useAssessment();
  return patient ? <Outlet /> : <Navigate to="/relawan/patient-lookup" replace />;
}
