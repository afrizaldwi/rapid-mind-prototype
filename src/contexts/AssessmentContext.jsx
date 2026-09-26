import { useState } from "react";
import { AssessmentContext } from "./assessmentContext";
import { assessmentSchema } from "../schemas/assessment";
import { useAuth } from "../hooks/useAuth";

const STORAGE_KEY = "rapidMind.activeAssessment";

function restoreAssessment(relawanId) {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const result = assessmentSchema.safeParse(JSON.parse(stored));
    if (result.success && result.data.relawanId === relawanId) return result.data;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable or contain invalid JSON.
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* unavailable */
    }
  }
  return null;
}

function persistAssessment(value) {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Keep the assessment in React state if browser storage is unavailable.
  }
}

export function AssessmentProvider({ children }) {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState(() => restoreAssessment(user?.uid));
  const activeAssessment = assessment?.relawanId === user?.uid ? assessment : null;

  const startAssessment = ({
    patient,
    phase,
    previousHistory = [],
    isNewPatient = false,
  }) => {
    const next = {
      relawanId: user?.uid,
      patient: {
        nik: patient.nik,
        nama: patient.nama || "",
        usia: patient.usia ?? null,
        jenisKelamin: patient.jenisKelamin || "",
        poskoName: patient.poskoName || "",
      },
      phase,
      previousHistory,
      isNewPatient,
      startedAt: new Date().toISOString(),
    };
    const result = assessmentSchema.safeParse(next);
    if (!result.success) throw new Error("Identitas asesmen tidak valid");
    persistAssessment(result.data);
    setAssessment(result.data);
  };

  const clearAssessment = () => {
    persistAssessment(null);
    setAssessment(null);
  };

  return (
    <AssessmentContext.Provider
      value={{
        assessment: activeAssessment,
        patient: activeAssessment?.patient ?? null,
        startAssessment,
        clearAssessment,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}
