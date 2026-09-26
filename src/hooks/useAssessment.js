import { useContext } from "react";
import { AssessmentContext } from "../contexts/assessmentContext";

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (!context) throw new Error("useAssessment harus digunakan dalam AssessmentProvider");
  return context;
}
