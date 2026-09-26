import { doc, getDocFromServer, runTransaction, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { findCloudPatientByNik } from "./patients";

const BUDI_NIK = "3201234567890002";
const DEMO_PREFIX = "rapidmind-phase0-demo";
const DEMO_START = Date.parse("2026-09-25T08:00:00.000Z");

async function ensureBudiPatient() {
  const existing = await findCloudPatientByNik(BUDI_NIK);
  if (existing) {
    if (existing.patient.nama?.trim().toLocaleLowerCase("id-ID") !== "budi santoso") {
      throw new Error("NIK demo Budi sudah dipakai profil lain. Gunakan dataset demo yang bersih.");
    }
    return;
  }

  const ref = doc(db, "patients", BUDI_NIK);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(ref)).exists()) return;
    transaction.set(ref, {
      nik: BUDI_NIK,
      nama: "Budi Santoso",
      usia: 45,
      jenisKelamin: "L",
      poskoName: "Posko Utama - Kota",
      registeredAt: "2026-09-24T08:00:00.000Z",
      lastPhase: "lanjutan",
      pfaCompleted: false,
      demoSeedKey: `${DEMO_PREFIX}-budi`,
    });
  });
  const confirmed = await findCloudPatientByNik(BUDI_NIK);
  if (!confirmed || confirmed.patient.nama?.trim().toLocaleLowerCase("id-ID") !== "budi santoso") {
    throw new Error("Pasien demo Budi belum terkonfirmasi di server.");
  }
}

