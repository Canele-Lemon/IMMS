function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  console.log("===== SV Chart Build Debug =====");
  console.log("selectedSample:", selectedSample);
  console.log(
    "numberInfo numbers:",
    numberInfoList.map((item) => item.number)
  );
  console.log(
    "numberInfo sheet names:",
    numberInfoList.map((item) => item.sheet_name)
  );

  const target = numberInfoList.find(
    (item) => String(item.number) === String(selectedSample)
  );

  console.log("matched target:", target);

  if (!target?.data) return [];

  const preq = target.data.preq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

  console.log("preq length:", preq.length);
  console.log("spec length:", spec.length);
  console.log("rattle length:", rattle.length);
  console.log("first data:", {
    preq: preq[0],
    spec: spec[0],
    rattle: rattle[0],
  });

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