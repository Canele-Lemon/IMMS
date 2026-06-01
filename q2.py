function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  const target = numberInfoList.find(
    (item) => String(item.sample) === String(selectedSample)
  );

  if (!target?.data) return [];

  const preq = target.data.preq ?? [];
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

const chartData = buildSVChartDataFromApi(
  svRawNumberInfo,
  selectedSample
);


}, [selectedSample, selectedTestCase, svRawNumberInfo]);


console.log("selectedSample:", selectedSample);
console.log(
  "api samples:",
  svRawNumberInfo.map((item) => item.sample)
);
console.log("chartData length:", chartData.length);