export const SAMPLE_CASES = [
  // Zona Merah
  {
    zona: "merah",
    triageResult: "MERAH",
    jalur: "verbal",
    type: "VERBAL",
    relawanName: "Ahmad Fauzi",
    volunteerName: "Ahmad Fauzi",
    poskoName: "Posko Utama - Kota",
    poskoLat: -6.2088,
    poskoLng: 106.8456,
    lat: -6.2088 + 0.003,
    lng: 106.8456 - 0.002,
    transcript:
      "Saya sudah tidak sanggup lagi, rumah dan keluarga hilang. Saya mau mati saja menyakiti diri, tidak ada gunanya hidup.",
    detectedKeywords: ["mau mati", "menyakiti diri", "tidak ada gunanya hidup"],
    keywords: ["mau mati", "menyakiti diri", "tidak ada gunanya hidup"],
    pfaShown: true,
    needsPFA: true,
    score: 3,
  },
  {
    zona: "merah",
    triageResult: "MERAH",
    jalur: "nonverbal",
    type: "NON_VERBAL",
    relawanName: "Siti Rahma",
    volunteerName: "Siti Rahma",
    poskoName: "Posko Barat - Tangerang",
    poskoLat: -6.1781,
    poskoLng: 106.6319,
    lat: -6.1781 - 0.002,
    lng: 106.6319 + 0.003,
    checklistAnswers: {
      q1: true, // histeria
      q2: false,
      q3: false,
      q4: true,
      q5: true,
      q6: false,
      q7: false,
      q8: false,
    },
    criticalItems: ["Histeria / menjerit tidak terkendali"],
    warningItems: [
      "Gemetar hebat / panik berlebihan",
      "Menangis terus-menerus",
    ],
    pfaShown: true,
    needsPFA: true,
    score: 3,
  },
  {
    zona: "merah",
    triageResult: "MERAH",
    jalur: "nonverbal",
    type: "NON_VERBAL",
    relawanName: "Budi Santoso",
    volunteerName: "Budi Santoso",
    poskoName: "Posko Timur - Bekasi",
    poskoLat: -6.2383,
    poskoLng: 106.9756,
    lat: -6.2383 + 0.004,
    lng: 106.9756 + 0.001,
    checklistAnswers: {
      q1: false,
      q2: true, // disosiatif
      q3: true, // niat menyakiti diri
      q4: false,
      q5: false,
      q6: true,
      q7: true,
      q8: false,
    },
    criticalItems: [
      "Tidak merespons (disosiatif)",
      "Niat menyakiti diri sendiri",
    ],
    warningItems: ["Menolak makan/minum >24 jam", "Bingung / disorientasi"],
    pfaShown: true,
    needsPFA: true,
    score: 3,
  },
  // Zona Kuning
  {
    zona: "kuning",
    triageResult: "KUNING",
    jalur: "verbal",
    type: "VERBAL",
    relawanName: "Dewi Lestari",
    volunteerName: "Dewi Lestari",
    poskoName: "Posko Selatan - Depok",
    poskoLat: -6.4025,
    poskoLng: 106.7942,
    lat: -6.4025 + 0.002,
    lng: 106.7942 - 0.003,
    transcript:
      "Saya sangat takut dan cemas kalau ada gempa susulan. Semalam tidak bisa tidur sama sekali.",
    detectedKeywords: ["takut", "cemas", "tidak bisa tidur"],
    keywords: ["takut", "cemas", "tidak bisa tidur"],
    pfaShown: false,
    needsPFA: false,
    score: 2,
  },
  {
    zona: "kuning",
    triageResult: "KUNING",
    jalur: "verbal",
    type: "VERBAL",
    relawanName: "Ahmad Fauzi",
    volunteerName: "Ahmad Fauzi",
    poskoName: "Posko Utama - Kota",
    poskoLat: -6.2088,
    poskoLng: 106.8456,
    lat: -6.2088 - 0.004,
    lng: 106.8456 + 0.002,
    transcript:
      "Badan saya masih gemetar, rasanya panik terus dan bingung mau berbuat apa.",
    detectedKeywords: ["gemetar", "panik", "bingung"],
    keywords: ["gemetar", "panik", "bingung"],
    pfaShown: false,
    needsPFA: false,
    score: 2,
  },
  {
    zona: "kuning",
    triageResult: "KUNING",
    jalur: "nonverbal",
    type: "NON_VERBAL",
    relawanName: "Rian Pratama",
    volunteerName: "Rian Pratama",
    poskoName: "Posko Utara - Tangerang Selatan",
    poskoLat: -6.2894,
    poskoLng: 106.7108,
    lat: -6.2894 + 0.003,
    lng: 106.7108 + 0.002,
    checklistAnswers: {
      q1: false,
      q2: false,
      q3: false,
      q4: true,
      q5: true,
      q6: false,
      q7: true,
      q8: false,
    },
    criticalItems: [],
    warningItems: [
      "Gemetar hebat / panik berlebihan",
      "Menangis terus-menerus",
      "Bingung / disorientasi",
    ],
    pfaShown: false,
    needsPFA: false,
    score: 2,
  },
  {
    zona: "kuning",
    triageResult: "KUNING",
    jalur: "nonverbal",
    type: "NON_VERBAL",
    relawanName: "Siti Rahma",
    volunteerName: "Siti Rahma",
    poskoName: "Posko Barat - Tangerang",
    poskoLat: -6.1781,
    poskoLng: 106.6319,
    lat: -6.1781 + 0.004,
    lng: 106.6319 - 0.001,
    checklistAnswers: {
      q1: false,
      q2: false,
      q3: false,
      q4: false,
      q5: true,
      q6: true,
      q7: false,
      q8: false,
    },
    criticalItems: [],
    warningItems: ["Menangis terus-menerus", "Menolak makan/minum >24 jam"],
    pfaShown: false,
    needsPFA: false,
    score: 2,
  },
  // Zona Hijau
  {
    zona: "hijau",
    triageResult: "HIJAU",
    jalur: "verbal",
    type: "VERBAL",
    relawanName: "Budi Santoso",
    volunteerName: "Budi Santoso",
    poskoName: "Posko Timur - Bekasi",
    poskoLat: -6.2383,
    poskoLng: 106.9756,
    lat: -6.2383 - 0.002,
    lng: 106.9756 - 0.003,
    transcript:
      "Alhamdulillah kondisi kami sekeluarga aman dan tenang di tenda ini, bantuan makanan juga cukup.",
    detectedKeywords: [],
    keywords: [],
    pfaShown: false,
    needsPFA: false,
    score: 0,
  },
  {
    zona: "hijau",
    triageResult: "HIJAU",
    jalur: "nonverbal",
    type: "NON_VERBAL",
    relawanName: "Dewi Lestari",
    volunteerName: "Dewi Lestari",
    poskoName: "Posko Selatan - Depok",
    poskoLat: -6.4025,
    poskoLng: 106.7942,
    lat: -6.4025 - 0.001,
    lng: 106.7942 + 0.004,
    checklistAnswers: {
      q1: false,
      q2: false,
      q3: false,
      q4: false,
      q5: false,
      q6: false,
      q7: false,
      q8: true,
    },
    criticalItems: [],
    warningItems: [],
    pfaShown: false,
    needsPFA: false,
    score: 0,
  },
  {
    zona: "hijau",
    triageResult: "HIJAU",
    jalur: "verbal",
    type: "VERBAL",
    relawanName: "Rian Pratama",
    volunteerName: "Rian Pratama",
    poskoName: "Posko Utara - Tangerang Selatan",
    poskoLat: -6.2894,
    poskoLng: 106.7108,
    lat: -6.2894 - 0.002,
    lng: 106.7108 - 0.003,
    transcript:
      "Kami baik-baik saja dan bersyukur sudah dievakuasi ke posko ini.",
    detectedKeywords: [],
    keywords: [],
    pfaShown: false,
    needsPFA: false,
    score: 0,
  },
];

export async function seedDemoData() {
  await ensureBudiPatient();
  const results = [];

  for (const [index, item] of SAMPLE_CASES.entries()) {
    const key = `${DEMO_PREFIX}-case-${String(index + 1).padStart(2, "0")}`;
    const ref = doc(db, "cases", key);
    const existing = await getDocFromServer(ref);
    if (existing.exists() && existing.data().demoSeedKey !== key) {
      throw new Error(`Dokumen ${key} sudah dipakai data lain; seeding dihentikan.`);
    }
    const timestamp = new Date(DEMO_START + index * 10 * 60 * 1000);
    const linkedBudi = index === 3 ? {
      patientNik: BUDI_NIK,
      patientName: "Budi Santoso",
      patientAge: 45,
      patientGender: "L",
      phase: "lanjutan",
    } : {};
    await setDoc(ref, {
      ...item,
      ...linkedBudi,
      demoSeedKey: key,
      createdAt: Timestamp.fromDate(timestamp),
      timestamp: timestamp.toISOString(),
      location: {
        lat: item.lat,
        lng: item.lng,
      },
      syncedFromOffline: false,
    });
    results.push(ref.id);
  }

  return results;
}
