function normalizeSample(sample) {
  const str = String(sample ?? "").trim();

  if (/^\d+$/.test(str)) {
    return String(Number(str));
  }

  return str.toUpperCase();
}

function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  const normalizedSelectedSample = normalizeSample(selectedSample);

  const target = numberInfoList.find(
    (item) => normalizeSample(item.sample) === normalizedSelectedSample
  );

  if (!target?.data) return [];

  const preq = target.data.preq ?? target.data.freq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

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