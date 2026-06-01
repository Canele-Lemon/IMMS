function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  console.log("selectedSample:", selectedSample);
  console.log(
    "api sample list:",
    numberInfoList.map((item) => item.sample)
  );

  const target = numberInfoList.find(
    (item) => String(item.sample) === String(selectedSample)
  );

  console.log("matched target:", target);

  if (!target) {
    console.warn("❌ No matched sample", {
      selectedSample,
      apiSamples: numberInfoList.map((item) => item.sample),
    });
    return [];
  }

  if (!target.data) {
    console.warn("❌ Matched sample exists, but data is missing", target);
    return [];
  }

  const preq = target.data.preq ?? target.data.freq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

  console.log("preq length:", preq.length);
  console.log("spec length:", spec.length);
  console.log("rattle length:", rattle.length);
  console.log("first:", preq[0], spec[0], rattle[0]);

  const length = Math.min(preq.length, spec.length, rattle.length);

  return Array.from({ length }, (_, i) => ({
    x: Number(preq[i]),
    spec: Number(spec[i]),
    measurement: Number(rattle[i]),
    margin: Number(spec[i]) - Number(rattle[i]),
  })).filter(
    (d) =>
      Number.isFinite(d.x) &&
      Number.isFinite(d.spec) &&
      Number.isFinite(d.measurement)
  );
}