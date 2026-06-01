function calculateSampleCount(model_PK, sample_list) {
  const summaryRows = sample_list.filter(
    (s) => s.Model_PK === model_PK && s.Sample_No === "Summary"
  );

  const hasStickSlipSummary = summaryRows.some(
    (s) => normalizeItem(s.Item) === "Stick-Slip"
  );

  const hasSoundVibrationSummary = summaryRows.some(
    (s) => normalizeItem(s.Item) === "Sound Vibration"
  );

  const sampleRows = sample_list.filter(
    (s) => s.Model_PK === model_PK && s.Sample_No !== "Summary"
  );

  const stickSlipSamples = hasStickSlipSummary
    ? new Set(
        sampleRows
          .filter((s) => normalizeItem(s.Item) === "Stick-Slip")
          .map((s) => s.Sample_No)
      ).size
    : 0;

  const soundVibrationSamples = hasSoundVibrationSummary
    ? new Set(
        sampleRows
          .filter((s) => normalizeItem(s.Item) === "Sound Vibration")
          .map((s) => s.Sample_No)
      ).size
    : 0;

  return {
    total: stickSlipSamples + soundVibrationSamples,
    stick_slip: stickSlipSamples,
    sound_vibration: soundVibrationSamples,
    has_stick_slip_summary: hasStickSlipSummary,
    has_sound_vibration_summary: hasSoundVibrationSummary,
  };
}


const fetchValidModelPKs = async () => {
  const res = await fetch(
    `${BASE_URL()}/sound/db/vibration-sample-info?limit=5000`
  );
  const data = await res.json();

  const validRows = data.filter(
    (s) =>
      normalizeItem(s.Item) === "Stick-Slip" ||
      normalizeItem(s.Item) === "Sound Vibration"
  );

  const modelMap = new Map();

  validRows.forEach((s) => {
    if (!modelMap.has(s.Model_PK)) {
      modelMap.set(s.Model_PK, []);
    }
    modelMap.get(s.Model_PK).push(s);
  });

  return modelMap;
};



function hasStickSlip(model) {
  return (
    model.sample_count.has_stick_slip_summary === true &&
    model.sample_count.stick_slip > 0
  );
}

function hasSoundVibration(model) {
  return (
    model.sample_count.has_sound_vibration_summary === true &&
    model.sample_count.sound_vibration > 0
  );
}




Sample_No === "Summary" && Item === "Sound Vibration"
→ SV 측정 모델로 인정
→ 그다음 Sample_No !== "Summary"인 SV sample 개수 count

Sample_No === "Summary" && Item === "Stick-Slip" 또는 "Stic-Slip"
→ SS 측정 모델로 인정
→ 그다음 Sample_No !== "Summary"인 SS sample 개수 count